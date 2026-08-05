from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db_tenant, get_usuario_actual
from app.repositories.jurisdiccion_repository import JurisdiccionRepository
from app.schemas.jurisdiccion import JurisdiccionListResponse

router = APIRouter(prefix="/jurisdicciones", tags=["Jurisdicciones"])


@router.get(
    "",
    response_model=JurisdiccionListResponse,
    summary="Listar jurisdicciones",
)
def listar_jurisdicciones(
    db: Session = Depends(get_db_tenant),
    _=Depends(get_usuario_actual),
):
    """Obtener todas las jurisdicciones ordenadas por nombre."""
    repo = JurisdiccionRepository(db)
    items = repo.find_all()
    return JurisdiccionListResponse(
        total=len(items),
        jurisdicciones=[{"id": j.id, "nombre": j.nombre} for j in items],
    )
