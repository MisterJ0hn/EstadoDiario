"""Consultas de la cartera de causas (hojas por materia del reporte Causas).

No confundir con `movimiento_repository`: movimientos es el estado procesal de
lo que se está tramitando; esto es el universo de causas del estudio, se hayan
movido o no.

Sin filtro de visibilidad: dentro de un estudio todos ven todo.
"""

import math
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.causa import Causa
from app.models.estado_diario_origen import EstadoDiarioOrigen


class CausaRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_origen(self, rut: str, fecha) -> Optional[EstadoDiarioOrigen]:
        """El archivo de causas ya cargado para ese RUT y fecha, si existe.

        El tipo entra en la búsqueda: un estado diario y unas causas del mismo
        día y RUT son archivos distintos y los dos pueden convivir.
        """
        return (
            self.db.query(EstadoDiarioOrigen)
            .filter(
                EstadoDiarioOrigen.rut == rut,
                EstadoDiarioOrigen.fecha == fecha,
                EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_CAUSAS,
            )
            .first()
        )

    @classmethod
    def _aplicar_filtros(
        cls,
        query,
        materia: Optional[str],
        estado_causa: Optional[str],
        tribunal: Optional[str],
        busqueda: Optional[str],
        origen_id: Optional[int],
    ):
        if materia:
            query = query.filter(Causa.materia == materia)
        if estado_causa:
            query = query.filter(Causa.estado_causa == estado_causa)
        if tribunal:
            # Parcial: el nombre del tribunal viene con variantes.
            query = query.filter(Causa.tribunal.ilike(f"%{tribunal}%"))
        if busqueda:
            patron = f"%{busqueda}%"
            query = query.filter(
                or_(
                    Causa.caratulado.ilike(patron),
                    Causa.rol.ilike(patron),
                    Causa.ruc.ilike(patron),
                )
            )
        if origen_id:
            query = query.filter(Causa.estado_diario_origen_id == origen_id)
        return query

    def find_filtered(
        self,
        materia: Optional[str] = None,
        estado_causa: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        origen_id: Optional[int] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        base = self._aplicar_filtros(
            self.db.query(Causa), materia, estado_causa, tribunal, busqueda, origen_id
        )
        total = (
            self._aplicar_filtros(
                self.db.query(func.count(Causa.id)),
                materia, estado_causa, tribunal, busqueda, origen_id,
            ).scalar()
            or 0
        )

        query = base.options(joinedload(Causa.estado_diario_origen)).order_by(
            Causa.fecha_ingreso.desc().nullslast(), Causa.id.desc()
        )

        total_pages = 1
        pagina_actual = 1
        if limit and limit > 0:
            total_pages = max(1, math.ceil(total / limit))
            pagina_actual = max(1, min(page or 1, total_pages))
            query = query.offset((pagina_actual - 1) * limit).limit(limit)

        return query.all(), total, pagina_actual, total_pages

    def contar_por_materia(
        self,
        estado_causa: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        origen_id: Optional[int] = None,
    ) -> list[tuple[Optional[str], int]]:
        """(materia, total) para las pestañas del listado.

        Respeta los filtros activos MENOS el de materia: los contadores tienen
        que decir cuánto hay en cada pestaña bajo el filtro actual, no cuánto
        hay en la pestaña que ya se está mirando.
        """
        query = self._aplicar_filtros(
            self.db.query(Causa.materia, func.count(Causa.id)),
            None, estado_causa, tribunal, busqueda, origen_id,
        )
        return [
            (fila[0], int(fila[1] or 0))
            for fila in query.group_by(Causa.materia).order_by(Causa.materia).all()
        ]

    def listar_estados_causa(self) -> list[str]:
        """Estados presentes, para el combo del filtro."""
        query = self.db.query(Causa.estado_causa).filter(Causa.estado_causa.isnot(None))
        return sorted({fila[0] for fila in query.distinct().all() if fila[0]})
