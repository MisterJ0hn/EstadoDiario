"""Emisión de las órdenes de compra.

Una orden de compra cubre un **rango de fechas** y suma los cierres mensuales
que caen dentro. No recalcula nada: los montos salen de `facturacion_cierre`,
que ya se congeló el día 1 de cada mes (ver `facturacion_service`). Es lo que
hace que el documento sea reproducible — emitir dos veces el mismo rango da el
mismo total, aunque el estudio haya cargado causas nuevas en el medio.

Un mes del rango **sin cierre no se factura y se avisa**. La alternativa
—contarlo al momento y meterlo igual— mezclaría en un mismo documento montos
congelados con montos que cambian solos, y nadie podría después decir cuál era
cuál. Si falta un mes, lo que corresponde es cerrarlo y volver a emitir.
"""

import logging
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.maestra.cliente import Cliente
from app.models.maestra.factura import Factura, FacturaLinea
from app.models.maestra.facturacion_cierre import FacturacionCierre
from app.repositories.cliente_repository import ClienteRepository
from app.services import factura_pdf

logger = logging.getLogger(__name__)


def meses_del_rango(desde: date, hasta: date) -> List[date]:
    """Los primeros de mes que caen en el rango, en orden.

    Un mes entra si **empieza** dentro del rango o si el rango empieza dentro
    de él: de 15-01 a 15-03 se facturan enero, febrero y marzo. Es lo que
    espera quien escribe un rango a mano — nadie pretende media mensualidad—,
    y por eso el rango se guarda tal como se pidió pero el detalle va por mes
    completo.
    """
    if hasta < desde:
        raise BadRequestException("La fecha 'hasta' no puede ser anterior a 'desde'")

    meses: List[date] = []
    actual = desde.replace(day=1)
    fin = hasta.replace(day=1)
    while actual <= fin:
        meses.append(actual)
        actual = (
            date(actual.year + 1, 1, 1)
            if actual.month == 12
            else date(actual.year, actual.month + 1, 1)
        )
    return meses


