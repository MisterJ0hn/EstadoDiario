from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    configuracion_correo,
    configuracion_google,
    configuracion_whatsapp,
    estado_diario,
    google_calendar,
    jurisdicciones,
    usuarios,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(jurisdicciones.router)
api_router.include_router(estado_diario.router)
api_router.include_router(configuracion_correo.router)
api_router.include_router(usuarios.router)
api_router.include_router(configuracion_google.router)
api_router.include_router(configuracion_whatsapp.router)
api_router.include_router(google_calendar.router)
