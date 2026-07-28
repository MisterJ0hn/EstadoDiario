from datetime import date, datetime, timezone
from typing import Optional, List

from sqlalchemy import String, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EstadoDiarioOrigen(Base):
    __tablename__ = "estado_diario_origen"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_carga_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id"), index=True
    )
    rut: Mapped[Optional[str]] = mapped_column(String(20))
    fecha: Mapped[Optional[date]] = mapped_column(Date)
    guid: Mapped[Optional[str]] = mapped_column(String(50))
    nombre_archivo: Mapped[Optional[str]] = mapped_column(String(255))
    url: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_carga: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    usuario_carga = relationship("Usuario", foreign_keys=[usuario_carga_id])
    movimientos: Mapped[List["EstadoDiario"]] = relationship(
        "EstadoDiario", back_populates="estado_diario_origen", cascade="all, delete-orphan"
    )
