"""Operaciones que el administrador de la plataforma hace SOBRE un cliente.

Todo lo de acá cruza las dos bases: el administrador está autenticado contra la
principal, la casilla vive ahí, y los usuarios viven en la base del cliente.
Por eso cada método abre la sesión de tenant que necesita y la cierra, en vez
de recibir una: el administrador no tiene tenant propio, va cambiando de
cliente según a cuál esté mirando.

Un cliente sin su base terminada no se puede administrar: se responde 400 en
vez de dejar que reviente con un error de conexión que no explica nada.
"""

import logging

from sqlalchemy.orm import Session

from app.core.crypto import cifrar
from app.core.database import sesion_tenant
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import get_password_hash
from app.models.maestra.cliente import Cliente
from app.models.password_historial import PasswordHistorial
from app.models.usuario import Usuario
from app.repositories.configuracion_correo_repository import ConfiguracionCorreoRepository
from app.repositories.usuario_repository import UsuarioRepository
from admin_api.app.schemas.cliente import ClienteInbox, ClienteInboxUpdate
from app.schemas.usuario import UsuarioAdminCreate, UsuarioAdminUpdate, UsuarioResponse
from admin_api.app.services.cliente_service import ClienteService
from app.services import password_service
from app.services.correo_service import CorreoService
from app.services.usuario_service import UsuarioService

logger = logging.getLogger(__name__)


