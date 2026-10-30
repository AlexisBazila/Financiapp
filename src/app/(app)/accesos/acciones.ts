"use server";

import { revalidatePath } from "next/cache";
import { texto } from "@/lib/datos/formularios";
import { requerirUsuario } from "@/lib/supabase/servidor";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invitación a mi hogar (`licencia` falso) o licencia para un hogar nuevo. */
export async function crearInvitacion(licencia: boolean, _: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const email = texto(form, "email").toLowerCase();
  if (email && !EMAIL.test(email)) return { error: "El email no es válido." };
  let hogarId: string | null = null;
  if (!licencia) {
    const { data } = await supabase.rpc("mi_hogar");
    if (!data) return { error: "No encontramos tu hogar." };
    hogarId = data;
  }
  const { error } = await supabase.from("invitaciones").insert({
    hogar_id: hogarId,
    rol: licencia ? "admin" : texto(form, "rol") === "admin" ? "admin" : "miembro",
    email: email || null,
    nota: texto(form, "nota") || null,
  });
  if (error) return { error: "No tenés permiso para crear esta invitación." };
  revalidatePath("/accesos");
  return { ok: true };
}

export async function borrarInvitacion(codigo: string) {
  const { supabase } = await requerirUsuario();
  await supabase.from("invitaciones").delete().eq("codigo", codigo);
  revalidatePath("/accesos");
}

export async function quitarMiembro(usuario: string) {
  const { supabase } = await requerirUsuario();
  await supabase.rpc("quitar_miembro", { usuario });
  revalidatePath("/accesos");
}

export async function cambiarAccesoHogar(hogar: string, activo: boolean) {
  const { supabase } = await requerirUsuario();
  await supabase.rpc("cambiar_acceso_hogar", { hogar, activo });
  revalidatePath("/accesos");
}
