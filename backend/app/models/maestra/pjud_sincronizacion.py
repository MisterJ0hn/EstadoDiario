from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class PjudSincronizacion(BaseMaestra):
    """Una fila por cada job de `sincronizar_*` que se le encola a api-pjud.

    api-pjud responde un `job_id` al encolar y, al terminar, avisa con un POST a
    `callback_url` (`POST /causas/pjud/callback`). Esta tabla es lo que une las
    dos puntas: guarda el job al encolarlo (`sincronizando`) y lo cierra cuando
    llega el aviso (`listo` o `error` + `mensaje_error`). Con eso el estado de la
    sincronización se lee de acá y no de `consultar_*`.

    **Vive en la base principal**, igual que `PjudLlamado`: el callback es público
    y no trae a qué estudio pertenece, así que se resuelve por `job_id`, y desde
    ahí al cliente. Además la cartera de `Causa` se reemplaza con cada archivo
    cargado y su id cambia: el estado no puede colgar de esa tabla.
    """

    __tablename__ = "pjud_sincronizacion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    job_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)

    cliente_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cliente.cliente_id"), index=True
    )
    # Id de la causa en la base del cliente (de `causa_corte` si la materia es
    # 'Apelaciones'). No es FK: apunta a otra base.
    causa_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    materia: Mapped[Optional[str]] = mapped_column(String(20))
    rol: Mapped[Optional[str]] = mapped_column(String(50))
    tribunal: Mapped[Optional[str]] = mapped_column(String(255))

    # 'sincronizando' | 'listo' | 'error'.
    estado: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    mensaje_error: Mapped[Optional[str]] = mapped_column(Text)

    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
