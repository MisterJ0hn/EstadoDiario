/** Sesión de usuario de un cliente: el RUT del estudio decide a qué base de
 *  datos entra. Sin él, el mismo `username` puede existir en varios clientes. */
export interface LoginRequest {
  /** RUT del estudio, con guion: `12345678-9`. */
  rut: string;
  username: string;
  password: string;
}

/** Sesión del administrador de la plataforma: no pertenece a ningún cliente. */
export interface LoginAdminRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  activo: boolean;
  /**
   * RUT con los que ESTA persona recibe archivos del PJUD, formateados
   * `12345678-9`. Los carga la plataforma en la ficha del usuario.
   *
   * No son el RUT del estudio: el Poder Judicial emite cada reporte a nombre
   * del abogado que lo pide, así que un estudio con cinco abogados recibe
   * archivos con cinco RUT distintos. Vacío = nunca se le cargó ninguno, y ahí
   * la advertencia al importar cae al RUT del estudio.
   */
  ruts?: string[];
  /** Nulos cuando la sesión es del administrador de la plataforma. */
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  cliente_rut?: string | null;
  /** Logo del estudio como `data:` URI, listo para un <img src>. */
  cliente_logo?: string | null;
  /** Identifica la base de datos del cliente. Viaja en cada petición como
   *  cabecera `X-Cliente-Guid`, para verificación cruzada con el token. */
  cliente_guid?: string | null;
  /**
   * Casilla de ingesta del estudio: a esta dirección se le reenvían los Excel
   * del PJUD para que entren solos. El estudio no la elige —la asigna la
   * plataforma—, así que se muestra para leerla y copiarla, no para editarla.
   */
  cliente_inbox?: string | null;
  /**
   * La sesión es válida pero el backend rechaza todo lo demás hasta que la
   * contraseña se cambie: administrador sembrado al instalar, o clave
   * reseteada por soporte.
   */
  debe_cambiar_password?: boolean;
  /**
   * Si esta persona ya cargó su clave del Poder Judicial (Mi Perfil). La
   * necesita `/sincronizar_civil` de "Detalle PJUD" para las causas que el
   * PJUD todavía no scrapeó. La clave nunca viaja: solo si está o no.
   */
  pjud_configurado?: boolean;
  /** 1 = Clave del Poder Judicial, 2 = ClaveÚnica. */
  pjud_metodo_login?: number;
}

/** Estado de la clave del OJV. La clave nunca se devuelve. */
export interface PjudCredenciales {
  configurado: boolean;
  rut: string | null;
  metodo_login: number;
}

export interface PjudCredencialesUpdate {
  rut: string;
  /** Vacío / omitido = dejar la que ya está guardada. */
  clave?: string | null;
  metodo_login: number;
}

export interface CambiarPasswordRequest {
  password_nueva: string;
  /**
   * Obligatoria en el cambio VOLUNTARIO (desde el perfil), opcional cuando la
   * clave es provisoria: ahí la persona acaba de escribirla para entrar y
   * pedírsela de nuevo es fricción sin ganancia. Quien lo exige es el
   * servidor; acá va opcional porque el mismo contrato sirve a los dos casos.
   */
  password_actual?: string;
}

/** Paso 1 de la recuperación: el RUT dice en qué base buscar el correo. */
export interface RecuperarPasswordRequest {
  rut: string;
  email: string;
}

/** Paso 2: el token venía en el enlace del correo, como `?token=`. */
export interface RestablecerPasswordRequest {
  token: string;
  password_nueva: string;
}

/** Respuesta estándar de la API: `exito`/`mensaje`, no success/message. */
export interface OperacionResponse {
  exito: boolean;
  mensaje: string;
}

export interface ActualizarPerfilRequest {
  telefono: string | null;
}
