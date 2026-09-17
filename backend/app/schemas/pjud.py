"""Schemas de la consulta de detalle PJUD (api-pjud.codifica.cl).

Espejan los del proveedor (`CausaDetalle`, `MovimientosResponse`, etc.) con
todo lo que la pantalla de "Detalle Causa Civil" muestra: cabecera, documentos
de la causa, anexos, información del receptor y las cinco pestañas (Historia,
Litigantes, Notificaciones, Escritos por Resolver, Exhortos).

El scrape del proveedor es ASÍNCRONO: la primera vez que se pide una causa,
`api-pjud` la encola y responde `estado="Sincronizando"` sin cuadernos durante
varios minutos. Por eso la respuesta de este módulo lleva un `estado`
(`listo` | `sincronizando`) y el endpoint devuelve 202 mientras no esté lista,
en vez de tratar ese caso como un error.
"""

from typing import Literal

from pydantic import BaseModel

from app.schemas.causa import CausaResponse


class PjudDocumentoRef(BaseModel):
    """Un PDF de la causa (texto de demanda, certificado de envío, ebook)."""

    nombre_archivo: str | None = None
    url: str | None = None


class PjudAnexoCausaItem(BaseModel):
    folio: str | None = None
    fecha: str | None = None
    referencia: str | None = None
    nombre_doc: str | None = None
    doc: str | None = None


class PjudInformacionReceptorItem(BaseModel):
    cuaderno: str | None = None
    datos_retiro: str | None = None
    fecha_retiro: str | None = None
    estado: str | None = None


class PjudCuaderno(BaseModel):
    id: int
    nombre: str
    # Actualización 16-09-2026: Estado Proc. y Etapa cambian por cuaderno, no
    # son fijos de la causa. El frontend los pinta en la cabecera y los
    # refresca al cambiar de cuaderno.
    estado_proceso: str | None = None
    etapa: str | None = None


class PjudCausaOrigen(BaseModel):
    """Causa Civil de la que proviene esta (p.ej. un cuaderno de ejecución
    incidental). Se pinta en la cabecera junto al resto de los datos."""

    rol: str | None = None
    tribunal: str | None = None


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
    proceso: str | None = None
    ubicacion: str | None = None
    fecha_ultima_sincronizacion: str | None = None
    causa_origen: PjudCausaOrigen | None = None
    texto_demanda: PjudDocumentoRef | None = None
    certificado_envio: PjudDocumentoRef | None = None
    ebook: PjudDocumentoRef | None = None
    anexos_causa: list[PjudAnexoCausaItem] = []
    informacion_receptor: list[PjudInformacionReceptorItem] = []
    cuadernos: list[PjudCuaderno] = []


class PjudHistoriaAnexoItem(BaseModel):
    doc: str | None = None
    fecha: str | None = None
    referencia: str | None = None


class PjudDocumentoTramite(BaseModel):
    """Un documento de un trámite de la historia.

    El proveedor manda `doc` como lista de 0-2 objetos: `{"doc": ...}` es el
    documento principal (escrito/resolución) y `{"doc2": ...}` el certificado.
    En el OJV se pintan como PDF rojo y azul respectivamente."""

    url: str
    tipo: Literal["principal", "certificado"] = "principal"


class PjudGeoreferenciaMapa(BaseModel):
    latitud: str | None = None
    longitud: str | None = None
    corrector: str | None = None


class PjudGeoreferenciaImagen(BaseModel):
    img: str | None = None


class PjudGeoreferencia(BaseModel):
    """Georeferencia de un movimiento (p.ej. una diligencia con ubicación).
    Compartida por Civil (`historia`) y Familia (`movimientos`). `videos`
    todavía no tiene un ejemplo real del proveedor: se deja como lista de
    objetos sueltos hasta poder confirmar su forma."""

    mapa: PjudGeoreferenciaMapa | None = None
    imagenes: list[PjudGeoreferenciaImagen] = []
    videos: list[dict] = []


class PjudMovimientoItem(BaseModel):
    """Una fila de `historia`: un trámite del cuaderno.

    El proveedor manda `doc` como lista (`[{"doc": ...}, {"doc2": ...}]`): un
    trámite puede traer 0, 1 o 2 documentos. El servicio la resuelve a
    `documentos`, ya lista para enlazar."""

    # `folio_texto` es el folio tal como lo muestra el OJV: casi siempre un
    # número, pero puede venir con sufijo ("1 bis", "12-A"), así que es string.
    folio_texto: str | None = None
    etapa: str | None = None
    tramite: str | None = None
    descripcion_tramite: str | None = None
    fecha_tramite: str | None = None
    foja: int | None = None
    anexo: list[PjudHistoriaAnexoItem] = []
    documentos: list[PjudDocumentoTramite] = []
    georeferencia: PjudGeoreferencia | None = None


