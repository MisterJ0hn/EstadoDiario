/**
 * Cartera de causas del estudio: todas sus causas, se hayan movido o no.
 *
 * No confundir con Movimientos (el estado procesal de lo que se tramita) ni
 * con Estado Diario (lo que se movió un día). Son tres reportes distintos del
 * PJUD y cada uno tiene su tabla.
 */
export interface Causa {
  id: number;
  origen_id: number;
  /** Nombre de la hoja del Excel: Civil, Laboral, Penal, Cobranza, Familia. */
  materia: string | null;
  /** Solo la hoja Penal lo trae. */
  tipo_causa: string | null;
  /** "Rol" en Civil/Laboral/Cobranza, "Rit" en Penal/Familia: mismo dato. */
  rol: string | null;
  ruc: string | null;
  tribunal: string | null;
  fecha_ingreso: string | null;
  caratulado: string | null;
  estado_causa: string | null;
  institucion: string | null;
  jurisdiccion_id: number | null;
  rut: string | null;
  fecha_archivo: string | null;
  nombre_archivo: string | null;
  /**
   * Última vez que la causa apareció en el estado diario, en movimientos o en
   * una audiencia ya celebrada. Null = no consta en los reportes cargados, que
   * NO es lo mismo que "no se movió".
   */
  ultima_actividad?: string | null;
  /** De cuál de los tres reportes salió esa fecha. */
  origen_actividad?: string | null;
  /** Próxima audiencia agendada, desde hoy. */
  proxima_audiencia?: string | null;
  /** Último resultado conocido de "Detalle PJUD" (`listo` | `sincronizando` |
   *  `error` | `sin_credenciales`), del log de llamados — no en vivo al
   *  proveedor. Null/undefined = nunca se consultó. Solo viene en causas
   *  Civiles, de Familia y Laborales. */
  pjud_estado?: string | null;
  /** Fecha/hora de ese último llamado (cualquiera sea su resultado). */
  pjud_fecha_sincronizacion?: string | null;
}

export interface CausaListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  causas: Causa[];
}

export interface ConteoMateria {
  materia: string | null;
  total: number;
}

export interface CausaResumenResponse {
  exito: boolean;
  total: number;
  por_materia: ConteoMateria[];
  estados_causa: string[];
}

/**
 * Vigencia de una causa de la cartera.
 *
 * `vigentes` es todo lo que NO está concluido ni fallado —incluidas las que no
 * informan estado, como las de Cobranza, cuya hoja no trae la columna—, y es
 * lo que se ve por defecto: la cartera con la que el estudio trabaja hoy.
 */
export type VigenciaCausa = 'vigentes' | 'finalizadas';

export interface CausaFiltros {
  /** Solo las que no aparecen en ningún reporte hace más de N meses. */
  sin_actividad_meses?: number;
  /** Solo las que tienen audiencia dentro de los próximos N días. */
  con_audiencia_dias?: number;
  /** `actividad` | `audiencia`. Por defecto, fecha de ingreso. */
  orden?: string;
  materia?: string;
  estado_causa?: string;
  tribunal?: string;
  busqueda?: string;
  origen_id?: number;
  /** Ausente = las dos. La pantalla siempre manda una de las dos. */
  vigencia?: VigenciaCausa;
  page?: number;
  limit?: number;
}

export type TipoCorteCausa = 'suprema' | 'apelaciones';

/**
 * Causa de corte del reporte de Causas.
 *
 * Ojo: hay tres tipos de "corte" en el sistema (estado diario, movimientos y
 * éste) y traen columnas distintas. Acá el estado se llama `estado_procesal`
 * porque así lo encabeza la hoja de Apelaciones; Suprema lo llama "Estado
 * Causa" y el backend los unifica.
 */
export interface CausaCorte {
  id: number;
  tipo: TipoCorteCausa;
  rol: string | null;
  era: string | null;
  fecha_ingreso: string | null;
  caratulado: string | null;
  estado_procesal: string | null;
  institucion: string | null;
  /** Las tres siguientes solo vienen en la hoja de Apelaciones. */
  corte: string | null;
  ubicacion: string | null;
  fecha_ubicacion: string | null;
  fecha_archivo: string | null;
}

