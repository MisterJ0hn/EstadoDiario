"""Tests del plumbing multi-tenant: hash de búsqueda, cifrado reversible,
nombres de base y separación de esquemas.

No tocan PostgreSQL: todo lo que se prueba acá es lógica pura o metadatos de
SQLAlchemy. La creación real de una base de cliente necesita un servidor y se
verifica aparte.
"""

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.database import (
    BaseMaestra,
    BaseTenant,
    nombre_base_tenant,
    validar_guid,
)
from app.core.deps import get_tenant_actual
from app.core.security import create_access_token
from app.services.auth_service import AMBITO_CLIENTE
from app.core.esquema import TABLAS_TENANT
from app.core.hash_busqueda import hash_busqueda, hash_rut, normalizar_rut
from app.models.maestra.cliente import Cliente
from app.models.usuario import Usuario


# ── Hash de búsqueda ──────────────────────────────────────


def test_hash_es_determinista():
    # Es lo que hace que se pueda buscar por un campo cifrado: el cifrado no
    # es determinista, el hash sí.
    assert hash_busqueda("jperez") == hash_busqueda("jperez")


def test_hash_ignora_mayusculas_y_espacios():
    assert hash_busqueda("  JPerez ") == hash_busqueda("jperez")


def test_hash_distingue_valores_distintos():
    assert hash_busqueda("jperez") != hash_busqueda("jperez2")


def test_normalizar_rut_acepta_las_tres_formas_de_escribirlo():
    assert normalizar_rut("12.345.678-9") == "12345678-9"
    assert normalizar_rut("123456789") == "12345678-9"
    assert normalizar_rut("12345678-9") == "12345678-9"


def test_rut_con_k_de_verificador():
    assert normalizar_rut("7.654.321-K") == "7654321-k"
    assert hash_rut("7654321-k") == hash_rut("7.654.321-K")


def test_rut_invalido_revienta():
    with pytest.raises(ValueError):
        normalizar_rut("-")


# ── Cifrado reversible en los modelos ─────────────────────


def test_usuario_cifra_y_descifra_sus_campos():
    u = Usuario()
    u.usuario = "JPerez"
    u.correo = "jperez@estudio.cl"
    u.telefono = "+56912345678"

    # En la columna no queda texto legible...
    assert "JPerez" not in u.usuario_cifrado
    assert "jperez@estudio.cl" not in u.correo_cifrado
    # ...pero la propiedad devuelve el valor original.
    assert u.usuario == "JPerez"
    assert u.correo == "jperez@estudio.cl"
    assert u.telefono == "+56912345678"


def test_usuario_calcula_el_hash_de_busqueda_al_asignar():
    u = Usuario()
    u.usuario = "JPerez"
    # El login busca por este hash, no por la columna cifrada.
    assert u.usuario_hash == hash_busqueda("jperez")


def test_cliente_normaliza_el_rut_antes_de_cifrarlo():
    c = Cliente(nombre="Estudio", guid="x", base_datos="y")
    c.rut = "12.345.678-9"
    assert c.rut == "12345678-9"
    assert c.rut_hash == hash_rut("123456789")


def test_inbox_por_defecto_del_cliente():
    c = Cliente(nombre="Estudio", guid="ud343-343ddc", base_datos="z")
    assert c.inbox == "ud343-343ddc@temposoft.cl"


# ── Nombre de la base y validación del guid ───────────────


def test_nombre_de_base_lleva_el_prefijo():
    assert nombre_base_tenant("ud343-343ddc") == "estado_diario_ud343-343ddc"


@pytest.mark.parametrize(
    "guid",
    [
        "",
        "con espacio",
        'x"; DROP DATABASE estado_diario; --',
        "acentuado-ñ",
        "x" * 50,  # se pasa del largo que deja el prefijo (63 bytes en total)
    ],
)
def test_guid_invalido_no_llega_al_create_database(guid):
    # El nombre de una base no se puede parametrizar: va interpolado en el DDL.
    # Esta lista blanca es lo único que separa eso de una inyección.
    with pytest.raises(ValueError):
        validar_guid(guid)


# ── Separación de esquemas ────────────────────────────────


def test_la_base_del_cliente_tiene_exactamente_las_12_tablas():
    assert sorted(BaseTenant.metadata.tables) == sorted(TABLAS_TENANT)


def test_la_base_principal_no_lleva_datos_operativos():
    # Si una tabla de causas apareciera acá, se estaría creando en la base
    # principal y todos los clientes la compartirían.
    assert sorted(BaseMaestra.metadata.tables) == [
        "cliente",
        "configuracion_correo",
        "configuracion_google",
        "configuracion_sistema",
        "configuracion_smtp",
        "configuracion_whatsapp",
        "usuario",
    ]


# ── Ruteo por tenant: el token manda, el header solo verifica ────────────


def _credenciales(guid: str, cliente_id: int = 7, usuario_id: int = 3):
    token = create_access_token(
        {
            "sub": str(usuario_id),
            "usuario": "jperez",
            "rol": "usuario",
            "ambito": AMBITO_CLIENTE,
            "guid": guid,
            "cliente_id": cliente_id,
        }
    )
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_el_tenant_sale_del_token():
    contexto = get_tenant_actual(_credenciales("guid-a"), x_cliente_guid=None)
    assert contexto.guid == "guid-a"
    assert contexto.cliente_id == 7


def test_header_que_calza_no_molesta():
    contexto = get_tenant_actual(_credenciales("guid-a"), x_cliente_guid="guid-a")
    assert contexto.guid == "guid-a"


def test_header_de_otro_cliente_se_rechaza():
    # El caso peligroso: sesión válida + header cambiado a mano. Si esto
    # pasara, se leería la base de otro estudio.
    with pytest.raises(HTTPException) as e:
        get_tenant_actual(_credenciales("guid-a"), x_cliente_guid="guid-de-otro")
    assert e.value.status_code == 403


def test_token_sin_guid_no_rutea_a_ninguna_base():
    token = create_access_token({"sub": "3", "ambito": AMBITO_CLIENTE})
    credenciales = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as e:
        get_tenant_actual(credenciales, x_cliente_guid=None)
    assert e.value.status_code == 401


def test_usuario_es_una_tabla_distinta_en_cada_base():
    # Mismo nombre, columnas distintas: el admin del sistema no tiene rol ni
    # campos cifrados (su nombre de usuario va en claro y se busca directo);
    # el del cliente sí, y por eso necesita el hash para poder buscarlo.
    maestra = BaseMaestra.metadata.tables["usuario"]
    tenant = BaseTenant.metadata.tables["usuario"]
    assert maestra is not tenant
    assert "usuario_hash" not in maestra.columns
    assert "rol" not in maestra.columns
    assert "usuario_hash" in tenant.columns
    assert "rol" in tenant.columns
