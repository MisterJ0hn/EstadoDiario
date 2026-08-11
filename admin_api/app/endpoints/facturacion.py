"""Facturación de la plataforma.

Una factura por cliente y por mes. La regla y la generación están en
`app.services.facturacion_service`; la consulta, en `app.services.factura_service`.
Acá solo se exponen.

La generación la toma el job del día 1 (`app.jobs.generar_facturacion`). El
endpoint de generación existe para **repetir la que falló**: si la base de un
cliente estaba caída, ese cliente queda sin factura y hay que rehacerlo. No es
la vía normal y por eso no está en el menú, sino detrás de un botón de la
pantalla del período.
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.maestra.usuario_admin import UsuarioAdmin
from app.repositories.cliente_repository import ClienteRepository
from app.services.factura_service import FacturaService, FiltroFacturas
from app.services.tarifa_service import TarifaService

from admin_api.app.deps import require_admin
from admin_api.app.schemas.cliente import OperacionResponse
from admin_api.app.schemas.facturacion import (
    AnularFacturaRequest,
    EstimacionPeriodoResponse,
    FacturaListResponse,
    FacturaResponse,
    GenerarPeriodoRequest,
    GenerarPeriodoResponse,
    MarcarPagadaRequest,
    TarifaResponse,
    TarifasClienteResponse,
    TarifaUpsertRequest,
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


# ── Facturas ──────────────────────────────────────────────


@router.get(
    "/facturas",
    response_model=FacturaListResponse,
    summary="Listado de facturas",
    responses={400: {"description": "Rango de fechas inválido"}},
)
def listar_facturas(
    cliente_id: int | None = Query(None, description="Solo las de este cliente"),
    desde: date | None = Query(None, description="Acota por el PERÍODO facturado"),
    hasta: date | None = Query(None),
    rut: str | None = Query(
        None,
        description="RUT del cliente. Coincidencia EXACTA: el RUT está cifrado "
        "en la base y no admite búsqueda parcial. Los puntos y el guion se "
        "ignoran.",
    ),
    cliente_activo: bool | None = Query(
        None, description="true = solo clientes activos; false = solo inactivos"
    ),
    q: str | None = Query(
        None, description="Nombre del cliente o número de factura, en el mismo campo"
    ),
    estado: str | None = Query(None, description="emitida | pagada | anulada"),
    limite: int | None = Query(
        None, ge=1, le=500,
        description="Máximo de facturas, de la más nueva hacia atrás. La consola "
                    "manda 12 cuando se mira UN cliente.",
    ),
    db: Session = Depends(get_db_maestra),
):
    """De la más nueva a la más vieja, con el detalle de cada una.

    El filtro de fechas va contra el **período facturado** y no contra la fecha
    de generación: se busca "la factura de marzo", no "la que se generó en
    abril".
    """
    if desde and hasta and hasta < desde:
        raise BadRequestException("La fecha 'hasta' no puede ser anterior a 'desde'.")

    filtro = FiltroFacturas(
        cliente_id=cliente_id,
        desde=desde,
        hasta=hasta,
        rut=rut,
        cliente_activo=cliente_activo,
        busqueda=q,
        estado=estado,
        limite=limite,
    )
    return FacturacionConsultaService(db).listar(filtro)


@router.get(
    "/facturas/periodos",
    response_model=list[date],
    summary="Períodos que tienen facturas",
)
def listar_periodos(db: Session = Depends(get_db_maestra)):
    """Del más nuevo al más viejo. Alimenta el selector de período.

    Va antes de `/facturas/{factura_id}` en el archivo a propósito: FastAPI
    resuelve por orden de declaración y con la ruta dinámica primero, `periodos`
    entraría como id y respondería un 422.
    """
    return FacturacionConsultaService(db).periodos()


@router.get(
    "/facturas/{factura_id}",
    response_model=FacturaResponse,
    summary="Detalle de una factura",
    responses={404: {"description": "Factura no encontrada"}},
)
def obtener_factura(factura_id: int, db: Session = Depends(get_db_maestra)):
    """La factura con su detalle completo, concepto por concepto."""
    return FacturacionConsultaService(db).obtener(factura_id)


@router.get(
    "/facturas/{factura_id}/pdf",
    summary="Descargar el PDF de una factura",
    responses={
        200: {"content": {"application/pdf": {}}},
        404: {"description": "Factura no encontrada o sin PDF guardado"},
    },
)
def descargar_pdf(factura_id: int, db: Session = Depends(get_db_maestra)):
    """Devuelve el PDF **guardado al generar**, no uno nuevo.

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
    summary="Anular una factura",
    responses={404: {"description": "Factura no encontrada"}},
)
def anular_factura(
    factura_id: int,
    datos: AnularFacturaRequest,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Marca la factura como anulada con su motivo. **No la borra ni libera el
    número**: un correlativo con huecos no se puede auditar, y el PDF que el
    cliente recibió existe aunque se haya anulado."""
    factura = FacturaService(db).anular(factura_id, datos.motivo)
    logger.info(
        "Factura %s anulada por el administrador %s", factura.numero_formateado, admin.usuario
    )
    return FacturacionConsultaService(db).obtener(factura.id)


@router.post(
    "/facturas/{factura_id}/pagada",
    response_model=FacturaResponse,
    summary="Marcar una factura como pagada",
    responses={
        400: {"description": "La factura está anulada"},
        404: {"description": "Factura no encontrada"},
    },
)
def marcar_pagada(
    factura_id: int,
    datos: MarcarPagadaRequest,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Pone o saca la marca de pagada. No hay integración con ningún banco: lo
    registra quien vio el pago."""
    factura = FacturaService(db).marcar_pagada(factura_id, datos.pagada)
    logger.info(
        "Factura %s marcada como %s por %s",
        factura.numero_formateado, factura.estado, admin.usuario,
    )
    return FacturacionConsultaService(db).obtener(factura.id)


# ── Generación y estimación ───────────────────────────────


@router.get(
    "/estimacion",
    response_model=EstimacionPeriodoResponse,
    summary="Cuánto saldría si se facturara ahora",
)
def estimar(
    periodo: date | None = Query(
        None, description="Etiqueta del período. Por defecto, el mes anterior."
    ),
    db: Session = Depends(get_db_maestra),
):
    """Cuenta la cartera de cada cliente al momento y le aplica sus tarifas.

    **No escribe nada.** Es la respuesta a "cuánto va a salir la factura", que
    es lo que se pregunta el 20 del mes cuando todavía no hay ninguna emitida.
    Los números pueden cambiar: la cartera se mueve con cada carga del Excel.
    """
    return FacturacionConsultaService(db).estimar(periodo)


@router.post(
    "/generar",
    response_model=GenerarPeriodoResponse,
    summary="Generar la facturación de un período",
)
def generar_periodo(
    datos: GenerarPeriodoRequest | None = None,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Genera la factura del período (por defecto, el mes anterior).

    Es **idempotente**: los clientes que ya tienen factura de ese período se
    saltan, salvo que se pida `rehacer`. Rehacer anula la anterior y emite una
    nueva con su propio número, y solo tiene sentido el mismo día: después, el
    archivo de causas del cliente ya es otro y el recuento no daría lo que se
    facturó.
    """
    datos = datos or GenerarPeriodoRequest()
    logger.info(
        "Facturación de %s disparada por el administrador %s",
        datos.periodo or "(mes anterior)", admin.usuario,
    )
    return FacturacionConsultaService(db).generar(
        datos.periodo, datos.rehacer, admin.usuario
    )


# ── Tarifas por cliente ───────────────────────────────────


@router.get(
    "/clientes/{cliente_id}/tarifas",
    response_model=TarifasClienteResponse,
    summary="Tarifas configuradas para un cliente",
    responses={404: {"description": "Cliente no encontrado"}},
)
def tarifas_cliente(cliente_id: int, db: Session = Depends(get_db_maestra)):
    """Lo que este cliente tiene acordado, más lo que cobra la plataforma.

    Un concepto sin fila no vale $0: se factura al valor por defecto. Por eso
    los dos viajan juntos y la pantalla puede mostrar la diferencia.
    """
    return FacturacionConsultaService(db).tarifas_de(cliente_id)


@router.put(
    "/clientes/{cliente_id}/tarifas",
    response_model=TarifaResponse,
    summary="Fijar la tarifa de un concepto",
    responses={
        400: {"description": "Concepto o valor inválido"},
        404: {"description": "Cliente no encontrado"},
    },
)
def guardar_tarifa(
    cliente_id: int,
    datos: TarifaUpsertRequest,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Crea o actualiza la tarifa. **No cambia ninguna factura ya emitida**: el
    valor unitario queda copiado en el detalle de cada una."""
    if not ClienteRepository(db).find_by_id(cliente_id):
        raise NotFoundException("Cliente no encontrado")

    tarifa = TarifaService(db).guardar(
        cliente_id, datos.concepto, datos.valor_unitario, datos.activo
    )
    logger.info(
        "Tarifa %s del cliente %s fijada por el administrador %s",
        tarifa.concepto, cliente_id, admin.usuario,
    )
    return TarifaResponse(
        id=tarifa.id,
        cliente_id=tarifa.cliente_id,
        concepto=tarifa.concepto,
        valor_unitario=tarifa.valor_unitario,
        activo=bool(tarifa.activo),
    )


@router.delete(
    "/clientes/{cliente_id}/tarifas/{tarifa_id}",
    response_model=OperacionResponse,
    status_code=status.HTTP_200_OK,
    summary="Quitar una tarifa y volver al valor de la plataforma",
)
def eliminar_tarifa(
    cliente_id: int,
    tarifa_id: int,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Borrar la fila devuelve al cliente al precio por defecto, no a $0."""
    TarifaService(db).eliminar(cliente_id, tarifa_id)
    logger.info(
        "Tarifa %s del cliente %s eliminada por el administrador %s",
        tarifa_id, cliente_id, admin.usuario,
    )
    return OperacionResponse(
        exito=True, mensaje="Tarifa eliminada. El concepto vuelve al valor por defecto."
    )
