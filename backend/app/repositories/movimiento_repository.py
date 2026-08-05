"""Consultas del módulo Movimientos.

La visibilidad se controla con `jurisdicciones`: la lista de jurisdicciones que
el usuario tiene permitido ver, o `None` para "sin restricción" (el
administrador del estudio, y quien no tenga ninguna asignada). Lo resuelve
`EstadoDiarioService.alcance()` y es el único punto de control.

Un movimiento **sin jurisdicción** lo ve todo el mundo: son los que el parser
no pudo clasificar, y esconderlos los haría desaparecer sin que nadie lo note.

El filtrado, el conteo y la agregación se resuelven en SQL, nunca trayendo
filas a Python.
"""

import math
from typing import Optional

from sqlalchemy import func, nulls_last, or_
from sqlalchemy.orm import Session, joinedload

from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.movimiento import Movimiento


class MovimientoRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── Orígenes (archivos) ───────────────────────────────

    def find_origen_movimientos(self, rut: str, fecha) -> Optional[EstadoDiarioOrigen]:
        """Archivo de movimientos ya cargado para ese RUT y fecha, si existe.

        Filtra por `tipo` a propósito: el mismo RUT puede tener el mismo día un
        estado diario y un archivo de movimientos sin que uno sea duplicado del
        otro.
        """
        return (
            self.db.query(EstadoDiarioOrigen)
            .filter(
                EstadoDiarioOrigen.rut == rut,
                EstadoDiarioOrigen.fecha == fecha,
                EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_MOVIMIENTOS,
            )
            .first()
        )

    def find_origenes_paginados(
        self,
        page: int = 1,
        per_page: int = 20,
    ):
        """Los archivos cargados por el estudio.

        No se filtran por jurisdicción: el archivo es del estudio y lo que se
        acota es su contenido, al abrirlo. Esconder el archivo entero porque
        trae una causa de otra materia dejaría al usuario sin saber siquiera
        que el estado diario del día llegó.
        """
        base = self.db.query(EstadoDiarioOrigen).filter(
            EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_MOVIMIENTOS
        )

        total = base.with_entities(func.count(EstadoDiarioOrigen.id)).scalar() or 0
        total_pages = max(1, math.ceil(total / per_page)) if per_page else 1
        page = max(1, min(page or 1, total_pages))

        items = (
            base.options(joinedload(EstadoDiarioOrigen.usuario_carga))
            .order_by(EstadoDiarioOrigen.fecha.desc(), EstadoDiarioOrigen.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total, page, total_pages

    # ── Movimientos ───────────────────────────────────────

    @staticmethod
    def _aplicar_filtros(
        query,
        jurisdicciones: Optional[list[int]],
        materia: Optional[str],
        estado_causa: Optional[str],
        tribunal: Optional[str],
        busqueda: Optional[str],
        rut: Optional[str],
        origen_id: Optional[int],
        fecha_desde: Optional[str],
        fecha_hasta: Optional[str],
    ):
        # Red de seguridad: un movimiento siempre cuelga de un archivo de tipo
        # movimientos, pero nada en el esquema lo garantiza.
        query = query.filter(
            EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_MOVIMIENTOS
        )

        # Permiso de visibilidad. None = sin restricción.
        if jurisdicciones is not None:
            query = query.filter(
                or_(
                    Movimiento.jurisdiccion_id.in_(jurisdicciones),
                    Movimiento.jurisdiccion_id.is_(None),
                )
            )

        if materia:
            query = query.filter(Movimiento.materia == materia)
        if estado_causa:
            query = query.filter(Movimiento.estado_causa == estado_causa)
        if tribunal:
            # Parcial: el nombre del tribunal viene con variantes de formato
            # ("1° Juzgado Civil de San Miguel").
            query = query.filter(Movimiento.tribunal.ilike(f"%{tribunal}%"))

        if busqueda:
            patron = f"%{busqueda.strip()}%"
            query = query.filter(
                Movimiento.caratulado.ilike(patron) | Movimiento.rol.ilike(patron)
            )

        if rut:
            query = query.filter(EstadoDiarioOrigen.rut == rut)
        if origen_id:
            query = query.filter(Movimiento.estado_diario_origen_id == origen_id)
        if fecha_desde:
            query = query.filter(EstadoDiarioOrigen.fecha >= fecha_desde)
        if fecha_hasta:
            query = query.filter(EstadoDiarioOrigen.fecha <= fecha_hasta)

        return query

    def count_filtered(
        self,
        jurisdicciones: Optional[list[int]] = None,
        materia: Optional[str] = None,
        estado_causa: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        rut: Optional[str] = None,
        origen_id: Optional[int] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
    ) -> int:
        query = (
            self.db.query(func.count(Movimiento.id))
            .join(Movimiento.estado_diario_origen)
        )
        query = self._aplicar_filtros(
            query, jurisdicciones, materia, estado_causa, tribunal, busqueda,
            rut, origen_id, fecha_desde, fecha_hasta,
        )
        return query.scalar() or 0

    def find_filtered(
        self,
        jurisdicciones: Optional[list[int]] = None,
        materia: Optional[str] = None,
        estado_causa: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        rut: Optional[str] = None,
        origen_id: Optional[int] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        """Devuelve (items, total, page, total_pages)."""
        total = self.count_filtered(
            jurisdicciones, materia, estado_causa, tribunal, busqueda,
            rut, origen_id, fecha_desde, fecha_hasta,
        )

        query = (
            self.db.query(Movimiento)
            .join(Movimiento.estado_diario_origen)
            .options(joinedload(Movimiento.estado_diario_origen))
        )
        query = self._aplicar_filtros(
            query, jurisdicciones, materia, estado_causa, tribunal, busqueda,
            rut, origen_id, fecha_desde, fecha_hasta,
        ).order_by(
            nulls_last(Movimiento.fecha_ingreso.desc()),
            Movimiento.id.desc(),
        )

        total_pages = 1
        current_page = 1
        if limit and limit > 0:
            total_pages = max(1, math.ceil(total / limit))
            current_page = max(1, min(page or 1, total_pages))
            query = query.offset((current_page - 1) * limit).limit(limit)

        return query.all(), total, current_page, total_pages

    # ── Agregaciones (para las pestañas y los combos de filtro) ──

    def contar_por_materia(
        self,
        jurisdicciones: Optional[list[int]] = None,
        estado_causa: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        rut: Optional[str] = None,
        origen_id: Optional[int] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
    ) -> list[tuple[Optional[str], int]]:
        """GROUP BY materia en SQL. No recibe `materia` a propósito: se usa para
        pintar el total de cada pestaña, incluidas las no seleccionadas."""
        query = (
            self.db.query(Movimiento.materia, func.count(Movimiento.id))
            .join(Movimiento.estado_diario_origen)
        )
        query = self._aplicar_filtros(
            query, jurisdicciones, None, estado_causa, tribunal, busqueda,
            rut, origen_id, fecha_desde, fecha_hasta,
        )
        return (
            query.group_by(Movimiento.materia)
            .order_by(Movimiento.materia)
            .all()
        )

    def listar_estados_causa(
        self,
        jurisdicciones: Optional[list[int]] = None,
        materia: Optional[str] = None,
    ) -> list[str]:
        """Valores distintos de "Estado Causa" visibles para el usuario."""
        query = (
            self.db.query(Movimiento.estado_causa)
            .join(Movimiento.estado_diario_origen)
        )
        query = self._aplicar_filtros(
            query, jurisdicciones, materia, None, None, None, None, None, None, None
        )
        filas = (
            query.filter(Movimiento.estado_causa.isnot(None))
            .distinct()
            .order_by(Movimiento.estado_causa)
            .all()
        )
        return [f[0] for f in filas]
