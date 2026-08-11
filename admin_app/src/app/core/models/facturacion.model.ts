/**
 * Facturación de la plataforma: cuánto se le cobra a cada cliente.
 *
 * Es la otra cara de `admin_api/app/schemas/cliente.py`. Como la consola se
 * compila aparte del backend, los dos archivos son un mismo contrato y se
 * cambian juntos: no hay compilador que avise si se separan.
 *
 * **La regla**: $1 por causa de materia vigente, $2 por causa de Corte de
 * Apelaciones y $3 por causa de Corte Suprema, sobre el último archivo de
 * causas que cargó el cliente.
 */

/** Cómo terminó el cierre de un cliente. */
export type EstadoCierre = 'ok' | 'sin_datos' | 'error';

export interface FacturacionCierre {
  cliente_id: number;
  cliente_nombre: string;
  cliente_rut: string;
  /** Primer día del mes facturado, ISO. */
  periodo: string;
  causas_materia: number;
  cortes_apelaciones: number;
  cortes_suprema: number;
  /**
   * Las tarifas VIGENTES AL CIERRE, no las de hoy. Van en cada fila para que
   * subir el precio no cambie el monto de una factura ya emitida.
   */
  tarifa_materia: number;
  tarifa_apelaciones: number;
  tarifa_suprema: number;
  monto: number;
  /**
   * `error` es un cierre que no se pudo tomar —la base del cliente no
   * respondió—, no un cliente sin causas. Los dos dan monto 0 y no se
   * facturan igual.
   */
  estado: EstadoCierre;
  detalle: string | null;
  /** Null en una estimación: todavía no se cerró nada. */
  fecha_cierre: string | null;
  /** Fecha del archivo de causas con el que se contó. Null = no había ninguno. */
  fecha_archivo_causas: string | null;
}

export interface FacturacionPeriodo {
  periodo: string;
  /** Períodos con cierre, del más nuevo al más viejo. Alimenta el selector. */
  periodos_disponibles: string[];
  /**
   * true = el período no está cerrado y lo que se ve se contó recién. Puede
   * cambiar hasta el cierre, así que la pantalla tiene que decirlo.
   */
  es_estimacion: boolean;
  total_clientes: number;
  total_causas_materia: number;
  total_cortes_apelaciones: number;
  total_cortes_suprema: number;
  total_monto: number;
  /** Clientes cuya base no se pudo consultar: el cierre quedó incompleto. */
  clientes_con_error: number;
  cierres: FacturacionCierre[];
}

export interface CerrarPeriodoRequest {
  /** Ausente = el mes anterior a hoy, igual que el job del día 1. */
  periodo?: string | null;
  /**
   * Sobrescribe los cierres que ya existan. Solo tiene sentido el mismo día:
   * después, el archivo de causas del cliente ya es otro.
   */
  rehacer?: boolean;
}
