from datetime import datetime
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_agenda import EstadoDiarioAgenda


class EstadoDiarioAgendaRepository:
    """Recordatorios. Sin filtro de visibilidad: dentro de un estudio todos
    ven todo.

    `usuario_registro_id` sigue existiendo y NO es un permiso: dice a quién se
    le manda el WhatsApp y quién figura como autor.
    """

    def __init__(self, db: Session):
        self.db = db

    def find_by_estado_diario(self, estado_diario_id: int) -> list[EstadoDiarioAgenda]:
        return (
            self.db.query(EstadoDiarioAgenda)
            .options(joinedload(EstadoDiarioAgenda.usuario_registro))
            .filter(EstadoDiarioAgenda.estado_diario_id == estado_diario_id)
            .order_by(EstadoDiarioAgenda.fecha_hora.desc())
            .all()
        )

    def find_by_id(self, aid: int) -> Optional[EstadoDiarioAgenda]:
        query = (
            self.db.query(EstadoDiarioAgenda)
            .join(EstadoDiarioAgenda.estado_diario)
            .filter(EstadoDiarioAgenda.id == aid)
        )
        return query.first()

    def find_vigentes(self) -> list[EstadoDiarioAgenda]:
        """Recordatorios no finalizados."""
        query = (
            self.db.query(EstadoDiarioAgenda)
            .join(EstadoDiarioAgenda.estado_diario)
            .options(
                joinedload(EstadoDiarioAgenda.usuario_registro),
                joinedload(EstadoDiarioAgenda.estado_diario).joinedload(EstadoDiario.jurisdiccion),
            )
            .filter(EstadoDiarioAgenda.finalizado.is_(False))
        )
        query = query
        return query.order_by(EstadoDiarioAgenda.fecha_hora.asc()).all()

    def find_by_twilio_sid(self, twilio_sid: str) -> Optional[EstadoDiarioAgenda]:
        """Recordatorio cuyo WhatsApp corresponde al SID que Twilio devuelve en
        el callback. Se toma el más reciente porque una postergación reenvía el
        mismo detalle y podría repetirse un SID reutilizado por Twilio."""
        return (
            self.db.query(EstadoDiarioAgenda)
            .options(
                joinedload(EstadoDiarioAgenda.estado_diario),
                joinedload(EstadoDiarioAgenda.usuario_registro),
            )
            .filter(EstadoDiarioAgenda.twilio_sid == twilio_sid)
            .order_by(EstadoDiarioAgenda.id.desc())
            .first()
        )

    def find_pendientes_whatsapp(self, ahora: datetime) -> list[EstadoDiarioAgenda]:
        """Recordatorios con WhatsApp programado, aún no enviados ni
        finalizados, cuya hora de envío ya llegó."""
        return (
            self.db.query(EstadoDiarioAgenda)
            .filter(
                EstadoDiarioAgenda.notificar_whatsapp.is_(True),
                EstadoDiarioAgenda.enviado.is_(False),
                EstadoDiarioAgenda.finalizado.is_(False),
                EstadoDiarioAgenda.fecha_hora_whatsapp.isnot(None),
                EstadoDiarioAgenda.fecha_hora_whatsapp <= ahora,
            )
            .order_by(EstadoDiarioAgenda.fecha_hora_whatsapp.asc())
            .all()
        )

    def create(self, agenda: EstadoDiarioAgenda) -> EstadoDiarioAgenda:
        self.db.add(agenda)
        self.db.commit()
        self.db.refresh(agenda)
        return agenda

    def save(self) -> None:
        self.db.commit()
