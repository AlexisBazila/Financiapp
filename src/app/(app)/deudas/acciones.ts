"use server";

import { revalidatePath } from "next/cache";
import { categoriaElegida } from "@/lib/datos/categoria-elegida";
import { entero, pesosACentavos, texto } from "@/lib/datos/formularios";
import { sumarMeses } from "@/lib/finanzas/fechas";
import type { CuotaDeuda } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function crearDeuda(_: Resultado, form: FormData): Promise<Resultado> {
  const descripcion = texto(form, "descripcion");
  const cantidad = entero(form, "cantidad");
  const porMes = entero(form, "por_mes") ?? 1;
  const monto = pesosACentavos(texto(form, "monto"));
  const desde = texto(form, "desde");
  const dia = entero(form, "dia_del_mes");
  if (!descripcion) return { error: "Poné un nombre, por ejemplo Patente." };
  if (!cantidad || cantidad > 120) return { error: "La cantidad de cuotas va de 1 a 120." };
  if (!monto || monto <= 0) return { error: "El monto de cada cuota tiene que ser mayor a cero." };
  if (!MES.test(desde)) return { error: "Elegí el mes de la primera cuota." };
  if (porMes < 1 || porMes > 12) return { error: "Las cuotas por mes van de 1 a 12." };
  if (!dia || dia > 31) return { error: "El día va del 1 al 31." };
  const { supabase } = await requerirUsuario();
  const categoria = await categoriaElegida(supabase, form, "egreso");
  if ("error" in categoria) return categoria;

  const cuotas: CuotaDeuda[] = Array.from({ length: cantidad }, (_, k) => ({
    numero: k + 1,
    monto,
    mes: sumarMeses(desde, Math.floor(k / porMes)),
  }));
  const { error } = await supabase.from("deudas").insert({
    descripcion,
    categoria: categoria.categoria ?? descripcion,
    categoria_id: categoria.categoria_id,
    contraparte: texto(form, "contraparte").slice(0, 80) || null,
    cuenta_id: texto(form, "cuenta_id"),
    dia_del_mes: dia,
    cuotas,
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Cambia las cuotas de una deuda con `cambiar`, que recibe las actuales. */
async function cambiarCuotas(deudaId: string, cambiar: (cuotas: CuotaDeuda[]) => CuotaDeuda[]): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const { data, error: errorLectura } = await supabase.from("deudas").select("cuotas").eq("id", deudaId).single();
  if (errorLectura || !data) return { error: "No se encontró la deuda." };
  const { error } = await supabase
    .from("deudas")
    .update({ cuotas: cambiar(data.cuotas as CuotaDeuda[]) })
    .eq("id", deudaId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Pasa una cuota a otro mes. Si se había guardado como movimiento planificado (al editarla en
 * Movimientos), ese se borra para que valga el mes nuevo.
 */
export async function moverCuota(deudaId: string, numero: number, mes: string): Promise<Resultado> {
  if (!MES.test(mes)) return { error: "Elegí un mes." };
  const { supabase } = await requerirUsuario();
  await supabase
    .from("movimientos")
    .delete()
    .eq("origen->>tipo", "deuda")
    .eq("origen->>deudaId", deudaId)
    .eq("origen->>numero", String(numero))
    .neq("estado", "real");
  return cambiarCuotas(deudaId, (cuotas) => cuotas.map((c) => (c.numero === numero ? { ...c, mes } : c)));
}

export async function editarCuota(deudaId: string, numero: number, _: Resultado, form: FormData): Promise<Resultado> {
  const monto = pesosACentavos(texto(form, "monto"));
  const mes = texto(form, "mes");
  if (!monto || monto <= 0) return { error: "El monto tiene que ser mayor a cero." };
  if (!MES.test(mes)) return { error: "Elegí un mes." };
  const movida = await moverCuota(deudaId, numero, mes);
  if (movida.error) return movida;
  return cambiarCuotas(deudaId, (cuotas) => cuotas.map((c) => (c.numero === numero ? { ...c, monto } : c)));
}

export async function agregarCuota(deudaId: string, _: Resultado, form: FormData): Promise<Resultado> {
  const monto = pesosACentavos(texto(form, "monto"));
  const mes = texto(form, "mes");
  if (!monto || monto <= 0) return { error: "El monto tiene que ser mayor a cero." };
  if (!MES.test(mes)) return { error: "Elegí un mes." };
  return cambiarCuotas(deudaId, (cuotas) => [
    ...cuotas,
    { numero: Math.max(0, ...cuotas.map((c) => c.numero)) + 1, monto, mes },
  ]);
}

/** Registra el pago de una o varias cuotas: un movimiento real por cuota, con lo que se pagó de cada una. */
export async function pagarCuotas(deudaId: string, numeros: number[], _: Resultado, form: FormData): Promise<Resultado> {
  const fecha = texto(form, "fecha");
  if (!FECHA.test(fecha)) return { error: "Elegí la fecha del pago." };
  const montos = numeros.map((n) => pesosACentavos(texto(form, `monto_${n}`)));
  if (montos.some((m) => !m || m <= 0)) return { error: "Cada monto tiene que ser mayor a cero." };

  const { supabase } = await requerirUsuario();
  const { data: d, error: errorLectura } = await supabase
    .from("deudas")
    .select("descripcion, categoria, categoria_id, contraparte, cuenta_id, cuotas")
    .eq("id", deudaId)
    .single();
  if (errorLectura || !d) return { error: "No se encontró la deuda." };
  const total = (d.cuotas as CuotaDeuda[]).length;
  const origen = (numero: number) => ({ tipo: "deuda", deudaId, numero, total });

  // Si alguna se había guardado como planificada, el pago la reemplaza.
  for (const numero of numeros) {
    await supabase
      .from("movimientos")
      .delete()
      .eq("origen->>tipo", "deuda")
      .eq("origen->>deudaId", deudaId)
      .eq("origen->>numero", String(numero))
      .neq("estado", "real");
  }
  const { error } = await supabase.from("movimientos").insert(
    numeros.map((numero, k) => ({
      fecha,
      descripcion: `${d.descripcion} (${numero}/${total})`,
      tipo: "egreso",
      monto: montos[k],
      cuenta_id: d.cuenta_id,
      categoria: d.categoria,
      categoria_id: d.categoria_id,
      contraparte: d.contraparte,
      estado: "real",
      origen: origen(numero),
    })),
  );
  if (error) {
    if (error.code === "23505") return { error: "Alguna de esas cuotas ya estaba pagada; recargá la página." };
    return { error: `No se pudo guardar: ${error.message}` };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Borra la deuda. Las cuotas ya pagadas quedan como movimientos. */
export async function borrarDeuda(id: string) {
  const { supabase } = await requerirUsuario();
  const { error } = await supabase.from("deudas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
