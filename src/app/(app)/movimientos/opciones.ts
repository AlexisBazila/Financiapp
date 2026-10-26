import type { DatosHogar } from "@/lib/datos/cargar";
import { mesesEntre } from "@/lib/finanzas/fechas";
import { calcularPrevision } from "@/lib/finanzas/prevision";
import type { Mes, Movimiento } from "@/lib/finanzas/tipos";
import type { Opciones } from "./formularios";

/**
 * Opciones de los formularios de movimientos y los pagos automáticos de tarjeta que prevé la previsión
 * en `mes`, como movimientos planificados que se pueden confirmar o editar.
 */
export function movimientosDelMes(
  { hogar, datos, cuentasActivas, categorias, contrapartes }: DatosHogar,
  mes: Mes,
  mesActual: Mes,
): { opciones: Opciones; pagosAutomaticos: Movimiento[] } {
  const prevision =
    mes >= hogar.mesInicio
      ? calcularPrevision(datos, { desde: hogar.mesInicio, meses: mesesEntre(hogar.mesInicio, mes) + 1, mesActual })
      : [];
  const delMes = prevision.find((m) => m.mes === mes);
  const nombres = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));

  return {
    opciones: {
      cuentas: datos.cuentas
        .filter((c) => cuentasActivas.includes(c.id))
        .map((c) => ({ id: c.id, nombre: c.nombre, tarjeta: Boolean(c.tarjeta) })),
      categorias: categorias.filter((c) => !c.archivada),
      contrapartes,
      aPagar: delMes?.vencidoTarjetas,
    },
    pagosAutomaticos: (delMes?.pagosTarjeta ?? []).map((p) => ({
      id: `pago-automatico:${p.tarjetaId}@${mes}`,
      fecha: p.fecha,
      descripcion: `Pago del resumen ${nombres.get(p.tarjetaId) ?? ""}`.trim(),
      tipo: "transferencia",
      monto: p.monto,
      cuentaId: p.cuentaId,
      cuentaDestinoId: p.tarjetaId,
      estado: "planificado",
      origen: { tipo: "manual" },
    })),
  };
}
