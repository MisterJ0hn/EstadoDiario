"""Schemas del módulo Causas (solo carga y consulta).

Es la **cartera** del estudio: todas sus causas, se hayan movido o no. Por eso
no hay schemas de acciones (leído / pendiente / recordatorio) como en estado
diario: acá no hay nada que despachar.
"""

from datetime import date

from pydantic import BaseModel


class CausaResponse(BaseModel):
    id: int
    origen_id: int
    # Nombre de la hoja del Excel: Civil, Laboral, Penal, Cobranza, Familia.
    materia: str | None = None
    # Solo la hoja Penal lo trae.
    tipo_causa: str | None = None
    # "Rol" en Civil/Laboral/Cobranza, "Rit" en Penal/Familia: mismo dato.
    rol: str | None = None
    ruc: str | None = None
    tribunal: str | None = None
    fecha_ingreso: date | None = None
    caratulado: str | None = None
    estado_causa: str | None = None
    institucion: str | None = None
    jurisdiccion_id: int | None = None
    # Datos del archivo del que vino la fila.
    rut: str | None = None
    fecha_archivo: date | None = None
    nombre_archivo: str | None = None

    # ── Cruce con los otros reportes ──
    # Última vez que la causa apareció en algún reporte, y en cuál. Nulo = nunca
    # se la vio fuera del Excel de la cartera.
    ultima_actividad: date | None = None
    origen_actividad: str | None = None
    # La próxima audiencia agendada, desde hoy. Se resuelve al consultar, no se
    # guarda: deja de ser próxima cuando pasa el día, sin que entre ningún
    # archivo.
    proxima_audiencia: date | None = None

    @classmethod
    def from_model(cls, c) -> "CausaResponse":
        origen = c.estado_diario_origen
        return cls(
            id=c.id,
            origen_id=c.estado_diario_origen_id,
            materia=c.materia,
            tipo_causa=c.tipo_causa,
            rol=c.rol,
            ruc=c.ruc,
            tribunal=c.tribunal,
            fecha_ingreso=c.fecha_ingreso,
            caratulado=c.caratulado,
            estado_causa=c.estado_causa,
            institucion=c.institucion,
            jurisdiccion_id=c.jurisdiccion_id,
            rut=origen.rut if origen else None,
            fecha_archivo=origen.fecha if origen else None,
            nombre_archivo=origen.nombre_archivo if origen else None,
            ultima_actividad=c.ultima_actividad,
            origen_actividad=c.origen_actividad,
            # La cuelga el repositorio sobre el objeto; en otros usos no está.
            proxima_audiencia=getattr(c, "proxima_audiencia", None),
        )


class CausaListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    causas: list[CausaResponse]


class ConteoMateria(BaseModel):
    materia: str | None = None
    total: int


class CausaResumenResponse(BaseModel):
    """Lo que alimenta las pestañas y el combo de estado del listado."""

    exito: bool = True
    total: int
    por_materia: list[ConteoMateria]
    estados_causa: list[str]


class CausaCorteResponse(BaseModel):
    id: int
    # 'suprema' o 'apelaciones': de qué hoja salió, y por qué hay celdas vacías.
    tipo: str
    rol: str | None = None
    era: str | None = None
    fecha_ingreso: date | None = None
    caratulado: str | None = None
    # Suprema lo llama "Estado Causa" y Apelaciones "Estado Procesal".
    estado_procesal: str | None = None
    institucion: str | None = None
    # Las tres siguientes solo vienen en la hoja de Apelaciones.
    corte: str | None = None
    ubicacion: str | None = None
    fecha_ubicacion: date | None = None
    fecha_archivo: date | None = None


class CausaCorteListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    cortes: list[CausaCorteResponse]
    # Nombres de corte presentes, para el combo del filtro.
    cortes_disponibles: list[str] = []


class CargarCausasResponse(BaseModel):
    exito: bool = True
    mensaje: str
    origen_id: int
    causas_importadas: int
    cortes_importados: int
    por_materia: dict[str, int] = {}
