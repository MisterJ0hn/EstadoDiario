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
        # Cada vez que un cliente pasó de activo a suspendido o al revés. Es
        # dato COMERCIAL de la plataforma —de ahí sale la serie mensual del
        # dashboard de la consola— y no operativo del estudio: el estudio no
        # tiene nada que hacer con la fecha en que se lo suspendió.
        "cliente_estado_historial",
        "configuracion_correo",
        "configuracion_google",
        "configuracion_sistema",
        "configuracion_smtp",
        # Credenciales de Webpay. Una sola fila global y sin `cliente_id`, al
        # revés que las tres de arriba: la cuenta de Transbank donde cae la
        # plata es la de la plataforma, no la del estudio. Una por cliente
        # significaría que un estudio se cobra a sí mismo.
        "configuracion_transbank",
        "configuracion_whatsapp",
        # Facturación de la plataforma: es dato COMERCIAL, no operativo del
        # estudio. Quien lo mira es el administrador que factura, que nunca abre
        # la base de un cliente; y el correlativo de las facturas es uno solo
        # para todos, así que no podría vivir repartido por tenant.
        "factura",
        "factura_detalle",
        # Los intentos de pago de esas facturas. Van donde está la factura que
        # pagan: un pago en la base del estudio no se podría cruzar con el
        # documento que cancela, que es lo único para lo que sirve.
        "pago",
        # El precio acordado con cada cliente. Va acá por lo mismo: es del
        # contrato, no de la operación.
        "tarifa_cliente",
        "usuario",
        # Contraseñas anteriores del administrador de la plataforma. No es dato
        # operativo de ningún cliente: los de ellos van en su propia base, en
        # la tabla homónima de BaseTenant.
        "usuario_password_historial",
        # (twilio_sid -> cliente) de cada WhatsApp enviado. Es la excepción que
        # confirma la regla: SÍ apunta a algo operativo, pero lo que guarda es
        # justamente EN QUÉ BASE está ese algo. El webhook de Twilio es público
        # —no trae JWT— y sin esta tabla no tendría de dónde sacar el tenant;
        # guardarla en la base del cliente sería tener que saber la respuesta
        # para poder buscarla. Ver app/services/twilio_webhook_service.py.
        "whatsapp_envio",
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
    # Mismo nombre, columnas distintas: el admin del sistema no tiene campos
    # cifrados (su nombre de usuario va en claro y se busca directo); el del
    # cliente sí, y por eso necesita el hash para poder buscarlo.
    #
    # NINGUNA de las dos tiene `rol`: el del sistema nunca lo tuvo y el del
    # cliente lo perdió al eliminarse los roles dentro del estudio.
    maestra = BaseMaestra.metadata.tables["usuario"]
    tenant = BaseTenant.metadata.tables["usuario"]
    assert maestra is not tenant
    assert "usuario_hash" not in maestra.columns
    assert "rol" not in maestra.columns
    assert "usuario_hash" in tenant.columns
    assert "rol" not in tenant.columns


# ── Qué endpoints exigen sesión y cuáles no ──────────────────────────────
#
# Esto se prueba sobre el árbol de dependencias de cada ruta y no haciendo
# requests: lo que se está fijando es cómo quedó DECLARADO el endpoint, que es
# donde estuvo el error. Un test que hiciera el request necesitaría base de
# datos y probaría además cosas que no son el punto.

PUBLICO_ESTADO_DIARIO = "/api/v1/estado-diario/request-tw"


def _ruta(sufijo: str):
    """La única ruta cuyo path termina en `sufijo`."""
    from app.main import app

    rutas = [r for r in app.routes if getattr(r, "path", "") .endswith(sufijo)]
    assert len(rutas) == 1, f"Se esperaba una sola ruta terminada en {sufijo}, hay {len(rutas)}"
    return rutas[0]


def _dependencias(dep):
    """El árbol de dependencias de una ruta, aplanado.

    Recursivo porque lo que importa está anidado: `get_db_tenant` no declara
    seguridad, la hereda de `get_tenant_actual`, que a su vez depende de
    `HTTPBearer`. Mirar solo el primer nivel no vería nada.
    """
    yield dep
    for sub in dep.dependencies:
        yield from _dependencias(sub)


def _esquemas_de_seguridad(ruta) -> list[str]:
    dependant = getattr(ruta, "dependant", None)
    if dependant is None:  # Mount, WebSocket y demás: no son endpoints HTTP
        return []
    return [
        type(s.security_scheme).__name__
        for d in _dependencias(dependant)
        for s in d.security_requirements
    ]


def _llamables(ruta) -> set[str]:
    return {
        d.call.__name__ for d in _dependencias(ruta.dependant) if d.call is not None
    }


def test_el_webhook_de_twilio_no_exige_sesion():
    """`/request-tw` es público: quien llama es Twilio y no manda Authorization.

    Agregarle `get_db_tenant` o `get_usuario_actual` arrastra `HTTPBearer`, que
    con `auto_error=True` corta con 403 ANTES de entrar al handler. El efecto es
    especialmente malo porque es silencioso: los botones del WhatsApp dejan de
    hacer nada y no queda registro de por qué, ya que la bitácora se escribe
    dentro del handler que nunca llegó a correr. Ya pasó una vez.
    """
    assert _esquemas_de_seguridad(_ruta(PUBLICO_ESTADO_DIARIO)) == []


def test_el_webhook_de_twilio_va_contra_la_base_principal():
    """El tenant no puede salir de un token que no existe.

    Lo resuelve `twilio_webhook_service` por el SID del mensaje, contra la tabla
    `whatsapp_envio` de la base principal; por eso la dependencia correcta acá
    es `get_db_maestra` y no `get_db_tenant`.
    """
    llamables = _llamables(_ruta(PUBLICO_ESTADO_DIARIO))
    assert "get_db_maestra" in llamables
    assert "get_db_tenant" not in llamables
    assert "get_usuario_actual" not in llamables


def test_el_resto_de_estado_diario_si_exige_sesion():
    """El complemento del test anterior, para que no se afloje de más.

    Sin esto, "sacarle la autenticación al webhook" podría pasar a ser
    "sacársela a todo el módulo" sin que nadie se entere.
    """
    from app.main import app

    for ruta in app.routes:
        path = getattr(ruta, "path", "")
        if not path.startswith("/api/v1/estado-diario") or path == PUBLICO_ESTADO_DIARIO:
            continue
        assert "HTTPBearer" in _esquemas_de_seguridad(ruta), (
            f"{path} quedó sin exigir sesión"
        )


def test_el_indice_de_envios_de_whatsapp_vive_en_la_base_principal():
    """`whatsapp_envio` responde "¿en qué base está este mensaje?".

    Guardarla en la base de un cliente sería tener que saber la respuesta para
    poder buscarla, así que es la única tabla que apunta a algo operativo y aun
    así pertenece a la base principal.
    """
    assert "whatsapp_envio" in BaseMaestra.metadata.tables
    assert "whatsapp_envio" not in BaseTenant.metadata.tables

    columnas = BaseMaestra.metadata.tables["whatsapp_envio"].columns
    assert "twilio_sid" in columnas
    assert "cliente_id" in columnas
    # No único a propósito: las filas del envío se confirman en un solo commit,
    # así que un SID repetido tumbaría el índice del lote entero y no solo el
    # suyo. Se resuelve leyendo el más reciente. Ver el modelo.
    assert not columnas["twilio_sid"].unique
