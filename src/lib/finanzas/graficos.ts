// Datos para los gráficos de torta de Informes: lo gastado o cobrado de cada mes, por categoría y
// subcategoría. Sale del detalle de la previsión, así que cuenta igual que ella: las compras con tarjeta
// en el mes del cierre, los repartos en cada parte, los dólares en pesos.

import type { MesPrevision } from "./prevision";
import type { Centavos, Mes } from "./tipos";

export type TipoGrafico = "gasto" | "ingreso";

export interface CategoriaGrafico {
  id: string;
  nombre: string;
  icono?: string;
  padreId?: string;
}

export interface Porcion {
  mes: Mes;
  tipo: TipoGrafico;
  /** Categoría principal, con su ícono. */
  categoria: string;
  /** Subcategoría, o `SIN_SUBCATEGORIA` si se cargó en la principal. */
  subcategoria: string;
  monto: Centavos;
  movimientos: number;
  /** Lo que todavía no pasó (cuotas, recurrentes y gastos planificados). */
  previsto: Centavos;
}

export const SIN_SUBCATEGORIA = "Directo en la categoría";

const RESTO_PRESUPUESTO = "(resto del presupuesto)";

const nombre = (c: CategoriaGrafico) => (c.icono ? `${c.icono} ${c.nombre}` : c.nombre);

/**
 * Una porción por mes, tipo, categoría y subcategoría. Lo que resta de los presupuestos no entra: es una
 * estimación, no un gasto.
 */
export function porcionesDeLaPrevision(meses: MesPrevision[], categorias: CategoriaGrafico[]): Porcion[] {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const porciones = new Map<string, Porcion>();
  for (const m of meses) {
    for (const [clave, items] of Object.entries(m.detalle)) {
      const separador = clave.indexOf(":");
      const origen = clave.slice(0, separador);
      const grupo = clave.slice(separador + 1);
      if (grupo.endsWith(RESTO_PRESUPUESTO)) continue;
      for (const item of items) {
        // En la tarjeta las devoluciones vienen en negativo y se descuentan del gasto.
        const tipo: TipoGrafico = origen === "ingreso" ? "ingreso" : "gasto";
        const cat = item.categoriaId ? porId.get(item.categoriaId) : undefined;
        const padre = cat?.padreId ? porId.get(cat.padreId) : undefined;
        const categoria = padre ? nombre(padre) : cat ? nombre(cat) : grupo;
        const subcategoria = padre && cat ? nombre(cat) : SIN_SUBCATEGORIA;
        const k = [m.mes, tipo, categoria, subcategoria].join("|");
        const previa = porciones.get(k) ?? {
          mes: m.mes,
          tipo,
          categoria,
          subcategoria,
          monto: 0,
          movimientos: 0,
          previsto: 0,
        };
        previa.monto += item.monto;
        previa.movimientos += item.movimientos.length;
        previa.previsto += item.movimientos
          .filter((mv) => mv.certeza === "planificado")
          .reduce((s, mv) => s + mv.monto, 0);
        porciones.set(k, previa);
      }
    }
  }
  return [...porciones.values()].filter((p) => p.monto !== 0);
}

export interface Rebanada {
  nombre: string;
  monto: Centavos;
  movimientos: number;
  previsto: Centavos;
  /** Lo que se juntó en "Otros". */
  incluye?: string[];
}

/**
 * Las rebanadas de una torta, de mayor a menor. Si `categoria` es nula, una por categoría principal; si
 * no, una por subcategoría de esa categoría. Pasadas las `maximo`, el resto se junta en "Otros". Lo
 * negativo (más devoluciones que gastos) no entra en una torta.
 */
export function rebanadas(
  porciones: Porcion[],
  filtro: { tipo: TipoGrafico; desde: Mes; hasta: Mes; categoria?: string },
  maximo = 7,
): Rebanada[] {
  const grupos = new Map<string, Rebanada>();
  for (const p of porciones) {
    if (p.tipo !== filtro.tipo || p.mes < filtro.desde || p.mes > filtro.hasta) continue;
    if (filtro.categoria && p.categoria !== filtro.categoria) continue;
    const clave = filtro.categoria ? p.subcategoria : p.categoria;
    const r = grupos.get(clave) ?? { nombre: clave, monto: 0, movimientos: 0, previsto: 0 };
    r.monto += p.monto;
    r.movimientos += p.movimientos;
    r.previsto += p.previsto;
    grupos.set(clave, r);
  }
  const todas = [...grupos.values()].filter((r) => r.monto > 0).sort((a, b) => b.monto - a.monto);
  if (todas.length <= maximo + 1) return todas;
  const resto = todas.slice(maximo);
  return [
    ...todas.slice(0, maximo),
    {
      nombre: "Otros",
      monto: resto.reduce((s, r) => s + r.monto, 0),
      movimientos: resto.reduce((s, r) => s + r.movimientos, 0),
      previsto: resto.reduce((s, r) => s + r.previsto, 0),
      incluye: resto.map((r) => r.nombre),
    },
  ];
}
