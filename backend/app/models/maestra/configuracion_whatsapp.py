from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class ConfiguracionWhatsapp(BaseMaestra):
    """Credenciales de Twilio para el envío de recordatorios por WhatsApp.
    Vive en la base principal: una fila global del sistema y, si hace falta,
    una por cliente (ver `cliente_id`)."""

    __tablename__ = "configuracion_whatsapp"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Configuración POR CLIENTE. NULL = fila global del sistema, que es la que
    # se usa cuando el cliente no tiene la suya: las credenciales del proveedor
    # (Twilio, la cuenta SMTP de salida, el proyecto de Google Cloud) suelen
    # ser del SaaS y no del estudio, pero un cliente grande puede querer las
    # propias. OJO: en PostgreSQL el UNIQUE no agrupa los NULL, así que no
    # impide dos filas globales; el repositorio toma la de menor id.
    cliente_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cliente.cliente_id"), unique=True, index=True
    )

    activo: Mapped[bool] = mapped_column(Boolean, default=False)
    twilio_account_sid: Mapped[Optional[str]] = mapped_column(String(64))
    twilio_auth_token_cifrado: Mapped[Optional[str]] = mapped_column(Text)
    # Formato Twilio: "whatsapp:+14155238886"
    twilio_numero_whatsapp: Mapped[Optional[str]] = mapped_column(String(40))
    # Content SID de la plantilla de WhatsApp ya aprobada (requerida por
    # Twilio para mensajes que inicia la empresa, no el usuario).
    plantilla_content_sid: Mapped[Optional[str]] = mapped_column(String(64))

    # Rechazar los callbacks de /request-tw cuya cabecera X-Twilio-Signature
    # no calce. Viene activo: el webhook es público y sin esto cualquiera que
    # conozca la URL puede marcar movimientos como resueltos. Se apaga solo si
    # la firma no valida por la URL pública (ver PUBLIC_BASE_URL).
    validar_firma_webhook: Mapped[bool] = mapped_column(Boolean, default=True)

    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
