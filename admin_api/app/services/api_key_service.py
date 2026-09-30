"""Emisión y revocación de API keys de un cliente.

Cruza las dos bases igual que `AdminClienteService`: la key vive en la base
principal y su usuario de integración en la del cliente. Cada método abre la
sesión de tenant que necesita y la cierra.

**Cada key tiene su propio usuario de integración.** Sería más corto compartir
uno por cliente, pero entonces la bitácora y las columnas `usuario_id` de las
causas dirían "el sistema externo" sin poder distinguir cuál de dos keys hizo
qué, ni cortar una sin cortar la otra.
"""

import logging
import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.api_key import generar_key, prefijos_de_escritura
from app.core.config import settings
from app.core.database import sesion_tenant
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.security import get_password_hash
from app.models.maestra.api_key import ApiKey
from app.models.maestra.cliente import Cliente
from app.models.usuario import Usuario
from admin_api.app.schemas.api_key import (
    ApiKeyCreadaResponse,
    ApiKeyCreate,
    ApiKeyResponse,
    ApiKeyUpdate,
)
from admin_api.app.services.cliente_service import ClienteService

logger = logging.getLogger(__name__)

# Apellido de las cuentas de integración, para reconocerlas en cualquier listado
# de usuarios aunque no se mire la columna `es_integracion`.
APELLIDO_INTEGRACION = "(API)"


