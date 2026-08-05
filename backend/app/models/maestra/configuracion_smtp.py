from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class ConfiguracionSmtp(BaseMaestra):
    """Cuenta remitente usada para despachar los informes por correo.

    Es deliberadamente distinta de `ConfiguracionCorreo`: aquella es IMAP de
    ENTRADA y hay una por cliente; ésta es SMTP de SALIDA y por defecto es del
    sistema (fila con `cliente_id` NULL). Un usuario no envía desde su propia
    casilla — el informe le llega *desde* el sistema *a* su correo.
    """

    __tablename__ = "configuracion_smtp"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Configuración POR CLIENTE. NULL = fila global del sistema, que es la que
    # se usa cuando el cliente no tiene la suya: las credenciales del proveedor
    # (Twilio, la cuenta SMTP de salida, el proyecto de Google Cloud) suelen
    # ser del SaaS y no del estudio, pero un cliente grande puede querer las
    # propias. OJO: en PostgreSQL el UNIQUE no agrupa los NULL, así que no
    # impide dos filas globales; el repositorio toma la de menor id.
    cliente_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cliente.cliente_id"), unique=True, index=True
    )

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