class PjudLitiganteItem(BaseModel):
    participante: str | None = None
    rut: str | None = None
    persona: str | None = None
    razon_social: str | None = None


class PjudNotificacionItem(BaseModel):
    rol: str | None = None
    tipo_notificacion: str | None = None
    estado_notificacion: str | None = None
    fecha_tramite: str | None = None
    tipo_part: str | None = None
    nombre: str | None = None
    tramite: str | None = None
    observacion_fallida: str | None = None


class PjudEscritoResolverItem(BaseModel):
    doc: str | None = None
    # Actualización 16-09-2026: antes era una URL suelta; ahora es un array
    # como el anexo de Historia (mismo orden en que lo entrega el PJUD).
    anexo: list[PjudHistoriaAnexoItem] = []
    tipo_escrito: str | None = None
    solicitante: str | None = None
    fecha_ingreso: str | None = None


class PjudExhortoRolItem(BaseModel):
    doc: str | None = None
    fecha: str | None = None
    referencia: str | None = None
    tramite: str | None = None


class PjudExhortoRolDestinoItem(BaseModel):
    nombre: str | None = None
    roles: list[PjudExhortoRolItem] = []


class PjudExhortoItem(BaseModel):
    rol_origen: str | None = None
    tipo_exhorto: str | None = None
    rol_destino: list[PjudExhortoRolDestinoItem] = []
    fecha_ordena_exhorto: str | None = None
    fecha_ingreso_exhorto: str | None = None
    tribunal_destino: str | None = None
    estado_exhorto: str | None = None


class PjudPiezaExhortoItem(BaseModel):
    """Una fila de `piezas_exhorto`: solo aparece cuando la causa ES un
    exhorto (tipo de rol "E"), no cuando tiene exhortos asociados (eso es la
    pestaña `exhortos`). `folio` y `foja` pueden venir vacíos o con letras, así
    que van como texto. La forma de `anexo` todavía no está confirmada contra
    la API real; se deja como lista de objetos sueltos."""

    folio: str | None = None
    doc: str | None = None
    cuaderno: str | None = None
    anexo: list[dict] = []
    etapa: str | None = None
    tramite: str | None = None
    descripcion_tramite: str | None = None
    fecha_tramite: str | None = None
    foja: str | None = None


class PjudMovimientosResponse(BaseModel):
    # `sincronizando` = api-pjud está scrapeando la causa por primera vez.
    # `causa` y las secciones vienen con lo que el proveedor ya haya expuesto
    # (puede ser todo vacío al principio, luego la cabecera, luego la historia).
    # El frontend muestra el aviso y el `detalle_estado` (progreso del worker)
    # por encima de esos datos parciales y ofrece "Reintentar".
    # `error` = el scrape del proveedor terminó mal; `detalle_estado` trae el
    # motivo y el modal lo muestra en rojo.
    # `sin_credenciales` = hay que sincronizar pero la persona no cargó su clave
    # del OJV; el modal la manda a Mi Perfil.
    # `listo` = todo lo demás está poblado.
    estado: Literal["listo", "sincronizando", "error", "sin_credenciales"] = "listo"
    mensaje: str | None = None
    ultimo_error: str | None = None
    # Campo `detalle_estado` de `/consultar_civil`: texto legible con el avance
    # de la sincronización o el motivo del fallo. Null si el proveedor no lo manda.
    detalle_estado: str | None = None
    causa: PjudCausaDetalle | None = None
    cuaderno_consultado_id: int | None = None
    historia: list[PjudMovimientoItem] = []
    litigantes: list[PjudLitiganteItem] = []
    notificaciones: list[PjudNotificacionItem] = []
    escritos_resolver: list[PjudEscritoResolverItem] = []
    exhortos: list[PjudExhortoItem] = []
    # Solo se puebla cuando la causa es un Exhorto (tipo de rol "E"); el
    # frontend usa que venga vacío para no mostrar la pestaña.
    piezas_exhorto: list[PjudPiezaExhortoItem] = []


# ── Familia ────────────────────────────────────────────────────
# El detalle de Familia comparte con Civil la cabecera y el manejo de
# documentos, pero la respuesta de movimientos es distinta: la sección se llama
# `movimientos` (no `historia`), no hay `escritos_resolver` ni `exhortos`, y
# suma `materias`, `plazos` y `diligencias`. Familia tampoco expone cuadernos.


