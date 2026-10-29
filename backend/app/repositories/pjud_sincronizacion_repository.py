"""Jobs de `sincronizar_*` de api-pjud, en la base principal.

Los escribe `PjudService` al encolar (vía el endpoint) y el callback público de
api-pjud al terminar. Ver `PjudSincronizacion`.
"""

import uuid
import zlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.models.maestra.pjud_sincronizacion import PjudSincronizacion

SINCRONIZANDO = "sincronizando"
LISTO = "listo"
ERROR = "error"

# `job_id` provisorio de un envío que api-pjud todavía no respondió (ver `reservar`).
# No es un job real: no se le entrega a nadie.
PREFIJO_RESERVA = "reserva-"

# Si el callback nunca llega (api-pjud caído, URL inalcanzable) la causa no puede
# quedar "sincronizando" para siempre: pasado este plazo se ignora la fila y se
# vuelve a consultar al proveedor. Es el `sincronizacion_en_curso` de api-pjud.
VENCIMIENTO = timedelta(minutes=15)

# Tras un job `listo` la consulta de detalle no vuelve a encolar sola durante este
# plazo: es el intervalo mínimo entre syncs de una causa en api-pjud (más pronto
# responde 409), así que reintentar antes no podía servir de nada.
ENFRIAMIENTO = timedelta(minutes=30)


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

    def reservar(
        self,
        *,
        cliente_id: Optional[int],
        causa_id: Optional[int],
        materia: Optional[str],
        rol: Optional[str],
        tribunal: Optional[str],
    ) -> tuple[PjudSincronizacion, bool]:
        """`(fila, nueva)`: toma el cupo de sync de la causa **antes** de llamar a
        api-pjud. Si ya hay uno en curso devuelve ese con `nueva=False`.

        Sin esto, `en_curso` + enviar + `registrar` no es atómico: el job recién
        existe cuando api-pjud responde, y una ráfaga de la misma causa pasa
        entera el chequeo y se envía completa. La reserva es una fila
        `sincronizando` con un `job_id` provisorio; el candado (Postgres) hace que
        chequear y reservar sea una sola operación entre workers, y se suelta con
        el commit. Si el proceso muere con la reserva puesta, `VENCIMIENTO` la
        descarta como a cualquier job sin callback."""
        if self.db.get_bind().dialect.name == "postgresql":
            clave = f"{cliente_id}|{materia == 'Apelaciones'}|{rol or causa_id}|{tribunal}"
            self.db.execute(
                text("SELECT pg_advisory_xact_lock(:k)"), {"k": zlib.crc32(clave.encode())}
            )
        previo = self.en_curso(
            cliente_id=cliente_id, materia=materia, causa_id=causa_id, rol=rol, tribunal=tribunal
        )
        if previo is not None:
            self.db.rollback()  # suelta el candado
            return previo, False
        fila = self.registrar(
            job_id=f"{PREFIJO_RESERVA}{uuid.uuid4().hex}",
            cliente_id=cliente_id, causa_id=causa_id,
            materia=materia, rol=rol, tribunal=tribunal,
        )
        return fila, True

    def confirmar(self, fila: PjudSincronizacion, job_id: str) -> None:
        """Cambia el `job_id` provisorio por el que devolvió api-pjud. Si ese job ya
        existe (api-pjud lo repitió) la reserva sobra y se reinicia el existente."""
        if self.por_job_id(job_id) is not None:
            datos = dict(
                cliente_id=fila.cliente_id, causa_id=fila.causa_id,
                materia=fila.materia, rol=fila.rol, tribunal=fila.tribunal,
            )
            self.liberar(fila)
            self.registrar(job_id=job_id, **datos)
            return
        fila.job_id = job_id
        fila.actualizado_en = datetime.now(timezone.utc)
        self.db.commit()

    def liberar(self, fila: PjudSincronizacion) -> None:
        """Suelta la reserva: api-pjud rechazó el envío o no devolvió `job_id`, así
        que no habrá callback que la cierre."""
        self.db.delete(fila)
        self.db.commit()

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
    def enfriando(fila: PjudSincronizacion) -> bool:
        """¿Terminó bien hace poco? El callback de un job `listo` levanta la compuerta
        de `en_curso`, pero api-pjud puede seguir procesando otros jobs de la misma
        causa y `consultar_*` aún decir "sincronizando": volver a encolar ahí es la
        ráfaga (cada callback dispara otro sync, que trae otro callback). Dentro de
        `ENFRIAMIENTO` no se encola solo; `forzar` ("Reintentar") sí puede."""
        if fila.estado != LISTO:
            return False
        actualizado = fila.actualizado_en
        if actualizado.tzinfo is None:
            actualizado = actualizado.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - actualizado < ENFRIAMIENTO

    @staticmethod
    def vencida(fila: PjudSincronizacion) -> bool:
        if fila.estado != SINCRONIZANDO:
            return False
        creado = fila.creado_en
        if creado.tzinfo is None:
            creado = creado.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - creado > VENCIMIENTO

    def en_curso(
        self,
        *,
        cliente_id: Optional[int],
        materia: Optional[str],
        causa_id: Optional[int] = None,
        rol: Optional[str] = None,
        tribunal: Optional[str] = None,
    ) -> Optional[PjudSincronizacion]:
        """Job `sincronizando` (no vencido) de esa causa, para no encolar otro encima.
        Se reconoce por `causa_id` o, si el job se encoló sin él (espejo de api-pjud),
        por `materia` + `rol` + `tribunal` tal como se registraron."""
        coincide = []
        if causa_id is not None:
            coincide.append(PjudSincronizacion.causa_id == causa_id)
        if rol and tribunal:
            coincide.append(
                (PjudSincronizacion.rol == rol) & (PjudSincronizacion.tribunal == tribunal)
            )
        if not coincide:
            return None
        filas = (
            self.db.query(PjudSincronizacion)
            .filter(
                PjudSincronizacion.cliente_id == cliente_id,
                PjudSincronizacion.estado == SINCRONIZANDO,
                self._materia_de(materia == "Apelaciones"),
                or_(*coincide),
            )
            .order_by(PjudSincronizacion.creado_en.desc(), PjudSincronizacion.id.desc())
            .all()
        )
        return next((f for f in filas if not self.vencida(f)), None)

    def ultimo_de(
        self,
        *,
        cliente_id: Optional[int],
        materia: Optional[str],
        causa_id: Optional[int] = None,
        rol: Optional[str] = None,
        tribunal: Optional[str] = None,
    ) -> Optional[PjudSincronizacion]:
        """El job más reciente de esa causa, en cualquier estado (se reconoce igual que
        en `en_curso`). Sirve para ver si el último terminó bien hace poco (`enfriando`)."""
        coincide = []
        if causa_id is not None:
            coincide.append(PjudSincronizacion.causa_id == causa_id)
        if rol and tribunal:
            coincide.append(
                (PjudSincronizacion.rol == rol) & (PjudSincronizacion.tribunal == tribunal)
            )
        if not coincide:
            return None
        return (
            self.db.query(PjudSincronizacion)
            .filter(
                PjudSincronizacion.cliente_id == cliente_id,
                self._materia_de(materia == "Apelaciones"),
                or_(*coincide),
            )
            .order_by(PjudSincronizacion.creado_en.desc(), PjudSincronizacion.id.desc())
            .first()
        )

    def ultimo_de_causa(
        self, *, cliente_id: Optional[int], causa_id: int, apelaciones: bool = False
    ) -> Optional[PjudSincronizacion]:
        return self.ultimos_por_causa(
            cliente_id=cliente_id, causa_ids=[causa_id], apelaciones=apelaciones
        ).get(causa_id)
