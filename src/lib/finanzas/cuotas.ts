import { diaDe, fechaEnMes, mesDe, sumarMeses } from "./fechas";
import { cicloDe, resumenDeFecha } from "./tarjeta";
import type { Centavos, Cuenta, Movimiento, PlanCuotas, Prestamo } from "./tipos";

/** Reparte `total` en `n` partes enteras; la diferencia de redondeo va a la última. */
export function repartir(total: Centavos, n: number): Centavos[] {
  const base = Math.floor(total / n);
  const partes = Array<Centavos>(n).fill(base);
  partes[n - 1] = total - base * (n - 1);
  return partes;
}

/** Tabla de cuotas con cuota fija (sistema francés). Sin tasa, cuotas iguales. */
export function cuotasFrancesas(capital: Centavos, tasaAnual: number, n: number): Centavos[] {
  const i = tasaAnual / 100 / 12;
  if (i === 0) return repartir(capital, n);
  const cuotaFija = Math.round((capital * i) / (1 - Math.pow(1 + i, -n)));
  const cuotas: Centavos[] = [];
  let saldo = capital;
  for (let k = 1; k <= n; k++) {
    const interes = Math.round(saldo * i);
    const amortizacion = k === n ? saldo : cuotaFija - interes;
    cuotas.push(amortizacion + interes);
    saldo -= amortizacion;
  }
  return cuotas;
}

/** Tabla de cuotas con amortización fija (sistema alemán): la cuota baja cada mes. */
export function cuotasAlemanas(capital: Centavos, tasaAnual: number, n: number): Centavos[] {
  const i = tasaAnual / 100 / 12;
  const amortizaciones = repartir(capital, n);
  let saldo = capital;
  return amortizaciones.map((amortizacion) => {
    const interes = Math.round(saldo * i);
    saldo -= amortizacion;
    return amortizacion + interes;
  });
}

/**
 * Genera "cuota N de M" para una compra en cuotas.
 * En una tarjeta, la cuota 1 entra en el resumen que corresponde a la fecha de compra
 * y cada cuota siguiente en el resumen del mes siguiente.
 */
export function generarCuotasPlan(plan: PlanCuotas, cuenta: Cuenta): Movimiento[] {
  const montos = cuotasFrancesas(plan.montoTotal, plan.tasaAnual ?? 0, plan.cantidad);
  const primerResumen = cuenta.tarjeta ? resumenDeFecha(cuenta, plan.fechaCompra) : undefined;

  return montos.map((monto, k) => {
    const base = {
      id: `${plan.id}#${k + 1}`,
      descripcion: `${plan.descripcion} (${k + 1}/${plan.cantidad})`,
      tipo: "egreso" as const,
      monto,
      cuentaId: plan.cuentaId,
      categoria: plan.categoria,
      categoriaId: plan.categoriaId,
      contraparte: plan.contraparte,
      estado: "planificado" as const,
      origen: { tipo: "cuotas" as const, planId: plan.id, numero: k + 1, total: plan.cantidad },
    };
    if (primerResumen) {
      const mesResumen = sumarMeses(primerResumen, k);
      return { ...base, fecha: cicloDe(cuenta, mesResumen).cierre, mesResumen };
    }
    const mes = sumarMeses(mesDe(plan.fechaCompra), k);
    return { ...base, fecha: fechaEnMes(mes, diaDe(plan.fechaCompra)) };
  });
}

export function generarCuotasPrestamo(prestamo: Prestamo): Movimiento[] {
  const montos =
    prestamo.sistema === "manual"
      ? (prestamo.cuotasManuales ?? [])
      : prestamo.sistema === "aleman"
        ? cuotasAlemanas(prestamo.capital, prestamo.tasaAnual, prestamo.cantidad)
        : cuotasFrancesas(prestamo.capital, prestamo.tasaAnual, prestamo.cantidad);
  const total = montos.length;
  const primerMes = mesDe(prestamo.primeraCuota);
  const dia = diaDe(prestamo.primeraCuota);

  return montos.map((monto, k) => ({
    id: `${prestamo.id}#${k + 1}`,
    fecha: fechaEnMes(sumarMeses(primerMes, k), dia),
    descripcion: `${prestamo.descripcion} (${k + 1}/${total})`,
    tipo: "egreso",
    monto,
    cuentaId: prestamo.cuentaId,
    categoria: prestamo.categoria,
    categoriaId: prestamo.categoriaId,
    contraparte: prestamo.contraparte,
    estado: "planificado",
    origen: { tipo: "prestamo", prestamoId: prestamo.id, numero: k + 1, total },
  }));
}