class ApiKeyService:
    def __init__(self, db_maestra: Session):
        self.db = db_maestra
        self.clientes = ClienteService(db_maestra)

    def _cliente_operativo(self, cliente_id: int) -> Cliente:
        cliente = self.clientes.obtener_entidad(cliente_id)
        if cliente.estado_aprovisionamiento != Cliente.APROV_LISTO:
            raise BadRequestException(
                "La base de datos del cliente no está lista. "
                "Reintente el aprovisionamiento antes de emitir una API key."
            )
        return cliente

    def _obtener(self, cliente_id: int, key_id: int) -> ApiKey:
        # Filtra por cliente: una key de otro cliente no se toca por el path de
        # este, aunque el id exista.
        fila = self.db.get(ApiKey, key_id)
        if fila is None or fila.cliente_id != cliente_id:
            raise NotFoundException("API key no encontrada")
        return fila

    @staticmethod
    def a_response(fila: ApiKey) -> ApiKeyResponse:
        return ApiKeyResponse(
            id=fila.id,
            cliente_id=fila.cliente_id,
            nombre=fila.nombre,
            prefijo=fila.prefijo,
            usuario_id=fila.usuario_id,
            permite_escritura=fila.permite_escritura,
            prefijos_escritura=list(prefijos_de_escritura(fila)) if fila.permite_escritura else [],
            limite_por_minuto=fila.limite_por_minuto,
            activa=fila.activa and fila.revocada_en is None,
            fecha_creacion=fila.fecha_creacion,
            expira_en=fila.expira_en,
            revocada_en=fila.revocada_en,
            ultimo_uso=fila.ultimo_uso,
            ultimo_ip=fila.ultimo_ip,
        )

    def listar(self, cliente_id: int) -> list[ApiKeyResponse]:
        self.clientes.obtener_entidad(cliente_id)
        filas = (
            self.db.query(ApiKey)
            .filter(ApiKey.cliente_id == cliente_id)
            .order_by(ApiKey.id.desc())
            .all()
        )
        return [self.a_response(f) for f in filas]

    def crear(
        self, cliente_id: int, datos: ApiKeyCreate, creada_por: int | None = None
    ) -> ApiKeyCreadaResponse:
        cliente = self._cliente_operativo(cliente_id)
        key, prefijo, key_hash = generar_key()

        usuario_id = self._crear_usuario_integracion(cliente, datos.nombre, prefijo)
        try:
            fila = ApiKey(
                cliente_id=cliente.cliente_id,
                usuario_id=usuario_id,
                nombre=datos.nombre.strip(),
                prefijo=prefijo,
                key_hash=key_hash,
                permite_escritura=datos.permite_escritura,
                prefijos_escritura=(
                    ",".join(datos.prefijos_escritura) if datos.prefijos_escritura else None
                ),
                limite_por_minuto=datos.limite_por_minuto or settings.API_KEY_LIMITE_POR_MINUTO,
                creada_por=creada_por,
                expira_en=datos.expira_en,
            )
            self.db.add(fila)
            self.db.commit()
            self.db.refresh(fila)
        except Exception:
            # Sin la fila de la key, el usuario de integración quedaría como un
            # usuario activo que nadie usa y que nadie sabe de dónde salió.
            self.db.rollback()
            self._desactivar_usuario(cliente, usuario_id)
            raise

        logger.info(
            "API key %s ('%s') emitida para el cliente %s (escritura=%s)",
            prefijo, fila.nombre, cliente.guid, fila.permite_escritura,
        )
        return ApiKeyCreadaResponse(**self.a_response(fila).model_dump(), key=key)

    def actualizar(self, cliente_id: int, key_id: int, datos: ApiKeyUpdate) -> ApiKeyResponse:
        fila = self._obtener(cliente_id, key_id)
        if datos.nombre is not None:
            fila.nombre = datos.nombre.strip()
        if datos.limite_por_minuto is not None:
            fila.limite_por_minuto = datos.limite_por_minuto
        self.db.commit()
        self.db.refresh(fila)
        return self.a_response(fila)

    def revocar(self, cliente_id: int, key_id: int) -> ApiKeyResponse:
        """Corta la key YA: `autenticar` la consulta en cada request, así que no
        hay un token de larga vida que siga valiendo. Es idempotente."""
        fila = self._obtener(cliente_id, key_id)
        if fila.revocada_en is None:
            fila.activa = False
            fila.revocada_en = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(fila)
            cliente = self.clientes.obtener_entidad(cliente_id)
            # El usuario se desactiva, no se borra: las causas que cargó y la
            # bitácora lo referencian.
            self._desactivar_usuario(cliente, fila.usuario_id)
            logger.info("API key %s revocada (cliente %s)", fila.prefijo, cliente.guid)
        return self.a_response(fila)

    # ── Usuario de integración (base del cliente) ─────────

    @staticmethod
    def _crear_usuario_integracion(cliente: Cliente, nombre: str, prefijo: str) -> int:
        with sesion_tenant(cliente.guid) as db_tenant:
            usuario = Usuario(
                # Clave aleatoria que nadie conoce ni se guarda: la cuenta no
                # puede iniciar sesión. `AuthClienteService.login` además la
                # rechaza por `es_integracion`.
                password_hash=get_password_hash(secrets.token_urlsafe(48)),
                nombre=nombre.strip()[:200],
                apellido=APELLIDO_INTEGRACION,
                activo=True,
                debe_cambiar_password=False,
                es_integracion=True,
            )
            # Por los setters: cifran y calculan el hash de búsqueda. El
            # prefijo de la key hace único el nombre y deja ver cuál es cuál.
            usuario.usuario = f"api-{prefijo.lower()}"
            db_tenant.add(usuario)
            db_tenant.commit()
            db_tenant.refresh(usuario)
            return usuario.id

    @staticmethod
    def _desactivar_usuario(cliente: Cliente, usuario_id: int) -> None:
        try:
            with sesion_tenant(cliente.guid) as db_tenant:
                usuario = db_tenant.get(Usuario, usuario_id)
                if usuario is not None:
                    usuario.activo = False
                    db_tenant.commit()
        except Exception as e:  # noqa: BLE001 — la key ya quedó revocada; esto es limpieza
            logger.warning(
                "No se pudo desactivar el usuario de integración %s del cliente %s: %s",
                usuario_id, cliente.guid, e,
            )
