"""Bitácora de actividad de un cliente, vista desde la consola.

**Por qué está acá y no en la aplicación del estudio.** El estudio ya ve su
propia bitácora; esto es para soporte: cuando alguien pregunta "¿quién borró
esto?" o "¿por qué no le llegó el informe?", la respuesta está en el log del
cliente y el administrador no tiene forma de entrar a su base.

**Es de solo lectura.** No hay borrado ni edición: una bitácora que se puede
corregir no sirve para lo único que sirve una bitácora. Lo que sí existe es la
purga por antigüedad, que es una política del sistema y vive en Configuración.

Cada consulta abre la base del cliente indicado y la cierra al terminar. El
`cliente_id` viene de la URL —y no de un token, como en la app del estudio—
porque el administrador de plataforma sí puede mirar a cualquiera: eso es
exactamente su trabajo. Lo que se comprueba es que el cliente exista y que su
base esté lista.
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra, sesion_tenant
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.maestra.cliente import Cliente
from app.models.usuario import Usuario
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.log_actividades_repository import LogActividadesRepository

from admin_api.app.deps import require_admin
from admin_api.app.schemas.logs import (
    LogActividadResponse,
    LogActividadesListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/clientes",
    tags=["Bitácora de clientes"],
    dependencies=[Depends(require_admin)],
)


@router.get(
    "/{cliente_id}/logs",
    response_model=LogActividadesListResponse,
    summary="Bitácora de actividad de un cliente",
    responses={
        400: {"description": "La base del cliente no está lista"},
        404: {"description": "Cliente no encontrado"},
    },
)
def listar_logs(
    cliente_id: int,
    modulo: str | None = Query(None, description="estado_diario | audiencias | ..."),
    accion: str | None = Query(None, description="crear | editar | login | ..."),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    q: str | None = Query(None, description="Texto dentro del detalle"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_maestra),
):
    """De la más reciente a la más antigua, con el nombre de quien la hizo.

    Sin filtro de usuario: acá se mira la actividad del estudio completo, que es
    la diferencia con la bitácora que ve cada persona dentro de su aplicación.
    """
    cliente = ClienteRepository(db).find_by_id(cliente_id)
    if cliente is None:
        raise NotFoundException("Cliente no encontrado")
    if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
        raise BadRequestException(
            "La base de datos de este cliente no está lista, así que todavía no "
            "tiene bitácora."
        )

    with sesion_tenant(cliente.guid) as db_tenant:
        repo = LogActividadesRepository(db_tenant)
        items, total, total_pages = repo.listar(
            usuario_id=None,  # el estudio completo
            page=page,
            per_page=per_page,
            modulo=modulo,
            accion=accion,
            desde=desde,
            hasta=hasta,
            busqueda=q,
        )
        modulos, acciones = repo.valores_de_filtro()

        # Los nombres de usuario se resuelven de una vez para la página: un
        # `find_by_id` por fila serían cincuenta consultas para pintar cincuenta
        # nombres. Los intentos de login fallidos no traen usuario, y ahí queda
        # nulo a propósito: es información, no un dato faltante.
        ids = {i.usuario_id for i in items if i.usuario_id}
        nombres: dict[int, str] = {}
        if ids:
            for u in db_tenant.query(Usuario).filter(Usuario.id.in_(ids)).all():
                nombres[u.id] = u.usuario

        filas = [
            LogActividadResponse(
                id=i.id,
                fecha_hora=i.fecha_hora,
                modulo=i.modulo,
                accion=i.accion,
                usuario_id=i.usuario_id,
                usuario=nombres.get(i.usuario_id) if i.usuario_id else None,
                ip=i.ip,
                detalle=i.detalle,
            )
            for i in items
        ]

    return LogActividadesListResponse(
        cliente_id=cliente_id,
        cliente_nombre=cliente.nombre,
        total=total,
        page=page,
        total_pages=total_pages,
        modulos=modulos,
        acciones=acciones,
        registros=filas,
    )
