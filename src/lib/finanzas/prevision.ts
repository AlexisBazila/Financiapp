import { generarCuotasDeuda, generarCuotasPlan, generarCuotasPrestamo } from "./cuotas";
import { diasDelMes, fechaEnMes, mesDe, mesesEntre, rangoMeses, sumarMeses } from "./fechas";
import { instanciarRecurrente } from "./recurrentes";
import { cicloDe, resumenDeFecha } from "./tarjeta";
import type { Centavos, Cuenta, Datos, Estado, Fecha, Mes, Movimiento, ObjetivoAhorro, Presupuesto } from "./tipos";

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
  /** Gastado en sus categorías: por fecha, o por el mes del resumen si es con tarjeta. */
  gastado: Centavos;
  /** monto - gastado; negativo si se pasó. */
  resto: Centavos;
}

export interface MesObjetivo {
  id: string;
  nombre: string;
  icono: string;
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  /** Lo que se planea pasar en el mes. */
  objetivo: Centavos;
  /** Transferencias confirmadas a la cuenta de destino en el mes. */
  hecho: Centavos;
  /** Lo que falta y la previsión pasa a fin de mes (0 en los meses pasados o si ya se cargó todo). */
  previsto: Centavos;
  /** Fecha en que la previsión pasa lo que falta. */
  fecha: Fecha;
}

export interface PagoTarjeta {
  tarjetaId: string;
  /** Cuenta de la que sale. */
  cuentaId: string;
  monto: Centavos;
  /** Fecha del vencimiento del resumen que se paga. */
  fecha: string;
}

/** Un movimiento (o una compra en cuotas, un préstamo o un recurrente) dentro de una categoría del mes. */
export interface DetalleItem {
  /** Igual en todos los meses para la misma compra en cuotas, préstamo o recurrente. */
  clave: string;
  nombre: string;
  categoriaId?: string;
  monto: Centavos;
  certeza: Certeza;
  /** "3/18" si es una cuota. */
  cuota?: string;
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
  /** Qué compone cada monto por categoría, con la misma clave que `celdas`. */
  detalle: Record<string, DetalleItem[]>;
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
  /** Compras con tarjeta de los resúmenes que cierran este mes: la deuda que se paga el mes siguiente. */
  consumoTarjetas: Centavos;
  /** Resúmenes que vencen este mes (lo consumido el mes anterior), sin lo que quedó sin pagar antes. */
  venceTarjetas: Centavos;
  /** Lo que vence en el mes (más lo que quedó sin pagar antes), por tarjeta, antes de pagar. */
  vencidoTarjetas: Record<string, Centavos>;
  /** Pagos automáticos de resumen que prevé la previsión en el mes. */
  pagosTarjeta: PagoTarjeta[];
  /** Lo vencido que quedó sin pagar al cierre del mes, sumando todas las tarjetas. */
  impagoTarjetas: Centavos;
  /** Ocurrencias de recurrentes que esperan confirmación en este mes. */
  pendientes: number;
  /** Cuotas de compras y préstamos que se pagan este mes. */
  cuotasDelMes: Centavos;
  /** Lo que queda por pagar en cuotas después de este mes. */
  deudaCuotas: Centavos;
  presupuestos: MesPresupuesto[];
  /** Objetivos de ahorro e inversión del mes. */
  objetivos: MesObjetivo[];
  /**
   * Lo que se ahorra o invierte en el mes con los objetivos: lo planeado (o lo cargado, si es más), o
   * solo lo transferido si no se cuenta lo planificado.
   */
  ahorroDelMes: Centavos;
  /** El resto del mes anterior: lo que sobró sin asignar (positivo) o lo que faltó (negativo). */
  sobranteAnterior: Centavos;
  /** sobrante anterior + ingresos - egresos - ahorro del mes. Pasa al mes siguiente. */
  resto: Centavos;
}

export interface OpcionesPrevision {
  desde: Mes;
  meses: number;
  /**
   * Qué movimientos se cuentan. Por defecto todos. Sin "planificado", tampoco se prevé lo que resta de los
   * presupuestos, lo que falta de los objetivos ni el pago automático de las tarjetas: queda solo lo real.
   */
  estados?: Estado[];
  /**
   * Mes actual. Lo que resta de un presupuesto se prevé como gasto solo desde este mes: en los meses
   * pasados, lo que no se gastó no se va a gastar. Sin `mesActual`, se prevé en todos.
   */
  mesActual?: Mes;
  /**
   * Fecha de hoy. Si un presupuesto sale de una tarjeta y el resumen de su mes ya cerró, lo que resta
   * tampoco se prevé: el período ya pasó.
   */
  hoy?: Fecha;
}

