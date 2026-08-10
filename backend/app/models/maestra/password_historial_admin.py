from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class PasswordHistorialAdmin(BaseMaestra):
    """Contraseñas anteriores de un administrador de la PLATAFORMA.

    Misma tabla y mismo propósito que
    `app.models.password_historial.PasswordHistorial`, pero en la base
    principal: `usuario_id` apunta al `usuario` de allá, que es
    `UsuarioAdmin`. Están declaradas por separado porque van sobre metadatos
    distintos; con una sola clase, `create_all()` de la base principal crearía
    también la tabla del tenant y viceversa.
    """

    __tablename__ = "usuario_password_historial"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id"), nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
