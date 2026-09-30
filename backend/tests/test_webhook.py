"""Webhook de importación por correo.

Las dos bases se reemplazan por SQLite en memoria y `requests.post` por un
mock: no sale nada a la red ni se toca PostgreSQL.

Lo que vale probar acá es casi todo lo que falla **sin ruido**: un aviso que no
se firma bien, que se manda dos veces, que se pierde cuando el receptor está
caído, que revienta la importación o que apunta a la red interna funciona igual
que uno correcto hasta que alguien lo necesita.
"""

import hashlib
import hmac
import json
from datetime import date, datetime, time, timedelta, timezone
from email.message import EmailMessage
from unittest.mock import Mock, patch

import pytest
import requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.crypto import cifrar
from app.core.database import BaseMaestra, BaseTenant
from app.models.audiencia import Audiencia
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_origen import EstadoDiarioOrigen
from app.models.jurisdiccion import Jurisdiccion
from app.models.maestra.cliente import Cliente
from app.models.maestra.configuracion_correo import ConfiguracionCorreo
from app.models.maestra.configuracion_webhook import ConfiguracionWebhook
from app.models.movimiento import Movimiento
from app.models.usuario import Usuario
from app.models.webhook_envio import WebhookEnvio
from app.services import correo_service, deteccion_archivo, webhook_service
from app.services.correo_service import CorreoService

SECRETO = "whsec_de_prueba"
URL = "https://receptor.example.com/hook?token=abc123"
IP_PUBLICA = "93.184.216.34"


# ── Andamiaje ─────────────────────────────────────────────


def _motor():
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


@pytest.fixture()
def mundo():
    """Base principal con un cliente y su webhook activo; base de tenant vacía."""
    maestro, tenant = _motor(), _motor()
    BaseMaestra.metadata.create_all(
        maestro,
        tables=[
            Cliente.__table__,
            ConfiguracionWebhook.__table__,
            ConfiguracionCorreo.__table__,
        ],
    )
    BaseTenant.metadata.create_all(tenant)
    SesionM = sessionmaker(bind=maestro, autoflush=False)
    SesionT = sessionmaker(bind=tenant, autoflush=False)

    dbm = SesionM()
    cliente = Cliente(
        nombre="Estudio Uno",
        guid="guid-uno",
        base_datos="estado_diario_guid-uno",
        estado_aprovisionamiento=Cliente.APROV_LISTO,
        activo=True,
    )
    cliente.rut = "11.111.111-1"
    dbm.add(cliente)
    dbm.commit()
    config = ConfiguracionWebhook(
        cliente_id=cliente.cliente_id,
        url=URL,
        secreto_cifrado=cifrar(SECRETO),
        activo=True,
    )
    dbm.add(config)
    dbm.commit()

    dbt = SesionT()
    usuario = Usuario(password_hash="x", nombre="U", activo=True)
    usuario.usuario = "u1"
    dbt.add(usuario)
    dbt.add(Jurisdiccion(id=1, nombre="Santiago"))
    dbt.commit()

    with patch.object(webhook_service, "_resolver", return_value=[IP_PUBLICA]):
        yield type(
            "Mundo", (),
            dict(dbm=dbm, dbt=dbt, cliente=cliente, config=config, usuario_id=usuario.id,
                 SesionT=SesionT, SesionM=SesionM),
        )
    dbm.close()
    dbt.close()