/** Clave de una cuota generada, para reconocerla cuando ya se cargó (confirmada o editada). */
function claveCuota(origen: Movimiento["origen"]): string | undefined {
  if (origen.tipo === "cuotas") return `cuotas:${origen.planId}:${origen.numero}`;
  if (origen.tipo === "prestamo") return `prestamo:${origen.prestamoId}:${origen.numero}`;
  if (origen.tipo === "deuda") return `deuda:${origen.deudaId}:${origen.numero}`;
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
    ...(datos.deudas ?? []).flatMap((d) => generarCuotasDeuda(d, cuenta(d.cuentaId))).filter(sinCargar),
    ...datos.recurrentes.flatMap((r) => instanciarRecurrente(r, datos.movimientos, desde, hasta)),
  ];
}

/** Mes en que sale la plata de un movimiento: el del vencimiento del resumen si es con tarjeta. */
export function mesDePago(mov: Movimiento, cuentas: Map<string, Cuenta>): Mes {
  const cuenta = cuentas.get(mov.cuentaId);
  if (!cuenta?.tarjeta || mov.tipo === "transferencia") return mesDe(mov.fecha);
  return mesDe(cicloDe(cuenta, mov.mesResumen ?? resumenDeFecha(cuenta, mov.fecha)).vencimiento);
}

/**
 * Mes en que se cuenta el gasto de un movimiento: el de su fecha o, si es con tarjeta, el del cierre de
 * su resumen (el período del 23/10 al 19/11 es noviembre).
 */
export function mesDeGasto(mov: Movimiento, cuentas: Map<string, Cuenta>): Mes {
  const cuenta = cuentas.get(mov.cuentaId);
  if (!cuenta?.tarjeta || mov.tipo === "transferencia") return mesDe(mov.fecha);
  return mesDe(cicloDe(cuenta, mov.mesResumen ?? resumenDeFecha(cuenta, mov.fecha)).cierre);
}

/** Cuentas en otra moneda: cuentan como no inmediatas, porque hay que cambiarlas para gastarlas. */
export function disponibilidadDe(c: Cuenta): Cuenta["disponibilidad"] {
  return c.moneda && c.moneda !== "ARS" ? "48h" : c.disponibilidad;
}

/** Un efecto de un movimiento sobre una cuenta en un mes. */
interface Efecto {
  mes: Mes;
  cuentaId: string;
  /** Lo que suma (o resta) al saldo de la cuenta; en tarjetas, a la deuda. */
  delta: Centavos;
  /** En tarjetas: lo que vence este mes y hay que pagar (negativo si es una devolución). */
  vence?: Centavos;
  /** En tarjetas: lo que se suma al resumen que cierra este mes (negativo si es una devolución). */
  consumo?: Centavos;
  /** Transferencia que entra a una tarjeta: un pago del resumen. */
  pago?: Centavos;
  /** Si el efecto es plata que entra o sale del hogar en ese mes, su categoría. Monto en pesos. */
  flujo?: {
    tipo: "ingreso" | "egreso";
    categoria: string;
    monto: Centavos;
    certeza: Certeza;
    cuota: boolean;
    item?: Omit<DetalleItem, "monto" | "certeza">;
  };
}

function certezaDe(mov: Movimiento): Certeza {
  if (mov.estado !== "real") return "planificado";
  return mov.conciliado ? "conciliado" : "real";
}

const ORDEN_CERTEZA: Record<Certeza, number> = { planificado: 0, real: 1, conciliado: 2 };

/** Pesos por unidad de la moneda de la cuenta. */
const cambioDe = (c: Cuenta) => c.cambio ?? 1;

