import math
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.correo_log import CorreoLog, RESULTADO_CONEXION, RESULTADO_IMPORTADO


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
        page: int = 1,
        per_page: int = 20,
        resultado: Optional[str] = None,
    ):
        query = self.db.query(CorreoLog)
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

    def ya_importado(self, message_id: str, nombre_archivo: Optional[str] = None) -> bool:
        """¿Este adjunto ya se importó con éxito? Evita reprocesar el mismo
        correo si queda sin marcar como leído o si el job corre dos veces."""
        if not message_id:
            return False
        query = self.db.query(CorreoLog.id).filter(
            CorreoLog.message_id == message_id,
            CorreoLog.resultado == RESULTADO_IMPORTADO,
        )
        if nombre_archivo:
            query = query.filter(CorreoLog.nombre_archivo == nombre_archivo)
        return self.db.query(query.exists()).scalar()

    def existe_corrida_desde(self, desde: datetime, disparo: str = "programado") -> bool:
        """¿Ya hubo una corrida de este tipo después de `desde`?

        El job la usa con la hora programada de hoy, de modo que el cron puede
        invocarse cada 15 minutos sin repetir la importación del día.

        Las fallas de conexión no cuentan como corrida: si el servidor IMAP
        estaba caído a la hora programada, el siguiente tick del cron debe
        volver a intentarlo en vez de dar el día por perdido.
        """
        return self.db.query(
            self.db.query(CorreoLog.id)
            .filter(
                CorreoLog.fecha >= desde,
                CorreoLog.disparo == disparo,
                CorreoLog.resultado != RESULTADO_CONEXION,
            )
            .exists()
        ).scalar()
