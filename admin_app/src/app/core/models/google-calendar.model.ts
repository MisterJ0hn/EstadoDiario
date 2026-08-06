export interface EstadoConexionGoogle {
  conectado: boolean;
  google_email?: string | null;
}

export interface ConectarGoogleResponse {
  url: string;
}

export interface ConfiguracionGoogle {
  activo: boolean;
  client_id: string | null;
  tiene_client_secret: boolean;
  fecha_modificacion: string;
}

export interface ConfiguracionGoogleUpdate {
  activo: boolean;
  client_id: string | null;
  /** Vacío = conservar el client secret ya guardado */
  client_secret?: string | null;
}
