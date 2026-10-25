import { generarCuotasPlan, generarCuotasPrestamo } from "./cuotas";
import { mesDe, rangoMeses } from "./fechas";
import { instanciarRecurrente } from "./recurrentes";
import { cicloDe, resumenDeFecha } from "./tarjeta";
import type { Centavos, Cuenta, Datos, Estado, Mes, Movimiento } from "./tipos";

export const CATEGORIA_SALDO_TARJETA = "Tarjeta (resumen anterior)";

export interface MesPrevision {
  mes: Mes;
  ingresos: Centavos;
  egresos: Centavos;
  /** ingresos - egresos del mes. */
  neto: Centavos;
  ingresosPorCategoria: Record<string, Centavos>;
  egresosPorCategoria: Record<string, Centavos>;
  /** Saldo de cada cuenta al cierre del mes. En tarjetas, la deuda. */
  saldos: Record<string, Centavos>;
  /** Lo que se puede gastar ya. */
  disponible: Centavos;
  /** Inversiones que se pueden rescatar con espera. */
  disponible48h: Centavos;
  /** Ahorro apartado. */
  reserva: Centavos;
  /** Resúmenes cerrados todavía no pagados más lo consumido en el ciclo abierto. */
  deudaTarjetas: Centavos;
  /** Ocurrencias de recurrentes que esperan confirmación en este mes. */
  pendientes: number;
}

export interface OpcionesPrevision {
  desde: Mes;
  meses: number;
  /** Qué movimientos se cuentan. Por defecto todos. */
  estados?: Estado[];
}

/** Todos los movimientos del período: los cargados más los que generan cuotas, préstamos y recurrentes. */
export function expandir(datos: Datos, desde: Mes, hasta: Mes): Movimiento[] {
  const cuentas = new Map(datos.cuentas.map((c) => [c.id, c]));
  const cuenta = (id: string) => {
    const c = cuentas.get(id);
    if (!c) throw new Error(`No existe la cuenta ${id}`);
    return c;
  };
  return [
    ...datos.movimientos,
    ...datos.planesCuotas.flatMap((p) => generarCuotasPlan(p, cuenta(p.cuentaId))),
    ...datos.prestamos.flatMap(generarCuotasPrestamo),
    ...datos.recurrentes.flatMap((r) => instanciarRecurrente(r, datos.movimientos, desde, hasta)),
  ];
}

/** Un efecto de un movimiento sobre una cuenta en un mes. */
interface Efecto {
  mes: Mes;
  cuentaId: string;
  /** Lo que suma (o resta) al saldo de la cuenta; en tarjetas, a la deuda. */
  delta: Centavos;
  /** Si el efecto es plata que entra o sale del hogar en ese mes, su categoría. */
  flujo?: { tipo: "ingreso" | "egreso"; categoria: string; monto: Centavos };
}

function efectosDe(mov: Movimiento, cuentas: Map<string, Cuenta>, desde: Mes): Efecto[] {
  const cuenta = cuentas.get(mov.cuentaId);
  if (!cuenta) throw new Error(`No existe la cuenta ${mov.cuentaId}`);
  const categoria = mov.categoria ?? "Sin categoría";

  if (mov.tipo === "transferencia") {
    const destino = cuentas.get(mov.cuentaDestinoId ?? "");
    if (!destino) throw new Error(`La transferencia ${mov.id} no tiene cuenta destino válida`);
    const mes = mesDe(mov.fecha);
    // En una tarjeta el saldo es deuda: recibir una transferencia la baja y enviarla la sube.
    const signoOrigen = cuenta.tarjeta ? 1 : -1;
    const signoDestino = destino.tarjeta ? -1 : 1;
    return [
      { mes, cuentaId: cuenta.id, delta: signoOrigen * mov.monto },
      { mes, cuentaId: destino.id, delta: signoDestino * mov.monto },
    ];
  }

  const signo = mov.tipo === "ingreso" ? 1 : -1;
  if (!cuenta.tarjeta) {
    return [
      {
        mes: mesDe(mov.fecha),
        cuentaId: cuenta.id,
        delta: signo * mov.monto,
        flujo: { tipo: mov.tipo, categoria, monto: mov.monto },
      },
    ];
  }

  // Tarjeta: la deuda sube al cierre del resumen y la plata sale al vencimiento.
  const ciclo = cicloDe(cuenta, mov.mesResumen ?? resumenDeFecha(cuenta, mov.fecha));
  // Un resumen que cerró antes de `desde` ya está incluido en el saldo inicial de la tarjeta.
  if (mesDe(ciclo.cierre) < desde) return [];
  const mesPago = mesDe(ciclo.vencimiento);
  return [
    { mes: mesDe(ciclo.cierre), cuentaId: cuenta.id, delta: -signo * mov.monto },
    { mes: mesPago, cuentaId: cuenta.id, delta: signo * mov.monto },
    {
      mes: mesPago,
      cuentaId: cuenta.tarjeta.cuentaPagoId,
      delta: signo * mov.monto,
      flujo: { tipo: mov.tipo, categoria, monto: mov.monto },
    },
  ];
}

