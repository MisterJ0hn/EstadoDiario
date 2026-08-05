"""Migración de la instalación de una sola base al esquema multi-cliente.

Uso:
    python -m app.jobs.migrar_a_multitenant --nombre "Estudio X" --rut 76.543.210-K --ensayo
    python -m app.jobs.migrar_a_multitenant --nombre "Estudio X" --rut 76.543.210-K

Hasta la versión anterior TODO vivía en la base `estado_diario`: las causas,
los usuarios y las configuraciones. Ahora esa base es la **principal** —solo
clientes, administradores del sistema y configuraciones— y lo operativo vive en
una base por cliente. Este job hace ese corte una sola vez: convierte la
instalación existente en el **primer cliente**.

Qué hace, en orden:

1. Aparta las dos tablas que chocan de nombre entre el esquema viejo y el
   nuevo (`usuario` y `configuracion_correo`) renombrándolas a `_legacy_*`.
   `create_all()` no altera una tabla que ya existe, así que dejarlas en su
   lugar haría que la base principal arrancara con columnas faltantes.
2. Crea el esquema de la base principal ya con la forma nueva.
3. Da de alta el cliente y **crea su base de datos** con las 13 tablas.
4. Copia a esa base los usuarios (cifrando `usuario`, `correo` y `telefono`, y
   calculando sus hash de búsqueda) y las 10 tablas operativas, **conservando
   los id** para que las referencias entre ellas sigan apuntando a lo mismo.
5. Deja la casilla IMAP configurada como casilla del cliente.
6. Aparta las tablas operativas de la base principal como `_legacy_*`.

**No borra nada**: todo lo viejo queda en la base principal con el prefijo
`_legacy_`, para poder comparar y para que un error no cueste los datos. Una
vez verificada la migración, esas tablas se eliminan a mano.

Se puede volver a correr si falla a la mitad: cada paso comprueba si ya se hizo
(una tabla ya renombrada se salta, una tabla de destino que ya tiene filas no
se vuelve a copiar). Lo que NO se puede es correrlo dos veces para crear dos
clientes: si ya hay uno, aborta.

`--ensayo` recorre todo sin escribir: dice cuántas filas movería y qué tablas
apartaría. Conviene correrlo primero.
"""

import argparse
import logging
import sys
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.crypto import cifrar
from app.core.database import (
    BaseTenant,
    SesionMaestra,
    crear_engine_tenant,
    engine_maestro,
    nombre_base_tenant,
)
from app.core.esquema import aplicar_esquema_maestra, columna_existe
from app.core.hash_busqueda import hash_busqueda, normalizar_rut
from app.core.logging_config import setup_logging
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.services import aprovisionamiento_service

logger = logging.getLogger(__name__)

# Tablas operativas que se van a la base del cliente, EN ORDEN DE DEPENDENCIA:
# una fila no se puede insertar antes que aquella a la que apunta. `usuario` no
# está acá porque no se copia tal cual (ver `_migrar_usuarios`).
TABLAS_A_COPIAR = (
    "jurisdiccion",
    "estado_diario_origen",
    "estado_diario",
    "movimiento",
    "audiencia",
    "estado_diario_agenda",
    "reporte_plantilla",
    "correo_log",
    "google_credencial",
    "api_llamado_estado_diario",
)

# Las que chocan de nombre con el esquema nuevo de la base principal y hay que
# apartar ANTES de crear ese esquema.
TABLAS_QUE_CHOCAN = ("usuario", "configuracion_correo")

PREFIJO_LEGACY = "_legacy_"

# Filas por lote. La copia va por cursor de servidor, así que la memoria no
# depende del tamaño de la tabla sino de esto.
LOTE = 1000


class MigracionAbortada(Exception):
    """Algo no calza y seguir dejaría la instalación a medio migrar."""


# ── Apoyo ─────────────────────────────────────────────────


def _tabla_existe(conn, tabla: str) -> bool:
    return (
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :tabla"
            ),
            {"tabla": tabla},
        ).first()
        is not None
    )


def _columnas(conn, tabla: str) -> list[str]:
    return [
        fila[0]
        for fila in conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = :tabla "
                "ORDER BY ordinal_position"
            ),
            {"tabla": tabla},
        )
    ]


