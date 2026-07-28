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

logger = logging.getLogger(__name__)


class EstadoDiarioService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = EstadoDiarioRepository(db)
        self.agenda_repo = EstadoDiarioAgendaRepository(db)
        self.user_repo = UsuarioRepository(db)
        self.log_repo = ApiLogRepository(db)

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

    def marcar_pendiente(self, estado_diario_id: int, nivel: str, username: Optional[str] = None,
                         mensaje: Optional[str] = None, fecha_hora: Optional[str] = None):
        log = self._create_log("pendiente", json.dumps({
            "nivel": nivel, "username": username, "mensaje": mensaje, "fecha_hora": fecha_hora
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

        if agendar:
            try:
                fecha_hora_dt = datetime.strptime(fecha_hora, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                fecha_hora_dt = datetime.fromisoformat(fecha_hora)

            agenda = EstadoDiarioAgenda(
                estado_diario=ed,
                detalle=mensaje.strip(),
                fecha_hora=fecha_hora_dt,
                usuario_registro=usuario,
                fecha_hora_registro=datetime.now(timezone.utc),
            )
            self.db.add(agenda)

        self.db.commit()
        self._save_log(log, True, json.dumps({"exito": True}))
        return {"exito": True}

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
                "enviado": a.enviado,
                "fecha_envio": a.fecha_envio.isoformat() if a.fecha_envio else None,
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
