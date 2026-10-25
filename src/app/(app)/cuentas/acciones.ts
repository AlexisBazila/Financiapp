"use server";

import { revalidatePath } from "next/cache";
import { entero, pesosACentavos, texto } from "@/lib/datos/formularios";
import { requerirUsuario } from "@/lib/supabase/servidor";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

const TIPOS = ["efectivo", "banco", "billetera", "inversion", "tarjeta"];
const DISPONIBILIDADES = ["inmediata", "48h", "reserva"];

export async function crearCuenta(_: Resultado, form: FormData): Promise<Resultado> {
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

  const fila: Record<string, unknown> = { nombre, tipo, disponibilidad, saldo_inicial: saldo };
  if (esTarjeta) {
    const diaCierre = entero(form, "dia_cierre");
    const diaVencimiento = entero(form, "dia_vencimiento");
    const cuentaPago = texto(form, "cuenta_pago_id");
    if (!diaCierre || diaCierre > 31 || !diaVencimiento || diaVencimiento > 31) {
      return { error: "Los días de cierre y vencimiento van del 1 al 31." };
    }
    if (!cuentaPago) return { error: "Elegí desde qué cuenta pagás la tarjeta." };
    Object.assign(fila, { dia_cierre: diaCierre, dia_vencimiento: diaVencimiento, cuenta_pago_id: cuentaPago });
  }

  const { error } = await supabase.from("cuentas").insert(fila);
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
