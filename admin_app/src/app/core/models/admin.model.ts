/** Modelo de la consola de administración de la plataforma (multi-tenant).
 *
 * Un `Cliente` es un estudio jurídico completo: tiene su propia base de datos,
 * su casilla de ingesta y sus usuarios. Nada de esto lo ve un usuario de
 * cliente; solo el administrador de la plataforma.
 */

/** Estado de la base de datos del cliente.
 *
 * Crearla no es instantáneo ni reversible con un clic: hasta que llega a
 * `listo`, el cliente existe en la lista pero sus usuarios no pueden entrar.
 * La interfaz tiene que decirlo en vez de mostrar una ficha a medias.
 */
export type EstadoAprovisionamiento = 'en_cola' | 'creando' | 'listo' | 'error';

export interface Cliente {
  id: number;
  nombre: string;
  /** Con guion y dígito verificador: `12345678-9`. */
  rut: string;
  /** Identifica la base de datos del cliente y arma su inbox por defecto. */
  guid: string;
  /** Correo de contacto del estudio (no es la casilla de ingesta). */
  correo: string;
  /** Casilla de ingesta. Por defecto `{guid}@temposoft.cl`. */
  inbox: string;
  activo: boolean;
  fecha_creacion: string;
  aprovisionamiento: EstadoAprovisionamiento;
  /** Qué falló, cuando `aprovisionamiento` es `error`. */
  aprovisionamiento_detalle: string | null;
  total_usuarios: number;
  /**
   * Causas de materia VIGENTES del último archivo de causas que cargó el
   * cliente: las mismas que su gente ve en "Mis Causas · Materia".
   *
   * Es del último archivo y no de todos porque el Excel de Causas trae la
   * cartera completa cada vez: sumarlos daría la cartera multiplicada por la
   * cantidad de veces que se cargó el reporte.
   *
   * `0` también cuando su base de datos no respondió, así que no distingue
   * "sin causas" de "no se pudo consultar".
   */
  causas_activas: number;
  /**
   * Datos comerciales para la cabecera de la orden de compra. Opcionales: el
   * cliente ya existe sin ellos y la orden omite lo que falte en vez de
   * imprimir una etiqueta con la línea vacía al lado.
   */
  giro: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  tipo: TipoCliente;
  /** Tope de usuarios contratado. Null en los patrocinadores, donde es 1. */
  cal: number | null;
  /** Solo en la respuesta del alta: cuántos usuarios se crearon. */
  usuarios_creados?: number | null;
  /** Solo en la respuesta del alta: los que no se pudieron crear, con el motivo. */
  usuarios_con_error?: string[];
  /**
   * Logo del estudio como `data:<mime>;base64,<...>`, listo para un <img src>.
   * `null` = sin logo. Ojo: para GUARDARLO se manda el base64 SIN el prefijo
   * (ver `guardarLogo`); acá viene con él porque es para mostrar.
   */
  logo: string | null;
}

export interface ClienteListResponse {
  exito: boolean;
  total: number;
  page: number;
  total_pages: number;
  clientes: Cliente[];
}

export type TipoCliente = 'estudio' | 'patrocinador';

/** Un usuario a crear junto con el cliente, en la misma llamada. */
export interface UsuarioInicial {
  username: string;
  email: string | null;
  password: string;
  /** Una sola palabra cada uno; el backend rechaza los compuestos. */
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
}

/**
 * Alta de un cliente CON sus usuarios.
 *
 * Van juntos a propósito: antes el cliente se creaba vacío y los usuarios se
 * agregaban después, y un alta interrumpida dejaba un estudio al que nadie
 * podía entrar, indistinguible de uno completo.
 */
export interface ClienteCreate {
  nombre: string;
  rut: string;
  correo: string;
  tipo: TipoCliente;
  /** Abogados patrocinadores contratados. Null en `patrocinador`, donde es 1. */
  cal: number | null;
  /** Tantos como el CAL; exactamente uno si es `patrocinador`. */
  usuarios: UsuarioInicial[];
}

