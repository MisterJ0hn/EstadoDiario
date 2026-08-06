from fastapi import APIRouter

from admin_api.app.endpoints import (
    admin_sistema,
    auth_admin,
    clientes,
    configuracion_google,
    configuracion_smtp,
    configuracion_whatsapp,
)

# Mismo prefijo que la API de los estudios a propósito: las rutas no cambiaron
# al separar el servicio, solo el puerto. Así la SPA solo tuvo que mover la URL
# base a http://localhost:8092/api/v1.
api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_admin.router)
api_router.include_router(admin_sistema.router)
api_router.include_router(clientes.router)
api_router.include_router(configuracion_google.router)
api_router.include_router(configuracion_smtp.router)
api_router.include_router(configuracion_whatsapp.router)
