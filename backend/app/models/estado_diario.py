from datetime import date, datetime
from typing import Optional, List

from sqlalchemy import String, Date, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class EstadoDiario(BaseTenant):
    __tablename__ = "estado_diario"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    estado_diario_origen_id: Mapped[int] = mapped_column(
        ForeignKey("estado_diario_origen.id"), nullable=False, index=True
    )
    jurisdiccion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jurisdiccion.id"), index=True
    )
    rol: Mapped[Optional[str]] = mapped_column(String(100))
    rol_unico: Mapped[Optional[str]] = mapped_column(String(100))
    fecha_ingreso: Mapped[Optional[date]] = mapped_column(Date)
    caratulado: Mapped[Optional[str]] = mapped_column(String(255))
    tribunal: Mapped[Optional[str]] = mapped_column(String(255))
    estado: Mapped[Optional[str]] = mapped_column(String(100))
    tipo_causa: Mapped[Optional[str]] = mapped_column(String(100))
    ubicacion: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_ubicacion: Mapped[Optional[date]] = mapped_column(Date)
    corte: Mapped[Optional[str]] = mapped_column(String(255))

    # Leído (en la UI la acción se llama "Resuelto")
    leido: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    fecha_leido: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    usuario_leido_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id"), index=True
    )
    # Comentario opcional que el usuario escribe al marcar el movimiento como
    # resuelto (por qué se cerró, qué se hizo). Puramente informativo.
    observacion_resuelto: Mapped[Optional[str]] = mapped_column(Text)

    # Pendiente
    pendiente: Mapped[bool] = mapped_column(Boolean, default=False)
    nivel_pendiente: Mapped[Optional[str]] = mapped_column(String(20))
    fecha_pendiente: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    usuario_pendiente_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id"), index=True
    )

    # Relationships
    estado_diario_origen = relationship("EstadoDiarioOrigen", back_populates="estados_diarios")
    jurisdiccion = relationship("Jurisdiccion")
    usuario_leido = relationship("Usuario", foreign_keys=[usuario_leido_id])
    usuario_pendiente = relationship("Usuario", foreign_keys=[usuario_pendiente_id])
    agendas: Mapped[List["EstadoDiarioAgenda"]] = relationship(
        "EstadoDiarioAgenda", back_populates="estado_diario", cascade="all, delete-orphan"
    )
