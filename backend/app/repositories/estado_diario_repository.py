from typing import Optional
import math

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_origen import EstadoDiarioOrigen


class EstadoDiarioRepository:
    """Todas las lecturas exigen `usuario_id` para acotar al dueño de los
    datos: cada usuario ve solo lo que llegó a su casilla. `usuario_id=None`
    significa "sin filtro" y está reservado para el admin.

    El parámetro es OBLIGATORIO a propósito (sin valor por defecto): si un
    llamador nuevo se olvida de pasarlo, revienta con TypeError en vez de
    devolver silenciosamente las causas de otro abogado.
    """

    def __init__(self, db: Session):
        self.db = db

    def find_by_id(self, eid: int, usuario_id: Optional[int]) -> Optional[EstadoDiario]:
        query = (
            self.db.query(EstadoDiario)
            .join(EstadoDiario.estado_diario_origen)
            .options(
                joinedload(EstadoDiario.jurisdiccion),
                joinedload(EstadoDiario.estado_diario_origen),
                joinedload(EstadoDiario.usuario_pendiente),
            )
            .filter(EstadoDiario.id == eid)
        )
        if usuario_id is not None:
            query = query.filter(EstadoDiarioOrigen.usuario_carga_id == usuario_id)
        return query.first()

    def find_by_origen(self, origen_id: int, usuario_id: Optional[int]) -> list[EstadoDiario]:
        query = (
            self.db.query(EstadoDiario)
            .join(EstadoDiario.estado_diario_origen)
            .options(joinedload(EstadoDiario.jurisdiccion))
            .filter(EstadoDiario.estado_diario_origen_id == origen_id)
        )
        if usuario_id is not None:
            query = query.filter(EstadoDiarioOrigen.usuario_carga_id == usuario_id)
        return query.all()

    @staticmethod
    def _aplicar_filtros_comunes(
        query,
        jurisdiccion_id: Optional[int],
        fecha_desde: Optional[str],
        fecha_hasta: Optional[str],
        rut: Optional[str],
        status_filter: Optional[str],
        usuario_id: Optional[int],
    ):
        # Aislamiento por dueño. Va primero porque es la restricción que no
        # puede faltar nunca; los demás filtros son opcionales del usuario.
        if usuario_id is not None:
            query = query.filter(EstadoDiarioOrigen.usuario_carga_id == usuario_id)

        if status_filter == "resuelto":
            query = query.filter(EstadoDiario.leido == True)
        elif status_filter == "pendiente":
            # Resuelto gana sobre pendiente: al marcarlo leído (desde la app o
            # desde el botón "Resuelto" del WhatsApp) sale de esta pestaña. La
            # marca `pendiente` no se borra, para conservar el nivel y quién lo
            # dejó pendiente en el detalle y en el historial.
            query = query.filter(EstadoDiario.pendiente == True, EstadoDiario.leido == False)
        else:
            # No leídos: ni resuelto ni marcado pendiente (ver requerimiento
            # de que un pendiente deje de listarse como no leído).
            query = query.filter(EstadoDiario.leido == False, EstadoDiario.pendiente == False)

        if jurisdiccion_id:
            query = query.filter(EstadoDiario.jurisdiccion_id == jurisdiccion_id)

        if fecha_desde:
            query = query.filter(EstadoDiarioOrigen.fecha >= fecha_desde)
        if fecha_hasta:
            query = query.filter(EstadoDiarioOrigen.fecha <= fecha_hasta)

        if rut:
            query = query.filter(EstadoDiarioOrigen.rut == rut)

        return query

    def _build_filtered_query(
        self,
        usuario_id: Optional[int],
        jurisdiccion_id: Optional[int] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        rut: Optional[str] = None,
        status_filter: Optional[str] = None,  # None = no-leidos, 'resuelto', 'pendiente'
    ):
        query = (
            self.db.query(EstadoDiario)
            .join(EstadoDiario.estado_diario_origen)
            .options(
                joinedload(EstadoDiario.jurisdiccion),
                joinedload(EstadoDiario.estado_diario_origen),
                joinedload(EstadoDiario.usuario_pendiente),
            )
        )
        return self._aplicar_filtros_comunes(
            query, jurisdiccion_id, fecha_desde, fecha_hasta, rut, status_filter, usuario_id
        )

    def count_filtered(
        self,
        usuario_id: Optional[int],
        jurisdiccion_id: Optional[int] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        rut: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> int:
        query = (
            self.db.query(func.count(EstadoDiario.id))
            .join(EstadoDiario.estado_diario_origen)
        )
        query = self._aplicar_filtros_comunes(
            query, jurisdiccion_id, fecha_desde, fecha_hasta, rut, status_filter, usuario_id
        )
        return query.scalar()

    def find_filtered(
        self,
        usuario_id: Optional[int],
        jurisdiccion_id: Optional[int] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        rut: Optional[str] = None,
        status_filter: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        query = self._build_filtered_query(
            usuario_id, jurisdiccion_id, fecha_desde, fecha_hasta, rut, status_filter
        )
        total = self.count_filtered(
            usuario_id, jurisdiccion_id, fecha_desde, fecha_hasta, rut, status_filter
        )

        total_pages = 1
        current_page = 1
        if limit and limit > 0:
            total_pages = max(1, math.ceil(total / limit))
            current_page = max(1, min(page or 1, total_pages))
            query = query.offset((current_page - 1) * limit).limit(limit)

        items = query.all()
        return items, total, current_page, total_pages

    def create(self, estado_diario: EstadoDiario) -> EstadoDiario:
        self.db.add(estado_diario)
        self.db.commit()
        self.db.refresh(estado_diario)
        return estado_diario

    def bulk_create(self, items: list[EstadoDiario]) -> None:
        self.db.add_all(items)
        self.db.commit()

    def save(self) -> None:
        self.db.commit()