export interface CausaCorteListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  cortes: CausaCorte[];
  cortes_disponibles: string[];
}

export interface CargarCausasResponse {
  exito: boolean;
  mensaje: string;
  origen_id: number;
  causas_importadas: number;
  cortes_importados: number;
  por_materia: Record<string, number>;
}

/**
 * Detalle de una causa Civil consultado EN VIVO al PJUD
 * (api-pjud.codifica.cl), no al Excel de Movimientos que sube el estudio.
 * Solo existe para causas de materia Civil: es lo único que esa API expone.
 *
 * El scrape del proveedor es asíncrono: la primera consulta de una causa la
 * deja `estado: 'sincronizando'` (con `causa` en null) por varios minutos. El
 * modal muestra el aviso y un botón "Reintentar".
 */
export interface PjudCuaderno {
  id: number;
  nombre: string;
  /** Actualización 16-09-2026: Estado Proc. y Etapa cambian por cuaderno, no
   *  son fijos de la causa; se pintan en la cabecera según el cuaderno
   *  seleccionado. */
  estado_proceso: string | null;
  etapa: string | null;
}

export interface PjudDocumentoRef {
  nombre_archivo: string | null;
  url: string | null;
}

export interface PjudAnexoCausaItem {
  folio: string | null;
  fecha: string | null;
  referencia: string | null;
  nombre_doc: string | null;
  doc: string | null;
}

export interface PjudInformacionReceptorItem {
  cuaderno: string | null;
  datos_retiro: string | null;
  fecha_retiro: string | null;
  estado: string | null;
}

/** Causa Civil de la que proviene esta (p.ej. un cuaderno de ejecución
 *  incidental). Se pinta en la cabecera. */
export interface PjudCausaOrigen {
  rol: string | null;
  tribunal: string | null;
}

export interface PjudCausaDetalle {
  identificador: string;
  estado: string;
  rol: string | null;
  caratula: string | null;
  tribunal: string | null;
  fecha_ingreso: string | null;
  etapa: string | null;
  estado_proceso: string | null;
  est_adm: string | null;
  proceso: string | null;
  ubicacion: string | null;
  fecha_ultima_sincronizacion: string | null;
  causa_origen: PjudCausaOrigen | null;
  texto_demanda: PjudDocumentoRef | null;
  certificado_envio: PjudDocumentoRef | null;
  ebook: PjudDocumentoRef | null;
  anexos_causa: PjudAnexoCausaItem[];
  informacion_receptor: PjudInformacionReceptorItem[];
  cuadernos: PjudCuaderno[];
}

export interface PjudHistoriaAnexoItem {
  doc: string | null;
  fecha: string | null;
  referencia: string | null;
}

export interface PjudDocumentoTramite {
  url: string;
  /** `principal` = escrito/resolución (PDF rojo); `certificado` = certificado
   *  del escrito (PDF azul). Es la distinción `doc` / `doc2` del proveedor. */
  tipo: 'principal' | 'certificado';
}

export interface PjudMovimientoItem {
  /** Folio tal como lo muestra el OJV: casi siempre un número, pero puede traer
   *  sufijo ("1 bis", "12-A"). */
  folio_texto: string | null;
  etapa: string | null;
  tramite: string | null;
  descripcion_tramite: string | null;
  fecha_tramite: string | null;
  foja: number | null;
  anexo: PjudHistoriaAnexoItem[];
  /** Documentos del trámite (el proveedor manda 0, 1 o 2). Ya resueltos por el
   *  backend a partir del `doc` (que llega como lista). */
  documentos: PjudDocumentoTramite[];
  georeferencia: PjudGeoreferencia | null;
}

export interface PjudLitiganteItem {
  participante: string | null;
  rut: string | null;
  persona: string | null;
  razon_social: string | null;
}

export interface PjudNotificacionItem {
  rol: string | null;
  tipo_notificacion: string | null;
  estado_notificacion: string | null;
  fecha_tramite: string | null;
  tipo_part: string | null;
  nombre: string | null;
  tramite: string | null;
  observacion_fallida: string | null;
}

