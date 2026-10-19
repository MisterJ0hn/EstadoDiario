"""Pendiente desde una integración con un usuario propio del cliente.

La regla que se protege: el `username` de una integración puede no existir en
`usuario` y entonces queda como texto de atribución; una persona (JWT) sigue
necesitando un usuario real. El texto nunca enlaza a bajas ni a otras cuentas
de integración.

Base SQLite en memoria: se prueba la regla, no el SQL de PostgreSQL.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.core.exceptions import BadRequestException
from app.models.api_llamado_estado_diario import ApiLlamadoEstadoDiario
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_agenda import EstadoDiarioAgenda
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.jurisdiccion import Jurisdiccion
from app.models.log_actividades import LogActividades
from app.models.usuario import Usuario
from app.services.estado_diario_service import EstadoDiarioService


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(
        engine,
        tables=[
            Usuario.__table__,
            EstadoDiarioOrigen.__table__,
            EstadoDiario.__table__,
            EstadoDiarioAgenda.__table__,
            Jurisdiccion.__table__,
            LogActividades.__table__,
            ApiLlamadoEstadoDiario.__table__,
        ],
    )
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


def _usuario(db, nombre, *, activo=True, es_integracion=False):
    u = Usuario(password_hash="x", nombre=nombre, activo=activo, es_integracion=es_integracion)
    u.usuario = nombre
    db.add(u)
    db.commit()
    return u


def _movimiento(db):
    origen = EstadoDiarioOrigen(rut="16952077-1", nombre_archivo="a.xlsx")
    db.add(origen)
    db.flush()
    ed = EstadoDiario(estado_diario_origen_id=origen.id, rol="C-1-2026")
    db.add(ed)
    db.commit()
    return ed


def test_integracion_con_usuario_inexistente_queda_como_texto(db):
    robot = _usuario(db, "robot", es_integracion=True)
    ed = _movimiento(db)

    EstadoDiarioService(db).marcar_pendiente(
        ed.id, "alto", "jperez@cliente.cl", usuario_id=robot.id, integracion=robot,
    )

    db.refresh(ed)
    assert ed.pendiente is True
    assert ed.usuario_pendiente_id is None
    assert ed.usuario_pendiente_externo == "jperez@cliente.cl"


def test_integracion_con_agenda_deja_el_recordatorio_a_la_cuenta_de_integracion(db):
    robot = _usuario(db, "robot", es_integracion=True)
    ed = _movimiento(db)

    EstadoDiarioService(db).marcar_pendiente(
        ed.id, "medio", "Juan Pérez", "Llamar", "2026-12-01 10:00:00",
        usuario_id=robot.id, integracion=robot,
    )

    agenda = db.query(EstadoDiarioAgenda).one()
    assert agenda.usuario_registro_id == robot.id
    assert agenda.usuario_registro_externo == "Juan Pérez"


def test_integracion_con_persona_activa_la_enlaza(db):
    robot = _usuario(db, "robot", es_integracion=True)
    ana = _usuario(db, "ana")
    ed = _movimiento(db)

    EstadoDiarioService(db).marcar_pendiente(
        ed.id, "bajo", "ana", usuario_id=robot.id, integracion=robot,
    )

    db.refresh(ed)
    assert ed.usuario_pendiente_id == ana.id
    assert ed.usuario_pendiente_externo is None


@pytest.mark.parametrize("nombre,kwargs", [
    ("baja", {"activo": False}),
    ("otro-robot", {"es_integracion": True}),
])
def test_integracion_no_enlaza_bajas_ni_otras_integraciones(db, nombre, kwargs):
    robot = _usuario(db, "robot", es_integracion=True)
    ajeno = _usuario(db, nombre, **kwargs)
    ed = _movimiento(db)

    EstadoDiarioService(db).marcar_pendiente(
        ed.id, "bajo", nombre, usuario_id=robot.id, integracion=robot,
    )

    db.refresh(ed)
    assert ed.usuario_pendiente_id != ajeno.id
    assert ed.usuario_pendiente_externo == nombre


@pytest.mark.parametrize("texto", ["<script>", "a;b", "x" * 101, "  "])
def test_integracion_rechaza_texto_con_formato_invalido(db, texto):
    robot = _usuario(db, "robot", es_integracion=True)
    ed = _movimiento(db)

    with pytest.raises(BadRequestException):
        EstadoDiarioService(db).marcar_pendiente(
            ed.id, "alto", texto, usuario_id=robot.id, integracion=robot,
        )


def test_persona_con_usuario_inexistente_sigue_rechazada(db):
    ana = _usuario(db, "ana")
    ed = _movimiento(db)

    with pytest.raises(BadRequestException, match="username no existe"):
        EstadoDiarioService(db).marcar_pendiente(
            ed.id, "alto", "fantasma", usuario_id=ana.id,
        )
