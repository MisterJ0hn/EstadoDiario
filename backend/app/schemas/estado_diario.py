from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Estado Diario Origen ──────────────────────────────────
class EstadoDiarioOrigenResponse(BaseModel):
    id: int
    rut: str | None
    fecha: date | None
    # 'estado_diario' | 'movimientos'. Separa las pestañas de la vista Archivos.
    tipo: str = "estado_diario"
    nombre_archivo: str | None
    url: str | None
    fecha_carga: datetime
    usuario_carga: str | None = None
    total_movimientos: int = 0
    # Cómo entró el archivo: 'correo' si llegó por la casilla de ingesta,
    # 'manual' si alguien lo subió. No se puede deducir de `usuario_carga`: la
    # importación por correo también deja usuario (el que disparó la revisión, o
    # el del cron), así que se resuelve por la bitácora de correo, que es la que
    # sabe qué mensaje produjo qué archivo.
    via: str = "manual"

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


class MarcarLeidoRequest(BaseModel):
    """Body opcional de "marcar resuelto". Existe solo por la observación; si
    no se envía nada, el movimiento igual se marca resuelto."""

    observacion: str | None = None


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
    # Qué se hizo con el callback (resuelto, postergado, o por qué se ignoró).
    # Queda también en api_llamado_estado_diario.json_response.
    mensaje: Optional[str] = None


# ── Response genérico ─────────────────────────────────────
class ErrorResponse(BaseModel):
    exito: bool = False
    mensaje: str


# ── Causas de corte (submenú Corte) ───────────────────────
# Van en su propia tabla porque las hojas de corte del Excel no tienen las
# mismas columnas que las de materia. Ver `app/models/estado_diario_corte.py`.


class CorteResponse(BaseModel):
    id: int
    # 'suprema' | 'apelaciones'. Distingue de qué hoja salió la fila, que es
    # lo que explica por qué unas columnas vienen vacías y otras no.
    tipo: str
    numero_ingreso: str | None = None
    fecha_ingreso: date | None = None
    caratulado: str | None = None
    # Solo Corte de Apelaciones.
    ubicacion: str | None = None
    fecha_ubicacion: date | None = None
    corte: str | None = None
    # Solo Corte Suprema.
    tipo_recurso: str | None = None
    # Fecha del archivo que la trajo.
    fecha_archivo: date | None = None


class CorteListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    cortes: list[CorteResponse]
    # Nombres de corte presentes, para el combo del filtro.
    cortes_disponibles: list[str] = []


class FechaInicialResponse(BaseModel):
    """Día que las pantallas de estado diario proponen al abrirse.

    `motivo` explica de dónde salió, y las pantallas lo usan para rotular el
    chip del filtro: no es lo mismo "ayer" que "el último día con datos", y sin
    decirlo el usuario no entiende por qué está viendo una fecha de hace dos
    semanas.
    """

    exito: bool = True
    # Nula cuando el estudio no tiene ningún estado diario cargado.
    fecha: date | None = None
    # "ayer" | "ultimo" | None
    motivo: str | None = None
