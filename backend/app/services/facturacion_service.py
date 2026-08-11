"""Facturación de la plataforma: cuánto se le cobra a cada cliente y cuándo.

**La regla.** Se factura por cantidad de causas de la cartera vigente:

| Qué                  | Precio por causa |
|----------------------|------------------|
| Materia (Civil, Laboral, Penal, Cobranza, Familia) | $1 |
| Corte de Apelaciones | $2 |
| Corte Suprema        | $3 |

Las de materia se cuentan **solo si están vigentes** (ver
`app.core.estados_causa`); las de corte se cuentan todas. No es un descuido:
"Fallada" en una corte dice que se falló ese recurso, no que la causa salió de
la cartera del estudio, y el reporte deja de traerla cuando eso pasa.

**El cierre es el día 1 y se guarda.** La cartera es una foto que se reemplaza
con cada carga del Excel de Causas: la de marzo no se puede reconstruir en
junio, porque ese archivo ya no está en la base. Por eso el día 1 se cuenta una
vez, se calcula el monto y se escribe una fila por cliente
(`FacturacionCierre`); lo que se factura después sale de ahí y no de volver a
contar. Una factura emitida no puede cambiar de monto porque el estudio cerró
tres causas.

El cierre del día 1 factura **el mes que terminó**: correr el job el 1 de
agosto crea el período `2026-07-01`.

Los datos están repartidos —uno por base de cliente— así que se consulta una
vez por cliente y se junta acá. Cada consulta agrega en SQL: con una cartera de
9.000 causas, traer las filas para contarlas en Python sería arrastrar la base
entera al backend.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import sesion_tenant
from app.core.estados_causa import sql_vigente
from app.models.maestra.cliente import Cliente
from app.models.maestra.facturacion_cierre import FacturacionCierre
from app.repositories.cliente_repository import ClienteRepository

logger = logging.getLogger(__name__)

# Precio por causa, en pesos. Van acá y no en la base porque son parte del
# contrato comercial y no una preferencia que se cambie desde una pantalla:
# cambiarlas es un despliegue, deliberadamente. Cada cierre guarda las que
# estaban vigentes, así que subirlas no reescribe las facturas anteriores.
TARIFA_MATERIA = 1
TARIFA_APELACIONES = 2
TARIFA_SUPREMA = 3

# Una sola consulta por cliente, todo agregado en la base: se piden cinco
# números, no las filas para contarlas acá.
#
# El `WITH ultimo` resuelve una vez cuál es el archivo de causas vigente. El
# reporte trae la cartera completa cada vez, así que sin acotar a un solo
# origen se facturaría la misma causa tantas veces como se haya cargado el
# Excel — el error más caro posible en este módulo.
#
# Nada de `FILTER (...)` ni de `IF NOT EXISTS`: producción corre PostgreSQL
# 9.2 y esa sintaxis llegó en 9.4.
_SQL_CARTERA = text(
    f"""
    WITH ultimo AS (
        SELECT id, fecha
          FROM estado_diario_origen
         WHERE tipo = 'causas'
         ORDER BY fecha DESC, id DESC
         LIMIT 1
    )
    SELECT
        (SELECT id FROM ultimo)     AS origen_id,
        (SELECT fecha FROM ultimo)  AS fecha_archivo,
        (SELECT COUNT(*) FROM causa
          WHERE estado_diario_origen_id = (SELECT id FROM ultimo)
            AND {sql_vigente('estado_causa')})                       AS materia,
        (SELECT COUNT(*) FROM causa_corte
          WHERE estado_diario_origen_id = (SELECT id FROM ultimo)
            AND tipo = 'apelaciones')                                AS apelaciones,
        (SELECT COUNT(*) FROM causa_corte
          WHERE estado_diario_origen_id = (SELECT id FROM ultimo)
            AND tipo = 'suprema')                                    AS suprema
    """
)


def periodo_de(momento: date) -> date:
    """El período que le toca cerrar a esa fecha: el MES ANTERIOR.

    Correr el cierre el 1 de agosto factura julio. Es lo que significa "cierre
    el 1 de cada mes": el mes ya terminó y por eso se puede cobrar.
    """
    ultimo_del_anterior = momento.replace(day=1) - timedelta(days=1)
    return ultimo_del_anterior.replace(day=1)


class ResumenCartera:
    """Lo que se contó en la base de un cliente, antes de ponerle precio."""

    def __init__(
        self,
        materia: int = 0,
        apelaciones: int = 0,
        suprema: int = 0,
        origen_id: Optional[int] = None,
        fecha_archivo: Optional[date] = None,
        estado: str = FacturacionCierre.ESTADO_OK,
        detalle: Optional[str] = None,
    ):
        self.materia = materia
        self.apelaciones = apelaciones
        self.suprema = suprema
        self.origen_id = origen_id
        self.fecha_archivo = fecha_archivo
        self.estado = estado
        self.detalle = detalle

    @property
    def monto(self) -> int:
        return (
            self.materia * TARIFA_MATERIA
            + self.apelaciones * TARIFA_APELACIONES
            + self.suprema * TARIFA_SUPREMA
        )


class FacturacionService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.clientes = ClienteRepository(db_maestra)

    # ── Conteo ────────────────────────────────────────────

    def contar_cartera(self, cliente: Cliente) -> ResumenCartera:
        """Cuenta la cartera vigente del cliente en SU base.

        Nunca lanza: un cliente con la base caída no puede impedir que se
        cierren los demás. Devuelve el resumen en cero con `estado=error` y el
        motivo, que es lo que distingue "este mes no tuvo causas" de "este mes
        no pudimos preguntarle" — dos cosas que no se facturan igual.
        """
        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            return ResumenCartera(
                estado=FacturacionCierre.ESTADO_SIN_DATOS,
                detalle="La base de datos del cliente no está lista",
            )

        try:
            with sesion_tenant(cliente.guid) as db:
                fila = db.execute(_SQL_CARTERA).first()
        except Exception as e:
            logger.warning(
                "No se pudo contar la cartera del cliente %s: %s", cliente.guid, e
            )
            return ResumenCartera(
                estado=FacturacionCierre.ESTADO_ERROR,
                detalle=str(e)[:500],
            )

        if fila is None or fila[0] is None:
            return ResumenCartera(
                estado=FacturacionCierre.ESTADO_SIN_DATOS,
                detalle="El cliente no tiene ningún archivo de causas cargado",
            )

        origen_id, fecha_archivo, materia, apelaciones, suprema = fila
        return ResumenCartera(
            materia=int(materia or 0),
            apelaciones=int(apelaciones or 0),
            suprema=int(suprema or 0),
            origen_id=origen_id,
            fecha_archivo=fecha_archivo,
        )

    # ── Cierre ────────────────────────────────────────────

    def cerrar_periodo(self, periodo: date, rehacer: bool = False) -> list[FacturacionCierre]:
        """Toma la foto del período para **todos** los clientes.

        Idempotente: un cliente que ya tiene cierre de ese período se salta, así
        que correr el job dos veces el día 1 no duplica ninguna factura. Con
        `rehacer` se sobrescribe, que es para el caso en que el cierre corrió
        con una base caída y hay que repetirlo el mismo día — no para
        recalcular un mes viejo, donde el archivo de causas ya es otro.
        """
        periodo = periodo.replace(day=1)
        existentes = {
            c.cliente_id: c
            for c in self.db.query(FacturacionCierre)
            .filter(FacturacionCierre.periodo == periodo)
            .all()
        }

        cierres: list[FacturacionCierre] = []
        for cliente in self.clientes.find_all():
            ya = existentes.get(cliente.cliente_id)
            if ya is not None and not rehacer:
                cierres.append(ya)
                continue

            resumen = self.contar_cartera(cliente)
            cierre = ya or FacturacionCierre(
                cliente_id=cliente.cliente_id, periodo=periodo
            )
            self._volcar(cierre, resumen)
            if ya is None:
                self.db.add(cierre)
            cierres.append(cierre)

        self.db.commit()
        logger.info(
            "Cierre de facturación %s: %d clientes, total $%s",
            periodo,
            len(cierres),
            sum(float(c.monto or 0) for c in cierres),
        )
        return cierres

    @staticmethod
    def _volcar(cierre: FacturacionCierre, resumen: ResumenCartera) -> None:
        cierre.causas_materia = resumen.materia
        cierre.cortes_apelaciones = resumen.apelaciones
        cierre.cortes_suprema = resumen.suprema
        cierre.tarifa_materia = TARIFA_MATERIA
        cierre.tarifa_apelaciones = TARIFA_APELACIONES
        cierre.tarifa_suprema = TARIFA_SUPREMA
        cierre.monto = resumen.monto
        cierre.origen_causas_id = resumen.origen_id
        cierre.fecha_archivo_causas = resumen.fecha_archivo
        cierre.estado = resumen.estado
        cierre.detalle = resumen.detalle
        cierre.fecha_cierre = datetime.now(timezone.utc)

    # ── Consulta ──────────────────────────────────────────

    def periodos(self) -> list[date]:
        """Períodos con cierre, del más nuevo al más viejo."""
        filas = (
            self.db.query(FacturacionCierre.periodo)
            .distinct()
            .order_by(FacturacionCierre.periodo.desc())
            .all()
        )
        return [f[0] for f in filas]

    def cierres_de(self, periodo: date) -> list[FacturacionCierre]:
        return (
            self.db.query(FacturacionCierre)
            .filter(FacturacionCierre.periodo == periodo.replace(day=1))
            .order_by(FacturacionCierre.monto.desc(), FacturacionCierre.cliente_id)
            .all()
        )
