from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import settings
from app.core.crypto import cifrar, descifrar
from app.core.database import BaseMaestra
from app.core.hash_busqueda import hash_rut, normalizar_rut


class Cliente(BaseMaestra):
    """Un estudio contratante. Vive en la base principal y es lo único que
    relaciona un RUT con la base de datos donde están sus causas.

    `rut` y `correo` van cifrados (Fernet, reversible: hay que poder mostrarlos
    y escribirle al cliente). Como Fernet no es determinista, el RUT —que es la
    credencial con la que se identifica el cliente al iniciar sesión— lleva
    además `rut_hash`, un HMAC con UNIQUE por donde sí se puede buscar.

    Las propiedades `rut` y `correo` cifran y descifran solas: el resto del
    código trabaja con el valor en claro y nunca toca las columnas `_cifrado`.
    """

    __tablename__ = "cliente"

    cliente_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)

    # Cifrados: el contenido en claro no queda en un respaldo de la base.
    rut_cifrado: Mapped[str] = mapped_column("rut", String(255), nullable=False)
    correo_cifrado: Mapped[Optional[str]] = mapped_column("correo", String(500))

    # Por acá se busca el cliente en el login de 3 campos. UNIQUE porque un RUT
    # identifica a un solo cliente: dos filas con el mismo RUT harían ambiguo
    # a qué base entrar.
    rut_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)

    # Identificador público del cliente y nombre de su base de datos.
    guid: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    # Nombre real de la base. Se guarda en vez de derivarlo del guid en cada
    # conexión para que cambiar TENANT_DB_PREFIJO no deje inalcanzables a los
    # clientes ya creados.
    base_datos: Mapped[str] = mapped_column(String(63), nullable=False, unique=True)

    # Override de la política de permanencia de log_actividades para ESTE
    # cliente. Nulo = manda el valor global (configuracion_sistema), que es lo
    # normal: la política es de plataforma y esto es la excepción.
    dias_retencion_log: Mapped[Optional[int]] = mapped_column(Integer)

    # ── Estado del aprovisionamiento de su base de datos ──
    # Crear una base es una operación larga que puede fallar a la mitad (el rol
    # sin permiso de CREATEDB, el servidor sin espacio). Sin este estado, un
    # alta a medias se veía igual que una exitosa y el cliente quedaba con una
    # base incompleta a la que nadie podía entrar.
    APROV_EN_COLA = "en_cola"
    APROV_CREANDO = "creando"
    APROV_LISTO = "listo"
    APROV_ERROR = "error"

    estado_aprovisionamiento: Mapped[str] = mapped_column(
        String(20), default=APROV_EN_COLA, server_default=APROV_EN_COLA
    )
    # Último error del aprovisionamiento, para mostrarlo en la consola y poder
    # reintentar con información.
    error_aprovisionamiento: Mapped[Optional[str]] = mapped_column(Text)
    fecha_aprovisionamiento: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── Acceso en claro a los campos cifrados ──

    @property
    def rut(self) -> str:
        return descifrar(self.rut_cifrado)

    @rut.setter
    def rut(self, valor: str) -> None:
        # Se normaliza antes de cifrar para que lo que se muestre y lo que se
        # hashea sean el mismo RUT, escrito de una sola forma.
        normalizado = normalizar_rut(valor)
        self.rut_cifrado = cifrar(normalizado)
        self.rut_hash = hash_rut(normalizado)

    @property
    def correo(self) -> Optional[str]:
        return descifrar(self.correo_cifrado) if self.correo_cifrado else None

    @correo.setter
    def correo(self, valor: Optional[str]) -> None:
        self.correo_cifrado = cifrar(valor.strip()) if valor else None

    @property
    def inbox(self) -> str:
        """Casilla por defecto del cliente: `<guid>@temposoft.cl`.

        Usa el dominio de la configuración de despliegue. La fuente de verdad
        es `configuracion_sistema.dominio_inbox`, que el administrador puede
        cambiar sin redesplegar: para eso está `ClienteService.inbox_por_defecto`,
        que es lo que debe usar todo lo que tenga una sesión a mano. Esto queda
        solo para cuando no hay ninguna (ej. un log o un script suelto).
        """
        return f"{self.guid}@{settings.INBOX_DOMINIO}"
