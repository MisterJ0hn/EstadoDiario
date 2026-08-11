"""Facturación de la plataforma.

Cuánto se le cobra a cada cliente por su cartera de causas. La regla y el
cierre mensual están en `app.services.facturacion_service`; acá solo se
exponen.

El cierre lo toma el job del día 1 (`app.jobs.cerrar_facturacion`). El endpoint
de cierre existe para **repetir el que falló**: si una base estaba caída, ese
cliente queda en `error` y hay que rehacerlo el mismo día. No es la vía normal
y por eso no está en el menú, sino detrás de un botón de la pantalla del
período abierto.
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.models.maestra.factura import Factura
from app.models.maestra.usuario_admin import UsuarioAdmin
from app.repositories.cliente_repository import ClienteRepository
from app.services.factura_service import FacturaService

from admin_api.app.deps import require_admin
from admin_api.app.schemas.cliente import (
    AnularFacturaRequest,
    CerrarPeriodoRequest,
    EmitirFacturaRequest,
    FacturacionCierreResponse,
    FacturacionPeriodoResponse,
    FacturaLineaResponse,
    FacturaListResponse,
    FacturaResponse,
)
from admin_api.app.services.facturacion_consulta_service import (
    FacturacionConsultaService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/facturacion",
    tags=["Facturación"],
    dependencies=[Depends(require_admin)],
)


@router.get(
    "",
    response_model=FacturacionPeriodoResponse,
    summary="Facturación de un período",
)
def obtener_periodo(
    periodo: date | None = Query(
        None, description="Cualquier día del mes a consultar. Por defecto, el último cerrado."
    ),
    db: Session = Depends(get_db_maestra),
):
    """Devuelve el detalle por cliente y los totales del período.

    Un período **sin cerrar** se responde igual, contando la cartera al
    momento y con `es_estimacion` en true: es la pregunta que se hace el 20 del
    mes —cuánto va a salir la factura— y responder "no hay datos" haría parecer
    que el módulo no funciona.
    """
    return FacturacionConsultaService(db).periodo(periodo)


@router.get(
    "/clientes/{cliente_id}",
    response_model=list[FacturacionCierreResponse],
    summary="Historial de facturación de un cliente",
    responses={404: {"description": "Cliente no encontrado"}},
)
def historial_cliente(cliente_id: int, db: Session = Depends(get_db_maestra)):
    """Todos los períodos cerrados de un cliente, del más nuevo al más viejo."""
    return FacturacionConsultaService(db).detalle_cliente(cliente_id)


@router.post(
    "/cerrar",
    response_model=FacturacionPeriodoResponse,
    summary="Cerrar un período a mano",
)
def cerrar_periodo(
    datos: CerrarPeriodoRequest | None = None,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Congela el período indicado (por defecto, el mes anterior).

    Es **idempotente**: los clientes que ya tienen cierre de ese período se
    saltan, salvo que se pida `rehacer`. Rehacer solo tiene sentido el mismo
    día del cierre: después, el archivo de causas del cliente ya es otro y el
    recuento no daría lo que se facturó.
    """
    datos = datos or CerrarPeriodoRequest()
    logger.info(
        "Cierre de facturación %s disparado por el administrador %s",
        datos.periodo or "(mes anterior)",
        admin.usuario,
    )
    return FacturacionConsultaService(db).cerrar(datos.periodo, datos.rehacer)


# ── Órdenes de compra ─────────────────────────────────────
# El documento que se le entrega al cliente. Cubre un rango de fechas y suma
# los cierres mensuales que caen dentro: no recalcula nada, así que emitir dos
# veces el mismo rango da el mismo total.


def _a_response(factura: Factura, cliente_nombre: str) -> FacturaResponse:
    return FacturaResponse(
        id=factura.id,
        numero=factura.numero_formateado,
        cliente_id=factura.cliente_id,
        cliente_nombre=cliente_nombre,
        razon_social=factura.razon_social,
        rut=factura.rut,
        giro=factura.giro,
        direccion=factura.direccion,
        comuna=factura.comuna,
        ciudad=factura.ciudad,
        correo=factura.correo,
        fecha_desde=factura.fecha_desde,
        fecha_hasta=factura.fecha_hasta,
        fecha_emision=factura.fecha_emision,
        total=float(factura.total or 0),
        emitida_por=factura.emitida_por,
        anulada=bool(factura.anulada),
        motivo_anulacion=factura.motivo_anulacion,
        lineas=[
            FacturaLineaResponse(
                periodo=l.periodo,
                causas_materia=l.causas_materia or 0,
                cortes_apelaciones=l.cortes_apelaciones or 0,
                cortes_suprema=l.cortes_suprema or 0,
                tarifa_materia=l.tarifa_materia,
                tarifa_apelaciones=l.tarifa_apelaciones,
                tarifa_suprema=l.tarifa_suprema,
                subtotal=float(l.subtotal or 0),
            )
            for l in factura.lineas
        ],
    )


