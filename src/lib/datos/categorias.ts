// Categorías de ingresos y gastos (ver supabase/migrations/0002_categorias.sql).

export type TipoCategoria = "ingreso" | "egreso";

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  /** Solo en subcategorías. */
  padreId?: string;
  icono: string;
  color: string;
  orden: number;
  archivada: boolean;
}

export interface FilaCategoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  padre_id: string | null;
  icono: string;
  color: string;
  orden: number;
  archivada: boolean;
}

export function aCategoria(fila: FilaCategoria): Categoria {
  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    padreId: fila.padre_id ?? undefined,
    icono: fila.icono,
    color: fila.color,
    orden: fila.orden,
    archivada: fila.archivada,
  };
}

/** "🛒 Alimentos" */
export function etiqueta(c: Pick<Categoria, "icono" | "nombre">): string {
  return c.icono ? `${c.icono} ${c.nombre}` : c.nombre;
}

function porOrden(a: Categoria, b: Categoria) {
  return a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es");
}

export interface Rama {
  categoria: Categoria;
  hijas: Categoria[];
}

/** Las categorías principales de un tipo, en orden, cada una con sus subcategorías. */
export function arbol(categorias: Categoria[], tipo: TipoCategoria, { archivadas = false } = {}): Rama[] {
  const visibles = categorias.filter((c) => c.tipo === tipo && (archivadas || !c.archivada));
  return visibles
    .filter((c) => !c.padreId)
    .sort(porOrden)
    .map((categoria) => ({
      categoria,
      hijas: visibles.filter((c) => c.padreId === categoria.id).sort(porOrden),
    }));
}

/** La categoría principal de una categoría o subcategoría. */
export function principal(categorias: Map<string, Categoria>, id: string): Categoria | undefined {
  const c = categorias.get(id);
  return c?.padreId ? (categorias.get(c.padreId) ?? c) : c;
}

/**
 * Completa `categoria` con la etiqueta de la categoría principal, que es como agrupa la previsión.
 * Lo que no tiene `categoriaId` (cargado antes de existir las categorías) conserva su texto.
 */
export function conCategoria<T extends { categoria?: string; categoriaId?: string }>(
  item: T,
  categorias: Map<string, Categoria>,
): T {
  const p = item.categoriaId ? principal(categorias, item.categoriaId) : undefined;
  return p ? { ...item, categoria: etiqueta(p) } : item;
}

/** "Alimentos › Supermercado" */
export function rutaCategoria(categorias: Map<string, Categoria>, id: string): string | undefined {
  const c = categorias.get(id);
  if (!c) return undefined;
  const padre = c.padreId ? categorias.get(c.padreId) : undefined;
  return padre ? `${etiqueta(padre)} › ${c.nombre}` : etiqueta(c);
}
