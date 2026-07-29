from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConfiguracionWhatsapp(Base):
    """Credenciales de Twilio para el envío de recordatorios por WhatsApp.
    Configuración única (global), se espera una sola fila, id=1."""

    __tablename__ = "configuracion_whatsapp"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    activo: Mapped[bool] = mapped_column(Boolean, default=False)
    twilio_account_sid: Mapped[Optional[str]] = mapped_column(String(64))
    twilio_auth_token_cifrado: Mapped[Optional[str]] = mapped_column(Text)
    # Formato Twilio: "whatsapp:+14155238886"
    twilio_numero_whatsapp: Mapped[Optional[str]] = mapped_column(String(40))
    # Content SID de la plantilla de WhatsApp ya aprobada (requerida por
    # Twilio para mensajes que inicia la empresa, no el usuario).
    plantilla_content_sid: Mapped[Optional[str]] = mapped_column(String(64))

    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
