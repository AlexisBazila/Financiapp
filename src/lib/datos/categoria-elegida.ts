import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoCategoria } from "./categorias";
import { texto } from "./formularios";

export type CategoriaElegida =
  | { error: string }
  | { categoria_id: string | null; categoria: string | null };

/**
 * Lee el campo `categoria_id` de un formulario y comprueba que la categoría sea del hogar y del tipo
 * correcto. Devuelve también su nombre, que se guarda en la columna de texto `categoria`.
 */
export async function categoriaElegida(
  supabase: SupabaseClient,
  form: FormData,
  tipo: TipoCategoria,
): Promise<CategoriaElegida> {
  const id = texto(form, "categoria_id");
  if (!id) return { categoria_id: null, categoria: null };
  const { data } = await supabase.from("categorias").select("nombre, tipo").eq("id", id).maybeSingle();
  if (!data) return { error: "No se encontró la categoría." };
  if (data.tipo !== tipo) {
    return { error: `Elegí una categoría de ${tipo === "ingreso" ? "ingresos" : "gastos"}.` };
  }
  return { categoria_id: id, categoria: data.nombre };
}
