from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseTenant


class PjudCopia(BaseTenant):
    """Última respuesta de api-pjud a un `consultar_*` / `consultar_movimientos_*`,
    tal como la devolvió el proveedor (JSON en texto).

    Es lo que sirve el espejo de api-pjud para los sistemas externos
    (`app/api/v1/endpoints/pjud_espejo.py`): mismo contrato que el proveedor, pero
    leído de acá mientras la copia esté vigente, sin gastar una consulta de la
    suscripción compartida. Vive en la base del cliente porque es dato operativo
    de su cartera.

    `clave` es el cuerpo de la consulta en JSON canónico, **sin** `rut`/`clave`/
    `metodo_login`: una credencial nunca se guarda, y dos sistemas que piden la
    misma causa con claves distintas comparten copia. `identificador` (el de
    api-pjud, no un id nuestro) une la cabecera con los movimientos de sus
    cuadernos, para invalidarlos juntos.
    """

    __tablename__ = "pjud_copia"
    __table_args__ = (
        UniqueConstraint("ruta", "clave", name="uq_pjud_copia_ruta_clave"),
        Index("ix_pjud_copia_identificador", "identificador"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Ruta de api-pjud que originó la copia, ej. `/consultar_civil`.
    ruta: Mapped[str] = mapped_column(String(60), nullable=False)
    clave: Mapped[str] = mapped_column(String(500), nullable=False)
    identificador: Mapped[Optional[str]] = mapped_column(String(100))
    # Texto y no JSONB: producción corre PostgreSQL 9.2.
    respuesta: Mapped[str] = mapped_column(Text, nullable=False)
    capturado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
