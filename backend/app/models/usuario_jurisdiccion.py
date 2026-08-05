from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import BaseTenant


class UsuarioJurisdiccion(BaseTenant):
    """Qué jurisdicciones puede ver un usuario del estudio.

    Es el primer permiso del sistema y define **qué causas ve cada abogado**.
    Antes la visibilidad era por dueño —cada uno veía lo que se había cargado a
    su nombre—, pero con una sola casilla de ingesta por estudio todo lo
    importado queda a nombre de un único usuario y el resto no vería nada. Por
    eso el criterio pasó a ser la jurisdicción.

    **Sin filas para un usuario = ve TODAS las jurisdicciones.** No es un
    descuido: es lo que hace que un estudio que nunca tocó esta pantalla siga
    funcionando igual, y que un usuario recién creado no aparezca con el
    sistema vacío sin explicación. Restringir es un acto deliberado del
    administrador del estudio.

    El administrador del estudio ve todo siempre, tenga o no filas acá.
    """

    __tablename__ = "usuario_jurisdiccion"
    __table_args__ = (
        # Asignar dos veces la misma jurisdicción no significa nada y rompería
        # el conteo de la pantalla.
        UniqueConstraint("usuario_id", "jurisdiccion_id", name="uq_usuario_jurisdiccion"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jurisdiccion_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jurisdiccion.id", ondelete="CASCADE"), nullable=False, index=True
    )
