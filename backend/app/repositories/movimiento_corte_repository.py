"""Consultas de las causas de corte del reporte de MOVIMIENTOS.

No confundir con `estado_diario_corte_repository`: son dos reportes distintos,
con columnas distintas, y cada uno tiene su tabla.

Sin filtro de visibilidad: dentro de un estudio todos ven todo. Hubo un
permiso por jurisdiccion (usuario_jurisdiccion) y se elimino.
"""

import math
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.movimiento_corte import MovimientoCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen


class MovimientoCorteRepository:
    def __init__(self, db: Session):
        self.db = db

    @classmethod
    def _aplicar_filtros(
        cls,
        query,
        tipo: Optional[str],
        busqueda: Optional[str],
        corte: Optional[str],
        fecha_desde: Optional[str],
        fecha_hasta: Optional[str],
    ):
        query = query

        if tipo:
            query = query.filter(MovimientoCorte.tipo == tipo)
        if corte:
            # Parcial: el nombre viene con variantes ("C.A. de Santiago").
            query = query.filter(MovimientoCorte.corte.ilike(f"%{corte}%"))
        if busqueda:
            patron = f"%{busqueda}%"
            query = query.filter(
                or_(
                    MovimientoCorte.caratulado.ilike(patron),
                    MovimientoCorte.rol.ilike(patron),
                )
            )
        # El rango va sobre la fecha del ARCHIVO, igual que en el resto: el
        # usuario piensa en "el estado diario de esta semana", no en cuándo
        # ingresó la causa a la corte.
        if fecha_desde:
            query = query.filter(EstadoDiarioOrigen.fecha >= fecha_desde)
        if fecha_hasta:
            query = query.filter(EstadoDiarioOrigen.fecha <= fecha_hasta)

        return query

    def find_filtered(
        self,
        tipo: Optional[str] = None,
        busqueda: Optional[str] = None,
        corte: Optional[str] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        base = self.db.query(MovimientoCorte).join(
            EstadoDiarioOrigen,
            MovimientoCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
        )
        base = self._aplicar_filtros(
            base, tipo, busqueda, corte, fecha_desde, fecha_hasta
        )

        conteo = self.db.query(func.count(MovimientoCorte.id)).join(
            EstadoDiarioOrigen,
            MovimientoCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
        )
        total = self._aplicar_filtros(
            conteo, tipo, busqueda, corte, fecha_desde, fecha_hasta
        ).scalar() or 0

        query = base.options(joinedload(MovimientoCorte.estado_diario_origen))
        # Lo más reciente primero: la pregunta de esta pantalla es qué se movió
        # últimamente en las cortes.
        query = query.order_by(
            MovimientoCorte.fecha_ubicacion.desc().nullslast(),
            MovimientoCorte.fecha_ingreso.desc().nullslast(),
            MovimientoCorte.id.desc(),
        )

        total_pages = 1
        pagina_actual = 1
        if limit and limit > 0:
            total_pages = max(1, math.ceil(total / limit))
            pagina_actual = max(1, min(page or 1, total_pages))
            query = query.offset((pagina_actual - 1) * limit).limit(limit)

        return query.all(), total, pagina_actual, total_pages

    def listar_cortes(self) -> list[str]:
        """Nombres de corte presentes, para el combo del filtro."""
        query = self.db.query(MovimientoCorte.corte).filter(
            MovimientoCorte.corte.isnot(None)
        )
        query = query
        return sorted({fila[0] for fila in query.distinct().all() if fila[0]})