/** Cómo aparece un movimiento en el detalle de su categoría. */
function itemDe(mov: Movimiento): Omit<DetalleItem, "monto" | "certeza"> {
  const o = mov.origen;
  const base = {
    nombre: mov.descripcion.replace(/\s*\(\d+\/\d+\)$/, "") || mov.contraparte || mov.categoria || "Sin descripción",
    categoriaId: mov.categoriaId,
  };
  if (o.tipo === "cuotas") return { ...base, clave: `cuotas:${o.planId}`, cuota: `${o.numero}/${o.total}` };
  if (o.tipo === "prestamo") {
    // El número 0 es la plata del préstamo que entra.
    if (o.numero === 0) return { ...base, nombre: mov.descripcion || base.nombre, clave: `prestamo:${o.prestamoId}:ingreso` };
    return { ...base, clave: `prestamo:${o.prestamoId}`, cuota: `${o.numero}/${o.total}` };
  }
  if (o.tipo === "deuda") return { ...base, clave: `deuda:${o.deudaId}`, cuota: `${o.numero}/${o.total}` };
  if (o.tipo === "recurrente") return { ...base, nombre: mov.descripcion || base.nombre, clave: `recurrente:${o.recurrenteId}` };
  return { ...base, nombre: mov.descripcion || base.nombre, clave: mov.id };
}

/** "3/12" y "5/12" → "3, 5/12". */
function juntarCuotas(a: string, b: string): string {
  const [numerosA, total] = a.split("/");
  const numeros = [...numerosA.split(", "), b.split("/")[0]].sort((x, y) => Number(x) - Number(y));
  return `${numeros.join(", ")}/${total}`;
}

/** Si el movimiento es de antes del día del saldo inicial de la cuenta, y entonces ya está incluido en él. */
function yaEnElSaldo(mov: Movimiento, cuenta: Cuenta): boolean {
  return !cuenta.tarjeta && cuenta.saldoFecha !== undefined && mov.fecha <= cuenta.saldoFecha;
}

function efectosDe(mov: Movimiento, cuentas: Map<string, Cuenta>, desde: Mes): Efecto[] {
  const cuenta = cuentas.get(mov.cuentaId);
  if (!cuenta) throw new Error(`No existe la cuenta ${mov.cuentaId}`);
  const categoria = mov.categoria ?? "Sin categoría";
  const certeza = certezaDe(mov);
  const cuota = claveCuota(mov.origen) !== undefined && mov.tipo === "egreso";
  const enPesos = Math.round(mov.monto * cambioDe(cuenta));
  const item = itemDe(mov);

  if (mov.tipo === "transferencia") {
    const destino = cuentas.get(mov.cuentaDestinoId ?? "");
    if (!destino) throw new Error(`La transferencia ${mov.id} no tiene cuenta destino válida`);
    const mes = mesDe(mov.fecha);
    // En una tarjeta el saldo es deuda: recibir una transferencia la baja y enviarla la sube.
    const signoOrigen = cuenta.tarjeta ? 1 : -1;
    const signoDestino = destino.tarjeta ? -1 : 1;
    return [
      { mes, cuentaId: cuenta.id, delta: yaEnElSaldo(mov, cuenta) ? 0 : signoOrigen * mov.monto },
      {
        mes,
        cuentaId: destino.id,
        // Entre monedas distintas, lo que llega se convierte con los tipos de cambio cargados.
        delta: yaEnElSaldo(mov, destino)
          ? 0
          : signoDestino * Math.round((mov.monto * cambioDe(cuenta)) / cambioDe(destino)),
        ...(destino.tarjeta && !cuenta.tarjeta ? { pago: mov.monto } : {}),
      },
    ];
  }

  const signo = mov.tipo === "ingreso" ? 1 : -1;
  if (!cuenta.tarjeta) {
    return [
      {
        mes: mesDe(mov.fecha),
        cuentaId: cuenta.id,
        delta: yaEnElSaldo(mov, cuenta) ? 0 : signo * mov.monto,
        flujo: { tipo: mov.tipo, categoria, monto: enPesos, certeza, cuota, item },
      },
    ];
  }

  // Tarjeta: el gasto se cuenta el mes del cierre del resumen, que es cuando sube la deuda. La deuda vence
  // el mes siguiente y la plata sale con el pago del resumen (ver calcularPrevision).
  const ciclo = cicloDe(cuenta, mov.mesResumen ?? resumenDeFecha(cuenta, mov.fecha));
  // Un resumen que cerró antes de `desde` ya está incluido en el saldo inicial de la tarjeta.
  if (mesDe(ciclo.cierre) < desde) return [];
  return [
    {
      mes: mesDe(ciclo.cierre),
      cuentaId: cuenta.id,
      delta: -signo * mov.monto,
      consumo: -signo * mov.monto,
      flujo: { tipo: mov.tipo, categoria, monto: enPesos, certeza, cuota, item },
    },
    { mes: mesDe(ciclo.vencimiento), cuentaId: cuenta.id, delta: 0, vence: -signo * mov.monto },
  ];
}

