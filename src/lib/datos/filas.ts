// Conversión entre las filas de Supabase (snake_case, ver supabase/migrations) y el modelo del motor.

import type {
  CicloTarjeta,
  Cuenta,
  CuotaDeuda,
  Deuda,
  Escenario,
  Movimiento,
  Origen,
  PlanCuotas,
  Prestamo,
  ObjetivoAhorro,
  Presupuesto,
  Recurrente,
} from "@/lib/finanzas/tipos";

export interface FilaCuenta {
  id: string;
  nombre: string;
  tipo: Cuenta["tipo"];
  disponibilidad: Cuenta["disponibilidad"];
  saldo_inicial: number;
  dia_cierre: number | null;
  dia_vencimiento: number | null;
  cuenta_pago_id: string | null;
  archivada: boolean;
  titular: string | null;
  pago_automatico: boolean;
  moneda: string;
  limite: number | null;
}

export interface FilaCiclo {
  cuenta_id: string;
  mes: string;
  cierre: string;
  vencimiento: string;
}

export interface FilaMovimiento {
  id: string;
  fecha: string;
  descripcion: string;
  tipo: Movimiento["tipo"];
  monto: number;
  cuenta_id: string;
  cuenta_destino_id: string | null;
  categoria: string | null;
  categoria_id: string | null;
  contraparte: string | null;
  estado: Movimiento["estado"];
  origen: Origen;
  mes_resumen: string | null;
  conciliado: boolean;
}

export interface FilaPlanCuotas {
  id: string;
  descripcion: string;
  categoria: string;
  categoria_id: string | null;
  contraparte: string | null;
  cuenta_id: string;
  fecha_compra: string;
  monto_total: number;
  cantidad: number;
  tasa_anual: number | string;
}

export interface FilaPrestamo {
  id: string;
  descripcion: string;
  categoria: string;
  categoria_id: string | null;
  contraparte: string | null;
  cuenta_id: string;
  capital: number;
  primera_cuota: string;
  cantidad: number;
  tasa_anual: number | string;
  sistema: Prestamo["sistema"];
  cuotas_manuales: number[] | null;
  requiere_confirmacion: boolean;
  ingreso_mes: string | null;
  ingreso_monto: number | null;
}

export interface FilaRecurrente {
  id: string;
  descripcion: string;
  tipo: Recurrente["tipo"];
  categoria: string;
  categoria_id: string | null;
  contraparte: string | null;
  cuenta_id: string;
  monto_estimado: number;
  dia_del_mes: number;
  desde: string;
  hasta: string | null;
  requiere_confirmacion: boolean;
}

export interface FilaEscenario {
  id: string;
  nombre: string;
  padre_id: string | null;
  estado: Escenario["estado"];
  cambios: Escenario["cambios"];
}

export interface FilaCotizacion {
  moneda: string;
  valor: number | string;
  fuente: string;
  actualizada: string;
}

/** `cambios`: pesos por unidad de cada moneda distinta del peso. */
export function aCuenta(fila: FilaCuenta, ciclos: FilaCiclo[], cambios: Record<string, number> = {}): Cuenta {
  const cuenta: Cuenta = {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    disponibilidad: fila.disponibilidad,
    saldoInicial: Number(fila.saldo_inicial),
    titular: fila.titular ?? undefined,
    ...(fila.moneda && fila.moneda !== "ARS" ? { moneda: fila.moneda, cambio: cambios[fila.moneda] ?? 1 } : {}),
  };
  if (fila.tipo === "tarjeta" && fila.dia_cierre && fila.dia_vencimiento && fila.cuenta_pago_id) {
    cuenta.tarjeta = {
      diaCierre: fila.dia_cierre,
      diaVencimiento: fila.dia_vencimiento,
      cuentaPagoId: fila.cuenta_pago_id,
      pagoAutomatico: fila.pago_automatico,
      ...(fila.limite ? { limite: Number(fila.limite) } : {}),
      ciclos: ciclos
        .filter((c) => c.cuenta_id === fila.id)
        .map((c): CicloTarjeta => ({ mes: c.mes, cierre: c.cierre, vencimiento: c.vencimiento })),
    };
  }
  return cuenta;
}

export function aMovimiento(fila: FilaMovimiento): Movimiento {
  return {
    id: fila.id,
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    tipo: fila.tipo,
    monto: Number(fila.monto),
    cuentaId: fila.cuenta_id,
    cuentaDestinoId: fila.cuenta_destino_id ?? undefined,
    categoria: fila.categoria ?? undefined,
    categoriaId: fila.categoria_id ?? undefined,
    contraparte: fila.contraparte ?? undefined,
    estado: fila.estado,
    origen: fila.origen,
    mesResumen: fila.mes_resumen ?? undefined,
    conciliado: fila.conciliado,
  };
}

