from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.crypto import cifrar, descifrar
from app.core.database import BaseTenant
from app.core.hash_busqueda import hash_busqueda


class Usuario(BaseTenant):
    """Usuario de un cliente. Vive en la base del cliente, no en la principal.

    No confundir con `app.models.maestra.usuario_admin.UsuarioAdmin`: ése
    administra el sistema y crea clientes; éste opera causas. Ambas tablas se
    llaman `usuario` y están en bases distintas, por eso van sobre metadatos
    distintos.

    `usuario`, `correo` y `telefono` se guardan **cifrados** (Fernet,
    reversible: hay que poder mostrarlos y escribirle a la persona). Como
    Fernet no es determinista, no se puede buscar por la columna cifrada: el
    nombre de usuario —que es la credencial del login— y el correo —que tiene
    que ser único— llevan además su `*_hash` HMAC con UNIQUE, y por ahí se
    busca.

    Las propiedades de más abajo cifran y descifran solas, así que el resto del
    código sigue trabajando con `usuario.usuario`, `usuario.correo` y
    `usuario.telefono` en claro.
    """

    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Columnas cifradas. El nombre Python lleva el sufijo para que quede claro
    # que ahí NO hay texto legible; el nombre en la base es el pedido.
    usuario_cifrado: Mapped[str] = mapped_column("usuario", String(500), nullable=False)
    correo_cifrado: Mapped[Optional[str]] = mapped_column("correo", String(500))
    telefono_cifrado: Mapped[Optional[str]] = mapped_column("telefono", String(500))

    # Por acá se busca. UNIQUE: dos usuarios con el mismo nombre harían
    # ambiguo el login; dos con el mismo correo, la recuperación de clave.
    usuario_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    correo_hash: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)

    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre: Mapped[Optional[str]] = mapped_column(String(200))
    apellido: Mapped[Optional[str]] = mapped_column(String(200))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Clave provisoria: la pone quien crea el usuario o le resetea la clave.
    # Mientras esté puesta el usuario entra, pero el frontend lo manda derecho
    # a cambiarla (misma lógica que el administrador del sistema).
    debe_cambiar_password: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # ── Credenciales del abogado en la Oficina Judicial Virtual del PJUD ──
    # Solo se usan para `/sincronizar_civil` de api-pjud: ese endpoint dispara un
    # scrape que ENTRA al OJV como esta persona. El resto de la consulta (el
    # catálogo, `consultar_civil`, `consultar_movimientos_civil`) va con la
    # credencial de plataforma y no las necesita. La clave se guarda cifrada,
    # igual que el correo y el teléfono: hay que mandarla en claro al login.
    pjud_rut: Mapped[Optional[str]] = mapped_column(String(20))
    pjud_clave_cifrada: Mapped[Optional[str]] = mapped_column("pjud_clave", String(500))
    # 1 = Clave del Poder Judicial, 2 = ClaveÚnica.
    pjud_metodo_login: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Los RUT con los que esta persona recibe archivos del PJUD. Con cascada
    # porque no son una entidad propia: fuera de su usuario un RUT suelto no
    # significa nada. Ver `UsuarioRut`.
    ruts = relationship(
        "UsuarioRut",
        back_populates="usuario",
        cascade="all, delete-orphan",
        order_by="UsuarioRut.id",
    )

    # ── Acceso en claro a los campos cifrados ──

    @property
    def usuario(self) -> str:
        return descifrar(self.usuario_cifrado)

    @usuario.setter
    def usuario(self, valor: str) -> None:
        limpio = valor.strip()
        self.usuario_cifrado = cifrar(limpio)
        # El hash normaliza a minúsculas: el login no distingue mayúsculas,
        # como antes lo hacía el func.lower() que ya no se puede usar.
        self.usuario_hash = hash_busqueda(limpio)

    @property
    def correo(self) -> Optional[str]:
        return descifrar(self.correo_cifrado) if self.correo_cifrado else None

    @correo.setter
    def correo(self, valor: Optional[str]) -> None:
        limpio = valor.strip() if valor else None
        self.correo_cifrado = cifrar(limpio) if limpio else None
        self.correo_hash = hash_busqueda(limpio) if limpio else None

    @property
    def telefono(self) -> Optional[str]:
        """Formato libre (E.164 recomendado, ej. +56912345678): número por
        defecto para los recordatorios de WhatsApp."""
        return descifrar(self.telefono_cifrado) if self.telefono_cifrado else None

    @telefono.setter
    def telefono(self, valor: Optional[str]) -> None:
        self.telefono_cifrado = cifrar(valor.strip()) if valor else None

    @property
    def pjud_clave(self) -> Optional[str]:
        return descifrar(self.pjud_clave_cifrada) if self.pjud_clave_cifrada else None

    @pjud_clave.setter
    def pjud_clave(self, valor: Optional[str]) -> None:
        limpio = valor.strip() if valor else None
        self.pjud_clave_cifrada = cifrar(limpio) if limpio else None

    @property
    def pjud_configurado(self) -> bool:
        """Tiene lo mínimo para `/sincronizar_civil`: RUT y clave."""
        return bool(self.pjud_rut and self.pjud_clave_cifrada)

    @property
    def nombre_completo(self) -> str:
        return " ".join(p for p in (self.nombre, self.apellido) if p) or self.usuario