/**
 * Previsión mes a mes, igual que la planilla: ingresos y egresos de cada mes (las compras con
 * tarjeta cuentan el mes en que se paga el resumen) y cómo quedan las cuentas al final de cada mes.
 *
 * Los saldos iniciales de las cuentas son los del comienzo de `desde`; los movimientos anteriores
 * se ignoran. El saldo inicial de una tarjeta se toma como el resumen ya cerrado que se paga en `desde`,
 * así que las compras de resúmenes cerrados antes de `desde` no se vuelven a contar.
 */
export function calcularPrevision(datos: Datos, opciones: OpcionesPrevision): MesPrevision[] {
  const meses = rangoMeses(opciones.desde, opciones.meses);
  const hasta = meses[meses.length - 1];
  const estados = new Set(opciones.estados ?? ["real", "planificado", "pendiente"]);
  const cuentas = new Map(datos.cuentas.map((c) => [c.id, c]));

  const movimientos = expandir(datos, opciones.desde, hasta).filter((m) => estados.has(m.estado));
  const efectos: Efecto[] = movimientos.flatMap((m) => efectosDe(m, cuentas, opciones.desde));

  for (const c of datos.cuentas) {
    if (c.tarjeta && c.saldoInicial > 0) {
      efectos.push(
        { mes: opciones.desde, cuentaId: c.id, delta: -c.saldoInicial },
        {
          mes: opciones.desde,
          cuentaId: c.tarjeta.cuentaPagoId,
          delta: -c.saldoInicial,
          flujo: { tipo: "egreso", categoria: CATEGORIA_SALDO_TARJETA, monto: c.saldoInicial },
        },
      );
    }
  }

  const porMes = new Map<Mes, Efecto[]>(meses.map((m) => [m, []]));
  for (const e of efectos) porMes.get(e.mes)?.push(e);

  const pendientesPorMes = new Map<Mes, number>();
  for (const m of movimientos) {
    if (m.estado === "pendiente") {
      const mes = mesDe(m.fecha);
      pendientesPorMes.set(mes, (pendientesPorMes.get(mes) ?? 0) + 1);
    }
  }

  const saldos: Record<string, Centavos> = Object.fromEntries(datos.cuentas.map((c) => [c.id, c.saldoInicial]));

  return meses.map((mes) => {
    const ingresosPorCategoria: Record<string, Centavos> = {};
    const egresosPorCategoria: Record<string, Centavos> = {};
    let ingresos = 0;
    let egresos = 0;

    for (const e of porMes.get(mes) ?? []) {
      saldos[e.cuentaId] += e.delta;
      if (!e.flujo) continue;
      if (e.flujo.tipo === "ingreso") {
        ingresos += e.flujo.monto;
        ingresosPorCategoria[e.flujo.categoria] = (ingresosPorCategoria[e.flujo.categoria] ?? 0) + e.flujo.monto;
      } else {
        egresos += e.flujo.monto;
        egresosPorCategoria[e.flujo.categoria] = (egresosPorCategoria[e.flujo.categoria] ?? 0) + e.flujo.monto;
      }
    }

    let disponible = 0;
    let disponible48h = 0;
    let reserva = 0;
    let deudaTarjetas = 0;
    for (const c of datos.cuentas) {
      const saldo = saldos[c.id];
      if (c.tarjeta) deudaTarjetas += saldo;
      else if (c.disponibilidad === "inmediata") disponible += saldo;
      else if (c.disponibilidad === "48h") disponible48h += saldo;
      else reserva += saldo;
    }

    return {
      mes,
      ingresos,
      egresos,
      neto: ingresos - egresos,
      ingresosPorCategoria,
      egresosPorCategoria,
      saldos: { ...saldos },
      disponible,
      disponible48h,
      reserva,
      deudaTarjetas,
      pendientes: pendientesPorMes.get(mes) ?? 0,
    };
  });
}

