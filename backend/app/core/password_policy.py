"""Política de contraseñas del sistema.

Una sola definición para los dos flujos de autenticación —el usuario de un
estudio y el administrador de la plataforma— porque la regla es del sistema y
no de la pantalla que la pide. `admin_api` importa de acá igual que el backend
de clientes.

Acá va solo lo que se puede decidir mirando la cadena. La otra mitad de la
política —no repetir ninguna de las últimas contraseñas— necesita la base de
datos y vive en `app/services/password_service.py`; `HISTORIAL_MAXIMO` está
declarado acá para que la regla completa se lea en un solo lugar.

El frontend repite estas mismas comprobaciones para poder mostrarlas mientras
la persona escribe (ver `core/utils/password.ts`), pero la que manda es esta:
la del navegador es una cortesía, no un control.
"""

import re

from app.core.exceptions import BadRequestException

LARGO_MINIMO = 8
LARGO_MAXIMO = 100

# Cuántas contraseñas quedan vetadas al elegir una nueva, contando la vigente.
# Con 4: la actual y las tres anteriores.
HISTORIAL_MAXIMO = 4

# (patrón, cómo se nombra la regla en el mensaje de error). El orden es el que
# se le muestra al usuario, así que va de lo más obvio a lo más específico.
#
# Las clases de letras incluyen las acentuadas y la ñ: un apellido chileno
# escrito con tilde tiene que contar como letra, no como símbolo raro.
REGLAS: tuple[tuple[str, str], ...] = (
    (rf".{{{LARGO_MINIMO},}}", f"al menos {LARGO_MINIMO} caracteres"),
    (r"[A-ZÁÉÍÓÚÜÑ]", "al menos una letra mayúscula"),
    (r"[a-záéíóúüñ]", "al menos una letra minúscula"),
    (r"[0-9]", "al menos un número"),
)

DESCRIPCION = (
    f"Mínimo {LARGO_MINIMO} caracteres, con al menos una mayúscula, una "
    f"minúscula y un número. No puede repetir ninguna de sus últimas "
    f"{HISTORIAL_MAXIMO} contraseñas."
)


def incumplimientos(password: str) -> list[str]:
    """Las reglas que la contraseña NO cumple, en el orden de `REGLAS`."""
    valor = password or ""
    return [texto for patron, texto in REGLAS if not re.search(patron, valor)]


def validar(password: str) -> None:
    """Lanza 400 con TODAS las reglas incumplidas de una vez.

    De a una obligaría a descubrir los requisitos a fuerza de intentos: se
    corrige el largo y recién ahí aparece que además falta un número.
    """
    faltas = incumplimientos(password)
    if faltas:
        raise BadRequestException("La contraseña debe tener " + ", ".join(faltas) + ".")
