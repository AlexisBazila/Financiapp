import { generarCuotasPlan, generarCuotasPrestamo } from "./cuotas";
import { fechaEnMes, mesDe, rangoMeses } from "./fechas";
import { instanciarRecurrente } from "./recurrentes";
import { cicloDe, resumenDeFecha } from "./tarjeta";
import type { Centavos, Cuenta, Datos, Estado, Mes, Movimiento, Presupuesto } from "./tipos";

export const CATEGORIA_SALDO_TARJETA = "Tarjeta (resumen anterior)";

/** Qué tan seguro es un monto: planificado, ya pasó, o ya pasó y se chequeó con el banco. */
export type Certeza = "planificado" | "real" | "conciliado";

export interface Celda {
  /** La menos segura de las partes que la componen. */
  certeza: Certeza;
  /** Si incluye cuotas de compras o préstamos. */
  cuotas: boolean;
}

export interface MesPresupuesto {
  id: string;
  nombre: string;
  monto: Centavos;
  /** Gastado en sus categorías, por fecha de compra. */
  gastado: Centavos;
  /** monto - gastado; negativo si se pasó. */
  resto: Centavos;
}

export interface MesPrevision {
  mes: Mes;
  ingresos: Centavos;
  egresos: Centavos;
  /** ingresos - egresos del mes. */
  neto: Centavos;
  ingresosPorCategoria: Record<string, Centavos>;
  egresosPorCategoria: Record<string, Centavos>;
  /** Certeza de cada monto por categoría; clave `ingreso:categoría` o `egreso:categoría`. */
  celdas: Record<string, Celda>;
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
  /** Cuotas de compras y préstamos que se pagan este mes. */
  cuotasDelMes: Centavos;
  /** Lo que queda por pagar en cuotas después de este mes. */
  deudaCuotas: Centavos;
  presupuestos: MesPresupuesto[];
}

export interface OpcionesPrevision {
  desde: Mes;
  meses: number;
  /** Qué movimientos se cuentan. Por defecto todos. */
  estados?: Estado[];
  /**
   * Mes actual. Lo que resta de un presupuesto se prevé como gasto solo desde este mes: en los meses
   * pasados, lo que no se gastó no se va a gastar. Sin `mesActual`, se prevé en todos.
   */
  mesActual?: Mes;
}

/** Clave de una cuota generada, para reconocerla cuando ya se cargó (confirmada o editada). */
function claveCuota(origen: Movimiento["origen"]): string | undefined {
  if (origen.tipo === "cuotas") return `cuotas:${origen.planId}:${origen.numero}`;
  if (origen.tipo === "prestamo") return `prestamo:${origen.prestamoId}:${origen.numero}`;
  return undefined;
}

/**
 * Todos los movimientos del período: los cargados más los que generan cuotas, préstamos y recurrentes.
 * Una cuota o un recurrente que ya se cargó (al confirmarlo o editarlo) reemplaza al generado.
 */
export function expandir(datos: Datos, desde: Mes, hasta: Mes): Movimiento[] {
  const cuentas = new Map(datos.cuentas.map((c) => [c.id, c]));
  const cuenta = (id: string) => {
    const c = cuentas.get(id);
    if (!c) throw new Error(`No existe la cuenta ${id}`);
    return c;
  };
  const cargadas = new Set(datos.movimientos.map((m) => claveCuota(m.origen)).filter(Boolean));
  const sinCargar = (m: Movimiento) => !cargadas.has(claveCuota(m.origen));
  return [
    ...datos.movimientos,
    ...datos.planesCuotas.flatMap((p) => generarCuotasPlan(p, cuenta(p.cuentaId))).filter(sinCargar),
    ...datos.prestamos.flatMap(generarCuotasPrestamo).filter(sinCargar),
    ...datos.recurrentes.flatMap((r) => instanciarRecurrente(r, datos.movimientos, desde, hasta)),
  ];
}

/** Mes en que sale la plata de un movimiento: el del vencimiento del resumen si es con tarjeta. */
export function mesDePago(mov: Movimiento, cuentas: Map<string, Cuenta>): Mes {
  const cuenta = cuentas.get(mov.cuentaId);
  if (!cuenta?.tarjeta || mov.tipo === "transferencia") return mesDe(mov.fecha);
  return mesDe(cicloDe(cuenta, mov.mesResumen ?? resumenDeFecha(cuenta, mov.fecha)).vencimiento);
}

/** Un efecto de un movimiento sobre una cuenta en un mes. */
interface Efecto {
  mes: Mes;
  cuentaId: string;
  /** Lo que suma (o resta) al saldo de la cuenta; en tarjetas, a la deuda. */
  delta: Centavos;
  /** Si el efecto es plata que entra o sale del hogar en ese mes, su categoría. */
  flujo?: { tipo: "ingreso" | "egreso"; categoria: string; monto: Centavos; certeza: Certeza; cuota: boolean };
}

function certezaDe(mov: Movimiento): Certeza {
  if (mov.estado !== "real") return "planificado";
  return mov.conciliado ? "conciliado" : "real";
}

const ORDEN_CERTEZA: Record<Certeza, number> = { planificado: 0, real: 1, conciliado: 2 };

