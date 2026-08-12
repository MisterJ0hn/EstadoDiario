"""Alta y administración de clientes. Solo lo usa el administrador del sistema.

Crear un cliente son dos cosas que hay que dejar consistentes: la fila en la
base principal y la base de datos propia con sus 14 tablas. No se pueden hacer
en una sola transacción —`CREATE DATABASE` no corre dentro de una— así que el
orden importa: primero se guarda el cliente en estado `pendiente`, después se
crea la base, y solo si eso resultó queda en `listo`.

Al revés (crear la base y después la fila) un fallo dejaba una base huérfana
que nadie sabía de quién era. Así, un fallo deja el cliente marcado en `error`
con el motivo, visible en la consola y **reintentable**, que es la única forma
de que un alta a medias no quede invisible.
"""

import base64
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
from app.core.estados_causa import sql_vigente
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.hash_busqueda import normalizar_rut
from app.models.maestra.cliente import Cliente
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.configuracion_correo_repository import ConfiguracionCorreoRepository
from app.repositories.configuracion_sistema_repository import ConfiguracionSistemaRepository
from admin_api.app.schemas.cliente import (
    ClienteLogoUpdate,
    AprovisionamientoEstado,
    ClienteCreate,
    ClienteResponse,
    ClienteUpdate,
)
from app.services import aprovisionamiento_service

logger = logging.getLogger(__name__)

# Los dos números que la consola muestra de cada cliente, en una sola consulta
# contra su base. Las causas activas son las de MATERIA vigentes del último
# archivo de causas: es la cartera que el estudio ve en "Mis Causas" y la misma
# que se factura a $1 (ver `app.services.facturacion_service`).
_SQL_RESUMEN_CLIENTE = text(
    f"""
    SELECT
        (SELECT COUNT(*) FROM usuario WHERE activo) AS usuarios_activos,
        (SELECT COUNT(*) FROM causa
          WHERE estado_diario_origen_id = (
                SELECT id FROM estado_diario_origen
                 WHERE tipo = 'causas'
                 ORDER BY fecha DESC, id DESC
                 LIMIT 1)
            AND {sql_vigente('estado_causa')})      AS causas_activas
    """
)


