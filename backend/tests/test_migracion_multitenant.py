"""Verificaciones estáticas del job de migración a multi-cliente.

El job solo se puede correr de verdad contra un PostgreSQL con el esquema
viejo, así que lo que se protege acá es lo que sí se puede comprobar sin base:
que los INSERT escritos a mano no se dejen fuera una columna obligatoria.

Esto existe por un error real: `_migrar_casilla` insertaba con SQL crudo y no
incluía `fecha_modificacion`, que es NOT NULL con default de **Python**. Los
defaults del ORM no se aplican en SQL crudo, así que la migración reventaba con
NotNullViolation al llegar a la casilla — y solo en instalaciones que tuvieran
una casilla configurada, que es por qué el ensayo local no lo detectó.
"""

import pathlib
import re

from sqlalchemy import inspect as sa_inspect

from app.core.database import BaseMaestra, BaseTenant
import app.models  # noqa: F401  registra los modelos de tenant
import app.models.maestra  # noqa: F401  y los de la base principal

JOB = pathlib.Path(__file__).resolve().parent.parent / "app" / "jobs" / "migrar_a_multitenant.py"

# INSERT INTO tabla (col, col, ...) — el job los arma en una f-string de varias
# líneas, por eso el DOTALL.
_INSERT = re.compile(r"INSERT INTO\s+(\w+)\s*\(([^)]*)\)", re.DOTALL)


def _columnas_obligatorias(tabla: str) -> set[str]:
    """Columnas que un INSERT tiene que traer sí o sí.

    Se excluyen la primaria autoincremental (la pone la secuencia) y todo lo
    que tenga default en el SERVIDOR, que es el único que sí se aplica cuando
    el INSERT va en SQL crudo.
    """
    for base in (BaseMaestra, BaseTenant):
        modelo = base.metadata.tables.get(tabla)
        if modelo is None:
            continue
        return {
            c.name
            for c in modelo.columns
            if not c.nullable
            and c.server_default is None
            and not (c.primary_key and c.autoincrement)
        }
    raise AssertionError(f"El job inserta en `{tabla}`, que no es de ningún modelo conocido")


def _inserts_del_job() -> list[tuple[str, set[str]]]:
    fuente = JOB.read_text(encoding="utf-8")
    encontrados = []
    for tabla, lista in _INSERT.findall(fuente):
        columnas = set()
        for parte in lista.split(","):
            # El INSERT se escribe como varios literales concatenados, así que
            # entre medio quedan comillas y saltos de línea (`" \n "telefono`).
            # Se sacan TODOS, no solo los de los extremos: un nombre de columna
            # no lleva ni espacios ni comillas, y limpiar a medias hace que el
            # test acuse columnas faltantes que sí están.
            parte = re.sub(r"[\s\"']", "", parte)
            # La lista puede venir interpolada (`{lista}`): esos nombres no se
            # conocen sin ejecutar.
            if parte and "{" not in parte:
                columnas.add(parte)
        encontrados.append((tabla, columnas))
    return encontrados


def test_hay_inserts_que_revisar():
    # Si alguien reescribe el job y saca todos los INSERT crudos, este archivo
    # deja de proteger nada y conviene enterarse.
    assert _inserts_del_job(), "No se encontró ningún INSERT en el job de migración"


def test_cada_insert_trae_todas_las_columnas_obligatorias():
    problemas = []
    for tabla, columnas in _inserts_del_job():
        faltantes = _columnas_obligatorias(tabla) - columnas
        if faltantes:
            problemas.append(f"{tabla}: falta(n) {', '.join(sorted(faltantes))}")

    # El mensaje dice qué columna y de qué tabla: es el error exacto que
    # apareció en producción, pero antes de correr la migración.
    assert not problemas, (
        "INSERT del job de migración sin columnas NOT NULL. Los defaults de "
        "Python NO se aplican en SQL crudo: hay que pasarlas explícitamente o "
        "insertar por el ORM.\n  " + "\n  ".join(problemas)
    )


def test_la_casilla_se_migra_por_el_orm():
    """La casilla tiene demasiadas columnas para mantenerlas a mano.

    Se migra construyendo el modelo, que aplica los defaults de Python. Si
    alguien la vuelve a pasar a SQL crudo, el próximo campo NOT NULL que se
    agregue rompe la migración de nuevo.
    """
    fuente = JOB.read_text(encoding="utf-8")
    assert "ConfiguracionCorreo(cliente_id=" in fuente
    assert "INSERT INTO configuracion_correo" not in fuente


def test_el_modelo_de_casilla_tiene_columnas_con_default_de_python():
    # Es la condición que hace peligroso el SQL crudo. Si dejara de cumplirse,
    # el test de arriba estaría cuidando algo que ya no existe.
    tabla = BaseMaestra.metadata.tables["configuracion_correo"]
    riesgosas = [
        c.name
        for c in tabla.columns
        if not c.nullable and c.server_default is None and c.default is not None
    ]
    assert "fecha_modificacion" in riesgosas


def test_reintentar_con_el_mismo_rut_no_esta_bloqueado():
    """Una migración que falla a la mitad se retoma con los mismos argumentos.

    El guard de "ya migrado" mira el RUT: si no lo hiciera, el único camino
    tras un fallo parcial sería borrar el cliente y su base a mano.
    """
    import inspect

    from app.jobs.migrar_a_multitenant import _verificar_origen

    assert "rut" in inspect.signature(_verificar_origen).parameters


def test_todas_las_tablas_del_tenant_se_copian_o_se_justifican():
    """Ninguna tabla operativa puede quedarse en la base principal.

    Si se agrega un modelo de tenant y nadie lo suma a TABLAS_A_COPIAR, los
    datos viejos de esa tabla se pierden en la migración sin ningún error.
    """
    from app.jobs.migrar_a_multitenant import TABLAS_A_COPIAR

    # `usuario` se migra aparte (hay que cifrarlo). Las demás no existen en el
    # esquema viejo y nacen vacías:
    # - `estado_diario_corte` / `movimiento_corte`: las causas de corte se
    #   separaron después y en una instalación vieja siguen dentro de su tabla
    #   madre (se reimportan al cargar el archivo siguiente).
    # - `causa` / `causa_corte`: el reporte de Causas es posterior a la
    #   migración; una instalación vieja nunca lo importó.
    # - `usuario_password_historial`: el historial de contraseñas es posterior
    #   y no hay nada que copiar. Que nazca vacío no abre un hueco: la clave
    #   vigente se veta igual, porque sale del propio usuario y no del
    #   historial (ver `_hashes_vetados` en app/services/password_service.py).
    aparte = {
        "usuario",
        "log_actividades",
        "estado_diario_corte",
        "movimiento_corte",
        "causa",
        "causa_corte",
        "usuario_password_historial",
    }
    sin_cubrir = set(BaseTenant.metadata.tables) - set(TABLAS_A_COPIAR) - aparte
    assert not sin_cubrir, (
        f"Tablas de tenant que la migración no copia ni justifica: {sorted(sin_cubrir)}"
    )
