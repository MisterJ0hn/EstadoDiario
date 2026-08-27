"""Schemas de la consulta de movimientos PJUD (api-pjud.codifica.cl).

Espejan los del proveedor (`MovimientosResponse`, `CausaDetalle`, etc.) pero
solo con lo que la pantalla necesita mostrar: nada de anexos de exhortos ni de
información de receptor, que la API trae pero acá no se usan todavía.
"""

from pydantic import BaseModel


class PjudCuaderno(BaseModel):
    id: int
    nombre: str


class PjudCausaDetalle(BaseModel):
    identificador: str
    estado: str
    rol: str | None = None
    caratula: str | None = None
    tribunal: str | None = None
    fecha_ingreso: str | None = None
    etapa: str | None = None
    estado_proceso: str | None = None
    est_adm: str | None = None
    fecha_ultima_sincronizacion: str | None = None
    cuadernos: list[PjudCuaderno] = []


class PjudMovimientoItem(BaseModel):
    """Una fila de `historia`: un trámite del cuaderno."""

    folio: int | None = None
    etapa: str | None = None
    tramite: str | None = None
    descripcion_tramite: str | None = None
    fecha_tramite: str | None = None
    foja: int | None = None
    doc: str | None = None
    documento_url: str | None = None


class PjudLitiganteItem(BaseModel):
    participante: str | None = None
    rut: str | None = None
    persona: str | None = None
    razon_social: str | None = None


class PjudNotificacionItem(BaseModel):
    tipo_notificacion: str | None = None
    estado_notificacion: str | None = None
    fecha_tramite: str | None = None
    tipo_part: str | None = None
    nombre: str | None = None
    tramite: str | None = None
    observacion_fallida: str | None = None


class PjudEscritoResolverItem(BaseModel):
    doc: str | None = None
    tipo_escrito: str | None = None
    solicitante: str | None = None
    fecha_ingreso: str | None = None


class PjudMovimientosResponse(BaseModel):
    exito: bool = True
    causa: PjudCausaDetalle
    historia: list[PjudMovimientoItem] = []
    litigantes: list[PjudLitiganteItem] = []
    notificaciones: list[PjudNotificacionItem] = []
    escritos_resolver: list[PjudEscritoResolverItem] = []


class PjudErrorResponse(BaseModel):
    exito: bool = False
    mensaje: str


class PjudDisponibleResponse(BaseModel):
    disponible: bool
