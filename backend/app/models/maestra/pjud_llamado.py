from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class PjudLlamado(BaseMaestra):
    """Una fila por cada consulta de "Detalle PJUD" que hace un estudio contra
    api-pjud.codifica.cl.

    **Vive en la base principal**, no en la del cliente, porque la credencial
    de api-pjud es de la PLATAFORMA (una sola suscripción de Temposoft para
    todos los estudios) y lo que se quiere responder desde la consola es "¿qué
    está pasando con la API?" mirando todo junto: la cuota del proveedor, si
    está lenta, si una causa quedó pegada sincronizando. Repartido una base por
    estudio no se podría ver eso sin recorrer las cincuenta.

    Es de solo lectura desde la consola: se consulta para soporte, no se edita.
    Solo crece, así que conviene purgarla por antigüedad más adelante.
    """

    __tablename__ = "pjud_llamado"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Qué estudio disparó la consulta. FK real: esta tabla y `cliente` viven en
    # la misma base.
    cliente_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cliente.cliente_id"), index=True
    )
    # Redundante con cliente_id pero se guarda igual: si el cliente se borra, la
    # fila del log sigue diciendo de qué base salió.
    guid: Mapped[Optional[str]] = mapped_column(String(50))
    # Id del usuario del estudio en SU base. No es FK: apunta a otra base.
    usuario_id: Mapped[Optional[int]] = mapped_column(Integer)

    # Id de la causa en la base del cliente. Tampoco FK, por lo mismo.
    causa_id: Mapped[Optional[int]] = mapped_column(Integer)
    rol: Mapped[Optional[str]] = mapped_column(String(50))
    tribunal: Mapped[Optional[str]] = mapped_column(String(255))

    # `true` cuando el usuario apretó "Actualizar desde el PJUD".
    forzar: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Cómo terminó: 'listo' | 'sincronizando' | 'error'.
    resultado: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # 200 (listo), 202 (sincronizando) o 502 (error).
    http_status: Mapped[Optional[int]] = mapped_column(Integer)
    # El mensaje que se le mostró al usuario: el aviso de "sincronizando" o el
    # texto del error. En 'listo' queda nulo.
    mensaje: Mapped[Optional[str]] = mapped_column(Text)

    # Notas técnicas paso a paso: qué respondió `/consultar_civil` (404 vs
    # Sincronizando + fecha de última sync), qué respondió `/sincronizar_civil`
    # (200 vs 409), cuántos trámites trajo. Es lo que responde "¿y por qué sigue
    # sincronizando?" sin abrir los logs del servidor de api-pjud.
    diagnostico: Mapped[Optional[str]] = mapped_column(Text)

    duracion_ms: Mapped[Optional[int]] = mapped_column(Integer)
