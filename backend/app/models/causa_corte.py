from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class CausaCorte(BaseTenant):
    """Causas de corte del reporte de Causas.

    Mismo criterio que `EstadoDiarioCorte` y `MovimientoCorte`: el Excel trae
    una hoja por materia y además dos de corte, con otras columnas. Van a su
    propia tabla para que el listado por materia no muestre filas que no calzan
    con sus columnas.

    **Ojo: son tres tablas de corte y no una.** Los tres reportes traen hojas
    llamadas igual con datos distintos, y mezclarlas haría imposible saber de
    qué reporte vino cada fila. Este trae:

    - **Apelaciones**: Rol, Era, Corte, Fecha Ingreso, Ubicación,
      Fecha Ubicación, Caratulado, **Estado Procesal**, Institución.
    - **Suprema**: Rol, Era, Fecha Ingreso, Caratulado, **Estado Causa**,
      Institución.

    Las dos hojas nombran distinto la misma columna (Estado Procesal / Estado
    Causa) y las dos van a `estado_procesal`.
    """

    __tablename__ = "causa_corte"

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
    estado_procesal: Mapped[Optional[str]] = mapped_column(String(255))
    institucion: Mapped[Optional[str]] = mapped_column(String(255))

    # ── Solo Corte de Apelaciones ──
    # Cuál corte ("C.A. de Valparaíso"). No confundir con `tipo`.
    corte: Mapped[Optional[str]] = mapped_column(String(255))
    ubicacion: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_ubicacion: Mapped[Optional[date]] = mapped_column(Date)

    jurisdiccion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jurisdiccion.id"), index=True
    )

    estado_diario_origen = relationship("EstadoDiarioOrigen", back_populates="causas_corte")
    jurisdiccion = relationship("Jurisdiccion")
