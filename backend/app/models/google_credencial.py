from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class GoogleCredencial(BaseTenant):
    """Conexión OAuth de un usuario a su Google Calendar personal.

    No se cachea el access token: se pide uno nuevo con el refresh token en
    cada llamada (lo maneja la librería oficial de Google), evitando lógica
    de expiración duplicada.
    """

    __tablename__ = "google_credencial"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id"), unique=True, nullable=False, index=True
    )
    google_email: Mapped[Optional[str]] = mapped_column(String(255))
    refresh_token_cifrado: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_conexion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    usuario = relationship("Usuario", foreign_keys=[usuario_id])