def _contar(conn, tabla: str) -> int:
    return conn.execute(text(f"SELECT COUNT(*) FROM {tabla}")).scalar() or 0


def _ajustar_secuencia(conn, tabla: str) -> None:
    """Deja el contador de `id` por encima del mayor id copiado.

    Sin esto el primer registro que cree el cliente después de migrar chocaría
    con un id ya usado: los id vienen impuestos por la copia y la secuencia
    quedó en cero.
    """
    conn.execute(
        text(
            f"SELECT setval(pg_get_serial_sequence('{tabla}', 'id'), "
            f"COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM {tabla}"
        )
    )


# ── Pasos ─────────────────────────────────────────────────


def _verificar_origen(ensayo: bool) -> None:
    """Comprueba que esta base sea efectivamente una instalación vieja."""
    with engine_maestro.connect() as conn:
        if _tabla_existe(conn, "cliente") and _contar(conn, "cliente") > 0:
            raise MigracionAbortada(
                "La base principal ya tiene clientes: esta instalación ya se migró. "
                "Migrar de nuevo crearía un cliente duplicado con los mismos datos."
            )

        # La marca de que esto es el esquema viejo: `usuario.username`. En el
        # nuevo esa columna se llama `usuario` y va cifrada.
        if not _tabla_existe(conn, "usuario"):
            raise MigracionAbortada("No existe la tabla `usuario`: no hay nada que migrar.")

        if not columna_existe(conn, "usuario", "username") and not _tabla_existe(
            conn, f"{PREFIJO_LEGACY}usuario"
        ):
            raise MigracionAbortada(
                "La tabla `usuario` no tiene la columna `username`: esta base no es "
                "una instalación de la versión de una sola base."
            )

    logger.info("Origen verificado%s", " (ensayo)" if ensayo else "")


def _apartar(conn, tablas, ensayo: bool) -> None:
    """Renombra tablas a `_legacy_*`. Idempotente: la ya renombrada se salta."""
    for tabla in tablas:
        destino = f"{PREFIJO_LEGACY}{tabla}"
        if _tabla_existe(conn, destino):
            logger.info("La tabla %s ya estaba apartada como %s", tabla, destino)
            continue
        if not _tabla_existe(conn, tabla):
            logger.info("La tabla %s no existe en la base principal; nada que apartar", tabla)
            continue

        filas = _contar(conn, tabla)
        if ensayo:
            logger.info("[ensayo] %s (%d filas) se renombraría a %s", tabla, filas, destino)
            continue

        conn.execute(text(f"ALTER TABLE {tabla} RENAME TO {destino}"))
        logger.info("Tabla %s (%d filas) apartada como %s", tabla, filas, destino)


def _crear_cliente(nombre: str, rut: str, correo: str | None) -> Cliente:
    db = SesionMaestra()
    try:
        repo = ClienteRepository(db)
        existente = repo.find_by_rut(rut)
        if existente:
            logger.info("El cliente con RUT %s ya existía (guid %s)", rut, existente.guid)
            return existente

        # Mismo uuid4 que el alta normal (`ClienteService.crear`), y no un
        # nombre legible: el guid se publica como casilla de ingesta
        # (<guid>@temposoft.cl), así que tiene que ser **imposible de
        # adivinar**. Un cliente migrado no puede ser el único con una
        # dirección deducible por quien sepa cómo se llama el sistema.
        guid = str(uuid.uuid4())
        cliente = Cliente(
            nombre=nombre.strip(),
            guid=guid,
            base_datos=nombre_base_tenant(guid),
            estado_aprovisionamiento=Cliente.APROV_EN_COLA,
            activo=True,
        )
        cliente.rut = rut
        cliente.correo = correo
        repo.save(cliente)
        logger.info("Cliente '%s' creado (guid=%s, base=%s)", nombre, guid, cliente.base_datos)
        return cliente
    finally:
        db.close()


def _marcar_aprovisionado(cliente_id: int) -> None:
    db = SesionMaestra()
    try:
        repo = ClienteRepository(db)
        cliente = repo.find_by_id(cliente_id)
        cliente.estado_aprovisionamiento = Cliente.APROV_LISTO
        cliente.error_aprovisionamiento = None
        cliente.fecha_aprovisionamiento = datetime.now(timezone.utc)
        repo.save(cliente)
    finally:
        db.close()


