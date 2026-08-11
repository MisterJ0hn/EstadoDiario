"""Migración one-shot: de cierres + órdenes por rango a facturas mensuales.

Uso:
    python -m app.jobs.migrar_facturas_mensuales --simular   # muestra qué haría
    python -m app.jobs.migrar_facturas_mensuales

**Qué cambió.** Antes había dos cosas: `facturacion_cierre`, una fila por
cliente y mes con el cálculo congelado, y `factura`, un documento que cubría un
rango de fechas y sumaba los cierres de adentro. Ahora la factura **es**
mensual: una por cliente y período, con su detalle por concepto.

**Qué hace este job**, en este orden:

1. A cada `factura` que existía por rango le pone `periodo`. Si el rango cubría
   un solo mes, ese; si cubría varios, el primero, y se avisa: una factura de
   tres meses no se puede partir en tres sin inventar números de correlativo.
2. Le arma el detalle desde `factura_linea`, convirtiendo las tres columnas
   fijas (materia / apelaciones / suprema) en filas de `factura_detalle`.
3. Convierte en facturas los `facturacion_cierre` que **no** hayan quedado
   cubiertos por una factura: son meses calculados que nunca se documentaron y
   son, en la práctica, casi todos.

**El detalle migrado no tiene desglose por materia y no puede tenerlo.** El
cierre viejo guardaba un solo número para todas las materias juntas, y el
archivo de causas de ese mes ya no está en la base del cliente. Las facturas
migradas quedan con una línea "Causas por materia"; el desglose por Familia,
Civil y compañía empieza con las que genere `app.jobs.generar_facturacion`.

Es **idempotente**: lo ya migrado se salta. Se puede correr las veces que haga
falta.

Las tablas viejas **no se borran**. Cuando el resultado esté revisado, se
agregan a `TABLAS_A_BORRAR_MAESTRA` en `app/core/esquema.py` y las elimina el
siguiente arranque.
"""

import argparse
import logging
import sys
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SesionMaestra
from app.core.esquema import tabla_existe
from app.core.logging_config import setup_logging
from app.models.maestra.factura import Factura, FacturaDetalle
from app.repositories.cliente_repository import ClienteRepository
from app.services.facturacion_service import NOMBRE_CORTE, datos_pdf, fin_de_mes
from app.services import factura_pdf

logger = logging.getLogger(__name__)

# Cómo se llama en el detalle migrado el bulto de causas por materia. Se
# distingue a propósito de las líneas nuevas —que llevan el nombre de la materia
# real— para que nadie lea "Civil: 0" donde lo que pasa es que no se sabe.
CONCEPTO_MATERIA_AGREGADA = "Causas por materia"


def _mes(valor: date) -> date:
    return valor.replace(day=1)


