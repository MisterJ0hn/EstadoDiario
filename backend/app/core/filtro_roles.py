"""Filtro opcional por lista de causas (`roles`) para los listados de lectura.

Lo usa un sistema externo que ya sabe qué causas le interesan (su propia
cartera) y quiere que la paginación y los totales salgan ya acotados a ellas,
en vez de traer todo y filtrar de su lado.

Es OPCIONAL: sin el parámetro, o vacío, el listado se comporta como siempre.
Que venga vacío NO significa "ninguna causa", significa "sin filtro".

El rol se compara exacto, sin distinguir mayúsculas ni espacios de borde
(`c-1234-2020` calza con `C-1234-2020`). No es `ilike`: un rol es un
identificador, y `C-12-2020` no debe traer `C-123-2020`.
"""

from fastapi import HTTPException, status
from sqlalchemy import func

# Tope de roles por request. Viajan en la URL (GET) y el límite práctico de
# cabeceras del proxy es de algunos KB; con roles de ~15 caracteres esto entra.
MAX_ROLES = 300


DESC_ROLES = (
    "Opcional. Roles/RIT de las causas a devolver, separados por coma "
    "(ej. `C-1234-2020,C-55-2021`). Sin el parámetro, no se filtra. "
    f"Máximo {MAX_ROLES}."
)


def parse_roles(valor: str | None) -> list[str] | None:
    """`"C-1-2020, C-2-2021"` → `["C-1-2020", "C-2-2021"]`; vacío → `None`."""
    if not valor:
        return None
    roles: list[str] = []
    for bruto in valor.split(","):
        rol = bruto.strip()
        if rol and rol.upper() not in (r.upper() for r in roles):
            roles.append(rol)
    if not roles:
        return None
    if len(roles) > MAX_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Máximo {MAX_ROLES} roles por consulta",
        )
    return roles


def filtrar_por_roles(query, columna, roles: list[str] | None):
    """Acota `query` a las filas cuya `columna` está en `roles`. `None` = sin filtro."""
    if not roles:
        return query
    return query.filter(func.upper(func.trim(columna)).in_([r.upper() for r in roles]))
