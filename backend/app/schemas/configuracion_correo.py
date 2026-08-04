from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, Field


class ConfiguracionCorreoResponse(BaseModel):
    """La contraseña nunca se devuelve; solo si hay una guardada."""

    activo: bool
    host: str
    puerto: int
    usar_ssl: bool
    usuario: str | None
    carpeta: str
    tiene_password: bool = False
    remitentes_permitidos: str | None
    # Filtro general: si está, el asunto debe contenerlo para procesar el correo.
    asunto_contiene: str | None
    # Identificación del reporte por asunto. Reemplazan al nombre del archivo,
    # que el PJUD cambia sin aviso.
    asunto_estado_diario: str | None = None
    asunto_movimientos: str | None = None
    asunto_audiencias: str | None = None
    # RUT del dueño de la casilla, respaldo cuando el nombre no lo trae.
    rut: str | None = None
    max_tamano_mb: int
    hora_ejecucion: time | None
    marcar_como_leido: bool
    ultima_ejecucion: datetime | None
    ultimo_resultado: str | None

    class Config:
        from_attributes = True


class ConfiguracionCorreoUpdate(BaseModel):
    activo: bool = False
    host: str = Field(default="imap.gmail.com", min_length=1, max_length=255)
    puerto: int = Field(default=993, ge=1, le=65535)
    usar_ssl: bool = True
    usuario: Optional[str] = Field(default=None, max_length=255)
    # Vacío o ausente = conservar la contraseña ya guardada
    password: Optional[str] = None
    carpeta: str = Field(default="INBOX", min_length=1, max_length=255)
    remitentes_permitidos: Optional[str] = None
    asunto_contiene: Optional[str] = Field(default=None, max_length=255)
    asunto_estado_diario: Optional[str] = Field(default=None, max_length=255)
    asunto_movimientos: Optional[str] = Field(default=None, max_length=255)
    asunto_audiencias: Optional[str] = Field(default=None, max_length=255)
    rut: Optional[str] = Field(default=None, max_length=20)
    max_tamano_mb: int = Field(default=25, ge=1, le=100)
    hora_ejecucion: Optional[time] = None
    marcar_como_leido: bool = True


class ProbarConexionRequest(BaseModel):
    # Permite probar una contraseña recién escrita sin guardarla antes
    password: Optional[str] = None


class OperacionResponse(BaseModel):
    exito: bool
    mensaje: str


class RevisarResponse(BaseModel):
    exito: bool
    mensaje: str
    procesados: int = 0
    importados: int = 0
    descartados: int = 0
    duplicados: int = 0
    errores: int = 0


class CorreoLogResponse(BaseModel):
    id: int
    fecha: datetime
    remitente: str | None
    asunto: str | None
    nombre_archivo: str | None
    resultado: str
    detalle: str | None
    estado_diario_origen_id: int | None
    movimientos_importados: int | None
    disparo: str

    class Config:
        from_attributes = True


class CorreoLogListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int
    total_pages: int
    registros: list[CorreoLogResponse]
