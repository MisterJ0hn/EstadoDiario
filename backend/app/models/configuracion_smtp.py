from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, Integer, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConfiguracionSmtp(Base):
    """Cuenta remitente del sistema, única y global (fila id=1), usada para
    despachar los informes por correo.

    Es deliberadamente distinta de `ConfiguracionCorreo`: aquella es IMAP de
    ENTRADA y hay una por usuario; ésta es SMTP de SALIDA y es del sistema. Un
    usuario no envía desde su propia casilla — el informe le llega *desde* el
    sistema *a* su `usuario.email`.
    """

    __tablename__ = "configuracion_smtp"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    activo: Mapped[bool] = mapped_column(Boolean, default=False)

    host: Mapped[str] = mapped_column(String(255), default="smtp.gmail.com")
    puerto: Mapped[int] = mapped_column(Integer, default=587)
    # STARTTLS (587) es lo habitual; SSL directo (465) requiere usar_ssl.
    usar_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    usar_ssl: Mapped[bool] = mapped_column(Boolean, default=False)

    usuario: Mapped[Optional[str]] = mapped_column(String(255))
    # Cifrado con la misma clave/utilidad que ConfiguracionCorreo.password_cifrado.
    password_cifrado: Mapped[Optional[str]] = mapped_column(Text)

    # Dirección y nombre que ve el destinatario. Si va vacío se usa `usuario`.
    remitente_email: Mapped[Optional[str]] = mapped_column(String(255))
    remitente_nombre: Mapped[Optional[str]] = mapped_column(String(255), default="Estado Diario")

    # ── Estado del último envío ──
    ultimo_envio: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ultimo_resultado: Mapped[Optional[str]] = mapped_column(Text)

    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
