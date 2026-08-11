"""Consulta de las facturas emitidas: listado, filtros, detalle, PDF y anulación.

Acá **no se calcula nada**. La factura se genera una vez, el día 1, en
`facturacion_service`, y desde entonces es un documento cerrado: este módulo
solo la busca y la devuelve. Es la separación que hace que una factura no cambie
de monto porque alguien abrió la pantalla.

**Sobre el filtro por RUT.** El RUT del cliente está cifrado en la base
(`Cliente.rut_cifrado`, con un HMAC en `rut_hash` por donde se busca), así que
buscar por RUT es **coincidencia exacta** y no un LIKE: no existe forma de hacer
una búsqueda parcial sobre un campo cifrado sin descifrar la tabla entera. La
factura sí guarda el RUT en claro —es parte del documento impreso—, y es contra
esa copia que se filtra, normalizando puntos y guion para que "12.345.678-9" y
"12345678-9" encuentren lo mismo.
"""

import logging
import re
from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.maestra.cliente import Cliente
from app.models.maestra.factura import Factura
from app.repositories.cliente_repository import ClienteRepository

logger = logging.getLogger(__name__)


def normalizar_rut(rut: Optional[str]) -> str:
    """`12.345.678-K` → `12345678k`. Sin puntos, sin guion y en minúsculas."""
    return re.sub(r"[^0-9kK]", "", rut or "").lower()


class FiltroFacturas:
    """Los filtros del listado, juntos.

    Van en un objeto y no en ocho parámetros sueltos porque el endpoint, la
    pantalla del cliente y el listado general usan los mismos y con firmas
    largas es cuestión de tiempo que alguien invierta dos.
    """

    def __init__(
        self,
        cliente_id: Optional[int] = None,
        desde: Optional[date] = None,
        hasta: Optional[date] = None,
        rut: Optional[str] = None,
        cliente_activo: Optional[bool] = None,
        busqueda: Optional[str] = None,
        estado: Optional[str] = None,
        incluir_anuladas: bool = True,
        limite: Optional[int] = None,
    ):
        self.cliente_id = cliente_id
        # Acotan el PERÍODO facturado, no la fecha de generación: se busca "la
        # factura de marzo", no "la que se generó en abril".
        self.desde = desde
        self.hasta = hasta
        self.rut = rut
        self.cliente_activo = cliente_activo
        # Nombre del cliente o número de factura, en el mismo campo: quien busca
        # escribe lo que tiene a mano y no quiere elegir antes en qué columna.
        self.busqueda = busqueda
        self.estado = estado
        self.incluir_anuladas = incluir_anuladas
        # Cuántas devolver como máximo, de la más nueva hacia atrás. Se usa al
        # mirar UN cliente: ahí la pregunta es "cómo viene su facturación", que
        # se responde con el último año y no con todo el historial.
        self.limite = limite


