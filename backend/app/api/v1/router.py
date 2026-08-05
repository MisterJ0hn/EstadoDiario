from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_sistema,
    audiencias,
    auth,
    auth_admin,
    clientes,
    configuracion_correo,
    configuracion_google,
    configuracion_whatsapp,
    dashboard,
    estado_diario,
    google_calendar,
    jurisdicciones,
    movimientos,
    reportes,
    usuarios,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(auth_admin.router)
api_router.include_router(admin_sistema.router)
api_router.include_router(clientes.router)
api_router.include_router(dashboard.router)
api_router.include_router(jurisdicciones.router)
api_router.include_router(estado_diario.router)
api_router.include_router(movimientos.router)
api_router.include_router(audiencias.router)
api_router.include_router(reportes.router)
api_router.include_router(configuracion_correo.router)
api_router.include_router(usuarios.router)
api_router.include_router(configuracion_google.router)
api_router.include_router(configuracion_whatsapp.router)
api_router.include_router(google_calendar.router)
