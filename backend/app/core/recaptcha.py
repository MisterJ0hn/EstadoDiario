"""Verificación de reCAPTCHA v3 para los formularios que no llevan sesión.

Uno solo para los dos servicios —el backend de los estudios y la consola de
plataforma—, igual que `app/core/password_policy.py`: la protección de un
formulario público no puede depender de por cuál puerto entró.

**Apagado mientras no haya llaves.** `activo()` exige las DOS, y sin ellas no
sale ni una petición a Google: el sistema se comporta exactamente como antes.
Es lo que permite desplegar este código antes de configurar nada.

Qué es v3 y qué no. No hay casilla que marcar ni imágenes que resolver: el
navegador acuña un token y Google devuelve un **puntaje** de 0.0 (bot seguro) a
1.0 (humano seguro). Nunca es una prueba, es una opinión. Por eso esto es
defensa en profundidad y no un control de autenticación: la contraseña sigue
siendo bcrypt y `/auth/recuperar-password` sigue respondiendo lo mismo exista o
no la cuenta.

**Lo que Google opina, se respeta; lo que no alcanzó a opinar, se deja pasar.**
Esa es la única distinción que gobierna el módulo, y está en `Veredicto`:

- `concluyente=True`  → Google respondió sobre esta petición. Su palabra vale.
- `concluyente=False` → no se pudo hablar con Google, o el problema es de
  nuestra configuración. Se aprueba y se grita en el log.

Rechazar a todos los usuarios porque el servidor de Google no contesta —o
porque alguien pegó mal el secret en el `.env`— cambia una caída ajena por una
caída total del producto, en la que nadie puede entrar a arreglarla. Ver
`RECAPTCHA_FALLA_ABIERTA` para invertirlo bajo ataque activo.

**El token nunca se registra en el log.** Es reutilizable durante sus dos
minutos de vida: un token en un archivo de log es una credencial en un archivo
de log.
"""

import logging
from dataclasses import dataclass
from typing import Callable, Optional

import requests
from fastapi import Header, Request

from app.core.config import settings
from app.core.exceptions import BadRequestException

logger = logging.getLogger(__name__)


# Qué formulario acuñó el token. Va FIRMADA dentro del token, así que el
# cliente no puede cambiarla, y cada endpoint declara la suya: es lo que impide
# reusar en el login un token acuñado en otra pantalla (ver `_accion_calza`).
#
# Solo `[A-Za-z/_]`: Google rechaza los guiones. Copiar el nombre de la ruta
# ("recuperar-password") fallaría el 100% de las verificaciones.
ACCION_LOGIN = "login"
ACCION_LOGIN_ADMIN = "login_admin"
ACCION_RECUPERAR = "recuperar_password"
ACCION_RESTABLECER = "restablecer_password"

# Lo que dice el usuario cuando se rechaza. No menciona el puntaje ni el
# motivo: decírselo al atacante convierte el endpoint en un oráculo para
# calibrar su bot contra el umbral.
MENSAJE_RECHAZO = (
    "No pudimos verificar que la solicitud viene de una persona. "
    "Recargue la página e intente de nuevo."
)

# `success: false` con estos códigos es culpa del cliente: el token falta, está
# corrupto, o ya se usó. Google opinó.
CODIGOS_DEL_CLIENTE = frozenset(
    {"missing-input-response", "invalid-input-response", "timeout-or-duplicate"}
)
# Con estos el problema es nuestro: el secret está mal o la petición está mal
# armada. No es culpa de quien intenta entrar, así que no se le cobra a él.
CODIGOS_DE_CONFIGURACION = frozenset(
    {"missing-input-secret", "invalid-input-secret", "bad-request"}
)


@dataclass(frozen=True)
class Veredicto:
    """Resultado de una verificación.

    `motivo` es una cadena corta y estable (`"timeout"`, `"puntaje_bajo"`,
    `"accion_distinta"`, ...) pensada para grepear el log y alertar sobre ella.
    **No se le muestra al usuario**: para eso está `MENSAJE_RECHAZO`.
    """

    aprobado: bool
    concluyente: bool
    motivo: str
    score: Optional[float] = None
    accion: Optional[str] = None
    hostname: Optional[str] = None
    codigos: tuple[str, ...] = ()


