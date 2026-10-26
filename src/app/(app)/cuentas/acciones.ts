"use server";

import { revalidatePath } from "next/cache";
import { entero, pesosACentavos, texto } from "@/lib/datos/formularios";
import { esMoneda } from "@/lib/datos/monedas";
import { requerirUsuario } from "@/lib/supabase/servidor";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

const TIPOS = ["efectivo", "banco", "billetera", "inversion", "tarjeta"];
const DISPONIBILIDADES = ["inmediata", "48h", "reserva"];

/** Crea una cuenta (`id` null) o cambia una existente. */
export async function guardarCuenta(id: string | null, _: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const nombre = texto(form, "nombre");
  const tipo = texto(form, "tipo");
  const saldo = pesosACentavos(texto(form, "saldo") || "0");
  if (!nombre) return { error: "Poné un nombre." };
  if (!TIPOS.includes(tipo)) return { error: "Elegí el tipo de cuenta." };
  if (saldo === null) return { error: "El saldo no es un número válido." };

  const esTarjeta = tipo === "tarjeta";
  const disponibilidad = esTarjeta ? "inmediata" : texto(form, "disponibilidad");
  if (!DISPONIBILIDADES.includes(disponibilidad)) return { error: "Elegí la disponibilidad." };

  const titular = texto(form, "titular").slice(0, 40) || null;
  // Las tarjetas van en pesos: las compras en dólares se ven en pesos en el resumen.
  const moneda = esTarjeta ? "ARS" : texto(form, "moneda") || "ARS";
  if (!esMoneda(moneda)) return { error: "Elegí la moneda." };
  const fila: Record<string, unknown> = {
    nombre,
    tipo,
    disponibilidad,
    saldo_inicial: saldo,
    titular,
    moneda,
    dia_cierre: null,
    dia_vencimiento: null,
    cuenta_pago_id: null,
  };
  if (esTarjeta) {
    const diaCierre = entero(form, "dia_cierre");
    const diaVencimiento = entero(form, "dia_vencimiento");
    const cuentaPago = texto(form, "cuenta_pago_id");
    if (!diaCierre || diaCierre > 31 || !diaVencimiento || diaVencimiento > 31) {
      return { error: "Los días de cierre y vencimiento van del 1 al 31." };
    }
    if (!cuentaPago || cuentaPago === id) return { error: "Elegí desde qué cuenta pagás la tarjeta." };
    Object.assign(fila, {
      dia_cierre: diaCierre,
      dia_vencimiento: diaVencimiento,
      cuenta_pago_id: cuentaPago,
      pago_automatico: form.get("pago_automatico") === "on",
    });
  }

  if (id && esTarjeta) {
    const { count } = await supabase
      .from("cuentas")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_pago_id", id)
      .eq("archivada", false);
    if (count) return { error: "Con esta cuenta se paga una tarjeta; no puede ser una tarjeta." };
  }

  const { error } = id
    ? await supabase.from("cuentas").update(fila).eq("id", id)
    : await supabase.from("cuentas").insert(fila);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function archivarCuenta(id: string) {
  const { supabase } = await requerirUsuario();
  const { error } = await supabase.from("cuentas").update({ archivada: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function guardarCiclo(cuentaId: string, _: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const cierre = texto(form, "cierre");
  const vencimiento = texto(form, "vencimiento");
  if (!cierre || !vencimiento) return { error: "Completá cierre y vencimiento." };
  if (vencimiento <= cierre) return { error: "El vencimiento tiene que ser después del cierre." };

  const { error } = await supabase
    .from("ciclos_tarjeta")
    .upsert({ cuenta_id: cuentaId, mes: cierre.slice(0, 7), cierre, vencimiento }, { onConflict: "cuenta_id,mes" });
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cambiarMesInicio(hogarId: string, _: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const mes = texto(form, "mes_inicio");
  if (!/^\d{4}-\d{2}$/.test(mes)) return { error: "Elegí un mes." };
  const { error } = await supabase.from("hogares").update({ mes_inicio: mes }).eq("id", hogarId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Guarda a mano cuántos pesos vale una unidad de `moneda`. */
export async function guardarCotizacion(moneda: string, _: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const valor = pesosACentavos(texto(form, "valor"));
  if (!valor || valor <= 0) return { error: "El tipo de cambio tiene que ser un número mayor a cero." };
  return guardarValor(supabase, moneda, valor / 100, "manual");
}

const CASAS: Record<string, string> = { oficial: "oficial", bolsa: "MEP", blue: "blue" };

/**
 * Trae la cotización de compra de dolarapi.com (oficial del BCRA, MEP o blue). Es lo que se recibe al
 * vender, que es lo que valen los dólares que tenés.
 */
export async function traerCotizacion(moneda: string, casa: string): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  if (!CASAS[casa]) return { error: "Elegí de dónde traerla." };
  const url =
    moneda === "USD"
      ? `https://dolarapi.com/v1/dolares/${casa}`
      : `https://dolarapi.com/v1/cotizaciones/${moneda.toLowerCase()}`;
  try {
    const respuesta = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!respuesta.ok) return { error: `La cotización no respondió (${respuesta.status}). Cargala a mano.` };
    const datos: unknown = await respuesta.json();
    const compra = typeof datos === "object" && datos !== null ? Number((datos as { compra?: unknown }).compra) : NaN;
    if (!Number.isFinite(compra) || compra <= 0) return { error: "La cotización vino vacía. Cargala a mano." };
    return guardarValor(supabase, moneda, compra, moneda === "USD" ? `dólar ${CASAS[casa]}` : "oficial");
  } catch {
    return { error: "No se pudo traer la cotización. Cargala a mano." };
  }
}

async function guardarValor(
  supabase: Awaited<ReturnType<typeof requerirUsuario>>["supabase"],
  moneda: string,
  valor: number,
  fuente: string,
): Promise<Resultado> {
  if (!esMoneda(moneda) || moneda === "ARS") return { error: "Moneda no válida." };
  const { error } = await supabase
    .from("cotizaciones")
    .upsert({ moneda, valor, fuente, actualizada: new Date().toISOString() }, { onConflict: "hogar_id,moneda" });
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}
