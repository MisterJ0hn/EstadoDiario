"""Alta y mantención de usuarios. Solo para administradores.

No existe borrado: las tablas de estado diario referencian usuario.id (quién
subió el archivo, quién marcó leído o pendiente), así que un usuario que ya no
trabaja se desactiva y conserva su historial.
"""

import logging

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import get_password_hash
from app.models.usuario import Usuario
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate

logger = logging.getLogger(__name__)


class UsuarioService:
    def __init__(self, db: Session):
        self.repo = UsuarioRepository(db)

    def listar(self) -> list[Usuario]:
        return self.repo.find_all()

    def obtener(self, usuario_id: int) -> Usuario:
        usuario = self.repo.find_by_id(usuario_id)
        if not usuario:
            raise NotFoundException("Usuario no encontrado")
        return usuario

    def crear(self, datos: UsuarioCreate, admin: Usuario) -> Usuario:
        username = datos.username.strip().lower()

        if self.repo.find_by_username(username):
            raise ConflictException(f"Ya existe un usuario con el nombre '{username}'")
        if self.repo.find_by_email(datos.email):
            raise ConflictException(f"Ya existe un usuario con el correo '{datos.email}'")

        usuario = Usuario(
            username=username,
            email=datos.email,
            password_hash=get_password_hash(datos.password),
            nombre=datos.nombre,
            apellido=datos.apellido,
            rol=datos.rol,
            activo=datos.activo,
        )
        usuario = self.repo.create(usuario)
        logger.info("Usuario '%s' creado por '%s'", usuario.username, admin.username)
        return usuario

    def actualizar(self, usuario_id: int, datos: UsuarioUpdate, admin: Usuario) -> Usuario:
        usuario = self.obtener(usuario_id)

        existente = self.repo.find_by_email(datos.email)
        if existente and existente.id != usuario.id:
            raise ConflictException(f"Ya existe un usuario con el correo '{datos.email}'")

        # Un admin no puede dejarse a sí mismo sin acceso ni sin rol. Esto basta
        # para garantizar que siempre quede al menos un administrador activo:
        # solo un admin activo llega hasta aquí, y no puede degradarse.
        if usuario.id == admin.id:
            if not datos.activo:
                raise BadRequestException("No puede desactivar su propia cuenta")
            if datos.rol != "admin":
                raise BadRequestException("No puede quitarse a sí mismo el rol de administrador")

        usuario.email = datos.email
        usuario.nombre = datos.nombre
        usuario.apellido = datos.apellido
        usuario.rol = datos.rol
        usuario.activo = datos.activo

        if datos.password:
            usuario.password_hash = get_password_hash(datos.password)
            logger.info("Contraseña de '%s' cambiada por '%s'", usuario.username, admin.username)

        usuario = self.repo.save(usuario)
        logger.info("Usuario '%s' actualizado por '%s'", usuario.username, admin.username)
        return usuario
