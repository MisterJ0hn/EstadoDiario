"""Schemas del módulo Audiencias (consulta, carga y calendario).

Como el módulo Movimientos, no hay schemas de acciones (leído / pendiente /
agenda): una audiencia la fija el tribunal, el sistema solo la informa. Lo que
sí tiene y Movimientos no es la publicación en Google Calendar.
"""

from datetime import date, datetime, time

from pydantic import BaseModel


class AudienciaResponse(BaseModel):
    id: int
    origen_id: int | None = None
    # Nombre de la hoja del Excel: Familia, Laboral, Penal.
    materia: str | None = None
    # "Rit" del Excel. La hoja Penal no lo trae.
    rol: str | None = None
    ruc: str | None = None
    caratulado: str | None = None
    tribunal: str | None = None
    sala: str | None = None
    tipo_audiencia: str | None = None
    juez: str | None = None
    # Solo la hoja Penal.
    estado: str | None = None
    fecha_audiencia: date
    # Hora de reloj del tribunal (America/Santiago), no un instante UTC.
    hora: time | None = None
    jurisdiccion_id: int | None = None
    # Estado de la publicación en el Google Calendar del dueño.
    en_google_calendar: bool = False
    google_sync_error: str | None = None
    # Datos del archivo del que vino la fila.
    rut: str | None = None
    fecha_archivo: date | None = None
    nombre_archivo: str | None = None

    class Config:
        from_attributes = True

    @classmethod
    def from_model(cls, a) -> "AudienciaResponse":
        origen = a.estado_diario_origen
        return cls(
            id=a.id,
            origen_id=a.estado_diario_origen_id,
            materia=a.materia,
            rol=a.rol,
            ruc=a.ruc,
            caratulado=a.caratulado,
            tribunal=a.tribunal,
            sala=a.sala,
            tipo_audiencia=a.tipo_audiencia,
            juez=a.juez,
            estado=a.estado,
            fecha_audiencia=a.fecha_audiencia,
            hora=a.hora,
            jurisdiccion_id=a.jurisdiccion_id,
            en_google_calendar=a.google_event_id is not None,
            google_sync_error=a.google_sync_error,
            rut=origen.rut if origen else None,
            fecha_archivo=origen.fecha if origen else None,
            nombre_archivo=origen.nombre_archivo if origen else None,
        )


class AudienciaListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    audiencias: list[AudienciaResponse]


class ConteoMateriaAudiencia(BaseModel):
    materia: str | None = None
    total: int


class AudienciaResumenResponse(BaseModel):
    exito: bool = True
    total: int
    por_materia: list[ConteoMateriaAudiencia]
    tipos_audiencia: list[str]


class AudienciaOrigenResponse(BaseModel):
    id: int
    rut: str | None = None
    # Inicio del rango que cubre el archivo.
    fecha: date | None = None
    nombre_archivo: str | None = None
    fecha_carga: datetime
    usuario_carga: str | None = None
    total_audiencias: int = 0


class AudienciaOrigenListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    origenes: list[AudienciaOrigenResponse]


class AudienciaUploadResponse(BaseModel):
    exito: bool
    mensaje: str | None = None
    rut: str | None = None
    fecha: str | None = None
    origen_id: int | None = None
    # Nombre heredado del contrato común de importación (los tres tipos de
    # archivo lo reportan igual); acá son las audiencias que trajo el archivo.
    movimientos_importados: int | None = None
    audiencias_nuevas: int | None = None
    # Ya existían de un archivo anterior traslapado: se refrescaron, no se
    # duplicaron.
    audiencias_actualizadas: int | None = None
    # Filas del Excel descartadas por no traer fecha de audiencia utilizable.
    audiencias_sin_fecha: int | None = None
    por_materia: dict[str, int] | None = None


class SincronizarGoogleResponse(BaseModel):
    exito: bool = True
    sincronizadas: int = 0
    # Quedaron sin publicar (sin cuenta conectada o con error de Google).
    pendientes: int = 0
    mensaje: str | None = None
