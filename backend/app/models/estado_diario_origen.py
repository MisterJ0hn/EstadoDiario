from datetime import date, datetime, timezone
from typing import Optional, List

from sqlalchemy import Boolean, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class EstadoDiarioOrigen(BaseTenant):
    """Archivo Excel recibido. A pesar del nombre histórico de la tabla,
    guarda los tres tipos que maneja el sistema (ver `tipo`): el estado diario,
    el reporte de movimientos y el de audiencias. La vista "Archivos" los lista
    juntos y separa por pestañas con esa columna.
    """

    __tablename__ = "estado_diario_origen"

    # Valores de `tipo`. El estado diario es el default porque todas las filas
    # que existían antes de que hubiera movimientos son de ese tipo.
    TIPO_ESTADO_DIARIO = "estado_diario"
    TIPO_MOVIMIENTOS = "movimientos"
    TIPO_AUDIENCIAS = "audiencias"
    TIPO_CAUSAS = "causas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_carga_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id"), index=True
    )
    # Discriminador del contenido del archivo. Ver TIPO_* arriba.
    tipo: Mapped[str] = mapped_column(
        String(20), default=TIPO_ESTADO_DIARIO, server_default=TIPO_ESTADO_DIARIO, index=True
    )
    rut: Mapped[Optional[str]] = mapped_column(String(20))
    # Fecha del reporte. En los archivos de audiencias, que cubren un rango, es
    # el INICIO del rango (el fin queda en `nombre_archivo`).
    fecha: Mapped[Optional[date]] = mapped_column(Date)
    guid: Mapped[Optional[str]] = mapped_column(String(50))
    nombre_archivo: Mapped[Optional[str]] = mapped_column(String(255))
    url: Mapped[Optional[str]] = mapped_column(String(255))
    fecha_carga: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Este "archivo" no lo subió nadie: lo armó el cruce con lo que traían el
    # estado diario y los movimientos, porque el estudio todavía no ha cargado
    # el reporte de Causas (ver `CarteraSyncService.sincronizar`).
    #
    # **Por qué hace falta distinguirlo.** Una cartera deducida es parcial por
    # construcción —el estado diario de un día trae decenas de causas y el
    # reporte de Causas, miles— y sin embargo es la cartera vigente mientras
    # sea el último origen de tipo `causas`: se muestra en Mis Causas y se
    # factura. Dos cosas dependen de poder reconocerla: la pantalla, para no
    # presentarla como si fuera la cartera completa, y la carga del reporte
    # real, que la reemplaza en vez de chocar con ella.
    deducida: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )

    # Relationships
    # `usuario_carga_id` es además el DUEÑO del archivo: cada usuario solo ve
    # los suyos (el admin ve todos). No es solo trazabilidad de quién subió.
    usuario_carga = relationship("Usuario", foreign_keys=[usuario_carga_id])
    estados_diarios: Mapped[List["EstadoDiario"]] = relationship(
        "EstadoDiario", back_populates="estado_diario_origen", cascade="all, delete-orphan"
    )
    movimientos: Mapped[List["Movimiento"]] = relationship(
        "Movimiento", back_populates="estado_diario_origen", cascade="all, delete-orphan"
    )
    # Las causas de corte de los dos reportes. Van con la misma cascada que sus
    # hermanas: sin esto, borrar un archivo desde Bitácora falla con una
    # violación de clave foránea.
    cortes_estado_diario: Mapped[List["EstadoDiarioCorte"]] = relationship(
        "EstadoDiarioCorte", back_populates="estado_diario_origen", cascade="all, delete-orphan"
    )
    cortes_movimiento: Mapped[List["MovimientoCorte"]] = relationship(
        "MovimientoCorte", back_populates="estado_diario_origen", cascade="all, delete-orphan"
    )
    # La cartera de causas y sus hojas de corte. Misma cascada por el mismo
    # motivo que arriba.
    causas: Mapped[List["Causa"]] = relationship(
        "Causa", back_populates="estado_diario_origen", cascade="all, delete-orphan"
    )
    causas_corte: Mapped[List["CausaCorte"]] = relationship(
        "CausaCorte", back_populates="estado_diario_origen", cascade="all, delete-orphan"
    )
    # Sin delete-orphan, a diferencia de los otros dos: una audiencia sobrevive
    # a sus archivos porque se deduplica entre cargas traslapadas y
    # `estado_diario_origen_id` apunta solo al último que la trajo. Borrar ese
    # archivo dejaría la audiencia sin procedencia (SET NULL), no la borra:
    # sigue siendo una audiencia agendada de verdad.
    audiencias: Mapped[List["Audiencia"]] = relationship(
        "Audiencia", back_populates="estado_diario_origen", passive_deletes=True
    )
