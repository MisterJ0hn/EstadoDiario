"""Cliente HTTP de Webpay Plus (Transbank), sobre `requests`.

**Por qué a mano y no con el SDK oficial.** La API REST de Webpay Plus son tres
llamadas —crear, confirmar, consultar— sobre un JSON plano y dos cabeceras. El
SDK agrega una dependencia con sus propias versiones de HTTP y ha cambiado de
forma entre versiones mayores; acá alcanza con `requests`, que ya es
dependencia del proyecto, y a cambio el timeout, los reintentos y el manejo de
errores quedan explícitos y bajo control.

**Este módulo no sabe nada de la base de datos.** Recibe credenciales y datos,
devuelve diccionarios. Todo lo que tenga que ver con facturas, pagos y clientes
vive en `app/services/pago_service.py`. Esa separación es lo que permite probar
el protocolo sin PostgreSQL.

**Las reglas de Webpay que están metidas acá y no se pueden mover**:

- El monto va **entero**. En pesos chilenos Webpay no acepta decimales y una
  factura de $10.500,00 tiene que salir como 10500.
- `buy_order` y `session_id` van acotados a 26 caracteres, que es el máximo que
  acepta Transbank. Pasarse no da un error legible: da un 422 genérico.
- La confirmación (`confirmar`) se puede hacer **una sola vez por token**. La
  segunda responde error, así que quien llame tiene que saber si ya confirmó
  (ver `PagoService.confirmar_retorno`).
- Una transacción creada y no confirmada **se reversa sola a los 10 minutos**.
  No hay que hacer nada para deshacerla; lo que no se puede es darla por buena.
"""

import logging
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

# Los dos ambientes de Webpay Plus. Integración es público y sirve para probar
# con las tarjetas de prueba de Transbank; producción cobra de verdad.
AMBIENTE_INTEGRACION = "integracion"
AMBIENTE_PRODUCCION = "produccion"

URLS_BASE = {
    AMBIENTE_INTEGRACION: "https://webpay3gint.transbank.cl",
    AMBIENTE_PRODUCCION: "https://webpay3g.transbank.cl",
}

# Credenciales públicas del comercio de prueba, documentadas por Transbank. Se
# usan solo cuando el ambiente es integración y no se cargó ninguna: así probar
# no obliga a ir a buscar nada, y en producción no hay ningún valor por defecto
# que pueda colarse (ver `credenciales_efectivas`).
INTEGRACION_COMMERCE_CODE = "597055555532"
INTEGRACION_API_KEY = (
    "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C"
)

_RUTA = "/rswebpaytransaction/api/webpay/v1.2/transactions"

# Un pago no puede quedar colgado esperando: el usuario está mirando la
# pantalla. 15 segundos es holgado para Transbank y corto para una persona.
TIMEOUT_SEGUNDOS = 15.0

# Largo máximo que acepta Transbank en los dos identificadores del comercio.
MAX_LARGO_ORDEN = 26

# Transacción aprobada. Los dos tienen que darse: `response_code` 0 es la
# autorización y `status` AUTHORIZED es el estado de la transacción. Mirar solo
# uno deja pasar casos raros (una autorizada que después se reversó).
RESPONSE_CODE_APROBADO = 0
STATUS_AUTORIZADA = "AUTHORIZED"


class ErrorTransbank(Exception):
    """Falló la conversación con Transbank.

    Se distingue del rechazo de una tarjeta: un rechazo es una respuesta válida
    con `response_code` distinto de 0, y esto es no haber podido preguntar.
    """

    def __init__(self, mensaje: str, status_code: Optional[int] = None):
        super().__init__(mensaje)
        self.status_code = status_code


def url_base(ambiente: str) -> str:
    """URL del ambiente. Un ambiente desconocido cae en integración a
    propósito: equivocarse hacia el lado que no cobra."""
    return URLS_BASE.get(ambiente, URLS_BASE[AMBIENTE_INTEGRACION])


def credenciales_efectivas(
    ambiente: str, commerce_code: Optional[str], api_key: Optional[str]
) -> tuple[str, str]:
    """Las credenciales a usar, con el comercio de prueba como respaldo.

    En **producción no hay respaldo**: sin credenciales cargadas se levanta el
    error en vez de intentar cobrar con el comercio de prueba de Transbank, que
    es lo que pasaría si el default fuera común a los dos ambientes.
    """
    if commerce_code and api_key:
        return commerce_code, api_key
    if ambiente == AMBIENTE_PRODUCCION:
        raise ErrorTransbank(
            "Faltan las credenciales de Transbank para producción. "
            "Cárguelas en Administración → Transbank."
        )
    return INTEGRACION_COMMERCE_CODE, INTEGRACION_API_KEY


