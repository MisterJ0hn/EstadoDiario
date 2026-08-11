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
from app.repositories.causa_repository import ultimo_origen_causas_id


class CausaCorteRepository:
    def __init__(self, db: Session):
        self.db = db

    def _origen_de_la_cartera(
        self, fecha_desde: Optional[str], fecha_hasta: Optional[str]
    ) -> Optional[int]:
        """A qué archivo acotar cuando no se pidió un rango de fechas.

        Igual que en el listado por materia: el reporte de Causas trae la
        cartera completa cada vez, así que sin acotar, un estudio que cargó el
        Excel tres veces ve sus causas de corte tres veces.

        Con un rango de fechas explícito no se acota nada: ahí la persona está
        justamente comparando reportes de distintos días, y quedarse con el
        último dejaría el filtro sin efecto.

        `-1` cuando no hay ningún archivo cargado: mejor cero filas que la
        tabla entera.
        """
        if fecha_desde or fecha_hasta:
            return None
        return ultimo_origen_causas_id(self.db) or -1

    @classmethod
    def _aplicar_filtros(
        cls,
        query,
        tipo: Optional[str],
        busqueda: Optional[str],
        corte: Optional[str],
        fecha_desde: Optional[str],
        fecha_hasta: Optional[str],
        origen_id: Optional[int] = None,
    ):
        if origen_id is not None:
            query = query.filter(CausaCorte.estado_diario_origen_id == origen_id)
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
        origen_id = self._origen_de_la_cartera(fecha_desde, fecha_hasta)
        base = self._aplicar_filtros(
            self.db.query(CausaCorte).join(
                EstadoDiarioOrigen,
                CausaCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
            ),
            tipo, busqueda, corte, fecha_desde, fecha_hasta, origen_id,
        )
        total = (
            self._aplicar_filtros(
                self.db.query(func.count(CausaCorte.id)).join(
                    EstadoDiarioOrigen,
                    CausaCorte.estado_diario_origen_id == EstadoDiarioOrigen.id,
                ),
                tipo, busqueda, corte, fecha_desde, fecha_hasta, origen_id,
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
        return sorted({fila[0].strip() for fila in query.distinct().all() if fila[0]})

    def contar_por_tipo(self) -> dict[str, int]:
        """{tipo: cuántas} en la cartera actual, para la facturación.

        Las causas de corte **no se filtran por estado**: se facturan todas las
        que estén en el archivo. Es una diferencia real con las de materia y no
        un olvido — 'Fallada' en una corte significa que se falló el recurso,
        no que la causa dejó de estar en la cartera del estudio.
        """
        origen_id = self._origen_de_la_cartera(None, None)
        filas = (
            self.db.query(CausaCorte.tipo, func.count(CausaCorte.id))
            .filter(CausaCorte.estado_diario_origen_id == origen_id)
            .group_by(CausaCorte.tipo)
            .all()
        )
        return {tipo: int(total or 0) for tipo, total in filas}
