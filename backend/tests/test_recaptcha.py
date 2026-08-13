"""Verificación de reCAPTCHA v3.

No sale nada a la red: se intercepta `requests.post` y se le devuelven las
respuestas que da Google de verdad.

Vale la pena testear esto porque **casi todo lo que puede salir mal acá no
falla a la vista**. Un captcha que aprueba siempre se ve igual que uno que
funciona; uno que rechaza de más solo lo descubre el usuario que no pudo
entrar, y por teléfono. Los casos de acá son, casi uno a uno, formas de quedar
con el sistema abierto o con la puerta trabada sin ningún error en el log que
lo diga.
"""

import logging
from unittest.mock import Mock, patch

import pytest
import requests

from app.core import recaptcha
from app.core.config import settings
from app.core.exceptions import BadRequestException


# ── Andamiaje ─────────────────────────────────────────────


def _respuesta(payload, status=200):
    r = Mock()
    r.status_code = status
    r.json.return_value = payload
    return r


def _ok(score=0.9, accion=recaptcha.ACCION_LOGIN, hostname="ed.temposoft.cl"):
    return _respuesta(
        {
            "success": True,
            "score": score,
            "action": accion,
            "hostname": hostname,
            "challenge_ts": "2026-08-10T12:00:00Z",
        }
    )


def _falla(*codigos):
    return _respuesta({"success": False, "error-codes": list(codigos)})


@pytest.fixture
def encendido(monkeypatch):
    """Las dos llaves puestas, umbral en el default."""
    monkeypatch.setattr(settings, "RECAPTCHA_SECRET_KEY", "secreto-de-prueba")
    monkeypatch.setattr(settings, "RECAPTCHA_SITE_KEY", "site-de-prueba")
    monkeypatch.setattr(settings, "RECAPTCHA_SCORE_MINIMO", 0.5)
    monkeypatch.setattr(settings, "RECAPTCHA_HOSTNAMES", "")
    monkeypatch.setattr(settings, "RECAPTCHA_SOLO_REGISTRAR", False)
    monkeypatch.setattr(settings, "RECAPTCHA_FALLA_ABIERTA", True)


@pytest.fixture
def apagado(monkeypatch):
    monkeypatch.setattr(settings, "RECAPTCHA_SECRET_KEY", "")
    monkeypatch.setattr(settings, "RECAPTCHA_SITE_KEY", "")


# ── Apagado por defecto ───────────────────────────────────


def test_sin_llaves_configuradas_no_se_llama_a_google(apagado):
    """El test más importante del archivo.

    Es la garantía de que instalar esta funcionalidad no cambió el
    comportamiento de nadie: sin llaves no hay latencia, ni dependencia de un
    tercero, ni forma de que un formulario deje de responder.
    """
    with patch.object(recaptcha.requests, "post") as post:
        recaptcha.exigir(None, recaptcha.ACCION_LOGIN)
        recaptcha.exigir("un-token-cualquiera", recaptcha.ACCION_LOGIN)
    post.assert_not_called()


def test_media_configuracion_cuenta_como_apagada(monkeypatch, caplog):
    """Con una sola llave, el captcha no puede funcionar de ninguna forma.

    Con solo el secret el frontend no puede acuñar tokens y TODO login quedaría
    rechazado; con solo la site key la verificación sería teatro. Apagado, y
    dicho en el log: si no, el síntoma es que simplemente no pasa nada.
    """
    monkeypatch.setattr(settings, "RECAPTCHA_SECRET_KEY", "solo-el-secreto")
    monkeypatch.setattr(settings, "RECAPTCHA_SITE_KEY", "")

    assert recaptcha.activo() is False
    with caplog.at_level(logging.WARNING):
        recaptcha.advertir_configuracion_incompleta()
    assert "RECAPTCHA_SITE_KEY" in caplog.text


def test_la_configuracion_publica_no_expone_el_secret(encendido):
    config = recaptcha.configuracion_publica()
    assert config == {"activo": True, "site_key": "site-de-prueba"}
    assert "secreto-de-prueba" not in str(config)


# ── Rechazos concluyentes ─────────────────────────────────


def test_falta_el_token_estando_activo_se_rechaza(encendido):
    """Y sin gastar una llamada a Google: no hay nada que preguntarle."""
    with patch.object(recaptcha.requests, "post") as post:
        with pytest.raises(BadRequestException):
            recaptcha.exigir(None, recaptcha.ACCION_LOGIN)
    post.assert_not_called()