export function aPlanCuotas(fila: FilaPlanCuotas): PlanCuotas {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    categoriaId: fila.categoria_id ?? undefined,
    contraparte: fila.contraparte ?? undefined,
    cuentaId: fila.cuenta_id,
    fechaCompra: fila.fecha_compra,
    montoTotal: Number(fila.monto_total),
    cantidad: fila.cantidad,
    tasaAnual: Number(fila.tasa_anual),
  };
}

export function aPrestamo(fila: FilaPrestamo): Prestamo {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    categoriaId: fila.categoria_id ?? undefined,
    contraparte: fila.contraparte ?? undefined,
    cuentaId: fila.cuenta_id,
    capital: Number(fila.capital),
    primeraCuota: fila.primera_cuota,
    cantidad: fila.cantidad,
    tasaAnual: Number(fila.tasa_anual),
    sistema: fila.sistema,
    cuotasManuales: fila.cuotas_manuales?.map(Number),
    requiereConfirmacion: fila.requiere_confirmacion,
    ...(fila.ingreso_mes && fila.ingreso_monto
      ? { ingreso: { mes: fila.ingreso_mes, monto: Number(fila.ingreso_monto) } }
      : {}),
  };
}

export function aRecurrente(fila: FilaRecurrente): Recurrente {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    tipo: fila.tipo,
    categoria: fila.categoria,
    categoriaId: fila.categoria_id ?? undefined,
    contraparte: fila.contraparte ?? undefined,
    cuentaId: fila.cuenta_id,
    montoEstimado: Number(fila.monto_estimado),
    diaDelMes: fila.dia_del_mes,
    desde: fila.desde,
    hasta: fila.hasta ?? undefined,
    requiereConfirmacion: fila.requiere_confirmacion,
  };
}

export function aEscenario(fila: FilaEscenario): Escenario {
  return {
    id: fila.id,
    nombre: fila.nombre,
    padreId: fila.padre_id ?? undefined,
    estado: fila.estado,
    cambios: fila.cambios,
  };
}

export interface FilaPresupuesto {
  id: string;
  nombre: string;
  icono: string;
  monto: number;
  aumento_mensual: number | string;
  cuenta_id: string;
  desde: string;
  hasta: string | null;
  categoria_ids: string[];
  cuenta_ids: string[] | null;
}

export function aPresupuesto(fila: FilaPresupuesto): Presupuesto {
  return {
    id: fila.id,
    nombre: fila.nombre,
    icono: fila.icono,
    monto: Number(fila.monto),
    aumentoMensual: Number(fila.aumento_mensual ?? 0),
    cuentaId: fila.cuenta_id,
    desde: fila.desde,
    hasta: fila.hasta ?? undefined,
    categoriaIds: fila.categoria_ids,
    cuentaIds: fila.cuenta_ids ?? undefined,
  };
}

export interface FilaObjetivo {
  id: string;
  nombre: string;
  icono: string;
  cuenta_origen_id: string;
  cuenta_destino_id: string;
  monto: number | null;
  porcentaje: number | string | null;
  montos_por_mes: Record<string, number> | null;
  desde: string;
  hasta: string | null;
}

export function aObjetivo(fila: FilaObjetivo): ObjetivoAhorro {
  return {
    id: fila.id,
    nombre: fila.nombre,
    icono: fila.icono,
    cuentaOrigenId: fila.cuenta_origen_id,
    cuentaDestinoId: fila.cuenta_destino_id,
    ...(fila.monto !== null ? { monto: Number(fila.monto) } : {}),
    ...(fila.porcentaje !== null ? { porcentaje: Number(fila.porcentaje) } : {}),
    montosPorMes: Object.fromEntries(Object.entries(fila.montos_por_mes ?? {}).map(([m, v]) => [m, Number(v)])),
    desde: fila.desde,
    hasta: fila.hasta ?? undefined,
  };
}

export interface FilaDeuda {
  id: string;
  descripcion: string;
  categoria: string;
  categoria_id: string | null;
  contraparte: string | null;
  cuenta_id: string;
  dia_del_mes: number;
  cuotas: CuotaDeuda[] | null;
}

export function aDeuda(fila: FilaDeuda): Deuda {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    categoriaId: fila.categoria_id ?? undefined,
    contraparte: fila.contraparte ?? undefined,
    cuentaId: fila.cuenta_id,
    diaDelMes: fila.dia_del_mes,
    cuotas: (fila.cuotas ?? [])
      .map((c) => ({ numero: Number(c.numero), monto: Number(c.monto), mes: c.mes }))
      .sort((a, b) => a.numero - b.numero),
  };
}
