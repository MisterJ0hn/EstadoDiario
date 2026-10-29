"""Entrega, a un sistema externo, de las credenciales del OJV de los abogados.

El sistema externo necesita entrar al Poder Judicial como el abogado dueño de
cada causa. Son datos que no deberían salir nunca, así que esto es lo contrario
de un campo más en la respuesta: cada capa existe porque la anterior puede
fallar.

1. **Permiso por key.** Solo una key con `expone_credenciales_pjud` (apagado por
   defecto, lo enciende la consola de administración) y solo si además la pide
   la request con `?incluir_credenciales=true`. Una sesión de persona (JWT) no
   puede: esto es para sistemas, no para el navegador.
2. **IPs obligatorias.** Sin `ips_permitidas` la key no entrega credenciales,
   aunque lea todo lo demás. Una key robada que se use desde otro lado recibe
   el 401 de siempre antes de llegar acá (ver `api_key.autenticar`).
3. **La clave nunca viaja en claro.** Sale sellada con la llave pública RSA del
   sistema externo (RSA-OAEP + AES-256-GCM). Lo que quede en un log, un proxy o
   un caché del camino es un texto que solo su llave privada abre.
4. **Quedan registradas** cada entrega (quién, desde dónde, de cuántos
   abogados), y jamás el contenido.

**De quién son.** El dueño de una causa es el abogado cuyo RUT trae el archivo
del que salió (ver `UsuarioRut`). No se cae al "usuario que subió el archivo":
si lo cargó otra persona, se entregaría la clave de quien no es. Si el RUT no
calza con nadie, o calza con más de un usuario, no se entrega nada — ante la
duda, la causa va sin credencial.
"""

import logging
from dataclasses import dataclass
from typing import Optional, Sequence

from fastapi import Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core import api_key
from app.core.config import settings
from app.core.crypto import descifrar
from app.core.database import SesionMaestra
from app.core.sello_rsa import sellar
from app.core.deps import TenantContexto, get_tenant_actual
from app.models.causa import ORIGEN_DATO_API, Causa
from app.models.maestra.api_key import ApiKey
from app.models.maestra.cliente import Cliente
from app.models.usuario import Usuario
from app.models.usuario_rut import UsuarioRut, limpiar_rut
from app.services import auditoria_service as auditoria

logger = logging.getLogger(__name__)

DESC_INCLUIR = (
    "Opcional, solo con API key autorizada. Agrega `credenciales_pjud` (RUT, "
    "clave y método de login del OJV de los abogados dueños, sellados con la "
    "llave pública de la key) y `credencial_ref` en cada fila. Ver `sello`."
)


# ── Dueño de la causa ────────────────────────────────────


def _duenos_por_rut(db: Session, ruts: set[str]) -> dict[str, Optional[Usuario]]:
    """RUT normalizado del archivo → el único usuario activo que lo tiene.

    El PJUD emite la mitad de los archivos sin dígito verificador, así que se
    compara contra el RUT completo y contra su cuerpo (igual que `UsuarioRut`).
    Con 0 o 2+ coincidencias el valor es `None`.
    """
    candidatos = (
        db.query(UsuarioRut, Usuario)
        .join(Usuario, Usuario.id == UsuarioRut.usuario_id)
        .filter(Usuario.activo.is_(True), Usuario.es_integracion.is_(False))
        .all()
    )
    resultado: dict[str, Optional[Usuario]] = {}
    for rut in ruts:
        usuarios = {
            u.id: u for ur, u in candidatos if rut in (ur.rut_normalizado, ur.cuerpo)
        }
        resultado[rut] = next(iter(usuarios.values())) if len(usuarios) == 1 else None
    return resultado


def usuario_dueno_de_rut(db: Session, rut: Optional[str]) -> Optional[Usuario]:
    """El único usuario activo que recibe archivos del PJUD con ese RUT, o None.

    Es lo que decide a nombre de quién queda un archivo que llega por correo:
    el reporte se emite a nombre del abogado que lo pidió, así que su RUT dice
    de quién es. `None` si el RUT no viene, no lo tiene nadie o lo tienen dos.
    """
    limpio = limpiar_rut(rut or "")
    if not limpio:
        return None
    return _duenos_por_rut(db, {limpio}).get(limpio)