def activo() -> bool:
    """Verdadero solo con las DOS llaves puestas.

    Con solo el secret, el frontend no puede producir tokens y todo login
    quedaría rechazado; con solo la site key, la verificación sería teatro.
    Media configuración es peor que ninguna, así que cuenta como apagado.
    """
    return bool(settings.RECAPTCHA_SECRET_KEY and settings.RECAPTCHA_SITE_KEY)


def es_origen_app(origen: Optional[str]) -> bool:
    """Si la petición viene del WebView del APK.

    Se mira la cabecera `Origin`, que la pone el navegador —el WebView es
    uno— y no el código de la app: no hay un "soy la app" que el cliente
    declare. Aun así **esto no es un control de seguridad**: cualquiera puede
    mandar esa cabecera con `curl`. Lo único que decide es CON QUÉ LLAVE se
    verifica; quien dice si el token vale sigue siendo Google, contra la lista
    de dominios de esa llave.

    Esa es justamente la razón de tener dos pares: la llave del APK acepta
    `localhost` y por eso es la más débil de las dos, así que el tráfico de la
    web —que es el grueso— se sigue verificando con la llave estricta.
    """
    if not origen:
        return False
    return origen.strip().rstrip("/").lower() in settings.recaptcha_origenes_app


def _par_llaves(origen: Optional[str] = None) -> tuple[str, str]:
    """(site_key, secret) que corresponden a quien pregunta.

    El par del APK solo se usa si está COMPLETO. Con medio par configurado se
    cae al de la web, que es lo mismo que hacía el sistema antes de que este
    segundo par existiera: preferible a rechazar el 100% de los ingresos desde
    la app por una variable a medio pegar en el `.env`.
    """
    if (
        es_origen_app(origen)
        and settings.RECAPTCHA_SITE_KEY_APP
        and settings.RECAPTCHA_SECRET_KEY_APP
    ):
        return settings.RECAPTCHA_SITE_KEY_APP, settings.RECAPTCHA_SECRET_KEY_APP
    return settings.RECAPTCHA_SITE_KEY, settings.RECAPTCHA_SECRET_KEY


def configuracion_publica(origen: Optional[str] = None) -> dict:
    """Lo que el frontend necesita saber. El secret no sale de acá jamás.

    Devuelve la site key del par que le corresponde a quien pregunta, y por eso
    recibe el origen: si al APK se le sirviera la llave de la web, acuñaría un
    token que después se verifica contra el otro secret y fallaría el 100% de
    las veces. Las dos mitades —la que se sirve acá y la que verifica en
    `verificar`— tienen que decidir con el MISMO criterio.
    """
    if not activo():
        return {"activo": False, "site_key": None}
    site_key, _ = _par_llaves(origen)
    return {"activo": True, "site_key": site_key}


def advertir_configuracion_incompleta() -> None:
    """Avisa al arrancar si hay una sola llave puesta.

    Sin esto, el síntoma es que el captcha simplemente no hace nada y nadie se
    entera hasta que alguien revisa por qué no aparece el aviso legal.
    """
    if settings.RECAPTCHA_SECRET_KEY and not settings.RECAPTCHA_SITE_KEY:
        logger.warning(
            "reCAPTCHA: hay RECAPTCHA_SECRET_KEY pero falta RECAPTCHA_SITE_KEY; "
            "queda DESACTIVADO (el frontend no podría acuñar tokens)"
        )
    elif settings.RECAPTCHA_SITE_KEY and not settings.RECAPTCHA_SECRET_KEY:
        logger.warning(
            "reCAPTCHA: hay RECAPTCHA_SITE_KEY pero falta RECAPTCHA_SECRET_KEY; "
            "queda DESACTIVADO (no habría con qué verificar los tokens)"
        )


def _no_concluyente(motivo: str) -> Veredicto:
    """Google no opinó: se aprueba, salvo que el operador haya cerrado la puerta."""
    return Veredicto(
        aprobado=settings.RECAPTCHA_FALLA_ABIERTA, concluyente=False, motivo=motivo
    )


