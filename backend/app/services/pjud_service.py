"""Cliente de la API externa api-pjud.codifica.cl.

Trae el detalle procesal de una causa **Civil** directamente desde el PJUD, en
vivo, a pedido de la pantalla de la causa. No tiene nada que ver con
`movimiento.py` / `MovimientoRepository`: aquello viene de los Excel que manda
el estudio; esto se consulta por API cuando el usuario lo pide.

Solo Civil porque es lo único que la API expone hoy (`/consultar_civil`,
`/consultar_movimientos_civil`, catálogo `competencia=civil`). Si la causa es
de otra materia, se rechaza antes de llamar a nada.

El "Rol" de una causa Civil viene en el Excel como `C-10825-2026`
(tipo-rol-año) y el tribunal como su nombre completo
("23° Juzgado Civil de Santiago"); la API en cambio pide IDs numéricos de un
catálogo (`/catalogo/tribunales`), así que hay que resolver el nombre contra
ese catálogo antes de poder pedir nada.

**El scrape del proveedor es asíncrono.** La primera vez que se pide una causa,
`/consultar_civil` responde 404 (nunca vista) o `estado="Sincronizando"` sin
cuadernos, y hay que llamar antes a `/sincronizar_civil` —que solo encola un
job de Playwright y responde al instante— y esperar unos minutos. Por eso
`obtener_detalle` distingue "sincronizando" de "error": lo primero se devuelve
como un estado normal para que la pantalla muestre "Reintentar", no un 502.
"""

import logging
import re
import threading
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

# Formato medido sobre la cartera real (ver ARCHITECTURE.md, cruce de
# reportes): tipo de 1 a 4 letras, rol numérico, año de 4 dígitos.
_RE_ROL_CIVIL = re.compile(r"^\s*([A-Za-zÑñ]{1,4})-(\d+)-(\d{4})\s*$")

# El catálogo de tribunales cambia poquísimo (juzgados no se crean todos los
# días); cachearlo evita pedirlo en cada clic de "ver detalle".
_CATALOGO_TTL_SEGUNDOS = 6 * 3600

# Lo que devuelve `/consultar_civil` mientras el worker del proveedor todavía
# está scrapeando la causa.
_ESTADOS_SINCRONIZANDO = {"sincronizando", "pendiente", "en proceso", "encolada"}

_MENSAJE_SINCRONIZANDO = (
    "El Poder Judicial está sincronizando esta causa. La primera consulta "
    "puede tardar varios minutos; vuelve a intentar en un rato."
)

_MENSAJE_SIN_CREDENCIALES = (
    "Para consultar esta causa por primera vez hay que iniciar sesión en el "
    "Poder Judicial con tu clave. Configúrala en Mi Perfil → Clave del Poder "
    "Judicial."
)


class PjudApiError(Exception):
    """Cualquier motivo por el que no se pudo traer el detalle de una causa.

    El mensaje va en español y pensado para mostrarse tal cual en la pantalla:
    credenciales, causa que no calza con Civil, tribunal que no está en el
    catálogo, o la API misma respondiendo un error.
    """


class PjudNoEncontrado(PjudApiError):
    """La API respondió 404: la causa no está (todavía) en su base.

    No es necesariamente un error: la primera vez que se pide una causa hay que
    encolar el scrape con `/sincronizar_civil` y volver a consultar más tarde.
    """


class PjudConflicto(PjudApiError):
    """La API respondió 409: ya hay una sincronización en curso para esa causa,
    o se pidió otra antes del intervalo mínimo. No es un error para el usuario:
    significa "espera"."""


def _normalizar(texto: str) -> str:
    """Para comparar nombres de tribunal sin que un acento o un espacio de
    más (o un "°" vs "º") haga fallar un calce que a simple vista es el mismo
    tribunal."""
    texto = texto.strip().lower()
    reemplazos = {
        "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ñ": "n",
        "°": "", "º": "", ".": "", "  ": " ",
    }
    for viejo, nuevo in reemplazos.items():
        texto = texto.replace(viejo, nuevo)
    return " ".join(texto.split())


