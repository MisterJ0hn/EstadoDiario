"""Filtro opcional por lista de causas (`roles`) para los listados de lectura.

Lo usa un sistema externo que ya sabe qué causas le interesan (su propia
cartera) y quiere que la paginación y los totales salgan ya acotados a ellas,
en vez de traer todo y filtrar de su lado.

Cada entrada es `rol` o `rol|tribunal`. El rol solo NO identifica una causa:
`C-100-2020` existe en muchos tribunales. Con `|tribunal` la entrada calza solo
en ese tribunal; sin él, en cualquiera (compatibilidad y casos en que el
sistema externo no conoce el tribunal).

Es OPCIONAL: sin el parámetro, o vacío, el listado se comporta como siempre.
Que venga vacío NO significa "ninguna causa", significa "sin filtro".

Rol y tribunal se comparan completos, sin distinguir mayúsculas ni espacios de
borde. No es `ilike`: un rol es un identificador, y `C-12-2020` no debe traer
`C-123-2020`; y "1° Juzgado Civil de Santiago" no debe traer "... Santiago Norte".
Por lo mismo el nombre del tribunal tiene que escribirse igual que en los
archivos cargados (ver `tribunal` en las respuestas).
"""

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_

# Tope de roles por request. Viajan en la URL (GET) y el límite práctico de
# cabeceras del proxy es de algunos KB; con roles de ~15 caracteres esto entra.
MAX_ROLES = 300

# (rol, tribunal o None). Tribunal None = cualquier tribunal.
RolFiltro = tuple[str, str | None]


DESC_ROLES = (
    "Opcional. Causas a devolver, separadas por coma; cada una `rol` o "
    "`rol|tribunal` (ej. `C-1234-2020|1° Juzgado Civil de Santiago,C-55-2021`). "
    "Con tribunal, calza solo en ese tribunal (exacto). Sin el parámetro, no se "
    f"filtra. Máximo {MAX_ROLES}."
)


def parse_roles(valor: str | None) -> list[RolFiltro] | None:
    """`"C-1-2020|Trib A, C-2-2021"` → `[("C-1-2020", "Trib A"), ("C-2-2021", None)]`."""
    if not valor:
        return None
    roles: list[RolFiltro] = []
    vistos: set[RolFiltro] = set()
    for bruto in valor.split(","):
        rol, _, tribunal = bruto.partition("|")
        rol, tribunal = rol.strip(), tribunal.strip() or None
        if not rol:
            continue
        clave = (rol.upper(), tribunal.upper() if tribunal else None)
        if clave in vistos:
            continue
        vistos.add(clave)
        roles.append((rol, tribunal))
    if not roles:
        return None
    if len(roles) > MAX_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Máximo {MAX_ROLES} roles por consulta",
        )
    return roles


def _norm(columna):
    return func.upper(func.trim(columna))


def filtrar_por_roles(query, col_rol, col_tribunal, roles: list[RolFiltro] | None):
    """Acota `query` a las causas de `roles`. `None` = sin filtro."""
    if not roles:
        return query
    sin_tribunal = [r.upper() for r, t in roles if t is None]
    condiciones = []
    if sin_tribunal:
        condiciones.append(_norm(col_rol).in_(sin_tribunal))
    for rol, tribunal in roles:
        if tribunal is not None:
            condiciones.append(
                and_(_norm(col_rol) == rol.upper(), _norm(col_tribunal) == tribunal.upper())
            )
    return query.filter(or_(*condiciones))
