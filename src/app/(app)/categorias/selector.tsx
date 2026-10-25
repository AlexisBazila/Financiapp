"use client";

import { useState, useTransition } from "react";
import { arbol, etiqueta, type Categoria, type TipoCategoria } from "@/lib/datos/categorias";
import { boton, botonSecundario, campo, etiqueta as claseEtiqueta } from "../../estilos";
import { crearCategoriaRapida } from "./acciones";
import { ICONOS } from "./opciones";

const NUEVA = "__nueva";

export function Punto({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-3 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Lista de categorías de un tipo, con sus subcategorías, y la opción de crear una nueva sin salir
 * del formulario. Envía `categoria_id`.
 */
export function SelectorCategoria({
  categorias,
  tipo,
  valorInicial = "",
  texto = "Categoría",
}: {
  categorias: Categoria[];
  tipo: TipoCategoria;
  valorInicial?: string;
  texto?: string;
}) {
  const [nuevas, setNuevas] = useState<Categoria[]>([]);
  const [valor, setValor] = useState(valorInicial);
  const [creando, setCreando] = useState(false);
  const todas = [...categorias, ...nuevas.filter((n) => !categorias.some((c) => c.id === n.id))];
  const ramas = arbol(todas, tipo);
  const elegida = todas.find((c) => c.id === valor);

  return (
    <>
      <label className={claseEtiqueta}>
        {texto}
        <span className="relative flex items-center">
          {elegida && <Punto color={elegida.color} className="pointer-events-none absolute left-3" />}
          <select
            name="categoria_id"
            value={valor}
            onChange={(e) => (e.target.value === NUEVA ? setCreando(true) : setValor(e.target.value))}
            className={`${campo} w-full ${elegida ? "pl-8" : ""}`}
          >
            <option value="">Sin categoría</option>
            {ramas.map(({ categoria, hijas }) => (
              <optgroup key={categoria.id} label={etiqueta(categoria)}>
                <option value={categoria.id}>{etiqueta(categoria)} (general)</option>
                {hijas.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.icono ? `${h.icono} ` : ""}
                    {h.nombre}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={NUEVA}>＋ Nueva categoría…</option>
          </select>
        </span>
      </label>
      {creando && (
        <NuevaCategoria
          tipo={tipo}
          principales={ramas.map((r) => r.categoria)}
          padreSugerido={elegida ? (elegida.padreId ?? elegida.id) : ""}
          alCrear={(c) => {
            setNuevas((n) => [...n, c]);
            setValor(c.id);
            setCreando(false);
          }}
          alCancelar={() => setCreando(false)}
        />
      )}
    </>
  );
}

function NuevaCategoria({
  tipo,
  principales,
  padreSugerido,
  alCrear,
  alCancelar,
}: {
  tipo: TipoCategoria;
  principales: Categoria[];
  padreSugerido: string;
  alCrear: (c: Categoria) => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [padreId, setPadreId] = useState(padreSugerido);
  const [icono, setIcono] = useState("");
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  function crear() {
    setError("");
    empezar(async () => {
      const r = await crearCategoriaRapida({ nombre, tipo, padreId: padreId || undefined, icono });
      if (r.categoria) alCrear(r.categoria);
      else setError(r.error ?? "No se pudo crear.");
    });
  }

  // Los campos no tienen `name`: no son parte del formulario que lo contiene.
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-black/20 p-3 sm:col-span-3 dark:border-white/25">
      <p className="text-sm font-medium">Nueva categoría de {tipo === "ingreso" ? "ingresos" : "gastos"}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className={claseEtiqueta}>
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                crear();
              }
            }}
            autoFocus
            className={campo}
          />
        </label>
        <label className={claseEtiqueta}>
          Dentro de
          <select value={padreId} onChange={(e) => setPadreId(e.target.value)} className={campo}>
            <option value="">Ninguna (categoría principal)</option>
            {principales.map((c) => (
              <option key={c.id} value={c.id}>
                {etiqueta(c)}
              </option>
            ))}
          </select>
        </label>
        <label className={claseEtiqueta}>
          Ícono
          <input
            value={icono}
            onChange={(e) => setIcono(e.target.value)}
            placeholder="🙂"
            className={`${campo} w-20 text-center`}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1">
        {ICONOS.slice(0, 24).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIcono(i)}
            className={`size-8 rounded-md text-lg hover:bg-black/5 dark:hover:bg-white/10 ${icono === i ? "bg-black/10 dark:bg-white/15" : ""}`}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={crear} disabled={pendiente || !nombre.trim()} className={boton}>
          Crear y elegir
        </button>
        <button type="button" onClick={alCancelar} className={botonSecundario}>
          Cancelar
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