def test_puntaje_bajo_el_minimo_se_rechaza(encendido):
    with patch.object(recaptcha.requests, "post", return_value=_ok(score=0.1)):
        with pytest.raises(BadRequestException):
            recaptcha.exigir("t", recaptcha.ACCION_LOGIN)


def test_el_puntaje_igual_al_minimo_se_acepta(encendido):
    """Fija que la comparación es `>=`.

    Con `>` el umbral configurado significaría una cosa distinta de la que dice
    el `.env`, y nadie lo notaría salvo en el borde exacto.
    """
    with patch.object(recaptcha.requests, "post", return_value=_ok(score=0.5)):
        recaptcha.exigir("t", recaptcha.ACCION_LOGIN)


def test_un_token_de_otra_pantalla_se_rechaza(encendido):
    """El replay que justifica validar `action`.

    `restablecer-clave` es una pantalla pública que carga sin credenciales. Un
    atacante la abre en un navegador real, deja que le acuñen un token con
    puntaje de humano, y lo reusa contra el login para su fuerza bruta. Misma
    llave, mismo dominio, success true, buen puntaje: lo único que los
    distingue es este campo.
    """
    token_del_login = _ok(accion=recaptcha.ACCION_LOGIN)
    with patch.object(recaptcha.requests, "post", return_value=token_del_login):
        with pytest.raises(BadRequestException):
            recaptcha.exigir("t", recaptcha.ACCION_RESTABLECER)


def test_un_token_reusado_se_rechaza(encendido):
    """Google devuelve `timeout-or-duplicate` al segundo uso y a los 2 minutos."""
    with patch.object(recaptcha.requests, "post", return_value=_falla("timeout-or-duplicate")):
        with pytest.raises(BadRequestException):
            recaptcha.exigir("t", recaptcha.ACCION_LOGIN)


def test_hostname_fuera_de_la_lista_se_rechaza(encendido, monkeypatch):
    monkeypatch.setattr(settings, "RECAPTCHA_HOSTNAMES", "ed.temposoft.cl")
    with patch.object(recaptcha.requests, "post", return_value=_ok(hostname="phishing.cl")):
        with pytest.raises(BadRequestException):
            recaptcha.exigir("t", recaptcha.ACCION_LOGIN)


def test_sin_lista_de_hostnames_no_se_valida_el_hostname(encendido):
    """Por defecto se confía en la verificación de dominio de la consola de
    Google; la lista local solo hace falta si allá se desactivó."""
    with patch.object(recaptcha.requests, "post", return_value=_ok(hostname="cualquiera.cl")):
        recaptcha.exigir("t", recaptcha.ACCION_LOGIN)


# ── Fallas no concluyentes: se deja pasar ─────────────────


def test_google_sin_respuesta_deja_pasar(encendido, caplog):
    """Fail-open, y es una decisión deliberada.

    Fail-closed cambiaría una caída de Google por una caída total del producto,
    en la que ni el administrador que va a arreglarlo puede entrar. Lo que se
    pierde mientras tanto es el nivel de protección que el sistema tenía ayer.
    """
    with patch.object(recaptcha.requests, "post", side_effect=requests.exceptions.Timeout):
        with caplog.at_level(logging.WARNING):
            recaptcha.exigir("t", recaptcha.ACCION_LOGIN)
    assert "DEJA PASAR" in caplog.text


def test_google_responde_500_deja_pasar(encendido):
    with patch.object(recaptcha.requests, "post", return_value=_respuesta({}, status=503)):
        recaptcha.exigir("t", recaptcha.ACCION_LOGIN)


def test_json_ilegible_no_tumba_el_login(encendido):
    rota = Mock()
    rota.status_code = 200
    rota.json.side_effect = ValueError("no es json")
    with patch.object(recaptcha.requests, "post", return_value=rota):
        recaptcha.exigir("t", recaptcha.ACCION_LOGIN)