class FacturaService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.clientes = ClienteRepository(db_maestra)

    # ── Emisión ───────────────────────────────────────────

    def emitir(
        self,
        cliente_id: int,
        desde: date,
        hasta: date,
        emitida_por: Optional[str] = None,
    ) -> Factura:
        """Emite la orden de compra del cliente para el rango indicado."""
        cliente = self.clientes.find_by_id(cliente_id)
        if not cliente:
            raise NotFoundException("Cliente no encontrado")

        meses = meses_del_rango(desde, hasta)
        cierres = self._cierres_de(cliente_id, meses)

        faltantes = [m for m in meses if m not in cierres]
        if faltantes:
            nombres = ", ".join(factura_pdf.mes_largo(m) for m in faltantes)
            raise BadRequestException(
                f"No hay cierre de facturación para {nombres}. Cierre esos períodos "
                f"antes de emitir: una orden de compra solo suma montos ya congelados."
            )

        factura = Factura(
            numero=self._siguiente_numero(),
            cliente_id=cliente.cliente_id,
            fecha_desde=desde,
            fecha_hasta=hasta,
            fecha_emision=datetime.now(timezone.utc),
            emitida_por=emitida_por,
            # Copia de los datos del cliente: la orden emitida no cambia si
            # después se corrige la dirección.
            razon_social=cliente.nombre,
            rut=cliente.rut,
            giro=cliente.giro,
            direccion=cliente.direccion,
            comuna=cliente.comuna,
            ciudad=cliente.ciudad,
            correo=cliente.correo,
        )

        total = 0.0
        for mes in meses:
            cierre = cierres[mes]
            subtotal = float(cierre.monto or 0)
            total += subtotal
            factura.lineas.append(
                FacturaLinea(
                    periodo=mes,
                    causas_materia=cierre.causas_materia or 0,
                    cortes_apelaciones=cierre.cortes_apelaciones or 0,
                    cortes_suprema=cierre.cortes_suprema or 0,
                    tarifa_materia=cierre.tarifa_materia,
                    tarifa_apelaciones=cierre.tarifa_apelaciones,
                    tarifa_suprema=cierre.tarifa_suprema,
                    subtotal=subtotal,
                    facturacion_cierre_id=cierre.id,
                )
            )
        factura.total = total

        # El PDF se dibuja ANTES del commit: si reventara, no queda una orden
        # con un número consumido y sin documento que entregar.
        factura.pdf = factura_pdf.generar(self._a_datos_pdf(factura))
        factura.pdf_nombre = f"orden-compra-{factura.numero_formateado}.pdf"

        self.db.add(factura)
        self.db.commit()
        self.db.refresh(factura)
        logger.info(
            "Orden de compra %s emitida al cliente %s por %s ($%s)",
            factura.numero_formateado, cliente.guid, emitida_por or "?", total,
        )
        return factura

    def _cierres_de(
        self, cliente_id: int, meses: List[date]
    ) -> dict[date, FacturacionCierre]:
        """{mes: cierre} para los meses pedidos, en una sola consulta."""
        filas = (
            self.db.query(FacturacionCierre)
            .filter(
                FacturacionCierre.cliente_id == cliente_id,
                FacturacionCierre.periodo.in_(meses),
            )
            .all()
        )
        # Un cierre en estado `error` es un mes que no se pudo contar; entra
        # igual porque su monto es el que se congeló, y el que decide si eso se
        # cobra o se rehace es una persona, no este método. Lo que no puede
        # pasar es que desaparezca sin que nadie lo note: por eso el estado
        # viaja en la respuesta de la API.
        return {f.periodo: f for f in filas}

    def _siguiente_numero(self) -> int:
        """El siguiente correlativo global, sin huecos ni repetidos.

        Va con `LOCK TABLE ... IN EXCLUSIVE MODE` y no con una secuencia de
        PostgreSQL a propósito: una secuencia **deja huecos** cuando la
        transacción se deshace —los nextval no se revierten— y un talonario con
        el número 47 faltante es algo que después nadie puede explicar. El
        bloqueo serializa la emisión, que es exactamente lo que se quiere: se
        emiten unas pocas al mes y son de las poquísimas operaciones donde
        esperar 20 ms vale más que la concurrencia.

        EXCLUSIVE deja pasar los SELECT (el listado sigue respondiendo) y
        bloquea solo a otro que esté emitiendo al mismo tiempo. Se libera al
        cerrar la transacción, que es el commit de `emitir`.
        """
        self.db.execute(text("LOCK TABLE factura IN EXCLUSIVE MODE"))
        maximo = self.db.execute(text("SELECT COALESCE(MAX(numero), 0) FROM factura")).scalar()
        return int(maximo or 0) + 1

    @staticmethod
    def _a_datos_pdf(factura: Factura) -> factura_pdf.DatosFactura:
        """Traduce el modelo al contrato de dibujo. La traducción vive acá y no
        en `factura_pdf` para que ese módulo no dependa de la base y se pueda
        probar solo."""
        return factura_pdf.DatosFactura(
            numero=factura.numero_formateado,
            fecha_emision=factura.fecha_emision,
            fecha_desde=factura.fecha_desde,
            fecha_hasta=factura.fecha_hasta,
            razon_social=factura.razon_social,
            rut=factura.rut,
            giro=factura.giro,
            direccion=factura.direccion,
            comuna=factura.comuna,
            ciudad=factura.ciudad,
            correo=factura.correo,
            lineas=[
                factura_pdf.LineaFactura(
                    periodo=l.periodo,
                    causas_materia=l.causas_materia or 0,
                    cortes_apelaciones=l.cortes_apelaciones or 0,
                    cortes_suprema=l.cortes_suprema or 0,
                    tarifa_materia=l.tarifa_materia,
                    tarifa_apelaciones=l.tarifa_apelaciones,
                    tarifa_suprema=l.tarifa_suprema,
                    subtotal=float(l.subtotal or 0),
                )
                for l in factura.lineas
            ],
            total=float(factura.total or 0),
            emitida_por=factura.emitida_por,
        )

    # ── Consulta ──────────────────────────────────────────

    def listar(
        self,
        cliente_id: Optional[int] = None,
        desde: Optional[date] = None,
        hasta: Optional[date] = None,
    ) -> List[Factura]:
        """Órdenes emitidas, de la más nueva a la más vieja.

        El filtro de fechas va contra el RANGO facturado y no contra la fecha
        de emisión: se busca "la orden de marzo", no "la que emití en abril".
        Una orden entra si su rango se cruza con el pedido.
        """
        query = self.db.query(Factura)
        if cliente_id:
            query = query.filter(Factura.cliente_id == cliente_id)
        if desde:
            query = query.filter(Factura.fecha_hasta >= desde)
        if hasta:
            query = query.filter(Factura.fecha_desde <= hasta)
        return query.order_by(Factura.numero.desc()).all()

    def obtener(self, factura_id: int) -> Factura:
        factura = self.db.get(Factura, factura_id)
        if not factura:
            raise NotFoundException("Orden de compra no encontrada")
        return factura

    def pdf(self, factura_id: int) -> tuple[bytes, str]:
        """El PDF **guardado**, no uno nuevo.

        Regenerarlo al descargar parecería equivalente y no lo es: bastaría un
        cambio en el dibujo, en el formato de los números o en las tarifas para
        que la copia que el cliente tiene en el correo y la que descarga hoy
        dejaran de ser el mismo documento.
        """
        factura = self.obtener(factura_id)
        if not factura.pdf:
            raise NotFoundException(
                "Esta orden de compra no tiene PDF guardado. Emítala de nuevo."
            )
        return bytes(factura.pdf), factura.pdf_nombre or f"orden-{factura.numero}.pdf"

    def anular(self, factura_id: int, motivo: str) -> Factura:
        """Marca la orden como anulada. **No la borra ni libera el número**: un
        correlativo con huecos es imposible de auditar, y el PDF entregado
        existe aunque se haya anulado."""
        factura = self.obtener(factura_id)
        factura.anulada = True
        factura.motivo_anulacion = motivo
        self.db.commit()
        self.db.refresh(factura)
        logger.info("Orden de compra %s anulada: %s", factura.numero_formateado, motivo)
        return factura
