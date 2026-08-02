import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ReportePlantilla(Base):
    """Informe dinámico guardado: qué campos eligió el usuario y con qué
    filtros, para poder regenerarlo cuando quiera sin rearmarlo.

    `campos` y `filtros` van como JSON serializado en TEXT y no en un tipo
    JSON nativo a propósito: el servidor de producción corre PostgreSQL 9.2,
    que no tiene `jsonb` (llegó en 9.4) y cuyo `json` no aporta nada aquí
    porque nunca se consulta por dentro de estas columnas.
    """

    __tablename__ = "reporte_plantilla"

    # Origen de datos sobre el que se arma el informe.
    FUENTE_ESTADO_DIARIO = "estado_diario"
    FUENTE_MOVIMIENTOS = "movimientos"
    FUENTE_AGENDA = "agenda"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Dueño de la plantilla: cada usuario ve solo las suyas.
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id"), nullable=False, index=True
    )

    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text)
    fuente: Mapped[str] = mapped_column(String(30), default=FUENTE_ESTADO_DIARIO)

    # Lista ordenada de nombres de campo, tal como se mostrarán en el Excel.
    # El orden que eligió el usuario ES el orden de las columnas.
    campos: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # Diccionario de filtros (rango de fechas, estado, nivel, tribunal...).
    filtros: Mapped[Optional[str]] = mapped_column(Text)

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    ultima_generacion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ultimo_resultado: Mapped[Optional[str]] = mapped_column(Text)

    usuario = relationship("Usuario", foreign_keys=[usuario_id])

    @property
    def lista_campos(self) -> list[str]:
        try:
            valor = json.loads(self.campos or "[]")
        except ValueError:
            return []
        return [str(c) for c in valor] if isinstance(valor, list) else []

    @property
    def dict_filtros(self) -> dict:
        try:
            valor = json.loads(self.filtros or "{}")
        except ValueError:
            return {}
        return valor if isinstance(valor, dict) else {}
