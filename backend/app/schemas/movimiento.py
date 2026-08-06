"""Schemas del módulo Movimientos (solo consulta y carga).

A diferencia de EstadoDiario no hay schemas de acciones (leído / pendiente /
agenda): este reporte lista el estado procesal de las causas, no actuaciones
que haya que despachar.
"""

from datetime import date, datetime

from pydantic import BaseModel


class MovimientoResponse(BaseModel):
    id: int
    origen_id: int
    # Nombre de la hoja del Excel: Civil, Familia, Laboral, Cobranza, Penal,
    # Corte Apelaciones, Corte Suprema.
    materia: str | None = None
    rol: str | None = None
    era: str | None = None
    tribunal: str | None = None
    corte: str | None = None
    caratulado: str | None = None
    fecha_ingreso: date | None = None
    estado_causa: str | None = None
    institucion: str | None = None
    ubicacion: str | None = None
    fecha_ubicacion: date | None = None
    jurisdiccion_id: int | None = None
    # Datos del archivo del que vino la fila.
    rut: str | None = None
    fecha_archivo: date | None = None
    nombre_archivo: str | None = None

    class Config:
        from_attributes = True

    @classmethod
    def from_model(cls, m) -> "MovimientoResponse":
        origen = m.estado_diario_origen
        return cls(
            id=m.id,
            origen_id=m.estado_diario_origen_id,
            materia=m.materia,
            rol=m.rol,
            era=m.era,
            tribunal=m.tribunal,
            corte=m.corte,
            caratulado=m.caratulado,
            fecha_ingreso=m.fecha_ingreso,
            estado_causa=m.estado_causa,
            institucion=m.institucion,
            ubicacion=m.ubicacion,
            fecha_ubicacion=m.fecha_ubicacion,
            jurisdiccion_id=m.jurisdiccion_id,
            rut=origen.rut if origen else None,
            fecha_archivo=origen.fecha if origen else None,
            nombre_archivo=origen.nombre_archivo if origen else None,
        )


class MovimientoListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    movimientos: list[MovimientoResponse]


class ConteoMateria(BaseModel):
    materia: str | None = None
    total: int


class MovimientoResumenResponse(BaseModel):
    exito: bool = True
    total: int
    por_materia: list[ConteoMateria]
    estados_causa: list[str]


class MovimientoOrigenResponse(BaseModel):
    id: int
    rut: str | None = None
    fecha: date | None = None
    nombre_archivo: str | None = None
    fecha_carga: datetime
    usuario_carga: str | None = None
    total_movimientos: int = 0


class MovimientoOrigenListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    origenes: list[MovimientoOrigenResponse]


class MovimientoUploadResponse(BaseModel):
    exito: bool
    mensaje: str | None = None
    rut: str | None = None
    fecha: str | None = None
    origen_id: int | None = None
    movimientos_importados: int | None = None
    por_materia: dict[str, int] | None = None


# ── Causas de corte (submenú Corte) ───────────────────────
# Van en su propia tabla: las hojas de corte del reporte traen Era, Ubicación y
# Fecha Ubicación, que las hojas de materia no tienen, y les falta el tribunal.


class MovimientoCorteResponse(BaseModel):
    id: int
    # 'suprema' | 'apelaciones'. Explica por qué unas columnas vienen vacías.
    tipo: str
    rol: str | None = None
    era: str | None = None
    fecha_ingreso: date | None = None
    caratulado: str | None = None
    estado_causa: str | None = None
    institucion: str | None = None
    # Solo Corte de Apelaciones.
    corte: str | None = None
    ubicacion: str | None = None
    fecha_ubicacion: date | None = None
    fecha_archivo: date | None = None


class MovimientoCorteListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    cortes: list[MovimientoCorteResponse]
    cortes_disponibles: list[str] = []
