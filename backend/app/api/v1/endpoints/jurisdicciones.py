from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db_tenant, get_usuario_actual
from app.repositories.jurisdiccion_repository import JurisdiccionRepository
from app.schemas.jurisdiccion import JurisdiccionListResponse
from app.services.import_service import normalizar_texto

router = APIRouter(prefix="/jurisdicciones", tags=["Jurisdicciones"])

# Jurisdicciones cuyas causas ya NO viven en `estado_diario`: se importan a
# `estado_diario_corte` y se ven en el submenú Corte. Se comparan normalizadas
# porque el nombre sembrado ("Corte de Apelaciones") no es igual al de la hoja
# del Excel ("Corte Apelaciones").
JURISDICCIONES_DE_CORTE = {"corte suprema", "corte de apelaciones", "corte apelaciones"}


def es_de_corte(nombre: str) -> bool:
    return normalizar_texto(nombre) in JURISDICCIONES_DE_CORTE


@router.get(
    "",
    response_model=JurisdiccionListResponse,
    summary="Listar jurisdicciones",
)
def listar_jurisdicciones(
    excluir_corte: bool = Query(
        False,
        description="Deja fuera las jurisdicciones de corte (para el filtro de Materia)",
    ),
    db: Session = Depends(get_db_tenant),
    _=Depends(get_usuario_actual),
):
    """Todas las jurisdicciones, ordenadas por nombre.

    `excluir_corte=true` es para el filtro del listado por **materia**: ahí
    ofrecer "Corte Suprema" o "Corte de Apelaciones" no filtraría nada, porque
    esas causas se movieron a su propia tabla. Se deja como parámetro y no como
    comportamiento fijo porque la pantalla de permisos sí necesita la lista
    completa: un usuario puede tener asignada una jurisdicción de corte.
    """
    items = JurisdiccionRepository(db).find_all()
    if excluir_corte:
        items = [j for j in items if not es_de_corte(j.nombre)]

    return JurisdiccionListResponse(
        total=len(items),
        jurisdicciones=[{"id": j.id, "nombre": j.nombre} for j in items],
    )
