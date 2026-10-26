import type { Centavos, Fecha } from "@/lib/finanzas/tipos";

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

/**
 * Cuotas pegadas, una por línea: el monto y, si está, el vencimiento ("10/03/2026"). Sirve para copiar la
 * tabla del banco: de cada línea se toma la primera fecha y el último monto ("Total a pagar"). Las líneas
 * sin monto (como los títulos) y los números de uno o dos dígitos se saltean. Devuelve null si no hay ninguna cuota.
 */
export function leerCuotas(texto: string): { monto: Centavos; vencimiento?: Fecha }[] | null {
  const cuotas: { monto: Centavos; vencimiento?: Fecha }[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const fecha = linea.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
    const resto = fecha ? linea.replace(fecha[0], " ") : linea;
    const montos = resto
      .split(/[\s;|]+/)
      // Un número suelto de uno o dos dígitos no es un monto ("Cap. Fe. 1").
      .filter((t) => /\d{3}|,\d/.test(t))
      .map((t) => pesosACentavos(t))
      .filter((m): m is Centavos => m !== null && m > 0);
    if (montos.length === 0) continue;
    const cuota: { monto: Centavos; vencimiento?: Fecha } = { monto: montos[montos.length - 1] };
    if (fecha) {
      const anio = fecha[3].length === 2 ? `20${fecha[3]}` : fecha[3];
      cuota.vencimiento = `${anio}-${fecha[2].padStart(2, "0")}-${fecha[1].padStart(2, "0")}`;
    }
    cuotas.push(cuota);
  }
  return cuotas.length > 0 ? cuotas : null;
}