def _consultar_a_google(
    token: str, ip: Optional[str], secret: Optional[str] = None
) -> Optional[dict]:
    """Llama a siteverify. Devuelve el JSON, o None si no se pudo hablar.

    El `timeout` no es opcional: un `requests.post` sin él deja el worker
    colgado para siempre, y como los cuatro endpoints que usan esto son los de
    autenticación, bastaría con que Google dejara de responder para quedarse
    sin workers y tumbar toda la API.
    """
    try:
        respuesta = requests.post(
            settings.RECAPTCHA_VERIFY_URL,
            data={
                # El del par que eligió `_par_llaves`. Verificar con el secret
                # de otra llave devuelve `invalid-input-response` y se ve igual
                # que un token falsificado.
                "secret": secret or settings.RECAPTCHA_SECRET_KEY,
                "response": token,
                # Opcional para Google y solo informativo: un valor equivocado
                # no rompe la verificación.
                "remoteip": ip or "",
            },
            timeout=settings.RECAPTCHA_TIMEOUT_SEGUNDOS,
        )
    except requests.exceptions.Timeout:
        logger.warning("reCAPTCHA: siteverify no respondió a tiempo (motivo=timeout)")
        return None
    except requests.exceptions.RequestException as e:
        logger.warning("reCAPTCHA: no se pudo llegar a siteverify (motivo=error_de_red): %s", e)
        return None

    if respuesta.status_code != 200:
        logger.warning(
            "reCAPTCHA: siteverify respondió HTTP %s (motivo=http_%s)",
            respuesta.status_code,
            respuesta.status_code,
        )
        return None

    try:
        return respuesta.json()
    except ValueError:
        logger.warning("reCAPTCHA: siteverify devolvió algo que no es JSON (motivo=json_ilegible)")
        return None


def _clasificar_fracaso(codigos: tuple[str, ...]) -> Veredicto:
    """`success: false` — decide de quién es la culpa."""
    if set(codigos) & CODIGOS_DE_CONFIGURACION:
        # El despliegue está mal, no la persona que intenta entrar. ERROR y no
        # WARNING porque esto no se arregla solo.
        logger.error(
            "reCAPTCHA MAL CONFIGURADO (codigos=%s): las peticiones se DEJAN PASAR "
            "hasta que se corrija. Revise que RECAPTCHA_SECRET_KEY sea el secret "
            "del MISMO par que RECAPTCHA_SITE_KEY.",
            codigos,
        )
        return _no_concluyente("secret_invalido")

    # Token ausente, corrupto o ya usado: Google opinó y la respuesta es no.
    return Veredicto(
        aprobado=False, concluyente=True, motivo="token_rechazado", codigos=codigos
    )


def _accion_calza(recibida: Optional[str], esperada: str) -> bool:
    if recibida == esperada:
        return True
    logger.warning(
        "reCAPTCHA: se esperaba la accion '%s' pero el token trae '%s'. Si nadie está "
        "atacando, es que el literal del frontend y el de Python no coinciden.",
        esperada,
        recibida,
    )
    return False


def verificar(
    token: Optional[str],
    accion_esperada: str,
    ip: Optional[str] = None,
    origen: Optional[str] = None,
) -> Veredicto:
    """Consulta a Google y aplica las reglas. No lanza: devuelve el veredicto.

    `origen` es la cabecera `Origin` y solo sirve para elegir con qué par de
    llaves verificar (ver `_par_llaves`). El veredicto no depende de él.
    """
    if not activo():
        return Veredicto(aprobado=True, concluyente=False, motivo="desactivado")

    if not token:
        # Estando activo, un formulario sin token es un cliente que no ejecutó
        # el captcha: un bot o un bloqueador de contenido. La app Android
        # también caía acá hasta que tuvo su propio par de llaves.
        return Veredicto(aprobado=False, concluyente=True, motivo="sin_token")

    _, secret = _par_llaves(origen)
    datos = _consultar_a_google(token, ip, secret)
    if datos is None:
        return _no_concluyente("sin_respuesta")

    codigos = tuple(datos.get("error-codes") or ())
    accion = datos.get("action")
    hostname = datos.get("hostname")

    if not datos.get("success"):
        return _clasificar_fracaso(codigos)

    score = datos.get("score")
    if score is None:
        # v3 siempre trae score. Sin él, la llave registrada en la consola es
        # de v2: es un error de configuración, no del usuario.
        logger.error(
            "reCAPTCHA: la respuesta no trae 'score'. ¿La llave está registrada como v2 "
            "en la consola de Google? Se DEJA PASAR hasta que se corrija."
        )
        return _no_concluyente("sin_score")

    comun = {"score": score, "accion": accion, "hostname": hostname, "codigos": codigos}

    if not _accion_calza(accion, accion_esperada):
        return Veredicto(aprobado=False, concluyente=True, motivo="accion_distinta", **comun)

    permitidos = settings.recaptcha_hostnames
    if permitidos and (hostname or "").lower() not in permitidos:
        return Veredicto(aprobado=False, concluyente=True, motivo="hostname_ajeno", **comun)

    if score < settings.RECAPTCHA_SCORE_MINIMO:
        return Veredicto(aprobado=False, concluyente=True, motivo="puntaje_bajo", **comun)

    return Veredicto(aprobado=True, concluyente=True, motivo="ok", **comun)


