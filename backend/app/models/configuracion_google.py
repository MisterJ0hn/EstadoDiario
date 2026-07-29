from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConfiguracionGoogle(Base):
    """Credenciales OAuth (Client ID/Secret) del proyecto de Google Cloud
    usadas para que cada usuario conecte su propio Google Calendar.
    Configuración única (global), se espera una sola fila, id=1."""

    __tablename__ = "configuracion_google"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    activo: Mapped[bool] = mapped_column(Boolean, default=False)
    client_id: Mapped[Optional[str]] = mapped_column(String(255))
    client_secret_cifrado: Mapped[Optional[str]] = mapped_column(Text)

    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
