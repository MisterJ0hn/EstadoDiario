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
   * true = esta sesión es de la consola de plataforma.
   *
   * Lo dice el backend, no se deduce de un rol: los usuarios de un estudio ya
   * no tienen roles. Es el campo del que depende `adminPlataformaGuard`, así
   * que si deja de venir la consola no deja entrar a nadie.
   */
  es_admin_plataforma: boolean;
  /** Nulos cuando la sesión es del administrador de la plataforma. */
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  cliente_rut?: string | null;
  /** Identifica la base de datos del cliente. Viaja en cada petición como
   *  cabecera `X-Cliente-Guid`, para verificación cruzada con el token. */
  cliente_guid?: string | null;
  /**
   * La sesión es válida pero el backend rechaza todo lo demás hasta que la
   * contraseña se cambie: administrador sembrado al instalar, o clave
   * reseteada por soporte.
   */
  debe_cambiar_password?: boolean;
}

export interface CambiarPasswordRequest {
  password_nueva: string;
}

export interface ActualizarPerfilRequest {
  telefono: string | null;
}
