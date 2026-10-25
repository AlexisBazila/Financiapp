"use server";

import { revalidatePath } from "next/cache";
import { categoriaElegida } from "@/lib/datos/categoria-elegida";
import { entero, pesosACentavos, texto } from "@/lib/datos/formularios";
import { requerirUsuario } from "@/lib/supabase/servidor";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Tasa anual en %, "" = 0. Acepta coma decimal. */
function tasa(form: FormData): number | null {
  const valor = texto(form, "tasa_anual").replace(",", ".");
  if (!valor) return 0;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Monto total de una compra: el total, o el valor de cada cuota por la cantidad. */
function montoTotal(form: FormData, cantidad: number): number | null {
  const monto = pesosACentavos(texto(form, "monto"));
  if (!monto || monto <= 0) return null;
  return texto(form, "modo_monto") === "cuota" ? monto * cantidad : monto;
}

/** Comercio o persona, opcional. */
const contraparte = (form: FormData) => texto(form, "contraparte").slice(0, 80) || null;

async function guardar(tabla: string, fila: Record<string, unknown>): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const { error } = await supabase.from(tabla).insert(fila);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function crearPlanCuotas(_: Resultado, form: FormData): Promise<Resultado> {
  const descripcion = texto(form, "descripcion");
  const cantidad = entero(form, "cantidad");
  const fechaCompra = texto(form, "fecha_compra");
  const tasaAnual = tasa(form);
  if (!descripcion) return { error: "Poné qué compraste." };
  if (!cantidad || cantidad > 120) return { error: "La cantidad de cuotas va de 1 a 120." };
  if (!FECHA.test(fechaCompra)) return { error: "Elegí la fecha de compra." };
  if (tasaAnual === null) return { error: "La tasa tiene que ser un número." };
  const total = montoTotal(form, cantidad);
  if (!total) return { error: "El monto tiene que ser un número mayor a cero." };
  const { supabase } = await requerirUsuario();
  const categoria = await categoriaElegida(supabase, form, "egreso");
  if ("error" in categoria) return categoria;

  return guardar("planes_cuotas", {
    descripcion,
    categoria: categoria.categoria ?? "Sin categoría",
    categoria_id: categoria.categoria_id,
    contraparte: contraparte(form),
    cuenta_id: texto(form, "cuenta_id"),
    fecha_compra: fechaCompra,
    monto_total: total,
    cantidad,
    tasa_anual: tasaAnual,
  });
}

export async function crearPrestamo(_: Resultado, form: FormData): Promise<Resultado> {
  const descripcion = texto(form, "descripcion");
  const sistema = texto(form, "sistema");
  const primeraCuota = texto(form, "primera_cuota");
  const tasaAnual = tasa(form);
  if (!descripcion) return { error: "Poné un nombre al préstamo." };
  if (!["frances", "aleman", "manual"].includes(sistema)) return { error: "Elegí el sistema." };
  if (!FECHA.test(primeraCuota)) return { error: "Elegí la fecha de la primera cuota." };
  if (tasaAnual === null) return { error: "La tasa tiene que ser un número." };
  const { supabase } = await requerirUsuario();
  const categoria = await categoriaElegida(supabase, form, "egreso");
  if ("error" in categoria) return categoria;

  const fila: Record<string, unknown> = {
    descripcion,
    categoria: categoria.categoria ?? "Créditos",
    categoria_id: categoria.categoria_id,
    contraparte: contraparte(form),
    cuenta_id: texto(form, "cuenta_id"),
    primera_cuota: primeraCuota,
    tasa_anual: tasaAnual,
    sistema,
  };
  if (sistema === "manual") {
    const cuotas = texto(form, "cuotas_manuales")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(pesosACentavos);
    if (cuotas.length === 0 || cuotas.some((c) => !c || c <= 0)) {
      return { error: "Escribí una cuota por línea, todas con números mayores a cero." };
    }
    Object.assign(fila, { cuotas_manuales: cuotas, cantidad: cuotas.length, capital: 0 });
  } else {
    const capital = pesosACentavos(texto(form, "capital"));
    const cantidad = entero(form, "cantidad");
    if (!capital || capital <= 0) return { error: "El capital tiene que ser un número mayor a cero." };
    if (!cantidad || cantidad > 480) return { error: "La cantidad de cuotas va de 1 a 480." };
    Object.assign(fila, { capital, cantidad });
  }
  return guardar("prestamos", fila);
}

export async function crearRecurrente(_: Resultado, form: FormData): Promise<Resultado> {
  const descripcion = texto(form, "descripcion");
  const tipo = texto(form, "tipo");
  const monto = pesosACentavos(texto(form, "monto"));
  const dia = entero(form, "dia_del_mes");
  const desde = texto(form, "desde");
  const hasta = texto(form, "hasta");
  if (!descripcion) return { error: "Poné un nombre." };
  if (!["ingreso", "egreso"].includes(tipo)) return { error: "Elegí si es ingreso o gasto." };
  if (!monto || monto <= 0) return { error: "El monto tiene que ser un número mayor a cero." };
  if (!dia || dia > 31) return { error: "El día va del 1 al 31." };
  if (!MES.test(desde)) return { error: "Elegí desde qué mes." };
  if (hasta && (!MES.test(hasta) || hasta < desde)) return { error: "El mes final tiene que ser posterior al inicial." };
  const { supabase } = await requerirUsuario();
  const categoria = await categoriaElegida(supabase, form, tipo === "ingreso" ? "ingreso" : "egreso");
  if ("error" in categoria) return categoria;

  return guardar("recurrentes", {
    descripcion,
    tipo,
    categoria: categoria.categoria ?? descripcion,
    categoria_id: categoria.categoria_id,
    contraparte: contraparte(form),
    cuenta_id: texto(form, "cuenta_id"),
    monto_estimado: monto,
    dia_del_mes: dia,
    desde,
    hasta: hasta || null,
    requiere_confirmacion: form.get("requiere_confirmacion") === "on",
  });
}

/** Registra lo que realmente entró o salió de un recurrente en un mes. */
export async function confirmarRecurrente(
  recurrenteId: string,
  mes: string,
  _: Resultado,
  form: FormData,
): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const monto = pesosACentavos(texto(form, "monto"));
  const fecha = texto(form, "fecha");
  if (!monto || monto <= 0) return { error: "El monto tiene que ser mayor a cero." };
  if (!FECHA.test(fecha)) return { error: "Elegí la fecha." };

  const { data: r, error: errorLectura } = await supabase
    .from("recurrentes")
    .select("descripcion, tipo, categoria, categoria_id, contraparte, cuenta_id")
    .eq("id", recurrenteId)
    .single();
  if (errorLectura || !r) return { error: "No se encontró el recurrente." };

  const { error } = await supabase.from("movimientos").insert({
    fecha,
    descripcion: r.descripcion,
    tipo: r.tipo,
    monto,
    cuenta_id: r.cuenta_id,
    categoria: r.categoria,
    categoria_id: r.categoria_id,
    contraparte: r.contraparte,
    estado: "real",
    origen: { tipo: "recurrente", recurrenteId, mes },
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrar(tabla: "planes_cuotas" | "prestamos" | "recurrentes", id: string) {
  const { supabase } = await requerirUsuario();
  const { error } = await supabase.from(tabla).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