def _credencial_de_la_causa(causa) -> Optional[dict]:
    """La credencial guardada en la propia causa, o None. `causa` puede ser una
    `Causa` o el `SimpleNamespace` de `pjud_dueno_service`."""
    rut = getattr(causa, "pjud_rut", None)
    cifrada = getattr(causa, "pjud_clave_cifrada", None)
    if not (rut and cifrada):
        return None
    try:
        return {
            "rut": rut,
            "clave": descifrar(cifrada),
            "metodo_login": getattr(causa, "pjud_metodo_login", None) or 1,
        }
    except ValueError:
        logger.error("No se pudo leer la clave del OJV guardada en la causa")
        return None


def recordar_credencial_integrador(db: Session, causa, cuerpo: dict) -> None:
    """Guarda en la causa la credencial que mandó el sistema externo, si corresponde.

    Solo en una causa de API **sin abogado**: es la que api-pjud entregó con esa
    clave y la única con la que se puede volver a pedir. Una causa con dueño nunca
    guarda nada (manda el abogado), y una sin resolver (`causa` None o sin `id`)
    tampoco: ante la duda no se asocia una clave a una causa que no se sabe cuál es.
    Pisa la anterior, así que la última clave que funcionó es la que queda. Nunca
    revienta: guardarla es una mejora, la consulta sigue con lo que mandó el cliente.
    """
    rut = str(cuerpo.get("rut") or "").strip()
    clave = str(cuerpo.get("clave") or "").strip()
    causa_id = getattr(causa, "id", None)
    if not (rut and clave and causa_id) or getattr(causa, "rut_efectivo", None):
        return
    try:
        fila = db.get(Causa, causa_id)
        if fila is None or fila.origen_dato != ORIGEN_DATO_API or fila.rut_efectivo:
            return
        fila.pjud_rut = rut[:20]
        fila.pjud_clave = clave
        fila.pjud_metodo_login = _entero_o_none(cuerpo.get("metodo_login")) or 1
        db.commit()
        # La copia en memoria que ya resolvió el dueño debe ver lo recién guardado.
        causa.pjud_rut = fila.pjud_rut
        causa.pjud_clave_cifrada = fila.pjud_clave_cifrada
        causa.pjud_metodo_login = fila.pjud_metodo_login
    except Exception:
        logger.exception("No se pudo guardar la credencial de la integración en la causa")
        db.rollback()


def _entero_o_none(valor) -> Optional[int]:
    try:
        return int(str(valor).strip())
    except (TypeError, ValueError):
        return None


def credenciales_del_dueno(db: Session, causa) -> Optional[dict]:
    """`{"rut", "clave", "metodo_login"}` del abogado dueño de `causa`, o None.

    Es lo que se manda a api-pjud en `consultar_*`, `consultar_movimientos_*` y
    `sincronizar_*` (ver `PjudService._con_credenciales`); no pasa por el sello
    RSA porque no sale hacia ningún sistema externo.

    El dueño se resuelve por `Causa.rut_efectivo`, no por el RUT del archivo:
    una causa dada de alta por API que todavía no tiene abogado no tiene dueño,
    y entonces se llama a api-pjud sin credenciales en vez de usar las de quien
    esté mirando la pantalla. Lo mismo si el RUT no calza con nadie o calza con
    más de un usuario (ver `_duenos_por_rut`), o si el abogado no tiene la clave
    del OJV cargada.
    """
    rut = limpiar_rut(causa.rut_efectivo or "")
    if not rut:
        # Sin abogado: la única credencial posible es la con que el sistema externo
        # descargó la causa (ver `recordar_credencial_integrador`).
        return _credencial_de_la_causa(causa)
    usuario = _duenos_por_rut(db, {rut}).get(rut)
    if usuario is None or not usuario.pjud_configurado:
        return None
    try:
        return {
            "rut": usuario.pjud_rut,
            "clave": usuario.pjud_clave,
            "metodo_login": usuario.pjud_metodo_login,
        }
    except ValueError:
        # Clave ilegible (cambió la llave de cifrado). Sin el mensaje de la
        # excepción por si trae algo.
        logger.error("No se pudo leer la clave del OJV del usuario %s", usuario.id)
        return None


