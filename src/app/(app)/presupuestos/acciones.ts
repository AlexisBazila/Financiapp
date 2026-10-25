"use server";

import { revalidatePath } from "next/cache";
import { pesosACentavos, texto } from "@/lib/datos/formularios";
import { requerirUsuario } from "@/lib/supabase/servidor";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function guardarPresupuesto(id: string | null, _: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const nombre = texto(form, "nombre");
  const icono = texto(form, "icono");
  const monto = pesosACentavos(texto(form, "monto"));
  const cuentaId = texto(form, "cuenta_id");
  const desde = texto(form, "desde");
  const repite = form.get("repite") === "on";
  const hasta = repite ? texto(form, "hasta") : desde;
  const categoriaIds = form.getAll("categoria_ids").filter((v): v is string => typeof v === "string" && v !== "");
  const algunas = texto(form, "cuentas") === "algunas";
  const cuentaIds = form.getAll("cuenta_ids").filter((v): v is string => typeof v === "string" && v !== "");

  if (!nombre || nombre.length > 60) return { error: "Poné un nombre de hasta 60 letras." };
  if ([...icono].length > 4) return { error: "El ícono tiene que ser un solo emoji." };
  if (!monto || monto <= 0) return { error: "El monto tiene que ser un número mayor a cero." };
  if (!cuentaId) return { error: "Elegí la cuenta." };
  if (!MES.test(desde)) return { error: "Elegí desde qué mes." };
  if (hasta && (!MES.test(hasta) || hasta < desde)) return { error: "El mes final tiene que ser posterior al inicial." };
  if (categoriaIds.length === 0) return { error: "Elegí al menos una categoría." };
  if (algunas && cuentaIds.length === 0) return { error: "Elegí al menos una cuenta, o marcá todas." };

  const fila = {
    nombre,
    icono,
    monto,
    cuenta_id: cuentaId,
    desde,
    hasta: hasta || null,
    categoria_ids: categoriaIds,
    cuenta_ids: algunas ? cuentaIds : null,
  };
  const { error } = id
    ? await supabase.from("presupuestos").update(fila).eq("id", id)
    : await supabase.from("presupuestos").insert(fila);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarPresupuesto(id: string) {
  const { supabase } = await requerirUsuario();
  const { error } = await supabase.from("presupuestos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
