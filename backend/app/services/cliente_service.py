"""Alta y administración de clientes. Solo lo usa el administrador del sistema.

Crear un cliente son dos cosas que hay que dejar consistentes: la fila en la
base principal y la base de datos propia con sus 13 tablas. No se pueden hacer
en una sola transacción —`CREATE DATABASE` no corre dentro de una— así que el
orden importa: primero se guarda el cliente en estado `pendiente`, después se
crea la base, y solo si eso resultó queda en `listo`.

Al revés (crear la base y después la fila) un fallo dejaba una base huérfana
que nadie sabía de quién era. Así, un fallo deja el cliente marcado en `error`
con el motivo, visible en la consola y **reintentable**, que es la única forma
de que un alta a medias no quede invisible.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import (
    crear_engine_tenant,
    nombre_base_tenant,
    olvidar_engine_tenant,
    sesion_tenant,
)
from app.core.exceptions import ConflictException, NotFoundException
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.configuracion_correo_repository import ConfiguracionCorreoRepository
from app.repositories.configuracion_sistema_repository import ConfiguracionSistemaRepository
from app.schemas.cliente import (
    AprovisionamientoEstado,
    ClienteCreate,
    ClienteResponse,
    ClienteUpdate,
)
from app.services import aprovisionamiento_service

logger = logging.getLogger(__name__)


class ClienteService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.repo = ClienteRepository(db_maestra)
        self.config_sistema = ConfiguracionSistemaRepository(db_maestra)

    # ── Alta ──────────────────────────────────────────────

    def crear(self, datos: ClienteCreate) -> ClienteResponse:
        if self.repo.find_by_rut(datos.rut):
            raise ConflictException(f"Ya existe un cliente con el RUT {datos.rut}")

        guid = str(uuid.uuid4())
        cliente = Cliente(
            nombre=datos.nombre.strip(),
            guid=guid,
            base_datos=nombre_base_tenant(guid),
            estado_aprovisionamiento=Cliente.APROV_EN_COLA,
            activo=True,
        )
        # Por los setters del modelo: cifran y calculan el hash de búsqueda.
        cliente.rut = datos.rut
        cliente.correo = datos.correo
        self.repo.save(cliente)

        self._aprovisionar(cliente)
        return self.a_response(cliente)

    def _aprovisionar(self, cliente: Cliente) -> None:
        """Crea la base del cliente y deja registrado cómo terminó.

        Marca `creando` ANTES de empezar y lo confirma: crear la base tarda
        segundos y el polling de la consola tiene que poder ver que está en
        curso, no un estado congelado en `en_cola`.

        No relanza la excepción: el cliente ya está guardado y lo que
        corresponde es dejarlo en `error` con el motivo para poder reintentar,
        no reventar el request y perder el rastro de lo que pasó.
        """
        cliente.estado_aprovisionamiento = Cliente.APROV_CREANDO
        self.repo.save(cliente)
        try:
            aprovisionamiento_service.aprovisionar(cliente.guid)
        except Exception as e:
            cliente.estado_aprovisionamiento = Cliente.APROV_ERROR
            cliente.error_aprovisionamiento = str(e)[:2000]
            self.repo.save(cliente)
            logger.exception("Falló el aprovisionamiento del cliente %s", cliente.guid)
            return

        cliente.estado_aprovisionamiento = Cliente.APROV_LISTO
        cliente.error_aprovisionamiento = None
        cliente.fecha_aprovisionamiento = datetime.now(timezone.utc)
        self.repo.save(cliente)

        # Casilla por defecto del cliente: <guid>@<dominio>. Queda creada e
        # inactiva; falta la contraseña IMAP para poder activarla.
        config = ConfiguracionCorreoRepository(self.db).get_or_create(cliente.cliente_id)
        if not config.usuario:
            config.usuario = self.inbox_por_defecto(cliente)
            self.db.commit()

        logger.info(
            "Cliente '%s' aprovisionado (guid=%s, base=%s)",
            cliente.nombre,
            cliente.guid,
            cliente.base_datos,
        )

    def reintentar_aprovisionamiento(self, cliente_id: int) -> AprovisionamientoEstado:
        """Vuelve a intentar el alta de la base. Es idempotente: si la base ya
        existe no la vuelve a crear, solo aplica el esquema que falte."""
        cliente = self.obtener_entidad(cliente_id)
        self._aprovisionar(cliente)
        return self.estado_aprovisionamiento(cliente_id)

    def estado_aprovisionamiento(self, cliente_id: int) -> AprovisionamientoEstado:
        """Estado guardado MÁS una comprobación real contra el servidor.

        Devolver solo la columna diría lo que creímos que pasó. Cuando dice
        `listo`, acá se verifica que la base exista y tenga sus tablas: un alta
        que quedó a medias se ve igual de bien en la columna e igual de mal en
        la práctica.
        """
        from app.core.esquema import TABLAS_TENANT

        cliente = self.obtener_entidad(cliente_id)
        estado = cliente.estado_aprovisionamiento
        detalle = cliente.error_aprovisionamiento

        if estado == Cliente.APROV_LISTO:
            try:
                if not aprovisionamiento_service.base_existe(cliente.base_datos):
                    estado = Cliente.APROV_ERROR
                    detalle = f"La base {cliente.base_datos} no existe en el servidor"
                else:
                    tablas = self._contar_tablas(cliente.base_datos)
                    if tablas < len(TABLAS_TENANT):
                        estado = Cliente.APROV_ERROR
                        detalle = (
                            f"La base tiene {tablas} tablas de las "
                            f"{len(TABLAS_TENANT)} esperadas"
                        )
            except Exception as e:
                logger.warning(
                    "No se pudo verificar la base del cliente %s: %s", cliente.guid, e
                )
                estado = Cliente.APROV_ERROR
                detalle = "No se pudo verificar la base de datos del cliente"

        return AprovisionamientoEstado(
            cliente_id=cliente.cliente_id, estado=estado, detalle=detalle
        )

    @staticmethod
    def _contar_tablas(nombre_base: str) -> int:
        """Cuenta las tablas del esquema público de la base del cliente.

        El COUNT lo hace PostgreSQL: traer los nombres para contarlos en Python
        sería pedir filas para nada.
        """
        engine = crear_engine_tenant(nombre_base)
        try:
            with engine.connect() as conn:
                return conn.execute(
                    text(
                        "SELECT COUNT(*) FROM information_schema.tables "
                        "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
                    )
                ).scalar()
        finally:
            engine.dispose()

    # ── Ficha ─────────────────────────────────────────────

    def listar(self) -> list[ClienteResponse]:
        return [self.a_response(c) for c in self.repo.find_all()]

    def obtener(self, cliente_id: int) -> ClienteResponse:
        return self.a_response(self.obtener_entidad(cliente_id))

    def actualizar(self, cliente_id: int, datos: ClienteUpdate) -> ClienteResponse:
        cliente = self.obtener_entidad(cliente_id)
        cliente.nombre = datos.nombre.strip()
        cliente.correo = datos.correo

        # Suspender desde la ficha tiene que hacer lo mismo que el botón de
        # suspender, o quedarían conexiones abiertas contra un cliente apagado.
        if cliente.activo and not datos.activo:
            self.suspender(cliente_id)
        cliente.activo = datos.activo

        self.repo.save(cliente)
        logger.info("Ficha del cliente %s actualizada", cliente.guid)
        return self.a_response(cliente)

    # ── Suspensión ────────────────────────────────────────

    def suspender(self, cliente_id: int) -> ClienteResponse:
        """Suspende un cliente. **No borra nada.**

        Apaga la bandera y cierra el pool contra su base. Con ella apagada, el
        login de sus usuarios falla y los jobs programados lo saltan; su base
        sigue ahí, intacta.

        Acá no hay ni habrá un DROP DATABASE: dar de baja un cliente es una
        decisión comercial con respaldos de por medio, no un endpoint.
        """
        cliente = self.obtener_entidad(cliente_id)
        cliente.activo = False
        self.repo.save(cliente)
        # Solo cierra el pool: sin esto quedarían conexiones abiertas contra un
        # cliente que ya no debería atender a nadie.
        olvidar_engine_tenant(cliente.guid)
        logger.info("Cliente %s suspendido", cliente.guid)
        return self.a_response(cliente)

    def reactivar(self, cliente_id: int) -> ClienteResponse:
        """Vuelve a encender la bandera. No hay que reaprovisionar nada: el
        cliente sigue con su información como la dejó."""
        cliente = self.obtener_entidad(cliente_id)
        cliente.activo = True
        self.repo.save(cliente)
        logger.info("Cliente %s reactivado", cliente.guid)
        return self.a_response(cliente)

    # ── Apoyo ─────────────────────────────────────────────

    def obtener_entidad(self, cliente_id: int) -> Cliente:
        cliente = self.repo.find_by_id(cliente_id)
        if not cliente:
            raise NotFoundException("Cliente no encontrado")
        return cliente

    def inbox_por_defecto(self, cliente: Cliente) -> str:
        """`<guid>@<dominio>`, con el dominio que fije la configuración del
        sistema (settings solo aporta la semilla de esa fila)."""
        return f"{cliente.guid}@{self.config_sistema.get_or_create().dominio_inbox}"

    def dias_retencion_efectivos(self, cliente: Cliente) -> int:
        """La política del cliente si tiene override; si no, la global."""
        if cliente.dias_retencion_log:
            return cliente.dias_retencion_log
        return self.config_sistema.get_or_create().dias_retencion_log

    def total_usuarios(self, cliente: Cliente) -> int:
        """Usuarios activos del cliente, contados EN SU BASE y con COUNT.

        Devuelve 0 si su base no está lista o no responde: es un dato de apoyo
        y no puede tumbar la ficha ni el listado.
        """
        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            return 0
        try:
            with sesion_tenant(cliente.guid) as db:
                return db.execute(text("SELECT COUNT(*) FROM usuario WHERE activo")).scalar() or 0
        except Exception as e:
            logger.warning(
                "No se pudo contar los usuarios del cliente %s: %s", cliente.guid, e
            )
            return 0

    def a_response(self, cliente: Cliente) -> ClienteResponse:
        return ClienteResponse(
            id=cliente.cliente_id,
            nombre=cliente.nombre,
            # Descifrados por las propiedades del modelo.
            rut=cliente.rut,
            correo=cliente.correo,
            guid=cliente.guid,
            inbox=self.inbox_por_defecto(cliente),
            activo=cliente.activo,
            fecha_creacion=cliente.fecha_creacion,
            aprovisionamiento=cliente.estado_aprovisionamiento,
            aprovisionamiento_detalle=cliente.error_aprovisionamiento,
            total_usuarios=self.total_usuarios(cliente),
        )
