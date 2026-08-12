"""Pago de una factura con Webpay Plus: iniciar, volver y confirmar.

**El orden importa y no es negociable.** Webpay autoriza el cargo cuando el
usuario termina en su formulario, pero la plata no se captura hasta que el
comercio *confirma* (commit). Una transacción autorizada y no confirmada se
reversa sola a los 10 minutos. De ahí las tres reglas que sostienen este
módulo:

1. **La factura se marca pagada solo después de una confirmación aprobada.**
   Nunca al iniciar, nunca al volver el navegador: volver no es haber pagado.
2. **La confirmación se hace una sola vez por token.** Transbank rechaza la
   segunda, así que el retorno es idempotente: si el intento ya está cerrado,
   se devuelve su resultado y no se vuelve a confirmar. Esto no es una
   optimización — es lo que evita que un F5 en la pantalla de retorno
   convierta un pago bueno en un error.
3. **El monto confirmado se compara con el de la factura.** Si no calza, la
   factura NO se marca pagada y el intento queda en `error` para que lo mire
   una persona: dar por pagada una factura de $200.000 con un cargo de $2.000
   es peor que no cobrar.

**Aislamiento.** La factura se busca siempre acotada al `cliente_id` del token;
un id de otro estudio responde 404 y no 403, que confirmaría que ese id existe.
El retorno de Transbank no lleva sesión, y por eso ahí no se acepta ningún id:
el intento se ubica por el token, y de él salen la factura y el cliente.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import transbank
from app.core.crypto import descifrar
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.maestra.cliente import Cliente
from app.models.maestra.factura import Factura
from app.models.maestra.pago import Pago
from app.repositories.configuracion_transbank_repository import (
    ConfiguracionTransbankRepository,
)
from app.repositories.pago_repository import PagoRepository
from app.services.factura_service import FacturaService

logger = logging.getLogger(__name__)

# Cómo termina un retorno, de cara a la pantalla. Son los valores que viajan en
# el query param al redirigir a la SPA.
RESULTADO_EXITO = "exito"
RESULTADO_RECHAZADO = "rechazado"
RESULTADO_ANULADO = "anulado"
RESULTADO_ERROR = "error"


@dataclass
class ResultadoRetorno:
    """Lo que pasó con el retorno, ya interpretado para la pantalla."""

    resultado: str
    mensaje: str
    factura_id: Optional[int] = None
    factura_numero: Optional[str] = None
    pago_id: Optional[int] = None
    # Si además se le levantó la suspensión al cliente. Se informa porque es
    # un cambio grande y el estudio tiene que enterarse en la misma pantalla.
    reactivado: bool = False


class PagoService:
    def __init__(self, db_maestra: Session):
        # Todo vive en la base principal: factura, pago, cliente y la
        # configuración de Transbank. No se toca ninguna base de cliente.
        self.db = db_maestra
        self.pagos = PagoRepository(db_maestra)
        self.config_repo = ConfiguracionTransbankRepository(db_maestra)

    # ── Configuración ─────────────────────────────────────

    def _credenciales(self) -> tuple[str, Optional[str], Optional[str]]:
        """(ambiente, commerce_code, api_key) con la key ya descifrada.

        Si la key guardada no se puede descifrar —cambió la clave de cifrado—
        se devuelve `None` en vez de propagar el error: en integración eso cae
        en el comercio de prueba y en producción da un mensaje claro pidiendo
        volver a cargarla, que es más útil que un 500.
        """
        config = self.config_repo.get_or_create()
        if not config.activo:
            raise BadRequestException(
                "El pago en línea no está disponible en este momento."
            )
        api_key = None
        if config.api_key_cifrada:
            try:
                api_key = descifrar(config.api_key_cifrada)
            except ValueError:
                logger.error(
                    "No se pudo descifrar la API key de Transbank; "
                    "hay que volver a cargarla en la consola"
                )
        return config.ambiente, config.commerce_code, api_key

    def esta_habilitado(self) -> bool:
        """Si el estudio debería ver el botón de pagar."""
        return bool(self.config_repo.get_or_create().activo)

    # ── Iniciar ───────────────────────────────────────────

    def iniciar(
        self, factura_id: int, cliente_id: int, usuario_id: int, return_url: str
    ) -> dict:
        """Crea la transacción en Transbank. Devuelve `{url, token, ...}`.

        Con eso el navegador hace un POST de formulario a `url` con el campo
        `token_ws`. No se puede navegar por GET: Webpay lo rechaza.
        """
        ambiente, commerce_code, api_key = self._credenciales()
        factura = self._factura_del_cliente(factura_id, cliente_id)
        monto = self._validar_cobrable(factura)

        pago = self.pagos.add(
            Pago(
                factura_id=factura.id,
                cliente_id=cliente_id,
                # Provisorio: la orden definitiva necesita el id que asigna el
                # flush de `add`, y la columna es NOT NULL.
                buy_order="",
                monto=Decimal(monto),
                estado=Pago.ESTADO_INICIADO,
                usuario_id=usuario_id,
            )
        )
        # `F000042-17`: la factura para poder buscarla en el portal de
        # Transbank, y el id del intento para que reintentar una factura
        # rechazada no reuse la orden anterior.
        pago.buy_order = transbank.recortar(f"F{factura.numero:06d}-{pago.id}")
        pago.session_id = transbank.recortar(f"C{cliente_id}-{pago.id}")

        try:
            datos = transbank.crear_transaccion(
                ambiente, commerce_code, api_key,
                buy_order=pago.buy_order,
                session_id=pago.session_id,
                monto=monto,
                return_url=return_url,
            )
        except transbank.ErrorTransbank as exc:
            # El intento fallido queda registrado igual: es la diferencia entre
            # "Transbank estaba caído a las 15:40" y "no pasó nada".
            pago.cerrar(Pago.ESTADO_ERROR, str(exc))
            self.db.commit()
            logger.error("No se pudo crear la transacción Webpay: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"No se pudo iniciar el pago: {exc}",
            ) from exc

        pago.token = datos["token"]
        self.db.commit()
        self.db.refresh(pago)

        return {
            "pago_id": pago.id,
            "token": pago.token,
            "url": datos["url"],
            "monto": monto,
            "buy_order": pago.buy_order,
            "factura_numero": factura.numero_formateado,
        }

    def _factura_del_cliente(self, factura_id: int, cliente_id: int) -> Factura:
        """La factura, siempre acotada al cliente del token.

        404 y no 403 si es de otro: un 403 confirmaría que ese id existe.
        """
        factura = (
            self.db.query(Factura)
            .filter(Factura.id == factura_id, Factura.cliente_id == cliente_id)
            .first()
        )
        if not factura:
            raise NotFoundException("Factura no encontrada")
        return factura

    def _validar_cobrable(self, factura: Factura) -> int:
        """Comprueba que la factura se pueda pagar y devuelve el monto entero.

        El redondeo a entero es obligatorio: en pesos chilenos Webpay no acepta
        decimales, y `factura.total` es `Numeric(14,2)`.
        """
        if factura.anulada:
            raise BadRequestException("Esta factura está anulada y no se puede pagar.")
        if factura.estado == Factura.ESTADO_PAGADA:
            raise BadRequestException("Esta factura ya está pagada.")
        if self.pagos.find_aprobado(factura.id):
            # La factura quedó sin marcar pero el pago existe: es un estado
            # inconsistente que hay que mirar, no cobrar de nuevo.
            raise BadRequestException(
                "Esta factura ya tiene un pago aprobado. Contacte a soporte."
            )

        monto = int(Decimal(factura.total or 0).to_integral_value())
        if monto <= 0:
            raise BadRequestException("Esta factura no tiene monto que pagar.")
        return monto

    # ── Retorno y confirmación ────────────────────────────

    def confirmar_retorno(
        self,
        token_ws: Optional[str] = None,
        tbk_token: Optional[str] = None,
        tbk_orden_compra: Optional[str] = None,
    ) -> ResultadoRetorno:
        """Interpreta la vuelta del navegador desde Webpay.

        Transbank usa la **ausencia** de campos para distinguir los casos, y
        los cuatro llegan a esta misma URL:

        - solo `token_ws` → el usuario terminó de pagar; hay que confirmar.
        - solo `TBK_TOKEN` (+ orden y sesión) → apretó "Anular" en el
          formulario. No hay nada que confirmar.
        - solo `TBK_ORDEN_COMPRA` y `TBK_ID_SESION` → se le acabó el tiempo en
          el formulario (más de 10 minutos). Tampoco hay qué confirmar.
        - los dos tokens juntos → pagó después de un timeout previo; la
          transacción ya no sirve y Transbank la reversa.

        Ninguno de los tres últimos es un error del sistema: son finales
        normales, y tratarlos como excepción llenaría el log de ruido y le
        mostraría al estudio una pantalla de error por haber apretado "volver".
        """
        if tbk_token:
            return self._anulado_por_usuario(tbk_token, tbk_orden_compra, token_ws)

        if not token_ws:
            return self._timeout_formulario(tbk_orden_compra)

        pago = self.pagos.find_by_token(token_ws)
        if not pago:
            # Un token que no está en la base: o es de otra instalación, o
            # alguien lo inventó. No se confirma nada.
            logger.warning("Retorno de Webpay con un token desconocido")
            return ResultadoRetorno(
                RESULTADO_ERROR,
                "No se encontró la transacción. Si le cobraron, contacte a soporte.",
            )

        # Idempotencia: el intento ya cerrado no se vuelve a confirmar. Un F5
        # en esta pantalla no puede transformar un pago bueno en un error.
        if pago.estado != Pago.ESTADO_INICIADO:
            return self._resultado_de(pago)

        try:
            ambiente, commerce_code, api_key = self._credenciales()
            respuesta = transbank.confirmar(ambiente, commerce_code, api_key, token_ws)
        except (transbank.ErrorTransbank, HTTPException) as exc:
            # Acá NO se sabe si se cobró: pudo cortarse después de que
            # Transbank capturara. Queda en `error` y se resuelve consultando
            # el estado, nunca reintentando el commit.
            pago.cerrar(Pago.ESTADO_ERROR, str(getattr(exc, "detail", exc)))
            self.db.commit()
            logger.error("Falló la confirmación del pago %s: %s", pago.id, exc)
            return ResultadoRetorno(
                RESULTADO_ERROR,
                "No pudimos confirmar el pago con Transbank. "
                "No vuelva a pagar: consulte el estado con soporte.",
                factura_id=pago.factura_id,
                pago_id=pago.id,
            )

        return self._aplicar_confirmacion(pago, respuesta)

    def _aplicar_confirmacion(self, pago: Pago, respuesta: dict) -> ResultadoRetorno:
        """Escribe el resultado de la confirmación: pago, factura y cliente.

        Todo en **una sola transacción**. `FacturaService.marcar_pagada` hace
        el commit al final y comparte la sesión, así que el pago, la factura y
        la eventual reactivación entran juntos o no entra ninguno: una factura
        marcada pagada sin su pago registrado sería imposible de auditar.
        """
        pago.response_code = respuesta.get("response_code")
        pago.authorization_code = respuesta.get("authorization_code")
        pago.tarjeta_final4 = (respuesta.get("card_detail") or {}).get("card_number")
        pago.tipo_pago = respuesta.get("payment_type_code")
        pago.cuotas = respuesta.get("installments_number")
        pago.fecha_transaccion = _fecha(respuesta.get("transaction_date"))
        pago.respuesta_cruda = json.dumps(respuesta, ensure_ascii=False, default=str)

        factura = self.db.get(Factura, pago.factura_id)

        if not transbank.fue_aprobada(respuesta):
            pago.cerrar(
                Pago.ESTADO_RECHAZADO,
                f"Transbank rechazó el pago (código {pago.response_code}).",
            )
            self.db.commit()
            logger.info(
                "Pago %s rechazado para la factura %s (código %s)",
                pago.id, pago.factura_id, pago.response_code,
            )
            return ResultadoRetorno(
                RESULTADO_RECHAZADO,
                "El pago fue rechazado. No se hizo ningún cargo a su tarjeta.",
                factura_id=pago.factura_id,
                factura_numero=factura.numero_formateado if factura else None,
                pago_id=pago.id,
            )

        # Aprobada. Antes de dar nada por pagado, que el monto calce.
        monto_transbank = Decimal(str(respuesta.get("amount", 0)))
        if factura is None or monto_transbank != Decimal(pago.monto or 0):
            pago.cerrar(
                Pago.ESTADO_ERROR,
                f"El monto confirmado ({monto_transbank}) no coincide con el "
                f"del intento ({pago.monto}).",
            )
            self.db.commit()
            logger.error(
                "Pago %s aprobado con monto que no calza: Transbank %s, intento %s. "
                "La factura NO se marcó pagada.",
                pago.id, monto_transbank, pago.monto,
            )
            return ResultadoRetorno(
                RESULTADO_ERROR,
                "El pago se aprobó pero el monto no coincide. "
                "No marcamos la factura: soporte lo revisará.",
                factura_id=pago.factura_id,
                pago_id=pago.id,
            )

        pago.cerrar(Pago.ESTADO_APROBADO, "Pago aprobado por Transbank.")
        reactivado = self._reactivar_si_corresponde(factura)
        # Última: hace el commit de todo lo anterior y además redibuja el PDF
        # con la cinta PAGADA (ver FacturaService._redibujar_pdf).
        FacturaService(self.db).marcar_pagada(factura.id, True)

        logger.info(
            "Factura %s pagada con Webpay (pago %s, autorización %s)%s",
            factura.numero_formateado, pago.id, pago.authorization_code,
            " — cliente reactivado" if reactivado else "",
        )
        return ResultadoRetorno(
            RESULTADO_EXITO,
            "Pago recibido. Su factura quedó pagada.",
            factura_id=factura.id,
            factura_numero=factura.numero_formateado,
            pago_id=pago.id,
            reactivado=reactivado,
        )

    def _reactivar_si_corresponde(self, factura: Factura) -> bool:
        """Levanta la suspensión por mora, si es que era por mora.

        **Las tres condiciones son todas necesarias**:

        1. el cliente está inactivo;
        2. lo dejó inactivo el job de mora (`suspendido_por_mora`), no una
           persona — sin esta comprobación, pagar una factura reactivaría a
           quien fue dado de baja por cualquier otro motivo;
        3. no le quedan otras facturas por pagar. Pagar la más nueva y seguir
           debiendo tres no es estar al día.

        No reactiva "por si acaso": si algo no calza, el cliente queda
        suspendido y el operador decide, que es como estaba antes de que
        existiera el pago en línea.
        """
        cliente = self.db.get(Cliente, factura.cliente_id)
        if cliente is None or cliente.activo:
            return False
        if not cliente.suspendido_por_mora:
            logger.info(
                "Cliente %s pagó pero no se reactiva: no lo suspendió el job de mora",
                cliente.guid,
            )
            return False

        pendientes = (
            self.db.query(Factura)
            .filter(
                Factura.cliente_id == cliente.cliente_id,
                Factura.id != factura.id,
                Factura.anulada.is_(False),
                Factura.estado == Factura.ESTADO_EMITIDA,
            )
            .count()
        )
        if pendientes:
            logger.info(
                "Cliente %s pagó una factura pero le quedan %d impagas: sigue suspendido",
                cliente.guid, pendientes,
            )
            return False

        cliente.activo = True
        cliente.suspendido_por_mora = False
        self.db.add(cliente)
        logger.warning(
            "Cliente %s reactivado automáticamente tras pagar toda su deuda",
            cliente.guid,
        )
        return True

    # ── Los finales que no son un pago ────────────────────

    def _anulado_por_usuario(
        self,
        tbk_token: str,
        tbk_orden_compra: Optional[str],
        token_ws: Optional[str],
    ) -> ResultadoRetorno:
        """El usuario apretó "Anular" en el formulario de Webpay.

        Con `token_ws` presente además, es el caso de pago tras un timeout: la
        transacción se reversa igual. Los dos terminan en `anulado`.
        """
        pago = self.pagos.find_by_token(tbk_token) or self.pagos.find_by_buy_order(
            tbk_orden_compra or ""
        )
        if pago and pago.estado == Pago.ESTADO_INICIADO:
            pago.cerrar(
                Pago.ESTADO_ANULADO,
                "El usuario anuló el pago en el formulario de Webpay."
                if not token_ws
                else "Se pagó fuera de plazo; Transbank reversó la transacción.",
            )
            self.db.commit()
        return ResultadoRetorno(
            RESULTADO_ANULADO,
            "El pago fue anulado. No se hizo ningún cargo.",
            factura_id=pago.factura_id if pago else None,
            pago_id=pago.id if pago else None,
        )

    def _timeout_formulario(self, tbk_orden_compra: Optional[str]) -> ResultadoRetorno:
        """Se acabó el tiempo en el formulario de Webpay (más de 10 minutos).

        Vuelve sin ningún token, así que el intento solo se puede ubicar por la
        orden de compra.
        """
        pago = self.pagos.find_by_buy_order(tbk_orden_compra or "")
        if pago and pago.estado == Pago.ESTADO_INICIADO:
            pago.cerrar(
                Pago.ESTADO_ANULADO,
                "Se acabó el tiempo en el formulario de pago.",
            )
            self.db.commit()
        return ResultadoRetorno(
            RESULTADO_ANULADO,
            "Se acabó el tiempo para pagar. No se hizo ningún cargo; puede intentarlo de nuevo.",
            factura_id=pago.factura_id if pago else None,
            pago_id=pago.id if pago else None,
        )

    def _resultado_de(self, pago: Pago) -> ResultadoRetorno:
        """El resultado de un intento ya cerrado, sin volver a llamar a Transbank."""
        factura = self.db.get(Factura, pago.factura_id)
        mapa = {
            Pago.ESTADO_APROBADO: (RESULTADO_EXITO, "Este pago ya estaba confirmado."),
            Pago.ESTADO_RECHAZADO: (RESULTADO_RECHAZADO, "El pago fue rechazado."),
            Pago.ESTADO_ANULADO: (RESULTADO_ANULADO, "El pago fue anulado."),
        }
        resultado, mensaje = mapa.get(
            pago.estado,
            (RESULTADO_ERROR, pago.mensaje or "El pago no se pudo completar."),
        )
        return ResultadoRetorno(
            resultado,
            mensaje,
            factura_id=pago.factura_id,
            factura_numero=factura.numero_formateado if factura else None,
            pago_id=pago.id,
        )

    # ── Consulta ──────────────────────────────────────────

    def intentos_de(self, factura_id: int) -> list[Pago]:
        """Los intentos de una factura. Lo usa la consola, no el estudio."""
        return self.pagos.find_by_factura(factura_id)


def _fecha(valor: Optional[str]) -> Optional[datetime]:
    """La fecha ISO que manda Transbank, o None si viene rara.

    Una fecha ilegible no puede tumbar la confirmación de un pago que sí se
    hizo: es un dato informativo y la respuesta cruda queda guardada entera.
    """
    if not valor:
        return None
    try:
        return datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Fecha de transacción ilegible: %s", valor)
        return None
