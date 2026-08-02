from datetime import datetime

from pydantic import BaseModel, Field


class CampoDisponible(BaseModel):
    clave: str
    etiqueta: str


class FuenteDisponible(BaseModel):
    fuente: str
    etiqueta: str
    campos: list[CampoDisponible]


class CamposDisponiblesResponse(BaseModel):
    exito: bool = True
    fuentes: list[FuenteDisponible]


class ReportePlantillaRequest(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    descripcion: str | None = None
    fuente: str = "estado_diario"
    # El ORDEN de esta lista es el orden de columnas del Excel.
    campos: list[str] = Field(..., min_length=1)
    # Filtros opcionales: estado, nivel, jurisdiccion_id, materia,
    # estado_causa, fecha_desde, fecha_hasta.
    filtros: dict = Field(default_factory=dict)


class ReportePlantillaResponse(BaseModel):
    id: int
    nombre: str
    descripcion: str | None = None
    fuente: str
    campos: list[str]
    filtros: dict
    fecha_creacion: datetime
    fecha_modificacion: datetime
    ultima_generacion: datetime | None = None
    ultimo_resultado: str | None = None

    @classmethod
    def from_model(cls, p) -> "ReportePlantillaResponse":
        return cls(
            id=p.id,
            nombre=p.nombre,
            descripcion=p.descripcion,
            fuente=p.fuente,
            campos=p.lista_campos,
            filtros=p.dict_filtros,
            fecha_creacion=p.fecha_creacion,
            fecha_modificacion=p.fecha_modificacion,
            ultima_generacion=p.ultima_generacion,
            ultimo_resultado=p.ultimo_resultado,
        )


class ReportePlantillaListResponse(BaseModel):
    exito: bool = True
    total: int
    plantillas: list[ReportePlantillaResponse]


class GenerarReporteResponse(BaseModel):
    exito: bool = True
    mensaje: str
    archivo: str | None = None


# ── Configuración SMTP (administración) ───────────────────

class ConfiguracionSmtpResponse(BaseModel):
    activo: bool
    host: str
    puerto: int
    usar_tls: bool
    usar_ssl: bool
    usuario: str | None = None
    # Nunca se devuelve la contraseña, solo si hay una guardada.
    tiene_password: bool = False
    remitente_email: str | None = None
    remitente_nombre: str | None = None
    ultimo_envio: datetime | None = None
    ultimo_resultado: str | None = None


class ConfiguracionSmtpUpdate(BaseModel):
    activo: bool = False
    host: str = "smtp.gmail.com"
    puerto: int = 587
    usar_tls: bool = True
    usar_ssl: bool = False
    usuario: str | None = None
    # Vacío = no cambiar la contraseña ya guardada.
    password: str | None = None
    remitente_email: str | None = None
    remitente_nombre: str | None = "Estado Diario"


class OperacionResponse(BaseModel):
    exito: bool
    mensaje: str
