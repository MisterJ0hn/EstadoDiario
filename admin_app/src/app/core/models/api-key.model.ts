/** API keys de sistemas externos de un cliente.
 *
 * Permiten que otro sistema use la API del estudio sin pasar por el login (que
 * exige reCAPTCHA). Ver `backend/app/core/api_key.py`.
 */

export interface ApiKey {
  id: number;
  cliente_id: number;
  nombre: string;
  /** Primeros caracteres de la key, para reconocerla. La key completa no se guarda. */
  prefijo: string;
  /** Usuario de integración que la key usa dentro de la base del cliente. */
  usuario_id: number;
  permite_escritura: boolean;
  /** Rutas donde puede escribir. Vacío si la key es solo de lectura. */
  prefijos_escritura: string[];
  limite_por_minuto: number;
  /** IP o rangos desde los que puede usarse. Vacía = desde cualquier IP. */
  ips_permitidas: string[];
  /** False cuando fue revocada. Un vencimiento no la marca: se calcula con `expira_en`. */
  activa: boolean;
  fecha_creacion: string;
  expira_en: string | null;
  revocada_en: string | null;
  ultimo_uso: string | null;
  ultimo_ip: string | null;
}

export interface ApiKeyList {
  total: number;
  api_keys: ApiKey[];
}

export interface ApiKeyCreate {
  nombre: string;
  permite_escritura: boolean;
  /** Nulo = el valor por defecto del sistema. */
  limite_por_minuto: number | null;
  /** ISO 8601. Nulo = no vence. */
  expira_en: string | null;
  /** Vacía = desde cualquier IP. */
  ips_permitidas: string[];
}

export interface ApiKeyUpdate {
  nombre?: string;
  limite_por_minuto?: number;
  /** Omitido = no cambiar. Lista vacía = quitar la restricción. */
  ips_permitidas?: string[];
}

/** La única respuesta que trae la key en claro: no se puede volver a ver. */
export interface ApiKeyCreada extends ApiKey {
  key: string;
}
