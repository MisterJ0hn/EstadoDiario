from datetime import datetime, time, timezone
from typing import Optional

from sqlalchemy import String, Boolean, Integer, DateTime, Time, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ConfiguracionCorreo(Base):
    """Casilla IMAP desde la que se importan los adjuntos, **una por usuario**.

    No confundir con `usuario.email`, que es el correo personal del usuario y
    solo se usa como destino de los informes. Ésta es una casilla aparte,
    dedicada a recibir los Excel del PJUD, y es la que define el dueño de todo
    lo que se descargue: lo importado queda a nombre de `usuario_id` y ningún
    otro usuario lo ve.

    Antes existía una sola fila global (id=1). Esa fila sobrevive con
    `usuario_id` nulo y ya no la usa el job de importación; se conserva para no
    perder credenciales configuradas.
    """

    __tablename__ = "configuracion_correo"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Dueño de la casilla. Nulo solo en la fila global heredada (ver docstring).
    usuario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id"), unique=True, index=True
    )

    activo: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Conexión IMAP ──
    # Gmail funciona como IMAP estándar: imap.gmail.com / 993 / SSL,
    # usando una contraseña de aplicación (requiere 2FA en la cuenta).
    host: Mapped[str] = mapped_column(String(255), default="imap.gmail.com")
    puerto: Mapped[int] = mapped_column(Integer, default=993)
    usar_ssl: Mapped[bool] = mapped_column(Boolean, default=True)
    usuario: Mapped[Optional[str]] = mapped_column(String(255))
    password_cifrado: Mapped[Optional[str]] = mapped_column(Text)
    carpeta: Mapped[str] = mapped_column(String(255), default="INBOX")

    # ── Filtros de seguridad ──
    # Lista blanca de remitentes separada por coma. Obligatoria: el buzón es
    # una entrada no autenticada y cualquiera puede mandar un adjunto.
    remitentes_permitidos: Mapped[Optional[str]] = mapped_column(Text)
    asunto_contiene: Mapped[Optional[str]] = mapped_column(String(255))
    max_tamano_mb: Mapped[int] = mapped_column(Integer, default=25)

    # ── Programación ──
    hora_ejecucion: Mapped[Optional[time]] = mapped_column(Time)
    marcar_como_leido: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── Estado de la última corrida ──
    ultima_ejecucion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ultimo_resultado: Mapped[Optional[str]] = mapped_column(Text)

    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Se llama `dueno` y no `usuario` a propósito: `usuario` ya es la columna
    # con el nombre de la cuenta IMAP, y una relación con ese nombre la taparía.
    dueno = relationship("Usuario", foreign_keys=[usuario_id])

    @property
    def lista_remitentes(self) -> list[str]:
        if not self.remitentes_permitidos:
            return []
        return [r.strip().lower() for r in self.remitentes_permitidos.split(",") if r.strip()]
