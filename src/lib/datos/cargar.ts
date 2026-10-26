import type { SupabaseClient } from "@supabase/supabase-js";
import type { Datos, Escenario, Mes, Presupuesto } from "@/lib/finanzas/tipos";
import { aCategoria, conCategoria, type Categoria, type FilaCategoria } from "./categorias";
import {
  aCuenta,
  aEscenario,
  aMovimiento,
  aObjetivo,
  aPlanCuotas,
  aPrestamo,
  aPresupuesto,
  aRecurrente,
  type FilaCiclo,
  type FilaCotizacion,
  type FilaCuenta,
  type FilaEscenario,
  type FilaMovimiento,
  type FilaObjetivo,
  type FilaPlanCuotas,
  type FilaPresupuesto,
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
  /** Como se cargaron: con las categorías elegidas, sin expandir a sus subcategorías. */
  presupuestos: Presupuesto[];
  /** Cuentas no archivadas, para elegir en los formularios. `datos.cuentas` las incluye todas. */
  cuentasActivas: string[];
  /** Comercios y personas ya usados, los más frecuentes primero, para sugerir al cargar. */
  contrapartes: string[];
  /** Tipos de cambio cargados, por moneda. */
  cotizaciones: Record<string, { valor: number; fuente: string; actualizada: string }>;
}

function masUsadas(nombres: (string | undefined)[]): string[] {
  const veces = new Map<string, number>();
  for (const n of nombres) if (n) veces.set(n, (veces.get(n) ?? 0) + 1);
  return [...veces].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).map(([n]) => n);
}

function sinError<T>(resultado: { data: T | null; error: { message: string } | null }): T {
  if (resultado.error) throw new Error(resultado.error.message);
  return resultado.data as T;
}

/** Todo lo que necesita la previsión, del hogar del usuario de la sesión. */
export async function cargarHogar(supabase: SupabaseClient): Promise<DatosHogar> {
  const [
    hogares,
    cuentas,
    ciclos,
    movimientos,
    planes,
    prestamos,
    recurrentes,
    escenarios,
    categorias,
    presupuestos,
    cotizaciones,
    objetivos,
  ] = await Promise.all([
      supabase.from("hogares").select("id, nombre, mes_inicio").order("creado").limit(1),
      supabase.from("cuentas").select("*").order("creado"),
      supabase.from("ciclos_tarjeta").select("cuenta_id, mes, cierre, vencimiento"),
      supabase.from("movimientos").select("*").order("fecha"),
      supabase.from("planes_cuotas").select("*"),
      supabase.from("prestamos").select("*"),
      supabase.from("recurrentes").select("*"),
      supabase.from("escenarios").select("*").order("creado"),
      supabase.from("categorias").select("id, nombre, tipo, padre_id, icono, color, orden, archivada"),
      supabase.from("presupuestos").select("*").order("creado"),
      supabase.from("cotizaciones").select("moneda, valor, fuente, actualizada"),
      supabase.from("objetivos_ahorro").select("*").order("creado"),
    ]);

  const [filaHogar] = sinError<{ id: string; nombre: string; mes_inicio: string }[]>(hogares);
  if (!filaHogar) throw new Error("El usuario no tiene un hogar");
  const filasCuentas = sinError<FilaCuenta[]>(cuentas);
  const filasCiclos = sinError<FilaCiclo[]>(ciclos);
  const listaCotizaciones = Object.fromEntries(
    sinError<FilaCotizacion[]>(cotizaciones).map((c) => [
      c.moneda,
      { valor: Number(c.valor), fuente: c.fuente, actualizada: c.actualizada },
    ]),
  );
  const cambios = Object.fromEntries(Object.entries(listaCotizaciones).map(([m, c]) => [m, c.valor]));
  const listaCategorias = sinError<FilaCategoria[]>(categorias).map(aCategoria);
  const porId = new Map(listaCategorias.map((c) => [c.id, c]));
  const listaPresupuestos = sinError<FilaPresupuesto[]>(presupuestos).map(aPresupuesto);
  // Elegir una categoría incluye sus subcategorías.
  const conSubcategorias = (ids: string[]) => [
    ...new Set([...ids, ...listaCategorias.filter((c) => c.padreId && ids.includes(c.padreId)).map((c) => c.id)]),
  ];

  const datos: Datos = {
    cuentas: filasCuentas.map((c) => aCuenta(c, filasCiclos, cambios)),
    movimientos: sinError<FilaMovimiento[]>(movimientos).map((f) => conCategoria(aMovimiento(f), porId)),
    planesCuotas: sinError<FilaPlanCuotas[]>(planes).map((f) => conCategoria(aPlanCuotas(f), porId)),
    prestamos: sinError<FilaPrestamo[]>(prestamos).map((f) => conCategoria(aPrestamo(f), porId)),
    recurrentes: sinError<FilaRecurrente[]>(recurrentes).map((f) => conCategoria(aRecurrente(f), porId)),
    presupuestos: listaPresupuestos.map((p) => ({ ...p, categoriaIds: conSubcategorias(p.categoriaIds) })),
    objetivos: sinError<FilaObjetivo[]>(objetivos).map(aObjetivo),
  };

  return {
    hogar: { id: filaHogar.id, nombre: filaHogar.nombre, mesInicio: filaHogar.mes_inicio },
    datos,
    escenarios: sinError<FilaEscenario[]>(escenarios).map(aEscenario),
    categorias: listaCategorias,
    presupuestos: listaPresupuestos,
    cuentasActivas: filasCuentas.filter((c) => !c.archivada).map((c) => c.id),
    cotizaciones: listaCotizaciones,
    contrapartes: masUsadas(
      [...datos.movimientos, ...datos.planesCuotas, ...datos.prestamos, ...datos.recurrentes].map((x) => x.contraparte),
    ),
  };
}