def _origen(mundo, tipo, filas) -> int:
    """Crea un archivo importado de `tipo` con `filas` registros."""
    db = mundo.dbt
    origen = EstadoDiarioOrigen(
        tipo=tipo, rut="12345678-9", fecha=date(2026, 3, 2),
        nombre_archivo="reporte.xlsx", usuario_carga_id=mundo.usuario_id,
    )
    db.add(origen)
    db.commit()
    for i in range(filas):
        if tipo == EstadoDiarioOrigen.TIPO_AUDIENCIAS:
            db.add(Audiencia(
                estado_diario_origen_id=origen.id, usuario_id=mundo.usuario_id,
                jurisdiccion_id=1, materia="Familia", rol=f"C-{i}", caratulado=f"A/B {i}",
                tribunal="1º Juzgado", tipo_audiencia="Preparatoria",
                fecha_audiencia=date(2026, 3, 10), hora=time(10, 30),
                clave_natural=f"clave-{origen.id}-{i}", asistio=True,
                google_event_id="evento-interno",
            ))
        elif tipo == EstadoDiarioOrigen.TIPO_MOVIMIENTOS:
            db.add(Movimiento(
                estado_diario_origen_id=origen.id, jurisdiccion_id=1, materia="Civil",
                rol=f"C-{i}", caratulado=f"A/B {i}", estado_causa="Tramitación",
                fecha_ingreso=date(2025, 1, 1),
            ))
        else:
            db.add(EstadoDiario(
                estado_diario_origen_id=origen.id, jurisdiccion_id=1, rol=f"C-{i}",
                caratulado=f"A/B {i}", estado="Fallo", leido=True, pendiente=True,
                observacion_resuelto="nota interna",
            ))
    db.commit()
    return origen.id


def _respuesta(status=200):
    r = Mock()
    r.status_code = status
    return r


def _despachar(mundo, **kw):
    return webhook_service.despachar(mundo.dbt, mundo.dbm, mundo.cliente, **kw)


def _envios(mundo):
    mundo.dbt.expire_all()
    return mundo.dbt.query(WebhookEnvio).order_by(WebhookEnvio.id).all()


AUD = EstadoDiarioOrigen.TIPO_AUDIENCIAS
MOV = EstadoDiarioOrigen.TIPO_MOVIMIENTOS
ED = EstadoDiarioOrigen.TIPO_ESTADO_DIARIO


# ── Firma ─────────────────────────────────────────────────


def test_la_firma_es_hmac_sha256_del_timestamp_y_el_cuerpo():
    cuerpo = b'{"a":1}'
    esperado = hmac.new(b"sec", b"1700000000." + cuerpo, hashlib.sha256).hexdigest()
    assert webhook_service.firmar("sec", 1700000000, cuerpo) == f"sha256={esperado}"


def test_la_firma_cambia_con_el_cuerpo_el_timestamp_y_el_secreto():
    base = webhook_service.firmar("sec", 1, b"x")
    assert webhook_service.firmar("sec", 1, b"y") != base
    assert webhook_service.firmar("sec", 2, b"x") != base
    assert webhook_service.firmar("otro", 1, b"x") != base


def test_los_secretos_generados_no_se_repiten():
    assert webhook_service.generar_secreto() != webhook_service.generar_secreto()


# ── Destino permitido (SSRF) ──────────────────────────────


@pytest.mark.parametrize(
    "ip",
    ["127.0.0.1", "10.0.0.5", "192.168.1.10", "172.16.0.1", "169.254.169.254", "::1", "100.64.0.1"],
)
def test_no_se_permite_apuntar_a_redes_internas(ip):
    with patch.object(webhook_service, "_resolver", return_value=[ip]):
        with pytest.raises(webhook_service.ErrorDestino):
            webhook_service.validar_url("https://interno.example.com/hook")


def test_basta_que_una_de_las_ips_sea_interna():
    # Un host con dos registros, uno público y uno interno, no es seguro.
    with patch.object(webhook_service, "_resolver", return_value=[IP_PUBLICA, "10.0.0.5"]):
        with pytest.raises(webhook_service.ErrorDestino):
            webhook_service.validar_url("https://mixto.example.com/hook")


def test_un_destino_publico_se_acepta():
    with patch.object(webhook_service, "_resolver", return_value=[IP_PUBLICA]):
        assert webhook_service.validar_url(" https://ok.example.com/h ") == "https://ok.example.com/h"


