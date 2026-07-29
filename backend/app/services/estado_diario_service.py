import json
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException, BadRequestException
from app.models.estado_diario import EstadoDiario
from app.models.estado_diario_agenda import EstadoDiarioAgenda
from app.models.api_llamado_estado_diario import ApiLlamadoEstadoDiario
from app.repositories.estado_diario_repository import EstadoDiarioRepository
from app.repositories.estado_diario_agenda_repository import EstadoDiarioAgendaRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.repositories.api_log_repository import ApiLogRepository
from app.services.google_calendar_service import GoogleCalendarService

logger = logging.getLogger(__name__)


class EstadoDiarioService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = EstadoDiarioRepository(db)
        self.agenda_repo = EstadoDiarioAgendaRepository(db)
        self.user_repo = UsuarioRepository(db)
        self.log_repo = ApiLogRepository(db)
        self.google_service = GoogleCalendarService(db)

    def _create_log(self, endpoint: str, request_data: str = "") -> ApiLlamadoEstadoDiario:
        log = ApiLlamadoEstadoDiario(
            endpoint=endpoint,
            json_request=request_data,
            fecha_registro=datetime.now(timezone.utc),
        )
        return log

    def _save_log(self, log: ApiLlamadoEstadoDiario, exito: bool, response: str = "", error: str = ""):
        log.exito = exito
        if response:
            log.json_response = response
        if error:
            log.mensaje_error = error
        self.db.add(log)
        self.db.commit()

    def get_movimientos_no_leidos(
        self,
        jurisdiccion_id: Optional[int] = None,
        fecha: Optional[str] = None,
        rut: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        log = self._create_log("no-leidos", json.dumps({
            "jurisdiccion": jurisdiccion_id, "fecha": fecha, "rut": rut
        }))
        try:
            items, total, current_page, total_pages = self.repo.find_filtered(
                jurisdiccion_id, fecha, rut, None, page, limit
            )
            data = [self._map_movimiento(m) for m in items]
            result = {
                "exito": True, "total": total,
                "page": current_page, "total_pages": total_pages,
                "movimientos": data,
            }
            self._save_log(log, True, json.dumps(result, default=str))
            return result
        except Exception as e:
            self._save_log(log, False, error=str(e))
            raise

    def get_movimientos_leidos(
        self,
        jurisdiccion_id: Optional[int] = None,
        fecha: Optional[str] = None,
        rut: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        log = self._create_log("leidos", json.dumps({
            "jurisdiccion": jurisdiccion_id, "fecha": fecha, "rut": rut
        }))
        try:
            items, total, current_page, total_pages = self.repo.find_filtered(
                jurisdiccion_id, fecha, rut, "resuelto", page, limit
            )
            data = [self._map_movimiento(m) for m in items]
            result = {
                "exito": True, "total": total,
                "page": current_page, "total_pages": total_pages,
                "movimientos": data,
            }
            self._save_log(log, True, json.dumps(result, default=str))
            return result
        except Exception as e:
            self._save_log(log, False, error=str(e))
            raise

    def get_movimientos_pendientes(
        self,
        jurisdiccion_id: Optional[int] = None,
        fecha: Optional[str] = None,
        rut: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
    ):
        log = self._create_log("pendientes", json.dumps({
            "jurisdiccion": jurisdiccion_id, "fecha": fecha, "rut": rut
        }))
        try:
            items, total, current_page, total_pages = self.repo.find_filtered(
                jurisdiccion_id, fecha, rut, "pendiente", page, limit
            )
            data = [self._map_movimiento(m, include_pendiente=True) for m in items]
            result = {
                "exito": True, "total": total,
                "page": current_page, "total_pages": total_pages,
                "movimientos": data,
            }
            self._save_log(log, True, json.dumps(result, default=str))
            return result
        except Exception as e:
            self._save_log(log, False, error=str(e))
            raise

    def marcar_leido(self, estado_diario_id: int, usuario_id: Optional[int] = None):
        log = self._create_log("leido")
        ed = self.repo.find_by_id(estado_diario_id)
        if not ed:
            self._save_log(log, False, error="No encontrado")
            raise NotFoundException("Estado diario no encontrado")

        log.estado_diario_id = ed.id
        ed.leido = True
        ed.fecha_leido = datetime.now(timezone.utc)
        ed.usuario_leido_id = usuario_id
        self.repo.save()

        self._save_log(log, True, json.dumps({"exito": True}))
        return {"exito": True}

    @staticmethod
    def _parse_fecha_hora(valor: str) -> datetime:
        try:
            return datetime.strptime(valor, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return datetime.fromisoformat(valor)

    def marcar_pendiente(self, estado_diario_id: int, nivel: str, username: Optional[str] = None,
                         mensaje: Optional[str] = None, fecha_hora: Optional[str] = None,
                         notificar_whatsapp: bool = False, whatsapp_telefono: Optional[str] = None,
                         fecha_hora_whatsapp: Optional[str] = None):
        log = self._create_log("pendiente", json.dumps({
            "nivel": nivel, "username": username, "mensaje": mensaje, "fecha_hora": fecha_hora,
            "notificar_whatsapp": notificar_whatsapp,
        }))

        ed = self.repo.find_by_id(estado_diario_id)
        if not ed:
            self._save_log(log, False, error="No encontrado")
            raise NotFoundException("Estado diario no encontrado")

        log.estado_diario_id = ed.id

        if nivel not in ("bajo", "medio", "alto"):
            self._save_log(log, False, error="Nivel inválido")
            raise BadRequestException("El campo nivel es obligatorio y debe ser bajo, medio o alto")

        agendar = bool(mensaje and mensaje.strip() and fecha_hora)

        if notificar_whatsapp and not agendar:
            self._save_log(log, False, error="WhatsApp requiere mensaje y fecha_hora")
            raise BadRequestException("Para notificar por WhatsApp debe indicar mensaje y fecha_hora")
        if notificar_whatsapp and not fecha_hora_whatsapp:
            self._save_log(log, False, error="Falta fecha_hora_whatsapp")
            raise BadRequestException("Indique la fecha y hora de envío del WhatsApp")

        usuario = None
        if agendar or username:
            if not username:
                self._save_log(log, False, error="Username requerido para agendar")
                raise BadRequestException("El campo username es obligatorio para agendar")

            usuario = self.user_repo.find_by_username(username)
            if not usuario:
                self._save_log(log, False, error="Username no existe")
                raise BadRequestException("username no existe")

        ed.pendiente = True
        ed.nivel_pendiente = nivel
        ed.fecha_pendiente = datetime.now(timezone.utc)
        ed.usuario_pendiente = usuario

        agenda = None
        if agendar:
            agenda = EstadoDiarioAgenda(
                estado_diario=ed,
                detalle=mensaje.strip(),
                fecha_hora=self._parse_fecha_hora(fecha_hora),
                nivel=nivel,
                usuario_registro=usuario,
                fecha_hora_registro=datetime.now(timezone.utc),
                notificar_whatsapp=notificar_whatsapp,
                whatsapp_telefono=(whatsapp_telefono or (usuario.telefono if usuario else None))
                    if notificar_whatsapp else None,
                fecha_hora_whatsapp=self._parse_fecha_hora(fecha_hora_whatsapp)
                    if notificar_whatsapp else None,
            )
            self.db.add(agenda)

        self.db.commit()

        # Sincronización con Google Calendar: best-effort, no debe romper la
        # respuesta si Google falla o el usuario no conectó su cuenta.
        if agenda is not None and usuario is not None:
            self.db.refresh(agenda)
            self.google_service.crear_o_actualizar_evento(agenda, usuario)
            self.db.commit()

        self._save_log(log, True, json.dumps({"exito": True}))
        return {"exito": True}

    def finalizar_agenda(self, agenda_id: int, marcar_resuelto: bool, current_user):
        log = self._create_log("finalizar_agenda", json.dumps({
            "agenda_id": agenda_id, "marcar_resuelto": marcar_resuelto,
        }))

        agenda = self.agenda_repo.find_by_id(agenda_id)
        if not agenda:
            self._save_log(log, False, error="Agenda no encontrada")
            raise NotFoundException("Recordatorio no encontrado")

        log.estado_diario_id = agenda.estado_diario_id

        agenda.finalizado = True
        agenda.fecha_finalizacion = datetime.now(timezone.utc)
        agenda.usuario_finaliza_id = current_user.id

        if marcar_resuelto:
            # Mismo comportamiento que el botón "Resolver" del resto de la
            # app: no se duplica lógica, solo se reutiliza.
            self.marcar_leido(agenda.estado_diario_id, current_user.id)

        # El evento se sincroniza en el calendario de quien lo creó, no en
        # el de quien lo finaliza (puede ser un admin finalizando por otro).
        dueno = agenda.usuario_registro or current_user
        self.google_service.finalizar_evento(agenda, dueno)

        self.db.commit()
        self._save_log(log, True, json.dumps({"exito": True}))
        return {"exito": True}

    def get_calendario(self, current_user):
        usuario_id = None if current_user.rol == "admin" else current_user.id
        agendas = self.agenda_repo.find_vigentes(usuario_id)

        recordatorios = [
            {
                "id": a.id,
                "estado_diario_id": a.estado_diario_id,
                "detalle": a.detalle,
                "fecha_hora": a.fecha_hora.isoformat(),
                "nivel": a.nivel,
                "usuario_registro": a.usuario_registro.username if a.usuario_registro else None,
                "movimiento_caratulado": a.estado_diario.caratulado if a.estado_diario else None,
                "movimiento_rol": a.estado_diario.rol if a.estado_diario else None,
                "movimiento_tribunal": a.estado_diario.tribunal if a.estado_diario else None,
            }
            for a in agendas
        ]
        return {"exito": True, "total": len(recordatorios), "recordatorios": recordatorios}

    def crear_agenda(self, estado_diario_id: int, detalle: str, fecha_hora_str: str,
                     username: Optional[str] = None):
        log = self._create_log("agenda", json.dumps({
            "detalle": detalle, "fecha_hora": fecha_hora_str, "username": username
        }))

        ed = self.repo.find_by_id(estado_diario_id)
        if not ed:
            self._save_log(log, False, error="No encontrado")
            raise NotFoundException("Estado diario no encontrado")

        log.estado_diario_id = ed.id

        try:
            fecha_hora_dt = datetime.strptime(fecha_hora_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            fecha_hora_dt = datetime.fromisoformat(fecha_hora_str)

        usuario = None
        if username:
            usuario = self.user_repo.find_by_username(username)
            if not usuario:
                self._save_log(log, False, error="Username no existe")
                raise BadRequestException("username no existe")

        agenda = EstadoDiarioAgenda(
            estado_diario=ed,
            detalle=detalle,
            fecha_hora=fecha_hora_dt,
            usuario_registro=usuario,
            fecha_hora_registro=datetime.now(timezone.utc),
        )
        self.db.add(agenda)
        self.db.commit()
        self.db.refresh(agenda)

        self._save_log(log, True, json.dumps({"exito": True, "id": agenda.id}))
        return {"exito": True, "id": agenda.id}

    def get_agendas(self, estado_diario_id: int):
        ed = self.repo.find_by_id(estado_diario_id)
        if not ed:
            raise NotFoundException("Estado diario no encontrado")

        agendas = self.agenda_repo.find_by_estado_diario(estado_diario_id)
        data = [
            {
                "id": a.id,
                "detalle": a.detalle,
                "fecha_hora": a.fecha_hora.isoformat() if a.fecha_hora else None,
                "fecha_hora_registro": a.fecha_hora_registro.isoformat() if a.fecha_hora_registro else None,
                "nivel": a.nivel,
                "finalizado": a.finalizado,
                "fecha_finalizacion": a.fecha_finalizacion.isoformat() if a.fecha_finalizacion else None,
                "notificar_whatsapp": a.notificar_whatsapp,
                "fecha_hora_whatsapp": a.fecha_hora_whatsapp.isoformat() if a.fecha_hora_whatsapp else None,
                "enviado": a.enviado,
                "fecha_envio": a.fecha_envio.isoformat() if a.fecha_envio else None,
                "google_event_id": a.google_event_id,
                "google_sync_error": a.google_sync_error,
                "usuario_registro": a.usuario_registro.username if a.usuario_registro else None,
            }
            for a in agendas
        ]
        return {"exito": True, "total": len(data), "agendas": data}

    def webhook_twilio(self, datos: dict):
        log = self._create_log("request-tw", json.dumps(datos))

        try:
            button_text = datos.get("ButtonText")
            button_payload = datos.get("ButtonPayload")

            if button_payload and str(button_payload).isdigit():
                ed = self.repo.find_by_id(int(button_payload))
                if ed:
                    log.estado_diario_id = ed.id
                    if button_text and button_text.strip().lower() == "resuelto":
                        ed.leido = True
                        ed.fecha_leido = datetime.now(timezone.utc)

            self.db.commit()
            self._save_log(log, True, json.dumps({"exito": True}))
            return {"exito": True}
        except Exception as e:
            self._save_log(log, False, error=str(e))
            raise

    def get_movimiento_detalle(self, estado_diario_id: int):
        ed = self.repo.find_by_id(estado_diario_id)
        if not ed:
            raise NotFoundException("Estado diario no encontrado")
        return {"exito": True, "movimiento": self._map_movimiento(ed, include_pendiente=True)}

    def _map_movimiento(self, m: EstadoDiario, include_pendiente: bool = False) -> dict:
        data = {
            "id": m.id,
            "jurisdiccion": m.jurisdiccion.nombre if m.jurisdiccion else None,
            "jurisdiccion_id": m.jurisdiccion_id,
            "rol": m.rol,
            "rol_unico": m.rol_unico,
            "fecha_ingreso": m.fecha_ingreso.isoformat() if m.fecha_ingreso else None,
            "caratulado": m.caratulado,
            "tribunal": m.tribunal,
            "estado": m.estado,
            "tipo_causa": m.tipo_causa,
            "ubicacion": m.ubicacion,
            "fecha_ubicacion": m.fecha_ubicacion.isoformat() if m.fecha_ubicacion else None,
            "corte": m.corte,
            "leido": m.leido,
            "fecha_leido": m.fecha_leido.isoformat() if m.fecha_leido else None,
            "pendiente": m.pendiente,
            "rut": m.estado_diario_origen.rut if m.estado_diario_origen else None,
            "fecha_estado_diario": m.estado_diario_origen.fecha.isoformat() if m.estado_diario_origen and m.estado_diario_origen.fecha else None,
        }
        if include_pendiente:
            data["nivel_pendiente"] = m.nivel_pendiente
            data["fecha_pendiente"] = m.fecha_pendiente.isoformat() if m.fecha_pendiente else None
            data["usuario_pendiente"] = m.usuario_pendiente.username if m.usuario_pendiente else None
        return data
