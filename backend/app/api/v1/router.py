from fastapi import APIRouter

from app.api.v1.endpoints import (
    audiencias,
    auth,
    causas,
    configuracion_correo,
    dashboard,
    estado_diario,
    google_calendar,
    jurisdicciones,
    movimientos,
    reportes,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(causas.router)
api_router.include_router(dashboard.router)
api_router.include_router(jurisdicciones.router)
api_router.include_router(estado_diario.router)
api_router.include_router(movimientos.router)
api_router.include_router(audiencias.router)
api_router.include_router(reportes.router)
api_router.include_router(configuracion_correo.router)
api_router.include_router(google_calendar.router)
