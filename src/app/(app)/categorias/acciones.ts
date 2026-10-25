"use server";

import { revalidatePath } from "next/cache";
import type { Categoria, TipoCategoria } from "@/lib/datos/categorias";
import { texto } from "@/lib/datos/formularios";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { COLORES } from "./opciones";

export interface Resultado {
  error?: string;
  ok?: boolean;
}

const COLOR = /^#[0-9a-fA-F]{6}$/;

function mensaje(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Ya existe una categoría con ese nombre.";
  return `No se pudo guardar: ${error.message}`;
}

/** Valida los campos comunes de crear y editar. */
function campos(form: FormData) {
  const nombre = texto(form, "nombre");
  const icono = texto(form, "icono");
  const color = texto(form, "color");
  if (!nombre || nombre.length > 60) return { error: "Poné un nombre de hasta 60 letras." };
  if ([...icono].length > 4) return { error: "El ícono tiene que ser un solo emoji." };
  if (color && !COLOR.test(color)) return { error: "Elegí un color." };
  return { nombre, icono, color: color || undefined, padreId: texto(form, "padre_id") || null };
}

async function colorDelPadre(padreId: string | null): Promise<string | undefined> {
  if (!padreId) return undefined;
  const { supabase } = await requerirUsuario();
  const { data } = await supabase.from("categorias").select("color").eq("id", padreId).maybeSingle();
  return data?.color;
}

export async function crearCategoria(_: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const tipo = texto(form, "tipo");
  if (tipo !== "ingreso" && tipo !== "egreso") return { error: "Elegí si es de ingresos o de gastos." };
  const c = campos(form);
  if ("error" in c) return c;

  const { error } = await supabase.from("categorias").insert({
    nombre: c.nombre,
    tipo,
    padre_id: c.padreId,
    icono: c.icono,
    color: c.color ?? (await colorDelPadre(c.padreId)) ?? COLORES[COLORES.length - 1],
    orden: 1000,
  });
  if (error) return { error: mensaje(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Desde el selector de los formularios: crea la categoría y la devuelve para elegirla en el momento. */
export async function crearCategoriaRapida(datos: {
  nombre: string;
  tipo: TipoCategoria;
  padreId?: string;
  icono: string;
}): Promise<{ error?: string; categoria?: Categoria }> {
  const { supabase } = await requerirUsuario();
  const form = new FormData();
  form.set("nombre", datos.nombre);
  form.set("icono", datos.icono);
  form.set("padre_id", datos.padreId ?? "");
  const c = campos(form);
  if ("error" in c) return c;
  if (datos.tipo !== "ingreso" && datos.tipo !== "egreso") return { error: "Tipo inválido." };

  const { data, error } = await supabase
    .from("categorias")
    .insert({
      nombre: c.nombre,
      tipo: datos.tipo,
      padre_id: c.padreId,
      icono: c.icono,
      color: (await colorDelPadre(c.padreId)) ?? COLORES[Math.floor(Math.random() * (COLORES.length - 1))],
      orden: 1000,
    })
    .select("id, nombre, tipo, padre_id, icono, color, orden")
    .single();
  if (error || !data) return { error: error ? mensaje(error) : "No se pudo guardar." };
  revalidatePath("/", "layout");
  return {
    categoria: {
      id: data.id,
      nombre: data.nombre,
      tipo: data.tipo,
      padreId: data.padre_id ?? undefined,
      icono: data.icono,
      color: data.color,
      orden: data.orden,
      archivada: false,
    },
  };
}

export async function editarCategoria(id: string, _: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await requerirUsuario();
  const c = campos(form);
  if ("error" in c) return c;
  const cambios: Record<string, unknown> = { nombre: c.nombre, icono: c.icono, padre_id: c.padreId };
  if (c.color) cambios.color = c.color;
  const { error } = await supabase.from("categorias").update(cambios).eq("id", id);
  if (error) return { error: mensaje(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Archivar la esconde de los formularios; lo ya cargado la conserva. */
export async function archivarCategoria(id: string, archivada: boolean) {
  const { supabase } = await requerirUsuario();
  const { error } = await supabase.from("categorias").update({ archivada }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
