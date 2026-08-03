"""Publicación de las audiencias en el Google Calendar de cada abogado.

Reutiliza la conexión OAuth por usuario que ya monta GoogleCalendarService (el
mismo cliente que usan los recordatorios) y aplica su misma política: si el
usuario no conectó su cuenta, o si Google falla, la audiencia igual queda
guardada; el error se deja en `Audiencia.google_sync_error` para diagnóstico.

Diferencia con los recordatorios: una audiencia es un evento CON HORA, no de
todo el día. Se envía la hora de reloj más `timeZone: America/Santiago` y es
Google quien resuelve el offset — así el evento no se corre cuando Chile cambia
al horario de verano entre la importación y la fecha de la audiencia.
"""

import logging
from datetime import date, datetime, time, timedelta
from typing import Optional

from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.models.audiencia import Audiencia
from app.repositories.audiencia_repository import AudienciaRepository
from app.services.google_calendar_service import GoogleCalendarService

logger = logging.getLogger(__name__)

ZONA_HORARIA = "America/Santiago"

# Color fijo de la paleta de Google Calendar (colorId 1-11). "9" = Blueberry:
# distinto de los tonos que usan los recordatorios por nivel de urgencia
# (naranjo/amarillo/rojo), para que una audiencia se distinga de un vistazo.
COLOR_AUDIENCIA = "9"

# El Excel del PJUD no informa duración; una hora es el bloque estándar de
# agenda y es lo que se muestra si no hay mejor dato.
DURACION_POR_DEFECTO = timedelta(hours=1)


class AudienciaCalendarService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AudienciaRepository(db)
        self.google = GoogleCalendarService(db)

    # ── Armado del evento ─────────────────────────────────

    @staticmethod
    def titulo(audiencia: Audiencia) -> str:
        causa = audiencia.caratulado or audiencia.rol or audiencia.ruc or "Causa sin identificar"
        tipo = audiencia.tipo_audiencia or "Audiencia"
        return f"{tipo} — {causa}"

    @staticmethod
    def descripcion(audiencia: Audiencia) -> str:
        lineas = [
            ("Tipo", audiencia.tipo_audiencia),
            ("Materia", audiencia.materia),
            ("RIT", audiencia.rol),
            ("RUC", audiencia.ruc),
            ("Carátula", audiencia.caratulado),
            ("Tribunal", audiencia.tribunal),
            ("Sala", audiencia.sala),
            ("Juez", audiencia.juez),
            ("Estado", audiencia.estado),
        ]
        return "\n".join(
            f"{etiqueta}: {valor.strip()}"
            for etiqueta, valor in lineas
            if valor and str(valor).strip()
        )

    @classmethod
    def _cuerpo_evento(cls, audiencia: Audiencia) -> dict:
        ubicacion = " · ".join(
            p.strip() for p in (audiencia.tribunal, audiencia.sala) if p and p.strip()
        )

        body = {
            "summary": cls.titulo(audiencia),
            "description": cls.descripcion(audiencia),
            "colorId": COLOR_AUDIENCIA,
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 24 * 60},  # el día anterior
                    {"method": "popup", "minutes": 60},
                ],
            },
        }
        if ubicacion:
            body["location"] = ubicacion
        body.update(cls._horario(audiencia.fecha_audiencia, audiencia.hora))
        return body

    @staticmethod
    def _horario(fecha: date, hora: Optional[time]) -> dict:
        """Bloque start/end del evento.

        Sin hora (pasa en la hoja Penal) se crea como evento de todo el día:
        inventar una hora sería peor que no tenerla, porque el abogado la
        leería como dato del tribunal.
        """
        if hora is None:
            return {
                "start": {"date": fecha.isoformat()},
                "end": {"date": (fecha + timedelta(days=1)).isoformat()},
            }

        inicio = datetime.combine(fecha, hora)
        fin = inicio + DURACION_POR_DEFECTO
        return {
            "start": {"dateTime": inicio.isoformat(), "timeZone": ZONA_HORARIA},
            "end": {"dateTime": fin.isoformat(), "timeZone": ZONA_HORARIA},
        }

    # ── Sincronización ────────────────────────────────────

    def sincronizar(self, audiencia: Audiencia, servicio) -> bool:
        """Crea o actualiza el evento de UNA audiencia. Devuelve si se sincronizó.

        Recibe el cliente ya construido en vez de armarlo acá: cada llamada a
        GoogleCalendarService.cliente() refresca el token OAuth contra Google, y
        hacerlo una vez por audiencia convertiría un lote de 50 en 50 viajes de
        red extra. No hace commit: lo decide quien orquesta el lote.
        """
        try:
            body = self._cuerpo_evento(audiencia)

            if audiencia.google_event_id:
                evento = servicio.events().update(
                    calendarId=audiencia.google_calendar_id or "primary",
                    eventId=audiencia.google_event_id,
                    body=body,
                ).execute()
            else:
                evento = servicio.events().insert(calendarId="primary", body=body).execute()
                audiencia.google_calendar_id = "primary"

            audiencia.google_event_id = evento["id"]
            audiencia.google_sync_error = None
            return True
        except HttpError as e:
            logger.warning(
                "Error de Google Calendar al sincronizar la audiencia %s: %s", audiencia.id, e
            )
            audiencia.google_sync_error = str(e)
            return False
        except Exception as e:
            logger.exception(
                "Fallo inesperado sincronizando la audiencia %s con Google Calendar",
                audiencia.id,
            )
            audiencia.google_sync_error = str(e)
            return False

    def sincronizar_pendientes(
        self, usuario_id: int, desde: Optional[date] = None, limite: int = 200
    ) -> dict:
        """Publica las audiencias futuras del usuario que aún no están en Google.

        Solo las que no tienen evento todavía: reenviar en cada importación las
        ya publicadas gastaría cuota de la API sin cambiar nada, porque el
        contenido del evento no depende del archivo.
        """
        pendientes = self.repo.find_pendientes_google(
            usuario_id, desde or date.today(), limite
        )
        if not pendientes:
            return {"sincronizadas": 0, "pendientes": 0}

        # Un solo cliente para todo el lote (ver sincronizar()). Si el usuario no
        # conectó su cuenta, no hay nada que intentar.
        try:
            servicio = self.google.cliente(usuario_id)
        except Exception:
            logger.exception("No se pudo abrir el cliente de Google del usuario %s", usuario_id)
            return {"sincronizadas": 0, "pendientes": len(pendientes)}

        if servicio is None:
            logger.info(
                "El usuario %s no tiene Google Calendar conectado; se omiten %d audiencias",
                usuario_id, len(pendientes),
            )
            return {"sincronizadas": 0, "pendientes": len(pendientes)}

        sincronizadas = sum(1 for a in pendientes if self.sincronizar(a, servicio))
        self.db.commit()

        logger.info(
            "Google Calendar: %d de %d audiencias sincronizadas para el usuario %s",
            sincronizadas, len(pendientes), usuario_id,
        )
        return {
            "sincronizadas": sincronizadas,
            "pendientes": len(pendientes) - sincronizadas,
        }
