"""Política de contraseñas: formato e historial.

El formato es lógica pura. El historial necesita una base, así que se levanta
SQLite en memoria con las dos únicas tablas que intervienen: la regla es
"cuántas filas veta", y eso no depende del motor.

Se usan pocas contraseñas distintas a propósito: cada `get_password_hash` es
un bcrypt de verdad y cuesta cientos de milisegundos.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import BaseTenant
from app.core.exceptions import BadRequestException, UnauthorizedException
from app.core.password_policy import HISTORIAL_MAXIMO, incumplimientos, validar
from app.core.security import get_password_hash, verify_password
from app.models.password_historial import PasswordHistorial
from app.models.usuario import Usuario
from app.services import password_service


# ── Formato ───────────────────────────────────────────────


@pytest.mark.parametrize(
    "password",
    [
        "Abcdefg1",
        "Contraseña1",
        "MiClave2026",
        "aA1bbbbbbbbb",
    ],
)
def test_una_contrasena_que_cumple_pasa(password):
    assert incumplimientos(password) == []


@pytest.mark.parametrize(
    "password, falta",
    [
        ("Abc1", "al menos 8 caracteres"),
        ("abcdefg1", "al menos una letra mayúscula"),
        ("ABCDEFG1", "al menos una letra minúscula"),
        ("Abcdefgh", "al menos un número"),
    ],
)
def test_cada_regla_se_exige_por_separado(password, falta):
    assert falta in incumplimientos(password)


def test_el_error_nombra_todas_las_reglas_que_faltan():
    """De a una obligaría a descubrir los requisitos a fuerza de intentos."""
    with pytest.raises(BadRequestException) as e:
        validar("abc")
    detalle = e.value.detail
    assert "8 caracteres" in detalle
    assert "mayúscula" in detalle
    assert "número" in detalle


def test_las_acentuadas_y_la_ene_cuentan_como_letras():
    # Un apellido chileno con tilde no puede quedar leído como símbolo raro.
    assert incumplimientos("Ñandú2026") == []


# ── Historial ─────────────────────────────────────────────


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    BaseTenant.metadata.create_all(
        engine, tables=[Usuario.__table__, PasswordHistorial.__table__]
    )
    sesion = sessionmaker(bind=engine)()
    try:
        yield sesion
    finally:
        sesion.close()


@pytest.fixture
def usuario(db):
    registro = Usuario(password_hash=get_password_hash("Inicial1"))
    registro.usuario = "jperez"
    db.add(registro)
    db.commit()
    password_service.registrar(db, registro.id, registro.password_hash, PasswordHistorial)
    db.commit()
    return registro


def test_no_se_puede_repetir_la_contrasena_vigente(db, usuario):
    with pytest.raises(BadRequestException) as e:
        password_service.validar_nueva(db, usuario, "Inicial1", PasswordHistorial)
    assert "distinta de la actual" in e.value.detail


def test_no_se_puede_volver_a_una_anterior_dentro_del_historial(db, usuario):
    password_service.aplicar(db, usuario, "Segunda22", PasswordHistorial)

    with pytest.raises(BadRequestException) as e:
        password_service.validar_nueva(db, usuario, "Inicial1", PasswordHistorial)
    assert str(HISTORIAL_MAXIMO) in e.value.detail


def test_una_contrasena_nunca_usada_se_acepta(db, usuario):
    password_service.aplicar(db, usuario, "Segunda22", PasswordHistorial)
    assert verify_password("Segunda22", usuario.password_hash)
    assert usuario.debe_cambiar_password is False


def test_la_mas_vieja_sale_del_historial_y_vuelve_a_servir(db, usuario):
    """El historial es de las últimas N, no de todas: pasada esa cantidad, la
    primera vuelve a estar disponible. Si no, la lista crecería para siempre."""
    for password in ("Segunda22", "Tercera33", "Cuarta444"):
        password_service.aplicar(db, usuario, password, PasswordHistorial)

    # Historial: Cuarta(actual), Tercera, Segunda, Inicial → cuatro vetadas.
    with pytest.raises(BadRequestException):
        password_service.validar_nueva(db, usuario, "Inicial1", PasswordHistorial)

    # Una más y la inicial ya quedó fuera de la ventana.
    password_service.aplicar(db, usuario, "Quinta555", PasswordHistorial)
    password_service.validar_nueva(db, usuario, "Inicial1", PasswordHistorial)


def test_el_historial_no_crece_sin_limite(db, usuario):
    for password in ("Segunda22", "Tercera33", "Cuarta444", "Quinta555"):
        password_service.aplicar(db, usuario, password, PasswordHistorial)

    filas = db.query(PasswordHistorial).filter_by(usuario_id=usuario.id).count()
    assert filas == HISTORIAL_MAXIMO


def test_una_cuenta_sin_historial_igual_tiene_vetada_la_vigente(db):
    """Las cuentas anteriores a esta funcionalidad no tienen ninguna fila: la
    clave vigente se veta porque sale del usuario, no del historial."""
    viejo = Usuario(password_hash=get_password_hash("Antigua11"))
    viejo.usuario = "mgonzalez"
    db.add(viejo)
    db.commit()

    with pytest.raises(BadRequestException):
        password_service.validar_nueva(db, viejo, "Antigua11", PasswordHistorial)


def test_el_formato_se_valida_antes_que_el_historial(db, usuario):
    # Una clave corta se rechaza por corta, aunque además esté en el historial.
    with pytest.raises(BadRequestException) as e:
        password_service.validar_nueva(db, usuario, "abc", PasswordHistorial)
    assert "8 caracteres" in e.value.detail


# ── Cambio voluntario: se exige la clave actual ───────────


def test_el_cambio_voluntario_pide_la_clave_actual(db, usuario):
    with pytest.raises(BadRequestException) as e:
        password_service.aplicar(
            db, usuario, "Segunda22", PasswordHistorial, exigir_actual=True
        )
    assert "contraseña actual" in e.value.detail


def test_la_clave_actual_equivocada_no_cambia_nada(db, usuario):
    with pytest.raises(UnauthorizedException):
        password_service.aplicar(
            db,
            usuario,
            "Segunda22",
            PasswordHistorial,
            exigir_actual=True,
            password_actual="LaQueNoEs1",
        )
    assert verify_password("Inicial1", usuario.password_hash)


def test_con_la_clave_actual_correcta_el_cambio_se_aplica(db, usuario):
    password_service.aplicar(
        db,
        usuario,
        "Segunda22",
        PasswordHistorial,
        exigir_actual=True,
        password_actual="Inicial1",
    )
    assert verify_password("Segunda22", usuario.password_hash)


def test_una_clave_puesta_por_un_tercero_obliga_a_cambiarla(db, usuario):
    password_service.aplicar(db, usuario, "Segunda22", PasswordHistorial, provisoria=True)
    assert usuario.debe_cambiar_password is True
