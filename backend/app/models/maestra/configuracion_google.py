from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class ConfiguracionGoogle(BaseMaestra):
    """Credenciales OAuth (Client ID/Secret) del proyecto de Google Cloud
    usadas para que cada usuario conecte su propio Google Calendar. Vive en la
    base principal: una fila global del sistema y, si hace falta, una por
    cliente (ver `cliente_id`)."""

    __tablename__ = "configuracion_google"

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
    client_id: Mapped[Optional[str]] = mapped_column(String(255))
    client_secret_cifrado: Mapped[Optional[str]] = mapped_column(Text)

    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