class PjudFamiliaCausaDetalle(BaseModel):
    identificador: str
    estado: str
    rit: str | None = None
    caratula: str | None = None
    fecha_ingreso: str | None = None
    ruc: str | None = None
    proceso: str | None = None
    forma_inicio: str | None = None
    est_adm: str | None = None
    etapa: str | None = None
    estado_proceso: str | None = None
    tribunal: str | None = None
    fecha_ultima_sincronizacion: str | None = None
    anexos_causa: list[PjudAnexoCausaItem] = []
    certificado_envio: PjudDocumentoRef | None = None
    ebook: PjudDocumentoRef | None = None


class PjudFamiliaAnexoItem(BaseModel):
    folio: int | None = None
    doc: str | None = None
    fecha: str | None = None
    nombre_documento: str | None = None
    observacion: str | None = None


class PjudFamiliaMovimientoItem(BaseModel):
    folio_texto: str | None = None
    etapa: str | None = None
    estado: str | None = None
    tramite: str | None = None
    descripcion_tramite: str | None = None
    fecha_tramite: str | None = None
    anexo: list[PjudFamiliaAnexoItem] = []
    documentos: list[PjudDocumentoTramite] = []
    georeferencia: PjudGeoreferencia | None = None


class PjudFamiliaLitiganteItem(BaseModel):
    sujeto: str | None = None
    rut: str | None = None
    persona: str | None = None
    razon_social: str | None = None


class PjudMateriaItem(BaseModel):
    codigo: str | None = None
    glosa_de_materia: str | None = None
    estado: str | None = None
    fecha_termino: str | None = None


class PjudPlazoItem(BaseModel):
    tipo_plazo: str | None = None
    ambito_afectado: str | None = None
    fecha_inicio: str | None = None
    fecha_termino: str | None = None
    duracion: str | None = None
    estado: str | None = None
    tramite: str | None = None
    fecha_suspension: str | None = None
    fecha_reactivacion: str | None = None


class PjudFamiliaNotificacionItem(BaseModel):
    estado_fecha_notif: str | None = None
    tipo_notif: str | None = None
    ente_notif: str | None = None
    rit: str | None = None
    ruc: str | None = None
    fecha_tramite: str | None = None
    tipo_parte: str | None = None
    nombre: str | None = None
    tramite: str | None = None
    certificacion: str | None = None


class PjudDiligenciaItem(BaseModel):
    doc_solicitud: str | None = None
    doc_respuesta: str | None = None
    estado_diligencia: str | None = None
    tipo_diligencia: str | None = None
    fecha_tramite: str | None = None


class PjudFamiliaMovimientosResponse(BaseModel):
    # Mismos estados y semántica que `PjudMovimientosResponse` (ver ahí).
    estado: Literal["listo", "sincronizando", "error", "sin_credenciales"] = "listo"
    mensaje: str | None = None
    ultimo_error: str | None = None
    detalle_estado: str | None = None
    causa: PjudFamiliaCausaDetalle | None = None
    movimientos: list[PjudFamiliaMovimientoItem] = []
    litigantes: list[PjudFamiliaLitiganteItem] = []
    notificaciones: list[PjudFamiliaNotificacionItem] = []
    materias: list[PjudMateriaItem] = []
    plazos: list[PjudPlazoItem] = []
    diligencias: list[PjudDiligenciaItem] = []


# ── Laboral ────────────────────────────────────────────────────
# Comparte con Civil y Familia la cabecera, el manejo de documentos y la
# georeferencia, pero: la cabecera trae `texto_demanda` (una lista, cada fila
# con un ícono de estado) y `audio_laboral` en vez de un único documento; la
# sección de trámites se llama `movimiento` (singular, no `historia` ni
# `movimientos`); y suma `diligencias`, `liquidacion` y `escritos_pendientes`
# a litigantes/notificaciones/materias. Como Civil (y a diferencia de
# Familia), SÍ necesita el `corte`/`tribunal` reales del catálogo del
# proveedor, porque el árbol de tribunales de Laboral es propio.


class PjudTextoDemandaItem(BaseModel):
    """Una fila de `texto_demanda`: en el OJV el primer `td` trae un ícono de
    estado (`fa-minus` = 0, `fa-check` = 1) que se captura en `doc_demanda`."""

    doc_demanda: int | None = None
    doc: str | None = None
    fecha: str | None = None
    referencia: str | None = None


class PjudAudioLaboralItem(BaseModel):
    numero: int | None = None
    audio: str | None = None
    fecha: str | None = None
    referencia: str | None = None


class PjudLaboralCausaDetalle(BaseModel):
    identificador: str
    estado: str
    rit: str | None = None
    caratula: str | None = None
    fecha_ingreso: str | None = None
    ruc: str | None = None
    proceso: str | None = None
    forma_inicio: str | None = None
    est_adm: str | None = None
    etapa: str | None = None
    estado_proceso: str | None = None
    tribunal: str | None = None
    fecha_ultima_sincronizacion: str | None = None
    texto_demanda: list[PjudTextoDemandaItem] = []
    tramites: str | None = None
    ebook: PjudDocumentoRef | None = None
    certificado_envio: PjudDocumentoRef | None = None
    audio_laboral: list[PjudAudioLaboralItem] = []


