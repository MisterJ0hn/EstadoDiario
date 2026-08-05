from typing import Optional
import math

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_origen import EstadoDiarioOrigen


class EstadoDiarioRepository:
    """Todas las lecturas exigen `jurisdicciones`: la lista de jurisdicciones
    que el usuario tiene permitido ver. `None` significa "sin restricción" y lo
    devuelve `EstadoDiarioService.alcance()` para el administrador del estudio
    y para quien no tenga ninguna asignada.

    El parámetro es OBLIGATORIO a propósito (sin valor por defecto): si un
    llamador nuevo se olvida de pasarlo, revienta con TypeError en vez de
    devolver silenciosamente causas que esa persona no debería ver.

    Ojo con el nombre: antes este parámetro era `usuario_id` y filtraba por el
    dueño del archivo. No es lo mismo y no se puede pasar uno donde va el otro.
    """

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _filtrar_por_jurisdiccion(query, jurisdicciones: Optional[list[int]]):
        """Restringe a las jurisdicciones permitidas.

        Las causas **sin jurisdicción** (el parser no la pudo determinar) las ve
        todo el mundo. Excluirlas sería más estricto, pero las haría
        desaparecer sin que nadie se entere: nadie echa de menos una causa que
        no sabe que existe. Prefiero que sobre y se vea, a que falte y no.
        """
        if jurisdicciones is None:
            return query
        return query.filter(
            or_(
                EstadoDiario.jurisdiccion_id.in_(jurisdicciones),
                EstadoDiario.jurisdiccion_id.is_(None),
            )
        )

    def find_by_id(self, eid: int, jurisdicciones: Optional[list[int]]) -> Optional[EstadoDiario]:
        query = (
            self.db.query(EstadoDiario)
            .join(EstadoDiario.estado_diario_origen)
            .options(
                joinedload(EstadoDiario.jurisdiccion),
                joinedload(EstadoDiario.estado_diario_origen),
                joinedload(EstadoDiario.usuario_pendiente),
            )
            .filter(EstadoDiario.id == eid)
        )
        return self._filtrar_por_jurisdiccion(query, jurisdicciones).first()

    def find_by_origen(
        self, origen_id: int, jurisdicciones: Optional[list[int]]
    ) -> list[EstadoDiario]:
        query = (
            self.db.query(EstadoDiario)
            .join(EstadoDiario.estado_diario_origen)
            .options(joinedload(EstadoDiario.jurisdiccion))
            .filter(EstadoDiario.estado_diario_origen_id == origen_id)
        )
        return self._filtrar_por_jurisdiccion(query, jurisdicciones).all()

    @classmethod
    def _aplicar_filtros_comunes(
        cls,
        query,
        jurisdiccion_id: Optional[int],
        fecha_desde: Optional[str],
        fecha_hasta: Optional[str],
        rut: Optional[str],
        status_filter: Optional[str],
        jurisdicciones: Optional[list[int]],
    ):
        # Permiso de visibilidad. Va primero porque es la restricción que no
        # puede faltar nunca; los demás filtros son opcionales del usuario.
        # `jurisdiccion_id` (singular) es otra cosa: el filtro que la persona
        # elige en pantalla, dentro de lo que ya tiene permitido.
        query = cls._filtrar_por_jurisdiccion(query, jurisdicciones)

        if status_filter == "resuelto":
            query = query.filter(EstadoDiario.leido == True)
        elif status_filter == "pendiente":
            # Resuelto gana sobre pendiente: al marcarlo leído (desde la app o
            # desde el botón "Resuelto" del WhatsApp) sale de esta pestaña. La
            # marca `pendiente` no se borra, para conservar el nivel y quién lo
            # dejó pendiente en el detalle y en el historial.
            query = query.filter(EstadoDiario.pendiente == True, EstadoDiario.leido == False)
        else:
            # No leídos: ni resuelto ni marcado pendiente (ver requerimiento
            # de que un pendiente deje de listarse como no leído).
            query = query.filter(EstadoDiario.leido == False, EstadoDiario.pendiente == False)

        if jurisdiccion_id:
            query = query.filter(EstadoDiario.jurisdiccion_id == jurisdiccion_id)

        if fecha_desde:
            query = query.filter(EstadoDiarioOrigen.fecha >= fecha_desde)
        if fecha_hasta:
            query = query.filter(EstadoDiarioOrigen.fecha <= fecha_hasta)

        if rut:
            query = query.filter(EstadoDiarioOrigen.rut == rut)

        return query

    def _build_filtered_query(
        self,
        jurisdicciones: Optional[list[int]],
        jurisdiccion_id: Optional[int] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
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
        return self._aplicar_filtros_comunes(
            query, jurisdiccion_id, fecha_desde, fecha_hasta, rut, status_filter, jurisdicciones
        )

    def count_filtered(
        self,
        jurisdicciones: Optional[list[int]],
        jurisdiccion_id: Optional[int] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        rut: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> int:
        query = (
            self.db.query(func.count(EstadoDiario.id))
            .join(EstadoDiario.estado_diario_origen)
        )
        query = self._aplicar_filtros_comunes(
            query, jurisdiccion_id, fecha_desde, fecha_hasta, rut, status_filter, jurisdicciones
        )
        return query.scalar()

    def find_filtered(
        self,
        jurisdicciones: Optional[list[int]],
        jurisdiccion_id: Optional[int] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        rut: Optional[str] = None,
        status_filter: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        query = self._build_filtered_query(
            jurisdicciones, jurisdiccion_id, fecha_desde, fecha_hasta, rut, status_filter
        )
        total = self.count_filtered(
            jurisdicciones, jurisdiccion_id, fecha_desde, fecha_hasta, rut, status_filter
        )

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
