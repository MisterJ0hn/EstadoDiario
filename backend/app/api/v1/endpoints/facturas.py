"""Las facturas del propio estudio, de solo lectura.

**Por qué está acá y no en la consola de administración.** Es el mismo dato —la
tabla `factura` vive en la base principal— pero visto por su destinatario: el
estudio quiere saber qué se le cobró, sin tener que pedirlo. La consola sigue
siendo el único lugar donde se generan, se anulan y se marcan pagadas; acá no
hay ninguna de esas tres.

**El aislamiento es la parte delicada.** `cliente_id` sale del **token**, nunca
de la URL ni de un parámetro: un estudio no puede ni nombrar a otro. Por eso el
listado no acepta un `cliente_id`, y el detalle y el PDF comprueban que la
factura pedida sea suya antes de devolver nada — con un id de otro cliente
responden 404 y no 403, que confirmaría que ese id existe.

**Se muestran las últimas 12.** Un año de facturación es lo que alguien revisa;
más atrás se consulta puntualmente y no hojeando una tabla.
"""

import logging

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.core.deps import TenantContexto, get_tenant_actual
from app.core.exceptions import NotFoundException
from app.models.maestra.factura import Factura
from app.schemas.factura import FacturaClienteListResponse, FacturaClienteResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/facturas", tags=["Facturas"])

# Cuántas ve el estudio. Doce es un año: lo que alguien efectivamente revisa de
# corrido. Es un tope, no una paginación, porque no hay una pregunta razonable
# que se responda en la página 4 de las facturas propias.
ULTIMAS = 12


def _de_la_sesion(db: Session, tenant: TenantContexto):
    """Consulta base acotada al cliente del token."""
    return db.query(Factura).filter(Factura.cliente_id == tenant.cliente_id)


def _a_response(factura: Factura) -> FacturaClienteResponse:
    return FacturaClienteResponse(
        id=factura.id,
        numero=factura.numero_formateado,
        periodo=factura.periodo,
        fecha_emision=factura.fecha_emision,
        total=factura.total or 0,
        estado=factura.estado or Factura.ESTADO_EMITIDA,
        anulada=bool(factura.anulada),
        motivo_anulacion=factura.motivo_anulacion,
        total_causas=sum(d.cantidad or 0 for d in factura.detalles),
        detalles=[
            {
                "concepto": d.concepto,
                "cantidad": d.cantidad or 0,
                "valor_unitario": d.valor_unitario or 0,
                "valor_total": d.valor_total or 0,
            }
            for d in factura.detalles
        ],
    )


@router.get(
    "",
    response_model=FacturaClienteListResponse,
    summary="Últimas facturas del estudio",
)
def listar_mis_facturas(
    db: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
):
    """Las últimas 12, de la más nueva a la más vieja.

    No recibe `cliente_id`: sale del token. Un parámetro sería una invitación a
    probar con el número de al lado.
    """
    facturas = (
        _de_la_sesion(db, tenant)
        # Por PERÍODO y no por correlativo: "las últimas" son los meses más
        # recientes. En producción los dos suben juntos —se genera una por mes—
        # pero si se regenera un período viejo su número queda alto y con el
        # otro orden se colaría al principio del listado.
        .order_by(Factura.periodo.desc().nullslast(), Factura.numero.desc())
        .limit(ULTIMAS)
        .all()
    )
    return FacturaClienteListResponse(
        total=len(facturas),
        # Solo lo cobrable: incluir las anuladas daría una cifra que no existe.
        total_monto=sum((f.total or 0) for f in facturas if not f.anulada),
        facturas=[_a_response(f) for f in facturas],
    )


@router.get(
    "/{factura_id}",
    response_model=FacturaClienteResponse,
    summary="Detalle de una factura propia",
    responses={404: {"description": "No existe o no es de este estudio"}},
)
def obtener_mi_factura(
    factura_id: int,
    db: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
):
    factura = _de_la_sesion(db, tenant).filter(Factura.id == factura_id).first()
    if not factura:
        raise NotFoundException("Factura no encontrada")
    return _a_response(factura)


@router.get(
    "/{factura_id}/pdf",
    summary="Descargar el PDF de una factura propia",
    responses={
        200: {"content": {"application/pdf": {}}},
        404: {"description": "No existe, no es de este estudio o no tiene PDF"},
    },
)
def descargar_mi_pdf(
    factura_id: int,
    db: Session = Depends(get_db_maestra),
    tenant: TenantContexto = Depends(get_tenant_actual),
):
    """El PDF **guardado al emitir**, el mismo que ve la administración."""
    factura = _de_la_sesion(db, tenant).filter(Factura.id == factura_id).first()
    if not factura or not factura.pdf:
        raise NotFoundException("Factura no encontrada")

    nombre = factura.pdf_nombre or f"factura-{factura.numero_formateado}.pdf"
    return Response(
        content=bytes(factura.pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
