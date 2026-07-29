from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    configuracion_correo,
    estado_diario,
    jurisdicciones,
    usuarios,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(jurisdicciones.router)
api_router.include_router(estado_diario.router)
api_router.include_router(configuracion_correo.router)
api_router.include_router(usuarios.router)
