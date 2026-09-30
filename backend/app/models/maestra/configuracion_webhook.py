from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class ConfiguracionWebhook(BaseMaestra):
    """A dónde avisa el sistema, por cliente, cuando termina de importar un
    archivo que llegó por correo. Una fila por cliente.

    Vive en la base principal por lo mismo que la casilla de correo: el job
    recorre a todos los clientes y tiene que saber a cuáles avisar sin abrir la
    base de cada uno.

    **El secreto va cifrado y no con hash** porque hay que tenerlo en claro para
    firmar cada envío (HMAC). Nunca sale por la API: se muestra una vez al
    generarlo y después solo se puede rotar.
    """

    __tablename__ = "configuracion_webhook"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, unique=True, index=True
    )

    url: Mapped[Optional[str]] = mapped_column(String(500))
    secreto_cifrado: Mapped[Optional[str]] = mapped_column(Text)
    # Apagado por defecto: un webhook sin URL o sin decidir es un envío de datos
    # del estudio a un tercero que nadie pidió.
    activo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Qué reportes se envían. El receptor puede querer solo las audiencias.
    enviar_estado_diario: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enviar_movimientos: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enviar_audiencias: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Resultado del último intento de entrega, para verlo en la consola sin
    # abrir la base del cliente.
    ultimo_envio: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ultimo_resultado: Mapped[Optional[str]] = mapped_column(String(500))
    # Cuántas entregas agotaron sus reintentos y siguen sin enviarse. Lo
    # actualiza `WebhookService.despachar`.
    fallidos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    fecha_creacion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    fecha_actualizacion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
