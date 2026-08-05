"""Permiso de visibilidad por jurisdicción, dentro de un estudio.

Estos tests SÍ tocan una base: las 13 tablas del tenant se crean en SQLite en
memoria. Probar el filtro con dobles no serviría de nada — lo que puede fallar
es el SQL, no el `if`.

Lo que se protege acá es que un abogado no vea causas de una jurisdicción que
no tiene asignada. Es la regla de aislamiento *dentro* del estudio; la de
aislamiento *entre* estudios es la base separada (ver test_multitenant.py).
"""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_agenda import EstadoDiarioAgenda
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.jurisdiccion import Jurisdiccion
from app.models.usuario import Usuario
from app.repositories.estado_diario_agenda_repository import EstadoDiarioAgendaRepository
from app.repositories.estado_diario_repository import EstadoDiarioRepository
from app.repositories.metricas_repository import MetricasRepository
from app.repositories.usuario_jurisdiccion_repository import UsuarioJurisdiccionRepository
from app.services.estado_diario_service import EstadoDiarioService


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(engine)
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()
        engine.dispose()


@pytest.fixture
def datos(db):
    """Un estudio con dos jurisdicciones, dos abogados y una causa de cada
    materia, más una causa sin clasificar."""
    civil = Jurisdiccion(nombre="Civil")
    familia = Jurisdiccion(nombre="Familia")
    db.add_all([civil, familia])
    db.flush()

    ana = Usuario(password_hash="x", rol="usuario")
    ana.usuario = "ana"
    beto = Usuario(password_hash="x", rol="usuario")
    beto.usuario = "beto"
    jefa = Usuario(password_hash="x", rol="admin")
    jefa.usuario = "jefa"
    db.add_all([ana, beto, jefa])
    db.flush()

    origen = EstadoDiarioOrigen(
        rut="76543210-9",
        fecha=date(2026, 8, 5),
        nombre_archivo="estado.xls",
        usuario_carga_id=ana.id,
        fecha_carga=datetime.now(timezone.utc),
    )
    db.add(origen)
    db.flush()

    causas = {
        "civil": EstadoDiario(
            estado_diario_origen_id=origen.id, jurisdiccion_id=civil.id, rol="C-1-2026"
        ),
        "familia": EstadoDiario(
            estado_diario_origen_id=origen.id, jurisdiccion_id=familia.id, rol="F-1-2026"
        ),
        # El parser no siempre logra clasificar: esta no tiene jurisdicción.
        "sin_clasificar": EstadoDiario(
            estado_diario_origen_id=origen.id, jurisdiccion_id=None, rol="X-1-2026"
        ),
    }
    db.add_all(causas.values())
    db.commit()

    return {
        "civil": civil,
        "familia": familia,
        "ana": ana,
        "beto": beto,
        "jefa": jefa,
        "causas": causas,
    }


def roles_visibles(db, usuario, **kwargs):
    """Los `rol` de causa que ve `usuario` en el listado de no leídos."""
    alcance = EstadoDiarioService.alcance(db, usuario)
    items, _, _, _ = EstadoDiarioRepository(db).find_filtered(alcance, **kwargs)
    return sorted(i.rol for i in items)


# ── alcance() ─────────────────────────────────────────────


def test_sin_asignaciones_ve_todo(db, datos):
    # Un estudio que nunca abrió la pantalla de permisos sigue funcionando
    # igual que antes: nadie se queda ciego por no haber configurado nada.
    assert EstadoDiarioService.alcance(db, datos["ana"]) is None


def test_el_admin_del_estudio_ve_todo_aunque_tenga_asignaciones(db, datos):
    UsuarioJurisdiccionRepository(db).reemplazar(datos["jefa"].id, [datos["civil"].id])
    assert EstadoDiarioService.alcance(db, datos["jefa"]) is None


def test_asignar_acota_el_alcance(db, datos):
    UsuarioJurisdiccionRepository(db).reemplazar(datos["ana"].id, [datos["civil"].id])
    assert EstadoDiarioService.alcance(db, datos["ana"]) == [datos["civil"].id]


def test_lista_vacia_devuelve_a_ver_todo(db, datos):
    repo = UsuarioJurisdiccionRepository(db)
    repo.reemplazar(datos["ana"].id, [datos["civil"].id])
    repo.reemplazar(datos["ana"].id, [])
    # Vacío = sin restricción, NO "no ve nada": una cuenta que no ve nada se
    # reporta como sistema roto, no como falta de permisos.
    assert EstadoDiarioService.alcance(db, datos["ana"]) is None


