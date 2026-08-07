"""Consultas de las causas de corte del reporte de CAUSAS.

Son tres repositorios de corte y no uno: `estado_diario_corte`,
`movimiento_corte` y éste. Los tres reportes traen hojas llamadas igual con
columnas distintas, y unificarlos haría imposible saber de qué reporte vino
cada fila.

Sin filtro de visibilidad: dentro de un estudio todos ven todo.
"""

import math
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.causa_corte import CausaCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen


class CausaCorteRepository:
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
        if tipo:
            query = query.filter(CausaCorte.tipo == tipo)
        if corte:
            # Parcial: el nombre viene con variantes ("C.A. de Santiago").
            query = query.filter(CausaCorte.corte.ilike(f"%{corte}%"))
        if busqueda:
            patron = f"%{busqueda}%"
            query = query.filter(
                or_(CausaCorte.caratulado.ilike(patron), CausaCorte.rol.ilike(patron))
            )
        # El rango va sobre la fecha del ARCHIVO, igual que en el resto del
        # sistema: el usuario piensa en qué reporte mira, no en cuándo ingresó
        # la causa a la corte.
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
        base = self._aplicar_filtros(
            self.db.query(CausaCorte).join(
                EstadoDiarioOrigen,
                CausaCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
            ),
            tipo, busqueda, corte, fecha_desde, fecha_hasta,
        )
        total = (
            self._aplicar_filtros(
                self.db.query(func.count(CausaCorte.id)).join(
                    EstadoDiarioOrigen,
                    CausaCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
                ),
                tipo, busqueda, corte, fecha_desde, fecha_hasta,
            ).scalar()
            or 0
        )

        query = base.options(joinedload(CausaCorte.estado_diario_origen)).order_by(
            CausaCorte.fecha_ubicacion.desc().nullslast(),
            CausaCorte.fecha_ingreso.desc().nullslast(),
            CausaCorte.id.desc(),
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
        query = self.db.query(CausaCorte.corte).filter(CausaCorte.corte.isnot(None))
        return sorted({fila[0] for fila in query.distinct().all() if fila[0]})
