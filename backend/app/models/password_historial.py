from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseTenant


class PasswordHistorial(BaseTenant):
    """Contraseñas anteriores de un usuario del estudio, para no repetirlas.

    Guarda el HASH bcrypt, nunca la contraseña: la comprobación no es "¿está
    esta cadena en la lista?" sino un `checkpw` contra cada hash guardado, que
    es lo mismo que hace el login. Por eso tampoco sirve para nada más que
    para esto — de acá no se puede recuperar ninguna clave.

    Solo se conservan las últimas `HISTORIAL_MAXIMO` filas por usuario (ver
    `app/services/password_service.py`): guardar más sería acumular hashes que
    ya no vetan nada.

    El gemelo de la base principal es
    `app.models.maestra.password_historial_admin.PasswordHistorialAdmin`. Son
    dos tablas homónimas en bases distintas, igual que `usuario`.
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
