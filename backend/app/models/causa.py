from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class Causa(BaseTenant):
    """Causa del estudio, de las hojas por materia del reporte de Causas.

    Es la **cartera**: todas las causas en que el estudio es parte, no lo que
    se movió un día (`EstadoDiario`) ni el detalle procesal de una
    (`Movimiento`). Por eso vive en su propia tabla y no cuelga de ninguna de
    esas dos.

    **Las hojas no traen las mismas columnas y esto es la unión de todas**:

    - **Civil / Laboral**: Rol, Tribunal, Fecha Ingreso, Caratulado,
      Estado Causa, Institución.
    - **Penal**: agrega Tipo Causa y Ruc, y llama Rit a lo que las otras
      llaman Rol.
    - **Cobranza**: **no trae Estado Causa.**
    - **Familia**: usa Rit y cambia el orden de las columnas.

    Que una celda quede nula no significa que falte el dato: significa que esa
    hoja no lo trae. Por eso ninguna de estas columnas es NOT NULL.
    """

    __tablename__ = "causa"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    estado_diario_origen_id: Mapped[int] = mapped_column(
        ForeignKey("estado_diario_origen.id"), nullable=False, index=True
    )

    # De qué hoja salió: "Civil", "Laboral", "Penal", "Cobranza", "Familia".
    # Es lo que alimenta las pestañas del listado y explica las celdas vacías.
    materia: Mapped[Optional[str]] = mapped_column(String(100), index=True)

    # Solo la hoja Penal la trae ("Ordinaria", "Exhorto").
    tipo_causa: Mapped[Optional[str]] = mapped_column(String(100))

    # El identificador de la causa. El Excel lo llama "Rol" en Civil, Laboral y
    # Cobranza, y "Rit" en Penal y Familia: es el mismo dato y va acá.
    rol: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    # Rol Único de Causa, solo en Penal.
    ruc: Mapped[Optional[str]] = mapped_column(String(100))

    tribunal: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_ingreso: Mapped[Optional[date]] = mapped_column(Date)
    caratulado: Mapped[Optional[str]] = mapped_column(String(500))
    estado_causa: Mapped[Optional[str]] = mapped_column(String(255))
    institucion: Mapped[Optional[str]] = mapped_column(String(255))

    # Jurisdicción deducida de la materia, para que el filtro de las pantallas
    # sea el mismo catálogo que usan estado diario y movimientos.
    jurisdiccion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jurisdiccion.id"), index=True
    )

    estado_diario_origen = relationship("EstadoDiarioOrigen", back_populates="causas")
    jurisdiccion = relationship("Jurisdiccion")