class FacturaService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.clientes = ClienteRepository(db_maestra)

    # ── Consulta ──────────────────────────────────────────

    def listar(self, filtro: Optional[FiltroFacturas] = None) -> List[Factura]:
        """Facturas que cumplen el filtro, de la más nueva a la más vieja.

        El detalle viaja con `selectinload`: el listado muestra el total de
        conceptos por fila y sin esto serían tantas consultas como facturas.
        """
        filtro = filtro or FiltroFacturas()
        query = self.db.query(Factura).options(selectinload(Factura.detalles))

        if filtro.cliente_id:
            query = query.filter(Factura.cliente_id == filtro.cliente_id)

        # El período es el primer día del mes: una factura de julio entra en un
        # filtro "desde 15-07" porque lo que se pide es el mes, no el día.
        if filtro.desde:
            query = query.filter(Factura.fecha_hasta >= filtro.desde)
        if filtro.hasta:
            query = query.filter(Factura.fecha_desde <= filtro.hasta)

        if filtro.rut:
            query = query.filter(Factura.cliente_id.in_(self._ids_por_rut(filtro.rut)))

        if filtro.cliente_activo is not None:
            query = query.filter(
                Factura.cliente_id.in_(self._ids_por_actividad(filtro.cliente_activo))
            )

        if filtro.estado:
            query = query.filter(Factura.estado == filtro.estado)

        if not filtro.incluir_anuladas:
            query = query.filter(Factura.anulada.is_(False))

        if filtro.busqueda:
            termino = filtro.busqueda.strip()
            if termino:
                condiciones = [Factura.razon_social.ilike(f"%{termino}%")]
                # Un término que es todo dígitos también se prueba como número
                # de factura, con y sin los ceros de relleno: la gente copia
                # "000042" del PDF y escribe "42" de memoria.
                solo_digitos = termino.lstrip("0") or "0"
                if solo_digitos.isdigit():
                    condiciones.append(Factura.numero == int(solo_digitos))
                query = query.filter(or_(*condiciones))

        # Por PERÍODO primero: el listado se lee por mes, y "las últimas" de un
        # cliente son los meses más recientes, no los correlativos más altos.
        # Los dos coinciden salvo que se haya regenerado un período viejo.
        query = query.order_by(Factura.periodo.desc().nullslast(), Factura.numero.desc())
        if filtro.limite and filtro.limite > 0:
            query = query.limit(filtro.limite)
        return query.all()

    def _ids_por_rut(self, rut: str) -> List[int]:
        """Los cliente_id cuyo RUT coincide, comparando ya normalizado.

        Se resuelve en Python y no en SQL a propósito: la comparación tiene que
        ignorar puntos y guion, y la columna de la factura guarda el RUT tal
        como estaba escrito el día que se emitió. Son unas pocas facturas por
        cliente y por mes; no vale la pena una columna normalizada más.
        """
        buscado = normalizar_rut(rut)
        if not buscado:
            return []
        return [
            c.cliente_id
            for c in self.clientes.find_all()
            if normalizar_rut(c.rut) == buscado
        ]

    def _ids_por_actividad(self, activo: bool) -> List[int]:
        return [c.cliente_id for c in self.clientes.find_all() if bool(c.activo) is activo]

    def obtener(self, factura_id: int) -> Factura:
        factura = (
            self.db.query(Factura)
            .options(selectinload(Factura.detalles))
            .filter(Factura.id == factura_id)
            .first()
        )
        if not factura:
            raise NotFoundException("Factura no encontrada")
        return factura

    @staticmethod
    def total_cobrable(facturas: List[Factura]) -> Decimal:
        """Suma de las NO anuladas. El total de un listado tiene que ser lo que
        se puede cobrar; incluir las anuladas da una cifra que no existe."""
        return sum(
            (Decimal(f.total or 0) for f in facturas if not f.anulada), Decimal("0")
        )

    def clientes_por_id(self) -> dict[int, Cliente]:
        """Los clientes indexados, para pegarle a cada factura el nombre y el
        estado actuales. Se leen de una vez: un `find_by_id` por fila serían
        tantas consultas como facturas solo para mostrar un nombre."""
        return {c.cliente_id: c for c in self.clientes.find_all()}

    # ── Documento ─────────────────────────────────────────

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
                "Esta factura no tiene PDF guardado. Regenere el período."
            )
        return bytes(factura.pdf), factura.pdf_nombre or f"factura-{factura.numero}.pdf"

    # ── Estado ────────────────────────────────────────────

    def anular(self, factura_id: int, motivo: str) -> Factura:
        """Marca la factura como anulada. **No la borra ni libera el número**: un
        correlativo con huecos es imposible de auditar, y el PDF entregado
        existe aunque se haya anulado."""
        factura = self.obtener(factura_id)
        factura.marcar_anulada(motivo)
        self.db.commit()
        self.db.refresh(factura)
        logger.info("Factura %s anulada: %s", factura.numero_formateado, motivo)
        return factura

    def marcar_pagada(self, factura_id: int, pagada: bool) -> Factura:
        """Pone o saca la marca de pagada.

        No hay integración con ningún banco: lo registra una persona que vio el
        pago. Una factura anulada no se puede marcar pagada, que es lo que
        evita cuadrar una contabilidad contra un documento que no existe.
        """
        factura = self.obtener(factura_id)
        if factura.anulada:
            raise BadRequestException(
                "Una factura anulada no se puede marcar como pagada."
            )
        factura.estado = Factura.ESTADO_PAGADA if pagada else Factura.ESTADO_EMITIDA
        self.db.commit()
        self.db.refresh(factura)
        logger.info(
            "Factura %s marcada como %s", factura.numero_formateado, factura.estado
        )
        return factura