export interface PjudEscritoResolverItem {
  doc: string | null;
  /** Actualización 16-09-2026: antes era una URL suelta; ahora es un array
   *  como el anexo de Historia (mismo orden en que lo entrega el PJUD). */
  anexo: PjudHistoriaAnexoItem[];
  tipo_escrito: string | null;
  solicitante: string | null;
  fecha_ingreso: string | null;
}

export interface PjudExhortoRolItem {
  doc: string | null;
  fecha: string | null;
  referencia: string | null;
  tramite: string | null;
}

export interface PjudExhortoRolDestinoItem {
  nombre: string | null;
  roles: PjudExhortoRolItem[];
}

export interface PjudExhortoItem {
  rol_origen: string | null;
  tipo_exhorto: string | null;
  rol_destino: PjudExhortoRolDestinoItem[];
  fecha_ordena_exhorto: string | null;
  fecha_ingreso_exhorto: string | null;
  tribunal_destino: string | null;
  estado_exhorto: string | null;
}

/**
 * Una fila de `piezas_exhorto`: solo viene cuando la causa ES un exhorto
 * (tipo de rol "E"), a diferencia de la pestaña `exhortos` (causas Civiles
 * comunes que tienen exhortos asociados). `folio` y `foja` pueden venir
 * vacíos o con letras. La forma de `anexo` no está confirmada todavía.
 */
export interface PjudPiezaExhortoItem {
  folio: string | null;
  doc: string | null;
  cuaderno: string | null;
  anexo: Record<string, unknown>[];
  etapa: string | null;
  tramite: string | null;
  descripcion_tramite: string | null;
  fecha_tramite: string | null;
  foja: string | null;
}

export interface PjudMovimientosResponse {
  /**
   * `sincronizando` = el PJUD todavía está scrapeando; `causa` y las secciones
   * traen los datos parciales que ya haya (pueden venir vacíos al principio),
   * `detalle_estado` trae el progreso del worker.
   * `error` = el scrape del proveedor terminó mal; `detalle_estado` trae el
   * motivo (se muestra en rojo).
   * `sin_credenciales` = hay que sincronizar pero falta cargar la clave del
   * Poder Judicial en Mi Perfil.
   */
  estado: 'listo' | 'sincronizando' | 'error' | 'sin_credenciales';
  mensaje: string | null;
  /** Campo `detalle_estado` de `/consultar_civil`: avance de la sincronización
   *  o motivo del fallo. Null si el proveedor no lo manda. */
  detalle_estado: string | null;
  ultimo_error: string | null;
  causa: PjudCausaDetalle | null;
  cuaderno_consultado_id: number | null;
  historia: PjudMovimientoItem[];
  litigantes: PjudLitiganteItem[];
  notificaciones: PjudNotificacionItem[];
  escritos_resolver: PjudEscritoResolverItem[];
  exhortos: PjudExhortoItem[];
  /** Solo viene poblado cuando la causa es un Exhorto (tipo de rol "E"); se
   *  usa para mostrar la pestaña únicamente en ese caso. */
  piezas_exhorto: PjudPiezaExhortoItem[];
}

/**
 * Resuelve, por rol y tribunal, la Causa Civil o de Familia de la cartera
 * vigente que corresponde: lo usan pantallas que muestran una causa por su
 * rol/tribunal pero no conocen su id en la tabla Causa (Estado Diario,
 * Movimientos), para poder ofrecer el mismo botón "Detalle PJUD" que Mis Causas.
 * `causa: null` = no hay cartera cargada, no calza ninguna, o no es Civil ni de
 * Familia.
 */
export interface PjudPorRolResponse {
  causa: Causa | null;
}

/**
 * Detalle EN VIVO de una causa de **Familia** (api-pjud). Comparte con Civil la
 * cabecera y el manejo de documentos, pero la sección de trámites se llama
 * `movimientos` (no `historia`), no hay `escritos_resolver` ni `exhortos`, y
 * suma `materias`, `plazos` y `diligencias`. Familia tampoco tiene cuadernos.
 * Mismo flujo asíncrono (`estado: 'sincronizando'` en la primera consulta).
 */
