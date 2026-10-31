"use client";

import { useState } from "react";
import type { Categoria, TipoCategoria } from "@/lib/datos/categorias";
import { pesosACentavos } from "@/lib/datos/formularios";
import type { ParteMovimiento } from "@/lib/finanzas/tipos";
import { botonSecundario, campo, etiqueta } from "../../estilos";
import { pesosExactos } from "../../formato";
import { SelectorCategoria } from "../categorias/selector";

interface Fila {
  clave: number;
  categoriaId?: string;
  monto: string;
}

let siguiente = 0;
const nueva = (categoriaId?: string, monto = ""): Fila => ({ clave: siguiente++, categoriaId, monto });

/**
 * La categoría de un gasto o ingreso: una sola, o repartida en varias con un monto cada una (un ticket
 * con comida y limpieza). Envía `categoria_id` (una vez por parte) y, si se reparte, `repartir`,
 * `reparto_monto` por parte y `categoria_principal`: la que identifica al movimiento en la lista sin
 * sumar en ella.
 */
export function CategoriaOReparto({
  categorias,
  tipo,
  total,
  inicial,
  partesIniciales,
}: {
  categorias: Categoria[];
  tipo: TipoCategoria;
  /** Lo escrito en el monto del movimiento, para mostrar cuánto falta repartir. */
  total: string;
  inicial?: string;
  partesIniciales?: ParteMovimiento[];
}) {
  // Si la principal es la de la primera parte, no se eligió aparte.
  const principalInicial = partesIniciales?.length && inicial !== partesIniciales[0].categoriaId ? inicial : undefined;
  const [filas, setFilas] = useState<Fila[] | null>(() =>
    partesIniciales && partesIniciales.length > 1
      ? partesIniciales.map((p) => nueva(p.categoriaId, pesosExactos(p.original ?? p.monto)))
      : null,
  );

  if (!filas) {
    return (
      <div className="flex flex-col gap-1">
        <SelectorCategoria categorias={categorias} tipo={tipo} valorInicial={inicial} />
        <button
          type="button"
          onClick={() => setFilas([nueva(inicial), nueva()])}
          className="self-start text-xs underline opacity-70 hover:opacity-100"
        >
          Repartir en varias categorías
        </button>
      </div>
    );
  }

  const centavosTotal = pesosACentavos(total) ?? 0;
  const asignado = filas.reduce((t, f) => t + (pesosACentavos(f.monto) ?? 0), 0);
  const falta = centavosTotal - asignado;
  const cambiar = (clave: number, monto: string) =>
    setFilas(filas.map((f) => (f.clave === clave ? { ...f, monto } : f)));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-black/20 p-3 sm:col-span-3 dark:border-white/25">
      <input type="hidden" name="repartir" value="on" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Repartido en categorías</p>
        <p
          className={`text-sm tabular-nums ${falta === 0 ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}
        >
          {falta === 0
            ? "✓ Suma el total"
            : falta > 0
              ? `Falta asignar $ ${pesosExactos(falta)}`
              : `Te pasaste $ ${pesosExactos(-falta)}`}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <SelectorCategoria
          categorias={categorias}
          tipo={tipo}
          valorInicial={principalInicial}
          texto="Para identificarlo en la lista (no suma)"
          nombre="categoria_principal"
          sinElegir="La de la primera parte"
        />
        <p className="text-xs opacity-70">
          Solo el ícono y el nombre con que aparece, por ejemplo 🛒 Supermercado. Lo que cuenta en categorías y
          presupuestos son las partes de abajo.
        </p>
      </div>
      {filas.map((f, i) => (
        <div key={f.clave} className="grid grid-cols-[1fr_9rem_auto] items-end gap-2">
          <SelectorCategoria
            categorias={categorias}
            tipo={tipo}
            valorInicial={f.categoriaId}
            texto={`Categoría ${i + 1}`}
          />
          <label className={etiqueta}>
            Monto
            <input
              name="reparto_monto"
              inputMode="decimal"
              required
              placeholder="0"
              value={f.monto}
              onChange={(e) => cambiar(f.clave, e.target.value)}
              className={campo}
            />
          </label>
          <button
            type="button"
            aria-label="Quitar esta parte"
            disabled={filas.length <= 2}
            onClick={() => setFilas(filas.filter((x) => x.clave !== f.clave))}
            className="mb-2 rounded-lg px-2 text-lg leading-none hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilas([...filas, nueva()])} className={`${botonSecundario} text-xs`}>
          ＋ Otra categoría
        </button>
        {falta > 0 && filas.some((f) => !f.monto) && (
          <button
            type="button"
            onClick={() => {
              const vacia = filas.find((f) => !f.monto)!;
              cambiar(vacia.clave, pesosExactos(falta));
            }}
            className={`${botonSecundario} text-xs`}
          >
            Poner lo que falta ($ {pesosExactos(falta)})
          </button>
        )}
        <button type="button" onClick={() => setFilas(null)} className="text-xs underline opacity-70 hover:opacity-100">
          Volver a una sola categoría
        </button>
      </div>
    </div>
  );
}
