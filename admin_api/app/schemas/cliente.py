"""Contratos de la consola de administración de la plataforma.

Los nombres de los campos siguen el contrato que ya consume la SPA
(`admin_app/src/app/core/models/admin.model.ts`). Donde no calzan con los del
modelo se traduce acá o en el servicio, nunca en el router.

Ahora que la SPA se compila aparte, este archivo y ese `.ts` son las dos caras
de un mismo contrato y se cambian juntos: no hay compilador que avise si se
separan.
"""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.usuario import validar_ruts

# Estado de la base de datos del cliente. `en_cola` y `creando` existen porque
# crear una base toma segundos: hasta que llega a `listo` el cliente aparece en
# la lista pero sus usuarios no pueden entrar, y la consola tiene que decirlo.
EstadoAprovisionamiento = Literal["en_cola", "creando", "listo", "error"]


TipoCliente = Literal["estudio", "patrocinador"]


class UsuarioInicial(BaseModel):
    """Un usuario a crear junto con el cliente.

    Es el mismo contrato que `UsuarioAdminCreate` del backend, repetido acá
    porque este viaja ANIDADO en el alta del cliente y no como cuerpo propio.
    """

    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[A-Za-z0-9._-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    email: str | None = Field(default=None, max_length=255)
    # Una sola palabra cada uno; lo valida el backend al construir el Usuario.
    nombre: str | None = Field(default=None, max_length=200)
    apellido: str | None = Field(default=None, max_length=200)
    telefono: str | None = Field(default=None, max_length=30)
    # RUT con los que recibe archivos del PJUD. Se pueden dejar para después
    # desde la ficha; sin ellos la advertencia de importación cae al RUT del
    # estudio, que es el comportamiento anterior.
    ruts: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("ruts")
    @classmethod
    def _validar_ruts(cls, v: list[str]) -> list[str]:
        return validar_ruts(v)


class ClienteCreate(BaseModel):
    """Alta de un cliente **con sus usuarios, en una sola llamada**.

    Antes el cliente se creaba vacío y los usuarios se agregaban después desde
    su ficha. El problema era que un alta a medias —cliente creado, usuarios
    no— se veía igual que una completa, y nadie podía entrar a ese estudio.
    Ahora la consola junta todo y lo manda junto.

    El guid y la base de datos los genera el backend: no se aceptan por
    parámetro para que nadie pueda apuntar a una base que ya existe.

    **Las dos formas del alta:**

    - `estudio`: `cal` es la cantidad de abogados patrocinadores contratados, y
      tienen que venir exactamente esos usuarios.
    - `patrocinador`: un abogado solo. `cal` no aplica (se ignora) y va
      exactamente un usuario, que es la misma persona de la ficha.
    """

    nombre: str = Field(..., min_length=2, max_length=255)
    rut: str = Field(..., min_length=3, max_length=20, examples=["76.543.210-K"])
    correo: str | None = Field(default=None, max_length=255)
    tipo: TipoCliente = "estudio"
    # Solo para `estudio`. Es el tope de usuarios del cliente.
    cal: int | None = Field(default=None, ge=1, le=500)
    usuarios: list[UsuarioInicial] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validar_cupos(self) -> "ClienteCreate":
        """La cantidad de usuarios tiene que calzar con lo contratado.

        Se valida acá y no en el servicio para que el error salga como 422 con
        el campo señalado, antes de crear nada. Un cliente creado y después
        rechazado por la cantidad de usuarios sería justamente el alta a medias
        que este endpoint viene a evitar.
        """
        if self.tipo == "patrocinador":
            # `cal` se ignora en vez de rechazarse: la consola no lo muestra
            # para este tipo, y un valor viejo arrastrado en el formulario no
            # tiene por qué frenar el alta.
            self.cal = None
            if len(self.usuarios) != 1:
                raise ValueError(
                    "Un patrocinador es un abogado solo: debe indicar exactamente "
                    "un usuario."
                )
            return self

        if not self.cal:
            raise ValueError("Indique el CAL: cuántos abogados patrocinadores contrata.")
        if len(self.usuarios) != self.cal:
            raise ValueError(
                f"El CAL es {self.cal}, así que debe crear {self.cal} "
                f"usuario(s); vinieron {len(self.usuarios)}."
            )
        return self

    @model_validator(mode="after")
    def _validar_usuarios_distintos(self) -> "ClienteCreate":
        """Nombres de usuario y correos repetidos DENTRO del alta.

        El backend los rechaza uno por uno contra la base, pero acá ya se
        habría creado el cliente y los primeros usuarios. Detectarlo antes deja
        el alta entera sin efecto.
        """
        nombres = [u.username.strip().lower() for u in self.usuarios]
        repetido = next((n for n in nombres if nombres.count(n) > 1), None)
        if repetido:
            raise ValueError(f"El nombre de usuario '{repetido}' está repetido.")

        correos = [u.email.strip().lower() for u in self.usuarios if u.email]
        repetido = next((c for c in correos if correos.count(c) > 1), None)
        if repetido:
            raise ValueError(f"El correo '{repetido}' está repetido.")
        return self


class ClienteUpdate(BaseModel):
    """Edición de la ficha.

    **El RUT sí se puede corregir.** Es la credencial con la que el estudio
    inicia sesión, así que cambiarlo obliga a todos sus usuarios a entrar con
    el nuevo desde ese momento — pero un RUT mal tipeado en el alta no tiene
    otra salida, y dejarlo fijo obligaba a crear el cliente de nuevo.

    Lo que NO se toca es `guid` ni `base_datos`: identifican la base de datos
    del cliente, y cambiarlos la dejaría inalcanzable con todas sus causas
    adentro. Por eso no están acá y no es un olvido.
    """

    nombre: str = Field(..., min_length=2, max_length=255)
    # Ausente = conservar el actual.
    rut: str | None = Field(default=None, min_length=3, max_length=20)
    correo: str | None = Field(default=None, max_length=255)
    # Ampliar o reducir lo contratado. Reducirlo por debajo de los usuarios
    # activos se rechaza: habría que decidir a quién desactivar, y eso no lo
    # puede adivinar el sistema.
    cal: int | None = Field(default=None, ge=1, le=500)
    activo: bool = True
    # Datos comerciales para la cabecera de la factura. Opcionales: el
    # cliente ya existe sin ellos y no se le puede exigir un giro para poder
    # operar. La orden imprime lo que haya y omite el resto.
    giro: str | None = Field(default=None, max_length=255)
    direccion: str | None = Field(default=None, max_length=255)
    comuna: str | None = Field(default=None, max_length=100)
    ciudad: str | None = Field(default=None, max_length=100)


class ClienteLogoUpdate(BaseModel):
    """Logo del estudio, en base64.

    Llega por JSON y no como multipart a propósito: la consola ya lo lee con
    FileReader para previsualizarlo, así que mandarlo como texto evita un
    segundo camino de subida de archivos en el único endpoint que lo tendría.

    `logo` vacío o nulo = QUITAR el logo. Es la única forma de volver al nombre
    del estudio en texto, y por eso no se confunde con "no lo cambies": este
    endpoint es solo del logo, no hay otro campo que preservar.
    """

    # Sin el prefijo `data:...;base64,`. La consola lo saca antes de enviar.
    logo: str | None = None
    logo_mime: str | None = Field(default=None, max_length=100)


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
    # Causas de MATERIA vigentes del último archivo de causas cargado: las
    # mismas que el estudio ve en "Mis Causas". 0 también cuando la base no
    # respondió, así que no distingue "sin causas" de "no se pudo consultar".
    causas_activas: int = 0
    # Datos comerciales; salen en la cabecera de la factura.
    giro: str | None = None
    direccion: str | None = None
    comuna: str | None = None
    ciudad: str | None = None
    tipo: TipoCliente = "estudio"
    # Tope de usuarios contratado. Null en los patrocinadores, donde es 1.
    cal: int | None = None
    # `data:<mime>;base64,<...>` listo para un <img src>. Null = sin logo.
    logo: str | None = None
    # Solo en la respuesta del ALTA: qué pasó con los usuarios que venían.
    # Null cuando no se pidió crear ninguno (no es lo mismo que "ninguno se
    # creó").
    usuarios_creados: int | None = None
    usuarios_con_error: list[str] = []


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
    """El estado de la plataforma HOY, no el del período elegido.

    Ninguno de estos cuatro depende del filtro de período: cuántos clientes hay
    y en qué estado están es una foto del momento, y acotarla a "los últimos 30
    días" no significaría nada. El período solo acota la tabla de actividad por
    cliente.
    """

    clientes_activos: int
    clientes_suspendidos: int
    usuarios_activos: int
    # Activos que no reciben archivos hace más de `umbral_sin_importar` días.
    clientes_sin_importar: int


class PuntoEvolucionClientes(BaseModel):
    """Cuántos clientes había en cada estado al cerrar un mes."""

    # `AAAA-MM`. Texto y no date: es una etiqueta de mes, no un día, y mandarlo
    # como fecha invita a que el navegador lo corra un día por zona horaria.
    mes: str
    activos: int
    suspendidos: int


class AdminDashboard(BaseModel):
    dias: int
    desde: date
    hasta: date
    kpis: DashboardKpis
    umbral_sin_importar: int
    aprovisionamientos_en_curso: int
    aprovisionamientos_con_error: list[ClienteConProblema]
    clientes: list[ClienteActividad]
    # Los últimos 12 meses cerrados más el corriente, del más viejo al más
    # nuevo. Tampoco depende del filtro de período.
    evolucion_clientes: list[PuntoEvolucionClientes] = []
    # Desde cuándo hay historial de suspensiones de verdad. Antes de esta fecha
    # el gráfico solo sabe de altas, así que la pantalla lo advierte en vez de
    # dejar creer que nadie estuvo suspendido.
    historial_desde: date | None = None


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
    # Días de mora tras los cuales el cliente se suspende solo. 0 = apagado.
    dias_mora_suspension: int = 0
    # Cuántos clientes activos caerían con el valor actual. Se manda calculado
    # para que la pantalla pueda advertirlo ANTES de guardar.
    clientes_en_mora: int = 0
    # Tarifas de lista: lo que se cobra a quien no tiene valores propios. No
    # reemplazan a las del cliente, que siguen pisándolas.
    tarifa_materia: Decimal = Decimal("1")
    tarifa_apelaciones: Decimal = Decimal("2")
    tarifa_suprema: Decimal = Decimal("3")
    ultima_purga: datetime | None
    # Registros que hay hoy en el log (sumando todos los clientes) y cuántos
    # borraría la política actual si se purgara ahora: sirven para dimensionar
    # el cambio antes de guardarlo.
    registros_log: int
    registros_a_purgar: int


class ConfiguracionSistemaUpdate(BaseModel):
    retencion_log_dias: int = Field(..., ge=1, le=3650)
    # 0 apaga la suspensión automática. El tope de 365 es deliberado: un plazo
    # mayor a un año no es una política de cobranza, es no tener ninguna.
    dias_mora_suspension: int = Field(0, ge=0, le=365)
    # Cero es válido: un concepto que no se cobra es una decisión comercial
    # legítima, no un error de tipeo.
    tarifa_materia: Decimal = Field(Decimal("1"), ge=0)
    tarifa_apelaciones: Decimal = Field(Decimal("2"), ge=0)
    tarifa_suprema: Decimal = Field(Decimal("3"), ge=0)


class OperacionResponse(BaseModel):
    """Contrato estándar de la API: exito/mensaje, no success/message."""

    exito: bool
    mensaje: str
