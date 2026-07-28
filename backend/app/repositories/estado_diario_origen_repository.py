from typing import Optional
import math

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.estado_diario import EstadoDiario


class EstadoDiarioOrigenRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_all_paginated(self, page: int = 1, per_page: int = 20):
        total = self.db.query(func.count(EstadoDiarioOrigen.id)).scalar()
        total_pages = max(1, math.ceil(total / per_page))

        items = (
            self.db.query(EstadoDiarioOrigen)
            .order_by(EstadoDiarioOrigen.fecha.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return items, total, total_pages

    def find_by_id(self, oid: int) -> Optional[EstadoDiarioOrigen]:
        return self.db.get(EstadoDiarioOrigen, oid)

    def create(self, origen: EstadoDiarioOrigen) -> EstadoDiarioOrigen:
        self.db.add(origen)
        self.db.commit()
        self.db.refresh(origen)
        return origen

    def delete(self, origen: EstadoDiarioOrigen) -> None:
        self.db.delete(origen)
        self.db.commit()

    def count_movimientos(self, origen_id: int) -> int:
        return (
            self.db.query(func.count(EstadoDiario.id))
            .filter(EstadoDiario.estado_diario_origen_id == origen_id)
            .scalar()
        )
