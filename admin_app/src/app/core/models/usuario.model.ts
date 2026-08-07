export interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
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
//
// No hay `rol`: dentro de un estudio todos hacen de todo.
//
// `nombre` y `apellido` son de UNA palabra cada uno. El backend lo rechaza si
// llegan con espacios (`validar_palabra_unica`), y el formulario lo avisa antes
// para no perder lo escrito.

export interface UsuarioCreate {
  username: string;
  email: string;
  password: string;
  nombre: string | null;
  apellido: string | null;
  telefono?: string | null;
  activo: boolean;
}

export interface UsuarioUpdate {
  /** Se puede cambiar. El id no cambia, así que el historial se conserva. */
  username: string;
  email: string;
  /** Vacío = conservar la contraseña actual */
  password?: string | null;
  nombre: string | null;
  apellido: string | null;
  telefono?: string | null;
  activo: boolean;
}
