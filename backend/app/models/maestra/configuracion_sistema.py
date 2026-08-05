from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import settings
from app.core.database import BaseMaestra


class ConfiguracionSistema(BaseMaestra):
    """Parámetros de plataforma, una sola fila (id=1) en la base principal.

    Acá vive lo que el administrador del sistema fija **para todos los
    clientes**, empezando por la política de permanencia de la bitácora de
    actividad. Cada cliente puede tener su propio override
    (`cliente.dias_retencion_log`), pero si no lo tiene manda este valor.

    Se modela como tabla y no como variable de entorno a propósito: el usuario
    la cambia desde la consola de administración y tiene que tomar efecto sin
    redesplegar.
    """

    __tablename__ = "configuracion_sistema"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Días que se conserva log_actividades cuando el cliente no fija los suyos.
    dias_retencion_log: Mapped[int] = mapped_column(
        Integer, default=settings.LOG_ACTIVIDADES_DIAS_RETENCION
    )

    # Dominio de la casilla por defecto de cada cliente (<guid>@dominio). Se
    # guarda acá además de en settings para poder cambiarlo sin redesplegar;
    # el valor de settings es solo la semilla de la primera fila.
    dominio_inbox: Mapped[str] = mapped_column(String(255), default=settings.INBOX_DOMINIO)

    # Permite cerrar el alta de clientes nuevos sin tocar el código (por
    # ejemplo, durante una mantención).
    permitir_nuevos_clientes: Mapped[bool] = mapped_column(Boolean, default=True)

    # Última vez que se purgó la bitácora de actividad, la haya disparado el
    # job nocturno o el botón de la consola. Se muestra en la pantalla de
    # configuración: sin esto no hay forma de saber si la política se aplica.
    ultima_purga: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    fecha_modificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    # Quién la cambió por última vez (id de usuario.id de la base principal).
    modificado_por: Mapped[Optional[int]] = mapped_column(Integer)
