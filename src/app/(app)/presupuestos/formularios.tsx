"use client";

import { useActionState, useState } from "react";
import { arbol, etiqueta as conIcono, type Categoria } from "@/lib/datos/categorias";
import type { Presupuesto } from "@/lib/finanzas/tipos";
import { boton, campo, etiqueta } from "../../estilos";
import { pesosExactos } from "../../formato";
import { borrarPresupuesto, guardarPresupuesto } from "./acciones";

interface Opcion {
  id: string;
  nombre: string;
}

/** Categorías de gastos con casillas; marcar una categoría incluye sus subcategorías. */
function ElegirCategorias({ categorias, iniciales }: { categorias: Categoria[]; iniciales: string[] }) {
  const [elegidas, setElegidas] = useState(new Set(iniciales));
  const cambiar = (id: string, marcada: boolean) =>
    setElegidas((actual) => {
      const nuevo = new Set(actual);
      if (marcada) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });

  return (
    <fieldset className="flex flex-col gap-2 text-sm sm:col-span-3">
      <legend className="mb-1">Categorías que entran en el presupuesto</legend>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {arbol(categorias, "egreso").map(({ categoria, hijas }) => {
          const todaLaCategoria = elegidas.has(categoria.id);
          return (
            <div key={categoria.id} className="flex flex-col gap-1">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  name="categoria_ids"
                  value={categoria.id}
                  checked={todaLaCategoria}
                  onChange={(e) => cambiar(categoria.id, e.target.checked)}
                  className="size-4"
                />
                {conIcono(categoria)}
              </label>
              {hijas.map((h) => (
                <label key={h.id} className={`ml-6 flex items-center gap-2 ${todaLaCategoria ? "opacity-50" : ""}`}>
                  <input
                    type="checkbox"
                    name="categoria_ids"
                    value={h.id}
                    checked={todaLaCategoria || elegidas.has(h.id)}
                    disabled={todaLaCategoria}
                    onChange={(e) => cambiar(h.id, e.target.checked)}
                    className="size-4"
                  />
                  {conIcono(h)}
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Gastos de qué cuentas cuentan: todas, o las que se marquen. */
function ElegirCuentas({ cuentas, iniciales }: { cuentas: Opcion[]; iniciales?: string[] }) {
  const [algunas, setAlgunas] = useState(Boolean(iniciales));
  return (
    <fieldset className="flex flex-col gap-2 text-sm sm:col-span-3">
      <legend className="mb-1">Gastos que cuentan</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex items-center gap-2">
          <input type="radio" name="cuentas" value="todas" checked={!algunas} onChange={() => setAlgunas(false)} />
          De todas las cuentas
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="cuentas" value="algunas" checked={algunas} onChange={() => setAlgunas(true)} />
          Solo de algunas cuentas
        </label>
      </div>
      {algunas && (
        <div className="ml-6 flex flex-wrap gap-x-5 gap-y-2">
          {cuentas.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="cuenta_ids"
                value={c.id}
                defaultChecked={iniciales?.includes(c.id)}
                className="size-4"
              />
              {c.nombre}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function FormularioPresupuesto({
  cuentas,
  categorias,
  mesActual,
  inicial,
}: {
  cuentas: Opcion[];
  categorias: Categoria[];
  mesActual: string;
  inicial?: Presupuesto;
}) {
  const [estado, accion, pendiente] = useActionState(guardarPresupuesto.bind(null, inicial?.id ?? null), {});
  const [repite, setRepite] = useState(!inicial || inicial.hasta !== inicial.desde);

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-3">
      <div className="grid grid-cols-[5rem_1fr] gap-2">
        <label className={etiqueta}>
          Ícono
          <input name="icono" defaultValue={inicial?.icono} placeholder="🛒" className={`${campo} text-center`} />
        </label>
        <label className={etiqueta}>
          Nombre
          <input name="nombre" required maxLength={60} defaultValue={inicial?.nombre} placeholder="Víveres" className={campo} />
        </label>
      </div>
      <label className={etiqueta}>
        Monto por mes ($)
        <input
          name="monto"
          inputMode="decimal"
          required
          defaultValue={inicial ? pesosExactos(inicial.monto) : undefined}
          placeholder="1.200.000"
          className={campo}
        />
      </label>
      <label className={etiqueta}>
        Lo que resta sale de
        <select name="cuenta_id" required defaultValue={inicial?.cuentaId} className={campo}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        {repite ? "Desde" : "Mes"}
        <input name="desde" type="month" required defaultValue={inicial?.desde ?? mesActual} className={campo} />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input name="repite" type="checkbox" checked={repite} onChange={(e) => setRepite(e.target.checked)} className="size-4" />
        Se repite todos los meses
      </label>
      {repite && (
        <label className={etiqueta}>
          Hasta (opcional)
          <input name="hasta" type="month" defaultValue={inicial?.hasta} className={campo} />
        </label>
      )}
      <ElegirCategorias categorias={categorias} iniciales={inicial?.categoriaIds ?? []} />
      <ElegirCuentas cuentas={cuentas} iniciales={inicial?.cuentaIds} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pendiente || cuentas.length === 0} className={boton}>
          {inicial ? "Guardar cambios" : "Crear presupuesto"}
        </button>
        {inicial && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`¿Borrar el presupuesto "${inicial.nombre}"?`)) void borrarPresupuesto(inicial.id);
            }}
            className="text-sm text-red-600 hover:underline"
          >
            Borrar
          </button>
        )}
        {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
        {estado.ok && <p className="text-sm text-green-700 dark:text-green-400">Guardado.</p>}
      </div>
    </form>
  );
}
