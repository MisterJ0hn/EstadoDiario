from datetime import date
from typing import Optional

from sqlalchemy import String, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class Movimiento(BaseTenant):
    """Fila del Excel "Movimientos", que es un reporte distinto al estado
    diario: lista el universo de causas vigentes de un RUT con su estado
    procesal, no las actuaciones del día. Por eso es solo consulta y no tiene
    leído/pendiente/agenda como EstadoDiario.

    No comparte tabla con `estado_diario` porque el archivo trae columnas que
    allá no existen (`era`, `estado_causa`, `institucion`) y le faltan otras.
    Sí comparte la tabla de archivos (`estado_diario_origen`, discriminada por
    su columna `tipo`) para que la vista "Archivos" liste ambos con una sola
    consulta.
    """

    __tablename__ = "movimiento"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    estado_diario_origen_id: Mapped[int] = mapped_column(
        ForeignKey("estado_diario_origen.id"), nullable=False, index=True
    )
    jurisdiccion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jurisdiccion.id"), index=True
    )

    # Nombre de la hoja del Excel (Civil, Familia, Laboral, Cobranza, Penal,
    # Corte Apelaciones, Corte Suprema). Es el equivalente a la materia y no
    # viene como columna: se toma del nombre de la hoja.
    materia: Mapped[Optional[str]] = mapped_column(String(100), index=True)

    # "Rit" en las hojas de primera instancia, "Rol" en las de Corte.
    rol: Mapped[Optional[str]] = mapped_column(String(100))
    # Solo en hojas de Corte (Apelaciones / Suprema). No existe en el estado diario.
    era: Mapped[Optional[str]] = mapped_column(String(20))
    tribunal: Mapped[Optional[str]] = mapped_column(String(255))
    corte: Mapped[Optional[str]] = mapped_column(String(255))
    caratulado: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_ingreso: Mapped[Optional[date]] = mapped_column(Date)
    # Columna "Estado Causa" del Excel: Tramitación / Concluido / Con Sentencia...
    estado_causa: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    # Columna "Institución": identificador del cliente/gestión en el PJUD.
    institucion: Mapped[Optional[str]] = mapped_column(String(255))
    ubicacion: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_ubicacion: Mapped[Optional[date]] = mapped_column(Date)

    # Relationships
    estado_diario_origen = relationship("EstadoDiarioOrigen", back_populates="movimientos")
    jurisdiccion = relationship("Jurisdiccion")