@pytest.mark.parametrize(
    "url",
    ["http://ok.example.com/h", "ftp://ok.example.com/h", "javascript:alert(1)", "https://", "",
     "https://user:pass@ok.example.com/h"],
)
def test_esquemas_y_formas_no_permitidas(url):
    with patch.object(webhook_service, "_resolver", return_value=[IP_PUBLICA]):
        with pytest.raises(webhook_service.ErrorDestino):
            webhook_service.validar_url(url)


def test_las_aperturas_de_despliegue_se_respetan():
    with patch.object(webhook_service, "_resolver", return_value=["10.0.0.5"]):
        with patch.object(webhook_service.settings, "WEBHOOK_PERMITIR_REDES_PRIVADAS", True), \
             patch.object(webhook_service.settings, "WEBHOOK_PERMITIR_HTTP", True):
            assert webhook_service.validar_url("http://interno.local/h") == "http://interno.local/h"


def test_un_host_que_no_resuelve_se_rechaza():
    with patch.object(
        webhook_service, "_resolver",
        side_effect=webhook_service.ErrorDestino("No se pudo resolver el host 'x'"),
    ):
        with pytest.raises(webhook_service.ErrorDestino):
            webhook_service.validar_url("https://x.example.com/h")


# ── Cola ──────────────────────────────────────────────────


def test_un_archivo_grande_se_reparte_en_lotes_con_el_mismo_evento(mundo):
    origen = _origen(mundo, MOV, 1200)
    n = webhook_service.encolar(mundo.dbt, MOV, origen, tamano_lote=500)
    filas = _envios(mundo)
    assert n == 3 and len(filas) == 3
    assert [f.lote for f in filas] == [1, 2, 3]
    assert {f.total_lotes for f in filas} == {3}
    assert {f.total_registros for f in filas} == {1200}
    assert len({f.evento_id for f in filas}) == 1
    assert {f.estado for f in filas} == {WebhookEnvio.ESTADO_PENDIENTE}


def test_un_archivo_sin_filas_no_genera_aviso(mundo):
    origen = _origen(mundo, MOV, 0)
    assert webhook_service.encolar(mundo.dbt, MOV, origen) == 0
    assert _envios(mundo) == []


def test_la_cartera_de_causas_no_se_envia(mundo):
    assert webhook_service.encolar(mundo.dbt, EstadoDiarioOrigen.TIPO_CAUSAS, 1) == 0


def _avisar(mundo, tipo, origen):
    return webhook_service.avisar_importacion(
        mundo.dbt, mundo.dbm, mundo.cliente.cliente_id, tipo, origen
    )


def test_avisar_anota_la_entrega_si_el_webhook_esta_activo(mundo):
    assert _avisar(mundo, AUD, _origen(mundo, AUD, 3)) == 1
    assert len(_envios(mundo)) == 1


def test_avisar_no_hace_nada_con_el_webhook_apagado(mundo):
    mundo.config.activo = False
    mundo.dbm.commit()
    assert _avisar(mundo, AUD, _origen(mundo, AUD, 3)) == 0
    assert _envios(mundo) == []


def test_avisar_no_hace_nada_sin_configuracion(mundo):
    mundo.dbm.delete(mundo.config)
    mundo.dbm.commit()
    assert _avisar(mundo, AUD, _origen(mundo, AUD, 3)) == 0


@pytest.mark.parametrize(
    "campo,tipo",
    [("enviar_audiencias", AUD), ("enviar_movimientos", MOV), ("enviar_estado_diario", ED)],
)
def test_cada_reporte_se_puede_apagar_por_separado(mundo, campo, tipo):
    setattr(mundo.config, campo, False)
    mundo.dbm.commit()
    assert _avisar(mundo, tipo, _origen(mundo, tipo, 2)) == 0
    # ...y los otros dos siguen funcionando.
    otro = next(t for t in (AUD, MOV, ED) if t != tipo)
    assert _avisar(mundo, otro, _origen(mundo, otro, 2)) == 1


def test_sin_secreto_no_se_anota_nada(mundo):
    mundo.config.secreto_cifrado = None
    mundo.dbm.commit()
    assert _avisar(mundo, AUD, _origen(mundo, AUD, 2)) == 0


