from fastapi import APIRouter

from app.api.v1.endpoints import auth, jurisdicciones, estado_diario

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(jurisdicciones.router)
api_router.include_router(estado_diario.router)
