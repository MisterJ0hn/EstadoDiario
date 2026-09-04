"""Registro de actividad: quién hizo qué dentro del sistema de un estudio.

Escribe en `log_actividades`, que vive en la base de cada cliente. Lo lee el
administrador desde **Consola → Bitácora**, y es lo que responde las dos
preguntas que llegan a soporte: quién entró y quién tocó esto.

**Registrar nunca puede romper la acción.** Si la bitácora falla —la base no
responde, la tabla no existe en una instalación vieja— la importación, el
borrado o el login tienen que seguir su curso igual. Por eso todo pasa por
`_seguro`, que traga la excepción y deja el rastro en el log del servidor: es
preferible perder una línea de auditoría a perder el trabajo del usuario.

**Dos formas de escribir, y la diferencia importa:**

- `registrar(db, ...)` **no hace commit**: se suma a la transacción de quien
  llama. Si esa transacción se deshace, la línea se va con ella — que es lo
  correcto, porque entonces la acción tampoco ocurrió.
- `registrar_aparte(guid, ...)` abre su propia sesión y sí confirma. Es para lo
  que pasa FUERA de una transacción de tenant: el login, sobre todo, donde el
  intento fallido hay que registrarlo aunque no haya sesión que confirmar.

Nunca al revés: usar la primera para un login fallido perdería el registro, y
usar la segunda dentro de una importación dejaría la línea escrita aunque el
archivo terminara descartado.
"""

import logging
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.database import crear_sesion_tenant
from app.models.log_actividades import LogActividades

logger = logging.getLogger(__name__)

# Módulos. Son los mismos nombres que aparecen en el filtro de la consola, así
# que conviene que sean pocos y estables: cada valor nuevo es una opción más en
# un desplegable que alguien tiene que entender.
MODULO_AUTH = "auth"
MODULO_ESTADO_DIARIO = "estado_diario"
MODULO_MOVIMIENTOS = "movimientos"
MODULO_AUDIENCIAS = "audiencias"
MODULO_CAUSAS = "causas"
MODULO_REPORTES = "reportes"
MODULO_USUARIOS = "usuarios"
MODULO_CONFIGURACION = "configuracion"

# Acciones.
ACCION_LOGIN = "login"
ACCION_LOGIN_FALLIDO = "login_fallido"
ACCION_CAMBIAR_PASSWORD = "cambiar_password"
ACCION_CREAR = "crear"
ACCION_EDITAR = "editar"
ACCION_ELIMINAR = "eliminar"
ACCION_IMPORTAR = "importar"
ACCION_ENVIAR = "enviar"
# Las dos acciones que el estudio ejecuta sobre un movimiento del estado diario.
# Van separadas de `editar` porque es lo que se pregunta en soporte: no "quién
# tocó esto", sino "quién lo dio por resuelto".
ACCION_MARCAR_LEIDO = "marcar_leido"
ACCION_MARCAR_NO_LEIDO = "marcar_no_leido"
ACCION_MARCAR_PENDIENTE = "marcar_pendiente"
ACCION_CONECTAR = "conectar"
ACCION_DESCONECTAR = "desconectar"


def ip_de(request: Optional[Request]) -> Optional[str]:
    """La IP del cliente, mirando primero el encabezado del proxy.

    Detrás de Nginx `request.client.host` es la IP del propio proxy y sería la
    misma en todas las filas. `X-Forwarded-For` puede traer una cadena
    (`cliente, proxy1, proxy2`) y la primera es la que interesa.
    """
    if request is None:
        return None
    reenviada = request.headers.get("x-forwarded-for")
    if reenviada:
        return reenviada.split(",")[0].strip()[:45]
    return request.client.host[:45] if request.client else None


def _fila(modulo, accion, usuario_id, ip, detalle) -> LogActividades:
    return LogActividades(
        modulo=modulo,
        accion=accion,
        usuario_id=usuario_id,
        ip=ip,
        # La columna admite 500; el detalle se recorta en vez de reventar el
        # INSERT y llevarse la acción por delante.
        detalle=detalle[:500] if detalle else None,
    )


def registrar(
    db: Session,
    modulo: str,
    accion: str,
    usuario_id: Optional[int] = None,
    ip: Optional[str] = None,
    detalle: Optional[str] = None,
) -> None:
    """Suma la línea a la transacción en curso. **No confirma.**

    Se llama con la sesión del tenant que ya tiene el endpoint, antes de su
    propio commit. Si la operación se deshace, la auditoría se deshace con ella.
    """

    def _escribir():
        db.add(_fila(modulo, accion, usuario_id, ip, detalle))

    _seguro(_escribir, modulo, accion)


def registrar_aparte(
    guid: str,
    modulo: str,
    accion: str,
    usuario_id: Optional[int] = None,
    ip: Optional[str] = None,
    detalle: Optional[str] = None,
) -> None:
    """Abre su propia sesión sobre la base del cliente, escribe y confirma.

    Para lo que ocurre fuera de una transacción de tenant. El caso que lo
    justifica es el login fallido: ahí no hay sesión abierta que confirmar y el
    intento igual tiene que quedar registrado.
    """

    def _escribir():
        db = crear_sesion_tenant(guid)
        try:
            db.add(_fila(modulo, accion, usuario_id, ip, detalle))
            db.commit()
        finally:
            db.close()

    _seguro(_escribir, modulo, accion)


def _seguro(escribir, modulo: str, accion: str) -> None:
    """Ejecuta la escritura sin dejar que su falla escale.

    Una bitácora caída no puede impedir que alguien importe un archivo o inicie
    sesión. El error queda en el log del servidor, que es donde lo va a buscar
    quien investigue por qué faltan líneas.
    """
    try:
        escribir()
    except Exception as e:  # noqa: BLE001 — deliberado, ver el docstring
        logger.warning("No se pudo registrar la actividad %s/%s: %s", modulo, accion, e)
