import type { Centavos } from "@/lib/finanzas/tipos";

/**
 * Convierte lo que escribe el usuario a centavos. Acepta formato argentino ("1.234.567,89"),
 * con punto decimal ("1234.5") y con signo "$". El punto seguido de exactamente tres dígitos
 * se toma como separador de miles ("100.000" son cien mil). Devuelve null si no es un número.
 */
export function pesosACentavos(texto: string): Centavos | null {
  let limpio = texto.replace(/[$\s]/g, "");
  if (!limpio) return null;
  if (limpio.includes(",")) {
    limpio = limpio.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{3}(\.|$)/.test(limpio)) {
    limpio = limpio.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
}

/** Texto de un campo de formulario, recortado; "" si no vino. */
export function texto(form: FormData, campo: string): string {
  const valor = form.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/** Entero de un campo de formulario, o null. */
export function entero(form: FormData, campo: string): number | null {
  const valor = texto(form, campo);
  return /^\d+$/.test(valor) ? Number(valor) : null;
}