function efectosDe(mov: Movimiento, cuentas: Map<string, Cuenta>, desde: Mes): Efecto[] {
  const cuenta = cuentas.get(mov.cuentaId);
  if (!cuenta) throw new Error(`No existe la cuenta ${mov.cuentaId}`);
  const categoria = mov.categoria ?? "Sin categoría";
  const certeza = certezaDe(mov);
  const cuota = claveCuota(mov.origen) !== undefined;

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
        flujo: { tipo: mov.tipo, categoria, monto: mov.monto, certeza, cuota },
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
      flujo: { tipo: mov.tipo, categoria, monto: mov.monto, certeza, cuota },
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

  const todos = expandir(datos, opciones.desde, hasta);
  const movimientos = todos.filter((m) => estados.has(m.estado));
  const efectos: Efecto[] = movimientos.flatMap((m) => efectosDe(m, cuentas, opciones.desde));

  for (const c of datos.cuentas) {
    if (c.tarjeta && c.saldoInicial > 0) {
      efectos.push(
        { mes: opciones.desde, cuentaId: c.id, delta: -c.saldoInicial },
        {
          mes: opciones.desde,
          cuentaId: c.tarjeta.cuentaPagoId,
          delta: -c.saldoInicial,
          flujo: {
            tipo: "egreso",
            categoria: CATEGORIA_SALDO_TARJETA,
            monto: c.saldoInicial,
            certeza: "real",
            cuota: false,
          },
        },
      );
    }
  }

  const presupuestosPorMes = new Map<Mes, MesPresupuesto[]>();
  for (const mes of meses) {
    const delMes: MesPresupuesto[] = [];
    for (const p of datos.presupuestos ?? []) {
      if (mes < p.desde || (p.hasta && mes > p.hasta)) continue;
      const resumen = resumenPresupuesto(p, mes, movimientos);
      delMes.push(resumen);
      if (resumen.resto > 0 && (!opciones.mesActual || mes >= opciones.mesActual)) {
        efectos.push(...efectosDe(restoPresupuesto(p, mes, resumen.resto), cuentas, opciones.desde));
      }
    }
    presupuestosPorMes.set(mes, delMes);
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

  // Cuotas por mes de pago, para la deuda en cuotas (se cuentan aunque se filtre por estado).
  const cuotasPorMes = new Map<Mes, Centavos>();
  for (const m of todos) {
    if (claveCuota(m.origen) && m.tipo === "egreso") {
      const mes = mesDePago(m, cuentas);
      cuotasPorMes.set(mes, (cuotasPorMes.get(mes) ?? 0) + m.monto);
    }
  }
  const cuotasDespuesDe = (mes: Mes) =>
    [...cuotasPorMes].reduce((total, [m, monto]) => (m > mes ? total + monto : total), 0);

  const saldos: Record<string, Centavos> = Object.fromEntries(datos.cuentas.map((c) => [c.id, c.saldoInicial]));

  return meses.map((mes) => {
    const ingresosPorCategoria: Record<string, Centavos> = {};
    const egresosPorCategoria: Record<string, Centavos> = {};
    const celdas: Record<string, Celda> = {};
    let ingresos = 0;
    let egresos = 0;

    for (const e of porMes.get(mes) ?? []) {
      saldos[e.cuentaId] += e.delta;
      if (!e.flujo) continue;
      const clave = `${e.flujo.tipo}:${e.flujo.categoria}`;
      const previa = celdas[clave];
      celdas[clave] = {
        certeza:
          previa && ORDEN_CERTEZA[previa.certeza] < ORDEN_CERTEZA[e.flujo.certeza] ? previa.certeza : e.flujo.certeza,
        cuotas: Boolean(previa?.cuotas) || e.flujo.cuota,
      };
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
      celdas,
      saldos: { ...saldos },
      disponible,
      disponible48h,
      reserva,
      deudaTarjetas,
      pendientes: pendientesPorMes.get(mes) ?? 0,
      cuotasDelMes: cuotasPorMes.get(mes) ?? 0,
      deudaCuotas: cuotasDespuesDe(mes),
      presupuestos: presupuestosPorMes.get(mes) ?? [],
    };
  });
}


/** Etiqueta con la que lo que resta de un presupuesto aparece en los egresos de la previsión. */
export function categoriaResto(p: Pick<Presupuesto, "icono" | "nombre">): string {
  return `${p.icono ? `${p.icono} ` : ""}${p.nombre} (resto del presupuesto)`;
}

function resumenPresupuesto(p: Presupuesto, mes: Mes, movimientos: Movimiento[]): MesPresupuesto {
  const categorias = new Set(p.categoriaIds);
  const gastado = movimientos
    .filter((m) => m.tipo === "egreso" && m.categoriaId && categorias.has(m.categoriaId) && mesDe(m.fecha) === mes)
    .reduce((total, m) => total + m.monto, 0);
  return { id: p.id, nombre: p.nombre, monto: p.monto, gastado, resto: p.monto - gastado };
}

/** Lo que resta de un presupuesto en un mes, como un gasto planificado de fin de mes. */
function restoPresupuesto(p: Presupuesto, mes: Mes, resto: Centavos): Movimiento {
  return {
    id: `${p.id}@${mes}`,
    fecha: fechaEnMes(mes, 28),
    descripcion: p.nombre,
    tipo: "egreso",
    monto: resto,
    cuentaId: p.cuentaId,
    categoria: categoriaResto(p),
    estado: "planificado",
    origen: { tipo: "manual" },
  };
}
