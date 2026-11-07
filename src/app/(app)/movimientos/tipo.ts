import type { Movimiento } from "@/lib/finanzas/tipos";
import type { Opcion } from "./formularios";

/**
 * Cómo se muestra una transferencia en el formulario: pago de tarjeta si va a una tarjeta, ingreso a ahorro
 * si va de una cuenta para gastar a una de ahorro, retiro si va al revés.
 */
export function tipoDe(m: Movimiento, cuentas: Opcion[]): string {
  if (m.tipo !== "transferencia") return m.tipo;
  const origen = cuentas.find((c) => c.id === m.cuentaId);
  const destino = cuentas.find((c) => c.id === m.cuentaDestinoId);
  if (destino?.tarjeta) return "pago_tarjeta";
  const gastar = (c?: Opcion) => Boolean(c && !c.tarjeta && !c.ahorro);
  if (gastar(origen) && destino?.ahorro) return "ingreso_ahorro";
  if (origen?.ahorro && gastar(destino)) return "retiro_ahorro";
  return "transferencia";
}
