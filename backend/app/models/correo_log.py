from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


# Resultados posibles de procesar un mensaje/adjunto
RESULTADO_IMPORTADO = "importado"
RESULTADO_DESCARTADO = "descartado"   # no cumple filtros o el nombre no calza
RESULTADO_DUPLICADO = "duplicado"     # ya se había importado antes
RESULTADO_ERROR = "error"             # falló la lectura o la importación
RESULTADO_CONEXION = "conexion"       # falló la conexión IMAP (sin mensaje asociado)


class CorreoLog(Base):
    """Bitácora de la ingesta por correo, visible para el administrador.

    Se registra una fila por mensaje/adjunto evaluado, incluidos los que se
    descartan: si el estado diario del día no llegó o vino con otro nombre,
    el admin tiene que poder verlo aquí.
    """

    __tablename__ = "correo_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    # Message-ID de RFC 5322: estable y único, a diferencia del UID de IMAP
    # que depende de la carpeta y del UIDVALIDITY. Es la clave de dedupe.
    message_id: Mapped[Optional[str]] = mapped_column(String(500), index=True)
    remitente: Mapped[Optional[str]] = mapped_column(String(500))
    asunto: Mapped[Optional[str]] = mapped_column(String(500))
    nombre_archivo: Mapped[Optional[str]] = mapped_column(String(255))

    resultado: Mapped[str] = mapped_column(String(30), index=True)
    detalle: Mapped[Optional[str]] = mapped_column(Text)

    # Nulo salvo que el resultado sea "importado"
    estado_diario_origen_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("estado_diario_origen.id", ondelete="SET NULL")
    )
    movimientos_importados: Mapped[Optional[int]] = mapped_column()

    # "manual" (botón de la UI) o "programado" (job)
    disparo: Mapped[str] = mapped_column(String(20), default="manual")


Index("ix_correo_log_msgid_archivo", CorreoLog.message_id, CorreoLog.nombre_archivo)