@router.post(
    "/facturas",
    response_model=FacturaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Emitir una orden de compra",
    responses={
        400: {"description": "Rango inválido o con meses sin cierre"},
        404: {"description": "Cliente no encontrado"},
    },
)
def emitir_factura(
    datos: EmitirFacturaRequest,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Emite el documento y **guarda el PDF** que se entregó.

    Se rechaza con 400 si algún mes del rango no tiene cierre: una orden de
    compra solo suma montos ya congelados, y mezclar meses cerrados con meses
    contados al momento daría un documento que cambia solo.
    """
    factura = FacturaService(db).emitir(
        datos.cliente_id, datos.fecha_desde, datos.fecha_hasta, admin.usuario
    )
    cliente = ClienteRepository(db).find_by_id(factura.cliente_id)
    return _a_response(factura, cliente.nombre if cliente else factura.razon_social)


@router.get(
    "/facturas",
    response_model=FacturaListResponse,
    summary="Órdenes de compra emitidas",
)
def listar_facturas(
    cliente_id: int | None = Query(None),
    desde: date | None = Query(None, description="Acota por el RANGO facturado"),
    hasta: date | None = Query(None),
    db: Session = Depends(get_db_maestra),
):
    """De la más nueva a la más vieja. El filtro de fechas va contra el rango
    facturado y no contra la emisión: se busca "la orden de marzo", no "la que
    se emitió en abril"."""
    facturas = FacturaService(db).listar(cliente_id, desde, hasta)
    # Los clientes se leen de una vez: un find_by_id por fila serían tantas
    # consultas como órdenes solo para pegar el nombre actual.
    nombres = {c.cliente_id: c.nombre for c in ClienteRepository(db).find_all()}
    filas = [
        _a_response(f, nombres.get(f.cliente_id, f.razon_social)) for f in facturas
    ]
    return FacturaListResponse(
        total=len(filas),
        # Las anuladas no suman: el total del listado tiene que ser lo cobrable.
        total_monto=sum(f.total for f in filas if not f.anulada),
        facturas=filas,
    )


@router.get(
    "/facturas/{factura_id}/pdf",
    summary="Descargar el PDF de una orden de compra",
    responses={
        200: {"content": {"application/pdf": {}}},
        404: {"description": "Orden no encontrada o sin PDF guardado"},
    },
)
def descargar_pdf(factura_id: int, db: Session = Depends(get_db_maestra)):
    """Devuelve el PDF **guardado al emitir**, no uno nuevo.

    Sale con la edición y la copia bloqueadas por los permisos del formato. Eso
    disuade pero no impide —los permisos de PDF los ignora cualquier
    herramienta libre—; la garantía real es que esta copia es la de referencia
    y cualquier archivo alterado se contrasta con ella.
    """
    contenido, nombre = FacturaService(db).pdf(factura_id)
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


@router.post(
    "/facturas/{factura_id}/anular",
    response_model=FacturaResponse,
    summary="Anular una orden de compra",
    responses={404: {"description": "Orden no encontrada"}},
)
def anular_factura(
    factura_id: int,
    datos: AnularFacturaRequest,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Marca la orden como anulada con su motivo. **No la borra ni libera el
    número**: un correlativo con huecos no se puede auditar, y el PDF que el
    cliente recibió existe aunque se haya anulado."""
    factura = FacturaService(db).anular(factura_id, datos.motivo)
    logger.info(
        "Orden %s anulada por el administrador %s", factura.numero_formateado, admin.usuario
    )
    cliente = ClienteRepository(db).find_by_id(factura.cliente_id)
    return _a_response(factura, cliente.nombre if cliente else factura.razon_social)
