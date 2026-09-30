"""Filtro opcional `roles` de los listados (estado diario, movimientos, audiencias).

Base SQLite en memoria: se prueba la regla (exacto, sin distinguir mayúsculas,
opcional), no SQL de PostgreSQL.
"""

from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.core.filtro_roles import MAX_ROLES, parse_roles
from app.models.audiencia import Audiencia
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.repositories.audiencia_repository import AudienciaRepository


def test_sin_parametro_o_vacio_no_hay_filtro():
    assert parse_roles(None) is None
    assert parse_roles("") is None
    assert parse_roles(" , ,") is None


def test_separa_limpia_y_deduplica_sin_distinguir_mayusculas():
    assert parse_roles(" C-1-2020 , c-1-2020,C-2-2021 ") == [("C-1-2020", None), ("C-2-2021", None)]


def test_separa_rol_y_tribunal():
    assert parse_roles("C-1-2020|1° Juzgado Civil, C-1-2020|2° Juzgado Civil, C-1-2020|1° JUZGADO CIVIL") == [
        ("C-1-2020", "1° Juzgado Civil"),
        ("C-1-2020", "2° Juzgado Civil"),
    ]


def test_mas_del_maximo_se_rechaza():
    with pytest.raises(HTTPException) as e:
        parse_roles(",".join(f"C-{i}-2020" for i in range(MAX_ROLES + 1)))
    assert e.value.status_code == 422


@pytest.fixture
def repo():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(engine, tables=[EstadoDiarioOrigen.__table__, Audiencia.__table__])
    db = sessionmaker(bind=engine)()
    filas = [
        ("C-12-2020", "1° Juzgado Civil de Santiago"),
        ("C-123-2020", "1° Juzgado Civil de Santiago"),
        (" c-55-2021 ", "2° Juzgado Civil de Santiago"),
        ("C-55-2021", "1° Juzgado Civil de Puente Alto"),
        (None, None),
    ]
    for i, (rol, tribunal) in enumerate(filas):
        db.add(Audiencia(
            usuario_id=1, fecha_audiencia=date(2026, 10, 1), clave_natural=f"k{i}",
            rol=rol, tribunal=tribunal,
        ))
    db.flush()
    try:
        yield AudienciaRepository(db)
    finally:
        db.close()


def _roles_de(repo, roles):
    items, total, _, _ = repo.find_filtered(roles=roles)
    assert total == len(items)
    return sorted((a.rol or "").strip().upper() for a in items)


def test_sin_filtro_devuelve_todo(repo):
    assert len(_roles_de(repo, None)) == 5


def test_calce_exacto_no_por_prefijo(repo):
    assert _roles_de(repo, [("C-12-2020", None)]) == ["C-12-2020"]


def test_ignora_mayusculas_y_espacios_de_borde(repo):
    assert _roles_de(repo, [("c-55-2021", "2° JUZGADO CIVIL DE SANTIAGO")]) == ["C-55-2021"]


def test_mismo_rol_en_otro_tribunal_se_distingue(repo):
    items, total, _, _ = repo.find_filtered(roles=[("C-55-2021", "1° Juzgado Civil de Puente Alto")])
    assert total == 1 and items[0].tribunal == "1° Juzgado Civil de Puente Alto"


def test_sin_tribunal_calza_en_cualquiera(repo):
    assert len(_roles_de(repo, [("C-55-2021", None)])) == 2


def test_tribunal_no_calza_por_contencion(repo):
    assert _roles_de(repo, [("C-12-2020", "Juzgado Civil")]) == []


def test_mezcla_de_entradas_con_y_sin_tribunal(repo):
    roles = [("C-12-2020", None), ("C-55-2021", "2° Juzgado Civil de Santiago")]
    assert len(_roles_de(repo, roles)) == 2


def test_total_y_conteo_por_materia_respetan_el_filtro(repo):
    assert repo.count_filtered(roles=[("C-12-2020", None), ("C-123-2020", None)]) == 2
    assert sum(c for _, c in repo.contar_por_materia(roles=[("C-12-2020", None)])) == 1
