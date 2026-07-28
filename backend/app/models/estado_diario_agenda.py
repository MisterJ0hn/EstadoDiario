from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EstadoDiarioAgenda(Base):
    __tablename__ = "estado_diario_agenda"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    estado_diario_id: Mapped[int] = mapped_column(
        ForeignKey("estado_diario.id"), nullable=False, index=True
    )
    usuario_registro_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id"), index=True
    )
    detalle: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_hora_registro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    enviado: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    fecha_envio: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    mensaje_error: Mapped[Optional[str]] = mapped_column(Text)
    twilio_sid: Mapped[Optional[str]] = mapped_column(String(64))

    # Relationships
    estado_diario = relationship("EstadoDiario", back_populates="agendas")
    usuario_registro = relationship("Usuario", foreign_keys=[usuario_registro_id])
