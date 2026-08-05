from typing import Optional

from sqlalchemy.orm import Session

from app.core.hash_busqueda import hash_rut
from app.models.maestra.cliente import Cliente


class ClienteRepository:
    """Clientes de la base PRINCIPAL. La sesión que recibe tiene que ser la
    maestra (`get_db_maestra`), nunca la de un tenant."""

    def __init__(self, db: Session):
        self.db = db

    def find_by_rut(self, rut: str) -> Optional[Cliente]:
        """Búsqueda por RUT en el login de 3 campos.

        Va por `rut_hash` y no por la columna `rut`: ésa está cifrada con
        Fernet, que no es determinista, y comparar tokens no encuentra nada.
        El índice único de rut_hash resuelve esto con un solo acceso.
        """
        return (
            self.db.query(Cliente).filter(Cliente.rut_hash == hash_rut(rut)).first()
        )

    def find_by_guid(self, guid: str) -> Optional[Cliente]:
        return self.db.query(Cliente).filter(Cliente.guid == guid).first()

    def find_by_id(self, cliente_id: int) -> Optional[Cliente]:
        return self.db.get(Cliente, cliente_id)

    def find_all(self) -> list[Cliente]:
        return self.db.query(Cliente).order_by(Cliente.nombre).all()

    def find_activos(self) -> list[Cliente]:
        """Los que recorren los jobs: uno por base de datos a revisar."""
        return (
            self.db.query(Cliente)
            .filter(Cliente.activo.is_(True))
            .order_by(Cliente.cliente_id)
            .all()
        )

    def save(self, cliente: Cliente) -> Cliente:
        self.db.add(cliente)
        self.db.commit()
        self.db.refresh(cliente)
        return cliente
