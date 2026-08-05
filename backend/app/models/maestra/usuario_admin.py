from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class UsuarioAdmin(BaseMaestra):
    """Administrador del sistema: la tabla `usuario` de la base principal.

    No confundir con `app.models.usuario.Usuario`, que es el usuario de un
    cliente y vive en la base del cliente. Son dos tablas homónimas en bases
    distintas y por eso están declaradas sobre metadatos distintos.

    Estos usuarios no operan causas: crean y administran clientes. Su login es
    de dos campos —usuario y password— porque no pertenecen a ningún cliente y
    no hay RUT que resolver.

    A diferencia del usuario de cliente, acá el nombre de usuario va en claro:
    no es dato personal de nadie ni hay tenant que aislar, y guardarlo cifrado
    solo obligaría a un hash extra para poder buscarlo.
    """

    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre: Mapped[Optional[str]] = mapped_column(String(200))
    correo: Mapped[Optional[str]] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Clave provisoria: el administrador sembrado en el primer arranque nace
    # con esto en True, y también queda así cualquier admin al que se le
    # resetee la clave. Con la marca puesta el login funciona (hay que poder
    # entrar a cambiarla), pero el resto de la administración queda bloqueado
    # hasta que se cambie — ver `require_admin` en app/core/deps.py.
    debe_cambiar_password: Mapped[bool] = mapped_column(Boolean, default=False)

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    ultimo_acceso: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