export interface PjudFamiliaCausaDetalle {
  identificador: string;
  estado: string;
  rit: string | null;
  caratula: string | null;
  fecha_ingreso: string | null;
  ruc: string | null;
  proceso: string | null;
  forma_inicio: string | null;
  est_adm: string | null;
  etapa: string | null;
  estado_proceso: string | null;
  tribunal: string | null;
  fecha_ultima_sincronizacion: string | null;
  anexos_causa: PjudAnexoCausaItem[];
  certificado_envio: PjudDocumentoRef | null;
  ebook: PjudDocumentoRef | null;
}

export interface PjudFamiliaAnexoItem {
  folio: number | null;
  doc: string | null;
  fecha: string | null;
  nombre_documento: string | null;
  observacion: string | null;
}

/** Georeferencia de un movimiento (p.ej. una diligencia con ubicación). Si
 *  existe, el modal muestra un ícono de mundo que abre un popup con tres
 *  pestañas: mapa, imágenes (carrusel si hay más de una) y videos. `videos`
 *  todavía no tiene un ejemplo real del proveedor. */
export interface PjudGeoreferenciaMapa {
  latitud: string | null;
  longitud: string | null;
  corrector: string | null;
}

export interface PjudGeoreferenciaImagen {
  img: string | null;
}

export interface PjudGeoreferencia {
  mapa: PjudGeoreferenciaMapa | null;
  imagenes: PjudGeoreferenciaImagen[];
  videos: Record<string, unknown>[];
}

export interface PjudFamiliaMovimientoItem {
  folio_texto: string | null;
  etapa: string | null;
  estado: string | null;
  tramite: string | null;
  descripcion_tramite: string | null;
  fecha_tramite: string | null;
  anexo: PjudFamiliaAnexoItem[];
  documentos: PjudDocumentoTramite[];
  georeferencia: PjudGeoreferencia | null;
}

export interface PjudFamiliaLitiganteItem {
  sujeto: string | null;
  rut: string | null;
  persona: string | null;
  razon_social: string | null;
}

export interface PjudMateriaItem {
  codigo: string | null;
  glosa_de_materia: string | null;
  estado: string | null;
  fecha_termino: string | null;
}

export interface PjudPlazoItem {
  tipo_plazo: string | null;
  ambito_afectado: string | null;
  fecha_inicio: string | null;
  fecha_termino: string | null;
  duracion: string | null;
  estado: string | null;
  tramite: string | null;
  fecha_suspension: string | null;
  fecha_reactivacion: string | null;
}

export interface PjudFamiliaNotificacionItem {
  estado_fecha_notif: string | null;
  tipo_notif: string | null;
  ente_notif: string | null;
  rit: string | null;
  ruc: string | null;
  fecha_tramite: string | null;
  tipo_parte: string | null;
  nombre: string | null;
  tramite: string | null;
  certificacion: string | null;
}

export interface PjudDiligenciaItem {
  doc_solicitud: string | null;
  doc_respuesta: string | null;
  estado_diligencia: string | null;
  tipo_diligencia: string | null;
  fecha_tramite: string | null;
}

export interface PjudFamiliaMovimientosResponse {
  estado: 'listo' | 'sincronizando' | 'error' | 'sin_credenciales';
  mensaje: string | null;
  detalle_estado: string | null;
  ultimo_error: string | null;
  causa: PjudFamiliaCausaDetalle | null;
  movimientos: PjudFamiliaMovimientoItem[];
  litigantes: PjudFamiliaLitiganteItem[];
  notificaciones: PjudFamiliaNotificacionItem[];
  materias: PjudMateriaItem[];
  plazos: PjudPlazoItem[];
  diligencias: PjudDiligenciaItem[];
}

/**
 * Detalle EN VIVO de una causa **Laboral** (api-pjud). Comparte con Civil y
 * Familia la cabecera, el manejo de documentos y la georeferencia, pero: la
 * cabecera trae `texto_demanda` (lista, cada fila con un ícono de estado) y
 * `audio_laboral` en vez de un único documento; la sección de trámites se
 * llama `movimiento` (singular); y suma `diligencias`, `liquidacion` y
 * `escritos_pendientes` a litigantes/notificaciones/materias. Laboral tampoco
 * tiene cuadernos. Mismo flujo asíncrono que Civil/Familia.
 */
