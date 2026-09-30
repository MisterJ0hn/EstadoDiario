from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseTenant


class WebhookEnvio(BaseTenant):
    """Cola de entregas del webhook, en la base del cliente.

    Una fila por **lote**: un archivo importado con 1.200 filas genera tres
    (500 + 500 + 200), y cada una se entrega y se reintenta por separado.

    **No guarda el contenido**, solo qué enviar: el tipo, el archivo
    (`origen_id`) y qué lote. El cuerpo se arma al momento de enviar, con lo que
    hay en ese instante en la base. Un archivo grande no se duplica en una
    segunda tabla, y un reintento de horas después lleva el dato vigente. A
    cambio, un archivo borrado entre medio no se puede reenviar, y la fila
    queda anotada como tal.

    La entrega es **al menos una vez**: si el receptor contestó 200 pero la
    respuesta se perdió, se reenvía. Por eso cada envío lleva `evento_id` y
    `lote`: es la clave con la que el receptor descarta repetidos.
    """

    __tablename__ = "webhook_envio"
    __table_args__ = (
        # La consulta caliente del despachador: "lo pendiente que ya toca".
        Index("ix_webhook_envio_pendientes", "estado", "proximo_intento"),
    )

    ESTADO_PENDIENTE = "pendiente"
    ESTADO_ENVIADO = "enviado"
    # Agotó los reintentos. Se queda ahí hasta que el administrador lo
    # reintente a mano; no se borra, porque es justo lo que hay que revisar.
    ESTADO_FALLIDO = "fallido"

    TIPO_ESTADO_DIARIO = "estado_diario"
    TIPO_MOVIMIENTOS = "movimientos"
    TIPO_AUDIENCIAS = "audiencias"
    TIPO_PRUEBA = "prueba"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Identifica la importación: todos los lotes de un archivo lo comparten.
    evento_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    # Sin FK: si se borra el archivo la fila debe sobrevivir para poder decir
    # que no se pudo enviar, no desaparecer con él.
    origen_id: Mapped[Optional[int]] = mapped_column(Integer)
    # Desde 1.
    lote: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    total_lotes: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Filas del archivo en total (no del lote), informativo para el receptor.
    total_registros: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    estado: Mapped[str] = mapped_column(String(10), nullable=False, default=ESTADO_PENDIENTE)
    intentos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Desde cuándo se puede intentar. Sirve además de candado: quien reclama la
    # fila la corre hacia adelante (ver `WebhookService._reclamar`).
    proximo_intento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    ultimo_status_http: Mapped[Optional[int]] = mapped_column(Integer)
    ultimo_error: Mapped[Optional[str]] = mapped_column(String(500))

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    fecha_envio: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