class PjudService:
    """Un login y un catálogo compartidos por todo el proceso.

    La credencial es de la plataforma (una sola cuenta en api-pjud.codifica.cl
    para todo Estado Diario), así que el token y el catálogo se cachean a
    nivel de módulo y no por request: pedir un login nuevo por cada clic de un
    usuario sería maltratar una API que no es nuestra.
    """

    # Reentrante a propósito: `_obtener_catalogo_civil` toma el lock y por
    # dentro `_request` llama a `_obtener_token`, que lo vuelve a tomar. Con un
    # Lock normal eso es un deadlock y la consulta se cuelga hasta que el proxy
    # la corta con un 502.
    _lock = threading.RLock()
    _token: Optional[str] = None
    _token_expira: float = 0.0
    _catalogo_civil: Optional[list[dict]] = None
    _catalogo_obtenido_en: float = 0.0

    def __init__(self) -> None:
        if not settings.pjud_api_activo:
            raise PjudApiError(
                "La consulta de detalle PJUD no está configurada "
                "(faltan las credenciales de api-pjud.codifica.cl)."
            )
        self._base_url = settings.PJUD_API_BASE_URL.rstrip("/")

    # ── HTTP ──────────────────────────────────────────────────

    def _headers(self, con_token: bool = True) -> dict:
        headers = {}
        if settings.PJUD_API_CLIENT_KEY:
            headers["x-client-key"] = settings.PJUD_API_CLIENT_KEY
        if con_token:
            headers["Authorization"] = f"Bearer {self._obtener_token()}"
        return headers

    def _request(self, metodo: str, ruta: str, con_token: bool = True, **kwargs) -> dict:
        try:
            respuesta = requests.request(
                metodo,
                f"{self._base_url}{ruta}",
                headers=self._headers(con_token=con_token),
                timeout=settings.PJUD_API_TIMEOUT_SEGUNDOS,
                **kwargs,
            )
        except requests.exceptions.Timeout as e:
            raise PjudApiError("El servicio de detalle PJUD no respondió a tiempo.") from e
        except requests.exceptions.RequestException as e:
            raise PjudApiError("No se pudo conectar con el servicio de detalle PJUD.") from e

        if respuesta.status_code == 401:
            # El token pudo vencer entre que se cacheó y este request; un
            # reintento solo tras invalidar la caché evita quedar en loop si
            # las credenciales simplemente están mal.
            raise PjudApiError(
                "El servicio de detalle PJUD rechazó las credenciales configuradas."
            )
        if respuesta.status_code == 404:
            raise PjudNoEncontrado("El PJUD todavía no tiene registrada esta causa.")
        if respuesta.status_code == 409:
            raise PjudConflicto("El PJUD ya está sincronizando esta causa.")
        if respuesta.status_code >= 400:
            # El proveedor manda `{"mensaje": "Error en campo [rut]"}` en los
            # 400/422. Se propaga ese texto tal cual: es lo que dice qué campo
            # rechazó, y sin él el error queda como un genérico inútil.
            detalle_proveedor = self._mensaje_error(respuesta)
            logger.warning(
                "PJUD API %s %s -> HTTP %s: %s",
                metodo, ruta, respuesta.status_code, respuesta.text[:500],
            )
            raise PjudApiError(
                f"api-pjud respondió HTTP {respuesta.status_code}"
                + (f": {detalle_proveedor}" if detalle_proveedor else "")
            )

        try:
            return respuesta.json()
        except ValueError as e:
            raise PjudApiError("El servicio de detalle PJUD devolvió una respuesta ilegible.") from e

    @staticmethod
    def _mensaje_error(respuesta) -> Optional[str]:
        """El `mensaje` del cuerpo de error del proveedor, si trae uno."""
        try:
            cuerpo = respuesta.json()
        except ValueError:
            return (respuesta.text or "").strip()[:200] or None
        if isinstance(cuerpo, dict):
            return cuerpo.get("mensaje") or cuerpo.get("detail") or None
        return None

    # ── Login (cacheado a nivel de proceso) ─────────────────────

    def _obtener_token(self) -> str:
        with self._lock:
            if PjudService._token and time.monotonic() < PjudService._token_expira:
                return PjudService._token

            data = self._request(
                "POST", "/auth/login", con_token=False,
                json={"email": settings.PJUD_API_EMAIL, "password": settings.PJUD_API_PASSWORD},
            )
            token = data.get("token")
            if not token:
                raise PjudApiError("El login contra el PJUD no devolvió un token.")

            PjudService._token = token
            # `expira_en` es informativo del proveedor; se resta un margen y,
            # si no se puede interpretar, se cachea igual un rato corto en vez
            # de repetir el login en cada llamada de la misma pantalla.
            PjudService._token_expira = time.monotonic() + self._segundos_hasta_vencer(
                data.get("expira_en")
            )
            return token

    @staticmethod
    def _segundos_hasta_vencer(expira_en: Optional[str]) -> float:
        margen = 30.0
        if expira_en:
            try:
                venc = datetime.fromisoformat(expira_en.replace("Z", "+00:00"))
                if venc.tzinfo is None:
                    venc = venc.replace(tzinfo=timezone.utc)
                restante = (venc - datetime.now(timezone.utc)).total_seconds() - margen
                if restante > 0:
                    return restante
            except ValueError:
                pass
        return 300.0

    # ── Catálogo de tribunales civiles ──────────────────────────

    def _obtener_catalogo_civil(self) -> list[dict]:
        with self._lock:
            vigente = (
                PjudService._catalogo_civil is not None
                and time.monotonic() - PjudService._catalogo_obtenido_en < _CATALOGO_TTL_SEGUNDOS
            )
            if not vigente:
                data = self._request(
                    "GET", "/catalogo/tribunales", params={"competencia": "civil"},
                )
                PjudService._catalogo_civil = data.get("cortes", [])
                PjudService._catalogo_obtenido_en = time.monotonic()
            return PjudService._catalogo_civil or []

    def resolver_tribunal(self, nombre_tribunal: str) -> tuple[int, int]:
        """`(corte_id, tribunal_id)` del catálogo que calza con ese nombre."""
        objetivo = _normalizar(nombre_tribunal)
        for corte in self._obtener_catalogo_civil():
            for tribunal in corte.get("tribunales", []):
                if _normalizar(tribunal["nombre"]) == objetivo:
                    return corte["id"], tribunal["id"]
        raise PjudApiError(
            f"El tribunal «{nombre_tribunal}» no está en el catálogo civil del PJUD."
        )

    # ── Rol Civil (`C-10825-2026`) ───────────────────────────────

    @staticmethod
    def parsear_rol_civil(rol: Optional[str]) -> tuple[str, int, int]:
        """`(tipo, rol, año)` a partir del Rol tal como lo trae el Excel."""
        match = _RE_ROL_CIVIL.match(rol or "")
        if not match:
            raise PjudApiError(
                f"El rol «{rol}» no tiene el formato de una causa Civil (tipo-rol-año)."
            )
        tipo, numero, anio = match.groups()
        return tipo.upper(), int(numero), int(anio)

    # ── Flujo completo ───────────────────────────────────────────

    def _sincronizar(self, cuerpo_causa: dict, credenciales: dict) -> str:
        """Encola el scrape en el proveedor. `/sincronizar_civil` INICIA SESIÓN
        en el OJV como la persona, así que el cuerpo lleva además su rut, clave
        y método de login (1 = Clave del Poder Judicial, 2 = ClaveÚnica).

        Best-effort: un 409 (ya en curso) o cualquier otra falla acá no corta la
        pantalla. Devuelve una nota corta de qué pasó, para el log de
        diagnóstico (no se le muestra al usuario)."""
        cuerpo = {
            **cuerpo_causa,
            "rut": credenciales["rut"],
            "clave": credenciales["clave"],
            "metodo_login": credenciales.get("metodo_login") or 1,
        }
        try:
            self._request("POST", "/sincronizar_civil", json=cuerpo)
            return "sincronizar_civil: 200 (encolado)"
        except PjudConflicto:
            # Ya hay un job en curso, o se pidió otro antes del intervalo mínimo
            # del proveedor (30 min). Si esto se repite en cada intento y la
            # causa nunca queda lista, el job del proveedor está pegado o falló.
            return "sincronizar_civil: 409 (ya en curso / muy pronto)"
        except PjudApiError as e:
            logger.warning("PJUD: sincronizar_civil falló, se sigue igual: %s", e)
            return f"sincronizar_civil: error ({e})"

    def obtener_detalle(
        self,
        causa,
        forzar_sincronizacion: bool = False,
        cuaderno_id: Optional[int] = None,
        credenciales_pjud: Optional[dict] = None,
    ) -> dict:
        """Detalle completo de una `Causa` (materia Civil) desde el PJUD.

        Devuelve siempre un dict con `estado`:
          - `"sin_credenciales"`: hay que sincronizar la causa (nunca vista, o
            todavía en proceso) pero la persona no cargó su clave del OJV. La
            pantalla la manda a Mi Perfil.
          - `"sincronizando"`: el proveedor está scrapeando la causa. `causa`
            viene en `None`. La pantalla muestra el aviso y "Reintentar".
          - `"listo"`: `causa` y las cinco secciones están pobladas.

        `credenciales_pjud`: `{"rut", "clave", "metodo_login"}` de la persona;
        sin ellas no se puede llamar a `/sincronizar_civil`.

        `forzar_sincronizacion` pide un scrape nuevo antes de consultar (botón
        "Actualizar desde el PJUD").

        `cuaderno_id` elige qué cuaderno traer en Historia/Notificaciones; por
        defecto, el primero.
        """
        if (causa.materia or "").strip().lower() != "civil":
            raise PjudApiError("El detalle PJUD solo está disponible para causas Civiles.")

        tipo, rol, anio = self.parsear_rol_civil(causa.rol)
        corte_id, tribunal_id = self.resolver_tribunal(causa.tribunal or "")
        cuerpo_causa = {
            "corte": corte_id, "tribunal": tribunal_id,
            "tipo": tipo, "rol": rol, "anio": anio,
        }

        puede_sincronizar = bool(
            credenciales_pjud
            and credenciales_pjud.get("rut")
            and credenciales_pjud.get("clave")
        )

        # Notas técnicas de cada paso, para el log de la consola. No se le
        # muestran al usuario; sirven para responder "¿y por qué sigue
        # sincronizando?" sin tener que abrir los logs del servidor de api-pjud.
        diag: list[str] = [f"corte={corte_id} tribunal={tribunal_id} tipo={tipo} rol={rol} anio={anio}"]
        if not puede_sincronizar:
            diag.append("sin clave del OJV cargada")

        if forzar_sincronizacion and puede_sincronizar:
            diag.append("forzar=" + self._sincronizar(cuerpo_causa, credenciales_pjud))

        try:
            detalle = self._request("POST", "/consultar_civil", json=cuerpo_causa)["causa"]
            estado_raw = detalle.get("estado")
            diag.append(
                f"consultar_civil: 200 estado={estado_raw!r} "
                f"últ.sync={detalle.get('fecha_ultima_sincronizacion')!r} "
                f"cuadernos={len(detalle.get('cuadernos') or [])}"
            )
        except PjudNoEncontrado:
            detalle = None
            # 404 = api-pjud NUNCA creó esta causa. Si tras varios `/sincronizar`
            # sigue en 404, su worker no está tomando el job (caído, o falla el
            # login al OJV y se rinde). Revisar worker.log en el servidor de
            # api-pjud.
            diag.append("consultar_civil: 404 (api-pjud no tiene la causa)")

        no_lista = (
            detalle is None
            or (detalle.get("estado") or "").strip().lower() in _ESTADOS_SINCRONIZANDO
            or not (detalle.get("cuadernos") or [])
        )
        if no_lista:
            if not puede_sincronizar:
                return {
                    "estado": "sin_credenciales",
                    "mensaje": _MENSAJE_SIN_CREDENCIALES,
                    "diagnostico": " · ".join(diag),
                }
            # `forzar` ya disparó el sync arriba; sin `forzar` se dispara acá.
            if not forzar_sincronizacion:
                diag.append(self._sincronizar(cuerpo_causa, credenciales_pjud))
            return {
                "estado": "sincronizando",
                "mensaje": _MENSAJE_SINCRONIZANDO,
                "diagnostico": " · ".join(diag),
            }

        cuadernos = detalle.get("cuadernos") or []
        cuaderno = self._elegir_cuaderno(cuadernos, cuaderno_id)

        movimientos = self._request(
            "POST", "/consultar_movimientos_civil",
            json={"identificador": detalle["identificador"], "cuadeno": cuaderno["id"]},
        )

        historia = movimientos.get("historia") or []
        self._normalizar_documentos(historia, detalle["identificador"], cuaderno["id"])
        diag.append(
            f"movimientos: cuaderno {cuaderno['id']}, {len(historia)} trámites"
        )

        return {
            "estado": "listo",
            "diagnostico": " · ".join(diag),
            "causa": detalle,
            "cuaderno_consultado_id": cuaderno["id"],
            "historia": historia,
            "litigantes": movimientos.get("litigantes") or [],
            "notificaciones": movimientos.get("notificaciones") or [],
            "escritos_resolver": movimientos.get("escritos_resolver") or [],
            "exhortos": movimientos.get("exhortos") or [],
        }

    @staticmethod
    def _elegir_cuaderno(cuadernos: list[dict], cuaderno_id: Optional[int]) -> dict:
        if cuaderno_id is not None:
            for c in cuadernos:
                if c.get("id") == cuaderno_id:
                    return c
        return cuadernos[0]

    def _normalizar_documentos(
        self, historia: list[dict], identificador: str, cuaderno_id: int
    ) -> None:
        """Deja en cada trámite un `documentos_url` usable (lista, 0-2 ítems).

        El proveedor hoy entrega `doc` como una lista `[{"doc": ...}]` —un
        trámite puede tener 0, 1 o 2 documentos—, con cada `doc` como URL
        absoluta (`https://api-pjud.codifica.cl/public/<rol>/<cuaderno>/<archivo>.pdf`).
        Versiones anteriores lo mandaban como un solo string, o como solo el
        nombre de archivo. Se cubren los tres casos, y lo mismo para los anexos
        del trámite."""
        for item in historia:
            crudos = self._docs_de_tramite(item.pop("doc", None))
            item["documentos_url"] = [
                url
                for crudo in crudos
                if (url := self._url_documento(crudo, identificador, cuaderno_id))
            ]
            for anexo in item.get("anexo") or []:
                anexo["doc"] = self._url_documento(
                    anexo.get("doc"), identificador, cuaderno_id
                )

    @staticmethod
    def _docs_de_tramite(doc) -> list[str]:
        """Normaliza el `doc` de un trámite a una lista de strings crudos.

        Acepta la forma nueva (`[{"doc": "..."}]`), una lista de strings, o un
        único string (formas viejas). `None`/vacío → lista vacía."""
        if not doc:
            return []
        if isinstance(doc, str):
            return [doc]
        crudos: list[str] = []
        for entrada in doc:
            if isinstance(entrada, str) and entrada:
                crudos.append(entrada)
            elif isinstance(entrada, dict) and entrada.get("doc"):
                crudos.append(entrada["doc"])
        return crudos

    def _url_documento(
        self, doc: Optional[str], identificador: str, cuaderno_id: int
    ) -> Optional[str]:
        if not doc:
            return None
        if doc.startswith(("http://", "https://")):
            return doc
        return (
            f"{self._base_url}/public/{quote(identificador, safe='')}/"
            f"{cuaderno_id}/{quote(doc, safe='')}"
        )
