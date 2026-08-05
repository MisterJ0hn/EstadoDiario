from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.maestra.usuario_admin import UsuarioAdmin


class UsuarioAdminRepository:
    """Administradores del sistema, en la base PRINCIPAL."""

    def __init__(self, db: Session):
        self.db = db

    def find_by_usuario(self, usuario: str) -> Optional[UsuarioAdmin]:
        # Acá el nombre va en claro (ver el modelo), así que sí se puede
        # comparar sin distinguir mayúsculas directamente en SQL.
        return (
            self.db.query(UsuarioAdmin)
            .filter(func.lower(UsuarioAdmin.usuario) == usuario.strip().lower())
            .first()
        )

    def find_by_id(self, usuario_id: int) -> Optional[UsuarioAdmin]:
        return self.db.get(UsuarioAdmin, usuario_id)

    def find_all(self) -> list[UsuarioAdmin]:
        return self.db.query(UsuarioAdmin).order_by(UsuarioAdmin.usuario).all()

    def existe_alguno(self) -> bool:
        """Para el sembrado del primer arranque: se pregunta por la existencia
        en SQL en vez de traer las filas para contarlas en Python."""
        return self.db.query(UsuarioAdmin.id).first() is not None

    def save(self, admin: UsuarioAdmin) -> UsuarioAdmin:
        self.db.add(admin)
        self.db.commit()
        self.db.refresh(admin)
        return admin