class Migracion:
    def __init__(self, db: Session, simular: bool):
        self.db = db
        self.simular = simular
        self.facturas_con_periodo = 0
        self.detalles_creados = 0
        self.cierres_convertidos = 0
        self.rangos_multimes: list[str] = []
        self.omitidos = 0

    # ── Paso 1 y 2: las facturas por rango que ya existían ──

    def migrar_facturas_existentes(self) -> None:
        pendientes = (
            self.db.query(Factura).filter(Factura.periodo.is_(None)).all()
        )
        if not pendientes:
            logger.info("No hay facturas por rango pendientes de migrar.")
            return

        tiene_lineas = tabla_existe(self.db.connection(), "factura_linea")
        for factura in pendientes:
            meses = self._meses_de(factura)
            factura.periodo = meses[0]
            self.facturas_con_periodo += 1
            if len(meses) > 1:
                # No se parte en varias: cada una necesitaría su propio número
                # del correlativo y ese número nunca se emitió. Queda como una
                # factura del primer mes, con el total completo y avisado.
                self.rangos_multimes.append(
                    f"{factura.numero_formateado} ({factura.razon_social}): "
                    f"{len(meses)} meses, se le asigna {meses[0]:%Y-%m}"
                )

            if tiene_lineas and not factura.detalles:
                self._detalle_desde_lineas(factura)

        if not self.simular:
            self.db.commit()

    def _meses_de(self, factura: Factura) -> list[date]:
        actual = _mes(factura.fecha_desde)
        fin = _mes(factura.fecha_hasta)
        meses = []
        while actual <= fin:
            meses.append(actual)
            actual = (
                date(actual.year + 1, 1, 1)
                if actual.month == 12
                else date(actual.year, actual.month + 1, 1)
            )
        return meses or [_mes(factura.fecha_desde)]

    def _detalle_desde_lineas(self, factura: Factura) -> None:
        """Suma las líneas mensuales de la orden en tres conceptos.

        Se suman porque una orden de tres meses pasa a ser una sola factura: dos
        líneas "Corte Suprema" en el mismo documento no las entendería nadie.
        """
        filas = self.db.execute(
            text(
                "SELECT causas_materia, cortes_apelaciones, cortes_suprema, "
                "       tarifa_materia, tarifa_apelaciones, tarifa_suprema "
                "  FROM factura_linea WHERE factura_id = :id"
            ),
            {"id": factura.id},
        ).fetchall()
        if not filas:
            return

        # (cantidad, valor_unitario) por concepto. La tarifa es la de la primera
        # línea: dentro de una misma orden no cambiaba.
        acumulado = {
            CONCEPTO_MATERIA_AGREGADA: [0, Decimal(filas[0][3] or 0), FacturaDetalle.TIPO_MATERIA],
            NOMBRE_CORTE["apelaciones"]: [0, Decimal(filas[0][4] or 0), FacturaDetalle.TIPO_CORTE],
            NOMBRE_CORTE["suprema"]: [0, Decimal(filas[0][5] or 0), FacturaDetalle.TIPO_CORTE],
        }
        for materia, apelaciones, suprema, _, _, _ in filas:
            acumulado[CONCEPTO_MATERIA_AGREGADA][0] += int(materia or 0)
            acumulado[NOMBRE_CORTE["apelaciones"]][0] += int(apelaciones or 0)
            acumulado[NOMBRE_CORTE["suprema"]][0] += int(suprema or 0)

        self._agregar_detalle(factura, acumulado)

    # ── Paso 3: los cierres que nunca se documentaron ──

    def migrar_cierres(self) -> None:
        if not tabla_existe(self.db.connection(), "facturacion_cierre"):
            logger.info("No existe la tabla facturacion_cierre: nada que convertir.")
            return

        # Raw SQL: el modelo ya no existe, y este job tiene que poder correr
        # sobre una base cuyo esquema viejo el código ya no describe.
        cierres = self.db.execute(
            text(
                "SELECT cliente_id, periodo, causas_materia, cortes_apelaciones, "
                "       cortes_suprema, tarifa_materia, tarifa_apelaciones, "
                "       tarifa_suprema, monto, fecha_cierre, origen_causas_id, "
                "       fecha_archivo_causas, estado, detalle "
                "  FROM facturacion_cierre ORDER BY periodo, cliente_id"
            )
        ).fetchall()
        if not cierres:
            logger.info("No hay cierres que convertir.")
            return

        ya_facturado = {
            (f.cliente_id, f.periodo)
            for f in self.db.query(Factura).filter(Factura.periodo.isnot(None)).all()
        }
        clientes = {c.cliente_id: c for c in ClienteRepository(self.db).find_all()}

        for fila in cierres:
            (cliente_id, periodo, materia, apelaciones, suprema, t_materia,
             t_apelaciones, t_suprema, monto, fecha_cierre, origen_id,
             fecha_archivo, estado, detalle) = fila
            periodo = _mes(periodo)

            if (cliente_id, periodo) in ya_facturado:
                self.omitidos += 1
                continue

            cliente = clientes.get(cliente_id)
            if cliente is None:
                logger.warning(
                    "Cierre de %s sin cliente en la tabla: se omite", periodo
                )
                self.omitidos += 1
                continue

            factura = Factura(
                numero=self._siguiente_numero(),
                cliente_id=cliente_id,
                periodo=periodo,
                fecha_desde=periodo,
                fecha_hasta=fin_de_mes(periodo),
                # La fecha del cierre, no la de hoy: es cuando se calculó y es lo
                # que hace que el historial migrado siga siendo cronológico.
                fecha_emision=fecha_cierre or datetime.now(timezone.utc),
                estado=Factura.ESTADO_EMITIDA,
                emitida_por="migración",
                razon_social=cliente.nombre,
                rut=cliente.rut,
                giro=cliente.giro,
                direccion=cliente.direccion,
                comuna=cliente.comuna,
                ciudad=cliente.ciudad,
                correo=cliente.correo,
                origen_estado=estado or Factura.ORIGEN_OK,
                origen_detalle=detalle,
                origen_causas_id=origen_id,
                fecha_archivo_causas=fecha_archivo,
                total=Decimal(monto or 0),
            )
            self._agregar_detalle(
                factura,
                {
                    CONCEPTO_MATERIA_AGREGADA: [
                        int(materia or 0), Decimal(t_materia or 0), FacturaDetalle.TIPO_MATERIA
                    ],
                    NOMBRE_CORTE["apelaciones"]: [
                        int(apelaciones or 0), Decimal(t_apelaciones or 0), FacturaDetalle.TIPO_CORTE
                    ],
                    NOMBRE_CORTE["suprema"]: [
                        int(suprema or 0), Decimal(t_suprema or 0), FacturaDetalle.TIPO_CORTE
                    ],
                },
            )
            factura.pdf = factura_pdf.generar(datos_pdf(factura))
            factura.pdf_nombre = f"factura-{factura.numero_formateado}.pdf"

            if not self.simular:
                self.db.add(factura)
                self.db.commit()
            ya_facturado.add((cliente_id, periodo))
            self.cierres_convertidos += 1

    # ── Apoyo ─────────────────────────────────────────────

    def _agregar_detalle(self, factura: Factura, acumulado: dict) -> None:
        """Crea las líneas del detalle, saltando las que van en cero.

        Una línea "Corte Suprema: 0" en una factura es ruido: lo que no se cobró
        no se imprime.
        """
        for orden, (concepto, (cantidad, valor, tipo)) in enumerate(acumulado.items()):
            if cantidad <= 0:
                continue
            factura.detalles.append(
                FacturaDetalle(
                    tipo=tipo,
                    concepto=concepto,
                    cantidad=cantidad,
                    valor_unitario=valor,
                    valor_total=valor * cantidad,
                    orden=orden,
                )
            )
            self.detalles_creados += 1

    def _siguiente_numero(self) -> int:
        maximo = self.db.execute(
            text("SELECT COALESCE(MAX(numero), 0) FROM factura")
        ).scalar()
        # En simulación nada se escribe, así que el MAX no avanza: se lleva la
        # cuenta a mano para que el informe no muestre veinte veces el mismo
        # número y parezca que van a chocar.
        if self.simular:
            return int(maximo or 0) + 1 + self.cierres_convertidos
        return int(maximo or 0) + 1

    def informe(self) -> None:
        modo = "SIMULACIÓN (no se escribió nada)" if self.simular else "aplicada"
        logger.info("Migración %s", modo)
        logger.info("  facturas por rango con período asignado: %d", self.facturas_con_periodo)
        logger.info("  cierres convertidos en factura: %d", self.cierres_convertidos)
        logger.info("  líneas de detalle creadas: %d", self.detalles_creados)
        logger.info("  cierres omitidos (ya facturados o sin cliente): %d", self.omitidos)
        for aviso in self.rangos_multimes:
            logger.warning("  rango de varios meses: %s", aviso)
        if self.rangos_multimes:
            logger.warning(
                "  Revise esas facturas a mano: cubren más de un mes y no se "
                "pueden partir sin inventar números de correlativo."
            )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Migra cierres y órdenes por rango a facturas mensuales"
    )
    parser.add_argument(
        "--simular",
        action="store_true",
        help="Informa qué haría sin escribir nada en la base.",
    )
    args = parser.parse_args(argv)

    setup_logging()
    db = SesionMaestra()
    migracion = Migracion(db, args.simular)
    try:
        migracion.migrar_facturas_existentes()
        migracion.migrar_cierres()
        if args.simular:
            db.rollback()
    except Exception:
        db.rollback()
        logger.exception("La migración falló y no se aplicó nada de lo pendiente")
        return 1
    finally:
        migracion.informe()
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
