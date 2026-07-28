from sqlalchemy.orm import Session

from app.models.api_llamado_estado_diario import ApiLlamadoEstadoDiario


class ApiLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, log: ApiLlamadoEstadoDiario) -> ApiLlamadoEstadoDiario:
        self.db.add(log)
        self.db.commit()
        return log

    def save(self) -> None:
        self.db.commit()