export interface PjudTextoDemandaItem {
  /** Ícono de estado del primer `td` en el OJV: `fa-minus` = 0, `fa-check` = 1. */
  doc_demanda: number | null;
  doc: string | null;
  fecha: string | null;
  referencia: string | null;
}

export interface PjudAudioLaboralItem {
  numero: number | null;
  audio: string | null;
  fecha: string | null;
  referencia: string | null;
}

export interface PjudLaboralCausaDetalle {
  identificador: string;
  estado: string;
  rit: string | null;
  caratula: string | null;
  fecha_ingreso: string | null;
  ruc: string | null;
  proceso: string | null;
  forma_inicio: string | null;
  est_adm: string | null;
  etapa: string | null;
  estado_proceso: string | null;
  tribunal: string | null;
  fecha_ultima_sincronizacion: string | null;
  texto_demanda: PjudTextoDemandaItem[];
  tramites: string | null;
  ebook: PjudDocumentoRef | null;
  certificado_envio: PjudDocumentoRef | null;
  audio_laboral: PjudAudioLaboralItem[];
}

export interface PjudLaboralLitiganteItem {
  /** Mismo ícono de estado que `PjudTextoDemandaItem.doc_demanda`, acá sobre
   *  la fila del litigante. */
  estado: number | null;
  defensor: string | null;
  sujeto: string | null;
  rut: string | null;
  persona: string | null;
  razon_social: string | null;
}

export interface PjudLaboralMovimientoItem {
  folio: number | null;
  folio_texto: string | null;
  documentos: PjudDocumentoTramite[];
  /** Forma sin confirmar contra la API real (el proveedor siempre lo trae
   *  vacío en los ejemplos vistos); se asume igual a `PjudHistoriaAnexoItem`
   *  (Civil) porque se muestra en el mismo popup secundario. */
  anexo: PjudHistoriaAnexoItem[];
  etapa: string | null;
  tramite: string | null;
  descripcion_tramite: string | null;
  fecha_tramite: string | null;
  estado: string | null;
  georeferencia: PjudGeoreferencia | null;
}

export interface PjudLaboralNotificacionItem {
  estado_notificacion: string | null;
  fecha_tramite: string | null;
  tipo_part: string | null;
  nombre: string | null;
  tramite: string | null;
  observacion_fallida: string | null;
}

export interface PjudLaboralDiligenciaItem {
  doc_ida: string | null;
  doc_vta: string | null;
  estado_diligencia: string | null;
  rit: string | null;
  ruc: string | null;
  tipo_diligencia: string | null;
  referencia: string | null;
  fecha_tramite: string | null;
}

export interface PjudLaboralLiquidacionItem {
  liquidacion: string | null;
  rut: string | null;
  nombre: string | null;
  monto_liquido: string | null;
}

export interface PjudLaboralMateriaItem {
  codigo: string | null;
  /** El proveedor llama a la glosa `glosa_materia` acá (Familia la manda como
   *  `glosa_de_materia`). */
  glosa_materia: string | null;
  estado: string | null;
  fecha_termino: string | null;
}

export interface PjudLaboralEscritoPendienteItem {
  doc: string | null;
  /** Forma sin confirmar: el ejemplo del proveedor trae "" en vez de una lista. */
  anexo: string | null;
  fecha_ing: string | null;
  referencia: string | null;
  solicitante: string | null;
  tipo_ingreso: string | null;
}

export interface PjudLaboralMovimientosResponse {
  estado: 'listo' | 'sincronizando' | 'error' | 'sin_credenciales';
  mensaje: string | null;
  detalle_estado: string | null;
  ultimo_error: string | null;
  causa: PjudLaboralCausaDetalle | null;
  movimiento: PjudLaboralMovimientoItem[];
  litigantes: PjudLaboralLitiganteItem[];
  notificaciones: PjudLaboralNotificacionItem[];
  diligencias: PjudLaboralDiligenciaItem[];
  liquidacion: PjudLaboralLiquidacionItem[];
  materias: PjudLaboralMateriaItem[];
  escritos_pendientes: PjudLaboralEscritoPendienteItem[];
}