# ── Quién pide y qué entrega ─────────────────────────────


@dataclass(frozen=True)
class Entrega:
    """Resultado de `Sellador.entregar`: `refs` va alineada con los RUT recibidos."""

    refs: list[Optional[str]]
    credenciales_pjud: dict[str, str]
    # Sello con la conexión de la plataforma a api-pjud (`base_url`, `email`,
    # `password`, `client_key`). Es lo que el sistema externo necesita, además
    # de las credenciales del abogado, para consultar api-pjud por su cuenta.
    # `None` si el cliente no tiene el PJUD habilitado o la plataforma no lo
    # tiene configurado.
    api_pjud: Optional[str] = None
    # Si el cliente tiene el PJUD habilitado. `False` explica por qué la
    # respuesta viene sin ninguna credencial.
    pjud_habilitado: bool = True


@dataclass(frozen=True)
class Sellador:
    api_key_id: int
    prefijo: str
    guid: str
    usuario_id: int
    ip: Optional[str]
    ruta: str
    llave_publica_pem: str
    # El cliente puede usar el PJUD (`Cliente.pjud_habilitado`, lo enciende la
    # consola de administración). Apagado, no se entrega NINGUNA credencial,
    # pero la request no falla: el sistema externo sigue leyendo sus datos.
    pjud_habilitado: bool = True

    def _sellar_api_pjud(self) -> Optional[str]:
        """La conexión de la plataforma a api-pjud, sellada para esta key.

        Es una credencial de la PLATAFORMA —una sola suscripción para todos los
        clientes—, no del estudio. Por eso va tras las mismas capas que las
        claves del OJV y nunca en claro.
        """
        if not settings.pjud_api_activo:
            return None
        try:
            return sellar(
                self.llave_publica_pem,
                {
                    "base_url": settings.PJUD_API_BASE_URL,
                    "email": settings.PJUD_API_EMAIL,
                    "password": settings.PJUD_API_PASSWORD,
                    "client_key": settings.PJUD_API_CLIENT_KEY,
                },
            )
        except ValueError:
            logger.error("API key %s: no se pudo sellar la conexión a api-pjud", self.prefijo)
            return None

    def entregar(self, db: Session, ruts: Sequence[Optional[str]]) -> Entrega:
        """Sella las credenciales de los dueños de `ruts` (los de las filas de la
        respuesta). Un sello por abogado, no por fila: las filas lo referencian
        con `credencial_ref`, un número de la respuesta que no es ningún id."""
        if not self.pjud_habilitado:
            return Entrega(
                refs=[None] * len(ruts), credenciales_pjud={}, api_pjud=None,
                pjud_habilitado=False,
            )

        normalizados = [limpiar_rut(r) if r else None for r in ruts]
        duenos = _duenos_por_rut(db, {n for n in normalizados if n})

        ref_por_usuario: dict[int, str] = {}
        sellos: dict[str, str] = {}
        refs: list[Optional[str]] = []
        ids_entregados: list[int] = []

        for n in normalizados:
            usuario = duenos.get(n) if n else None
            if usuario is None or not usuario.pjud_configurado:
                refs.append(None)
                continue
            ref = ref_por_usuario.get(usuario.id)
            if ref is None:
                try:
                    contenido = {
                        "rut": usuario.pjud_rut,
                        "clave": usuario.pjud_clave,
                        "metodo_login": usuario.pjud_metodo_login,
                    }
                    sello = sellar(self.llave_publica_pem, contenido)
                except ValueError:
                    # Clave ilegible (cambió la llave de cifrado) o llave pública
                    # dañada. Sin el mensaje de la excepción por si trae algo.
                    logger.error(
                        "API key %s: no se pudo sellar la credencial del usuario %s",
                        self.prefijo, usuario.id,
                    )
                    refs.append(None)
                    continue
                ref = f"c{len(sellos) + 1}"
                ref_por_usuario[usuario.id] = ref
                sellos[ref] = sello
                ids_entregados.append(usuario.id)
            refs.append(ref)

        api_pjud = self._sellar_api_pjud()

        if ids_entregados or api_pjud:
            # Aparte y no en la transacción del endpoint: la entrega ocurrió
            # aunque el resto de la request falle después.
            auditoria.registrar_aparte(
                self.guid,
                auditoria.MODULO_AUTH,
                auditoria.ACCION_API_KEY_CREDENCIALES,
                usuario_id=self.usuario_id,
                ip=self.ip,
                detalle=(
                    f"{self.ruta} key={self.prefijo} entregadas={len(ids_entregados)} "
                    f"usuarios={','.join(str(i) for i in ids_entregados)} "
                    f"api_pjud={'si' if api_pjud else 'no'}"
                ),
            )
        return Entrega(refs=refs, credenciales_pjud=sellos, api_pjud=api_pjud)


