from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_agenda import EstadoDiarioAgenda


class EstadoDiarioAgendaRepository:
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

    def find_by_id(self, aid: int, usuario_id: Optional[int] = None) -> Optional[EstadoDiarioAgenda]:
        """`usuario_id=None` = sin filtro (admin). El dueño de un recordatorio
        es quien lo creó, igual criterio que en find_vigentes.
        """
        query = self.db.query(EstadoDiarioAgenda).filter(EstadoDiarioAgenda.id == aid)
        if usuario_id is not None:
            query = query.filter(EstadoDiarioAgenda.usuario_registro_id == usuario_id)
        return query.first()

    def find_vigentes(self, usuario_id: Optional[int]) -> list[EstadoDiarioAgenda]:
        """Recordatorios no finalizados. `usuario_id=None` = todos (admin)."""
        query = (
            self.db.query(EstadoDiarioAgenda)
            .options(
                joinedload(EstadoDiarioAgenda.usuario_registro),
                joinedload(EstadoDiarioAgenda.estado_diario).joinedload(EstadoDiario.jurisdiccion),
            )
            .filter(EstadoDiarioAgenda.finalizado.is_(False))
        )
        if usuario_id is not None:
            query = query.filter(EstadoDiarioAgenda.usuario_registro_id == usuario_id)
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
