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
from app.schemas.usuario import UsuarioCreate, UsuarioResponse, UsuarioUpdate

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

    def crear(self, datos: UsuarioCreate, admin: Usuario) -> UsuarioResponse:
        nombre_usuario = datos.username.strip().lower()

        # Las búsquedas van por el hash, no por la columna: `usuario` y
        # `correo` están cifrados y no se pueden comparar en SQL.
        if self.repo.find_by_usuario(nombre_usuario):
            raise ConflictException(f"Ya existe un usuario con el nombre '{nombre_usuario}'")
        if self.repo.find_by_correo(datos.email):
            raise ConflictException(f"Ya existe un usuario con el correo '{datos.email}'")

        usuario = Usuario(
            password_hash=get_password_hash(datos.password),
            nombre=datos.nombre,
            apellido=datos.apellido,
            rol=datos.rol,
            activo=datos.activo,
        )
        # Por los setters: cifran el valor y calculan el hash de búsqueda.
        usuario.usuario = nombre_usuario
        usuario.correo = datos.email
        usuario.telefono = datos.telefono

        usuario = self.repo.create(usuario)
        logger.info("Usuario '%s' creado por '%s'", nombre_usuario, admin.usuario)
        return self.a_response(usuario)

    def actualizar(self, usuario_id: int, datos: UsuarioUpdate, admin: Usuario) -> UsuarioResponse:
        usuario = self.obtener_entidad(usuario_id)

        existente = self.repo.find_by_correo(datos.email)
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

        usuario.correo = datos.email
        usuario.nombre = datos.nombre
        usuario.apellido = datos.apellido
        usuario.telefono = datos.telefono
        usuario.rol = datos.rol
        usuario.activo = datos.activo

        if datos.password:
            usuario.password_hash = get_password_hash(datos.password)
            logger.info("Contraseña de '%s' cambiada por '%s'", usuario.usuario, admin.usuario)

        usuario = self.repo.save(usuario)
        logger.info("Usuario '%s' actualizado por '%s'", usuario.usuario, admin.usuario)
        return self.a_response(usuario)