/**
 * Detalle EN VIVO de una causa **Cobranza** (api-pjud), el cuarto gemelo
 * (junto a Civil/Familia/Laboral), armado desde "Solicitud cobranza.md"
 * (raíz de `ionic_app/`). Comparte con Civil los cuadernos y la cabecera con
 * anexos de la causa e información del receptor; la sección de trámites se
 * llama `historia` (como Civil). Cambia respecto a los tres:
 *  - la cabecera suma `titulo_ejec` (otro documento) y `juez_asignado`;
 *  - `historia` suma `estado_firma` (sin confirmar contra la API real);
 *  - litigantes/notificaciones/diligencias/liquidacion tienen forma propia,
 *    ninguna calza con las de Civil/Familia/Laboral;
 *  - no hay escritos por resolver, exhortos ni materias/plazos.
 */
export interface PjudCobranzaCausaDetalle {
  identificador: string;
  estado: string;
  rit: string | null;
  caratula: string | null;
  fecha_ingreso: string | null;
  ruc: string | null;
  proceso: string | null;
  forma_inicio: string | null;
  estado_proceso: string | null;
  etapa: string | null;
  est_adm: string | null;
  titulo_ejec: PjudDocumentoRef | null;
  juez_asignado: string | null;
  tribunal: string | null;
  fecha_ultima_sincronizacion: string | null;
  doc_demanda: PjudDocumentoRef | null;
  anexos_causa: PjudAnexoCausaItem[];
  /** Misma forma que `anexos_causa`; se muestra en un popup aparte, con su
   *  propio ícono de carpeta. */
  documentos_laboral: PjudAnexoCausaItem[];
  ebook: PjudDocumentoRef | null;
  certificado_envio: PjudDocumentoRef | null;
  informacion_receptor: PjudInformacionReceptorItem[];
  cuadernos: PjudCuaderno[];
}

export interface PjudCobranzaHistoriaItem {
  folio: number | null;
  folio_texto: string | null;
  documentos: PjudDocumentoTramite[];
  anexo: PjudHistoriaAnexoItem[];
  etapa: string | null;
  tramite: string | null;
  descripcion_tramite: string | null;
  /** Documento del trámite ligado a `descripcion_tramite` (viene aparte de
   *  `documentos`, la columna "Doc."): si no es null, la descripción se
   *  pinta como link a este PDF. */
  descripcion_tramite_doc: string | null;
  /** Sin confirmar contra la API real (nuevo en Cobranza, sin precedente en
   *  Civil/Familia/Laboral). */
  estado_firma: string | null;
  fecha_tramite: string | null;
  georeferencia: PjudGeoreferencia | null;
}

export interface PjudCobranzaLitiganteItem {
  sujeto: string | null;
  rut: string | null;
  persona: string | null;
  razon_social: string | null;
}

export interface PjudCobranzaNotificacionItem {
  tipo_notificacion: string | null;
  estado_notificacion: string | null;
  fecha_notificacion: string | null;
  fecha_tramite: string | null;
  tramite: string | null;
  tipo_part: string | null;
  nombre: string | null;
}

export interface PjudCobranzaDiligenciaItem {
  doc_ida: string | null;
  doc_vta: string | null;
  estado_diligencia: string | null;
  rit: string | null;
  ruc: string | null;
  tipo_diligencia: string | null;
  fecha_tramite: string | null;
  destinatario: string | null;
  responsable: string | null;
}

export interface PjudCobranzaLiquidacionItem {
  /** No es una glosa de texto: es la URL de un documento (mismo criterio que
   *  el "Doc." de Historia), ya resuelta por el backend. */
  liquidacion: string | null;
  fecha_liquidacion: string | null;
  cuaderno: string | null;
  estado: string | null;
  monto_liquido: string | null;
}

export interface PjudCobranzaMovimientosResponse {
  estado: 'listo' | 'sincronizando' | 'error' | 'sin_credenciales';
  mensaje: string | null;
  detalle_estado: string | null;
  ultimo_error: string | null;
  causa: PjudCobranzaCausaDetalle | null;
  cuaderno_consultado_id: number | null;
  historia: PjudCobranzaHistoriaItem[];
  litigantes: PjudCobranzaLitiganteItem[];
  notificaciones: PjudCobranzaNotificacionItem[];
  diligencias: PjudCobranzaDiligenciaItem[];
  liquidacion: PjudCobranzaLiquidacionItem[];
}