# ── El filtro sobre las causas ────────────────────────────


def test_solo_ve_las_causas_de_su_jurisdiccion(db, datos):
    UsuarioJurisdiccionRepository(db).reemplazar(datos["ana"].id, [datos["civil"].id])
    # La de familia no aparece; la sin clasificar sí (ver el repositorio).
    assert roles_visibles(db, datos["ana"]) == ["C-1-2026", "X-1-2026"]


def test_el_otro_abogado_ve_lo_suyo_y_no_lo_ajeno(db, datos):
    repo = UsuarioJurisdiccionRepository(db)
    repo.reemplazar(datos["ana"].id, [datos["civil"].id])
    repo.reemplazar(datos["beto"].id, [datos["familia"].id])
    assert roles_visibles(db, datos["beto"]) == ["F-1-2026", "X-1-2026"]


def test_el_admin_ve_todas(db, datos):
    assert roles_visibles(db, datos["jefa"]) == ["C-1-2026", "F-1-2026", "X-1-2026"]


def test_no_puede_abrir_por_id_una_causa_que_no_ve(db, datos):
    UsuarioJurisdiccionRepository(db).reemplazar(datos["ana"].id, [datos["civil"].id])
    alcance = EstadoDiarioService.alcance(db, datos["ana"])
    ajena = datos["causas"]["familia"]
    # Adivinar el id no alcanza: el filtro va en la consulta, no en la lista.
    assert EstadoDiarioRepository(db).find_by_id(ajena.id, alcance) is None
    assert EstadoDiarioRepository(db).find_by_id(datos["causas"]["civil"].id, alcance)


def test_ya_no_importa_quien_cargo_el_archivo(db, datos):
    # El archivo lo subió Ana; Beto igual ve su jurisdicción. Esto es lo que
    # antes fallaba: con una sola casilla por estudio, todo quedaba a nombre de
    # una persona y el resto no veía nada.
    UsuarioJurisdiccionRepository(db).reemplazar(datos["beto"].id, [datos["familia"].id])
    assert "F-1-2026" in roles_visibles(db, datos["beto"])


# ── Recordatorios y dashboard ─────────────────────────────


def test_los_recordatorios_siguen_la_jurisdiccion_de_su_causa(db, datos):
    db.add_all(
        [
            EstadoDiarioAgenda(
                estado_diario_id=datos["causas"]["civil"].id,
                usuario_registro_id=datos["jefa"].id,
                detalle="alegato civil",
                fecha_hora=datetime.now(timezone.utc),
            ),
            EstadoDiarioAgenda(
                estado_diario_id=datos["causas"]["familia"].id,
                usuario_registro_id=datos["jefa"].id,
                detalle="audiencia familia",
                fecha_hora=datetime.now(timezone.utc),
            ),
        ]
    )
    db.commit()

    UsuarioJurisdiccionRepository(db).reemplazar(datos["ana"].id, [datos["civil"].id])
    alcance = EstadoDiarioService.alcance(db, datos["ana"])

    vigentes = EstadoDiarioAgendaRepository(db).find_vigentes(alcance)
    # Lo ve aunque el recordatorio lo haya creado otra persona: si puede ver la
    # causa, tiene que saber que alguien ya la agendó.
    assert [a.detalle for a in vigentes] == ["alegato civil"]


def test_el_kpi_no_cuenta_causas_que_la_persona_no_puede_abrir(db, datos):
    UsuarioJurisdiccionRepository(db).reemplazar(datos["ana"].id, [datos["civil"].id])
    alcance = EstadoDiarioService.alcance(db, datos["ana"])

    # Un número del dashboard que sume causas invisibles manda a la persona a
    # buscar algo que no va a encontrar.
    assert MetricasRepository(db).contar_sin_revisar(alcance) == 2  # civil + sin clasificar
    assert MetricasRepository(db).contar_sin_revisar(None) == 3


# ── Mantención de las asignaciones ────────────────────────


def test_reemplazar_no_deja_duplicados(db, datos):
    repo = UsuarioJurisdiccionRepository(db)
    repo.reemplazar(datos["ana"].id, [datos["civil"].id, datos["civil"].id])
    assert repo.ids_de(datos["ana"].id) == [datos["civil"].id]


def test_borrar_de_deja_al_usuario_sin_restriccion(db, datos):
    repo = UsuarioJurisdiccionRepository(db)
    repo.reemplazar(datos["ana"].id, [datos["civil"].id])
    repo.borrar_de(datos["ana"].id)
    assert repo.ids_de(datos["ana"].id) == []
