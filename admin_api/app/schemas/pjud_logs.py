"""Contrato del log de consultas a api-pjud.codifica.cl, visto desde la consola."""

from datetime import datetime

from pydantic import BaseModel


class PjudLlamadoResponse(BaseModel):
    id: int
    fecha_hora: datetime
    cliente_id: int | None = None
    # Nombre del estudio que disparó la consulta. Nulo si el cliente se borró.
    cliente_nombre: str | None = None
    rol: str | None = None
    tribunal: str | None = None
    # true = el usuario apretó "Actualizar desde el PJUD".
    forzar: bool = False
    # 'listo' | 'sincronizando' | 'error'.
    resultado: str
    http_status: int | None = None
    # El aviso de "sincronizando" o el texto del error. Nulo en 'listo'.
    mensaje: str | None = None
    # Notas técnicas paso a paso: qué respondió cada endpoint de api-pjud.
    diagnostico: str | None = None
    duracion_ms: int | None = None


class PjudLlamadosListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int
    total_pages: int
    # Conteo por resultado de los últimos 7 días, para la cabecera.
    resumen: dict[str, int] = {}
    registros: list[PjudLlamadoResponse]
