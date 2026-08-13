from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import BaseTenant


class EstadoDiarioAgenda(BaseTenant):
    __tablename__ = "estado_diario_agenda"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    estado_diario_id: Mapped[int] = mapped_column(
        ForeignKey("estado_diario.id"), nullable=False, index=True
    )
    usuario_registro_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id"), index=True
    )
    detalle: Mapped[str] = mapped_column(Text, nullable=False)
    # Fecha del recordatorio: es la fecha del evento de todo el día en
    # Google Calendar. No confundir con fecha_hora_whatsapp, que es la
    # fecha/hora exacta de envío del WhatsApp (son propósitos distintos).
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_hora_registro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Nivel de urgencia del recordatorio (bajo/medio/alto), igual criterio que
    # EstadoDiario.nivel_pendiente. Define el color en Calendar y en la UI.
    nivel: Mapped[str] = mapped_column(String(20), default="medio")

    # ── Finalización ──
    finalizado: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    fecha_finalizacion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    usuario_finaliza_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id"), index=True
    )

    # ── WhatsApp (Twilio) ──
    notificar_whatsapp: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_telefono: Mapped[Optional[str]] = mapped_column(String(30))
    fecha_hora_whatsapp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # enviado/fecha_envio/mensaje_error/twilio_sid (abajo) ya cubren el
    # estado del envío; no se duplican con campos "whatsapp_*".
    enviado: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    fecha_envio: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    mensaje_error: Mapped[Optional[str]] = mapped_column(Text)
    # Indexada porque el webhook de Twilio busca por acá, y cuando el SID no
    # está anotado en `whatsapp_envio` la consulta se repite en la base de cada
    # cliente hasta dar con él (ver `twilio_webhook_service`).
    twilio_sid: Mapped[Optional[str]] = mapped_column(String(64), index=True)

    # ── Google Calendar ──
    google_event_id: Mapped[Optional[str]] = mapped_column(String(255))
    google_calendar_id: Mapped[Optional[str]] = mapped_column(String(255))
    google_sync_error: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    estado_diario = relationship("EstadoDiario", back_populates="agendas")
    usuario_registro = relationship("Usuario", foreign_keys=[usuario_registro_id])
    usuario_finaliza = relationship("Usuario", foreign_keys=[usuario_finaliza_id])