/**
 * Previsión mes a mes: ingresos y egresos de cada mes (las compras con tarjeta cuentan el mes del cierre
 * de su resumen) y cómo quedan las cuentas al final de cada mes (la deuda de la tarjeta se paga el mes
 * siguiente).
 *
 * Los saldos iniciales de las cuentas son los del comienzo de `desde`; los movimientos anteriores
 * se ignoran. El saldo inicial de una tarjeta se toma como el resumen ya cerrado que se paga en `desde`:
 * es gasto de antes, así que no suma egresos, y las compras de resúmenes cerrados antes de `desde` no se
 * vuelven a contar.
 */
export function calcularPrevision(datos: Datos, opciones: OpcionesPrevision): MesPrevision[] {
  const meses = rangoMeses(opciones.desde, opciones.meses);
  const hasta = meses[meses.length - 1];
  const estados = new Set(opciones.estados ?? ["real", "planificado", "pendiente"]);
  const conPlan = estados.has("planificado");
  const cuentas = new Map(datos.cuentas.map((c) => [c.id, c]));

  const todos = expandir(datos, opciones.desde, hasta);
  const movimientos = todos.filter((m) => estados.has(m.estado));
  const efectos: Efecto[] = movimientos.flatMap((m) => efectosDe(m, cuentas, opciones.desde));

  for (const c of datos.cuentas) {
    if (c.tarjeta && c.saldoInicial > 0) {
      efectos.push({ mes: opciones.desde, cuentaId: c.id, delta: 0, vence: c.saldoInicial });
    }
  }

  const presupuestosPorMes = new Map<Mes, MesPresupuesto[]>();
  for (const mes of meses) {
    const delMes: MesPresupuesto[] = [];
    for (const p of datos.presupuestos ?? []) {
      if (mes < p.desde || (p.hasta && mes > p.hasta)) continue;
      const resumen = resumenPresupuesto(p, mes, movimientos, cuentas);
      delMes.push(resumen);
      const tarjeta = cuentas.get(p.cuentaId)?.tarjeta ? cuentas.get(p.cuentaId) : undefined;
      const pasado =
        (opciones.mesActual && mes < opciones.mesActual) ||
        (opciones.hoy && tarjeta && cicloDe(tarjeta, mes).cierre < opciones.hoy);
      if (conPlan && resumen.resto > 0 && !pasado) {
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
  const tarjetas = datos.cuentas.filter((c) => c.tarjeta);
  /** Lo vencido y todavía no pagado de cada tarjeta. */
  const vencido: Record<string, Centavos> = Object.fromEntries(tarjetas.map((c) => [c.id, 0]));
  let restoAnterior = 0;

  return meses.map((mes) => {
    const ingresosPorCategoria: Record<string, Centavos> = {};
    const egresosPorCategoria: Record<string, Centavos> = {};
    const celdas: Record<string, Celda> = {};
    const items = new Map<string, Map<string, DetalleItem>>();
    let ingresos = 0;
    let egresos = 0;

    const pagadoAMano = new Set<string>();
    let consumoTarjetas = 0;
    let venceTarjetas = 0;
    for (const e of porMes.get(mes) ?? []) {
      saldos[e.cuentaId] += e.delta;
      if (e.consumo) consumoTarjetas += e.consumo;
      if (e.vence) {
        vencido[e.cuentaId] += e.vence;
        venceTarjetas += e.vence;
      }
      if (e.pago) {
        vencido[e.cuentaId] -= e.pago;
        pagadoAMano.add(e.cuentaId);
      }
      if (!e.flujo) continue;
      const clave = `${e.flujo.tipo}:${e.flujo.categoria}`;
      const previa = celdas[clave];
      celdas[clave] = {
        certeza:
          previa && ORDEN_CERTEZA[previa.certeza] < ORDEN_CERTEZA[e.flujo.certeza] ? previa.certeza : e.flujo.certeza,
        cuotas: Boolean(previa?.cuotas) || e.flujo.cuota,
      };
      if (e.flujo.item) {
        const delGrupo = items.get(clave) ?? new Map<string, DetalleItem>();
        items.set(clave, delGrupo);
        const previo = delGrupo.get(e.flujo.item.clave);
        delGrupo.set(e.flujo.item.clave, {
          ...e.flujo.item,
          // Varias cuotas de lo mismo en el mes: "3, 4/12".
          cuota: previo?.cuota && e.flujo.item.cuota ? juntarCuotas(previo.cuota, e.flujo.item.cuota) : e.flujo.item.cuota,
          monto: (previo?.monto ?? 0) + e.flujo.monto,
          certeza:
            previo && ORDEN_CERTEZA[previo.certeza] < ORDEN_CERTEZA[e.flujo.certeza] ? previo.certeza : e.flujo.certeza,
        });
      }
      if (e.flujo.tipo === "ingreso") {
        ingresos += e.flujo.monto;
        ingresosPorCategoria[e.flujo.categoria] = (ingresosPorCategoria[e.flujo.categoria] ?? 0) + e.flujo.monto;
      } else {
        egresos += e.flujo.monto;
        egresosPorCategoria[e.flujo.categoria] = (egresosPorCategoria[e.flujo.categoria] ?? 0) + e.flujo.monto;
      }
    }

    // Pago automático de lo vencido, hasta el saldo positivo de la cuenta de pago. Si en el mes se cargó
    // un pago a mano, ese reemplaza al automático.
    const vencidoTarjetas: Record<string, Centavos> = {};
    const pagosTarjeta: PagoTarjeta[] = [];
    let impagoTarjetas = 0;
    for (const t of tarjetas) {
      const config = t.tarjeta!;
      if (vencido[t.id] > 0) vencidoTarjetas[t.id] = vencido[t.id];
      if (conPlan && config.pagoAutomatico !== false && !pagadoAMano.has(t.id) && vencido[t.id] > 0) {
        const monto = Math.min(vencido[t.id], Math.max(0, saldos[config.cuentaPagoId]));
        if (monto > 0) {
          saldos[config.cuentaPagoId] -= monto;
          saldos[t.id] -= monto;
          vencido[t.id] -= monto;
          pagosTarjeta.push({ tarjetaId: t.id, cuentaId: config.cuentaPagoId, monto, fecha: vencimientoEn(t, mes) });
        }
      }
      // Lo pagado de más baja la deuda, pero no adelanta lo que vence después.
      if (vencido[t.id] < 0) vencido[t.id] = 0;
      impagoTarjetas += vencido[t.id];
    }

    // Objetivos de ahorro: lo que falta del mes pasa de la cuenta de origen a la de destino a fin de mes.
    const objetivos: MesObjetivo[] = [];
    let ahorroDelMes = 0;
    for (const o of datos.objetivos ?? []) {
      if (mes < o.desde || (o.hasta && mes > o.hasta)) continue;
      const origen = cuentas.get(o.cuentaOrigenId);
      const destino = cuentas.get(o.cuentaDestinoId);
      if (!origen || !destino) continue;
      const objetivo = montoObjetivo(o, mes, ingresos / cambioDe(origen));
      const aDestino = movimientos.filter(
        (m) =>
          m.tipo === "transferencia" &&
          m.cuentaDestinoId === o.cuentaDestinoId &&
          m.cuentaId !== o.cuentaDestinoId &&
          mesDe(m.fecha) === mes,
      );
      const cargado = aDestino.reduce((total, m) => total + m.monto, 0);
      const hecho = aDestino.filter((m) => m.estado === "real").reduce((total, m) => total + m.monto, 0);
      const futuro = !opciones.mesActual || mes >= opciones.mesActual;
      const previsto = conPlan && futuro ? Math.max(0, objetivo - cargado) : 0;
      if (previsto > 0) {
        saldos[origen.id] += origen.tarjeta ? previsto : -previsto;
        saldos[destino.id] += Math.round((previsto * cambioDe(origen)) / cambioDe(destino));
      }
      ahorroDelMes += conPlan ? Math.max(objetivo, cargado) : hecho;
      objetivos.push({
        id: o.id,
        nombre: o.nombre,
        icono: o.icono,
        cuentaOrigenId: o.cuentaOrigenId,
        cuentaDestinoId: o.cuentaDestinoId,
        objetivo,
        hecho,
        previsto,
        fecha: fechaEnMes(mes, diasDelMes(mes)),
      });
    }

    const sobranteAnterior = restoAnterior;
    restoAnterior = sobranteAnterior + ingresos - egresos - ahorroDelMes;

    let disponible = 0;
    let disponible48h = 0;
    let reserva = 0;
    let deudaTarjetas = 0;
    for (const c of datos.cuentas) {
      const saldo = Math.round(saldos[c.id] * cambioDe(c));
      if (c.tarjeta) deudaTarjetas += saldo;
      else if (disponibilidadDe(c) === "inmediata") disponible += saldo;
      else if (disponibilidadDe(c) === "48h") disponible48h += saldo;
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
      detalle: Object.fromEntries(
        [...items].map(([clave, delGrupo]) => [clave, [...delGrupo.values()].sort((a, b) => b.monto - a.monto)]),
      ),
      saldos: { ...saldos },
      disponible,
      disponible48h,
      reserva,
      deudaTarjetas,
      consumoTarjetas,
      venceTarjetas,
      vencidoTarjetas,
      pagosTarjeta,
      impagoTarjetas,
      pendientes: pendientesPorMes.get(mes) ?? 0,
      cuotasDelMes: cuotasPorMes.get(mes) ?? 0,
      deudaCuotas: cuotasDespuesDe(mes),
      presupuestos: presupuestosPorMes.get(mes) ?? [],
      objetivos,
      ahorroDelMes,
      sobranteAnterior,
      resto: restoAnterior,
    };
  });
}


/** Fecha de vencimiento de la tarjeta que cae en `mes` (la del resumen del mes anterior, en general). */
function vencimientoEn(tarjeta: Cuenta, mes: Mes): string {
  for (const resumen of [sumarMeses(mes, -1), mes, sumarMeses(mes, -2)]) {
    const { vencimiento } = cicloDe(tarjeta, resumen);
    if (mesDe(vencimiento) === mes) return vencimiento;
  }
  return fechaEnMes(mes, tarjeta.tarjeta!.diaVencimiento);
}

/** Lo que se planea ahorrar en un mes: el monto puesto a mano, el fijo o el porcentaje de los ingresos. */
export function montoObjetivo(o: ObjetivoAhorro, mes: Mes, ingresos: Centavos): Centavos {
  const aMano = o.montosPorMes?.[mes];
  if (aMano !== undefined) return aMano;
  if (o.porcentaje) return Math.round((ingresos * o.porcentaje) / 100);
  return o.monto ?? 0;
}

/** Etiqueta con la que lo que resta de un presupuesto aparece en los egresos de la previsión. */
export function categoriaResto(p: Pick<Presupuesto, "icono" | "nombre">): string {
  return `${p.icono ? `${p.icono} ` : ""}${p.nombre} (resto del presupuesto)`;
}

function resumenPresupuesto(
  p: Presupuesto,
  mes: Mes,
  movimientos: Movimiento[],
  cuentas: Map<string, Cuenta>,
): MesPresupuesto {
  const categorias = new Set(p.categoriaIds);
  const elegidas = p.cuentaIds && new Set(p.cuentaIds);
  const gastado = movimientos
    .filter(
      (m) =>
        m.tipo === "egreso" &&
        m.categoriaId &&
        categorias.has(m.categoriaId) &&
        (!elegidas || elegidas.has(m.cuentaId)) &&
        mesDeGasto(m, cuentas) === mes,
    )
    .reduce((total, m) => total + Math.round(m.monto * (cuentas.get(m.cuentaId)?.cambio ?? 1)), 0);
  const monto = montoPresupuesto(p, mes);
  return { id: p.id, nombre: p.nombre, monto, gastado, resto: monto - gastado };
}

/** Monto de un presupuesto en un mes, con el aumento mensual acumulado desde que empieza. */
export function montoPresupuesto(p: Pick<Presupuesto, "monto" | "aumentoMensual" | "desde">, mes: Mes): Centavos {
  if (!p.aumentoMensual || mes <= p.desde) return p.monto;
  return Math.round(p.monto * Math.pow(1 + p.aumentoMensual / 100, mesesEntre(p.desde, mes)));
}

/**
 * Lo que resta de un presupuesto en un mes, como un gasto planificado de fin de mes. Si sale de una
 * tarjeta, va al resumen que cierra ese mes.
 */
function restoPresupuesto(p: Presupuesto, mes: Mes, resto: Centavos): Movimiento {
  return {
    mesResumen: mes,
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
