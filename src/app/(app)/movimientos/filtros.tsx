import Link from "next/link";
import { arbol, etiqueta as conIcono, type Categoria } from "@/lib/datos/categorias";
import type { Movimiento, Presupuesto } from "@/lib/finanzas/tipos";
import { botonSecundario, campo, etiqueta } from "../../estilos";

/** Filtros de la lista de movimientos, como vienen en la URL. */
export interface Filtros {
  /** Id de una categoría (incluye sus subcategorías) o `grupo:<id de presupuesto>`. */
  cat?: string;
  tipo?: string;
  /** Comercio o persona. */
  a?: string;
  /** Texto en la descripción. */
  q?: string;
  /** "si": confirmados; "no": sin confirmar. */
  confirmado?: string;
  /** "si": conciliados; "no": sin conciliar. */
  conciliado?: string;
}

const CLAVES = ["cat", "tipo", "a", "q", "confirmado", "conciliado"] as const;

export function leerFiltros(params: Record<string, string | string[] | undefined>): Filtros {
  const filtros: Filtros = {};
  for (const clave of CLAVES) {
    const valor = params[clave];
    if (typeof valor === "string" && valor.trim()) filtros[clave] = valor.trim();
  }
  return filtros;
}

export const hayFiltros = (f: Filtros) => CLAVES.some((c) => f[c]);

/** Sin mayúsculas ni tildes, para buscar texto. */
const normal = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function filtrar(
  lista: Movimiento[],
  f: Filtros,
  categorias: Categoria[],
  presupuestos: Presupuesto[],
): Movimiento[] {
  let elegidas: Set<string> | undefined;
  if (f.cat?.startsWith("grupo:")) {
    elegidas = new Set(presupuestos.find((p) => p.id === f.cat!.slice(6))?.categoriaIds ?? []);
  } else if (f.cat) {
    elegidas = new Set([f.cat, ...categorias.filter((c) => c.padreId === f.cat).map((c) => c.id)]);
  }
  const contraparte = f.a && normal(f.a);
  const texto = f.q && normal(f.q);
  return lista.filter(
    (m) =>
      (!elegidas || (m.categoriaId !== undefined && elegidas.has(m.categoriaId))) &&
      (!f.tipo || m.tipo === f.tipo) &&
      (!contraparte || normal(m.contraparte ?? "").includes(contraparte)) &&
      (!texto || normal(m.descripcion).includes(texto)) &&
      (!f.confirmado || (f.confirmado === "si") === (m.estado === "real")) &&
      (!f.conciliado || (f.conciliado === "si") === Boolean(m.estado === "real" && m.conciliado)),
  );
}

/** Formulario de filtros: se aplican al tocar Filtrar y quedan en la URL. */
export function FormularioFiltros({
  filtros,
  mes,
  categorias,
  presupuestos,
  contrapartes,
}: {
  filtros: Filtros;
  mes: string;
  categorias: Categoria[];
  presupuestos: Presupuesto[];
  contrapartes: string[];
}) {
  return (
    <details className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15" open={hayFiltros(filtros)}>
      <summary className="cursor-pointer font-medium">
        Filtros{hayFiltros(filtros) && <span className="ml-2 text-sky-700 dark:text-sky-400">· activos</span>}
      </summary>
      <form method="get" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="mes" value={mes} />
        <label className={etiqueta}>
          Categoría
          <select name="cat" defaultValue={filtros.cat ?? ""} className={campo}>
            <option value="">Todas</option>
            {presupuestos.length > 0 && (
              <optgroup label="Grupos (presupuestos)">
                {presupuestos.map((p) => (
                  <option key={p.id} value={`grupo:${p.id}`}>
                    {p.icono} {p.nombre}
                  </option>
                ))}
              </optgroup>
            )}
            {(["egreso", "ingreso"] as const).map((tipo) => (
              <optgroup key={tipo} label={tipo === "egreso" ? "Gastos" : "Ingresos"}>
                {arbol(categorias, tipo).flatMap(({ categoria, hijas }) => [
                  <option key={categoria.id} value={categoria.id}>
                    {conIcono(categoria)}
                    {hijas.length > 0 ? " (toda)" : ""}
                  </option>,
                  ...hijas.map((h) => (
                    <option key={h.id} value={h.id}>
                      {"   "}↳ {conIcono(h)}
                    </option>
                  )),
                ])}
              </optgroup>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Tipo
          <select name="tipo" defaultValue={filtros.tipo ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="egreso">Solo gastos</option>
            <option value="ingreso">Solo ingresos</option>
            <option value="transferencia">Solo transferencias</option>
          </select>
        </label>
        <label className={etiqueta}>
          Pagado a / cobrado de
          <input name="a" list="filtro-contrapartes" defaultValue={filtros.a} placeholder="Bercomat" className={campo} />
          <datalist id="filtro-contrapartes">
            {contrapartes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className={etiqueta}>
          Descripción
          <input name="q" type="search" defaultValue={filtros.q} placeholder="Supermercado" className={campo} />
        </label>
        <label className={etiqueta}>
          Confirmado
          <select name="confirmado" defaultValue={filtros.confirmado ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="si">Confirmados</option>
            <option value="no">Sin confirmar</option>
          </select>
        </label>
        <label className={etiqueta}>
          Conciliado
          <select name="conciliado" defaultValue={filtros.conciliado ?? ""} className={campo}>
            <option value="">Todos</option>
            <option value="si">Conciliados</option>
            <option value="no">Sin conciliar</option>
          </select>
        </label>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
          <button type="submit" className={botonSecundario}>
            Filtrar
          </button>
          {hayFiltros(filtros) && (
            <Link href={`?mes=${mes}`} className="text-sm underline">
              Quitar filtros
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}
