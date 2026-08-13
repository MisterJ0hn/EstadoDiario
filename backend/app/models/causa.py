from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant

# De qué reporte salió la fila. El Excel de Causas es la fuente natural de la
# cartera; las otras dos existen porque una causa puede moverse (y por lo tanto
# aparecer en Movimientos o en el Estado Diario) sin estar todavía en el reporte
# de Causas, y en ese caso el estudio igual es parte.
ORIGEN_DATO_CAUSAS = "causas"
ORIGEN_DATO_MOVIMIENTOS = "movimientos"
ORIGEN_DATO_ESTADO_DIARIO = "estado_diario"
# Las audiencias no dan de alta causas —no traen la cartera— pero sí cuentan
# como señal de vida: una audiencia celebrada es actividad de esa causa.
ORIGEN_DATO_AUDIENCIAS = "audiencias"


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

    # ── Cruce con los otros dos reportes ──
    # De dónde salió esta fila: `causas` si vino del Excel de la cartera, o el
    # reporte que la dedujo (ver las constantes ORIGEN_DATO_* arriba). No es un
    # detalle interno: una causa deducida se factura igual que las demás, y
    # cuando alguien discuta una factura hay que poder decir de dónde salió.
    origen_dato: Mapped[str] = mapped_column(
        String(20), default=ORIGEN_DATO_CAUSAS, server_default=ORIGEN_DATO_CAUSAS
    )
    # Cuándo la tocó el cruce por última vez. Nulo = tal cual la trajo el Excel.
    enriquecida_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # ── Última señal de vida ──
    # La fecha más reciente en que esta causa apareció en ALGÚN reporte: estado
    # diario, movimientos o una audiencia ya celebrada. Es el dato que convierte
    # una cartera de 12.000 filas en algo administrable: sin él no hay forma de
    # saber cuáles se están moviendo y cuáles llevan un año dormidas.
    #
    # Va denormalizada y no se calcula al consultar porque solo cambia cuando
    # entra un archivo nuevo: recalcularla en cada listado sería recorrer tres
    # tablas por página para un dato que no se movió.
    ultima_actividad: Mapped[Optional[date]] = mapped_column(Date, index=True)
    # De qué reporte salió esa fecha, para poder explicarla en la pantalla.
    origen_actividad: Mapped[Optional[str]] = mapped_column(String(20))

    estado_diario_origen = relationship("EstadoDiarioOrigen", back_populates="causas")
    jurisdiccion = relationship("Jurisdiccion")
