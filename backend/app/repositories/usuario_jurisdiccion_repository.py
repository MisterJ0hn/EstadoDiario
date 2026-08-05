from typing import Optional

from sqlalchemy.orm import Session

from app.models.usuario_jurisdiccion import UsuarioJurisdiccion


class UsuarioJurisdiccionRepository:
    """Permisos de visibilidad por jurisdicción, en la base del cliente."""

    def __init__(self, db: Session):
        self.db = db

    def ids_de(self, usuario_id: int) -> list[int]:
        """Jurisdicciones asignadas a un usuario. Lista vacía = sin restricción
        (ver el docstring del modelo), no "no ve nada"."""
        return [
            fila[0]
            for fila in self.db.query(UsuarioJurisdiccion.jurisdiccion_id)
            .filter(UsuarioJurisdiccion.usuario_id == usuario_id)
            .all()
        ]

    def por_usuario(self, usuario_ids: list[int]) -> dict[int, list[int]]:
        """Las asignaciones de varios usuarios de una vez.

        La pantalla de permisos las necesita para toda la lista: pedirlas de a
        una sería una consulta por fila.
        """
        if not usuario_ids:
            return {}

        agrupado: dict[int, list[int]] = {uid: [] for uid in usuario_ids}
        filas = (
            self.db.query(UsuarioJurisdiccion.usuario_id, UsuarioJurisdiccion.jurisdiccion_id)
            .filter(UsuarioJurisdiccion.usuario_id.in_(usuario_ids))
            .all()
        )
        for usuario_id, jurisdiccion_id in filas:
            agrupado[usuario_id].append(jurisdiccion_id)
        return agrupado

    def reemplazar(self, usuario_id: int, jurisdiccion_ids: list[int]) -> list[int]:
        """Deja al usuario exactamente con las jurisdicciones indicadas.

        Se borra y se vuelve a insertar en vez de calcular el diferencial: son
        un puñado de filas por usuario y así no hay estado intermedio en el que
        el usuario vea de más.

        Una lista vacía **quita toda restricción** (vuelve a ver todas), que es
        el mismo significado que tiene no haber configurado nunca nada.
        """
        self.db.query(UsuarioJurisdiccion).filter(
            UsuarioJurisdiccion.usuario_id == usuario_id
        ).delete(synchronize_session=False)

        # dict.fromkeys y no set(): quita repetidos conservando el orden en que
        # llegaron, así lo que se devuelve es estable entre llamadas.
        unicos = list(dict.fromkeys(jurisdiccion_ids))
        for jurisdiccion_id in unicos:
            self.db.add(
                UsuarioJurisdiccion(usuario_id=usuario_id, jurisdiccion_id=jurisdiccion_id)
            )
        self.db.commit()
        return unicos

    def borrar_de(self, usuario_id: int) -> None:
        """Se llama al desactivar o borrar un usuario: sin esto quedarían filas
        apuntando a alguien que ya no existe."""
        self.db.query(UsuarioJurisdiccion).filter(
            UsuarioJurisdiccion.usuario_id == usuario_id
        ).delete(synchronize_session=False)
        self.db.commit()
