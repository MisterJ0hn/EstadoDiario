"""Sincronización best-effort de recordatorios con el Google Calendar
personal de cada abogado.

Si el usuario no conectó su cuenta, o si Google falla, el recordatorio
igual queda guardado en la base: ningún flujo de negocio depende de que
esta sincronización tenga éxito. El error queda en
EstadoDiarioAgenda.google_sync_error para diagnóstico.
"""

import logging
from datetime import timedelta

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.core.crypto import descifrar
from app.models.estado_diario_agenda import EstadoDiarioAgenda
from app.models.usuario import Usuario
from app.repositories.configuracion_google_repository import ConfiguracionGoogleRepository
from app.repositories.google_credencial_repository import GoogleCredencialRepository

logger = logging.getLogger(__name__)

# Paleta fija de Google Calendar (colorId 1-11, no personalizable).
_COLOR_POR_NIVEL = {
    "bajo": "6",   # Tangerine (naranjo)
    "medio": "5",  # Banana (amarillo)
    "alto": "11",  # Tomato (rojo)
}
_COLOR_FINALIZADO = "8"  # Graphite (gris)


class GoogleCalendarService:
    def __init__(self, db: Session):
        self.db = db
        self.config_repo = ConfiguracionGoogleRepository(db)
        self.cred_repo = GoogleCredencialRepository(db)

    def _client(self, usuario_id: int):
        """Devuelve un cliente de Calendar API para el usuario, o None si no
        tiene su cuenta conectada o falta la configuración del proyecto."""
        config = self.config_repo.get_or_create()
        if not config.activo or not config.client_id or not config.client_secret_cifrado:
            return None

        cred = self.cred_repo.find_by_usuario(usuario_id)
        if cred is None:
            return None

        credentials = Credentials(
            token=None,
            refresh_token=descifrar(cred.refresh_token_cifrado),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=config.client_id,
            client_secret=descifrar(config.client_secret_cifrado),
            scopes=["https://www.googleapis.com/auth/calendar.events"],
        )
        credentials.refresh(Request())
        return build("calendar", "v3", credentials=credentials, cache_discovery=False)

    def crear_o_actualizar_evento(self, agenda: EstadoDiarioAgenda, usuario: Usuario) -> None:
        try:
            servicio = self._client(usuario.id)
            if servicio is None:
                return

            movimiento = agenda.estado_diario
            titulo = movimiento.caratulado or movimiento.rol or "Movimiento sin caratulado"
            fecha = agenda.fecha_hora.date()

            body = {
                "summary": f"[{agenda.nivel.upper()}] {titulo}",
                "description": agenda.detalle,
                "start": {"date": fecha.isoformat()},
                "end": {"date": (fecha + timedelta(days=1)).isoformat()},
                "colorId": _COLOR_POR_NIVEL.get(agenda.nivel, _COLOR_POR_NIVEL["medio"]),
                "reminders": {
                    "useDefault": False,
                    "overrides": [{"method": "popup", "minutes": 0}],
                },
            }

            if agenda.google_event_id:
                evento = servicio.events().update(
                    calendarId=agenda.google_calendar_id or "primary",
                    eventId=agenda.google_event_id,
                    body=body,
                ).execute()
            else:
                evento = servicio.events().insert(calendarId="primary", body=body).execute()
                agenda.google_calendar_id = "primary"

            agenda.google_event_id = evento["id"]
            agenda.google_sync_error = None
        except HttpError as e:
            logger.warning("Error de Google Calendar al sincronizar agenda %s: %s", agenda.id, e)
            agenda.google_sync_error = str(e)
        except Exception as e:
            logger.exception("Fallo inesperado sincronizando agenda %s con Google Calendar", agenda.id)
            agenda.google_sync_error = str(e)

    def finalizar_evento(self, agenda: EstadoDiarioAgenda, usuario: Usuario) -> None:
        if not agenda.google_event_id:
            return
        try:
            servicio = self._client(usuario.id)
            if servicio is None:
                return

            movimiento = agenda.estado_diario
            titulo = movimiento.caratulado or movimiento.rol or "Movimiento sin caratulado"
            servicio.events().patch(
                calendarId=agenda.google_calendar_id or "primary",
                eventId=agenda.google_event_id,
                body={
                    "summary": f"✔ [{agenda.nivel.upper()}] {titulo}",
                    "colorId": _COLOR_FINALIZADO,
                },
            ).execute()
            agenda.google_sync_error = None
        except HttpError as e:
            logger.warning("Error de Google Calendar al finalizar agenda %s: %s", agenda.id, e)
            agenda.google_sync_error = str(e)
        except Exception as e:
            logger.exception("Fallo inesperado finalizando agenda %s en Google Calendar", agenda.id)
            agenda.google_sync_error = str(e)
