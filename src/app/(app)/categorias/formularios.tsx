"use client";

import { useActionState, useState } from "react";
import { etiqueta as nombreConIcono, type Categoria, type TipoCategoria } from "@/lib/datos/categorias";
import { boton, campo, etiqueta } from "../../estilos";
import { archivarCategoria, crearCategoria, editarCategoria, type Resultado } from "./acciones";
import { COLORES, ICONOS } from "./opciones";

function Mensaje({ estado }: { estado: Resultado }) {
  if (estado.error) return <p className="text-sm text-red-600">{estado.error}</p>;
  if (estado.ok) return <p className="text-sm text-green-700 dark:text-green-400">Guardado.</p>;
  return null;
}

function ElegirIcono({ inicial = "" }: { inicial?: string }) {
  const [icono, setIcono] = useState(inicial);
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <label className={etiqueta}>
        Ícono (un emoji)
        <input
          name="icono"
          value={icono}
          onChange={(e) => setIcono(e.target.value)}
          placeholder="🙂"
          className={`${campo} w-20 text-center`}
        />
      </label>
      <div className="flex flex-wrap gap-1">
        {ICONOS.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIcono(i)}
            aria-label={`Usar ${i}`}
            className={`size-8 rounded-md text-lg hover:bg-black/5 dark:hover:bg-white/10 ${icono === i ? "bg-black/10 dark:bg-white/15" : ""}`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

function ElegirColor({ inicial }: { inicial?: string }) {
  const [color, setColor] = useState(inicial ?? "");
  return (
    <fieldset className="flex flex-col gap-2 text-sm sm:col-span-2">
      <legend className="mb-1">Color {inicial ? "" : "(si no elegís, usa el de la categoría principal)"}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {COLORES.map((c) => (
          <label key={c} className="cursor-pointer">
            <input
              type="radio"
              name="color"
              value={c}
              checked={color === c}
              onChange={() => setColor(c)}
              className="peer sr-only"
            />
            <span
              className="block size-7 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2"
              style={{ backgroundColor: c }}
              title={c}
            />
          </label>
        ))}
        <label className="flex items-center gap-1 text-xs">
          otro
          <input
            type="color"
            value={color || "#64748b"}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
          />
        </label>
        {color && !COLORES.includes(color) && <input type="hidden" name="color" value={color} />}
      </div>
    </fieldset>
  );
}

function ElegirPadre({ principales, inicial = "" }: { principales: Categoria[]; inicial?: string }) {
  return (
    <label className={etiqueta}>
      Dentro de
      <select name="padre_id" defaultValue={inicial} className={campo}>
        <option value="">Ninguna (categoría principal)</option>
        {principales.map((c) => (
          <option key={c.id} value={c.id}>
            {nombreConIcono(c)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormularioCategoria({
  tipo,
  principales,
}: {
  tipo: TipoCategoria;
  principales: Categoria[];
}) {
  const [estado, accion, pendiente] = useActionState(crearCategoria, {});
  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tipo" value={tipo} />
      <label className={etiqueta}>
        Nombre
        <input name="nombre" required maxLength={60} className={campo} />
      </label>
      <ElegirPadre principales={principales} />
      <ElegirIcono />
      <ElegirColor />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pendiente} className={boton}>
          Agregar categoría
        </button>
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

export function EditarCategoria({ categoria, principales }: { categoria: Categoria; principales: Categoria[] }) {
  const [estado, accion, pendiente] = useActionState(editarCategoria.bind(null, categoria.id), {});
  return (
    <details className="text-sm open:w-full">
      <summary className="cursor-pointer text-black/60 hover:underline dark:text-white/60">Editar</summary>
      <form action={accion} className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className={etiqueta}>
          Nombre
          <input name="nombre" required maxLength={60} defaultValue={categoria.nombre} className={campo} />
        </label>
        <ElegirPadre
          principales={principales.filter((p) => p.id !== categoria.id)}
          inicial={categoria.padreId ?? ""}
        />
        <ElegirIcono inicial={categoria.icono} />
        <ElegirColor inicial={categoria.color} />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pendiente} className={boton}>
            Guardar cambios
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                categoria.archivada ||
                confirm(`¿Archivar "${categoria.nombre}"? Deja de aparecer al cargar; lo ya registrado no cambia.`)
              ) {
                void archivarCategoria(categoria.id, !categoria.archivada);
              }
            }}
            className="text-sm text-red-600 hover:underline"
          >
            {categoria.archivada ? "Volver a usar" : "Archivar"}
          </button>
          <Mensaje estado={estado} />
        </div>
      </form>
    </details>
  );
}