def test_un_secret_mal_pegado_no_bloquea_a_nadie_pero_grita(encendido, caplog):
    """El peor momento posible para dejar a todos afuera es el despliegue, y es
    justo cuando se pega mal un secret. Se deja pasar, con ERROR: esto no se
    arregla solo y tiene que verse en el log."""
    with patch.object(recaptcha.requests, "post", return_value=_falla("invalid-input-secret")):
        with caplog.at_level(logging.ERROR):
            recaptcha.exigir("t", recaptcha.ACCION_LOGIN)
    assert "MAL CONFIGURADO" in caplog.text


def test_una_llave_v2_en_un_flujo_v3_se_detecta(encendido, caplog):
    """success true pero sin `score`: la llave se registró como v2 en la consola.
    Tratarlo como aprobación silenciosa dejaría el captcha inerte para siempre."""
    sin_score = _respuesta({"success": True, "action": recaptcha.ACCION_LOGIN})
    with patch.object(recaptcha.requests, "post", return_value=sin_score):
        with caplog.at_level(logging.ERROR):
            recaptcha.exigir("t", recaptcha.ACCION_LOGIN)
    assert "v2" in caplog.text


def test_con_falla_cerrada_una_caida_de_google_bloquea(encendido, monkeypatch):
    """El interruptor para estar bajo ataque activo. Se testea para que quede
    claro que existe y que hace exactamente lo contrario del default."""
    monkeypatch.setattr(settings, "RECAPTCHA_FALLA_ABIERTA", False)
    with patch.object(recaptcha.requests, "post", side_effect=requests.exceptions.Timeout):
        with pytest.raises(BadRequestException):
            recaptcha.exigir("t", recaptcha.ACCION_LOGIN)


# ── Modo monitor ──────────────────────────────────────────


def test_modo_solo_registrar_no_rechaza_pero_deja_el_puntaje_en_el_log(encendido, monkeypatch, caplog):
    """Es como se estrena en producción: una semana midiendo cuánto tráfico
    legítimo llega sin token (app Android, bloqueadores, proxies de estudios)
    antes de empezar a rechazarlo."""
    monkeypatch.setattr(settings, "RECAPTCHA_SOLO_REGISTRAR", True)
    with patch.object(recaptcha.requests, "post", return_value=_ok(score=0.1)):
        with caplog.at_level(logging.WARNING):
            recaptcha.exigir("t", recaptcha.ACCION_LOGIN)
    assert "0.1" in caplog.text
    assert "modo monitor" in caplog.text


# ── Que no se filtre nada ─────────────────────────────────


def test_la_llamada_a_google_lleva_timeout(encendido):
    """Un `requests.post` sin timeout cuelga el worker para siempre. Como esto
    está en los cuatro endpoints de autenticación, bastaría con que Google
    dejara de responder para quedarse sin workers y tumbar la API entera."""
    with patch.object(recaptcha.requests, "post", return_value=_ok()) as post:
        recaptcha.exigir("t", recaptcha.ACCION_LOGIN)
    assert post.call_args.kwargs["timeout"] == settings.RECAPTCHA_TIMEOUT_SEGUNDOS


def test_el_mensaje_al_usuario_no_revela_el_puntaje(encendido):
    """Devolver el score convertiría el endpoint en un oráculo para que el
    atacante calibre su bot contra el umbral."""
    with patch.object(recaptcha.requests, "post", return_value=_ok(score=0.1)):
        with pytest.raises(BadRequestException) as e:
            recaptcha.exigir("t", recaptcha.ACCION_LOGIN)
    detalle = e.value.detail
    assert "0.1" not in detalle
    assert "score" not in detalle.lower()
    assert "ed.temposoft.cl" not in detalle


def test_el_token_no_aparece_en_ningun_log(encendido, caplog):
    """Un token vale durante dos minutos y se puede reusar: en un archivo de
    log es una credencial en un archivo de log."""
    with patch.object(recaptcha.requests, "post", return_value=_ok(score=0.1)):
        with caplog.at_level(logging.DEBUG):
            with pytest.raises(BadRequestException):
                recaptcha.exigir("TOKEN-SECRETO-XYZ", recaptcha.ACCION_LOGIN)
    assert "TOKEN-SECRETO-XYZ" not in caplog.text


# ── Segundo par de llaves, para la app Android ────────────
#
# El APK corre en un WebView cuyo origen es `https://localhost`. Ese dominio no
# se puede registrar en la llave del sitio sin degradar los puntajes reales de
# la web, así que la app lleva su propio par y el backend elige mirando el
# `Origin`. Lo que estos tests fijan es que las DOS mitades elijan igual: la
# que sirve la site key y la que verifica el token. Si se separan, el APK acuña
# con una llave y se valida con el secret de la otra — y eso falla el 100% de
# las veces, con un `invalid-input-response` que parece un token falsificado.