class ClienteService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.repo = ClienteRepository(db_maestra)
        self.config_sistema = ConfiguracionSistemaRepository(db_maestra)

    # ── Alta ──────────────────────────────────────────────

    def crear(self, datos: ClienteCreate) -> ClienteResponse:
        """Crea el cliente, aprovisiona su base y siembra sus usuarios.

        Es UNA operación de cara al usuario aunque por dentro sean tres pasos
        contra sistemas distintos (la base principal, el servidor PostgreSQL y
        la base recién creada). No hay transacción que abarque los tres —
        `CREATE DATABASE` no es transaccional—, así que lo que se hace es
        fallar temprano: la validación de los usuarios ocurre en el esquema,
        antes de crear nada.

        Si un usuario falla igual (un correo que ya estaba en otra base, por
        ejemplo), el cliente queda creado y la respuesta dice cuáles no se
        crearon. Se prefiere eso a deshacer todo: la base ya existe y borrarla
        automáticamente es peor negocio que dejar un cliente al que hay que
        agregarle un usuario a mano.
        """
        if self.repo.find_by_rut(datos.rut):
            raise ConflictException(f"Ya existe un cliente con el RUT {datos.rut}")

        guid = str(uuid.uuid4())
        cliente = Cliente(
            nombre=datos.nombre.strip(),
            guid=guid,
            base_datos=nombre_base_tenant(guid),
            estado_aprovisionamiento=Cliente.APROV_EN_COLA,
            tipo=datos.tipo,
            cal=datos.cal,
            activo=True,
        )
        # Por los setters del modelo: cifran y calculan el hash de búsqueda.
        cliente.rut = datos.rut
        cliente.correo = datos.correo
        self.repo.save(cliente)

        self._aprovisionar(cliente)

        respuesta = self.a_response(cliente)
        if datos.usuarios:
            creados, con_error = self._sembrar_usuarios(cliente, datos.usuarios)
            respuesta.usuarios_creados = creados
            respuesta.usuarios_con_error = con_error
            respuesta.total_usuarios = creados
        return respuesta

    def _sembrar_usuarios(self, cliente: Cliente, usuarios) -> tuple[int, list[str]]:
        """Crea los usuarios en la base recién aprovisionada.

        Devuelve (cuántos se crearon, qué falló). No lanza: el cliente ya
        existe y lo útil es decir exactamente cuáles quedaron fuera.
        """
        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            return 0, [
                "No se creó ningún usuario: la base de datos del cliente no quedó lista."
            ]

        # Import local: `admin_cliente_service` importa este módulo, y al revés
        # sería un ciclo.
        from admin_api.app.services.admin_cliente_service import AdminClienteService
        from app.schemas.usuario import UsuarioAdminCreate

        servicio = AdminClienteService(self.db)
        creados = 0
        con_error: list[str] = []

        for u in usuarios:
            try:
                servicio.crear_usuario(
                    cliente.cliente_id,
                    UsuarioAdminCreate(
                        username=u.username,
                        password=u.password,
                        email=u.email,
                        nombre=u.nombre,
                        apellido=u.apellido,
                        telefono=u.telefono,
                        ruts=u.ruts,
                    ),
                )
                creados += 1
            except Exception as e:
                logger.exception(
                    "No se pudo crear el usuario '%s' del cliente %s", u.username, cliente.guid
                )
                con_error.append(f"{u.username}: {e}")

        logger.info(
            "Cliente %s sembrado con %d/%d usuarios", cliente.guid, creados, len(usuarios)
        )
        return creados, con_error

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

        # Datos de la cabecera de la factura. Se guardan vacíos como
        # NULL: una cadena vacía haría que la orden imprimiera la etiqueta con
        # la línea en blanco al lado, que se lee como un dato perdido.
        cliente.giro = (datos.giro or "").strip() or None
        cliente.direccion = (datos.direccion or "").strip() or None
        cliente.comuna = (datos.comuna or "").strip() or None
        cliente.ciudad = (datos.ciudad or "").strip() or None

        # El RUT es la credencial de login del estudio y tiene UNIQUE por
        # `rut_hash`: si ya es de otro cliente, el login quedaría ambiguo (no
        # se sabría a qué base entrar), así que se rechaza antes de guardar.
        if datos.rut and normalizar_rut(datos.rut) != normalizar_rut(cliente.rut):
            existente = self.repo.find_by_rut(datos.rut)
            if existente and existente.cliente_id != cliente.cliente_id:
                raise ConflictException(f"Ya existe un cliente con el RUT {datos.rut}")
            # El setter normaliza, cifra y recalcula el hash de búsqueda.
            cliente.rut = datos.rut
            logger.info("RUT del cliente %s cambiado", cliente.guid)

        # El CAL solo aplica a los estudios; en un patrocinador siempre es 1.
        if datos.cal is not None and not cliente.es_patrocinador:
            activos = self.total_usuarios(cliente)
            if datos.cal < activos:
                raise BadRequestException(
                    f"El cliente tiene {activos} usuarios activos: no se puede dejar "
                    f"el CAL en {datos.cal}. Desactive usuarios primero."
                )
            cliente.cal = datos.cal

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
        # Esta suspensión la decidió una persona, así que **no** lleva la marca
        # de mora: sin ella, pagar una factura con Webpay no lo reactiva. Se
        # limpia en vez de dejarla como estaba porque un cliente que el job
        # suspendió y el operador volvió a suspender a mano ya es un caso del
        # operador. Ver `PagoService._reactivar_si_corresponde`.
        cliente.suspendido_por_mora = False
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
        # Queda sin deuda pendiente a efectos de la marca: si el job vuelve a
        # suspenderlo, la escribirá de nuevo. Dejarla puesta en un cliente
        # activo no rompe nada hoy, pero es un dato que miente.
        cliente.suspendido_por_mora = False
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
        return self._resumen_tenant(cliente)[0]

    def _resumen_tenant(self, cliente: Cliente) -> tuple[int, int]:
        """(usuarios activos, causas activas) en UNA sola consulta a su base.

        Van juntos porque los pide el mismo lugar —cada fila del listado de
        clientes— y separarlos duplicaría la cantidad de conexiones abiertas
        contra bases distintas: con cincuenta clientes son cincuenta viajes de
        más por cada carga de la pantalla.

        Las causas activas son la cartera VIGENTE del último archivo de causas
        cargado. Sin acotar al último archivo, un estudio que cargó el Excel
        tres veces aparecería con el triple de causas de las que tiene.

        `(0, 0)` si la base no está lista o no responde: es un dato de apoyo y
        no puede tumbar la ficha ni el listado.
        """
        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            return 0, 0
        try:
            with sesion_tenant(cliente.guid) as db:
                fila = db.execute(_SQL_RESUMEN_CLIENTE).first()
        except Exception as e:
            logger.warning(
                "No se pudo consultar la base del cliente %s: %s", cliente.guid, e
            )
            return 0, 0
        if fila is None:
            return 0, 0
        return int(fila[0] or 0), int(fila[1] or 0)

    # Tope del logo YA EN BASE64. 400 KB de base64 son ~300 KB de imagen: de
    # sobra para un logo y poco para que moleste, porque este dato viaja en la
    # respuesta del login de cada usuario del estudio.
    MAX_LOGO_BASE64 = 400 * 1024

    MIMES_LOGO = ("image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml")

    def guardar_logo(self, cliente_id: int, datos: ClienteLogoUpdate) -> ClienteResponse:
        """Guarda o quita el logo del estudio."""
        cliente = self.obtener_entidad(cliente_id)

        if not datos.logo:
            cliente.logo = None
            cliente.logo_mime = None
            self.repo.save(cliente)
            logger.info("Logo del cliente %s eliminado", cliente.guid)
            return self.a_response(cliente)

        mime = (datos.logo_mime or "").lower().strip()
        if mime not in self.MIMES_LOGO:
            raise BadRequestException(
                f"Formato de imagen no admitido: {mime or 'desconocido'}. "
                f"Use PNG, JPG, GIF, WEBP o SVG."
            )
        if len(datos.logo) > self.MAX_LOGO_BASE64:
            raise BadRequestException(
                "La imagen es demasiado grande. El máximo son unos 300 KB."
            )
        # Que sea base64 de verdad: si no, el <img> del estudio quedaría roto y
        # el error aparecería en su pantalla, no acá.
        try:
            base64.b64decode(datos.logo, validate=True)
        except Exception as e:
            raise BadRequestException("La imagen no llegó en base64 válido") from e

        cliente.logo = datos.logo
        cliente.logo_mime = mime
        self.repo.save(cliente)
        logger.info("Logo del cliente %s actualizado (%s)", cliente.guid, mime)
        return self.a_response(cliente)

    def a_response(self, cliente: Cliente) -> ClienteResponse:
        usuarios, causas_activas = self._resumen_tenant(cliente)
        return ClienteResponse(
            id=cliente.cliente_id,
            nombre=cliente.nombre,
            # Descifrados por las propiedades del modelo.
            rut=cliente.rut,
            correo=cliente.correo,
            tipo=cliente.tipo,
            cal=cliente.cal,
            giro=cliente.giro,
            direccion=cliente.direccion,
            comuna=cliente.comuna,
            ciudad=cliente.ciudad,
            logo=cliente.logo_data_uri,
            guid=cliente.guid,
            inbox=self.inbox_por_defecto(cliente),
            activo=cliente.activo,
            fecha_creacion=cliente.fecha_creacion,
            aprovisionamiento=cliente.estado_aprovisionamiento,
            aprovisionamiento_detalle=cliente.error_aprovisionamiento,
            total_usuarios=usuarios,
            causas_activas=causas_activas,
        )
