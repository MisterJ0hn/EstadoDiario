from typing import Optional
import math

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audiencia import Audiencia
from app.models.causa import Causa
from app.models.causa_corte import CausaCorte
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_corte import EstadoDiarioCorte
from app.models.movimiento import Movimiento
from app.models.movimiento_corte import MovimientoCorte


class EstadoDiarioOrigenRepository:
    """Archivos recibidos, de los dos tipos (ver `EstadoDiarioOrigen.tipo`).

    **Los archivos son del estudio, no de una persona.** Acá no hay filtro de
    visibilidad: con una sola casilla de ingesta por estudio, todo lo que llega
    queda a nombre del mismo usuario, y esconder el archivo dejaría al resto
    sin poder ver siquiera si el estado diario del día llegó. Lo que se acota
    por jurisdicción es su CONTENIDO, al abrirlo (ver EstadoDiarioRepository).

    `usuario_carga_id` sobrevive como dato de auditoría —quién lo subió— y se
    muestra en el listado, pero ya no decide quién lo ve.
    """

    def __init__(self, db: Session):
        self.db = db

    def find_all_paginated(
        self,
        tipo: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ):
        total_query = self.db.query(func.count(EstadoDiarioOrigen.id))
        items_query = self.db.query(EstadoDiarioOrigen)

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

    def find_by_id(self, oid: int) -> Optional[EstadoDiarioOrigen]:
        return (
            self.db.query(EstadoDiarioOrigen)
            .filter(EstadoDiarioOrigen.id == oid)
            .first()
        )

    def find_by_rut_fecha(
        self,
        rut: str,
        fecha,
        tipo: str = EstadoDiarioOrigen.TIPO_ESTADO_DIARIO,
    ) -> Optional[EstadoDiarioOrigen]:
        """Detección de duplicados: (rut, fecha, tipo) dentro del estudio.

        La unicidad dejó de ser por dueño. La base ya es de un solo estudio y
        la casilla de ingesta es una: el mismo RUT y fecha entrando dos veces
        es el mismo archivo repetido, sin importar quién lo suba. Mantener el
        criterio viejo permitiría duplicar todo un estado diario subiéndolo
        desde otra cuenta del mismo estudio.

        El `tipo` sí distingue: el estado diario y el reporte de movimientos
        del mismo RUT y fecha son archivos distintos.
        """
        return (
            self.db.query(EstadoDiarioOrigen)
            .filter(
                EstadoDiarioOrigen.rut == rut,
                EstadoDiarioOrigen.fecha == fecha,
                EstadoDiarioOrigen.tipo == tipo,
            )
            .first()
        )

    def create(self, origen: EstadoDiarioOrigen) -> EstadoDiarioOrigen:
        self.db.add(origen)
        self.db.commit()
        self.db.refresh(origen)
        return origen

    def delete(self, origen: EstadoDiarioOrigen) -> None:
        self.db.delete(origen)
        self.db.commit()

    # Qué tablas alimenta cada tipo de archivo. Son DOS por tipo y no una: el
    # Excel del PJUD trae las hojas por materia y además las de corte, y cada
    # grupo va a su propia tabla porque no comparten columnas.
    TABLAS_POR_TIPO = {
        EstadoDiarioOrigen.TIPO_ESTADO_DIARIO: (EstadoDiario, EstadoDiarioCorte),
        EstadoDiarioOrigen.TIPO_MOVIMIENTOS: (Movimiento, MovimientoCorte),
        EstadoDiarioOrigen.TIPO_CAUSAS: (Causa, CausaCorte),
        EstadoDiarioOrigen.TIPO_AUDIENCIAS: (Audiencia,),
    }

    def count_registros(self, origen: EstadoDiarioOrigen) -> int:
        """Cuántas filas trajo el archivo, **materia más corte**.

        Contar solo la tabla de materia dejaba la columna de Bitácora diciendo
        menos de lo que el archivo traía: un estado diario con 40 movimientos y
        12 causas de corte se veía como 40, y quien buscaba las 12 concluía que
        no habían entrado.

        Las audiencias se deduplican entre cargas traslapadas y su
        `estado_diario_origen_id` apunta al ÚLTIMO archivo que las trajo: el
        número de un archivo viejo baja cuando llega uno nuevo que repite esas
        audiencias. Es correcto y a la vez sorprendente, así que conviene
        saberlo antes de salir a buscar el "error".
        """
        tablas = self.TABLAS_POR_TIPO.get(origen.tipo)
        if not tablas:
            return 0
        total = 0
        for modelo in tablas:
            total += (
                self.db.query(func.count(modelo.id))
                .filter(modelo.estado_diario_origen_id == origen.id)
                .scalar()
                or 0
            )
        return total