def _migrar_usuarios(engine_tenant: Engine, ensayo: bool) -> int:
    """Pasa los usuarios a la base del cliente, cifrando lo que ahora va cifrado.

    `username`, `email` y `telefono` se guardaban en claro; ahora van cifrados
    con Fernet y con un hash HMAC al lado, que es por donde se busca (el login
    y la unicidad del correo). El `id` se conserva porque todo lo operativo
    apunta a él: cambiarlo dejaría cada causa a nombre de otra persona.
    """
    origen = f"{PREFIJO_LEGACY}usuario"
    with engine_maestro.connect() as conn:
        if not _tabla_existe(conn, origen):
            raise MigracionAbortada(f"No se encontró {origen}: el paso 1 no se completó.")
        filas = list(conn.execute(text(f"SELECT * FROM {origen} ORDER BY id")).mappings())

    if ensayo:
        logger.info("[ensayo] se migrarían %d usuarios", len(filas))
        return len(filas)

    with engine_tenant.begin() as conn:
        if _contar(conn, "usuario") > 0:
            logger.info("La base del cliente ya tiene usuarios; se salta la migración")
            return 0

        for fila in filas:
            nombre_usuario = (fila["username"] or "").strip()
            correo = (fila["email"] or "").strip() or None
            telefono = (fila.get("telefono") or "").strip() or None

            conn.execute(
                text(
                    "INSERT INTO usuario (id, usuario, usuario_hash, correo, correo_hash, "
                    "telefono, password_hash, nombre, apellido, activo, rol, "
                    "debe_cambiar_password, fecha_creacion) "
                    "VALUES (:id, :usuario, :usuario_hash, :correo, :correo_hash, "
                    ":telefono, :password_hash, :nombre, :apellido, :activo, :rol, "
                    "FALSE, :fecha_creacion)"
                ),
                {
                    "id": fila["id"],
                    "usuario": cifrar(nombre_usuario),
                    "usuario_hash": hash_busqueda(nombre_usuario),
                    "correo": cifrar(correo) if correo else None,
                    "correo_hash": hash_busqueda(correo) if correo else None,
                    "telefono": cifrar(telefono) if telefono else None,
                    "password_hash": fila["password_hash"],
                    "nombre": fila["nombre"],
                    "apellido": fila["apellido"],
                    "activo": fila["activo"],
                    "rol": fila["rol"],
                    # La clave es la que la persona ya venía usando: no hay
                    # ningún motivo para obligarla a cambiarla por la mudanza.
                    "fecha_creacion": fila["fecha_creacion"],
                },
            )

        _ajustar_secuencia(conn, "usuario")

    logger.info("%d usuarios migrados a la base del cliente", len(filas))
    return len(filas)


def _limpiar_jurisdicciones_sembradas(engine_tenant: Engine) -> None:
    """Borra las jurisdicciones que sembró el aprovisionamiento, para que la
    copia pueda traer las del cliente con sus id originales.

    Aprovisionar siembra las nueve jurisdicciones del PJUD. Si se dejaran, la
    copia se saltaría la tabla por "ya tiene filas" y `estado_diario` quedaría
    apuntando a id que significan otra cosa: los del cliente y los sembrados
    coinciden solo por casualidad, y basta una jurisdicción agregada a mano
    para que cada causa quede clasificada mal, sin ningún error a la vista.

    Solo se borra si nada las referencia todavía, que es el caso mientras la
    copia no haya empezado.
    """
    with engine_tenant.begin() as conn:
        referencias = sum(
            _contar(conn, t) for t in ("estado_diario", "movimiento", "audiencia")
        )
        if referencias:
            logger.info(
                "La base del cliente ya tiene causas; se conservan sus jurisdicciones"
            )
            return
        borradas = conn.execute(text("DELETE FROM jurisdiccion")).rowcount
        if borradas:
            logger.info(
                "%d jurisdicciones sembradas descartadas: se copian las del cliente",
                borradas,
            )


