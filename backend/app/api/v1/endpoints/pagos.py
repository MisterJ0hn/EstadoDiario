"""Pago de las facturas del propio estudio con Webpay Plus.

**Dos endpoints con reglas de acceso opuestas y eso es a propósito:**

- `POST /pagos/webpay/{factura_id}` exige sesión. El `cliente_id` sale del
  token, así que un estudio no puede ni nombrar la factura de otro.
- `POST /pagos/webpay/retorno` es **público**. No puede no serlo: lo llama el
  navegador del usuario volviendo desde el formulario de Transbank, y esa
  navegación no lleva el `Authorization` que pone el interceptor de la app. Es
  el mismo caso del webhook de Twilio que ya existe en `estado_diario`.

  Que sea público no lo hace inseguro: no acepta ningún identificador de
  factura ni de cliente. Lo único que recibe es el token que emitió Transbank,
  y de él salen el intento, la factura y el cliente. Un token que no está en la
  base no confirma nada.

**Por qué el retorno redirige en vez de responder JSON.** Quien llega acá es un
navegador que viene de otro sitio, no la aplicación Angular haciendo `fetch`.
Si esto devolviera JSON, el usuario terminaría mirando un objeto en pantalla.
Se confirma, se escribe el resultado y se lo manda de vuelta a la pantalla de
facturas con el desenlace en la URL.
"""

import logging
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db_maestra
from app.core.deps import TenantContexto, get_tenant_actual
from app.schemas.pago import PagoDisponibleResponse, PagoIniciadoResponse
from app.services.pago_service import PagoService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagos", tags=["Pagos"])

# Dónde vuelve el navegador después de pagar. Es una ruta de la SPA, no de la
# API: en el despliegue web las dos cuelgan del mismo host (el nginx de la app
# proxea `/api/`), así que `PUBLIC_BASE_URL` sirve para las dos.
RUTA_FACTURAS = "/facturas"


# La misma ruta que expone este módulo, con el prefijo del router de la API.
# Escrita completa porque es lo que se le declara a Transbank: tiene que ser la
# URL pública, no la interna.
RUTA_RETORNO = "/api/v1/pagos/webpay/retorno"


def _url_retorno() -> str:
    """El `return_url` que se le declara a Transbank.

    Se arma con `PUBLIC_BASE_URL` y no con el host de la request: detrás de
    nginx la request llega como `http://backend:8000`, y Transbank tiene que
    poder alcanzar esta URL desde el navegador del usuario, no desde la red
    interna de Docker.
    """
    base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    if not base:
        # Sin esto no hay forma de volver: mejor decirlo con todas sus letras
        # que dejar que Transbank rechace un return_url vacío.
        logger.error("PUBLIC_BASE_URL está vacío: Webpay no podrá devolver el pago")
    return f"{base}{RUTA_RETORNO}"


@router.get(
    "/disponible",
    response_model=PagoDisponibleResponse,
    summary="Si el pago en línea está habilitado",
)
def pago_disponible(
    db: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
):
    """Lo consulta la pantalla de facturas para mostrar o no el botón."""
    return PagoDisponibleResponse(habilitado=PagoService(db).esta_habilitado())


# ── El orden de estas rutas importa ───────────────────────
#
# `/webpay/retorno` va ANTES que `/webpay/{factura_id}`. FastAPI resuelve por
# orden de declaración, así que al revés el POST de Transbank entra por la ruta
# con parámetro —con `factura_id = "retorno"`—, que exige sesión y responde 403.
# El navegador que vuelve de Webpay no lleva el Bearer, así que el pago se
# cobraría y nunca se confirmaría: la transacción se reversa a los 10 minutos y
# la factura queda impaga sin ningún error en el log que lo explique.


@router.post(
    "/webpay/retorno",
    summary="Retorno de Webpay (público, lo llama el navegador)",
    response_class=RedirectResponse,
    include_in_schema=False,
)
async def retorno_webpay(
    db: Session = Depends(get_db_maestra),
    token_ws: Optional[str] = Form(default=None),
    TBK_TOKEN: Optional[str] = Form(default=None),
    TBK_ORDEN_COMPRA: Optional[str] = Form(default=None),
    TBK_ID_SESION: Optional[str] = Form(default=None),
):
    """Confirma el pago y devuelve al usuario a la pantalla de facturas.

    Los nombres de los campos van en mayúsculas porque así los manda Transbank;
    renombrarlos rompería el retorno y el error solo se vería en producción.

    Sin sesión: quien llega es el navegador volviendo desde Webpay.
    """
    return _redirigir(
        PagoService(db).confirmar_retorno(
            token_ws=token_ws,
            tbk_token=TBK_TOKEN,
            tbk_orden_compra=TBK_ORDEN_COMPRA,
        )
    )


@router.get(
    "/webpay/retorno",
    summary="Retorno de Webpay por GET (mismo tratamiento)",
    response_class=RedirectResponse,
    include_in_schema=False,
)
def retorno_webpay_get(
    db: Session = Depends(get_db_maestra),
    token_ws: Optional[str] = None,
    TBK_TOKEN: Optional[str] = None,
    TBK_ORDEN_COMPRA: Optional[str] = None,
    TBK_ID_SESION: Optional[str] = None,
):
    """El mismo retorno, por si llega como GET.

    Webpay usa POST, pero un usuario que aprieta "atrás" o un navegador que
    reintenta pueden llegar por GET. Sin esta variante eso sería un 405 en
    pantalla en vez de la página de facturas.
    """
    return _redirigir(
        PagoService(db).confirmar_retorno(
            token_ws=token_ws,
            tbk_token=TBK_TOKEN,
            tbk_orden_compra=TBK_ORDEN_COMPRA,
        )
    )


@router.post(
    "/webpay/{factura_id}",
    response_model=PagoIniciadoResponse,
    summary="Iniciar el pago de una factura propia",
    responses={
        400: {"description": "La factura no se puede pagar o el pago está apagado"},
        404: {"description": "No existe o no es de este estudio"},
        502: {"description": "Transbank no respondió"},
    },
)
def iniciar_pago(
    factura_id: int,
    db: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
):
    """Crea la transacción y devuelve a dónde mandar al usuario.

    No marca nada como pagado: eso ocurre recién al confirmar, cuando el
    usuario vuelve. Ver `PagoService`.

    Va declarada al final por lo que explica el comentario de más arriba: esta
    ruta tiene un parámetro y se comería `/webpay/retorno`.
    """
    return PagoIniciadoResponse(
        **PagoService(db).iniciar(
            factura_id=factura_id,
            cliente_id=tenant.cliente_id,
            usuario_id=tenant.usuario_id,
            return_url=_url_retorno(),
        )
    )


def _redirigir(resultado) -> RedirectResponse:
    """Manda el navegador a la pantalla de facturas con el desenlace en la URL.

    303 y no 302: convierte el POST de Transbank en un GET, que es lo que tiene
    que recibir la SPA. Con 302 algunos navegadores repiten el POST contra la
    ruta de destino.
    """
    parametros = {"pago": resultado.resultado, "mensaje": resultado.mensaje}
    if resultado.factura_numero:
        parametros["factura"] = resultado.factura_numero
    if resultado.reactivado:
        # La pantalla lo dice aparte: al estudio le importa más recuperar el
        # acceso que el detalle del pago.
        parametros["reactivado"] = "1"

    base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    return RedirectResponse(
        url=f"{base}{RUTA_FACTURAS}?{urlencode(parametros)}", status_code=303
    )