@pytest.fixture
def con_llave_de_app(encendido, monkeypatch):
    monkeypatch.setattr(settings, "RECAPTCHA_SITE_KEY_APP", "site-del-apk")
    monkeypatch.setattr(settings, "RECAPTCHA_SECRET_KEY_APP", "secreto-del-apk")
    monkeypatch.setattr(settings, "RECAPTCHA_ORIGENES_APP", "https://localhost")


def _secret_usado(post) -> str:
    """El secret con el que se llamó a siteverify."""
    return post.call_args.kwargs["data"]["secret"]


def test_el_apk_recibe_su_propia_site_key(con_llave_de_app):
    assert recaptcha.configuracion_publica("https://localhost")["site_key"] == "site-del-apk"


def test_la_web_sigue_recibiendo_la_suya(con_llave_de_app):
    assert recaptcha.configuracion_publica("https://ed.temposoft.cl")["site_key"] == "site-de-prueba"


def test_sin_origen_se_sirve_la_llave_de_la_web(con_llave_de_app):
    # Una petición sin `Origin` (mismo origen, o un cliente que no es un
    # navegador) no es la app: se queda con la llave estricta.
    assert recaptcha.configuracion_publica(None)["site_key"] == "site-de-prueba"


def test_el_token_del_apk_se_verifica_con_el_secret_del_apk(con_llave_de_app):
    with patch.object(recaptcha.requests, "post", return_value=_ok()) as post:
        recaptcha.exigir("t", recaptcha.ACCION_LOGIN, origen="https://localhost")
    assert _secret_usado(post) == "secreto-del-apk"


def test_el_token_de_la_web_se_verifica_con_el_secret_de_la_web(con_llave_de_app):
    with patch.object(recaptcha.requests, "post", return_value=_ok()) as post:
        recaptcha.exigir("t", recaptcha.ACCION_LOGIN, origen="https://ed.temposoft.cl")
    assert _secret_usado(post) == "secreto-de-prueba"


def test_el_origen_se_compara_sin_barra_final_ni_mayusculas(con_llave_de_app):
    # El `.env` lo escribe una persona: una barra de más dejaría al APK usando
    # la llave de la web sin que nada lo dijera.
    assert recaptcha.es_origen_app("https://LOCALHOST/") is True


def test_medio_par_de_app_cae_en_la_llave_de_la_web(encendido, monkeypatch):
    """Con el secret pegado y la site key olvidada, se usa el par de la web.

    Es la misma regla que `activo()`: media configuración es peor que ninguna.
    Acá, además, rechazar sería peor que degradar: dejaría a toda la app sin
    poder entrar por una variable a medio copiar.
    """
    monkeypatch.setattr(settings, "RECAPTCHA_SECRET_KEY_APP", "secreto-del-apk")
    monkeypatch.setattr(settings, "RECAPTCHA_SITE_KEY_APP", "")

    with patch.object(recaptcha.requests, "post", return_value=_ok()) as post:
        recaptcha.exigir("t", recaptcha.ACCION_LOGIN, origen="https://localhost")

    assert _secret_usado(post) == "secreto-de-prueba"
    assert recaptcha.configuracion_publica("https://localhost")["site_key"] == "site-de-prueba"


def test_sin_segundo_par_todo_sigue_como_antes(encendido, monkeypatch):
    # Nadie tiene que configurar nada para desplegar este cambio.
    monkeypatch.setattr(settings, "RECAPTCHA_SITE_KEY_APP", "")
    monkeypatch.setattr(settings, "RECAPTCHA_SECRET_KEY_APP", "")

    with patch.object(recaptcha.requests, "post", return_value=_ok()) as post:
        recaptcha.exigir("t", recaptcha.ACCION_LOGIN, origen="https://localhost")

    assert _secret_usado(post) == "secreto-de-prueba"


def test_el_secret_del_apk_tampoco_sale_en_la_configuracion_publica(con_llave_de_app):
    publica = recaptcha.configuracion_publica("https://localhost")
    assert "secreto-del-apk" not in str(publica)
