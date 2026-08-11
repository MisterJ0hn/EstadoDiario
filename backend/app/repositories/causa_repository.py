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

from app.core.estados_causa import ESTADOS_FINALIZADOS
from app.models.causa import Causa
from app.models.estado_diario_origen import EstadoDiarioOrigen

# Valores del parámetro `vigencia` de las consultas de cartera.
VIGENTES = "vigentes"
FINALIZADAS = "finalizadas"


def ultimo_origen_causas_id(db: Session) -> Optional[int]:
    """El archivo de causas más reciente, que ES la cartera de hoy.

    **El Excel de Causas trae la cartera completa, no las novedades.** Cada
    carga inserta otra vez todas las causas del estudio con su propio origen,
    así que sumar las filas de todos los archivos multiplica la cartera por la
    cantidad de veces que se cargó el reporte.

    Se ordena por `fecha` —la del reporte, no la de carga— porque es la que
    dice a qué día corresponde la foto; `id` desempata cuando el mismo día se
    cargó más de una vez.

    Vive suelta y no en la clase porque la usan los dos repositorios de la
    cartera —el de materia y el de corte— y las dos hojas salen del MISMO
    archivo: si cada uno eligiera el suyo, la pantalla de Corte podría estar
    mostrando un reporte distinto que la de Materia.
    """
    fila = (
        db.query(EstadoDiarioOrigen.id)
        .filter(EstadoDiarioOrigen.tipo == EstadoDiarioOrigen.TIPO_CAUSAS)
        .order_by(EstadoDiarioOrigen.fecha.desc(), EstadoDiarioOrigen.id.desc())
        .first()
    )
    return fila[0] if fila else None


class CausaRepository:
    def __init__(self, db: Session):
        self.db = db

    def ultimo_origen_id(self) -> Optional[int]:
        return ultimo_origen_causas_id(self.db)

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

    @staticmethod
    def _condicion_vigencia(vigencia: Optional[str]):
        """Condición de vigencia sobre `Causa.estado_causa`, o None.

        El estado nulo cuenta como VIGENTE y por eso el `is_(None)` explícito:
        la hoja de Cobranza no trae la columna, y en SQL un `NOT IN` contra
        NULL no es verdadero sino NULL, así que sin esta rama Cobranza no
        aparecería en ninguno de los dos lados del filtro.
        """
        # `func.lower(func.btrim(...))`: el Excel del PJUD rellena la celda con
        # espacios a la derecha ('Concluido                     ').
        normalizado = func.lower(func.btrim(Causa.estado_causa))
        if vigencia == VIGENTES:
            return or_(
                Causa.estado_causa.is_(None),
                normalizado.notin_(ESTADOS_FINALIZADOS),
            )
        if vigencia == FINALIZADAS:
            return normalizado.in_(ESTADOS_FINALIZADOS)
        return None

    @classmethod
    def _aplicar_filtros(
        cls,
        query,
        materia: Optional[str],
        estado_causa: Optional[str],
        tribunal: Optional[str],
        busqueda: Optional[str],
        origen_id: Optional[int],
        vigencia: Optional[str] = None,
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
        condicion = cls._condicion_vigencia(vigencia)
        if condicion is not None:
            query = query.filter(condicion)
        return query

    def _acotar_a_la_cartera(self, origen_id: Optional[int]) -> Optional[int]:
        """El origen por el que hay que filtrar: el pedido, o el último.

        Sin origen explícito se muestra SOLO el archivo más reciente, que es la
        cartera vigente. Con origen explícito manda ese: es el caso de llegar
        desde Bitácora a ver qué trajo un archivo concreto, incluido uno viejo.

        Devuelve `-1` cuando no hay ningún archivo de causas cargado, para que
        la consulta no encuentre nada en vez de devolver la tabla entera.
        """
        if origen_id:
            return origen_id
        return self.ultimo_origen_id() or -1

    def find_filtered(
        self,
        materia: Optional[str] = None,
        estado_causa: Optional[str] = None,
        tribunal: Optional[str] = None,
        busqueda: Optional[str] = None,
        origen_id: Optional[int] = None,
        vigencia: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        origen_id = self._acotar_a_la_cartera(origen_id)
        base = self._aplicar_filtros(
            self.db.query(Causa),
            materia, estado_causa, tribunal, busqueda, origen_id, vigencia,
        )
        total = (
            self._aplicar_filtros(
                self.db.query(func.count(Causa.id)),
                materia, estado_causa, tribunal, busqueda, origen_id, vigencia,
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
        vigencia: Optional[str] = None,
    ) -> list[tuple[Optional[str], int]]:
        """(materia, total) para las pestañas del listado.

        Respeta los filtros activos MENOS el de materia: los contadores tienen
        que decir cuánto hay en cada pestaña bajo el filtro actual, no cuánto
        hay en la pestaña que ya se está mirando. La vigencia sí entra: es un
        interruptor de toda la pantalla, no una pestaña.
        """
        query = self._aplicar_filtros(
            self.db.query(Causa.materia, func.count(Causa.id)),
            None, estado_causa, tribunal, busqueda,
            self._acotar_a_la_cartera(origen_id), vigencia,
        )
        return [
            (fila[0], int(fila[1] or 0))
            for fila in query.group_by(Causa.materia).order_by(Causa.materia).all()
        ]

    def listar_estados_causa(self, origen_id: Optional[int] = None) -> list[str]:
        """Estados presentes en la cartera, para el combo del filtro.

        Acotado al mismo archivo que el listado: ofrecer un estado que ya no
        existe en la cartera actual es un filtro que solo puede dar cero.
        """
        query = (
            self.db.query(Causa.estado_causa)
            .filter(Causa.estado_causa.isnot(None))
            .filter(Causa.estado_diario_origen_id == self._acotar_a_la_cartera(origen_id))
        )
        return sorted({fila[0].strip() for fila in query.distinct().all() if fila[0]})

    def contar_activas(self) -> int:
        """Causas por materia vigentes en la cartera actual.

        Es el número que la consola muestra por cliente y el que se factura a
        1 peso. Cuenta en SQL: traer las filas para contarlas en Python, con
        una cartera de 9.000 causas, es arrastrar la base entera al backend.
        """
        return (
            self._aplicar_filtros(
                self.db.query(func.count(Causa.id)),
                None, None, None, None, self._acotar_a_la_cartera(None), VIGENTES,
            ).scalar()
            or 0
        )
