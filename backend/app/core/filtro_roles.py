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

import re

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


def condicion_roles(col_rol, col_tribunal, roles: list[RolFiltro] | None):
    """Condición SQL de `roles` (OR entre entradas), o None si no hay filtro.
    Va aparte de `filtrar_por_roles` para poder combinarla con otras condiciones
    con OR."""
    if not roles:
        return None
    sin_tribunal = [r.upper() for r, t in roles if t is None]
    condiciones = []
    if sin_tribunal:
        condiciones.append(_norm(col_rol).in_(sin_tribunal))
    for rol, tribunal in roles:
        if tribunal is not None:
            condiciones.append(
                and_(_norm(col_rol) == rol.upper(), _norm(col_tribunal) == tribunal.upper())
            )
    return or_(*condiciones)


def filtrar_por_roles(query, col_rol, col_tribunal, roles: list[RolFiltro] | None):
    """Acota `query` a las causas de `roles`. `None` = sin filtro."""
    condicion = condicion_roles(col_rol, col_tribunal, roles)
    return query if condicion is None else query.filter(condicion)


# ── Causas de corte ───────────────────────────────────────
# Una causa de corte no tiene tribunal: se identifica por libro, rol, era y
# corte. Cada entrada es `libro-rol-era` o `libro-rol-era|corte`
# (ej. `Civil-1620-2026|C.A. de Santiago`), el mismo formato en que el PJUD
# escribe el rol. El libro es opcional (`1620-2026`); la corte también: sin ella
# la entrada calza en cualquier corte.

# (libro o None, rol, era, corte o None)
RolCorteFiltro = tuple[str | None, str, str, str | None]

DESC_ROLES_CORTE = (
    "Opcional. Causas a devolver, separadas por coma; cada una `libro-rol-era` o "
    "`libro-rol-era|corte` (ej. `Civil-1620-2026|C.A. de Santiago,Civil-55-2025`). "
    "Filtra por tipo de libro, rol, era y corte (exactos, sin distinguir "
    "mayúsculas). Sin el parámetro, no se filtra. "
    f"Máximo {MAX_ROLES}."
)

_ENTRADA_CORTE = re.compile(r"^(?:(?P<libro>.+?)\s*-\s*)?(?P<rol>\d+)\s*-\s*(?P<era>\d{4})$")


DESC_ROLES_ORIGEN = (
    "Opcional. Causas de primera instancia (origen) de las apelaciones, `rol` o "
    "`rol|tribunal` separadas por coma. Se suma a `roles` con OR: sale la apelación "
    "que calce con cualquiera de los dos. Solo conocen su origen las apelaciones "
    "cuyo detalle PJUD ya se consultó."
)


def parse_roles_corte(valor: str | None) -> list[RolCorteFiltro] | None:
    """`"Civil-1-2020|C.A. de Temuco"` → `[("Civil", "1", "2020", "C.A. de Temuco")]`."""
    if not valor:
        return None
    filtros: list[RolCorteFiltro] = []
    vistos: set[RolCorteFiltro] = set()
    for bruto in valor.split(","):
        if not bruto.strip():
            continue
        causa, _, corte = bruto.partition("|")
        m = _ENTRADA_CORTE.match(causa.strip())
        if not m:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Causa de corte inválida: «{bruto.strip()}». Use libro-rol-era, "
                       "p. ej. Civil-1620-2026 (opcional |corte).",
            )
        libro = (m.group("libro") or "").strip() or None
        filtro = (libro, str(int(m.group("rol"))), m.group("era"), corte.strip() or None)
        clave = tuple(x.upper() if x else x for x in filtro)
        if clave in vistos:
            continue
        vistos.add(clave)
        filtros.append(filtro)
    if not filtros:
        return None
    if len(filtros) > MAX_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Máximo {MAX_ROLES} roles por consulta",
        )
    return filtros


def condicion_roles_corte(modelo, roles: list[RolCorteFiltro] | None):
    """Condición SQL de `roles` sobre `CausaCorte`, o None si no hay filtro.

    El rol guardado puede ser solo el número (`1620`) o traer el libro
    (`Civil-1620`), según el Excel del que salió: calzan las dos formas.
    """
    if not roles:
        return None
    rol_col = _norm(modelo.rol)
    condiciones = []
    for libro, rol, era, corte in roles:
        partes = [
            or_(rol_col == rol, rol_col.like(f"%-{rol}"), rol_col.like(f"%- {rol}")),
            func.trim(modelo.era) == era,
        ]
        if libro:
            partes.append(_norm(modelo.tipo_libro) == libro.upper())
        if corte:
            partes.append(_norm(modelo.corte) == corte.upper())
        condiciones.append(and_(*partes))
    return or_(*condiciones)


def filtrar_por_roles_corte(query, modelo, roles: list[RolCorteFiltro] | None):
    """Acota `query` (sobre `CausaCorte`) a las causas de `roles`. `None` = sin filtro."""
    condicion = condicion_roles_corte(modelo, roles)
    return query if condicion is None else query.filter(condicion)


def parse_roles_origen(valor: str | None) -> list[RolFiltro] | None:
    """`roles_origen`: igual que `roles` de Mis Causas (`rol` o `rol|tribunal`),
    pero el rol se guarda sin espacios en `causa_corte.origen_rol`
    (`C - 711 - 2026` → `C-711-2026`)."""
    roles = parse_roles(valor)
    if not roles:
        return None
    return [("".join(r.split()), t) for r, t in roles]


def condicion_roles_numero_ingreso(modelo, roles: list[RolCorteFiltro] | None):
    """Igual que `condicion_roles_corte`, para las tablas que guardan el rol
    pegado en `numero_ingreso` (`Civil-1620-2026`), como `estado_diario_corte`.
    None si no hay filtro."""
    if not roles:
        return None
    ingreso = func.replace(func.upper(func.trim(modelo.numero_ingreso)), " ", "")
    condiciones = []
    for libro, rol, era, corte in roles:
        if libro:
            partes = [ingreso == f"{''.join(libro.upper().split())}-{rol}-{era}"]
        else:
            partes = [ingreso.like(f"%-{rol}-{era}")]
        if corte:
            partes.append(_norm(modelo.corte) == corte.upper())
        condiciones.append(and_(*partes))
    return or_(*condiciones)
