"""Lectura de los usuarios del estudio, desde el propio estudio.

**El alta y la edición ya no viven acá**: las hace la plataforma, en
`AdminClienteService` (`/api/v1/admin/clientes/{id}/usuarios`). Quien contrata
el servicio decide cuántas cuentas hay y quién las tiene; el administrador del
estudio decide qué ve cada una (`UsuarioJurisdiccionRepository`).

Nunca existió borrado y sigue sin existir: las tablas operativas referencian
usuario.id (quién subió el archivo, quién marcó leído o pendiente), así que un
usuario que ya no trabaja se desactiva y conserva su historial.
"""

import logging

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.usuario import Usuario
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.usuario import UsuarioResponse

logger = logging.getLogger(__name__)


class UsuarioService:
    def __init__(self, db: Session):
        self.repo = UsuarioRepository(db)

    @staticmethod
    def a_response(usuario: Usuario) -> UsuarioResponse:
        """Traduce el modelo al contrato de la API.

        Acá se cruza la frontera de nombres: en la base las columnas son
        `usuario` y `correo` (cifradas), en el JSON son `username` y `email`.
        Las propiedades del modelo descifran al leer.
        """
        return UsuarioResponse(
            id=usuario.id,
            username=usuario.usuario,
            email=usuario.correo,
            nombre=usuario.nombre,
            apellido=usuario.apellido,
            telefono=usuario.telefono,
            rol=usuario.rol,
            activo=usuario.activo,
            debe_cambiar_password=usuario.debe_cambiar_password,
            fecha_creacion=usuario.fecha_creacion,
        )

    def listar(self) -> list[UsuarioResponse]:
        return [self.a_response(u) for u in self.repo.find_all()]

    def obtener(self, usuario_id: int) -> UsuarioResponse:
        return self.a_response(self.obtener_entidad(usuario_id))

    def obtener_entidad(self, usuario_id: int) -> Usuario:
        usuario = self.repo.find_by_id(usuario_id)
        if not usuario:
            raise NotFoundException("Usuario no encontrado")
        return usuario
