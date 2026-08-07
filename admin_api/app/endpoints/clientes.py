import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db_maestra
from app.models.maestra.usuario_admin import UsuarioAdmin
from app.schemas.usuario import (
    UsuarioAdminCreate,
    UsuarioAdminUpdate,
    UsuarioListResponse,
    UsuarioResponse,
)

from admin_api.app.deps import require_admin
from admin_api.app.schemas.cliente import (
    AprovisionamientoEstado,
    ClienteCreate,
    ClienteInbox,
    ClienteInboxUpdate,
    ClienteListResponse,
    ClienteResponse,
    ClienteLogoUpdate,
    ClienteUpdate,
    OperacionResponse,
    ProbarInboxRequest,
)
from admin_api.app.services.admin_cliente_service import AdminClienteService
from admin_api.app.services.cliente_service import ClienteService

logger = logging.getLogger(__name__)

# Administración del sistema: opera sobre la base PRINCIPAL y no lleva tenant,
# por eso cuelga de /admin y no del resto de la API. Exige administrador del
# sistema con la clave ya definitiva.
router = APIRouter(
    prefix="/admin/clientes",
    tags=["Clientes"],
    dependencies=[Depends(require_admin)],
)


# ── Ficha ─────────────────────────────────────────────────


@router.get("", response_model=ClienteListResponse, summary="Listar clientes")
def listar_clientes(db: Session = Depends(get_db_maestra)):
    clientes = ClienteService(db).listar()
    return ClienteListResponse(total=len(clientes), clientes=clientes)


@router.post(
    "",
    response_model=ClienteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un cliente y su base de datos",
    responses={409: {"description": "Ya existe un cliente con ese RUT"}},
)
def crear_cliente(
    datos: ClienteCreate,
    db: Session = Depends(get_db_maestra),
    admin: UsuarioAdmin = Depends(require_admin),
):
    """Da de alta el cliente y **crea su base de datos** con las 14 tablas y
    los datos iniciales. Es una operación lenta (segundos): crea una base.

    Si la creación de la base falla, el cliente igual queda registrado, en
    estado `error` y con el motivo: se revisa y se reintenta desde
    `/aprovisionamiento/reintentar` en vez de quedar a medias sin rastro.
    """
    respuesta = ClienteService(db).crear(datos)
    logger.info("Cliente %s creado por el administrador %s", respuesta.guid, admin.usuario)
    return respuesta


@router.get(
    "/{cliente_id}",
    response_model=ClienteResponse,
    summary="Ficha de un cliente",
    responses={404: {"description": "Cliente no encontrado"}},
)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db_maestra)):
    return ClienteService(db).obtener(cliente_id)


@router.put(
    "/{cliente_id}",
    response_model=ClienteResponse,
    summary="Editar la ficha de un cliente",
)
def actualizar_cliente(
    cliente_id: int,
    datos: ClienteUpdate,
    db: Session = Depends(get_db_maestra),
):
    """Edita nombre, RUT, correo y si el cliente está activo.

    **No** cambia el guid ni la base de datos: identifican dónde están las
    causas del cliente y tocarlos las dejaría inalcanzables. El RUT sí, aunque
    es la credencial con la que entra el estudio: ver `ClienteUpdate`.
    """
    return ClienteService(db).actualizar(cliente_id, datos)


@router.put(
    "/{cliente_id}/logo",
    response_model=ClienteResponse,
    summary="Cambiar o quitar el logo del estudio",
)
def guardar_logo(
    cliente_id: int,
    datos: ClienteLogoUpdate,
    db: Session = Depends(get_db_maestra),
):
    """Guarda el logo que el estudio ve en su barra lateral y sale en los
    correos que le envía el sistema. Mandar `logo` vacío lo quita."""
    return ClienteService(db).guardar_logo(cliente_id, datos)


# ── Aprovisionamiento de su base de datos ─────────────────


@router.get(
    "/{cliente_id}/aprovisionamiento",
    response_model=AprovisionamientoEstado,
    summary="Estado de la base de datos del cliente",
)
def estado_aprovisionamiento(cliente_id: int, db: Session = Depends(get_db_maestra)):
    """Devuelve el estado guardado y, además, comprueba contra el servidor si
    la base existe y cuántas tablas tiene."""
    return ClienteService(db).estado_aprovisionamiento(cliente_id)


