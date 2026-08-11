"""Lectura de la facturación para la consola.

El cálculo y la generación viven en `app.services.facturacion_service`, que
además usa el job del día 1. Acá solo se arma lo que la pantalla necesita:
pegarle a cada factura el nombre y el estado **actuales** del cliente —la
factura guarda la copia congelada, que es otra cosa— y totalizar.

**El período en curso se responde como estimación.** Preguntar cuánto va a salir
la factura antes de que exista es lo primero que hace cualquiera al abrir la
pantalla, y responder "no hay datos" haría parecer que el módulo está roto. Se
cuenta al momento, no se escribe nada y se dice que puede cambiar.
"""

import logging
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.maestra.cliente import Cliente
from app.models.maestra.factura import Factura
from app.repositories.cliente_repository import ClienteRepository
from app.services.factura_service import FacturaService, FiltroFacturas
from app.services.facturacion_service import FacturacionService, periodo_de
from app.services.tarifa_service import TarifaService

from admin_api.app.schemas.facturacion import (
    ClienteConErrorResponse,
    EstimacionClienteResponse,
    EstimacionLineaResponse,
    EstimacionPeriodoResponse,
    FacturaDetalleResponse,
    FacturaListResponse,
    FacturaResponse,
    GenerarPeriodoResponse,
    TarifaResponse,
    TarifasClienteResponse,
)

logger = logging.getLogger(__name__)


