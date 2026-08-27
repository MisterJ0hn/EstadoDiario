"""Log de consultas a api-pjud.codifica.cl, visto desde la consola.

**Para qué.** Cuando un estudio dice "aprieto Detalle PJUD y solo me dice que
está sincronizando", acá está qué pasó: si la causa quedó encolada en el
proveedor, si la API rechazó las credenciales, si el tribunal no estaba en el
catálogo, cuánto tardó cada intento.

**Es de solo lectura** y **global**: a diferencia de la bitácora por cliente,
estas filas viven todas en la base principal —la credencial de api-pjud es de
la plataforma— así que una sola consulta las trae todas, con filtro opcional
por cliente.
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.models.maestra.cliente import Cliente
from app.repositories.pjud_llamado_repository import PjudLlamadoRepository

from admin_api.app.deps import require_admin
from admin_api.app.schemas.pjud_logs import (
    PjudLlamadoResponse,
    PjudLlamadosListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/pjud",
    tags=["Log api-pjud"],
    dependencies=[Depends(require_admin)],
)


@router.get(
    "/llamados",
    response_model=PjudLlamadosListResponse,
    summary="Consultas a api-pjud.codifica.cl, de la más reciente a la más antigua",
)
def listar_llamados(
    cliente_id: int | None = Query(None, description="Filtrar por un estudio"),
    resultado: str | None = Query(None, description="listo | sincronizando | error"),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    q: str | None = Query(None, description="Texto en rol, tribunal o mensaje"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_maestra),
):
    repo = PjudLlamadoRepository(db)
    items, total, total_pages = repo.listar(
        page=page,
        per_page=per_page,
        cliente_id=cliente_id,
        resultado=resultado,
        desde=desde,
        hasta=hasta,
        busqueda=q,
    )

    # Nombre del estudio de una vez para la página, en vez de un SELECT por fila.
    ids = {i.cliente_id for i in items if i.cliente_id}
    nombres: dict[int, str] = {}
    if ids:
        for c in db.query(Cliente.cliente_id, Cliente.nombre).filter(
            Cliente.cliente_id.in_(ids)
        ):
            nombres[c.cliente_id] = c.nombre

    registros = [
        PjudLlamadoResponse(
            id=i.id,
            fecha_hora=i.fecha_hora,
            cliente_id=i.cliente_id,
            cliente_nombre=nombres.get(i.cliente_id) if i.cliente_id else None,
            rol=i.rol,
            tribunal=i.tribunal,
            forzar=i.forzar,
            resultado=i.resultado,
            http_status=i.http_status,
            mensaje=i.mensaje,
            duracion_ms=i.duracion_ms,
        )
        for i in items
    ]

    return PjudLlamadosListResponse(
        total=total,
        page=page,
        total_pages=total_pages,
        resumen=repo.resumen(dias=7),
        registros=registros,
    )
