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
  /**
   * Si es true (o falta), al vencimiento se paga solo lo vencido, hasta el saldo positivo de la cuenta
   * de pago. Si es false, solo cuentan los pagos cargados a mano (transferencias a la tarjeta).
   */
  pagoAutomatico?: boolean;
  /** Cierres y vencimientos reales de cada mes (varían mes a mes). */
  ciclos: CicloTarjeta[];
  /** Límite de compra que da el banco. */
  limite?: Centavos;
}

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: "efectivo" | "banco" | "billetera" | "inversion" | "tarjeta";
  disponibilidad: Disponibilidad;
  /** Saldo al inicio de la previsión. En una tarjeta es la deuda (positiva). */
  saldoInicial: Centavos;
  /** Persona de la casa a la que pertenece. */
  titular?: string;
  /** Código de la moneda (ARS si falta). Saldos y movimientos de la cuenta están en esa moneda. */
  moneda?: string;
  /** Pesos por unidad de la moneda, para sumarla con lo demás (1 si falta). */
  cambio?: number;
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
  /** Comercio, persona o cuenta a la que va el pago o de la que viene, como figura en el extracto. */
  contraparte?: string;
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
  contraparte?: string;
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
  contraparte?: string;
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
  /** Si es true, cada cuota queda pendiente hasta que la confirmes; si no, se debita sola. */
  requiereConfirmacion?: boolean;
  /** La plata del préstamo que entra a la cuenta, y en qué mes. Sin `ingreso`, solo cuentan las cuotas. */
  ingreso?: { mes: Mes; monto: Centavos };
}

export interface Recurrente {
  id: string;
  descripcion: string;
  tipo: "ingreso" | "egreso";
  categoria: string;
  categoriaId?: string;
  contraparte?: string;
  cuentaId: string;
  montoEstimado: Centavos;
  diaDelMes: number;
  desde: Mes;
  hasta?: Mes;
  /** Si es true, cada mes queda pendiente hasta que lo confirmes. */
  requiereConfirmacion: boolean;
}

/**
 * Monto planificado para un grupo de categorías, que se repite todos los meses de `desde` a `hasta`.
 * Lo gastado en esas categorías se descuenta; lo que resta se prevé como gasto del mes.
 */
export interface Presupuesto {
  id: string;
  nombre: string;
  icono: string;
  monto: Centavos;
  /** Aumento por mes en %, para acompañar la inflación: el monto de cada mes es el anterior más ese %. */
  aumentoMensual?: number;
  /** Cuenta de la que sale lo que resta del presupuesto. */
  cuentaId: string;
  desde: Mes;
  /** Último mes; sin `hasta` se repite siempre. */
  hasta?: Mes;
  /** Categorías y subcategorías que cuentan (las subcategorías de una categoría ya incluidas). */
  categoriaIds: string[];
  /** Cuentas cuyos gastos cuentan; sin `cuentaIds`, los de todas. */
  cuentaIds?: string[];
}

/**
 * Lo que se planea pasar cada mes de una cuenta a otra para ahorrar o invertir, de `desde` a `hasta`.
 * Las transferencias cargadas a la cuenta de destino en el mes cuentan como hechas; lo que falta se prevé.
 */
export interface ObjetivoAhorro {
  id: string;
  nombre: string;
  icono: string;
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  /** Monto fijo por mes, en la moneda de la cuenta de origen. */
  monto?: Centavos;
  /** O un porcentaje de los ingresos del mes (sin lo que sobró del mes anterior). */
  porcentaje?: number;
  /** Montos puestos a mano para meses puntuales; reemplazan al fijo o al porcentaje. */
  montosPorMes?: Record<Mes, Centavos>;
  desde: Mes;
  hasta?: Mes;
}

/** Todo lo que el usuario carga. Los escenarios modifican una copia de esto. */
export interface Datos {
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  planesCuotas: PlanCuotas[];
  prestamos: Prestamo[];
  recurrentes: Recurrente[];
  presupuestos?: Presupuesto[];
  objetivos?: ObjetivoAhorro[];
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