class PjudLaboralLitiganteItem(BaseModel):
    """`estado` es el mismo ícono de estado que `PjudTextoDemandaItem.doc_demanda`
    (`fa-minus` = 0, `fa-check` = 1), acá sobre la fila del litigante."""

    estado: int | None = None
    defensor: str | None = None
    sujeto: str | None = None
    rut: str | None = None
    persona: str | None = None
    razon_social: str | None = None


class PjudLaboralMovimientoItem(BaseModel):
    """Una fila de `movimiento`. Trae `folio` (numérico) y `folio_texto` (tal
    cual lo muestra el OJV, con sufijos de exhorto tipo `[6E]`), igual que la
    `historia` de Civil.

    `doc` llega igual que en Civil/Familia (lista de 0-2 `{"doc": ...}`) y el
    servicio la resuelve a `documentos`. La forma de `anexo` no está
    confirmada contra la API real (el ejemplo del proveedor siempre lo trae
    vacío), así que queda como lista de objetos sueltos."""

    folio: int | None = None
    folio_texto: str | None = None
    documentos: list[PjudDocumentoTramite] = []
    anexo: list[dict] = []
    etapa: str | None = None
    tramite: str | None = None
    descripcion_tramite: str | None = None
    fecha_tramite: str | None = None
    estado: str | None = None
    georeferencia: PjudGeoreferencia | None = None


class PjudLaboralNotificacionItem(BaseModel):
    estado_notificacion: str | None = None
    fecha_tramite: str | None = None
    tipo_part: str | None = None
    nombre: str | None = None
    tramite: str | None = None
    observacion_fallida: str | None = None


class PjudLaboralDiligenciaItem(BaseModel):
    doc_ida: str | None = None
    doc_vta: str | None = None
    estado_diligencia: str | None = None
    rit: str | None = None
    ruc: str | None = None
    tipo_diligencia: str | None = None
    referencia: str | None = None
    fecha_tramite: str | None = None


class PjudLaboralLiquidacionItem(BaseModel):
    liquidacion: str | None = None
    rut: str | None = None
    nombre: str | None = None
    monto_liquido: str | None = None


class PjudLaboralMateriaItem(BaseModel):
    """Como `PjudMateriaItem` de Familia, pero el proveedor llama a la glosa
    `glosa_materia` acá (Familia la manda como `glosa_de_materia`)."""

    codigo: str | None = None
    glosa_materia: str | None = None
    estado: str | None = None
    fecha_termino: str | None = None


class PjudLaboralEscritoPendienteItem(BaseModel):
    doc: str | None = None
    # Forma sin confirmar contra la API real: el ejemplo del proveedor trae
    # "" en vez de una lista, a diferencia del `anexo` de Historia/Movimiento.
    anexo: str | None = None
    fecha_ing: str | None = None
    referencia: str | None = None
    solicitante: str | None = None
    tipo_ingreso: str | None = None


class PjudLaboralMovimientosResponse(BaseModel):
    # Mismos estados y semántica que `PjudMovimientosResponse` (ver ahí).
    estado: Literal["listo", "sincronizando", "error", "sin_credenciales"] = "listo"
    mensaje: str | None = None
    ultimo_error: str | None = None
    detalle_estado: str | None = None
    causa: PjudLaboralCausaDetalle | None = None
    movimiento: list[PjudLaboralMovimientoItem] = []
    litigantes: list[PjudLaboralLitiganteItem] = []
    notificaciones: list[PjudLaboralNotificacionItem] = []
    diligencias: list[PjudLaboralDiligenciaItem] = []
    liquidacion: list[PjudLaboralLiquidacionItem] = []
    materias: list[PjudLaboralMateriaItem] = []
    escritos_pendientes: list[PjudLaboralEscritoPendienteItem] = []


class PjudErrorResponse(BaseModel):
    exito: bool = False
    mensaje: str


class PjudDisponibleResponse(BaseModel):
    disponible: bool


class PjudPorRolResponse(BaseModel):
    """Resuelve, por rol y tribunal, la Causa Civil, Familia o Laboral de la
    cartera vigente que corresponde: es lo que ofrece el botón "Detalle PJUD"
    en pantallas que no tienen el id de la Causa (Estado Diario, Movimientos) y
    solo conocen su rol y tribunal. `causa` viene en `null` si no hay cartera
    cargada, no calza ninguna, o la que calza no es de una materia que expone
    la API del PJUD."""

    causa: CausaResponse | None = None
