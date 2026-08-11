"""Lectura de la facturación para la consola.

El cálculo y el cierre viven en `app.services.facturacion_service`, que además
usa el job del día 1. Acá solo se arma lo que la pantalla necesita: pegarle el
nombre y el RUT del cliente a cada cierre (que se guardan por `cliente_id`) y
sumar los totales del período.

**El período en curso se muestra como estimación.** Preguntar por un mes que
todavía no cerró es lo primero que hace cualquiera al abrir la pantalla, y
responder "no hay datos" haría parecer que el módulo está roto. Se cuenta al
momento y se marca `es_estimacion`: ese número puede cambiar hasta el cierre,
y decirlo es parte de la respuesta.
"""

import logging
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.maestra.cliente import Cliente
from app.models.maestra.facturacion_cierre import FacturacionCierre
from app.repositories.cliente_repository import ClienteRepository
from app.services.facturacion_service import (
    TARIFA_APELACIONES,
    TARIFA_MATERIA,
    TARIFA_SUPREMA,
    FacturacionService,
    periodo_de,
)
from admin_api.app.schemas.cliente import (
    FacturacionCierreResponse,
    FacturacionPeriodoResponse,
)

logger = logging.getLogger(__name__)


class FacturacionConsultaService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.facturacion = FacturacionService(db_maestra)
        self.clientes = ClienteRepository(db_maestra)

    def periodo(self, periodo: date | None) -> FacturacionPeriodoResponse:
        """El período pedido; por defecto, el último que tenga cierre.

        Si el que se pide no está cerrado, se estima contando ahora. Es la
        única forma de que la pantalla sirva para lo que se usa el otro 30 del
        mes: ver cuánto va a salir la factura antes de que salga.
        """
        disponibles = self.facturacion.periodos()
        elegido = (periodo.replace(day=1) if periodo else None) or (
            disponibles[0] if disponibles else periodo_de(date.today())
        )

        cierres = self.facturacion.cierres_de(elegido)
        if cierres:
            return self._armar(elegido, disponibles, cierres, es_estimacion=False)
        return self._estimar(elegido, disponibles)

    def cerrar(self, periodo: date | None, rehacer: bool) -> FacturacionPeriodoResponse:
        elegido = periodo.replace(day=1) if periodo else periodo_de(date.today())
        cierres = self.facturacion.cerrar_periodo(elegido, rehacer)
        logger.info("Período %s cerrado desde la consola", elegido)
        return self._armar(
            elegido, self.facturacion.periodos(), cierres, es_estimacion=False
        )

    # ── Armado ────────────────────────────────────────────

    def _estimar(
        self, periodo: date, disponibles: list[date]
    ) -> FacturacionPeriodoResponse:
        """Cuenta la cartera de cada cliente AHORA, sin escribir nada."""
        filas: list[FacturacionCierreResponse] = []
        for cliente in self.clientes.find_all():
            resumen = self.facturacion.contar_cartera(cliente)
            filas.append(
                FacturacionCierreResponse(
                    cliente_id=cliente.cliente_id,
                    cliente_nombre=cliente.nombre,
                    # Descifrado por la propiedad del modelo.
                    cliente_rut=cliente.rut,
                    periodo=periodo,
                    causas_materia=resumen.materia,
                    cortes_apelaciones=resumen.apelaciones,
                    cortes_suprema=resumen.suprema,
                    tarifa_materia=TARIFA_MATERIA,
                    tarifa_apelaciones=TARIFA_APELACIONES,
                    tarifa_suprema=TARIFA_SUPREMA,
                    monto=float(resumen.monto),
                    estado=resumen.estado,
                    detalle=resumen.detalle,
                    fecha_cierre=None,
                    fecha_archivo_causas=resumen.fecha_archivo,
                )
            )
        filas.sort(key=lambda f: (-f.monto, f.cliente_nombre.lower()))
        return self._totalizar(periodo, disponibles, filas, es_estimacion=True)

    def _armar(
        self,
        periodo: date,
        disponibles: list[date],
        cierres: list[FacturacionCierre],
        es_estimacion: bool,
    ) -> FacturacionPeriodoResponse:
        # Los clientes se leen de una vez y se indexan: un `find_by_id` por
        # cierre serían cincuenta consultas para pegar cincuenta nombres.
        por_id: dict[int, Cliente] = {
            c.cliente_id: c for c in self.clientes.find_all()
        }
        filas = [
            FacturacionCierreResponse(
                cliente_id=c.cliente_id,
                cliente_nombre=self._nombre(por_id.get(c.cliente_id)),
                cliente_rut=self._rut(por_id.get(c.cliente_id)),
                periodo=c.periodo,
                causas_materia=c.causas_materia or 0,
                cortes_apelaciones=c.cortes_apelaciones or 0,
                cortes_suprema=c.cortes_suprema or 0,
                tarifa_materia=c.tarifa_materia,
                tarifa_apelaciones=c.tarifa_apelaciones,
                tarifa_suprema=c.tarifa_suprema,
                monto=float(c.monto or 0),
                estado=c.estado,
                detalle=c.detalle,
                fecha_cierre=c.fecha_cierre,
                fecha_archivo_causas=c.fecha_archivo_causas,
            )
            for c in cierres
        ]
        return self._totalizar(periodo, disponibles, filas, es_estimacion)

    @staticmethod
    def _nombre(cliente: Cliente | None) -> str:
        # Un cierre cuyo cliente ya no está en la tabla igual se muestra: la
        # factura existió y el total del período tiene que cuadrar.
        return cliente.nombre if cliente else "(cliente eliminado)"

    @staticmethod
    def _rut(cliente: Cliente | None) -> str:
        return cliente.rut if cliente else "—"

    @staticmethod
    def _totalizar(
        periodo: date,
        disponibles: list[date],
        filas: list[FacturacionCierreResponse],
        es_estimacion: bool,
    ) -> FacturacionPeriodoResponse:
        return FacturacionPeriodoResponse(
            periodo=periodo,
            periodos_disponibles=disponibles,
            es_estimacion=es_estimacion,
            total_clientes=len(filas),
            total_causas_materia=sum(f.causas_materia for f in filas),
            total_cortes_apelaciones=sum(f.cortes_apelaciones for f in filas),
            total_cortes_suprema=sum(f.cortes_suprema for f in filas),
            total_monto=sum(f.monto for f in filas),
            clientes_con_error=sum(
                1 for f in filas if f.estado == FacturacionCierre.ESTADO_ERROR
            ),
            cierres=filas,
        )

    def detalle_cliente(self, cliente_id: int) -> list[FacturacionCierreResponse]:
        """Historial de un cliente, del período más nuevo al más viejo."""
        cliente = self.clientes.find_by_id(cliente_id)
        if not cliente:
            raise NotFoundException("Cliente no encontrado")

        cierres = (
            self.db.query(FacturacionCierre)
            .filter(FacturacionCierre.cliente_id == cliente_id)
            .order_by(FacturacionCierre.periodo.desc())
            .all()
        )
        return [
            FacturacionCierreResponse(
                cliente_id=c.cliente_id,
                cliente_nombre=cliente.nombre,
                cliente_rut=cliente.rut,
                periodo=c.periodo,
                causas_materia=c.causas_materia or 0,
                cortes_apelaciones=c.cortes_apelaciones or 0,
                cortes_suprema=c.cortes_suprema or 0,
                tarifa_materia=c.tarifa_materia,
                tarifa_apelaciones=c.tarifa_apelaciones,
                tarifa_suprema=c.tarifa_suprema,
                monto=float(c.monto or 0),
                estado=c.estado,
                detalle=c.detalle,
                fecha_cierre=c.fecha_cierre,
                fecha_archivo_causas=c.fecha_archivo_causas,
            )
            for c in cierres
        ]
