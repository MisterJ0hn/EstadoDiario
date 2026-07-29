from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.usuario import Usuario


class UsuarioRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_username(self, username: str) -> Optional[Usuario]:
        # Sin distinguir mayúsculas: las altas guardan el username en minúsculas
        # y nadie debería quedar fuera por escribirlo distinto al ingresar.
        return (
            self.db.query(Usuario)
            .filter(func.lower(Usuario.username) == username.strip().lower())
            .first()
        )

    def find_by_id(self, user_id: int) -> Optional[Usuario]:
        return self.db.get(Usuario, user_id)

    def find_by_email(self, email: str) -> Optional[Usuario]:
        return (
            self.db.query(Usuario)
            .filter(func.lower(Usuario.email) == email.strip().lower())
            .first()
        )

    def create(self, usuario: Usuario) -> Usuario:
        self.db.add(usuario)
        self.db.commit()
        self.db.refresh(usuario)
        return usuario

    def find_all(self) -> list[Usuario]:
        return self.db.query(Usuario).order_by(Usuario.username).all()

    def save(self, usuario: Usuario) -> Usuario:
        self.db.commit()
        self.db.refresh(usuario)
        return usuario
