from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class ApiLlamadoEstadoDiario(BaseTenant):
    __tablename__ = "api_llamado_estado_diario"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    endpoint: Mapped[str] = mapped_column(String(100), nullable=False)
    estado_diario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("estado_diario.id")
    )
    json_request: Mapped[Optional[str]] = mapped_column(Text)
    json_response: Mapped[Optional[str]] = mapped_column(Text)
    exito: Mapped[Optional[bool]] = mapped_column(Boolean)
    mensaje_error: Mapped[Optional[str]] = mapped_column(Text)
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    estado_diario = relationship("EstadoDiario")
