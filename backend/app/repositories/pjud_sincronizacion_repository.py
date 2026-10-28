"""Jobs de `sincronizar_*` de api-pjud, en la base principal.

Los escribe `PjudService` al encolar (vía el endpoint) y el callback público de
api-pjud al terminar. Ver `PjudSincronizacion`.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.maestra.pjud_sincronizacion import PjudSincronizacion

SINCRONIZANDO = "sincronizando"
LISTO = "listo"
ERROR = "error"

# Si el callback nunca llega (api-pjud caído, URL inalcanzable) la causa no puede
# quedar "sincronizando" para siempre: pasado este plazo se ignora la fila y se
# vuelve a consultar al proveedor. Es el `sincronizacion_en_curso` de api-pjud.
VENCIMIENTO = timedelta(minutes=15)


class PjudSincronizacionRepository:
    def __init__(self, db: Session):
        self.db = db

    def registrar(
        self,
        *,
        job_id: str,
        cliente_id: Optional[int],
        causa_id: Optional[int],
        materia: Optional[str],
        rol: Optional[str],
        tribunal: Optional[str],
    ) -> PjudSincronizacion:
        """Guarda el job recién encolado como `sincronizando`. Si el `job_id` ya
        existe (api-pjud lo repitió) se reinicia esa fila en vez de duplicarla."""
        ahora = datetime.now(timezone.utc)
        fila = self.por_job_id(job_id)
        if fila is None:
            fila = PjudSincronizacion(job_id=job_id)
            self.db.add(fila)
        fila.cliente_id = cliente_id
        fila.causa_id = causa_id
        fila.materia = materia
        fila.rol = rol
        fila.tribunal = tribunal
        fila.estado = SINCRONIZANDO
        fila.mensaje_error = None
        fila.creado_en = ahora
        fila.actualizado_en = ahora
        self.db.commit()
        return fila

    def por_job_id(self, job_id: str) -> Optional[PjudSincronizacion]:
        return (
            self.db.query(PjudSincronizacion)
            .filter(PjudSincronizacion.job_id == job_id)
            .first()
        )

    def cerrar(
        self, job_id: str, *, exito: bool, mensaje_error: Optional[str] = None
    ) -> Optional[PjudSincronizacion]:
        """Aplica el aviso de api-pjud. `None` si el job no existe. Idempotente:
        repetir el mismo aviso deja la fila igual."""
        fila = self.por_job_id(job_id)
        if fila is None:
            return None
        fila.estado = LISTO if exito else ERROR
        fila.mensaje_error = None if exito else (mensaje_error or "").strip() or None
        fila.actualizado_en = datetime.now(timezone.utc)
        self.db.commit()
        return fila

    @staticmethod
    def _materia_de(apelaciones: bool):
        return (
            PjudSincronizacion.materia == "Apelaciones" if apelaciones
            else or_(
                PjudSincronizacion.materia.is_(None),
                PjudSincronizacion.materia != "Apelaciones",
            )
        )

    def ultimos_por_causa(
        self, *, cliente_id: Optional[int], causa_ids: list[int], apelaciones: bool = False
    ) -> dict[int, PjudSincronizacion]:
        """`{causa_id: PjudSincronizacion}` del job más reciente de cada causa.
        Una fila `sincronizando` vencida (ver `VENCIMIENTO`) no cuenta."""
        if not causa_ids:
            return {}
        filas = (
            self.db.query(PjudSincronizacion)
            .filter(
                PjudSincronizacion.cliente_id == cliente_id,
                PjudSincronizacion.causa_id.in_(causa_ids),
                self._materia_de(apelaciones),
            )
            .order_by(PjudSincronizacion.creado_en.desc(), PjudSincronizacion.id.desc())
            .all()
        )
        ultimos: dict[int, PjudSincronizacion] = {}
        for fila in filas:
            ultimos.setdefault(fila.causa_id, fila)
        return {c: f for c, f in ultimos.items() if not self.vencida(f)}

    @staticmethod
    def vencida(fila: PjudSincronizacion) -> bool:
        if fila.estado != SINCRONIZANDO:
            return False
        creado = fila.creado_en
        if creado.tzinfo is None:
            creado = creado.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - creado > VENCIMIENTO

    def ultimo_de_causa(
        self, *, cliente_id: Optional[int], causa_id: int, apelaciones: bool = False
    ) -> Optional[PjudSincronizacion]:
        return self.ultimos_por_causa(
            cliente_id=cliente_id, causa_ids=[causa_id], apelaciones=apelaciones
        ).get(causa_id)
