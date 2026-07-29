from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre: Mapped[Optional[str]] = mapped_column(String(200))
    apellido: Mapped[Optional[str]] = mapped_column(String(200))
    # Formato libre (E.164 recomendado, ej. +56912345678): número por defecto
    # para los recordatorios de WhatsApp, editable al crear cada uno.
    telefono: Mapped[Optional[str]] = mapped_column(String(30))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    rol: Mapped[str] = mapped_column(String(50), default="usuario")  # admin, usuario
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
