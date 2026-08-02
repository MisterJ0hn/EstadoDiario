from typing import Optional
import math

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.estado_diario import EstadoDiario
from app.models.movimiento import Movimiento


class EstadoDiarioOrigenRepository:
    """Archivos recibidos, de los dos tipos (ver `EstadoDiarioOrigen.tipo`).

    Igual que en EstadoDiarioRepository, `usuario_id` es obligatorio en las
    lecturas y `None` significa "sin filtro", reservado para el admin. Sin
    valor por defecto a propósito: un llamador que lo olvide falla en vez de
    exponer los archivos de otro usuario.
    """

    def __init__(self, db: Session):
        self.db = db

    def find_all_paginated(
        self,
        usuario_id: Optional[int],
        tipo: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ):
        total_query = self.db.query(func.count(EstadoDiarioOrigen.id))
        items_query = self.db.query(EstadoDiarioOrigen)

        if usuario_id is not None:
            total_query = total_query.filter(EstadoDiarioOrigen.usuario_carga_id == usuario_id)
            items_query = items_query.filter(EstadoDiarioOrigen.usuario_carga_id == usuario_id)
        if tipo is not None:
            total_query = total_query.filter(EstadoDiarioOrigen.tipo == tipo)
            items_query = items_query.filter(EstadoDiarioOrigen.tipo == tipo)

        total = total_query.scalar()
        total_pages = max(1, math.ceil(total / per_page))

        items = (
            items_query.order_by(EstadoDiarioOrigen.fecha.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return items, total, total_pages

    def find_by_id(self, oid: int, usuario_id: Optional[int]) -> Optional[EstadoDiarioOrigen]:
        query = self.db.query(EstadoDiarioOrigen).filter(EstadoDiarioOrigen.id == oid)
        if usuario_id is not None:
            query = query.filter(EstadoDiarioOrigen.usuario_carga_id == usuario_id)
        return query.first()

    def find_by_rut_fecha(
        self,
        rut: str,
        fecha,
        usuario_id: Optional[int],
        tipo: str = EstadoDiarioOrigen.TIPO_ESTADO_DIARIO,
    ) -> Optional[EstadoDiarioOrigen]:
        """Detección de duplicados. La unicidad es por (dueño, rut, fecha,
        tipo), no global: dos abogados pueden recibir legítimamente el estado
        diario del mismo RUT el mismo día, y el estado diario y el reporte de
        movimientos del mismo RUT/fecha son archivos distintos.
        """
        query = self.db.query(EstadoDiarioOrigen).filter(
            EstadoDiarioOrigen.rut == rut,
            EstadoDiarioOrigen.fecha == fecha,
            EstadoDiarioOrigen.tipo == tipo,
        )
        if usuario_id is not None:
            query = query.filter(EstadoDiarioOrigen.usuario_carga_id == usuario_id)
        return query.first()

    def create(self, origen: EstadoDiarioOrigen) -> EstadoDiarioOrigen:
        self.db.add(origen)
        self.db.commit()
        self.db.refresh(origen)
        return origen

    def delete(self, origen: EstadoDiarioOrigen) -> None:
        self.db.delete(origen)
        self.db.commit()

    def count_registros(self, origen: EstadoDiarioOrigen) -> int:
        """Cuántas filas trajo el archivo. Cuál tabla contar depende del tipo:
        los de movimientos no tienen filas en `estado_diario`.
        """
        if origen.tipo == EstadoDiarioOrigen.TIPO_MOVIMIENTOS:
            return (
                self.db.query(func.count(Movimiento.id))
                .filter(Movimiento.estado_diario_origen_id == origen.id)
                .scalar()
            )
        return (
            self.db.query(func.count(EstadoDiario.id))
            .filter(EstadoDiario.estado_diario_origen_id == origen.id)
            .scalar()
        )
