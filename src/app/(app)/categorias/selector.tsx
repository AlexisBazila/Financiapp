"use client";

import { useId, useState, useTransition } from "react";
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

/** Sin tildes ni mayúsculas, para buscar "limpieza" con "LIMPI" o "cafe" con "Café". */
const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

interface Opcion {
  id: string;
  /** Lo que se muestra en la lista. */
  texto: string;
  /** Lo que se muestra en el campo una vez elegida. */
  elegida: string;
  color?: string;
  hija?: boolean;
  /** Texto donde se busca. */
  busqueda: string;
}

/**
 * Categoría de un tipo, con sus subcategorías: se elige tecleando para filtrar la lista, y se puede
 * crear una nueva sin salir del formulario. Envía `categoria_id` (o el `nombre` que se le pase).
 */
export function SelectorCategoria({
  categorias,
  tipo,
  valorInicial = "",
  texto = "Categoría",
  nombre = "categoria_id",
  sinElegir = "Sin categoría",
}: {
  categorias: Categoria[];
  tipo: TipoCategoria;
  valorInicial?: string;
  texto?: string;
  nombre?: string;
  /** Qué significa no elegir ninguna. */
  sinElegir?: string;
}) {
  const [nuevas, setNuevas] = useState<Categoria[]>([]);
  const [valor, setValor] = useState(valorInicial);
  const [creando, setCreando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState("");
  const [consulta, setConsulta] = useState<string | null>(null);
  const [marcada, setMarcada] = useState(0);
  const lista = useId();
  const todas = [...categorias, ...nuevas.filter((n) => !categorias.some((c) => c.id === n.id))];
  const ramas = arbol(todas, tipo);
  const elegida = todas.find((c) => c.id === valor);

  const opciones: Opcion[] = [{ id: "", texto: sinElegir, elegida: "", busqueda: "sin categoria" }];
  for (const { categoria, hijas } of ramas) {
    opciones.push({
      id: categoria.id,
      texto: etiqueta(categoria),
      elegida: etiqueta(categoria),
      color: categoria.color,
      busqueda: normalizar(categoria.nombre),
    });
    for (const h of hijas) {
      opciones.push({
        id: h.id,
        texto: etiqueta(h),
        elegida: `${etiqueta(h)} · ${categoria.nombre}`,
        color: h.color,
        hija: true,
        busqueda: normalizar(`${h.nombre} ${categoria.nombre}`),
      });
    }
  }
  const palabras = normalizar(consulta ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const visibles = [
    ...opciones.filter((o) => palabras.every((p) => o.busqueda.includes(p))),
    {
      id: NUEVA,
      texto: consulta ? `＋ Crear "${consulta.trim()}"…` : "＋ Nueva categoría…",
      elegida: "",
      busqueda: "",
    },
  ];
  const abierta = consulta !== null;
  const actual = Math.min(marcada, visibles.length - 1);
  const textoElegida = opciones.find((o) => o.id === valor)?.elegida ?? "";

  function elegir(o: Opcion) {
    if (o.id === NUEVA) {
      setNombreNueva(consulta?.trim() ?? "");
      setCreando(true);
    } else setValor(o.id);
    setConsulta(null);
  }

  return (
    <>
      <div className={claseEtiqueta}>
        <label htmlFor={`${lista}-campo`}>{texto}</label>
        <input type="hidden" name={nombre} value={valor} />
        <div className="relative flex items-center">
          {elegida && !abierta && <Punto color={elegida.color} className="pointer-events-none absolute left-3" />}
          <input
            id={`${lista}-campo`}
            role="combobox"
            aria-expanded={abierta}
            aria-controls={lista}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={abierta ? "Buscar…" : sinElegir}
            value={abierta ? consulta : textoElegida}
            onFocus={() => {
              setConsulta("");
              setMarcada(0);
            }}
            onBlur={() => setConsulta(null)}
            onChange={(e) => {
              setConsulta(e.target.value);
              setMarcada(0);
            }}
            onKeyDown={(e) => {
              if (!abierta) return;
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const paso = e.key === "ArrowDown" ? 1 : -1;
                setMarcada((actual + paso + visibles.length) % visibles.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                elegir(visibles[actual]);
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className={`${campo} w-full ${elegida && !abierta ? "pl-8" : ""}`}
          />
          {abierta && (
            <ul
              id={lista}
              role="listbox"
              className="absolute top-full right-0 left-0 z-40 mt-1 max-h-64 overflow-auto rounded-lg border border-black/15 bg-background py-1 shadow-lg dark:border-white/20"
            >
              {visibles.map((o, i) => (
                <li
                  key={o.id || "ninguna"}
                  role="option"
                  aria-selected={i === actual}
                  // mousedown para elegir antes de que el campo pierda el foco y cierre la lista.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(o);
                    (document.activeElement as HTMLElement | null)?.blur();
                  }}
                  onMouseEnter={() => setMarcada(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                    i === actual ? "bg-black/5 dark:bg-white/10" : ""
                  } ${o.hija ? "pl-8" : ""} ${o.id === valor ? "font-medium" : ""}`}
                >
                  {o.color && !o.hija && <Punto color={o.color} />}
                  <span>{o.texto}</span>
                  {o.hija && palabras.length > 0 && (
                    <span className="text-xs opacity-60">{o.elegida.split(" · ").at(-1)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {creando && (
        <NuevaCategoria
          tipo={tipo}
          nombreInicial={nombreNueva}
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
  nombreInicial,
  principales,
  padreSugerido,
  alCrear,
  alCancelar,
}: {
  tipo: TipoCategoria;
  nombreInicial: string;
  principales: Categoria[];
  padreSugerido: string;
  alCrear: (c: Categoria) => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
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
