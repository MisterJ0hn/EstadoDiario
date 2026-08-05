"""Hash de búsqueda para columnas cifradas.

Fernet (app/core/crypto.py) no es determinista: cifrar dos veces el mismo RUT
da dos tokens distintos, así que `WHERE rut = :rut` sobre la columna cifrada no
encuentra nada nunca. Por eso cada campo cifrado que ADEMÁS es criterio de
búsqueda se guarda en dos columnas:

- la cifrada, reversible, que es la que se muestra;
- `<campo>_hash`, un HMAC-SHA256 con clave del sistema, con UNIQUE + índice,
  que es por donde se busca.

Es HMAC y no SHA256 pelado porque el espacio de RUT chilenos es chico
(decenas de millones): un hash sin clave se rompe por fuerza bruta en minutos
y el cifrado de la otra columna dejaría de servir de algo. La clave sale de
SEARCH_HASH_KEY, o se deriva de BACKEND_SECRET_KEY si no está definida.

OJO: cambiar la clave invalida TODOS los hash guardados (nadie podría volver a
entrar). Migrarla exige recalcularlos leyendo el valor descifrado.
"""

import hashlib
import hmac

from app.core.config import settings


def _clave() -> bytes:
    if settings.SEARCH_HASH_KEY:
        return settings.SEARCH_HASH_KEY.encode()
    # Namespace propio: que el mismo secreto no genere la misma clave que Fernet.
    return hashlib.sha256(
        b"hash-busqueda:" + settings.BACKEND_SECRET_KEY.encode()
    ).digest()


def hash_busqueda(valor: str) -> str:
    """HMAC-SHA256 en hexadecimal (64 chars) del valor normalizado.

    Normaliza recortando espacios y bajando a minúsculas, para que el hash no
    dependa de cómo se escribió el dato al ingresarlo: sobre una columna
    cifrada no existe el `func.lower(...)` que resolvía esto antes.
    """
    if valor is None:
        raise ValueError("No se puede hashear un valor nulo")
    normalizado = valor.strip().lower()
    return hmac.new(_clave(), normalizado.encode("utf-8"), hashlib.sha256).hexdigest()


def normalizar_rut(rut: str) -> str:
    """Deja el RUT en la forma canónica '12345678-9'.

    Sin esto, '12.345.678-9' y '123456789' darían hash distintos y el mismo
    cliente quedaría duplicado o no podría iniciar sesión.
    """
    if rut is None:
        raise ValueError("RUT nulo")
    limpio = "".join(c for c in rut if c.isalnum()).lower()
    if len(limpio) < 2:
        raise ValueError(f"RUT inválido: {rut!r}")
    return f"{limpio[:-1]}-{limpio[-1]}"


def hash_rut(rut: str) -> str:
    """Hash de búsqueda de un RUT, normalizado antes de hashear."""
    return hash_busqueda(normalizar_rut(rut))
