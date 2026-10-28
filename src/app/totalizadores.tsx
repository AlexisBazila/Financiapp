import type { MesPrevision } from "@/lib/finanzas/prevision";

/** Lo que tenés menos todo lo que debés: tarjetas y cuotas que faltan. */
export const patrimonioDe = (m: MesPrevision) =>
  m.disponible + m.disponible48h + m.reserva - m.deudaTarjetas - m.cuotasFuturas;

/** Qué muestra cada totalizador, para la ayuda al pasar el mouse. */
export const TOTALIZADORES = {
  patrimonio: {
    titulo: "Patrimonio",
    nota: "lo que tenés − lo que debés",
    ayuda:
      "Todo lo que tenés (disponible, no inmediato y reserva) menos todo lo que debés: tarjetas y las cuotas que faltan de compras, préstamos y deudas.",
  },
  disponible: {
    titulo: "Disponible",
    nota: "para gastar ya",
    ayuda: "Plata en cuentas, billeteras y efectivo que podés usar en el momento.",
  },
  noInmediato: {
    titulo: "No inmediato",
    nota: "FCI, dólares, plazo fijo",
    ayuda:
      "Dinero invertido o guardado en cuentas de las que sacarlo demora más de 24 h (FCI, plazo fijo) o hay que cambiarlo de moneda.",
  },
  reserva: {
    titulo: "Reserva",
    nota: "ahorro apartado",
    ayuda: "Ahorro que separaste a propósito y no contás para los gastos del mes.",
  },
  deudaTarjetas: {
    titulo: "Deuda tarjetas",
    nota: "resúmenes por pagar",
    ayuda: "Lo que debés de las tarjetas de crédito: los resúmenes cerrados sin pagar y lo que va del período en curso.",
  },
  deudaCuotas: {
    titulo: "Deuda en cuotas",
    nota: "",
    ayuda:
      "Lo que falta pagar de compras en cuotas, préstamos y deudas, contando desde el mes que viene (incluye cuotas de tarjeta que todavía no llegaron al resumen).",
  },
};

/** Un "i" que muestra la explicación al pasar el mouse (o al tocarlo, con el lector de pantalla). */
export function Ayuda({ texto }: { texto: string }) {
  return (
    <span
      title={texto}
      aria-label={texto}
      role="img"
      className="inline-flex size-4 cursor-help items-center justify-center rounded-full border border-current text-[10px] leading-none opacity-60"
    >
      i
    </span>
  );
}
