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
   *  proveedor. Null/undefined = nunca se consultó. Solo viene en Civiles. */
  pjud_estado?: string | null;
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
}

export interface PjudDocumentoRef {
  nombre_archivo: string | null;
  url: string | null;
}

export interface PjudAnexoCausaItem {
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
  anexo: string | null;
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
  causa: PjudCausaDetalle | null;
  cuaderno_consultado_id: number | null;
  historia: PjudMovimientoItem[];
  litigantes: PjudLitiganteItem[];
  notificaciones: PjudNotificacionItem[];
  escritos_resolver: PjudEscritoResolverItem[];
  exhortos: PjudExhortoItem[];
}
