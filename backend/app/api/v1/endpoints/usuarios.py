from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.usuario import Usuario
from app.schemas.usuario import (
    UsuarioCreate,
    UsuarioListResponse,
    UsuarioResponse,
    UsuarioUpdate,
)
from app.services.usuario_service import UsuarioService

# Toda la sección crea credenciales de acceso: exige rol admin.
router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=UsuarioListResponse, summary="Listar usuarios")
def listar_usuarios(db: Session = Depends(get_db)):
    usuarios = UsuarioService(db).listar()
    return UsuarioListResponse(total=len(usuarios), usuarios=usuarios)


@router.post(
    "",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario",
    responses={409: {"description": "Username o correo ya existe"}},
)
def crear_usuario(
    datos: UsuarioCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    return UsuarioService(db).crear(datos, admin)


@router.get(
    "/{usuario_id}",
    response_model=UsuarioResponse,
    summary="Obtener un usuario",
    responses={404: {"description": "Usuario no encontrado"}},
)
def obtener_usuario(usuario_id: int, db: Session = Depends(get_db)):
    return UsuarioService(db).obtener(usuario_id)


@router.put(
    "/{usuario_id}",
    response_model=UsuarioResponse,
    summary="Actualizar usuario",
    responses={
        404: {"description": "Usuario no encontrado"},
        409: {"description": "El correo ya está en uso"},
    },
)
def actualizar_usuario(
    usuario_id: int,
    datos: UsuarioUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    return UsuarioService(db).actualizar(usuario_id, datos, admin)
