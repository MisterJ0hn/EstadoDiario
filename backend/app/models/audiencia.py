from datetime import date, datetime, time, timezone
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class Audiencia(BaseTenant):
    """Fila del Excel "Audiencias": una audiencia agendada por el tribunal.

    Es el tercer reporte del PJUD que maneja el sistema y el único que mira
    hacia adelante — el archivo cubre un RANGO DE FECHAS FUTURO (una semana en
    los que llegan por correo), no un día ya ocurrido. De ahí las dos
    diferencias de diseño con `Movimiento`:

    1. **Deduplicación.** Los archivos consecutivos se traslapan: la audiencia
       del jueves aparece en el archivo de esta semana y en el de la próxima.
       Sin dedup, el listado y el calendario mostrarían la misma audiencia
       varias veces. Por eso existe `clave_natural` + el UNIQUE de abajo, y la
       importación hace upsert en vez de INSERT ciego.
    2. **Dueño denormalizado (`usuario_id`).** El resto del sistema deriva la
       propiedad del dato desde `estado_diario_origen.usuario_carga_id`. Acá
       hace falta la columna propia porque el UNIQUE de deduplicación tiene que
       ser POR USUARIO: dos abogados distintos sí pueden tener cargada la misma
       audiencia, y son filas legítimamente separadas.

    Fecha y hora van en columnas separadas y NO como timestamptz a propósito:
    "audiencia a las 10:00" es hora de reloj del tribunal (America/Santiago).
    Guardarla como instante obligaría a fijar el offset en la importación y
    dejaría el dato expuesto a los cambios de horario de verano de Chile.
    """

    __tablename__ = "audiencia"
    __table_args__ = (
        # Deduplicación entre archivos traslapados. Va por usuario porque cada
        # uno importa sus propios archivos y no comparten filas. Su índice
        # también resuelve la búsqueda por clave de la importación.
        UniqueConstraint("usuario_id", "clave_natural", name="ux_audiencia_usuario_clave"),
        # La consulta caliente del módulo: "próximas audiencias del usuario"
        # (WHERE usuario_id = ? AND fecha_audiencia >= ? ORDER BY fecha_audiencia).
        # Compuesto y en ese orden, para que el índice resuelva filtro y orden
        # de una sola pasada en vez de ordenar en memoria.
        Index("ix_audiencia_usuario_fecha", "usuario_id", "fecha_audiencia"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Último archivo que trajo esta audiencia. Se actualiza en cada reimportación
    # para que el listado apunte siempre a la carga más reciente. Nullable con
    # ON DELETE SET NULL: si se borra ese archivo la audiencia sobrevive (la
    # trajeron también archivos anteriores), solo pierde la procedencia.
    estado_diario_origen_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("estado_diario_origen.id", ondelete="SET NULL"), index=True
    )
    # Dueño del dato. NOT NULL: sin dueño la fila no la vería nadie y además
    # el UNIQUE de arriba no la protegería (en PostgreSQL los NULL son
    # distintos entre sí y el índice único no los agrupa).
    # Sin index=True propio: lo cubren el UNIQUE y el compuesto de __table_args__,
    # ambos con usuario_id como primera columna.
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"), nullable=False)
    jurisdiccion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jurisdiccion.id"), index=True
    )

    # Nombre de la hoja del Excel (Familia, Laboral, Penal). Igual que en
    # Movimiento, la materia no viene como columna.
    materia: Mapped[Optional[str]] = mapped_column(String(100), index=True)

    # "Rit" en las hojas de Familia y Laboral. La hoja Penal no lo trae: ahí la
    # causa se identifica solo por RUC.
    rol: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    ruc: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    caratulado: Mapped[Optional[str]] = mapped_column(String(255))
    tribunal: Mapped[Optional[str]] = mapped_column(String(255))
    sala: Mapped[Optional[str]] = mapped_column(String(100))
    tipo_audiencia: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    juez: Mapped[Optional[str]] = mapped_column(String(255))
    # Solo la hoja Penal trae "Estado" de la audiencia (agendada, realizada...).
    estado: Mapped[Optional[str]] = mapped_column(String(100))

    # Día de la audiencia. NOT NULL e indexado: es el eje de todo el módulo
    # ("próximas audiencias" y el calendario filtran y ordenan por acá). Las
    # filas del Excel sin fecha parseable se descartan en la importación.
    fecha_audiencia: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # Hora de reloj local del tribunal. Nullable: la hoja Penal puede traer la
    # fecha sin hora utilizable.
    hora: Mapped[Optional[time]] = mapped_column(Time)

    # SHA-1 de los campos que identifican la audiencia (ver
    # audiencia_import_service.calcular_clave_natural). Es un hash y no los
    # campos sueltos porque varios son NULL-ables y en PostgreSQL un UNIQUE con
    # NULL no deduplica.
    clave_natural: Mapped[str] = mapped_column(String(40), nullable=False)

    # ── Google Calendar ──
    # Misma estrategia best-effort que EstadoDiarioAgenda: si la sincronización
    # falla, la audiencia igual queda guardada y el error queda acá.
    google_event_id: Mapped[Optional[str]] = mapped_column(String(255))
    google_calendar_id: Mapped[Optional[str]] = mapped_column(String(255))
    google_sync_error: Mapped[Optional[str]] = mapped_column(Text)

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    estado_diario_origen = relationship("EstadoDiarioOrigen", back_populates="audiencias")
    usuario = relationship("Usuario", foreign_keys=[usuario_id])
    jurisdiccion = relationship("Jurisdiccion")
