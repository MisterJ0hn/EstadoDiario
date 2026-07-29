from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Estado Diario Origen ──────────────────────────────────
class EstadoDiarioOrigenResponse(BaseModel):
    id: int
    rut: str | None
    fecha: date | None
    nombre_archivo: str | None
    url: str | None
    fecha_carga: datetime
    usuario_carga: str | None = None
    total_movimientos: int = 0

    class Config:
        from_attributes = True


class EstadoDiarioOrigenListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int
    total_pages: int
    origenes: list[EstadoDiarioOrigenResponse]


class EstadoDiarioOrigenCreate(BaseModel):
    rut: str = Field(..., min_length=1, max_length=20, examples=["16952077-1"])
    fecha: date


# ── Estado Diario (Movimiento) ────────────────────────────
class MovimientoResponse(BaseModel):
    id: int
    jurisdiccion: str | None = None
    jurisdiccion_id: int | None = None
    rol: str | None
    rol_unico: str | None
    fecha_ingreso: date | None
    caratulado: str | None
    tribunal: str | None
    estado: str | None
    tipo_causa: str | None
    ubicacion: str | None
    fecha_ubicacion: date | None
    corte: str | None
    leido: bool
    fecha_leido: datetime | None = None
    pendiente: bool
    nivel_pendiente: str | None = None
    fecha_pendiente: datetime | None = None
    usuario_pendiente: str | None = None
    rut: str | None = None
    fecha_estado_diario: date | None = None

    class Config:
        from_attributes = True


class MovimientoListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    movimientos: list[MovimientoResponse]


class MarcarLeidoResponse(BaseModel):
    exito: bool = True


class MarcarPendienteRequest(BaseModel):
    nivel: str = Field(..., pattern="^(bajo|medio|alto)$")
    username: str | None = None
    mensaje: str | None = None
    fecha_hora: str | None = None
    # Recordatorio por WhatsApp (Twilio): opcional, requiere mensaje+fecha_hora
    # (es decir, que además se esté creando la entrada de agenda).
    notificar_whatsapp: bool = False
    whatsapp_telefono: str | None = None
    fecha_hora_whatsapp: str | None = None


# ── Agenda / Recordatorio ─────────────────────────────────
class AgendaResponse(BaseModel):
    id: int
    detalle: str
    fecha_hora: datetime
    fecha_hora_registro: datetime
    nivel: str = "medio"
    finalizado: bool = False
    fecha_finalizacion: datetime | None = None
    notificar_whatsapp: bool = False
    fecha_hora_whatsapp: datetime | None = None
    enviado: bool
    fecha_envio: datetime | None = None
    google_event_id: str | None = None
    google_sync_error: str | None = None
    usuario_registro: str | None = None

    class Config:
        from_attributes = True


class AgendaCreateRequest(BaseModel):
    detalle: str = Field(..., min_length=1)
    fecha_hora: str = Field(..., examples=["2026-07-28 10:00:00"])
    username: str | None = None


class AgendaListResponse(BaseModel):
    exito: bool = True
    total: int
    agendas: list[AgendaResponse]


class FinalizarAgendaRequest(BaseModel):
    marcar_resuelto: bool = False


class RecordatorioVigenteResponse(BaseModel):
    id: int
    estado_diario_id: int
    detalle: str
    fecha_hora: datetime
    nivel: str
    usuario_registro: str | None = None
    movimiento_caratulado: str | None = None
    movimiento_rol: str | None = None
    movimiento_tribunal: str | None = None


class CalendarioResponse(BaseModel):
    exito: bool = True
    total: int
    recordatorios: list[RecordatorioVigenteResponse]


# ── Webhook ───────────────────────────────────────────────
class WebhookResponse(BaseModel):
    exito: bool = True


# ── Response genérico ─────────────────────────────────────
class ErrorResponse(BaseModel):
    exito: bool = False
    mensaje: str
