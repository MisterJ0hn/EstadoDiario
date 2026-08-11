import math
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.correo_log import CorreoLog, RESULTADO_IMPORTADO


class CorreoLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, log: CorreoLog) -> CorreoLog:
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def find_all_paginated(
        self,
        usuario_id: Optional[int],
        page: int = 1,
        per_page: int = 20,
        resultado: Optional[str] = None,
    ):
        """`usuario_id=None` = sin filtro (admin ve la bitácora de todos)."""
        query = self.db.query(CorreoLog)
        if usuario_id is not None:
            query = query.filter(CorreoLog.usuario_id == usuario_id)
        if resultado:
            query = query.filter(CorreoLog.resultado == resultado)

        total = query.with_entities(func.count(CorreoLog.id)).scalar() or 0
        total_pages = max(1, math.ceil(total / per_page))

        items = (
            query.order_by(CorreoLog.fecha.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total, total_pages

    def ya_importado(
        self,
        message_id: str,
        nombre_archivo: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> bool:
        """¿Este adjunto ya se importó con éxito? Evita reprocesar el mismo
        correo si queda sin marcar como leído o si el job corre dos veces.

        Se acota al dueño de la casilla: dos usuarios pueden recibir un reenvío
        del mismo correo (mismo Message-ID) y cada uno necesita su copia.
        """
        if not message_id:
            return False
        query = self.db.query(CorreoLog.id).filter(
            CorreoLog.message_id == message_id,
            CorreoLog.resultado == RESULTADO_IMPORTADO,
        )
        if nombre_archivo:
            query = query.filter(CorreoLog.nombre_archivo == nombre_archivo)
        if usuario_id is not None:
            query = query.filter(CorreoLog.usuario_id == usuario_id)
        return self.db.query(query.exists()).scalar()

    # Acá vivía `existe_corrida_desde`, que respondía "¿ya se revisó hoy?" y
    # con la que el job hacía UNA revisión diaria por casilla. Se eliminó junto
    # con esa regla: hacía perder correo, porque el estado diario no llega
    # siempre a la misma hora y lo que llegaba después de la corrida del día
    # esperaba hasta el día siguiente. Ahora se revisa en cada pasada del cron
    # (ver `app/jobs/revisar_correo.py`).
    #
    # Se borra en vez de dejarla sin usar: un método que promete controlar la
    # corrida del día, vivo y sin llamadores, es una trampa para el que venga
    # después a preguntarse por qué no surte efecto.
