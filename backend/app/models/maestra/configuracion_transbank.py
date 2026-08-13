from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra
from app.core.transbank import AMBIENTE_INTEGRACION


class ConfiguracionTransbank(BaseMaestra):
    """Credenciales de Webpay Plus. Una sola fila, global de la plataforma.

    **Sin `cliente_id`, a diferencia de WhatsApp, SMTP y Google.** Esas tres
    admiten una fila por cliente porque un estudio grande puede querer usar su
    propia cuenta de Twilio o su propio proyecto de Google. Acá no: el que cobra
    es Temposoft, y la cuenta de Transbank donde cae la plata es la de
    Temposoft. Una fila por cliente significaría que un estudio se cobra a sí
    mismo, que no es lo que pasa.

    La API key se guarda **cifrada** (`core/crypto`, Fernet), igual que la
    contraseña de la casilla de correo y el token de Twilio: se necesita en
    claro para firmar cada llamada, así que no se puede hashear. Cambiar
    `MAIL_ENCRYPTION_KEY` o `BACKEND_SECRET_KEY` la deja ilegible y hay que
    volver a escribirla desde la consola.
    """

    __tablename__ = "configuracion_transbank"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # El interruptor. Apagado, la app del estudio no muestra el botón de pagar
    # y el endpoint responde que el pago en línea no está disponible. Viene
    # apagado: encender el cobro con tarjeta no puede ser consecuencia de
    # desplegar una versión nueva.
    activo: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # `integracion` (comercio de prueba, no cobra) o `produccion`. Arranca en
    # integración por lo mismo que `activo` viene en false.
    ambiente: Mapped[str] = mapped_column(
        String(20), default=AMBIENTE_INTEGRACION, server_default=AMBIENTE_INTEGRACION
    )

    # Código de comercio. No es secreto —viaja en cada transacción— así que se
    # guarda en claro y se muestra completo en la consola.
    commerce_code: Mapped[Optional[str]] = mapped_column(String(32))

    # La API key sí es secreta: es lo único que autentica al comercio ante
    # Transbank. Nunca sale de acá en claro hacia la consola.
    api_key_cifrada: Mapped[Optional[str]] = mapped_column(Text)

    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
