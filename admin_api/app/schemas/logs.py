"""Contrato de la bitácora de actividad vista desde la consola."""

from datetime import datetime

from pydantic import BaseModel


class LogActividadResponse(BaseModel):
    id: int
    fecha_hora: datetime
    # Módulo de la aplicación del estudio: estado_diario, audiencias, reportes...
    modulo: str
    # Qué se hizo: crear, editar, eliminar, importar, login.
    accion: str
    usuario_id: int | None = None
    # Nombre de quien la hizo. Nulo en los intentos de login fallidos, donde
    # todavía no hay usuario resuelto: es información, no un dato que falte.
    usuario: str | None = None
    ip: str | None = None
    detalle: str | None = None


class LogActividadesListResponse(BaseModel):
    exito: bool = True
    cliente_id: int
    cliente_nombre: str
    total: int
    page: int
    total_pages: int
    # Los módulos y acciones que existen en ESTA bitácora, para armar los
    # filtros con opciones que devuelven algo.
    modulos: list[str] = []
    acciones: list[str] = []
    registros: list[LogActividadResponse]