export interface ClienteUpdate {
  nombre: string;
  /**
   * Se puede corregir. Es la credencial de login del estudio, así que
   * cambiarlo obliga a todos sus usuarios a entrar con el nuevo.
   * `guid` y `base_datos` NO están acá a propósito: identifican la base de
   * datos del cliente.
   */
  rut: string;
  correo: string;
  /** Ampliar o reducir lo contratado. No puede quedar bajo los usuarios activos. */
  cal?: number | null;
  /** Cabecera de la orden de compra. Vacío = se guarda nulo y no se imprime. */
  giro?: string | null;
  direccion?: string | null;
  comuna?: string | null;
  ciudad?: string | null;
  activo: boolean;
}

/** Respuesta corta del polling de aprovisionamiento. */
export interface AprovisionamientoEstado {
  cliente_id: number;
  estado: EstadoAprovisionamiento;
  detalle: string | null;
}

// ── Dashboard ────────────────────────────────────────────────────────────

/** Fila del dashboard: el cliente más su pulso de actividad. */
export interface ClienteActividad {
  id: number;
  nombre: string;
  rut: string;
  inbox: string;
  /** false = suspendido: no cuenta para los KPIs de actividad. */
  activo: boolean;
  total_usuarios: number;
  aprovisionamiento: EstadoAprovisionamiento;
  /** Última vez que entró un archivo por cualquier vía. Null = nunca. */
  ultima_importacion: string | null;
  /** Días transcurridos desde `ultima_importacion`. Null = nunca importó. */
  dias_sin_importar: number | null;
  /** Movimientos importados dentro del período consultado. */
  movimientos_periodo: number;
}

/** Cliente cuya creación de base de datos falló. */
export interface ClienteConProblema {
  id: number;
  nombre: string;
  detalle: string | null;
}

export interface AdminDashboard {
  dias: number;
  /** `YYYY-MM-DD` */
  desde: string;
  hasta: string;
  kpis: {
    clientes_activos: number;
    clientes_suspendidos: number;
    usuarios_habilitados: number;
    /** Activos que no reciben archivos hace más de `umbral_sin_importar` días. */
    clientes_sin_importar: number;
  };
  umbral_sin_importar: number;
  aprovisionamientos_en_curso: number;
  aprovisionamientos_con_error: ClienteConProblema[];
  clientes: ClienteActividad[];
}

// ── Casilla de ingesta del cliente ───────────────────────────────────────

export interface ClienteInbox {
  /** `{guid}@temposoft.cl`. La genera el backend, no se edita. */
  direccion_por_defecto: string;
  /** true = el cliente lee de su propia casilla IMAP y no de la del sistema. */
  usar_casilla_propia: boolean;
  host: string;
  puerto: number;
  usar_ssl: boolean;
  usuario: string | null;
  /** El backend nunca devuelve la contraseña, solo si hay una guardada. */
  tiene_password: boolean;
  carpeta: string;
  remitentes_permitidos: string | null;
  asunto_estado_diario: string | null;
  asunto_movimientos: string | null;
  asunto_audiencias: string | null;
  /** `HH:mm` */
  hora_ejecucion: string | null;
  ultima_ejecucion: string | null;
  ultimo_resultado: string | null;
}

export interface ClienteInboxUpdate {
  usar_casilla_propia: boolean;
  host: string;
  puerto: number;
  usar_ssl: boolean;
  usuario: string | null;
  /** Vacío = conservar la contraseña ya guardada. */
  password?: string | null;
  carpeta: string;
  remitentes_permitidos: string | null;
  asunto_estado_diario: string | null;
  asunto_movimientos: string | null;
  asunto_audiencias: string | null;
  hora_ejecucion: string | null;
}

// ── Configuración transversal del sistema ────────────────────────────────

export interface ConfiguracionSistema {
  /** Días que se conserva el log de actividades antes de purgarse. */
  retencion_log_dias: number;
  ultima_purga: string | null;
  /** Registros que hay hoy en el log, para dimensionar el cambio. */
  registros_log: number;
  /** Cuántos borraría la política actual si se purgara ahora. */
  registros_a_purgar: number;
}

export interface ConfiguracionSistemaUpdate {
  retencion_log_dias: number;
}

/** Respuesta genérica de las operaciones de la consola. */
export interface AdminOperacionResponse {
  exito: boolean;
  mensaje: string;
}
