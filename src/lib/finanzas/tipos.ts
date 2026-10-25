// Modelo de datos del motor de previsión.
// Todos los montos están en centavos enteros (nunca decimales) y siempre son positivos:
// el signo lo da el tipo de movimiento.

/** Fecha ISO "AAAA-MM-DD". */
export type Fecha = string;
/** Mes "AAAA-MM". */
export type Mes = string;
/** Monto en centavos. */
export type Centavos = number;

/**
 * Cuánto se puede usar el dinero de una cuenta:
 * - inmediata: se puede gastar ya (efectivo, caja de ahorro, billetera).
 * - 48h: se puede usar pero hay que esperar el rescate (inversiones líquidas).
 * - reserva: ahorro apartado; cuenta para el patrimonio pero no como disponible.
 */
export type Disponibilidad = "inmediata" | "48h" | "reserva";

export interface CicloTarjeta {
  /** Mes del resumen, por ejemplo "2026-11". */
  mes: Mes;
  cierre: Fecha;
  vencimiento: Fecha;
}

export interface ConfigTarjeta {
  /** Día de cierre habitual; se usa para los meses sin ciclo cargado. */
  diaCierre: number;
  /** Día de vencimiento habitual, en el mes siguiente al cierre. */
  diaVencimiento: number;
  /** Cuenta desde la que se paga el resumen. */
  cuentaPagoId: string;
  /** Cierres y vencimientos reales de cada mes (varían mes a mes). */
  ciclos: CicloTarjeta[];
}

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: "efectivo" | "banco" | "billetera" | "inversion" | "tarjeta";
  disponibilidad: Disponibilidad;
  /** Saldo al inicio de la previsión. En una tarjeta es la deuda (positiva). */
  saldoInicial: Centavos;
  tarjeta?: ConfigTarjeta;
}

/**
 * - real: ya pasó y está en la cuenta.
 * - planificado: seguro o casi seguro, todavía no pasó.
 * - pendiente: generado por un recurrente; espera que lo confirmes.
 */
export type Estado = "real" | "planificado" | "pendiente";

export type Origen =
  | { tipo: "manual" }
  | { tipo: "cuotas"; planId: string; numero: number; total: number }
  | { tipo: "prestamo"; prestamoId: string; numero: number; total: number }
  | { tipo: "recurrente"; recurrenteId: string; mes: Mes };

export interface Movimiento {
  id: string;
  fecha: Fecha;
  descripcion: string;
  tipo: "ingreso" | "egreso" | "transferencia";
  monto: Centavos;
  cuentaId: string;
  /** Solo en transferencias. */
  cuentaDestinoId?: string;
  /** Nombre con el que se agrupa en la previsión (la categoría principal). */
  categoria?: string;
  /** Categoría o subcategoría elegida. */
  categoriaId?: string;
  estado: Estado;
  origen: Origen;
  /** Solo en compras con tarjeta: resumen en el que cae, si ya se conoce. */
  mesResumen?: Mes;
  /** Chequeado contra el extracto del banco o la tarjeta. No cambia la previsión. */
  conciliado?: boolean;
}

export interface PlanCuotas {
  id: string;
  descripcion: string;
  categoria: string;
  categoriaId?: string;
  cuentaId: string;
  fechaCompra: Fecha;
  /** Precio de contado. */
  montoTotal: Centavos;
  cantidad: number;
  /** Tasa nominal anual en %, sistema francés. 0 o ausente = sin interés. */
  tasaAnual?: number;
}

export interface Prestamo {
  id: string;
  descripcion: string;
  categoria: string;
  categoriaId?: string;
  /** Cuenta desde la que se pagan las cuotas. */
  cuentaId: string;
  capital: Centavos;
  /** Fecha de la primera cuota. */
  primeraCuota: Fecha;
  cantidad: number;
  tasaAnual: number;
  /** francés: cuota fija. alemán: amortización fija, cuota decreciente. manual: tabla cargada a mano. */
  sistema: "frances" | "aleman" | "manual";
  cuotasManuales?: Centavos[];
}

export interface Recurrente {
  id: string;
  descripcion: string;
  tipo: "ingreso" | "egreso";
  categoria: string;
  categoriaId?: string;
  cuentaId: string;
  montoEstimado: Centavos;
  diaDelMes: number;
  desde: Mes;
  hasta?: Mes;
  /** Si es true, cada mes queda pendiente hasta que lo confirmes. */
  requiereConfirmacion: boolean;
}

/** Todo lo que el usuario carga. Los escenarios modifican una copia de esto. */
export interface Datos {
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  planesCuotas: PlanCuotas[];
  prestamos: Prestamo[];
  recurrentes: Recurrente[];
}

type Coleccion = "movimientos" | "planesCuotas" | "prestamos" | "recurrentes";
type ElementoDe<C extends Coleccion> = Datos[C][number];

/** Diferencia de un escenario respecto de su base. */
export type Cambio = {
  [C in Coleccion]:
    | { accion: "agregar"; coleccion: C; elemento: ElementoDe<C> }
    | { accion: "quitar"; coleccion: C; id: string }
    | { accion: "modificar"; coleccion: C; id: string; campos: Partial<ElementoDe<C>> };
}[Coleccion];

export interface Escenario {
  id: string;
  nombre: string;
  /** Escenario del que parte. Sin padre = parte del plan base. */
  padreId?: string;
  estado: "activo" | "aplicado" | "archivado";
  cambios: Cambio[];
}
