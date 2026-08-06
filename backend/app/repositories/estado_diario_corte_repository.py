"""Consultas de las causas de corte.

Mismo contrato de visibilidad que el resto del sistema: `jurisdicciones` es la
lista de jurisdicciones que el usuario puede ver, `None` = sin restricción, y
lo sin clasificar se ve siempre. Ver `EstadoDiarioService.alcance()`.
"""

import math
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.estado_diario_corte import EstadoDiarioCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen


class EstadoDiarioCorteRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _filtrar_por_jurisdiccion(query, jurisdicciones: Optional[list[int]]):
        if jurisdicciones is None:
            return query
        return query.filter(
            or_(
                EstadoDiarioCorte.jurisdiccion_id.in_(jurisdicciones),
                EstadoDiarioCorte.jurisdiccion_id.is_(None),
            )
        )

    @classmethod
    def _aplicar_filtros(
        cls,
        query,
        jurisdicciones: Optional[list[int]],
        tipo: Optional[str],
        busqueda: Optional[str],
        corte: Optional[str],
        fecha_desde: Optional[str],
        fecha_hasta: Optional[str],
    ):
        query = cls._filtrar_por_jurisdiccion(query, jurisdicciones)

        if tipo:
            query = query.filter(EstadoDiarioCorte.tipo == tipo)
        if corte:
            # Parcial: el nombre viene con variantes ("C.A. de Santiago").
            query = query.filter(EstadoDiarioCorte.corte.ilike(f"%{corte}%"))
        if busqueda:
            patron = f"%{busqueda}%"
            query = query.filter(
                or_(
                    EstadoDiarioCorte.caratulado.ilike(patron),
                    EstadoDiarioCorte.numero_ingreso.ilike(patron),
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
        jurisdicciones: Optional[list[int]],
        tipo: Optional[str] = None,
        busqueda: Optional[str] = None,
        corte: Optional[str] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        base = self.db.query(EstadoDiarioCorte).join(
            EstadoDiarioOrigen,
            EstadoDiarioCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
        )
        base = self._aplicar_filtros(
            base, jurisdicciones, tipo, busqueda, corte, fecha_desde, fecha_hasta
        )

        conteo = self.db.query(func.count(EstadoDiarioCorte.id)).join(
            EstadoDiarioOrigen,
            EstadoDiarioCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
        )
        total = self._aplicar_filtros(
            conteo, jurisdicciones, tipo, busqueda, corte, fecha_desde, fecha_hasta
        ).scalar() or 0

        query = base.options(joinedload(EstadoDiarioCorte.estado_diario_origen))
        # Lo más reciente primero: la pregunta de esta pantalla es qué se movió
        # últimamente en las cortes.
        query = query.order_by(
            EstadoDiarioCorte.fecha_ubicacion.desc().nullslast(),
            EstadoDiarioCorte.fecha_ingreso.desc().nullslast(),
            EstadoDiarioCorte.id.desc(),
        )

        total_pages = 1
        pagina_actual = 1
        if limit and limit > 0:
            total_pages = max(1, math.ceil(total / limit))
            pagina_actual = max(1, min(page or 1, total_pages))
            query = query.offset((pagina_actual - 1) * limit).limit(limit)

        return query.all(), total, pagina_actual, total_pages

    def listar_cortes(self, jurisdicciones: Optional[list[int]]) -> list[str]:
        """Nombres de corte presentes, para el combo del filtro."""
        query = self.db.query(EstadoDiarioCorte.corte).filter(
            EstadoDiarioCorte.corte.isnot(None)
        )
        query = self._filtrar_por_jurisdiccion(query, jurisdicciones)
        return sorted({fila[0] for fila in query.distinct().all() if fila[0]})