def exigir(
    token: Optional[str],
    accion_esperada: str,
    ip: Optional[str] = None,
    origen: Optional[str] = None,
) -> None:
    """Verifica y corta con 400 si corresponde.

    400 y no 401: no es una credencial que no calza, y un 401 en el login se
    leería como "contraseña incorrecta", que sería información falsa.
    """
    veredicto = verificar(token, accion_esperada, ip, origen)

    if not veredicto.concluyente and veredicto.motivo != "desactivado":
        logger.warning(
            "reCAPTCHA no concluyente (motivo=%s) para accion=%s ip=%s: la solicitud se %s",
            veredicto.motivo,
            accion_esperada,
            ip,
            "DEJA PASAR" if veredicto.aprobado else "RECHAZA (falla cerrada)",
        )

    if veredicto.aprobado:
        return

    logger.warning(
        "reCAPTCHA rechazó accion=%s motivo=%s score=%s hostname=%s codigos=%s ip=%s",
        accion_esperada,
        veredicto.motivo,
        veredicto.score,
        veredicto.hostname,
        veredicto.codigos,
        ip,
    )

    if settings.RECAPTCHA_SOLO_REGISTRAR:
        # Modo monitor: se mide sin bloquear a nadie. Es como se estrena en
        # producción, para saber cuánto tráfico legítimo llega sin token antes
        # de empezar a rechazarlo.
        logger.warning(
            "reCAPTCHA en modo monitor (RECAPTCHA_SOLO_REGISTRAR): la solicitud se DEJA PASAR"
        )
        return

    raise BadRequestException(MENSAJE_RECHAZO)


def _ip_cliente(request: Request) -> Optional[str]:
    """IP real del que llama, mirando primero el proxy.

    Detrás de Nginx, `request.client.host` es siempre la IP del contenedor: sin
    leer `X-Forwarded-For`, todas las peticiones le llegarían a Google como una
    sola y su señal por IP no serviría de nada.
    """
    reenviada = request.headers.get("X-Forwarded-For")
    if reenviada:
        return reenviada.split(",")[0].strip()
    return request.client.host if request.client else None


def verificado(accion: str) -> Callable:
    """Dependencia de FastAPI que protege un endpoint público.

        @router.post("/login", dependencies=[Depends(recaptcha.verificado(ACCION_LOGIN))])

    Como dependencia y no como llamada dentro del handler por dos razones. Una,
    corta ANTES de que el handler abra la sesión maestra, resuelva el tenant,
    abra la conexión a la base del cliente y corra un bcrypt de ~300 ms — que es
    exactamente el costo que el captcha existe para evitar. Y dos, queda
    declarada en la firma de la ruta, así que un endpoint público nuevo que se
    olvide de protegerla se ve en el diff sin leer el cuerpo.

    OJO: la función interna es `def` y **no** `async def`. Los endpoints que la
    usan son sincrónicos, así que FastAPI la corre en el threadpool y el
    `requests.post` bloqueante no toca el event loop. Declarada `async`, cada
    login congelaría el servidor entero mientras Google tarde en responder.
    """

    def _dependencia(
        request: Request,
        x_recaptcha_token: Optional[str] = Header(default=None, alias="X-Recaptcha-Token"),
    ) -> None:
        exigir(
            x_recaptcha_token,
            accion,
            ip=_ip_cliente(request),
            # De acá sale con qué par de llaves verificar: el WebView del APK
            # se identifica con `Origin: https://localhost`.
            origen=request.headers.get("Origin"),
        )

    return _dependencia
