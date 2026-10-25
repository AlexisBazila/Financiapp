// Conversión entre las filas de Supabase (snake_case, ver supabase/migrations) y el modelo del motor.

import type {
  CicloTarjeta,
  Cuenta,
  Escenario,
  Movimiento,
  Origen,
  PlanCuotas,
  Prestamo,
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
  estado: Movimiento["estado"];
  origen: Origen;
  mes_resumen: string | null;
}

export interface FilaPlanCuotas {
  id: string;
  descripcion: string;
  categoria: string;
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
  cuenta_id: string;
  capital: number;
  primera_cuota: string;
  cantidad: number;
  tasa_anual: number | string;
  sistema: Prestamo["sistema"];
  cuotas_manuales: number[] | null;
}

export interface FilaRecurrente {
  id: string;
  descripcion: string;
  tipo: Recurrente["tipo"];
  categoria: string;
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

export function aCuenta(fila: FilaCuenta, ciclos: FilaCiclo[]): Cuenta {
  const cuenta: Cuenta = {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    disponibilidad: fila.disponibilidad,
    saldoInicial: Number(fila.saldo_inicial),
  };
  if (fila.tipo === "tarjeta" && fila.dia_cierre && fila.dia_vencimiento && fila.cuenta_pago_id) {
    cuenta.tarjeta = {
      diaCierre: fila.dia_cierre,
      diaVencimiento: fila.dia_vencimiento,
      cuentaPagoId: fila.cuenta_pago_id,
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
    estado: fila.estado,
    origen: fila.origen,
    mesResumen: fila.mes_resumen ?? undefined,
  };
}

export function aPlanCuotas(fila: FilaPlanCuotas): PlanCuotas {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
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
    cuentaId: fila.cuenta_id,
    capital: Number(fila.capital),
    primeraCuota: fila.primera_cuota,
    cantidad: fila.cantidad,
    tasaAnual: Number(fila.tasa_anual),
    sistema: fila.sistema,
    cuotasManuales: fila.cuotas_manuales?.map(Number),
  };
}

export function aRecurrente(fila: FilaRecurrente): Recurrente {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    tipo: fila.tipo,
    categoria: fila.categoria,
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
