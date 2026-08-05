from typing import Optional

from sqlalchemy.orm import Session

from app.core.hash_busqueda import hash_busqueda
from app.models.usuario import Usuario


class UsuarioRepository:
    """Usuarios de la base de UN cliente. La sesión que recibe es siempre la
    del tenant (`get_db_tenant`): el aislamiento entre clientes ya está dado
    por estar en otra base de datos."""

    def __init__(self, db: Session):
        self.db = db

    def find_by_usuario(self, usuario: str) -> Optional[Usuario]:
        """Búsqueda por nombre de usuario en el login de 3 campos.

        Va por `usuario_hash`: la columna `usuario` está cifrada y no se puede
        comparar ni pasar por func.lower(). El hash normaliza a minúsculas, así
        que el login sigue sin distinguir mayúsculas como antes.
        """
        return (
            self.db.query(Usuario)
            .filter(Usuario.usuario_hash == hash_busqueda(usuario))
            .first()
        )

    def find_by_id(self, usuario_id: int) -> Optional[Usuario]:
        return self.db.get(Usuario, usuario_id)

    def find_by_correo(self, correo: str) -> Optional[Usuario]:
        """Igual que arriba: por `correo_hash`, no por la columna cifrada."""
        return (
            self.db.query(Usuario)
            .filter(Usuario.correo_hash == hash_busqueda(correo))
            .first()
        )

    def create(self, usuario: Usuario) -> Usuario:
        self.db.add(usuario)
        self.db.commit()
        self.db.refresh(usuario)
        return usuario

    def find_all(self) -> list[Usuario]:
        # Ordenado por id y no por nombre de usuario: esa columna está cifrada
        # y ordenarla en SQL daría el orden de los tokens, que no es ninguno.
        # Si hace falta alfabético, se ordena en Python después de descifrar.
        return self.db.query(Usuario).order_by(Usuario.id).all()

    def save(self, usuario: Usuario) -> Usuario:
        self.db.commit()
        self.db.refresh(usuario)
        return usuario
