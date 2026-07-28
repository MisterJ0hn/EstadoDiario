from typing import Optional

from sqlalchemy.orm import Session, joinedload

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

    def find_by_id(self, aid: int) -> Optional[EstadoDiarioAgenda]:
        return self.db.get(EstadoDiarioAgenda, aid)

    def create(self, agenda: EstadoDiarioAgenda) -> EstadoDiarioAgenda:
        self.db.add(agenda)
        self.db.commit()
        self.db.refresh(agenda)
        return agenda

    def save(self) -> None:
        self.db.commit()
