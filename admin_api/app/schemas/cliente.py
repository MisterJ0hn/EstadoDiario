"""Contratos de la consola de administración de la plataforma.

Los nombres de los campos siguen el contrato que ya consume la SPA
(`admin_app/src/app/core/models/admin.model.ts`). Donde no calzan con los del
modelo se traduce acá o en el servicio, nunca en el router.

Ahora que la SPA se compila aparte, este archivo y ese `.ts` son las dos caras
de un mismo contrato y se cambian juntos: no hay compilador que avise si se
separan.
"""

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field

# Estado de la base de datos del cliente. `en_cola` y `creando` existen porque
# crear una base toma segundos: hasta que llega a `listo` el cliente aparece en
# la lista pero sus usuarios no pueden entrar, y la consola tiene que decirlo.
EstadoAprovisionamiento = Literal["en_cola", "creando", "listo", "error"]


class ClienteCreate(BaseModel):
    """Alta de un cliente. El guid y la base de datos los genera el backend: no
    se aceptan por parámetro para que nadie pueda apuntar a una base que ya
    existe.

    No incluye el primer usuario: los usuarios se crean después, desde la ficha
    del cliente, y solo cuando su base esté lista.
    """

    nombre: str = Field(..., min_length=2, max_length=255)
    rut: str = Field(..., min_length=3, max_length=20, examples=["76.543.210-K"])
    correo: str | None = Field(default=None, max_length=255)


class ClienteUpdate(BaseModel):
    """Edición de la ficha. No incluye guid, base de datos ni RUT: el guid y la
    base identifican la base de datos (cambiarlos la dejaría inalcanzable) y el
    RUT es la credencial con la que el estudio inicia sesión."""

    nombre: str = Field(..., min_length=2, max_length=255)
    correo: str | None = Field(default=None, max_length=255)
    activo: bool = True


class ClienteResponse(BaseModel):
    id: int
    nombre: str
    # Con guion y dígito verificador: 12345678-9. Sale descifrado.
    rut: str
    guid: str
    correo: str | None
    # Casilla de ingesta: <guid>@<dominio>.
    inbox: str
    activo: bool
    fecha_creacion: datetime
    aprovisionamiento: EstadoAprovisionamiento
    # Qué falló, cuando `aprovisionamiento` es `error`.
    aprovisionamiento_detalle: str | None = None
    total_usuarios: int = 0


class ClienteListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    clientes: list[ClienteResponse]


class AprovisionamientoEstado(BaseModel):
    """Respuesta corta del polling de aprovisionamiento."""

    cliente_id: int
    estado: EstadoAprovisionamiento
    detalle: str | None = None


# ── Dashboard ─────────────────────────────────────────────


class ClienteActividad(BaseModel):
    """Fila del dashboard: el cliente más su pulso de actividad."""

    id: int
    nombre: str
    rut: str
    inbox: str
    # Suspendido = sigue en la tabla, pero no cuenta para los KPIs de actividad:
    # que no reciba archivos es lo esperado, no una caída.
    activo: bool
    total_usuarios: int
    aprovisionamiento: EstadoAprovisionamiento
    # Última vez que entró un archivo por cualquier vía. Null = nunca.
    ultima_importacion: datetime | None
    # Días desde `ultima_importacion`. Null = nunca importó; es el criterio de
    # orden de la tabla.
    dias_sin_importar: int | None
    movimientos_periodo: int


class ClienteConProblema(BaseModel):
    """Cliente cuya creación de base de datos falló."""

    id: int
    nombre: str
    detalle: str | None = None


class DashboardKpis(BaseModel):
    clientes_activos: int
    clientes_suspendidos: int
    usuarios_habilitados: int
    # Activos que no reciben archivos hace más de `umbral_sin_importar` días.
    clientes_sin_importar: int


class AdminDashboard(BaseModel):
    dias: int
    desde: date
    hasta: date
    kpis: DashboardKpis
    umbral_sin_importar: int
    aprovisionamientos_en_curso: int
    aprovisionamientos_con_error: list[ClienteConProblema]
    clientes: list[ClienteActividad]


# ── Casilla de ingesta del cliente ────────────────────────


class ClienteInbox(BaseModel):
    # <guid>@<dominio>. La genera el backend, no se edita.
    direccion_por_defecto: str
    # true = el cliente lee de su propia casilla IMAP y no de la del sistema.
    usar_casilla_propia: bool
    host: str
    puerto: int
    usar_ssl: bool
    usuario: str | None
    # El backend nunca devuelve la contraseña, solo si hay una guardada.
    tiene_password: bool
    carpeta: str
    remitentes_permitidos: str | None
    asunto_estado_diario: str | None
    asunto_movimientos: str | None
    asunto_audiencias: str | None
    hora_ejecucion: time | None
    ultima_ejecucion: datetime | None
    ultimo_resultado: str | None


class ClienteInboxUpdate(BaseModel):
    usar_casilla_propia: bool = False
    host: str = Field(default="imap.gmail.com", max_length=255)
    puerto: int = Field(default=993, ge=1, le=65535)
    usar_ssl: bool = True
    usuario: str | None = Field(default=None, max_length=255)
    # Vacío = conservar la contraseña ya guardada.
    password: str | None = Field(default=None, max_length=255)
    carpeta: str = Field(default="INBOX", max_length=255)
    remitentes_permitidos: str | None = None
    asunto_estado_diario: str | None = Field(default=None, max_length=255)
    asunto_movimientos: str | None = Field(default=None, max_length=255)
    asunto_audiencias: str | None = Field(default=None, max_length=255)
    hora_ejecucion: time | None = None


class ProbarInboxRequest(BaseModel):
    """Permite probar una contraseña recién escrita antes de guardarla."""

    password: str | None = None


# ── Configuración transversal del sistema ─────────────────


class ConfiguracionSistemaResponse(BaseModel):
    # Días que se conserva el log de actividades antes de purgarse.
    retencion_log_dias: int
    ultima_purga: datetime | None
    # Registros que hay hoy en el log (sumando todos los clientes) y cuántos
    # borraría la política actual si se purgara ahora: sirven para dimensionar
    # el cambio antes de guardarlo.
    registros_log: int
    registros_a_purgar: int


class ConfiguracionSistemaUpdate(BaseModel):
    retencion_log_dias: int = Field(..., ge=1, le=3650)


class OperacionResponse(BaseModel):
    """Contrato estándar de la API: exito/mensaje, no success/message."""

    exito: bool
    mensaje: str
