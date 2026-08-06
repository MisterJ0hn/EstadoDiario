from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class EstadoDiarioCorte(BaseTenant):
    """Causas del estado diario que vienen de las cortes.

    El Excel del PJUD trae una hoja por materia (Civil, Familia, Laboral...) y
    además dos hojas de corte —**Corte Suprema** y **Corte Apelaciones**— que
    no tienen las mismas columnas que el resto: no traen rol único, ni
    tribunal, ni estado de la causa. Meterlas en `estado_diario` obligaba a
    dejar media tabla vacía y a que el listado por materia mostrara filas que
    no calzaban con sus columnas.

    Las dos hojas tampoco son iguales entre sí:

    - **Apelaciones**: Nº Ingreso, Fecha Ingreso, Ubicación, Fecha Ubicación,
      Corte, Caratulado.
    - **Suprema**: Nº Ingreso, Tipo Recurso, Fecha Ingreso, Caratulado.

    Van igual en una sola tabla, con `tipo` distinguiéndolas y las columnas que
    no aplican en nulo. Separarlas en dos tablas habría duplicado el listado,
    los filtros y los permisos para ganar cuatro columnas nulas.
    """

    __tablename__ = "estado_diario_corte"

    # Valores de `tipo`. Son los que decide la importación según la hoja.
    TIPO_SUPREMA = "suprema"
    TIPO_APELACIONES = "apelaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    estado_diario_origen_id: Mapped[int] = mapped_column(
        ForeignKey("estado_diario_origen.id"), nullable=False, index=True
    )

    # De qué hoja salió. Es lo que permite mostrar juntas dos cosas distintas
    # sin que se confundan, y filtrar por una de las dos.
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # ── Comunes a las dos hojas ──
    numero_ingreso: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    fecha_ingreso: Mapped[Optional[date]] = mapped_column(Date)
    caratulado: Mapped[Optional[str]] = mapped_column(String(500))

    # ── Solo Corte de Apelaciones ──
    ubicacion: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_ubicacion: Mapped[Optional[date]] = mapped_column(Date)
    # Nombre de la corte ("C.A. de Valparaíso"). No confundir con `tipo`: esto
    # es cuál corte, aquello es cuál de las dos hojas.
    corte: Mapped[Optional[str]] = mapped_column(String(255))

    # ── Solo Corte Suprema ──
    tipo_recurso: Mapped[Optional[str]] = mapped_column(String(255))

    # El permiso de visibilidad del estudio se aplica por jurisdicción, así que
    # estas filas también la llevan: se resuelve desde el nombre de la hoja al
    # importar. Sin esto, un usuario restringido a Civil vería las causas de
    # corte, que es justo lo que el permiso evita en el resto del sistema.
    jurisdiccion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jurisdiccion.id"), index=True
    )

    estado_diario_origen = relationship(
        "EstadoDiarioOrigen", back_populates="cortes_estado_diario"
    )
    jurisdiccion = relationship("Jurisdiccion")
