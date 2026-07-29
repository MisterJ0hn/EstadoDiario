export interface LoginRequest {
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
  rol: string;
  activo: boolean;
}

export interface ActualizarPerfilRequest {
  telefono: string | null;
}
