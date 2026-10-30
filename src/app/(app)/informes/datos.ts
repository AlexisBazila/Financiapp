import { cargarHogar } from "@/lib/datos/cargar";
import { hoy } from "@/lib/finanzas/fechas";
import { armarInforme, esSeccion, SECCIONES, type Seccion } from "@/lib/finanzas/informe";
import { requerirUsuario } from "@/lib/supabase/servidor";

type Parametros = Record<string, string | string[] | undefined>;

export const PLAZOS = [0, 3, 6, 12, 24];

const lista = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const plazo = (v: string | string[] | undefined, porDefecto: number) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return PLAZOS.includes(n) ? n : porDefecto;
};

/** Lo elegido en el formulario. Sin nada elegido (primera vez), todas las secciones. */
export function leerParametros(p: Parametros) {
  const elegidas = lista(p.incluir).filter(esSeccion);
  return {
    incluir: (p.ver ? elegidas : Object.keys(SECCIONES)) as Seccion[],
    atras: plazo(p.atras, 6),
    adelante: plazo(p.adelante, 6),
    ver: Boolean(p.ver),
  };
}

export async function informeDelHogar(p: Parametros) {
  const { supabase } = await requerirUsuario();
  const { hogar, datos, categorias } = await cargarHogar(supabase);
  const { incluir, atras, adelante } = leerParametros(p);
  return armarInforme(datos, {
    hoy: hoy(),
    mesInicio: hogar.mesInicio,
    atras,
    adelante,
    incluir,
    categorias: Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
  });
}