class FacturacionConsultaService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.facturas = FacturaService(db_maestra)
        self.facturacion = FacturacionService(db_maestra)
        self.tarifas = TarifaService(db_maestra)
        self.clientes = ClienteRepository(db_maestra)

    # ── Listado y detalle ─────────────────────────────────

    def listar(self, filtro: FiltroFacturas) -> FacturaListResponse:
        facturas = self.facturas.listar(filtro)
        por_id = self.facturas.clientes_por_id()
        filas = [self._a_response(f, por_id.get(f.cliente_id)) for f in facturas]
        return FacturaListResponse(
            total=len(filas),
            total_monto=self.facturas.total_cobrable(facturas),
            facturas=filas,
        )

    def obtener(self, factura_id: int) -> FacturaResponse:
        factura = self.facturas.obtener(factura_id)
        return self._a_response(factura, self.clientes.find_by_id(factura.cliente_id))

    def periodos(self) -> list[date]:
        return self.facturacion.periodos()

    @staticmethod
    def _a_response(factura: Factura, cliente: Cliente | None) -> FacturaResponse:
        return FacturaResponse(
            id=factura.id,
            numero=factura.numero_formateado,
            cliente_id=factura.cliente_id,
            # Una factura cuyo cliente ya no está en la tabla igual se muestra:
            # existió y el total del período tiene que cuadrar.
            cliente_nombre=cliente.nombre if cliente else "(cliente eliminado)",
            cliente_activo=bool(cliente.activo) if cliente else False,
            periodo=factura.periodo,
            fecha_emision=factura.fecha_emision,
            total=Decimal(factura.total or 0),
            estado=factura.estado or Factura.ESTADO_EMITIDA,
            razon_social=factura.razon_social,
            rut=factura.rut,
            giro=factura.giro,
            direccion=factura.direccion,
            comuna=factura.comuna,
            ciudad=factura.ciudad,
            correo=factura.correo,
            origen_estado=factura.origen_estado or Factura.ORIGEN_OK,
            origen_detalle=factura.origen_detalle,
            fecha_archivo_causas=factura.fecha_archivo_causas,
            emitida_por=factura.emitida_por,
            anulada=bool(factura.anulada),
            motivo_anulacion=factura.motivo_anulacion,
            detalles=[
                FacturaDetalleResponse(
                    id=d.id,
                    tipo=d.tipo,
                    concepto=d.concepto,
                    cantidad=d.cantidad or 0,
                    valor_unitario=Decimal(d.valor_unitario or 0),
                    valor_total=Decimal(d.valor_total or 0),
                )
                for d in factura.detalles
            ],
            total_causas=sum(d.cantidad or 0 for d in factura.detalles),
        )

    # ── Generación ────────────────────────────────────────

    def generar(
        self, periodo: date | None, rehacer: bool, generado_por: str
    ) -> GenerarPeriodoResponse:
        elegido = periodo.replace(day=1) if periodo else periodo_de(date.today())
        resultado = self.facturacion.generar_periodo(elegido, rehacer, generado_por)
        logger.info("Período %s facturado desde la consola por %s", elegido, generado_por)
        return GenerarPeriodoResponse(
            periodo=elegido,
            generadas=len(resultado.generadas),
            omitidas=len(resultado.omitidas),
            total_generado=resultado.total_generado,
            con_error=[
                ClienteConErrorResponse(
                    cliente_id=c.cliente_id, cliente_nombre=c.nombre, motivo=motivo
                )
                for c, motivo in resultado.con_error
            ],
        )

    # ── Estimación ────────────────────────────────────────

    def estimar(self, periodo: date | None) -> EstimacionPeriodoResponse:
        """Cuenta la cartera de cada cliente AHORA y le aplica sus tarifas.

        No escribe nada. El `periodo` que se recibe es solo la etiqueta que se
        devuelve: lo que se cuenta es la cartera de hoy, porque es la única que
        existe — el archivo del mes pasado ya fue reemplazado.
        """
        elegido = periodo.replace(day=1) if periodo else periodo_de(date.today())
        ya_generado = bool(
            self.db.query(Factura.id).filter(Factura.periodo == elegido).first()
        )

        filas: list[EstimacionClienteResponse] = []
        for cliente in self.clientes.find_all():
            resumen, lineas = self.facturacion.estimar(cliente)
            total = sum((l.valor_total for l in lineas), Decimal("0"))
            filas.append(
                EstimacionClienteResponse(
                    cliente_id=cliente.cliente_id,
                    cliente_nombre=cliente.nombre,
                    # Descifrado por la propiedad del modelo.
                    cliente_rut=cliente.rut,
                    cliente_activo=bool(cliente.activo),
                    total=total,
                    total_causas=resumen.total_causas,
                    origen_estado=resumen.estado,
                    origen_detalle=resumen.detalle,
                    fecha_archivo_causas=resumen.fecha_archivo,
                    detalles=[
                        EstimacionLineaResponse(
                            tipo=l.tipo,
                            concepto=l.concepto,
                            cantidad=l.cantidad,
                            valor_unitario=l.valor_unitario,
                            valor_total=l.valor_total,
                        )
                        for l in lineas
                    ],
                )
            )

        # Por monto y no alfabéticamente: la pantalla se abre para ver cuánto se
        # va a facturar, y el que más pesa va arriba.
        filas.sort(key=lambda f: (-f.total, f.cliente_nombre.lower()))
        return EstimacionPeriodoResponse(
            periodo=elegido,
            ya_generado=ya_generado,
            total_clientes=len(filas),
            total_monto=sum((f.total for f in filas), Decimal("0")),
            total_causas=sum(f.total_causas for f in filas),
            clientes_con_error=sum(
                1 for f in filas if f.origen_estado == Factura.ORIGEN_ERROR
            ),
            clientes=filas,
        )

    # ── Tarifas ───────────────────────────────────────────

    def tarifas_de(self, cliente_id: int) -> TarifasClienteResponse:
        cliente = self.clientes.find_by_id(cliente_id)
        if not cliente:
            raise NotFoundException("Cliente no encontrado")
        return TarifasClienteResponse(
            cliente_id=cliente_id,
            cliente_nombre=cliente.nombre,
            tarifas=[
                TarifaResponse(
                    id=t.id,
                    cliente_id=t.cliente_id,
                    concepto=t.concepto,
                    valor_unitario=Decimal(t.valor_unitario),
                    activo=bool(t.activo),
                )
                for t in self.tarifas.listar(cliente_id)
            ],
            por_defecto=self.tarifas.por_defecto(),
        )
