import type { Fecha, Mes } from "./tipos";

export function mesDe(fecha: Fecha): Mes {
  return fecha.slice(0, 7);
}

export function sumarMeses(mes: Mes, n: number): Mes {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  const anio = Math.floor(total / 12);
  const nuevoMes = (total % 12) + 1;
  return `${anio}-${String(nuevoMes).padStart(2, "0")}`;
}

export function diasDelMes(mes: Mes): number {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Fecha del día indicado dentro del mes; si el mes es más corto, el último día. */
export function fechaEnMes(mes: Mes, dia: number): Fecha {
  const d = Math.min(dia, diasDelMes(mes));
  return `${mes}-${String(d).padStart(2, "0")}`;
}

export function diaDe(fecha: Fecha): number {
  return Number(fecha.slice(8, 10));
}

/** Lista de `cantidad` meses empezando en `desde`. */
export function rangoMeses(desde: Mes, cantidad: number): Mes[] {
  return Array.from({ length: cantidad }, (_, i) => sumarMeses(desde, i));
}

const NOMBRES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function nombreMes(mes: Mes): string {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMBRES[m - 1]} ${String(a).slice(2)}`;
}

/** Fecha de hoy en Argentina. */
export function hoy(): Fecha {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/** Cantidad de meses de `desde` a `hasta` (0 si son el mismo). */
export function mesesEntre(desde: Mes, hasta: Mes): number {
  const [a1, m1] = desde.split("-").map(Number);
  const [a2, m2] = hasta.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}
