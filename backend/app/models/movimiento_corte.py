from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class MovimientoCorte(BaseTenant):
    """Causas de corte del reporte de Movimientos.

    Mismo criterio que `EstadoDiarioCorte`: el Excel trae una hoja por materia
    y además dos de corte, con otras columnas. Van a su propia tabla para que
    el listado por materia no tenga que mostrar filas que no calzan con sus
    columnas.

    **Ojo: no son las mismas columnas que las del estado diario.** Este reporte
    agrega `era`, `estado_causa` e `institucion`, y no trae tipo de recurso:

    - **Apelaciones**: Rol, Era, Corte, Fecha Ingreso, Ubicación,
      Fecha Ubicación, Caratulado, Estado causa, Institución.
    - **Suprema**: Rol, Era, Fecha Ingreso, Caratulado, Estado causa,
      Institución.

    Por eso son dos tablas y no una compartida con el estado diario: tienen
    origen distinto, columnas distintas y se consultan por separado.
    """

    __tablename__ = "movimiento_corte"

    TIPO_SUPREMA = "suprema"
    TIPO_APELACIONES = "apelaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    estado_diario_origen_id: Mapped[int] = mapped_column(
        ForeignKey("estado_diario_origen.id"), nullable=False, index=True
    )

    # De qué hoja salió. Es lo que explica por qué unas columnas vienen vacías.
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # ── Comunes a las dos hojas ──
    rol: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    # "Era" es el año del rol en la nomenclatura del PJUD; llega como columna
    # aparte y no pegada al rol.
    era: Mapped[Optional[str]] = mapped_column(String(20))
    fecha_ingreso: Mapped[Optional[date]] = mapped_column(Date)
    caratulado: Mapped[Optional[str]] = mapped_column(String(500))
    estado_causa: Mapped[Optional[str]] = mapped_column(String(255))
    institucion: Mapped[Optional[str]] = mapped_column(String(255))

    # ── Solo Corte de Apelaciones ──
    # Cuál corte ("C.A. de Valparaíso"). No confundir con `tipo`.
    corte: Mapped[Optional[str]] = mapped_column(String(255))
    ubicacion: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_ubicacion: Mapped[Optional[date]] = mapped_column(Date)

    # El permiso de visibilidad del estudio se aplica por jurisdicción, así que
    # estas filas también la llevan (ver EstadoDiarioCorte).
    jurisdiccion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jurisdiccion.id"), index=True
    )

    estado_diario_origen = relationship(
        "EstadoDiarioOrigen", back_populates="cortes_movimiento"
    )
    jurisdiccion = relationship("Jurisdiccion")
