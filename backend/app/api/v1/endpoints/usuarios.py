"""Usuarios del estudio, vistos desde el propio estudio.

**Acá no se crean ni se editan usuarios.** Dar de alta a alguien es una
operación de la plataforma (`/api/v1/admin/clientes/{id}/usuarios`): es quien
contrata el servicio el que decide cuántas cuentas hay, y la clave inicial la
escribe alguien que la va a comunicar.

Lo que el administrador del estudio sí decide es **qué ve cada uno de los
suyos**, que es lo de este módulo: la lista de su gente y las jurisdicciones
asignadas a cada cual.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db_tenant, require_admin_cliente
from app.core.exceptions import BadRequestException, NotFoundException
from app.repositories.jurisdiccion_repository import JurisdiccionRepository
from app.repositories.usuario_jurisdiccion_repository import UsuarioJurisdiccionRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.schemas.usuario import (
    PermisosUsuario,
    PermisosUsuarioListResponse,
    PermisosUsuarioUpdate,
    UsuarioListResponse,
)
from app.services.usuario_service import UsuarioService

# Todo lo de acá decide qué puede ver otra persona: exige admin del estudio.
router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"],
    dependencies=[Depends(require_admin_cliente)],
)


@router.get("", response_model=UsuarioListResponse, summary="Listar usuarios")
def listar_usuarios(db: Session = Depends(get_db_tenant)):
    """Los usuarios del estudio. Solo lectura: las altas las hace la
    plataforma."""
    usuarios = UsuarioService(db).listar()
    return UsuarioListResponse(total=len(usuarios), usuarios=usuarios)


@router.get(
    "/permisos",
    response_model=PermisosUsuarioListResponse,
    summary="Jurisdicciones asignadas a cada usuario",
)
def listar_permisos(db: Session = Depends(get_db_tenant)):
    """Una fila por usuario con sus jurisdicciones.

    Las asignaciones de todos salen en **una** consulta: pedirlas de a una por
    usuario sería una consulta por fila de la tabla.
    """
    usuarios = UsuarioRepository(db).find_all()
    asignaciones = UsuarioJurisdiccionRepository(db).por_usuario([u.id for u in usuarios])

    return PermisosUsuarioListResponse(
        total=len(usuarios),
        jurisdicciones=[
            {"id": j.id, "nombre": j.nombre} for j in JurisdiccionRepository(db).find_all()
        ],
        usuarios=[
            PermisosUsuario(
                usuario_id=u.id,
                # Descifrados por las propiedades del modelo.
                username=u.usuario,
                nombre_completo=u.nombre_completo,
                rol=u.rol,
                activo=u.activo,
                jurisdicciones=asignaciones.get(u.id, []),
            )
            for u in usuarios
        ],
    )


@router.put(
    "/{usuario_id}/permisos",
    response_model=PermisosUsuario,
    summary="Asignar las jurisdicciones que puede ver un usuario",
    responses={404: {"description": "Usuario no encontrado"}},
)
def guardar_permisos(
    usuario_id: int,
    datos: PermisosUsuarioUpdate,
    db: Session = Depends(get_db_tenant),
):
    """Reemplaza la asignación completa del usuario.

    **Lista vacía = ve todas las jurisdicciones**, que es lo mismo que no haber
    configurado nunca nada. No hay forma de dejar a alguien sin ver nada: una
    cuenta que no ve nada no se distingue de una cuenta rota, y quien la usa
    reporta una falla en vez de pedir permisos. Para quitarle el acceso a
    alguien se lo desactiva, que sí dice lo que pasó.
    """
    usuario = UsuarioRepository(db).find_by_id(usuario_id)
    if not usuario:
        raise NotFoundException("Usuario no encontrado")

    validas = {j.id for j in JurisdiccionRepository(db).find_all()}
    desconocidas = set(datos.jurisdicciones) - validas
    if desconocidas:
        # Un id que no existe se guardaría igual y dejaría al usuario viendo
        # menos de lo que la pantalla muestra.
        raise BadRequestException(
            f"Jurisdicciones inexistentes: {sorted(desconocidas)}"
        )

    asignadas = UsuarioJurisdiccionRepository(db).reemplazar(usuario_id, datos.jurisdicciones)

    return PermisosUsuario(
        usuario_id=usuario.id,
        username=usuario.usuario,
        nombre_completo=usuario.nombre_completo,
        rol=usuario.rol,
        activo=usuario.activo,
        jurisdicciones=asignadas,
    )
