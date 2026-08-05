export type RolUsuario = 'admin' | 'usuario';

export interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  rol: RolUsuario;
  activo: boolean;
  fecha_creacion: string;
}

export interface UsuarioListResponse {
  exito: boolean;
  total: number;
  usuarios: Usuario[];
}

// ── Alta y edición ───────────────────────────────────────────────────────
// Las usa SOLO la consola de la plataforma (`admin-cliente.service.ts`): dar
// de alta a alguien es de quien contrata el servicio, no del estudio.

export interface UsuarioCreate {
  username: string;
  email: string;
  password: string;
  nombre: string | null;
  apellido: string | null;
  telefono?: string | null;
  rol: RolUsuario;
  activo: boolean;
}

export interface UsuarioUpdate {
  email: string;
  /** Vacío = conservar la contraseña actual */
  password?: string | null;
  nombre: string | null;
  apellido: string | null;
  telefono?: string | null;
  rol: RolUsuario;
  activo: boolean;
}

// ── Permisos de visibilidad ──────────────────────────────────────────────
// Lo único que el administrador del estudio decide sobre su gente: qué ven.

export interface JurisdiccionOpcion {
  id: number;
  nombre: string;
}

export interface PermisosUsuario {
  usuario_id: number;
  username: string;
  nombre_completo: string;
  rol: RolUsuario;
  activo: boolean;
  /** Ids de las jurisdicciones que puede ver. **Vacío = ve todas.** */
  jurisdicciones: number[];
}

export interface PermisosUsuarioListResponse {
  exito: boolean;
  total: number;
  /** Catálogo para armar la pantalla; viene en la misma respuesta. */
  jurisdicciones: JurisdiccionOpcion[];
  usuarios: PermisosUsuario[];
}
