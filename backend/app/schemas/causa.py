"""Schemas del módulo Causas (solo carga y consulta).

Es la **cartera** del estudio: todas sus causas, se hayan movido o no. Por eso
no hay schemas de acciones (leído / pendiente / recordatorio) como en estado
diario: acá no hay nada que despachar.
"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


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

    # Último resultado conocido de "Detalle PJUD" (`listo` | `sincronizando` |
    # `error` | `sin_credenciales`), sacado del log de llamados. Null = nunca
    # se consultó. Solo se resuelve para causas Civiles; el resto queda null.
    # Es lo que pinta el icono del botón en el listado sin tener que abrir el
    # modal (que sí consulta al proveedor en vivo).
    pjud_estado: str | None = None
    # Fecha/hora de ese último llamado (cualquiera sea su resultado). Null si
    # nunca se consultó.
    pjud_fecha_sincronizacion: datetime | None = None
    # Solo con `?incluir_credenciales=true` y una API key autorizada: clave de
    # `credenciales_pjud` (en la lista) con las credenciales del abogado dueño.
    credencial_ref: str | None = None

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
            rut=c.rut_efectivo,
            fecha_archivo=origen.fecha if origen else None,
            nombre_archivo=origen.nombre_archivo if origen else None,
            ultima_actividad=c.ultima_actividad,
            origen_actividad=c.origen_actividad,
            # La cuelga el repositorio sobre el objeto; en otros usos no está.
            proxima_audiencia=getattr(c, "proxima_audiencia", None),
        )


class CrearCausaRequest(BaseModel):
    """Alta individual por API.

    **No hay campo de RUT, y `extra="forbid"` hace que mandar uno sea un 422** y
    no algo que se ignora en silencio: la causa nace sin abogado y se le asigna
    cuando llega un estado diario que la trae.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    materia: str = Field(description="Civil | Familia | Laboral | Cobranza | Penal")
    rol: str = Field(min_length=1, max_length=100, description="Rol (o RIT en Penal/Familia)")
    tribunal: str = Field(min_length=1, max_length=255)
    tipo_causa: str | None = Field(None, max_length=100)
    ruc: str | None = Field(None, max_length=100)
    fecha_ingreso: date | None = None
    caratulado: str | None = Field(None, max_length=500)
    estado_causa: str | None = Field(None, max_length=255)
    institucion: str | None = Field(None, max_length=255)


class CrearCausaResponse(BaseModel):
    exito: bool = True
    # False = ya estaba en Mis Causas; se devuelve sin cambios.
    creada: bool
    causa: CausaResponse


class CausaListResponse(BaseModel):
    exito: bool = True
    total: int
    page: int = 1
    total_pages: int = 1
    causas: list[CausaResponse]
    # ref → sello (RSA-OAEP + AES-GCM) con {rut, clave, metodo_login} del OJV.
    # Ver `app/core/credenciales_pjud.py`. Ausente si no se pidió.
    credenciales_pjud: dict[str, str] | None = None
    # Sello con la conexión de la plataforma a api-pjud. Ausente si no se pidió,
    # o si el cliente no tiene el PJUD habilitado (ver `pjud_habilitado`).
    api_pjud: str | None = None
    # `false` = el cliente no tiene el PJUD habilitado: no hay ninguna credencial.
    pjud_habilitado: bool | None = None


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
    tipo_libro: str | None = None
    # Causa de primera instancia de la apelación; nulos hasta que se consulta
    # su detalle PJUD.
    origen_rol: str | None = None
    origen_tribunal: str | None = None
    origen_causa_id: int | None = None
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
    # Último resultado de "Detalle PJUD" (solo Corte de Apelaciones): pinta el
    # icono del botón, igual que en `CausaResponse`.
    pjud_estado: str | None = None
    pjud_fecha_sincronizacion: datetime | None = None


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
