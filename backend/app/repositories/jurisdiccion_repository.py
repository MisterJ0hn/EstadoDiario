from typing import Optional

from sqlalchemy.orm import Session

from app.models.jurisdiccion import Jurisdiccion


class JurisdiccionRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_all(self) -> list[Jurisdiccion]:
        return self.db.query(Jurisdiccion).order_by(Jurisdiccion.nombre).all()

    def find_by_id(self, jid: int) -> Optional[Jurisdiccion]:
        return self.db.get(Jurisdiccion, jid)

    def find_by_nombre(self, nombre: str) -> Optional[Jurisdiccion]:
        return self.db.query(Jurisdiccion).filter(Jurisdiccion.nombre == nombre).first()

    def create(self, jurisdiccion: Jurisdiccion) -> Jurisdiccion:
        self.db.add(jurisdiccion)
        self.db.commit()
        self.db.refresh(jurisdiccion)
        return jurisdiccion
