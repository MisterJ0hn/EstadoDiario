export type RolUsuario = 'admin' | 'usuario';

export interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  rol: RolUsuario;
  activo: boolean;
  fecha_creacion: string;
}

export interface UsuarioListResponse {
  exito: boolean;
  total: number;
  usuarios: Usuario[];
}

export interface UsuarioCreate {
  username: string;
  email: string;
  password: string;
  nombre: string | null;
  apellido: string | null;
  rol: RolUsuario;
  activo: boolean;
}

export interface UsuarioUpdate {
  email: string;
  /** Vacío = conservar la contraseña actual */
  password?: string | null;
  nombre: string | null;
  apellido: string | null;
  rol: RolUsuario;
  activo: boolean;
}
