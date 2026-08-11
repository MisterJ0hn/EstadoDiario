export interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  activo: boolean;
  /**
   * RUT con los que esta persona recibe archivos del PJUD, en formato
   * `12345678-9`.
   *
   * No son el RUT del estudio: el Poder Judicial emite cada reporte a nombre
   * del abogado que lo pide, así que un estudio con cinco abogados recibe
   * archivos con cinco RUT distintos. Son varios por persona porque un abogado
   * puede litigar además a nombre de una sociedad.
   *
   * Con la lista vacía, el estudio sigue funcionando: la advertencia al
   * importar cae al RUT del cliente, que es lo que se hacía antes.
   */
  ruts: string[];
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
  /** La lista COMPLETA: no hay endpoint para agregar o quitar uno solo. */
  ruts: string[];
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
  /** Reemplaza a la lista anterior; mandarla vacía borra todos los RUT. */
  ruts: string[];
  activo: boolean;
}