def test_avisar_nunca_lanza_aunque_falle_por_dentro(mundo):
    origen = _origen(mundo, AUD, 2)
    with patch.object(webhook_service, "encolar", side_effect=RuntimeError("base caída")):
        assert _avisar(mundo, AUD, origen) == 0


# ── Contenido ─────────────────────────────────────────────


def _cuerpo(mundo, envio):
    return json.loads(webhook_service.construir_cuerpo(mundo.dbt, mundo.cliente, envio))


def test_el_cuerpo_trae_evento_cliente_archivo_y_registros(mundo):
    origen = _origen(mundo, AUD, 2)
    webhook_service.encolar(mundo.dbt, AUD, origen)
    cuerpo = _cuerpo(mundo, _envios(mundo)[0])

    assert cuerpo["evento"] == "audiencias.importado"
    assert cuerpo["cliente"] == {"guid": "guid-uno", "nombre": "Estudio Uno"}
    assert cuerpo["archivo"]["origen_id"] == origen
    assert cuerpo["archivo"]["tipo"] == "audiencias"
    assert cuerpo["archivo"]["rut"] == "12345678-9"
    assert cuerpo["archivo"]["fecha"] == "2026-03-02"
    assert (cuerpo["lote"], cuerpo["total_lotes"], cuerpo["total_registros"]) == (1, 1, 2)
    assert len(cuerpo["registros"]) == 2

    fila = cuerpo["registros"][0]
    assert fila["jurisdiccion"] == "Santiago"
    assert fila["fecha_audiencia"] == "2026-03-10"
    assert fila["hora"] == "10:30:00"
    assert fila["tipo_audiencia"] == "Preparatoria"


def test_cada_tipo_lleva_su_nombre_de_evento(mundo):
    for tipo, nombre in [(MOV, "movimientos.importado"), (ED, "estado_diario.importado")]:
        webhook_service.encolar(mundo.dbt, tipo, _origen(mundo, tipo, 1))
    eventos = {_cuerpo(mundo, e)["evento"] for e in _envios(mundo)}
    assert eventos == {"movimientos.importado", "estado_diario.importado"}


def test_no_se_filtran_campos_de_trabajo_interno(mundo):
    """El contrato es una lista explícita: leído, pendiente, asistencia y datos
    de Google del estudio no salen hacia un tercero."""
    for tipo in (AUD, ED):
        webhook_service.encolar(mundo.dbt, tipo, _origen(mundo, tipo, 1))
    for envio in _envios(mundo):
        for fila in _cuerpo(mundo, envio)["registros"]:
            assert not set(fila) & {
                "leido", "pendiente", "observacion_resuelto", "asistio", "google_event_id",
                "usuario_id", "nivel_pendiente", "fecha_leido",
            }


def test_cada_lote_lleva_su_porcion_sin_repetir_ni_perder_filas(mundo):
    origen = _origen(mundo, MOV, 7)
    webhook_service.encolar(mundo.dbt, MOV, origen, tamano_lote=3)
    envios = _envios(mundo)
    assert len(envios) == 3
    with patch.object(webhook_service.settings, "WEBHOOK_TAMANO_LOTE", 3):
        ids = [[r["id"] for r in _cuerpo(mundo, e)["registros"]] for e in envios]
    assert [len(x) for x in ids] == [3, 3, 1]
    planos = [i for lote in ids for i in lote]
    assert len(planos) == len(set(planos)) == 7


def test_un_archivo_borrado_no_se_puede_armar(mundo):
    origen = _origen(mundo, AUD, 1)
    webhook_service.encolar(mundo.dbt, AUD, origen)
    mundo.dbt.query(Audiencia).delete()
    mundo.dbt.query(EstadoDiarioOrigen).delete()
    mundo.dbt.commit()
    with pytest.raises(webhook_service._ArchivoInexistente):
        webhook_service.construir_cuerpo(mundo.dbt, mundo.cliente, _envios(mundo)[0])


# ── Entrega ───────────────────────────────────────────────


