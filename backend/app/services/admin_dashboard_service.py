"""Dashboard de la consola de administración.

Los datos operativos están repartidos: uno por base de cliente. No hay forma de
resolver esto con un solo SELECT —son bases distintas— así que se consulta una
vez por cliente y se junta en Python.

Lo que sí se respeta es que **cada consulta agregue en SQL**: por cliente se
hace UNA consulta que devuelve tres números (última importación, movimientos
del período, usuarios activos). Traer las filas para contarlas acá sería, con
cincuenta clientes, arrastrar el sistema entero al backend.

El orden de la tabla es por *tiempo sin recibir archivos*, de mayor a menor: la
pregunta que responde esta pantalla es "¿a quién se le cortó la llegada de
estados diarios?", y el que nunca recibió nada va primero.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import sesion_tenant
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.schemas.cliente import (
    AdminDashboard,
    ClienteActividad,
    ClienteConProblema,
    DashboardKpis,
)
from app.services.cliente_service import ClienteService

logger = logging.getLogger(__name__)

# Umbral a partir del cual un cliente cuenta como "sin recibir archivos". Una
# semana: los reportes del PJUD llegan a diario hábil, así que siete días sin
# nada es una caída, no una racha mala.
UMBRAL_SIN_IMPORTAR = 7

# Una sola consulta por cliente, todo agregado en la base. Los valores van como
# subconsultas escalares y no con FILTER (...) porque producción corre
# PostgreSQL 9.2, donde FILTER todavía no existe (llegó en 9.4).
#
# `movimientos_periodo` suma las dos tablas que alimenta la importación: las
# filas del estado diario y las del reporte de movimientos. Se fecha por la
# carga del archivo que las trajo, que es cuando entraron al sistema.
_SQL_RESUMEN_TENANT = text(
    """
    SELECT
        (SELECT MAX(fecha_carga) FROM estado_diario_origen) AS ultima_importacion,
        (SELECT COUNT(*) FROM estado_diario ed
           JOIN estado_diario_origen o ON o.id = ed.estado_diario_origen_id
          WHERE o.fecha_carga >= :corte)
        + (SELECT COUNT(*) FROM movimiento m
             JOIN estado_diario_origen o2 ON o2.id = m.estado_diario_origen_id
            WHERE o2.fecha_carga >= :corte) AS movimientos_periodo,
        (SELECT COUNT(*) FROM usuario WHERE activo) AS usuarios_activos
    """
)


def orden_por_abandono(item: ClienteActividad) -> tuple[int, int]:
    """Clave de orden de la tabla del dashboard.

    Grupo 0 = nunca importó nada (lo más grave, va arriba de todo); grupo 1 =
    el resto, del que lleva más días sin novedades al que está al día. El orden
    ES la funcionalidad de esa tabla, por eso vive en una función con nombre y
    no escondido en un lambda.
    """
    return (
        0 if item.dias_sin_importar is None else 1,
        -(item.dias_sin_importar or 0),
    )


class AdminDashboardService:
    def __init__(self, db_maestra: Session):
        self.clientes = ClienteRepository(db_maestra)
        self.servicio = ClienteService(db_maestra)

    def resumen(self, dias: int) -> AdminDashboard:
        ahora = datetime.now(timezone.utc)
        corte = ahora - timedelta(days=dias)

        items: list[ClienteActividad] = []
        con_error: list[ClienteConProblema] = []
        en_curso = 0

        for cliente in self.clientes.find_all():
            if cliente.estado_aprovisionamiento == Cliente.APROV_ERROR:
                con_error.append(
                    ClienteConProblema(
                        id=cliente.cliente_id,
                        nombre=cliente.nombre,
                        detalle=cliente.error_aprovisionamiento,
                    )
                )
            elif cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
                en_curso += 1

            items.append(self._fila(cliente, corte, ahora))

        items.sort(key=orden_por_abandono)

        return AdminDashboard(
            dias=dias,
            desde=corte.date(),
            hasta=ahora.date(),
            kpis=self._kpis(items),
            umbral_sin_importar=UMBRAL_SIN_IMPORTAR,
            aprovisionamientos_en_curso=en_curso,
            aprovisionamientos_con_error=con_error,
            clientes=items,
        )

    def _kpis(self, items: list[ClienteActividad]) -> DashboardKpis:
        activos = sum(1 for i in items if i.activo)
        return DashboardKpis(
            clientes_activos=activos,
            clientes_suspendidos=len(items) - activos,
            usuarios_habilitados=sum(i.total_usuarios for i in items),
            clientes_sin_importar=sum(
                1
                for i in items
                if i.activo
                and (
                    i.dias_sin_importar is None
                    or i.dias_sin_importar >= UMBRAL_SIN_IMPORTAR
                )
            ),
        )

    def _fila(self, cliente: Cliente, corte: datetime, ahora: datetime) -> ClienteActividad:
        fila = ClienteActividad(
            id=cliente.cliente_id,
            nombre=cliente.nombre,
            # Descifrado por la propiedad del modelo.
            rut=cliente.rut,
            inbox=self.servicio.inbox_por_defecto(cliente),
            total_usuarios=0,
            aprovisionamiento=cliente.estado_aprovisionamiento,
            ultima_importacion=None,
            dias_sin_importar=None,
            movimientos_periodo=0,
            activo=cliente.activo,
        )

        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            # Sin base terminada no hay nada que consultar, y preguntar sería
            # un error de conexión disfrazado de dato.
            return fila

        try:
            with sesion_tenant(cliente.guid) as db:
                resultado = db.execute(_SQL_RESUMEN_TENANT, {"corte": corte}).first()
        except Exception as e:
            # Una base caída no puede tumbar el dashboard entero: el cliente
            # igual aparece en la tabla, sin sus números.
            logger.warning("No se pudo consultar la base del cliente %s: %s", cliente.guid, e)
            return fila

        if resultado is None:
            return fila

        ultima, movimientos, usuarios = resultado
        fila.movimientos_periodo = movimientos or 0
        fila.total_usuarios = usuarios or 0
        if ultima is not None:
            # La columna es timestamptz; si el driver la devolviera sin zona,
            # restarle un datetime con zona reventaría.
            if ultima.tzinfo is None:
                ultima = ultima.replace(tzinfo=timezone.utc)
            fila.ultima_importacion = ultima
            fila.dias_sin_importar = max((ahora - ultima).days, 0)
        return fila
