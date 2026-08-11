/**
 * Facturación de la plataforma: la factura mensual de cada cliente.
 *
 * Es la otra cara de `admin_api/app/schemas/facturacion.py`. Como la consola se
 * compila aparte del backend, los dos archivos son un mismo contrato y se
 * cambian juntos: no hay compilador que avise si se separan.
 *
 * **La regla**: se cuenta la cartera vigente del cliente —una fila por materia,
 * más Corte de Apelaciones y Corte Suprema— y se le aplican las tarifas
 * acordadas con ese cliente. Cada factura guarda el valor unitario que usó, así
 * que cambiar una tarifa no reescribe ningún mes anterior.
 */

/** Cómo salió el conteo del mes. */
export type EstadoOrigen = 'ok' | 'sin_datos' | 'error';

/** En qué está la factura. `anulada` no se cobra ni suma en los totales. */
export type EstadoFactura = 'emitida' | 'pagada' | 'anulada';

/** De dónde salió la línea: una materia del Excel o una de las dos cortes. */
export type TipoConcepto = 'materia' | 'corte';

export interface FacturaDetalle {
  id: number;
  tipo: TipoConcepto;
  /** Lo que se imprime: `Familia`, `Civil`, `Corte de Apelaciones`. */
  concepto: string;
  cantidad: number;
  /**
   * El valor usado AL GENERAR la factura, no el que el cliente tiene hoy. Es
   * lo que hace que una factura vieja siga diciendo lo que se cobró.
   */
  valor_unitario: number;
  valor_total: number;
}

export interface Factura {
  id: number;
  /** Correlativo global de seis dígitos, como se imprime: `000042`. */
  numero: string;
  cliente_id: number;
  /** Nombre ACTUAL del cliente. `razon_social` es la copia congelada. */
  cliente_nombre: string;
  cliente_activo: boolean;
  /** Primer día del mes facturado, ISO. */
  periodo: string | null;
  fecha_emision: string;
  total: number;
  estado: EstadoFactura;

  razon_social: string;
  rut: string;
  giro: string | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  correo: string | null;

  /**
   * `error` es un mes que no se pudo contar, no un cliente sin causas. Los dos
   * dan 0 y no significan lo mismo.
   */
  origen_estado: EstadoOrigen;
  origen_detalle: string | null;
  /**
   * Fecha del archivo de causas con el que se contó. Null = no había ninguno.
   * Delata al cliente que dejó de cargar el Excel y se factura con una cartera
   * vieja.
   */
  fecha_archivo_causas: string | null;

  emitida_por: string | null;
  anulada: boolean;
  motivo_anulacion: string | null;
  detalles: FacturaDetalle[];
  /** Suma de las cantidades del detalle, ya calculada por el backend. */
  total_causas: number;
}

export interface FacturaListResponse {
  exito: boolean;
  total: number;
  /** Suma de las NO anuladas: el total tiene que ser lo cobrable. */
  total_monto: number;
  facturas: Factura[];
}

/** Los filtros del listado. Todos opcionales y combinables. */
export interface FiltroFacturas {
  cliente_id?: number | null;
  /** Acotan el PERÍODO facturado, no la fecha de generación. */
  desde?: string | null;
  hasta?: string | null;
  /**
   * Coincidencia EXACTA: el RUT está cifrado en la base y no admite búsqueda
   * parcial. Los puntos y el guion se ignoran.
   */
  rut?: string | null;
  cliente_activo?: boolean | null;
  /** Nombre del cliente o número de factura, en el mismo campo. */
  q?: string | null;
  estado?: EstadoFactura | null;
}

// ── Generación ────────────────────────────────────────────

export interface GenerarPeriodoRequest {
  /** Ausente = el mes anterior a hoy, igual que el job del día 1. */
  periodo?: string | null;
  /**
   * Anula la factura que ya exista del período y emite otra. Solo tiene
   * sentido el mismo día: después, el archivo de causas del cliente ya es otro.
   */
  rehacer?: boolean;
}

export interface ClienteConError {
  cliente_id: number;
  cliente_nombre: string;
  motivo: string;
}

export interface GenerarPeriodoResponse {
  periodo: string;
  generadas: number;
  omitidas: number;
  total_generado: number;
  con_error: ClienteConError[];
}

// ── Estimación del período en curso ───────────────────────

export interface EstimacionLinea {
  tipo: TipoConcepto;
  concepto: string;
  cantidad: number;
  valor_unitario: number;
  valor_total: number;
}

export interface EstimacionCliente {
  cliente_id: number;
  cliente_nombre: string;
  cliente_rut: string;
  cliente_activo: boolean;
  total: number;
  total_causas: number;
  origen_estado: EstadoOrigen;
  origen_detalle: string | null;
  fecha_archivo_causas: string | null;
  detalles: EstimacionLinea[];
}

export interface EstimacionPeriodo {
  periodo: string;
  /** true = el período ya tiene facturas; esto es una estimación de lo cobrado. */
  ya_generado: boolean;
  total_clientes: number;
  total_monto: number;
  total_causas: number;
  /** Clientes cuya base no se pudo consultar: no se les puede facturar. */
  clientes_con_error: number;
  clientes: EstimacionCliente[];
}

// ── Tarifas por cliente ───────────────────────────────────

export interface Tarifa {
  id: number;
  cliente_id: number;
  /** `materia`, `apelaciones`, `suprema` o `materia:<nombre>`. */
  concepto: string;
  valor_unitario: number;
  activo: boolean;
}

export interface TarifasCliente {
  cliente_id: number;
  cliente_nombre: string;
  /** Solo lo configurado. Un concepto ausente se cobra al valor por defecto. */
  tarifas: Tarifa[];
  /** {concepto: valor} de la plataforma, como referencia. */
  por_defecto: Record<string, number>;
}

export interface TarifaUpsertRequest {
  concepto: string;
  valor_unitario: number;
  activo?: boolean;
}