def _denegar(tenant: TenantContexto, request: Request, motivo: str, prefijo: Optional[str]):
    auditoria.registrar_aparte(
        tenant.guid,
        auditoria.MODULO_AUTH,
        auditoria.ACCION_API_KEY_DENEGADO,
        usuario_id=tenant.usuario_id,
        ip=api_key.ip_confiable(request),
        detalle=f"{request.url.path} credenciales_pjud ({motivo}) key={prefijo or '-'}",
    )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Esta API key no está autorizada para recibir credenciales del PJUD",
    )


def sellador_solicitado(
    request: Request,
    response: Response,
    incluir_credenciales: bool = Query(False, description=DESC_INCLUIR),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    tenant: TenantContexto = Depends(get_tenant_actual),
) -> Optional[Sellador]:
    """`None` si no se pidieron credenciales; el `Sellador` si se pidieron y la
    key puede recibirlas; 403 si se pidieron y no puede.

    Depende de `get_tenant_actual` para correr DESPUÉS de la autenticación de la
    key (que ya validó revocación, vencimiento, IP y límite): acá solo se decide
    el permiso extra.
    """
    if not incluir_credenciales:
        return None

    if not x_api_key:
        # Una sesión de persona nunca recibe claves ajenas.
        _denegar(tenant, request, "sin_api_key", None)

    db = SesionMaestra()
    try:
        fila = db.query(ApiKey).filter(ApiKey.key_hash == api_key.hash_key(x_api_key)).first()
        if fila is None:  # no debería pasar: autenticar ya la resolvió
            _denegar(tenant, request, "key_no_encontrada", None)
        if not fila.expone_credenciales_pjud:
            _denegar(tenant, request, "no_autorizada", fila.prefijo)
        if not api_key.ips_de(fila):
            _denegar(tenant, request, "sin_ips_permitidas", fila.prefijo)
        if not fila.llave_publica_pem:
            _denegar(tenant, request, "sin_llave_publica", fila.prefijo)
        cliente = db.get(Cliente, tenant.cliente_id)
        pjud_habilitado = bool(cliente and cliente.pjud_habilitado)
        if not pjud_habilitado:
            # No es un error: la key sigue leyendo sus datos. Pero pidió
            # credenciales y no se le dan, y eso tiene que quedar escrito.
            auditoria.registrar_aparte(
                tenant.guid,
                auditoria.MODULO_AUTH,
                auditoria.ACCION_API_KEY_DENEGADO,
                usuario_id=tenant.usuario_id,
                ip=api_key.ip_confiable(request),
                detalle=f"{request.url.path} credenciales_pjud (pjud_deshabilitado) key={fila.prefijo}",
            )
        sellador = Sellador(
            pjud_habilitado=pjud_habilitado,
            api_key_id=fila.id,
            prefijo=fila.prefijo,
            guid=tenant.guid,
            usuario_id=tenant.usuario_id,
            ip=api_key.ip_confiable(request),
            ruta=request.url.path,
            llave_publica_pem=fila.llave_publica_pem,
        )
    finally:
        db.close()

    # Lo sellado no tiene por qué quedar en el caché de nadie.
    response.headers["Cache-Control"] = "no-store"
    return sellador