@router.post(
    "/{cliente_id}/aprovisionamiento/reintentar",
    response_model=AprovisionamientoEstado,
    summary="Reintentar la creación de la base del cliente",
)
def reintentar_aprovisionamiento(
    cliente_id: int,
    db: Session = Depends(get_db_maestra),
):
    """Reintenta el alta que falló. Es idempotente: si la base ya existe no la
    vuelve a crear, solo aplica el esquema y siembra lo que falte.

    No pide nada más: la base del cliente nace sin usuarios y el primero se
    crea después desde la ficha, así que reintentar no necesita credenciales.
    """
    return ClienteService(db).reintentar_aprovisionamiento(cliente_id)


# ── Suspensión ────────────────────────────────────────────


@router.post(
    "/{cliente_id}/suspender",
    response_model=ClienteResponse,
    summary="Suspender un cliente",
)
def suspender_cliente(cliente_id: int, db: Session = Depends(get_db_maestra)):
    """Suspender **conserva todos los datos**: apaga la bandera `activo` y nada
    más. Sus usuarios no pueden iniciar sesión y los jobs programados lo
    saltan, pero su base de datos queda intacta."""
    return ClienteService(db).suspender(cliente_id)


@router.post(
    "/{cliente_id}/reactivar",
    response_model=ClienteResponse,
    summary="Reactivar un cliente suspendido",
)
def reactivar_cliente(cliente_id: int, db: Session = Depends(get_db_maestra)):
    """Vuelve a encender la bandera. No hay que reaprovisionar nada: el cliente
    sigue con su información como la dejó."""
    return ClienteService(db).reactivar(cliente_id)


# ── Casilla de ingesta ────────────────────────────────────


@router.get(
    "/{cliente_id}/inbox",
    response_model=ClienteInbox,
    summary="Casilla de ingesta del cliente",
)
def obtener_inbox(cliente_id: int, db: Session = Depends(get_db_maestra)):
    """La casilla por defecto es `<guid>@<dominio>`; el dominio sale de la
    configuración del sistema."""
    return AdminClienteService(db).obtener_inbox(cliente_id)


@router.put(
    "/{cliente_id}/inbox",
    response_model=ClienteInbox,
    summary="Guardar la casilla de ingesta del cliente",
)
def guardar_inbox(
    cliente_id: int,
    datos: ClienteInboxUpdate,
    db: Session = Depends(get_db_maestra),
):
    return AdminClienteService(db).guardar_inbox(cliente_id, datos)


@router.post(
    "/{cliente_id}/inbox/probar",
    response_model=OperacionResponse,
    summary="Probar la conexión IMAP de la casilla del cliente",
)
def probar_inbox(
    cliente_id: int,
    datos: ProbarInboxRequest | None = None,
    db: Session = Depends(get_db_maestra),
):
    """Valida credenciales y carpeta sin importar nada. `password` permite
    probar una contraseña recién escrita antes de guardarla."""
    resultado = AdminClienteService(db).probar_inbox(
        cliente_id, datos.password if datos else None
    )
    return OperacionResponse(**resultado)


# ── Usuarios del cliente (viven en la base del cliente) ───


@router.get(
    "/{cliente_id}/usuarios",
    response_model=UsuarioListResponse,
    summary="Usuarios del cliente",
)
def listar_usuarios(cliente_id: int, db: Session = Depends(get_db_maestra)):
    """Los lee de la base DEL CLIENTE, no de la principal."""
    usuarios = AdminClienteService(db).listar_usuarios(cliente_id)
    return UsuarioListResponse(total=len(usuarios), usuarios=usuarios)


@router.post(
    "/{cliente_id}/usuarios",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un usuario en la base del cliente",
    responses={409: {"description": "El nombre de usuario o el correo ya existe"}},
)
def crear_usuario(
    cliente_id: int,
    datos: UsuarioAdminCreate,
    db: Session = Depends(get_db_maestra),
):
    """Nace con la clave marcada como provisoria: la escribió el administrador
    del sistema, no la persona, así que se le exige cambiarla al entrar."""
    return AdminClienteService(db).crear_usuario(cliente_id, datos)


@router.put(
    "/{cliente_id}/usuarios/{usuario_id}",
    response_model=UsuarioResponse,
    summary="Editar un usuario del cliente",
    responses={404: {"description": "Usuario no encontrado"}},
)
def actualizar_usuario(
    cliente_id: int,
    usuario_id: int,
    datos: UsuarioAdminUpdate,
    db: Session = Depends(get_db_maestra),
):
    """Dejar `password` vacío conserva la actual. Si se manda una nueva, queda
    marcada como provisoria."""
    return AdminClienteService(db).actualizar_usuario(cliente_id, usuario_id, datos)
