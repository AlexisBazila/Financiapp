import { diaDe, fechaEnMes, mesDe, sumarMeses } from "./fechas";
import { cicloDe, resumenDeFecha } from "./tarjeta";
import type { Centavos, Cuenta, Deuda, Movimiento, PlanCuotas, Prestamo } from "./tipos";

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

/** Cuotas de un préstamo según su sistema, o las cargadas a mano. */
export function montosPrestamo(prestamo: Prestamo): Centavos[] {
  if (prestamo.sistema === "manual") return prestamo.cuotasManuales ?? [];
  if (prestamo.sistema === "aleman") return cuotasAlemanas(prestamo.capital, prestamo.tasaAnual, prestamo.cantidad);
  return cuotasFrancesas(prestamo.capital, prestamo.tasaAnual, prestamo.cantidad);
}

/**
 * Cuotas de un préstamo, una por mes desde la primera, y la plata que entra si se eligió registrarla
 * (origen con número 0). Si el préstamo se confirma a mano, las cuotas quedan pendientes.
 */
export function generarCuotasPrestamo(prestamo: Prestamo): Movimiento[] {
  const montos = montosPrestamo(prestamo);
  const total = montos.length;
  const primerMes = mesDe(prestamo.primeraCuota);
  const dia = diaDe(prestamo.primeraCuota);
  const comun = {
    cuentaId: prestamo.cuentaId,
    contraparte: prestamo.contraparte,
  };

  const cuotas: Movimiento[] = montos.map((monto, k) => ({
    ...comun,
    id: `${prestamo.id}#${k + 1}`,
    fecha: fechaEnMes(sumarMeses(primerMes, k), dia),
    descripcion: `${prestamo.descripcion} (${k + 1}/${total})`,
    tipo: "egreso",
    monto,
    categoria: prestamo.categoria,
    categoriaId: prestamo.categoriaId,
    estado: prestamo.requiereConfirmacion ? "pendiente" : "planificado",
    origen: { tipo: "prestamo", prestamoId: prestamo.id, numero: k + 1, total },
  }));
  if (!prestamo.ingreso) return cuotas;
  return [
    {
      ...comun,
      id: `${prestamo.id}#0`,
      fecha: fechaEnMes(prestamo.ingreso.mes, dia),
      descripcion: prestamo.descripcion,
      tipo: "ingreso",
      monto: prestamo.ingreso.monto,
      categoria: "Préstamos recibidos",
      estado: "planificado",
      origen: { tipo: "prestamo", prestamoId: prestamo.id, numero: 0, total },
    },
    ...cuotas,
  ];
}

/**
 * Las cuotas de una deuda, cada una en el mes que se eligió. En una tarjeta entra en el resumen que cierra
 * ese mes, así que cuenta como gasto de ese mes.
 */
export function generarCuotasDeuda(deuda: Deuda, cuenta: Cuenta): Movimiento[] {
  const total = deuda.cuotas.length;
  return deuda.cuotas.map((c) => {
    const base = {
      id: `${deuda.id}#${c.numero}`,
      descripcion: `${deuda.descripcion} (${c.numero}/${total})`,
      tipo: "egreso" as const,
      monto: c.monto,
      cuentaId: deuda.cuentaId,
      categoria: deuda.categoria,
      categoriaId: deuda.categoriaId,
      contraparte: deuda.contraparte,
      estado: "planificado" as const,
      origen: { tipo: "deuda" as const, deudaId: deuda.id, numero: c.numero, total },
    };
    if (cuenta.tarjeta) return { ...base, fecha: cicloDe(cuenta, c.mes).cierre, mesResumen: c.mes };
    return { ...base, fecha: fechaEnMes(c.mes, deuda.diaDelMes) };
  });
}
