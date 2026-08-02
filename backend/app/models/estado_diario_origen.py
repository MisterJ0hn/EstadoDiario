from datetime import date, datetime, timezone
from typing import Optional, List

from sqlalchemy import String, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EstadoDiarioOrigen(Base):
    """Archivo Excel recibido. A pesar del nombre histórico de la tabla,
    guarda los dos tipos que maneja el sistema (ver `tipo`): el estado diario
    y el reporte de movimientos. La vista "Archivos" los lista juntos y separa
    por pestañas con esa columna.
    """

    __tablename__ = "estado_diario_origen"

    # Valores de `tipo`. El estado diario es el default porque todas las filas
    # que existían antes de que hubiera movimientos son de ese tipo.
    TIPO_ESTADO_DIARIO = "estado_diario"
    TIPO_MOVIMIENTOS = "movimientos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_carga_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id"), index=True
    )
    # Discriminador del contenido del archivo. Ver TIPO_* arriba.
    tipo: Mapped[str] = mapped_column(
        String(20), default=TIPO_ESTADO_DIARIO, server_default=TIPO_ESTADO_DIARIO, index=True
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
    # `usuario_carga_id` es además el DUEÑO del archivo: cada usuario solo ve
    # los suyos (el admin ve todos). No es solo trazabilidad de quién subió.
    usuario_carga = relationship("Usuario", foreign_keys=[usuario_carga_id])
    estados_diarios: Mapped[List["EstadoDiario"]] = relationship(
        "EstadoDiario", back_populates="estado_diario_origen", cascade="all, delete-orphan"
    )
    movimientos: Mapped[List["Movimiento"]] = relationship(
        "Movimiento", back_populates="estado_diario_origen", cascade="all, delete-orphan"
    )
