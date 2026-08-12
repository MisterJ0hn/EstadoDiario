from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.maestra.pago import Pago


class PagoRepository:
    """Intentos de pago, en la base PRINCIPAL (viven al lado de la factura)."""

    def __init__(self, db: Session):
        self.db = db

    def find_by_token(self, token: str) -> Optional[Pago]:
        """El intento que corresponde a un token de Webpay.

        Es por donde entra el retorno del navegador, así que es la consulta más
        sensible del módulo: el token es lo único que trae el usuario de vuelta
        y de acá sale a qué factura y a qué cliente pertenece. Nada de eso se
        toma de la URL.
        """
        if not token:
            return None
        return self.db.query(Pago).filter(Pago.token == token).first()

    def find_by_buy_order(self, buy_order: str) -> Optional[Pago]:
        """El intento por su orden de compra.

        Hace falta para el retorno por **timeout**: en ese caso Transbank
        devuelve el navegador con `TBK_ORDEN_COMPRA` y sin token, así que es la
        única forma de saber qué intento quedó abandonado.
        """
        if not buy_order:
            return None
        return self.db.query(Pago).filter(Pago.buy_order == buy_order).first()

    def find_by_factura(self, factura_id: int) -> List[Pago]:
        """Todos los intentos de una factura, del más nuevo al más viejo."""
        return (
            self.db.query(Pago)
            .filter(Pago.factura_id == factura_id)
            .order_by(Pago.id.desc())
            .all()
        )

    def find_aprobado(self, factura_id: int) -> Optional[Pago]:
        """El pago aprobado de una factura, si lo hay.

        Es lo que impide cobrar dos veces la misma factura: se consulta antes
        de crear una transacción nueva y antes de confirmar una que vuelve.
        """
        return (
            self.db.query(Pago)
            .filter(Pago.factura_id == factura_id, Pago.estado == Pago.ESTADO_APROBADO)
            .first()
        )

    def add(self, pago: Pago) -> Pago:
        """Agrega el intento y le asigna id **sin cerrar la transacción**.

        `flush` y no `commit` a propósito: el id se necesita para armar la orden
        de compra, pero el intento solo tiene sentido junto con el token que
        todavía no llegó. Quien llama decide cuándo confirmar.
        """
        self.db.add(pago)
        self.db.flush()
        return pago
