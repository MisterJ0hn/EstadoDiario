"""Cuándo una causa está vigente y cuándo terminó.

Es UNA regla de negocio con tres consumidores que no comparten código: el
filtro de "Mis Causas" (ORM, base del cliente), el contador de causas activas
de la consola (SQL crudo, una base por cliente) y el cierre de facturación
(idem). Escrita tres veces, el día que se agregue un estado terminal el número
de la factura y el de la pantalla dejarían de coincidir, y nadie sabría cuál
de los dos está mal.

**Qué cuenta como terminada.** Solo los estados en que el tribunal ya no va a
hacer nada más con la causa: `Concluido` en las hojas civiles, laborales y de
familia, y `Fallada o Concluida` en la penal, que es como el PJUD nombra lo
mismo ahí.

**Lo demás es vigente, incluido lo que no dice nada.** `Archivada`,
`Suspendido` o `Acumulada` son causas que pueden volver a moverse, y la hoja de
Cobranza no trae la columna: sus causas llegan con el estado nulo. Tratar el
nulo como terminado borraría a Cobranza entera de la cartera y de la factura.

La comparación va normalizada (`lower(trim(...))`) porque el Excel del PJUD
rellena la celda con espacios a la derecha: `'Concluido                     '`.
"""

from typing import Optional

# Estados en los que la causa ya terminó, normalizados como se comparan.
ESTADOS_FINALIZADOS: tuple[str, ...] = (
    "concluido",
    "concluida",
    "fallada o concluida",
)


def normalizar_estado(valor: Optional[str]) -> str:
    """Deja el estado como se compara: sin espacios sobrantes y en minúsculas."""
    return (valor or "").strip().lower()


def esta_finalizada(estado: Optional[str]) -> bool:
    """¿Esta causa ya terminó? Nulo o vacío = no (ver el docstring del módulo)."""
    return normalizar_estado(estado) in ESTADOS_FINALIZADOS


# Fragmento SQL reutilizable para las consultas que no pasan por el ORM. Se
# formatea con el nombre de la columna porque cada tabla la llama distinto
# (`causa.estado_causa`, `causa_corte.estado_procesal`).
#
# Va con `LOWER(BTRIM(...))` y no con ILIKE por lo mismo de arriba: los valores
# vienen rellenos con espacios. `IS NULL` entra en el lado vigente de forma
# explícita: en SQL, `NULL NOT IN (...)` no es verdadero, es NULL, así que sin
# esta rama las causas de Cobranza no las contaría nadie.
_LISTA_SQL = ", ".join(f"'{e}'" for e in ESTADOS_FINALIZADOS)


# Valores del parámetro `vigencia` que aceptan los listados. Viven acá y no en
# un repositorio porque ya son cuatro las pantallas que filtran por esto.
VIGENTES = "vigentes"
FINALIZADAS = "finalizadas"


def condicion_vigencia(columna, vigencia: Optional[str]):
    """Condición ORM de vigencia sobre la columna de estado indicada.

    Sirve para las cuatro pantallas que filtran por esto: la cartera por
    materia y por corte, y los movimientos por materia y por corte. Cada tabla
    nombra distinto su columna de estado (`estado_causa`, `estado_procesal`),
    así que se recibe la columna y no el modelo.

    Devuelve None cuando no se pidió filtrar, para que quien llama pueda
    encadenarlo sin ramas.

    **El estado nulo cuenta como VIGENTE** y por eso el `is_(None)` explícito:
    la hoja de Cobranza no trae la columna, y en SQL un `NOT IN` contra NULL no
    es verdadero sino NULL, así que sin esa rama Cobranza no aparecería en
    ninguno de los dos lados del filtro.
    """
    # Import local: este módulo lo consumen también los jobs, que arman SQL
    # crudo y no deberían arrastrar SQLAlchemy solo por estar acá.
    from sqlalchemy import func, or_

    # `lower(btrim(...))`: el Excel del PJUD rellena la celda con espacios a la
    # derecha ('Concluido                     ').
    normalizado = func.lower(func.btrim(columna))
    if vigencia == VIGENTES:
        return or_(columna.is_(None), normalizado.notin_(ESTADOS_FINALIZADOS))
    if vigencia == FINALIZADAS:
        return normalizado.in_(ESTADOS_FINALIZADOS)
    return None


def sql_vigente(columna: str) -> str:
    """Condición SQL de causa VIGENTE sobre la columna de estado indicada."""
    return f"({columna} IS NULL OR LOWER(BTRIM({columna})) NOT IN ({_LISTA_SQL}))"


def sql_finalizada(columna: str) -> str:
    """Condición SQL de causa TERMINADA sobre la columna de estado indicada."""
    return f"({columna} IS NOT NULL AND LOWER(BTRIM({columna})) IN ({_LISTA_SQL}))"
