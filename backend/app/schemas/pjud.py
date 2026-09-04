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
    anexo: str | None = None
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


class PjudErrorResponse(BaseModel):
    exito: bool = False
    mensaje: str


class PjudDisponibleResponse(BaseModel):
    disponible: bool


class PjudPorRolResponse(BaseModel):
    """Resuelve, por rol y tribunal, la Causa Civil de la cartera vigente que
    corresponde: es lo que ofrece el botón "Detalle PJUD" en pantallas que no
    tienen el id de la Causa (Estado Diario, Movimientos) y solo conocen su
    rol y tribunal. `causa` viene en `null` si no hay cartera cargada, no
    calza ninguna, o la que calza no es Civil."""

    causa: CausaResponse | None = None
