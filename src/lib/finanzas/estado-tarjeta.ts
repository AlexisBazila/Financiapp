import { mesDe, mesesEntre, sumarMeses } from "./fechas";
import { calcularPrevision, expandir } from "./prevision";
import { cicloDe, resumenDeFecha } from "./tarjeta";
import type { Centavos, Cuenta, Datos, Fecha, Mes, Movimiento } from "./tipos";

export interface PeriodoTarjeta {
  /** Mes del resumen: el período del 23/10 al 19/11 es noviembre. */
  mes: Mes;
  /** Primer día del período: el siguiente al cierre anterior. */
  desde: Fecha;
  cierre: Fecha;
  vencimiento: Fecha;
  /** Si las fechas son las cargadas para ese mes o las habituales de la tarjeta. */
  cargado: boolean;
}

export interface EstadoTarjeta {
  periodo: PeriodoTarjeta;
  /** Compras menos devoluciones del período, incluidas las cuotas que caen en él y lo planificado. */
  consumoPeriodo: Centavos;
  /** Lo mismo, contando solo lo conciliado. */
  consumoPeriodoConciliado: Centavos;
  /** Lo que se debe a `fecha`: resúmenes cerrados sin pagar más el consumo del período en curso. */
  deudaTotal: Centavos;
  /** Deuda total contando solo compras y pagos conciliados (sin los pagos automáticos previstos). */
  deudaTotalConciliada: Centavos;
  /** Cuotas de resúmenes posteriores al período en curso, que también ocupan el límite. */
  cuotasFuturas: Centavos;
  limite?: Centavos;
  /** límite - deuda total - cuotas futuras. */
  disponible?: Centavos;
}

const diaSiguiente = (fecha: Fecha): Fecha => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Fechas del período de un resumen. */
export function periodoDe(tarjeta: Cuenta, mes: Mes): PeriodoTarjeta {
  const ciclo = cicloDe(tarjeta, mes);
  return {
    mes,
    desde: diaSiguiente(cicloDe(tarjeta, sumarMeses(mes, -1)).cierre),
    cierre: ciclo.cierre,
    vencimiento: ciclo.vencimiento,
    cargado: tarjeta.tarjeta!.ciclos.some((c) => c.mes === mes),
  };
}

/** Resumen en el que cae una compra con tarjeta. */
export function resumenDe(tarjeta: Cuenta, mov: Movimiento): Mes {
  return mov.mesResumen ?? resumenDeFecha(tarjeta, mov.fecha);
}

/** Lo que suma una compra (o resta una devolución) a la deuda. */
const importe = (m: Movimiento) => (m.tipo === "egreso" ? m.monto : m.tipo === "ingreso" ? -m.monto : 0);

/**
 * Cómo está una tarjeta a `fecha`. `desde` es el mes de los saldos iniciales: el saldo inicial de la
 * tarjeta es el resumen que se paga ese mes, y lo anterior ya está ahí.
 */
export function estadoTarjeta(datos: Datos, tarjetaId: string, fecha: Fecha, desde: Mes): EstadoTarjeta {
  const tarjeta = datos.cuentas.find((c) => c.id === tarjetaId);
  if (!tarjeta?.tarjeta) throw new Error(`La cuenta ${tarjetaId} no es una tarjeta`);
  const actual = resumenDeFecha(tarjeta, fecha);
  const periodo = periodoDe(tarjeta, actual);

  const todos = expandir(datos, sumarMeses(desde, -1), sumarMeses(actual, 1));
  const compras = todos.filter((m) => m.cuentaId === tarjetaId && m.tipo !== "transferencia");
  // Mismo criterio que la previsión: los resúmenes que cerraron antes de `desde` están en el saldo inicial.
  const contadas = compras.filter((m) => mesDe(cicloDe(tarjeta, resumenDe(tarjeta, m)).cierre) >= desde);
  const deResumenes = (filtro: (resumen: Mes) => boolean, conciliadas = false) =>
    contadas
      .filter((m) => filtro(resumenDe(tarjeta, m)) && (!conciliadas || m.conciliado))
      .reduce((total, m) => total + importe(m), 0);

  const consumoPeriodo = deResumenes((r) => r === actual);
  const cuotasFuturas = contadas
    .filter((m) => m.origen.tipo === "cuotas" && resumenDe(tarjeta, m) > actual)
    .reduce((total, m) => total + importe(m), 0);

  // Pagos hasta `fecha`: los cargados (transferencias a la tarjeta) y los automáticos que prevé la previsión.
  const pagosCargados = (conciliados = false) =>
    datos.movimientos
      .filter(
        (m) =>
          m.tipo === "transferencia" && m.fecha <= fecha && mesDe(m.fecha) >= desde && (!conciliados || m.conciliado),
      )
      .reduce(
        (total, m) => total + (m.cuentaDestinoId === tarjetaId ? m.monto : m.cuentaId === tarjetaId ? -m.monto : 0),
        0,
      );
  const cargados = pagosCargados();
  const prevision =
    mesDe(fecha) >= desde
      ? calcularPrevision({ ...datos, presupuestos: [] }, { desde, meses: mesesEntre(desde, mesDe(fecha)) + 1 })
      : [];
  const automaticos = prevision
    .flatMap((m) => m.pagosTarjeta)
    .filter((p) => p.tarjetaId === tarjetaId && p.fecha <= fecha)
    .reduce((total, p) => total + p.monto, 0);

  const deudaTotal = tarjeta.saldoInicial + deResumenes((r) => r <= actual) - cargados - automaticos;
  const limite = tarjeta.tarjeta.limite;
  return {
    periodo,
    consumoPeriodo,
    consumoPeriodoConciliado: deResumenes((r) => r === actual, true),
    deudaTotal,
    deudaTotalConciliada: tarjeta.saldoInicial + deResumenes((r) => r <= actual, true) - pagosCargados(true),
    cuotasFuturas,
    limite,
    disponible: limite === undefined ? undefined : limite - Math.max(0, deudaTotal) - cuotasFuturas,
  };
}
