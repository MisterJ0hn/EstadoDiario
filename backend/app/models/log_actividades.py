from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseTenant


class LogActividades(BaseTenant):
    """Bitácora de lo que hace cada usuario dentro de la base de su cliente.

    Una fila por acción: qué módulo, qué acción, quién, desde qué IP y cuándo.
    Crece rápido y no se consulta hacia atrás más allá de la ventana que fije
    el administrador, por eso tiene **política de permanencia**: la purga borra
    lo más viejo que `cliente.dias_retencion_log` (configurable por cliente
    desde la base principal).

    `fecha_hora` se guarda en UTC como todos los timestamps del sistema; el
    listado la convierte a America/Santiago para mostrarla y para agrupar por
    día.
    """

    __tablename__ = "log_actividades"
    __table_args__ = (
        # Consulta del listado: "actividad de este usuario, de la más reciente
        # a la más antigua". Compuesto y en este orden para que resuelva filtro
        # y orden de una pasada.
        Index("ix_log_actividades_usuario_fecha", "usuario_id", "fecha_hora"),
        # La purga borra por antigüedad (WHERE fecha_hora < ?). Sin este índice
        # recorre entera la tabla más grande del cliente en cada corrida.
        Index("ix_log_actividades_fecha_hora", "fecha_hora"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Módulo de la aplicación: "estado_diario", "movimientos", "audiencias",
    # "reportes", "usuarios", "configuracion"...
    modulo: Mapped[str] = mapped_column(String(50), nullable=False)
    # Qué se hizo: "crear", "editar", "eliminar", "importar", "login"...
    accion: Mapped[str] = mapped_column(String(50), nullable=False)

    # Quién. Nullable porque los intentos de login fallidos también se
    # registran y ahí todavía no hay usuario resuelto.
    usuario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuario.id"))

    # IP del cliente. 45 caracteres para que quepa una IPv6 completa.
    ip: Mapped[Optional[str]] = mapped_column(String(45))

    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Texto libre con el detalle de la acción (id afectado, nombre del archivo).
    # Opcional: sin esto la bitácora dice qué pasó pero no sobre qué.
    detalle: Mapped[Optional[str]] = mapped_column(String(500))