def test_entrega_exitosa_firma_bien_y_marca_enviado(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 2))
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(200)) as post:
        r = _despachar(mundo)

    assert r["enviados"] == 1 and r["con_error"] == 0
    envio = _envios(mundo)[0]
    assert envio.estado == WebhookEnvio.ESTADO_ENVIADO
    assert envio.intentos == 1 and envio.fecha_envio is not None
    assert envio.ultimo_error is None

    kwargs = post.call_args.kwargs
    h = kwargs["headers"]
    # El receptor verifica la firma exactamente como lo documenta el módulo.
    esperado = hmac.new(
        SECRETO.encode(), f"{h['X-Webhook-Timestamp']}.".encode() + kwargs["data"], hashlib.sha256
    ).hexdigest()
    assert h["X-Webhook-Signature"] == f"sha256={esperado}"
    assert h["X-Webhook-Evento"] == "audiencias.importado"
    assert h["X-Webhook-Id"] == envio.evento_id
    assert h["X-Webhook-Lote"] == "1/1"
    assert post.call_args.args[0] == URL


def test_no_se_siguen_redirecciones(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(200)) as post:
        _despachar(mundo)
    assert post.call_args.kwargs["allow_redirects"] is False
    assert post.call_args.kwargs["timeout"] == webhook_service.settings.WEBHOOK_TIMEOUT_SEGUNDOS


@pytest.mark.parametrize("status", [301, 400, 404, 500, 503])
def test_una_respuesta_que_no_es_2xx_se_reintenta_despues(mundo, status):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(status)):
        r = _despachar(mundo)
    envio = _envios(mundo)[0]
    assert r["con_error"] == 1
    assert envio.estado == WebhookEnvio.ESTADO_PENDIENTE
    assert envio.intentos == 1
    assert envio.ultimo_status_http == status
    assert envio.ultimo_error == f"El receptor respondió HTTP {status}"
    proximo = envio.proximo_intento
    if proximo.tzinfo is None:
        proximo = proximo.replace(tzinfo=timezone.utc)
    assert proximo > datetime.now(timezone.utc)


def test_lo_reintentado_no_se_vuelve_a_enviar_antes_de_tiempo(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(500)) as post:
        _despachar(mundo)
        _despachar(mundo)
        _despachar(mundo)
    assert post.call_count == 1


def test_agotados_los_intentos_queda_fallido_y_ya_no_se_envia(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    maximo = webhook_service.settings.WEBHOOK_MAX_INTENTOS
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(500)) as post:
        for _ in range(maximo + 3):
            # Adelanta el reloj de la fila para que siempre toque.
            mundo.dbt.query(WebhookEnvio).update(
                {"proximo_intento": datetime.now(timezone.utc) - timedelta(seconds=1)}
            )
            mundo.dbt.commit()
            _despachar(mundo)
    envio = _envios(mundo)[0]
    assert post.call_count == maximo
    assert envio.estado == WebhookEnvio.ESTADO_FALLIDO
    assert envio.intentos == maximo
    mundo.dbm.refresh(mundo.config)
    assert mundo.config.fallidos == 1


def test_la_espera_entre_reintentos_crece():
    esperas = [webhook_service._espera(n) for n in range(1, 8)]
    assert esperas == sorted(esperas)
    assert esperas[0] < esperas[-1]
    # Pasado el último escalón se repite, no se sale de la tabla.
    assert webhook_service._espera(99) == webhook_service.ESPERAS[-1]


