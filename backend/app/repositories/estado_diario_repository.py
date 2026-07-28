from typing import Optional
import math

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_origen import EstadoDiarioOrigen


class EstadoDiarioRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_id(self, eid: int) -> Optional[EstadoDiario]:
        return (
            self.db.query(EstadoDiario)
            .options(
                joinedload(EstadoDiario.jurisdiccion),
                joinedload(EstadoDiario.estado_diario_origen),
                joinedload(EstadoDiario.usuario_pendiente),
            )
            .filter(EstadoDiario.id == eid)
            .first()
        )

    def find_by_origen(self, origen_id: int) -> list[EstadoDiario]:
        return (
            self.db.query(EstadoDiario)
            .options(joinedload(EstadoDiario.jurisdiccion))
            .filter(EstadoDiario.estado_diario_origen_id == origen_id)
            .all()
        )

    def _build_filtered_query(
        self,
        jurisdiccion_id: Optional[int] = None,
        fecha: Optional[str] = None,
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

        if status_filter == "resuelto":
            query = query.filter(EstadoDiario.leido == True)
        elif status_filter == "pendiente":
            query = query.filter(EstadoDiario.pendiente == True)
        else:
            query = query.filter(EstadoDiario.leido == False)

        if jurisdiccion_id:
            query = query.filter(EstadoDiario.jurisdiccion_id == jurisdiccion_id)

        if fecha:
            query = query.filter(EstadoDiarioOrigen.fecha == fecha)

        if rut:
            query = query.filter(EstadoDiarioOrigen.rut == rut)

        return query

    def count_filtered(
        self,
        jurisdiccion_id: Optional[int] = None,
        fecha: Optional[str] = None,
        rut: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> int:
        query = (
            self.db.query(func.count(EstadoDiario.id))
            .join(EstadoDiario.estado_diario_origen)
        )

        if status_filter == "resuelto":
            query = query.filter(EstadoDiario.leido == True)
        elif status_filter == "pendiente":
            query = query.filter(EstadoDiario.pendiente == True)
        else:
            query = query.filter(EstadoDiario.leido == False)

        if jurisdiccion_id:
            query = query.filter(EstadoDiario.jurisdiccion_id == jurisdiccion_id)
        if fecha:
            query = query.filter(EstadoDiarioOrigen.fecha == fecha)
        if rut:
            query = query.filter(EstadoDiarioOrigen.rut == rut)

        return query.scalar()

    def find_filtered(
        self,
        jurisdiccion_id: Optional[int] = None,
        fecha: Optional[str] = None,
        rut: Optional[str] = None,
        status_filter: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        query = self._build_filtered_query(jurisdiccion_id, fecha, rut, status_filter)
        total = self.count_filtered(jurisdiccion_id, fecha, rut, status_filter)

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
