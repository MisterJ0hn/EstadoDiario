"""Copia local de las respuestas de api-pjud. Ver `PjudCopia`."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.pjud_copia import PjudCopia

PREFIJO_MOVIMIENTOS = "/consultar_movimientos_"


def _aware(fecha: datetime) -> datetime:
    return fecha.replace(tzinfo=timezone.utc) if fecha.tzinfo is None else fecha


class PjudCopiaRepository:
    def __init__(self, db: Session):
        self.db = db

    def _fila(self, ruta: str, clave: str) -> Optional[PjudCopia]:
        return (
            self.db.query(PjudCopia)
            .filter(PjudCopia.ruta == ruta, PjudCopia.clave == clave)
            .first()
        )

    @staticmethod
    def _vigente(fila: PjudCopia, ttl_minutos: int) -> bool:
        edad = datetime.now(timezone.utc) - _aware(fila.capturado_en)
        return edad <= timedelta(minutes=ttl_minutos)

    def vigente(self, ruta: str, clave: str, ttl_minutos: int) -> Optional[PjudCopia]:
        """La copia de esa consulta si existe y no pasó el TTL; si no, `None`."""
        fila = self._fila(ruta, clave)
        return fila if fila is not None and self._vigente(fila, ttl_minutos) else None

    def cabecera_vigente(self, identificador: str, ttl_minutos: int) -> bool:
        """¿Hay una cabecera (`consultar_<competencia>`) vigente de esa causa? Los
        movimientos solo se copian si la hay: durante el sync pueden ir parciales."""
        filas = (
            self.db.query(PjudCopia)
            .filter(
                PjudCopia.identificador == identificador,
                ~PjudCopia.ruta.like(PREFIJO_MOVIMIENTOS + "%"),
            )
            .all()
        )
        return any(self._vigente(f, ttl_minutos) for f in filas)

    def guardar(
        self, ruta: str, clave: str, identificador: Optional[str], respuesta: str
    ) -> None:
        """Crea o reemplaza la copia. Al guardar una cabecera se descartan los
        movimientos de esa causa: pueden ser de antes del sync que la renovó."""
        if identificador and not ruta.startswith(PREFIJO_MOVIMIENTOS):
            self.db.query(PjudCopia).filter(
                PjudCopia.identificador == identificador,
                PjudCopia.ruta.like(PREFIJO_MOVIMIENTOS + "%"),
            ).delete(synchronize_session=False)
        fila = self._fila(ruta, clave)
        if fila is None:
            fila = PjudCopia(ruta=ruta, clave=clave)
            self.db.add(fila)
        fila.identificador = identificador
        fila.respuesta = respuesta
        fila.capturado_en = datetime.now(timezone.utc)
        self.db.commit()

    def borrar_de_causa(self, ruta: str, clave: str) -> int:
        """Descarta la cabecera de esa consulta y los movimientos de la misma
        causa (los une el `identificador`). Devuelve cuántas filas borró."""
        fila = self._fila(ruta, clave)
        if fila is None:
            return 0
        consulta = self.db.query(PjudCopia)
        if fila.identificador:
            consulta = consulta.filter(PjudCopia.identificador == fila.identificador)
        else:
            consulta = consulta.filter(PjudCopia.id == fila.id)
        borradas = consulta.delete(synchronize_session=False)
        self.db.commit()
        return borradas
