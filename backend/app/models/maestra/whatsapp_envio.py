from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseMaestra


class WhatsappEnvio(BaseMaestra):
    """A qué cliente pertenece cada mensaje de WhatsApp que salió por Twilio.

    Existe por el webhook `/api/v1/estado-diario/request-tw`, que es público:
    quien llama es Twilio y no trae un JWT, así que no hay de dónde sacar el
    tenant. El recordatorio vive en `estado_diario_agenda.twilio_sid` de la base
    de UN cliente, y sin saber cuál no se puede ni empezar a buscarlo.

    Con un solo número de WhatsApp para todos los estudios (la fila global de
    `configuracion_whatsapp`), el callback tampoco ayuda: `To` es el número del
    SaaS y `From` es el teléfono del abogado. Lo único que identifica el mensaje
    es su SID, y por eso se anota acá al enviarlo.

    Vive en la base principal justamente porque la pregunta que responde es
    "¿en qué base está esto?": guardarla en la base del cliente sería el mismo
    problema de nuevo.
    """

    __tablename__ = "whatsapp_envio"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # El SID que Twilio devuelve en el callback como OriginalRepliedMessageSid.
    #
    # Indexada pero NO única, a propósito. Twilio no debería repetir un SID,
    # pero `EstadoDiarioAgendaRepository.find_by_twilio_sid` ya contempla que
    # pueda pasar, y acá un UNIQUE convertiría ese caso raro en algo mucho peor:
    # las filas se insertan todas juntas y se confirman en un solo commit al
    # final del envío, así que un choque tumbaría el índice de TODO el lote, no
    # solo el de la fila repetida. Se resuelve leyendo la más reciente, igual
    # que hace el repositorio del lado del cliente.
    twilio_sid: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("cliente.cliente_id"), nullable=False, index=True
    )

    # Para poder purgar lo viejo más adelante: un recordatorio contestado meses
    # después no existe, y estas filas solo crecen.
    fecha_envio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Id de la fila de `estado_diario_agenda` en la base del cliente. No es
    # ForeignKey: apunta a OTRA base de datos y PostgreSQL no puede validar esa
    # referencia (mismo caso que `ConfiguracionCorreo.usuario_destino_id`).
    # Es informativo, para poder rastrear un envío desde la base principal.
    agenda_id: Mapped[Optional[int]] = mapped_column(Integer)
