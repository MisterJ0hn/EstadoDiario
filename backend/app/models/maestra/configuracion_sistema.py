from datetime import datetime, timezone
from typing import Optional

from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
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

    # Días de mora tras los cuales un cliente se suspende solo. Se cuenta desde
    # la emisión de la factura más antigua que sigue impaga: no hay fecha de
    # vencimiento en el documento, y la emisión es lo único que consta.
    #
    # **Cero = la suspensión automática está apagada.** Es el valor por defecto
    # a propósito: cortarle el acceso a un estudio es la acción más agresiva del
    # sistema, y no puede empezar a ocurrir sola porque alguien desplegó una
    # versión nueva. Hay que encenderla desde Configuración.
    dias_mora_suspension: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # ── Tarifas de la plataforma ──
    # Lo que se cobra por causa cuando el cliente no tiene un valor propio. Es
    # el piso de toda la facturación y por eso vive acá y no en una constante:
    # cambiar el precio de lista no puede exigir un despliegue.
    #
    # No reemplaza a `tarifa_cliente`: ahí siguen los valores negociados con
    # cada estudio, que pisan a estos. Y no reescribe el pasado — cada factura
    # copia el valor unitario que usó.
    #
    # Numeric y no Integer: hoy son pesos enteros, pero un precio con decimales
    # no debería obligar a migrar la columna. Nunca Float, que es lo que arruina
    # un total al cuadrar la contabilidad.
    tarifa_materia: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("1"), server_default="1"
    )
    tarifa_apelaciones: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("2"), server_default="2"
    )
    tarifa_suprema: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("3"), server_default="3"
    )

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
