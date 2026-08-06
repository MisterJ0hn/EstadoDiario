"""Arranque del paquete: deja utilizable el paquete `app` de `backend/`.

**Por qué se comparte y no se copia.** `admin_api` necesita los modelos, el
cifrado (`core/crypto`), el hash de búsqueda, la firma de tokens
(`core/security`), el ruteo de conexiones (`core/database`), el esquema de las
bases (`core/esquema`), los repositorios y el aprovisionamiento. Son más de
cuarenta archivos que tendrían que quedar byte a byte iguales a los de
`backend/`, y la divergencia no daría un error: daría datos mal. Dos ejemplos
concretos de lo que se rompería sin avisar:

- `core/esquema` define las 14 tablas de la base de cliente. Si acá quedara una
  versión atrasada, los clientes creados desde la consola nacerían con un
  esquema distinto al que espera el backend de los estudios.
- `core/crypto` y `core/hash_busqueda` derivan sus claves de `BACKEND_SECRET_KEY`.
  Una copia que derive distinto cifra RUTs que el backend no puede descifrar.

**Qué implica para el despliegue.** La imagen de `admin_api` tiene que incluir
`backend/app`. No es una dependencia opcional: sin ese directorio el servicio no
levanta.

**Por qué el bootstrap vive acá y no en `main.py`.** Cualquier módulo de
`admin_api.app` importa `app.*`. Si el bootstrap estuviera solo en `main.py`,
importar `admin_api.app.deps` desde una prueba o un script fallaría. `__init__`
corre siempre antes que cualquier submódulo, así que es el único lugar que cubre
todas las entradas.

**Ojo con el nombre del paquete.** Este directorio también se llama `app`, así
que el servicio se arranca como `admin_api.app.main:app` DESDE LA RAÍZ del
repositorio. Arrancarlo como `app.main:app` parado dentro de `admin_api/` haría
que `app` se resuelva a este paquete y no al de `backend/`: ver la comprobación
al final de este archivo, que lo detecta y lo dice en vez de fallar con un
`ImportError` sin contexto.
"""

import sys
from pathlib import Path

_RAIZ = Path(__file__).resolve().parents[2]
_BACKEND = _RAIZ / "backend"

if not _BACKEND.is_dir():
    raise RuntimeError(
        f"No se encuentra el paquete compartido en {_BACKEND}. "
        "admin_api reutiliza backend/app: la imagen o el checkout tienen que incluirlo."
    )

# Delante de todo: el directorio de trabajo puede tener otro `app` a mano.
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

# El .env se carga por ruta absoluta y no por el `env_file` relativo de
# pydantic-settings: ese se resuelve contra el directorio de trabajo, y acá el
# directorio de trabajo es la raíz del repo, no `backend/`.
try:
    from dotenv import load_dotenv

    # Sin override: lo que ya venga del entorno (Docker, systemd, la consola)
    # manda sobre el archivo.
    load_dotenv(_RAIZ / ".env", override=False)
except ImportError:  # pragma: no cover - python-dotenv es dependencia declarada
    pass


def _verificar_paquete_compartido() -> None:
    """Confirma que `app` sea el de `backend/` y no este mismo directorio.

    Es el error de arranque más probable y el más difícil de leer si se deja
    pasar: se manifiesta como `ModuleNotFoundError: app.core` a mitad de una
    cadena de imports.
    """
    import app as paquete_compartido

    ubicacion = Path(paquete_compartido.__file__ or "").resolve().parent
    if ubicacion != (_BACKEND / "app"):
        raise RuntimeError(
            f"El paquete 'app' se resolvió a {ubicacion} en vez de {_BACKEND / 'app'}. "
            "Arranque el servicio desde la raíz del repositorio como "
            "'uvicorn admin_api.app.main:app'."
        )


_verificar_paquete_compartido()