def _copiar_tabla(engine_tenant: Engine, tabla: str, ensayo: bool) -> int:
    """Copia una tabla operativa completa, conservando los id.

    Las columnas se resuelven por intersección entre origen y destino en vez de
    ir escritas: las 10 tablas son idénticas en las dos versiones, y si alguna
    ganara una columna nueva esto sigue funcionando en vez de reventar.
    """
    destino_cols = set(BaseTenant.metadata.tables[tabla].columns.keys())

    with engine_maestro.connect() as conn:
        if not _tabla_existe(conn, tabla):
            logger.info("La tabla %s no existe en la base principal; se salta", tabla)
            return 0
        columnas = [c for c in _columnas(conn, tabla) if c in destino_cols]
        total = _contar(conn, tabla)

    if ensayo:
        logger.info("[ensayo] %s: se copiarían %d filas (%d columnas)", tabla, total, len(columnas))
        return total

    with engine_tenant.connect() as conn_destino:
        if _contar(conn_destino, tabla) > 0:
            logger.info("La tabla %s ya tiene filas en la base del cliente; se salta", tabla)
            return 0

    lista = ", ".join(columnas)
    marcadores = ", ".join(f":{c}" for c in columnas)
    insert = text(f"INSERT INTO {tabla} ({lista}) VALUES ({marcadores})")

    copiadas = 0
    # stream_results: cursor del lado del servidor. Sin esto, psycopg2 trae la
    # tabla entera a memoria antes de la primera fila.
    with engine_maestro.connect().execution_options(stream_results=True) as origen:
        resultado = origen.execute(text(f"SELECT {lista} FROM {tabla} ORDER BY id"))
        with engine_tenant.begin() as destino:
            for lote in resultado.mappings().partitions(LOTE):
                destino.execute(insert, [dict(f) for f in lote])
                copiadas += len(lote)
            _ajustar_secuencia(destino, tabla)

    logger.info("Tabla %s: %d filas copiadas", tabla, copiadas)
    return copiadas


def _migrar_casilla(cliente_id: int, ensayo: bool) -> None:
    """Convierte la casilla IMAP vieja en la casilla del cliente.

    Antes había una casilla por usuario; ahora hay una por cliente. Si había
    varias, se conserva la primera activa y las demás quedan en
    `_legacy_configuracion_correo` para revisarlas a mano: elegir por el
    sistema cuál de dos casillas ajenas es "la buena" sería adivinar.
    """
    origen = f"{PREFIJO_LEGACY}configuracion_correo"
    with engine_maestro.connect() as conn:
        if not _tabla_existe(conn, origen):
            logger.info("No hay casilla de correo que migrar")
            return
        filas = list(
            conn.execute(
                text(f"SELECT * FROM {origen} ORDER BY activo DESC, id")
            ).mappings()
        )
        columnas_origen = set(_columnas(conn, origen))

    if not filas:
        logger.info("No hay casilla de correo que migrar")
        return
    if len(filas) > 1:
        logger.warning(
            "Había %d casillas de correo; se migra la primera activa (id=%d) y el resto "
            "queda en %s para revisar a mano",
            len(filas),
            filas[0]["id"],
            origen,
        )

    fila = filas[0]
    if ensayo:
        logger.info("[ensayo] se migraría la casilla '%s' del cliente", fila["usuario"])
        return

    # Se copia campo por campo y no por intersección: acá sí cambian nombres
    # (`usuario_id` pasó a ser `usuario_destino_id`) y hay que ser explícito.
    campos = [
        "activo", "host", "puerto", "usar_ssl", "usuario", "password_cifrado",
        "carpeta", "remitentes_permitidos", "asunto_contiene", "max_tamano_mb",
        "asunto_estado_diario", "asunto_movimientos", "asunto_audiencias", "rut",
        "hora_ejecucion", "marcar_como_leido", "ultima_ejecucion", "ultimo_resultado",
    ]
    campos = [c for c in campos if c in columnas_origen]

    lista = ", ".join(campos)
    marcadores = ", ".join(f":{c}" for c in campos)
    valores = {c: fila[c] for c in campos}
    # El dueño de lo importado era `usuario_id` y sigue siendo el mismo usuario,
    # que ahora vive en la base del cliente: por eso la columna dejó de tener
    # ForeignKey y se llama `usuario_destino_id`.
    valores["cliente_id"] = cliente_id
    valores["usuario_destino_id"] = fila.get("usuario_id")

    with engine_maestro.begin() as conn:
        if _contar(conn, "configuracion_correo") > 0:
            logger.info("La casilla del cliente ya estaba configurada; se salta")
            return
        conn.execute(
            text(
                f"INSERT INTO configuracion_correo (cliente_id, usuario_destino_id, {lista}) "
                f"VALUES (:cliente_id, :usuario_destino_id, {marcadores})"
            ),
            valores,
        )
    logger.info("Casilla '%s' migrada como casilla del cliente", fila["usuario"])


