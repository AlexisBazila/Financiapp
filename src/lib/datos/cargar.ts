import type { SupabaseClient } from "@supabase/supabase-js";
import type { Datos, Escenario, Mes } from "@/lib/finanzas/tipos";
import { aCategoria, conCategoria, type Categoria, type FilaCategoria } from "./categorias";
import {
  aCuenta,
  aEscenario,
  aMovimiento,
  aPlanCuotas,
  aPrestamo,
  aRecurrente,
  type FilaCiclo,
  type FilaCuenta,
  type FilaEscenario,
  type FilaMovimiento,
  type FilaPlanCuotas,
  type FilaPrestamo,
  type FilaRecurrente,
} from "./filas";

export interface Hogar {
  id: string;
  nombre: string;
  mesInicio: Mes;
}

export interface DatosHogar {
  hogar: Hogar;
  datos: Datos;
  escenarios: Escenario[];
  /** Todas, incluidas las archivadas, para mostrar lo cargado con ellas. */
  categorias: Categoria[];
  /** Cuentas no archivadas, para elegir en los formularios. `datos.cuentas` las incluye todas. */
  cuentasActivas: string[];
}

function sinError<T>(resultado: { data: T | null; error: { message: string } | null }): T {
  if (resultado.error) throw new Error(resultado.error.message);
  return resultado.data as T;
}

/** Todo lo que necesita la previsión, del hogar del usuario de la sesión. */
export async function cargarHogar(supabase: SupabaseClient): Promise<DatosHogar> {
  const [hogares, cuentas, ciclos, movimientos, planes, prestamos, recurrentes, escenarios, categorias] =
    await Promise.all([
      supabase.from("hogares").select("id, nombre, mes_inicio").order("creado").limit(1),
      supabase.from("cuentas").select("*").order("creado"),
      supabase.from("ciclos_tarjeta").select("cuenta_id, mes, cierre, vencimiento"),
      supabase.from("movimientos").select("*").order("fecha"),
      supabase.from("planes_cuotas").select("*"),
      supabase.from("prestamos").select("*"),
      supabase.from("recurrentes").select("*"),
      supabase.from("escenarios").select("*").order("creado"),
      supabase.from("categorias").select("id, nombre, tipo, padre_id, icono, color, orden, archivada"),
    ]);

  const [filaHogar] = sinError<{ id: string; nombre: string; mes_inicio: string }[]>(hogares);
  if (!filaHogar) throw new Error("El usuario no tiene un hogar");
  const filasCuentas = sinError<FilaCuenta[]>(cuentas);
  const filasCiclos = sinError<FilaCiclo[]>(ciclos);
  const listaCategorias = sinError<FilaCategoria[]>(categorias).map(aCategoria);
  const porId = new Map(listaCategorias.map((c) => [c.id, c]));

  return {
    hogar: { id: filaHogar.id, nombre: filaHogar.nombre, mesInicio: filaHogar.mes_inicio },
    datos: {
      cuentas: filasCuentas.map((c) => aCuenta(c, filasCiclos)),
      movimientos: sinError<FilaMovimiento[]>(movimientos).map((f) => conCategoria(aMovimiento(f), porId)),
      planesCuotas: sinError<FilaPlanCuotas[]>(planes).map((f) => conCategoria(aPlanCuotas(f), porId)),
      prestamos: sinError<FilaPrestamo[]>(prestamos).map((f) => conCategoria(aPrestamo(f), porId)),
      recurrentes: sinError<FilaRecurrente[]>(recurrentes).map((f) => conCategoria(aRecurrente(f), porId)),
    },
    escenarios: sinError<FilaEscenario[]>(escenarios).map(aEscenario),
    categorias: listaCategorias,
    cuentasActivas: filasCuentas.filter((c) => !c.archivada).map((c) => c.id),
  };
}
