import type { SupabaseClient } from "@supabase/supabase-js";

/** Monedas que se actualizan solas todos los días con la cotización del BCRA. */
export const MONEDAS_BCRA = ["USD", "EUR", "BRL"] as const;

/** Fuente con la que se guardan; las cotizaciones con estas fuentes se actualizan solas. */
export const FUENTE_BCRA = "BCRA";
const FUENTES_AUTOMATICAS = new Set([FUENTE_BCRA, "dólar oficial", "oficial"]);

/** El BCRA publica las cotizaciones del día a la tarde: se buscan las nuevas a partir de las 17 hs. */
const HORA_ACTUALIZACION = 17;

/** El último momento en que dieron las 17 hs en Argentina (UTC−3, sin horario de verano). */
export function ultimaActualizacion(ahora: Date): Date {
  const argentina = new Date(ahora.getTime() - 3 * 3600_000);
  const hoy17 = Date.UTC(
    argentina.getUTCFullYear(),
    argentina.getUTCMonth(),
    argentina.getUTCDate(),
    HORA_ACTUALIZACION + 3,
  );
  return new Date(hoy17 <= ahora.getTime() ? hoy17 : hoy17 - 24 * 3600_000);
}

/** Qué monedas hay que traer: las que no están cargadas y las automáticas que quedaron viejas. */
export function monedasAActualizar(
  cotizaciones: Record<string, { fuente: string; actualizada: string }>,
  ahora: Date,
): string[] {
  const limite = ultimaActualizacion(ahora).getTime();
  return MONEDAS_BCRA.filter((m) => {
    const c = cotizaciones[m];
    return !c || (FUENTES_AUTOMATICAS.has(c.fuente) && new Date(c.actualizada).getTime() < limite);
  });
}

type Valores = Partial<Record<string, number>>;

/**
 * Cotizaciones de la API de estadísticas cambiarias del BCRA: pesos por unidad de cada moneda, del
 * último día publicado.
 */
async function delBCRA(): Promise<Valores> {
  const respuesta = await fetch("https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones", {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!respuesta.ok) throw new Error(`BCRA respondió ${respuesta.status}`);
  const cuerpo = (await respuesta.json()) as {
    results?: { detalle?: { codigoMoneda?: string; tipoCotizacion?: number }[] };
  };
  const valores: Valores = {};
  for (const d of cuerpo.results?.detalle ?? []) {
    const valor = Number(d.tipoCotizacion);
    if (d.codigoMoneda && Number.isFinite(valor) && valor > 0) valores[d.codigoMoneda] = valor;
  }
  return valores;
}

/** Plan B si la API del BCRA no responde: la cotización oficial de dolarapi.com. */
async function deDolarapi(moneda: string): Promise<number | undefined> {
  const respuesta = await fetch(`https://dolarapi.com/v1/cotizaciones/${moneda.toLowerCase()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!respuesta.ok) return undefined;
  const { venta } = (await respuesta.json()) as { venta?: unknown };
  const valor = Number(venta);
  return Number.isFinite(valor) && valor > 0 ? valor : undefined;
}

/** Trae y guarda en el hogar de la sesión las cotizaciones de `monedas`. Devuelve las que guardó. */
export async function actualizarCotizaciones(supabase: SupabaseClient, monedas: readonly string[]): Promise<string[]> {
  if (monedas.length === 0) return [];
  let valores: Valores = {};
  try {
    valores = await delBCRA();
  } catch {
    // Sigue con el plan B.
  }
  const filas = [];
  for (const moneda of monedas) {
    let valor = valores[moneda];
    let fuente = FUENTE_BCRA;
    if (valor === undefined) {
      valor = await deDolarapi(moneda).catch(() => undefined);
      fuente = "oficial";
    }
    if (valor !== undefined) filas.push({ moneda, valor, fuente, actualizada: new Date().toISOString() });
  }
  if (filas.length === 0) return [];
  const { error } = await supabase.from("cotizaciones").upsert(filas, { onConflict: "hogar_id,moneda" });
  return error ? [] : filas.map((f) => f.moneda);
}
