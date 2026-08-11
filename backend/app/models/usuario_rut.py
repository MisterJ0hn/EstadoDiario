from typing import Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.crypto import cifrar, descifrar
from app.core.database import BaseTenant


def limpiar_rut(valor: str) -> str:
    """Deja solo los alfanuméricos, en minúsculas: `16.952.077-K` → `16952077k`.

    **No** se usa `hash_busqueda.normalizar_rut`, que devuelve la forma
    `cuerpo-dv` asumiendo que el último carácter ES el dígito verificador. Acá
    entran RUT sin dígito (el PJUD los emite así: `estadoDiario_16952077__...`)
    y esa función los convertiría en `1695207-7`, o sea en otro RUT.
    """
    return "".join(c for c in (valor or "") if c.isalnum()).lower()


class UsuarioRut(BaseTenant):
    """RUT con el que un usuario recibe archivos del PJUD.

    Existe porque **el RUT del archivo no es el del estudio**. Los reportes del
    Poder Judicial se emiten a nombre del abogado que los pide, así que un
    estudio con cinco abogados recibe archivos con cinco RUT distintos y
    ninguno es el de la ficha del cliente. Validar contra el RUT del cliente
    dejaba a todo el mundo con una advertencia permanente.

    Son varios por persona a propósito: un abogado puede litigar además a
    nombre de una sociedad, y los dos archivos son suyos.

    El RUT es dato personal y va **cifrado**, igual que el nombre de usuario y
    el correo (ver `Usuario`). Como no se busca por él —siempre se llega desde
    el usuario— no lleva hash de búsqueda; lo que sí lleva es `rut_normalizado`
    en claro, para poder comparar sin descifrar la lista entera.
    """

    __tablename__ = "usuario_rut"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id"), nullable=False, index=True
    )

    # Cifrado. El nombre Python lleva el sufijo para que quede claro que ahí no
    # hay texto legible; el nombre en la base es `rut`.
    rut_cifrado: Mapped[str] = mapped_column("rut", String(500), nullable=False)

    # Sin puntos, sin guion y en minúsculas ("16952077k"). No es un hash: se
    # compara también por cuerpo cuando el archivo omite el dígito verificador,
    # que es lo que hace el PJUD la mitad de las veces.
    rut_normalizado: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    usuario = relationship("Usuario", back_populates="ruts")

    # ── Acceso en claro al campo cifrado ──

    @property
    def rut(self) -> str:
        return descifrar(self.rut_cifrado)

    @rut.setter
    def rut(self, valor: str) -> None:
        limpio = (valor or "").strip()
        self.rut_cifrado = cifrar(limpio)
        self.rut_normalizado = limpiar_rut(limpio)

    @property
    def cuerpo(self) -> Optional[str]:
        """El RUT sin su dígito verificador. Es con lo que se compara cuando el
        archivo viene sin dígito (`estadoDiario_16952077__28072026.xls`)."""
        n = self.rut_normalizado
        return n[:-1] if n and len(n) > 1 else n