def test_un_error_de_red_no_filtra_la_url_con_su_token(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    boom = requests.exceptions.ConnectionError(f"HTTPSConnectionPool: {URL} refused")
    with patch("app.services.webhook_service.requests.post", side_effect=boom):
        _despachar(mundo)
    error = _envios(mundo)[0].ultimo_error
    assert "abc123" not in error and "token" not in error
    assert "receptor.example.com" in error
    mundo.dbm.refresh(mundo.config)
    assert "abc123" not in (mundo.config.ultimo_resultado or "")


def test_un_timeout_se_reintenta(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    with patch("app.services.webhook_service.requests.post", side_effect=requests.exceptions.Timeout()):
        _despachar(mundo)
    envio = _envios(mundo)[0]
    assert envio.estado == WebhookEnvio.ESTADO_PENDIENTE
    assert "Timeout" in envio.ultimo_error


def test_si_el_destino_pasa_a_ser_interno_no_se_envia(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    with patch.object(webhook_service, "_resolver", return_value=["10.0.0.5"]), \
         patch("app.services.webhook_service.requests.post") as post:
        _despachar(mundo)
    post.assert_not_called()
    assert "no es pública" in _envios(mundo)[0].ultimo_error


def test_si_el_archivo_ya_no_existe_falla_de_una_vez(mundo):
    origen = _origen(mundo, AUD, 1)
    webhook_service.encolar(mundo.dbt, AUD, origen)
    mundo.dbt.query(Audiencia).delete()
    mundo.dbt.query(EstadoDiarioOrigen).delete()
    mundo.dbt.commit()
    with patch("app.services.webhook_service.requests.post") as post:
        _despachar(mundo)
    post.assert_not_called()
    envio = _envios(mundo)[0]
    assert envio.estado == WebhookEnvio.ESTADO_FALLIDO
    assert envio.intentos == 1


def test_una_fila_defectuosa_no_detiene_las_demas(mundo):
    webhook_service.encolar(mundo.dbt, MOV, _origen(mundo, MOV, 1))
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    llamadas = []

    def post(url, **kw):
        llamadas.append(kw["headers"]["X-Webhook-Evento"])
        if len(llamadas) == 1:
            raise RuntimeError("explotó")
        return _respuesta(200)

    with patch("app.services.webhook_service.requests.post", side_effect=post):
        r = _despachar(mundo)
    assert len(llamadas) == 2
    assert (r["enviados"], r["con_error"]) == (1, 1)


def test_solo_uno_de_dos_despachadores_simultaneos_reclama_la_fila(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    envio_id = _envios(mundo)[0].id
    ahora = datetime.now(timezone.utc)
    assert webhook_service._reclamar(mundo.dbt, envio_id, ahora) is True
    assert webhook_service._reclamar(mundo.dbt, envio_id, ahora) is False


def test_dos_despachos_seguidos_no_duplican_el_envio(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(200)) as post:
        _despachar(mundo)
        _despachar(mundo)
    assert post.call_count == 1


def test_un_despachador_que_murio_a_mitad_no_deja_la_fila_trabada(mundo):
    """Reclamada y nunca terminada: pasado el alquiler, se retoma."""
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    envio_id = _envios(mundo)[0].id
    webhook_service._reclamar(mundo.dbt, envio_id, datetime.now(timezone.utc))
    mundo.dbt.query(WebhookEnvio).update(
        {"proximo_intento": datetime.now(timezone.utc) - timedelta(seconds=1)}
    )
    mundo.dbt.commit()
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(200)) as post:
        _despachar(mundo)
    assert post.call_count == 1


def test_con_el_webhook_apagado_no_se_envia_lo_pendiente(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    mundo.config.activo = False
    mundo.dbm.commit()
    with patch("app.services.webhook_service.requests.post") as post:
        assert _despachar(mundo) == {"enviados": 0, "con_error": 0, "fallidos": 0}
    post.assert_not_called()
    # Sigue pendiente: al reactivarlo se entrega, no se pierde.
    assert _envios(mundo)[0].estado == WebhookEnvio.ESTADO_PENDIENTE


def test_el_limite_por_pasada_deja_el_resto_para_la_siguiente(mundo):
    webhook_service.encolar(mundo.dbt, MOV, _origen(mundo, MOV, 5), tamano_lote=1)
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(200)) as post:
        _despachar(mundo, limite=2)
    assert post.call_count == 2
    estados = [e.estado for e in _envios(mundo)]
    assert estados.count(WebhookEnvio.ESTADO_ENVIADO) == 2
    assert estados.count(WebhookEnvio.ESTADO_PENDIENTE) == 3


def test_reencolar_devuelve_a_la_cola_lo_fallido(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    mundo.dbt.query(WebhookEnvio).update(
        {"estado": WebhookEnvio.ESTADO_FALLIDO, "intentos": 6, "ultimo_error": "x"}
    )
    mundo.dbt.commit()
    assert webhook_service.reencolar_fallidos(mundo.dbt) == 1
    envio = _envios(mundo)[0]
    assert (envio.estado, envio.intentos, envio.ultimo_error) == (
        WebhookEnvio.ESTADO_PENDIENTE, 0, None,
    )


def test_reencolar_no_toca_lo_ya_enviado(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))
    mundo.dbt.query(WebhookEnvio).update({"estado": WebhookEnvio.ESTADO_ENVIADO})
    mundo.dbt.commit()
    assert webhook_service.reencolar_fallidos(mundo.dbt) == 0


# ── Prueba manual ─────────────────────────────────────────


def test_la_prueba_firma_y_reporta_el_status(mundo):
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(204)) as post:
        r = webhook_service.enviar_prueba(mundo.config, mundo.cliente)
    assert r == {"exito": True, "mensaje": "El receptor respondió HTTP 204", "status_http": 204}
    assert json.loads(post.call_args.kwargs["data"])["evento"] == "webhook.prueba"
    assert post.call_args.kwargs["headers"]["X-Webhook-Signature"].startswith("sha256=")


def test_la_prueba_informa_el_fallo_sin_lanzar(mundo):
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(500)):
        assert webhook_service.enviar_prueba(mundo.config, mundo.cliente)["exito"] is False
    with patch("app.services.webhook_service.requests.post",
               side_effect=requests.exceptions.ConnectionError("x")):
        r = webhook_service.enviar_prueba(mundo.config, mundo.cliente)
    assert r["exito"] is False and r["status_http"] is None


# ── Engancharse a la ingesta real del correo ──────────────


class _ImapFalso:
    """Una casilla con un solo mensaje sin leer, con un adjunto .xlsx."""

    def __init__(self):
        m = EmailMessage()
        m["From"] = "pjud@ejemplo.cl"
        m["Subject"] = "Audiencias"
        m["Message-ID"] = "<abc@ejemplo.cl>"
        m.set_content("adjunto")
        m.add_attachment(
            b"PK-contenido-falso", maintype="application", subtype="octet-stream",
            filename="audiencias.xlsx",
        )
        self._bytes = m.as_bytes()

    def login(self, *a): return "OK", []
    def select(self, *a, **k): return "OK", [b"1"]
    def search(self, *a): return "OK", [b"1"]
    def fetch(self, *a): return "OK", [(b"1 (RFC822)", self._bytes)]
    def store(self, *a): return "OK", []
    def close(self): pass
    def logout(self): pass


@pytest.fixture()
def correo(mundo, tmp_path, monkeypatch):
    """Un CorreoService que lee la casilla falsa y "importa" 3 audiencias."""
    monkeypatch.setattr(correo_service, "UPLOAD_DIR", str(tmp_path))

    cfg = ConfiguracionCorreo(
        cliente_id=mundo.cliente.cliente_id, activo=True, usuario="casilla@x.cl",
        password_cifrado=cifrar("clave"), remitentes_permitidos="pjud@ejemplo.cl",
        max_tamano_mb=5, marcar_como_leido=True,
    )
    mundo.dbm.add(cfg)
    mundo.dbm.commit()

    servicio = CorreoService(mundo.dbt, mundo.dbm)
    detectado = deteccion_archivo.ArchivoDetectado(
        tipo=AUD, rut="12345678-9", fecha=date(2026, 3, 2), origen_tipo="asunto"
    )

    class _Importador:
        deduce_fecha_del_contenido = True
        requiere_rut = False

        def import_file(self_, destino, rut, fecha, usuario_id, nombre):
            origen = _origen(mundo, AUD, 3)
            return {"origen_id": origen, "fecha": fecha, "movimientos_importados": 3}

    monkeypatch.setattr(deteccion_archivo, "detectar", lambda *a, **k: detectado)
    monkeypatch.setattr(servicio, "_servicio_para", lambda tipo: _Importador())
    monkeypatch.setattr(servicio, "_conectar", lambda *a, **k: _ImapFalso())
    return servicio


def test_al_terminar_la_importacion_se_avisa_al_webhook(mundo, correo):
    with patch("app.services.webhook_service.requests.post", return_value=_respuesta(200)) as post:
        resultado = correo.revisar(mundo.cliente.cliente_id, mundo.usuario_id, disparo="manual")

    assert resultado["exito"] and resultado["importados"] == 1
    assert post.call_count == 1
    cuerpo = json.loads(post.call_args.kwargs["data"])
    assert cuerpo["evento"] == "audiencias.importado"
    assert len(cuerpo["registros"]) == 3
    assert _envios(mundo)[0].estado == WebhookEnvio.ESTADO_ENVIADO


def test_con_el_webhook_apagado_la_importacion_no_envia_nada(mundo, correo):
    mundo.config.activo = False
    mundo.dbm.commit()
    with patch("app.services.webhook_service.requests.post") as post:
        resultado = correo.revisar(mundo.cliente.cliente_id, mundo.usuario_id, disparo="manual")
    assert resultado["importados"] == 1
    post.assert_not_called()
    assert _envios(mundo) == []


def test_un_receptor_caido_no_rompe_la_importacion_y_queda_para_reintentar(mundo, correo):
    with patch("app.services.webhook_service.requests.post",
               side_effect=requests.exceptions.ConnectionError("caído")):
        resultado = correo.revisar(mundo.cliente.cliente_id, mundo.usuario_id, disparo="manual")
    # El archivo se importó igual.
    assert resultado["exito"] and resultado["importados"] == 1 and resultado["errores"] == 0
    envio = _envios(mundo)[0]
    assert envio.estado == WebhookEnvio.ESTADO_PENDIENTE and envio.intentos == 1


def test_si_anotar_el_aviso_revienta_la_importacion_sigue_bien(mundo, correo):
    with patch.object(webhook_service, "encolar", side_effect=RuntimeError("boom")), \
         patch("app.services.webhook_service.requests.post") as post:
        resultado = correo.revisar(mundo.cliente.cliente_id, mundo.usuario_id, disparo="manual")
    assert resultado["exito"] and resultado["importados"] == 1 and resultado["errores"] == 0
    post.assert_not_called()


def test_el_job_reintenta_lo_pendiente_de_todos_los_clientes(mundo):
    webhook_service.encolar(mundo.dbt, AUD, _origen(mundo, AUD, 1))

    from contextlib import contextmanager

    @contextmanager
    def _sesion(guid):
        yield mundo.dbt

    with patch.object(webhook_service, "sesion_tenant", _sesion), \
         patch("app.services.webhook_service.requests.post", return_value=_respuesta(200)) as post:
        r = webhook_service.despachar_todos(mundo.dbm)
    assert post.call_count == 1
    assert r == {"clientes": 1, "enviados": 1, "con_error": 0}


def test_el_job_salta_clientes_suspendidos(mundo):
    mundo.cliente.activo = False
    mundo.dbm.commit()
    with patch("app.services.webhook_service.requests.post") as post:
        assert webhook_service.despachar_todos(mundo.dbm)["clientes"] == 0
    post.assert_not_called()


# ── Esquema ───────────────────────────────────────────────


def test_las_tablas_nuevas_estan_declaradas():
    from app.core.esquema import TABLAS_TENANT

    assert "webhook_envio" in TABLAS_TENANT
    assert "webhook_envio" in BaseTenant.metadata.tables
    assert "configuracion_webhook" in BaseMaestra.metadata.tables
    # El secreto se guarda cifrado, no en claro.
    assert "secreto" not in ConfiguracionWebhook.__table__.columns
    assert "secreto_cifrado" in ConfiguracionWebhook.__table__.columns