# ── Orquestación ──────────────────────────────────────────


def migrar(nombre: str, rut: str, correo: str | None, ensayo: bool) -> int:
    _verificar_origen(ensayo)

    # 1. Apartar lo que choca, ANTES de crear el esquema nuevo.
    with engine_maestro.begin() as conn:
        _apartar(conn, TABLAS_QUE_CHOCAN, ensayo)

    if ensayo:
        # Sin el renombre no se puede crear el esquema nuevo ni la base del
        # cliente, así que el ensayo se limita a contar lo que se movería.
        with engine_maestro.connect() as conn:
            for tabla in TABLAS_A_COPIAR:
                if _tabla_existe(conn, tabla):
                    logger.info("[ensayo] %s: %d filas", tabla, _contar(conn, tabla))
            if _tabla_existe(conn, "usuario"):
                logger.info("[ensayo] usuario: %d filas", _contar(conn, "usuario"))
        logger.info("[ensayo] terminado: no se escribió nada")
        return 0

    # 2. Esquema nuevo de la base principal.
    logger.info("Creando el esquema de la base principal...")
    aplicar_esquema_maestra(engine_maestro)

    # 3. El cliente y su base.
    cliente = _crear_cliente(nombre, rut, correo)
    logger.info("Creando la base de datos %s...", cliente.base_datos)
    aprovisionamiento_service.aprovisionar(cliente.guid)
    _marcar_aprovisionado(cliente.cliente_id)

    engine_tenant = crear_engine_tenant(cliente.base_datos)
    try:
        # 4. Los datos: primero los usuarios, que es a quienes apunta el resto.
        _migrar_usuarios(engine_tenant, ensayo=False)
        _limpiar_jurisdicciones_sembradas(engine_tenant)
        total = 0
        for tabla in TABLAS_A_COPIAR:
            total += _copiar_tabla(engine_tenant, tabla, ensayo=False)
    finally:
        engine_tenant.dispose()

    # 5. La casilla de ingesta.
    _migrar_casilla(cliente.cliente_id, ensayo=False)

    # 6. Apartar lo operativo de la base principal: ya está copiado, y dejarlo
    #    a la vista invita a que alguien lo consulte creyendo que es lo vigente.
    with engine_maestro.begin() as conn:
        _apartar(conn, TABLAS_A_COPIAR, ensayo=False)

    logger.info(
        "Migración terminada: %d filas operativas en la base %s del cliente '%s'. "
        "Lo viejo quedó en la base principal con el prefijo %s; revise y elimine a mano.",
        total,
        cliente.base_datos,
        cliente.nombre,
        PREFIJO_LEGACY,
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convierte la instalación de una sola base en el primer cliente"
    )
    parser.add_argument("--nombre", required=True, help="Nombre del estudio")
    parser.add_argument("--rut", required=True, help="RUT con que iniciará sesión, ej. 76543210-K")
    parser.add_argument("--correo", default=None, help="Correo de contacto del estudio")
    parser.add_argument(
        "--ensayo",
        action="store_true",
        help="Recorre y cuenta sin escribir nada",
    )
    args = parser.parse_args()

    setup_logging()
    try:
        rut = normalizar_rut(args.rut)
    except ValueError as e:
        logger.error("RUT inválido: %s", e)
        return 1

    try:
        return migrar(args.nombre, rut, args.correo, args.ensayo)
    except MigracionAbortada as e:
        logger.error("Migración abortada: %s", e)
        return 1
    except Exception:
        logger.exception("La migración falló")
        return 1


if __name__ == "__main__":
    sys.exit(main())