class AdminClienteService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.clientes = ClienteService(db_maestra)
        self.inbox_repo = ConfiguracionCorreoRepository(db_maestra)

    def _cliente_operativo(self, cliente_id: int) -> Cliente:
        cliente = self.clientes.obtener_entidad(cliente_id)
        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            raise BadRequestException(
                "La base de datos del cliente no está lista. "
                "Reintente el aprovisionamiento antes de administrarlo."
            )
        return cliente

    # ── Casilla de ingesta ────────────────────────────────

    def obtener_inbox(self, cliente_id: int) -> ClienteInbox:
        cliente = self.clientes.obtener_entidad(cliente_id)
        config = self.inbox_repo.get_or_create(cliente_id)
        return self._a_inbox(cliente, config)

    def guardar_inbox(self, cliente_id: int, datos: ClienteInboxUpdate) -> ClienteInbox:
        cliente = self.clientes.obtener_entidad(cliente_id)
        config = self.inbox_repo.get_or_create(cliente_id)

        # `usar_casilla_propia` es lo que ve el administrador; en la base es la
        # bandera `activo` de la configuración de correo del cliente.
        config.activo = datos.usar_casilla_propia
        config.host = datos.host
        config.puerto = datos.puerto
        config.usar_ssl = datos.usar_ssl
        # Si no mandan usuario se deja la casilla por defecto del cliente:
        # dejarla vacía apagaría la ingesta sin decirlo.
        config.usuario = datos.usuario or self.clientes.inbox_por_defecto(cliente)
        config.carpeta = datos.carpeta
        config.remitentes_permitidos = datos.remitentes_permitidos
        config.asunto_estado_diario = datos.asunto_estado_diario
        config.asunto_movimientos = datos.asunto_movimientos
        config.asunto_audiencias = datos.asunto_audiencias
        config.hora_ejecucion = datos.hora_ejecucion

        # Campo vacío = no se quiso cambiar la contraseña existente.
        if datos.password:
            config.password_cifrado = cifrar(datos.password)

        self.inbox_repo.save(config)
        logger.info("Casilla del cliente %s actualizada por administración", cliente.guid)
        return self._a_inbox(cliente, config)

    def probar_inbox(self, cliente_id: int, password_override: str | None) -> dict:
        """Prueba la conexión IMAP igual que lo hace el propio cliente desde su
        configuración de correo, pero contra la casilla del cliente indicado."""
        cliente = self._cliente_operativo(cliente_id)
        # CorreoService necesita la sesión del tenant aunque probar la conexión
        # no escriba nada ahí: la comparte con la ingesta, que sí escribe.
        with sesion_tenant(cliente.guid) as db_tenant:
            return CorreoService(db_tenant, self.db).probar_conexion(
                cliente_id, password_override=password_override
            )

    def _a_inbox(self, cliente: Cliente, config) -> ClienteInbox:
        return ClienteInbox(
            direccion_por_defecto=self.clientes.inbox_por_defecto(cliente),
            usar_casilla_propia=config.activo,
            host=config.host,
            puerto=config.puerto,
            usar_ssl=config.usar_ssl,
            usuario=config.usuario,
            tiene_password=bool(config.password_cifrado),
            carpeta=config.carpeta,
            remitentes_permitidos=config.remitentes_permitidos,
            asunto_estado_diario=config.asunto_estado_diario,
            asunto_movimientos=config.asunto_movimientos,
            asunto_audiencias=config.asunto_audiencias,
            hora_ejecucion=config.hora_ejecucion,
            ultima_ejecucion=config.ultima_ejecucion,
            ultimo_resultado=config.ultimo_resultado,
        )

    # ── Usuarios del cliente (en SU base, no en la principal) ──

    def listar_usuarios(self, cliente_id: int) -> list[UsuarioResponse]:
        cliente = self._cliente_operativo(cliente_id)
        with sesion_tenant(cliente.guid) as db_tenant:
            usuarios = UsuarioRepository(db_tenant).find_all()
            # La respuesta se arma DENTRO de la sesión: los campos salen de
            # propiedades que descifran y necesitan el objeto vivo.
            return [UsuarioService.a_response(u) for u in usuarios]

    def crear_usuario(self, cliente_id: int, datos: UsuarioAdminCreate) -> UsuarioResponse:
        cliente = self._cliente_operativo(cliente_id)
        nombre_usuario = datos.username.strip().lower()

        # El CAL es lo contratado: cuántos abogados patrocinadores puede tener
        # el cliente. Se cuenta contra los ACTIVOS, así que desactivar a
        # alguien libera el cupo — que es lo que pasa cuando alguien deja el
        # estudio y entra otro.
        cupos = cliente.cupos
        if cupos:
            activos = self.clientes.total_usuarios(cliente)
            if activos >= cupos:
                raise BadRequestException(
                    f"El cliente tiene {activos} de {cupos} usuarios contratados. "
                    f"Amplíe el CAL o desactive un usuario para liberar el cupo."
                )

        with sesion_tenant(cliente.guid) as db_tenant:
            repo = UsuarioRepository(db_tenant)
            # Búsquedas por hash: las columnas están cifradas (ver el modelo).
            if repo.find_by_usuario(nombre_usuario):
                raise ConflictException(
                    f"El cliente ya tiene un usuario '{nombre_usuario}'"
                )
            if datos.email and repo.find_by_correo(datos.email):
                raise ConflictException(
                    f"El cliente ya tiene un usuario con el correo '{datos.email}'"
                )

            # La clave provisoria cumple la misma política que la definitiva.
            # No hay historial que revisar todavía: la cuenta no existe.
            password_service.validar_nueva(db_tenant, None, datos.password, PasswordHistorial)

            usuario = Usuario(
                password_hash=get_password_hash(datos.password),
                nombre=datos.nombre,
                apellido=datos.apellido,
                activo=datos.activo,
                # La clave la escribió el administrador de la plataforma, no la
                # persona: entra con ella y la cambia de inmediato.
                debe_cambiar_password=True,
            )
            # Por los setters: cifran y calculan el hash de búsqueda.
            usuario.usuario = nombre_usuario
            usuario.correo = datos.email
            usuario.telefono = datos.telefono

            repo.create(usuario)
            # Después del create: la fila del historial necesita el id, que
            # recién existe cuando el usuario está insertado.
            password_service.registrar(
                db_tenant, usuario.id, usuario.password_hash, PasswordHistorial
            )
            db_tenant.commit()
            logger.info(
                "Usuario '%s' creado en el cliente %s desde administración",
                nombre_usuario,
                cliente.guid,
            )
            return UsuarioService.a_response(usuario)

    def actualizar_usuario(
        self, cliente_id: int, usuario_id: int, datos: UsuarioAdminUpdate
    ) -> UsuarioResponse:
        cliente = self._cliente_operativo(cliente_id)

        with sesion_tenant(cliente.guid) as db_tenant:
            repo = UsuarioRepository(db_tenant)
            usuario = repo.find_by_id(usuario_id)
            if not usuario:
                raise NotFoundException("Usuario no encontrado")

            if datos.email:
                existente = repo.find_by_correo(datos.email)
                if existente and existente.id != usuario.id:
                    raise ConflictException(
                        f"El cliente ya tiene un usuario con el correo '{datos.email}'"
                    )

            # La clave se valida ANTES de tocar el resto de los campos: una
            # clave rechazada tiene que dejar el usuario como estaba, no a
            # medio actualizar. El cambio en sí se aplica más abajo.
            if datos.password:
                password_service.validar_nueva(
                    db_tenant, usuario, datos.password, PasswordHistorial
                )

            # Renombrar: el id no cambia, así que los registros de quién hizo
            # qué siguen apuntando a la misma persona. Lo único que hay que
            # cuidar es que el nombre nuevo no lo tenga otro, porque es con lo
            # que se inicia sesión.
            if datos.username:
                nuevo = datos.username.strip().lower()
                existente = repo.find_by_usuario(nuevo)
                if existente and existente.id != usuario.id:
                    raise ConflictException(f"El cliente ya tiene un usuario '{nuevo}'")
                usuario.usuario = nuevo

            usuario.correo = datos.email
            usuario.nombre = datos.nombre
            usuario.apellido = datos.apellido
            usuario.telefono = datos.telefono
            usuario.activo = datos.activo

            if datos.password:
                usuario.password_hash = get_password_hash(datos.password)
                # Clave puesta por un tercero: se exige cambiarla al entrar.
                usuario.debe_cambiar_password = True
                # Queda en el historial igual que cualquier otra: si no, un
                # reseteo sería la forma de saltarse la regla de no repetir.
                password_service.registrar(
                    db_tenant, usuario.id, usuario.password_hash, PasswordHistorial
                )
                logger.info(
                    "Contraseña del usuario %s del cliente %s reseteada desde administración",
                    usuario_id,
                    cliente.guid,
                )

            repo.save(usuario)
            return UsuarioService.a_response(usuario)
