"""Consultas del módulo Audiencias.

La visibilidad se controla con `jurisdicciones` (`None` = sin restricción),
igual que en el resto de la app, y no necesita JOIN: `audiencia.jurisdiccion_id`
está en la propia fila. Solo se une a `estado_diario_origen` cuando el filtro es
del archivo (RUT).

**`audiencia.usuario_id` es otra cosa** y sigue existiendo: es el dueño
denormalizado que usan la deduplicación al importar (`find_por_claves`) y la
sincronización con el Google Calendar de esa persona (`find_pendientes_google`).
Eso es propiedad de un artefacto personal, no permiso de lectura, y no se
reemplaza por jurisdicción.

El filtrado, el conteo y la agregación se resuelven en SQL.
"""

import math
from datetime import date
from typing import Optional

from sqlalchemy import func, nulls_last, or_
from sqlalchemy.orm import Session, joinedload

from app.models.audiencia import Audiencia
from app.models.estado_diario_origen import EstadoDiarioOrigen


class AudienciaRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── Orígenes (archivos) ───────────────────────────────

    def find_origen_audiencias(self, rut: str, fecha) -> Optional[EstadoDiarioOrigen]:
        """Archivo de audiencias ya cargado para ese RUT y fecha de inicio.

        Filtra por `tipo` a propósito: el mismo RUT puede tener el mismo día un
        estado diario, un archivo de movimientos y uno de audiencias.
        """
        return (
            self.db.query(EstadoDiarioOrigen)
            .filter(
                EstadoDiarioOrigen.rut == rut,
                EstadoDiarioOrigen.fecha == fecha,
                EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_AUDIENCIAS,
            )
            .first()
        )

    def find_origenes_paginados(
        self,
        page: int = 1,
        per_page: int = 20,
    ):
        """Los archivos de audiencias cargados por el estudio. Sin filtro de
        jurisdicción: se acota el contenido, no el archivo (ver el equivalente
        en MovimientoRepository)."""
        base = self.db.query(EstadoDiarioOrigen).filter(
            EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_AUDIENCIAS
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

    # ── Deduplicación (importación) ───────────────────────

    def find_por_claves(self, usuario_id: int, claves: list[str]) -> dict[str, Audiencia]:
        """Audiencias del usuario que ya existen para esas claves naturales.

        Una sola consulta con IN para todo el archivo, en vez de un SELECT por
        fila. Se trocea porque PostgreSQL no acepta listas de parámetros
        arbitrariamente largas y un archivo grande podría pasarse.
        """
        if not claves:
            return {}

        encontradas: dict[str, Audiencia] = {}
        tamano_lote = 1000
        for inicio in range(0, len(claves), tamano_lote):
            lote = claves[inicio:inicio + tamano_lote]
            filas = (
                self.db.query(Audiencia)
                .filter(
                    Audiencia.usuario_id == usuario_id,
                    Audiencia.clave_natural.in_(lote),
                )
                .all()
            )
            encontradas.update({a.clave_natural: a for a in filas})
        return encontradas

    # ── Audiencias ────────────────────────────────────────

    @staticmethod
    def _aplicar_filtros(
        query,
        jurisdicciones: Optional[list[int]],
        materia: Optional[str],
        tipo_audiencia: Optional[str],
        tribunal: Optional[str],
        busqueda: Optional[str],
        rut: Optional[str],
        origen_id: Optional[int],
        desde: Optional[date],
        hasta: Optional[date],
    ):
        # Permiso de visibilidad. None = sin restricción. Las audiencias sin
        # jurisdicción las ve todo el mundo, igual que las causas.
        if jurisdicciones is not None:
            query = query.filter(
                or_(
                    Audiencia.jurisdiccion_id.in_(jurisdicciones),
                    Audiencia.jurisdiccion_id.is_(None),
                )
            )

        if materia:
            query = query.filter(Audiencia.materia == materia)
        if tipo_audiencia:
            query = query.filter(Audiencia.tipo_audiencia == tipo_audiencia)
        if tribunal:
            # Parcial: el nombre del tribunal viene con variantes de formato
            # ("1 Juzgado de Familia San Miguel" / "Jgdo. L. de Tocopilla").
            query = query.filter(Audiencia.tribunal.ilike(f"%{tribunal}%"))

        if busqueda:
            patron = f"%{busqueda.strip()}%"
            query = query.filter(
                Audiencia.caratulado.ilike(patron)
                | Audiencia.rol.ilike(patron)
                | Audiencia.ruc.ilike(patron)
            )

        if origen_id:
            query = query.filter(Audiencia.estado_diario_origen_id == origen_id)
        if desde:
            query = query.filter(Audiencia.fecha_audiencia >= desde)
        if hasta:
            query = query.filter(Audiencia.fecha_audiencia <= hasta)

        # Único filtro que obliga a mirar el archivo; el join se paga solo
        # cuando se pide.
        if rut:
            query = query.join(Audiencia.estado_diario_origen).filter(
                EstadoDiarioOrigen.rut == rut
            )

        return query

    def count_filtered(
        self,
        jurisdicciones: Optional[list[int]] = None,
        materia: Optional[str] = None,
        tipo_audiencia: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        rut: Optional[str] = None,
        origen_id: Optional[int] = None,
        desde: Optional[date] = None,
        hasta: Optional[date] = None,
    ) -> int:
        query = self.db.query(func.count(Audiencia.id))
        query = self._aplicar_filtros(
            query, jurisdicciones, materia, tipo_audiencia, tribunal, busqueda,
            rut, origen_id, desde, hasta,
        )
        return query.scalar() or 0

    def find_filtered(
        self,
        jurisdicciones: Optional[list[int]] = None,
        materia: Optional[str] = None,
        tipo_audiencia: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        rut: Optional[str] = None,
        origen_id: Optional[int] = None,
        desde: Optional[date] = None,
        hasta: Optional[date] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        """Devuelve (items, total, page, total_pages).

        Orden ASCENDENTE por fecha y hora: este módulo mira hacia adelante, lo
        primero que se ve es lo que viene antes. Es el orden inverso al de
        Movimientos, que muestra lo más reciente primero.
        """
        total = self.count_filtered(
            jurisdicciones, materia, tipo_audiencia, tribunal, busqueda,
            rut, origen_id, desde, hasta,
        )

        query = self.db.query(Audiencia).options(
            joinedload(Audiencia.estado_diario_origen)
        )
        query = self._aplicar_filtros(
            query, jurisdicciones, materia, tipo_audiencia, tribunal, busqueda,
            rut, origen_id, desde, hasta,
        ).order_by(
            Audiencia.fecha_audiencia.asc(),
            nulls_last(Audiencia.hora.asc()),
            Audiencia.id.asc(),
        )

        total_pages = 1
        current_page = 1
        if limit and limit > 0:
            total_pages = max(1, math.ceil(total / limit))
            current_page = max(1, min(page or 1, total_pages))
            query = query.offset((current_page - 1) * limit).limit(limit)

        return query.all(), total, current_page, total_pages

    def find_para_calendario(
        self,
        jurisdicciones: Optional[list[int]],
        desde: date,
        hasta: date,
    ) -> list[Audiencia]:
        """Audiencias de una ventana de fechas, para pintar el calendario.

        Acotado por rango a propósito: las audiencias se acumulan sin techo y
        traerlas todas engordaría la respuesta mes a mes.
        """
        query = self.db.query(Audiencia).filter(
            Audiencia.fecha_audiencia >= desde,
            Audiencia.fecha_audiencia <= hasta,
        )
        if jurisdicciones is not None:
            query = query.filter(
                or_(
                    Audiencia.jurisdiccion_id.in_(jurisdicciones),
                    Audiencia.jurisdiccion_id.is_(None),
                )
            )
        return query.order_by(
            Audiencia.fecha_audiencia.asc(),
            nulls_last(Audiencia.hora.asc()),
        ).all()

    def find_pendientes_google(
        self, usuario_id: int, desde: date, limite: int = 200
    ) -> list[Audiencia]:
        """Audiencias futuras del usuario que todavía no tienen evento en Google.

        Solo hacia adelante: sincronizar audiencias ya pasadas llenaría el
        calendario de ruido sin aportar nada.
        """
        return (
            self.db.query(Audiencia)
            .filter(
                Audiencia.usuario_id == usuario_id,
                Audiencia.fecha_audiencia >= desde,
                Audiencia.google_event_id.is_(None),
            )
            .order_by(Audiencia.fecha_audiencia.asc())
            .limit(limite)
            .all()
        )

    # ── Agregaciones (pestañas y combos de filtro) ────────

    def contar_por_materia(
        self,
        jurisdicciones: Optional[list[int]] = None,
        tipo_audiencia: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        rut: Optional[str] = None,
        origen_id: Optional[int] = None,
        desde: Optional[date] = None,
        hasta: Optional[date] = None,
    ) -> list[tuple[Optional[str], int]]:
        """GROUP BY materia en SQL. No recibe `materia` a propósito: alimenta el
        total de cada pestaña, incluidas las no seleccionadas."""
        query = self.db.query(Audiencia.materia, func.count(Audiencia.id))
        query = self._aplicar_filtros(
            query, jurisdicciones, None, tipo_audiencia, tribunal, busqueda,
            rut, origen_id, desde, hasta,
        )
        return query.group_by(Audiencia.materia).order_by(Audiencia.materia).all()

    def contar_por_origen(self, origen_ids: list[int]) -> dict[int, int]:
        """Cuántas audiencias apunta hoy cada archivo, en una sola consulta.

        Evita el COUNT por fila al pintar el listado de archivos. No filtra por
        usuario: los ids ya vienen de una consulta acotada al usuario.
        """
        if not origen_ids:
            return {}
        filas = (
            self.db.query(
                Audiencia.estado_diario_origen_id, func.count(Audiencia.id)
            )
            .filter(Audiencia.estado_diario_origen_id.in_(origen_ids))
            .group_by(Audiencia.estado_diario_origen_id)
            .all()
        )
        return {origen_id: total for origen_id, total in filas}

    def listar_tipos_audiencia(
        self,
        jurisdicciones: Optional[list[int]] = None,
        materia: Optional[str] = None,
    ) -> list[str]:
        """Valores distintos de "Tipo Audiencia" visibles para el usuario."""
        query = self.db.query(Audiencia.tipo_audiencia)
        query = self._aplicar_filtros(
            query, jurisdicciones, materia, None, None, None, None, None, None, None
        )
        filas = (
            query.filter(Audiencia.tipo_audiencia.isnot(None))
            .distinct()
            .order_by(Audiencia.tipo_audiencia)
            .all()
        )
        return [f[0] for f in filas]
