"""Cliente de la API externa api-pjud.codifica.cl.

Trae el detalle procesal (movimientos) de una causa **Civil** directamente
desde el PJUD, en vivo, a pedido de la pantalla de la causa. No tiene nada que
ver con `movimiento.py` / `MovimientoRepository`: aquello viene de los Excel
que manda el estudio; esto se consulta por API cuando el usuario lo pide.

Solo Civil porque es lo único que la API expone hoy (`/consultar_civil`,
`/consultar_movimientos_civil`, catálogo `competencia=civil`). Si la causa es
de otra materia, se rechaza antes de llamar a nada.

El "Rol" de una causa Civil viene en el Excel como `C-10825-2026`
(tipo-rol-año) y el tribunal como su nombre completo
("23° Juzgado Civil de Santiago"); la API en cambio pide IDs numéricos de un
catálogo (`/catalogo/tribunales`), así que hay que resolver el nombre contra
ese catálogo antes de poder pedir nada.
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
# días); cachearlo evita pedirlo en cada clic de "ver movimientos".
_CATALOGO_TTL_SEGUNDOS = 6 * 3600


class PjudApiError(Exception):
    """Cualquier motivo por el que no se pudo traer el detalle de una causa.

    El mensaje va en español y pensado para mostrarse tal cual en la pantalla:
    credenciales, causa que no calza con Civil, tribunal que no está en el
    catálogo, o la API misma respondiendo un error.
    """


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

    _lock = threading.Lock()
    _token: Optional[str] = None
    _token_expira: float = 0.0
    _catalogo_civil: Optional[list[dict]] = None
    _catalogo_obtenido_en: float = 0.0

    def __init__(self) -> None:
        if not settings.pjud_api_activo:
            raise PjudApiError(
                "La consulta de movimientos PJUD no está configurada "
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
            raise PjudApiError("El servicio de movimientos PJUD no respondió a tiempo.") from e
        except requests.exceptions.RequestException as e:
            raise PjudApiError("No se pudo conectar con el servicio de movimientos PJUD.") from e

        if respuesta.status_code == 401:
            # El token pudo vencer entre que se cacheó y este request; un
            # reintento solo tras invalidar la caché evita quedar en loop si
            # las credenciales simplemente están mal.
            raise PjudApiError(
                "El servicio de movimientos PJUD rechazó las credenciales configuradas."
            )
        if respuesta.status_code == 404:
            raise PjudApiError("El PJUD no tiene registrada esa causa.")
        if respuesta.status_code == 422:
            raise PjudApiError("Los datos de la causa no calzan con lo que espera el PJUD.")
        if respuesta.status_code >= 400:
            logger.warning(
                "PJUD API %s %s -> HTTP %s: %s",
                metodo, ruta, respuesta.status_code, respuesta.text[:500],
            )
            raise PjudApiError("El servicio de movimientos PJUD respondió con un error.")

        try:
            return respuesta.json()
        except ValueError as e:
            raise PjudApiError("El servicio de movimientos PJUD devolvió una respuesta ilegible.") from e

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

    def obtener_movimientos(self, causa, forzar_sincronizacion: bool = False) -> dict:
        """Historial completo de una `Causa` (materia Civil) desde el PJUD.

        `forzar_sincronizacion` dispara `/sincronizar_civil` antes de
        consultar. Se ignora si falla: el PJUD puede tardar en reflejarlo, y
        preferimos devolver lo último que sí tiene consultado antes que
        cortar toda la pantalla por un timeout de la sincronización.
        """
        if (causa.materia or "").strip().lower() != "civil":
            raise PjudApiError("Los movimientos PJUD solo están disponibles para causas Civiles.")

        tipo, rol, anio = self.parsear_rol_civil(causa.rol)
        corte_id, tribunal_id = self.resolver_tribunal(causa.tribunal or "")
        cuerpo_causa = {"corte": corte_id, "tribunal": tribunal_id, "tipo": tipo, "rol": rol, "anio": anio}

        if forzar_sincronizacion:
            try:
                self._request("POST", "/sincronizar_civil", json=cuerpo_causa)
            except PjudApiError as e:
                logger.warning("PJUD: sincronizar_civil falló, se sigue con lo ya consultado: %s", e)

        detalle = self._request("POST", "/consultar_civil", json=cuerpo_causa)["causa"]

        cuadernos = detalle.get("cuadernos") or []
        if not cuadernos:
            raise PjudApiError("El PJUD no tiene cuadernos registrados para esta causa.")
        cuaderno_id = cuadernos[0]["id"]

        movimientos = self._request(
            "POST", "/consultar_movimientos_civil",
            json={"identificador": detalle["identificador"], "cuadeno": cuaderno_id},
        )

        self._agregar_urls_documentos(movimientos.get("historia") or [], detalle["identificador"], cuaderno_id)

        return {
            "causa": detalle,
            "cuadernos": cuadernos,
            "cuaderno_consultado_id": cuaderno_id,
            "historia": movimientos.get("historia") or [],
            "litigantes": movimientos.get("litigantes") or [],
            "notificaciones": movimientos.get("notificaciones") or [],
            "escritos_resolver": movimientos.get("escritos_resolver") or [],
            "exhortos": movimientos.get("exhortos") or [],
        }

    def _agregar_urls_documentos(self, historia: list[dict], identificador: str, cuaderno_id: int) -> None:
        """Arma la URL descargable de cada trámite que trae un documento
        adjunto, siguiendo `/public/{rol}/{cuaderno}/{archivo}` del schema.
        `doc` en `historia` es solo el nombre de archivo, no una URL."""
        for item in historia:
            nombre_doc = item.get("doc")
            if nombre_doc:
                item["documento_url"] = (
                    f"{self._base_url}/public/{quote(identificador, safe='')}/"
                    f"{cuaderno_id}/{quote(nombre_doc, safe='')}"
                )
