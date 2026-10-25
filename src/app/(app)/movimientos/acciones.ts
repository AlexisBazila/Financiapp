"use server";

import { revalidatePath } from "next/cache";
import { pesosACentavos, texto } from "@/lib/datos/formularios";
import { requerirUsuario } from "@/lib/supabase/servidor";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

export async function crearMovimiento(_: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const tipo = texto(form, "tipo");
  const fecha = texto(form, "fecha");
  const monto = pesosACentavos(texto(form, "monto"));
  const cuentaId = texto(form, "cuenta_id");
  const destinoId = texto(form, "cuenta_destino_id");
  const estado = texto(form, "estado");

  if (!["ingreso", "egreso", "transferencia"].includes(tipo)) return { error: "Elegí el tipo." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Elegí la fecha." };
  if (!monto || monto <= 0) return { error: "El monto tiene que ser un número mayor a cero." };
  if (!cuentaId) return { error: "Elegí la cuenta." };
  if (tipo === "transferencia" && (!destinoId || destinoId === cuentaId)) {
    return { error: "Elegí una cuenta destino distinta de la de origen." };
  }
  if (!["real", "planificado"].includes(estado)) return { error: "Elegí si ya pasó o es planificado." };

  const { error } = await supabase.from("movimientos").insert({
    tipo,
    fecha,
    monto,
    cuenta_id: cuentaId,
    cuenta_destino_id: tipo === "transferencia" ? destinoId : null,
    categoria: tipo === "transferencia" ? null : texto(form, "categoria") || null,
    descripcion: texto(form, "descripcion"),
    estado,
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarMovimiento(id: string) {
  const { supabase } = await requerirUsuario();
  const { error } = await supabase.from("movimientos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