def recortar(valor: str) -> str:
    """Deja el identificador dentro del máximo que acepta Transbank."""
    return (valor or "")[:MAX_LARGO_ORDEN]


def _cabeceras(commerce_code: str, api_key: str) -> dict[str, str]:
    return {
        "Tbk-Api-Key-Id": commerce_code,
        "Tbk-Api-Key-Secret": api_key,
        "Content-Type": "application/json",
    }


def _pedir(
    metodo: str,
    url: str,
    commerce_code: str,
    api_key: str,
    cuerpo: Optional[dict] = None,
) -> dict[str, Any]:
    """Una llamada a Transbank, con los errores ya traducidos.

    Los errores de red y los HTTP se levantan como `ErrorTransbank` con el
    texto que devolvió Transbank: su cuerpo de error trae el motivo real
    (`error_message`) y perderlo deja al operador con un 500 sin explicación.
    """
    try:
        respuesta = requests.request(
            metodo, url, headers=_cabeceras(commerce_code, api_key),
            json=cuerpo, timeout=TIMEOUT_SEGUNDOS,
        )
    except requests.RequestException as exc:
        raise ErrorTransbank(f"No se pudo contactar a Transbank: {exc}") from exc

    if respuesta.status_code >= 400:
        detalle = respuesta.text
        try:
            detalle = respuesta.json().get("error_message", detalle)
        except ValueError:
            pass
        raise ErrorTransbank(
            f"Transbank respondió {respuesta.status_code}: {detalle}",
            status_code=respuesta.status_code,
        )

    try:
        return respuesta.json()
    except ValueError as exc:
        raise ErrorTransbank(
            "Transbank devolvió una respuesta que no es JSON"
        ) from exc


def crear_transaccion(
    ambiente: str,
    commerce_code: Optional[str],
    api_key: Optional[str],
    buy_order: str,
    session_id: str,
    monto: int,
    return_url: str,
) -> dict[str, Any]:
    """Inicia una transacción. Devuelve `{token, url}`.

    Con esos dos datos el navegador tiene que hacer un **POST de formulario** a
    `url` con el campo `token_ws`: Webpay no acepta que se llegue por GET.
    """
    codigo, llave = credenciales_efectivas(ambiente, commerce_code, api_key)
    datos = _pedir(
        "POST",
        f"{url_base(ambiente)}{_RUTA}",
        codigo,
        llave,
        {
            "buy_order": recortar(buy_order),
            "session_id": recortar(session_id),
            # Entero: en CLP Webpay rechaza los decimales.
            "amount": int(monto),
            "return_url": return_url,
        },
    )
    if not datos.get("token") or not datos.get("url"):
        raise ErrorTransbank("Transbank no devolvió token o URL de pago")
    logger.info("Transacción Webpay creada: orden %s, monto %s", buy_order, monto)
    return datos


def confirmar(
    ambiente: str,
    commerce_code: Optional[str],
    api_key: Optional[str],
    token: str,
) -> dict[str, Any]:
    """Confirma (commit) la transacción del token. **Una sola vez.**

    Es el paso que efectivamente cobra: hasta que esto responde, el cargo está
    autorizado pero no capturado, y a los 10 minutos se reversa solo.
    """
    codigo, llave = credenciales_efectivas(ambiente, commerce_code, api_key)
    return _pedir("PUT", f"{url_base(ambiente)}{_RUTA}/{token}", codigo, llave)


def estado(
    ambiente: str,
    commerce_code: Optional[str],
    api_key: Optional[str],
    token: str,
) -> dict[str, Any]:
    """Consulta el estado sin confirmar nada.

    Es la salida cuando el commit se cortó por red y no se sabe si alcanzó a
    cobrarse: preguntar es seguro, reintentar el commit no.
    """
    codigo, llave = credenciales_efectivas(ambiente, commerce_code, api_key)
    return _pedir("GET", f"{url_base(ambiente)}{_RUTA}/{token}", codigo, llave)


def fue_aprobada(respuesta: dict[str, Any]) -> bool:
    """Si la respuesta de confirmación corresponde a un pago aprobado."""
    return (
        respuesta.get("response_code") == RESPONSE_CODE_APROBADO
        and respuesta.get("status") == STATUS_AUTORIZADA
    )
