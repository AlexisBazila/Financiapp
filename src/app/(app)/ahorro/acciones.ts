"use server";

import { revalidatePath } from "next/cache";
import { pesosACentavos, texto } from "@/lib/datos/formularios";
import { requerirUsuario } from "@/lib/supabase/servidor";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function guardarObjetivo(id: string | null, _: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const nombre = texto(form, "nombre");
  const icono = texto(form, "icono");
  const origen = texto(form, "cuenta_origen_id");
  const destino = texto(form, "cuenta_destino_id");
  const modo = texto(form, "modo");
  const desde = texto(form, "desde");
  const hasta = texto(form, "hasta");

  if (!nombre || nombre.length > 60) return { error: "Poné un nombre de hasta 60 letras." };
  if ([...icono].length > 4) return { error: "El ícono tiene que ser un solo emoji." };
  if (!origen || !destino) return { error: "Elegí de qué cuenta sale y a cuál va." };
  if (origen === destino) return { error: "La cuenta de origen y la de destino tienen que ser distintas." };
  if (!MES.test(desde)) return { error: "Elegí desde qué mes." };
  if (hasta && (!MES.test(hasta) || hasta < desde)) return { error: "El mes final tiene que ser posterior al inicial." };

  let monto: number | null = null;
  let porcentaje: number | null = null;
  if (modo === "porcentaje") {
    porcentaje = Number(texto(form, "porcentaje").replace(",", "."));
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      return { error: "El porcentaje va de 0 a 100." };
    }
  } else {
    monto = pesosACentavos(texto(form, "monto"));
    if (!monto || monto <= 0) return { error: "El monto tiene que ser un número mayor a cero." };
  }

  const fila = {
    nombre,
    icono,
    cuenta_origen_id: origen,
    cuenta_destino_id: destino,
    monto,
    porcentaje,
    desde,
    hasta: hasta || null,
  };
  const { error } = id
    ? await supabase.from("objetivos_ahorro").update(fila).eq("id", id)
    : await supabase.from("objetivos_ahorro").insert(fila);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Pone a mano el monto de un mes puntual, o lo quita si `monto` viene vacío. */
export async function guardarMontoDelMes(id: string, _: Resultado, form: FormData): Promise<Resultado> {
  const mes = texto(form, "mes");
  if (!MES.test(mes)) return { error: "Elegí el mes." };
  const valor = texto(form, "monto");
  const monto = valor ? pesosACentavos(valor) : null;
  if (valor && (monto === null || monto < 0)) return { error: "El monto no es un número válido." };
  return cambiarMontos(id, mes, monto);
}

export async function quitarMontoDelMes(id: string, mes: string) {
  const resultado = await cambiarMontos(id, mes, null);
  if (resultado.error) throw new Error(resultado.error);
}

async function cambiarMontos(id: string, mes: string, monto: number | null): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const { data, error: errorLectura } = await supabase
    .from("objetivos_ahorro")
    .select("montos_por_mes")
    .eq("id", id)
    .single();
  if (errorLectura) return { error: `No se pudo leer el objetivo: ${errorLectura.message}` };
  const montos: Record<string, number> = { ...(data.montos_por_mes ?? {}) };
  if (monto === null) delete montos[mes];
  else montos[mes] = monto;
  const { error } = await supabase.from("objetivos_ahorro").update({ montos_por_mes: montos }).eq("id", id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarObjetivo(id: string) {
  const { supabase } = await requerirUsuario();
  const { error } = await supabase.from("objetivos_ahorro").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
