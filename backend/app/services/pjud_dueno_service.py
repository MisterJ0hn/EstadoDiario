"""Abogado dueño de una causa a partir de una consulta al estilo api-pjud.

El espejo de api-pjud (`app/api/v1/endpoints/pjud_espejo.py`) recibe el cuerpo de
api-pjud —`corte`, `tribunal`, `tipo`, `rol`, `anio`—, no un id de causa nuestro. Para
sincronizar con la clave del abogado asignado hay que hacer el camino inverso: del
cuerpo a la causa de la cartera vigente, y de ahí a su dueño (`credenciales_del_dueno`).

**Ante la duda no hay dueño.** Si la causa no aparece, o aparece más de una vez con
dueños distintos (o con alguno sin dueño), se devuelve `None` y el espejo deja las
credenciales que mande el integrador. Nunca se elige un abogado al azar: sincronizar
con la clave de otra persona es peor que sincronizar sin ella.
"""

import logging
import re
from types import SimpleNamespace
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.credenciales_pjud import credenciales_del_dueno
from app.models.causa import Causa
from app.models.causa_corte import CausaCorte
from app.models.usuario_rut import limpiar_rut
from app.repositories.causa_repository import ultimo_origen_causas_id
from app.services.pjud_service import PjudApiError, PjudService, _normalizar

logger = logging.getLogger(__name__)

# competencia de api-pjud → materia como la guarda la cartera.
MATERIAS = {
    "civil": "Civil",
    "familia": "Familia",
    "laboral": "Laboral",
    "cobranza": "Cobranza",
    "penal": "Penal",
}


def _entero(valor) -> Optional[int]:
    try:
        return int(str(valor).strip())
    except (TypeError, ValueError):
        return None


def _nombre_tribunal(servicio: PjudService, competencia: str, cuerpo: dict) -> Optional[str]:
    """Nombre del tribunal según el catálogo de api-pjud, o `None` si el cuerpo no
    trae uno (Familia manda 0/0) o el catálogo no lo conoce."""
    corte_id, tribunal_id = _entero(cuerpo.get("corte")), _entero(cuerpo.get("tribunal"))
    if not corte_id or not tribunal_id:
        return None
    try:
        catalogo = servicio.catalogo_tribunales(competencia)
    except PjudApiError:
        return None
    for corte in catalogo:
        if corte.get("id") != corte_id:
            continue
        for tribunal in corte.get("tribunales", []):
            if tribunal.get("id") == tribunal_id:
                return tribunal.get("nombre")
    return None


def _unico_rut(ruts: list[Optional[str]]) -> Optional[str]:
    """El RUT común a todas, o `None` si falta alguno o hay más de uno."""
    limpios = {limpiar_rut(r or "") for r in ruts}
    return limpios.pop() if len(limpios) == 1 and "" not in limpios else None


def _por_causa(
    db: Session, servicio: PjudService, competencia: str, cuerpo: dict
) -> Optional[Causa]:
    numero, anio = _entero(cuerpo.get("rol")), _entero(cuerpo.get("anio"))
    tipo = str(cuerpo.get("tipo") or "").strip().upper()
    origen_id = ultimo_origen_causas_id(db)
    if not origen_id or numero is None or anio is None:
        return None

    # Civil/Familia/Laboral/Cobranza guardan `C-1234-2026`; Penal, `1653-2023`
    # (a veces con letra). Se prueban las dos formas.
    roles = {f"{numero}-{anio}"}
    if tipo:
        roles.add(f"{tipo}-{numero}-{anio}".lower())
    candidatas = (
        db.query(Causa)
        .filter(
            Causa.estado_diario_origen_id == origen_id,
            Causa.materia == MATERIAS[competencia],
            func.lower(func.trim(Causa.rol)).in_({r.lower() for r in roles}),
        )
        .all()
    )

    tribunal = _nombre_tribunal(servicio, competencia, cuerpo)
    if tribunal is not None:
        objetivo = _normalizar(tribunal)
        candidatas = [c for c in candidatas if _normalizar(c.tribunal or "") == objetivo]

    if not candidatas or _unico_rut([c.rut_efectivo for c in candidatas]) is None:
        return None
    return candidatas[0]


def _por_corte(db: Session, cuerpo: dict) -> Optional[SimpleNamespace]:
    """Apelaciones vive en `causa_corte`; su dueño es el del archivo de origen."""
    numero, anio = _entero(cuerpo.get("rol")), _entero(cuerpo.get("anio"))
    corte = _normalizar(str(cuerpo.get("corte") or ""))
    origen_id = ultimo_origen_causas_id(db)
    if not origen_id or numero is None or anio is None or not corte:
        return None

    filas = (
        db.query(CausaCorte)
        .filter(
            CausaCorte.estado_diario_origen_id == origen_id,
            func.lower(CausaCorte.tipo) == "apelaciones",
            CausaCorte.rol.like(f"%{numero}%"),
        )
        .all()
    )

    def coincide(fila: CausaCorte) -> bool:
        n = re.search(r"\d+", str(fila.rol or ""))
        a = re.search(r"\d{4}", str(fila.era or ""))
        return (
            bool(n and a)
            and int(n.group()) == numero
            and int(a.group()) == anio
            and _normalizar(fila.corte or "") == corte
        )

    candidatas = [f for f in filas if coincide(f)]
    ruts = [f.estado_diario_origen.rut if f.estado_diario_origen else None for f in candidatas]
    rut = _unico_rut(ruts) if candidatas else None
    return SimpleNamespace(rut_efectivo=rut) if rut else None


def credenciales_del_abogado_asignado(
    db: Session, servicio: PjudService, competencia: str, cuerpo: dict
) -> Optional[dict]:
    """`{"rut", "clave", "metodo_login"}` del abogado asignado a la causa que pide
    `cuerpo`, o `None` si no se puede determinar (ver el docstring del módulo)."""
    try:
        causa = (
            _por_corte(db, cuerpo)
            if competencia == "apelaciones"
            else _por_causa(db, servicio, competencia, cuerpo)
        )
        return credenciales_del_dueno(db, causa) if causa is not None else None
    except Exception:
        # Resolver al dueño es una mejora: si falla, el espejo sigue con lo que mandó
        # el integrador en vez de tumbar la consulta.
        logger.exception("No se pudo resolver el abogado asignado de la consulta PJUD")
        db.rollback()
        return None
