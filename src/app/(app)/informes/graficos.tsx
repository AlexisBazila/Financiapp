"use client";

import { useState } from "react";
import { rebanadas, type Porcion, type Rebanada, type TipoGrafico } from "@/lib/finanzas/graficos";
import { nombreMes } from "@/lib/finanzas/fechas";
import type { Mes } from "@/lib/finanzas/tipos";
import { botonSecundario, caja, campo, etiqueta, textoSuave } from "../../estilos";
import { pesos } from "../../formato";

type Ver = TipoGrafico | "ambos";

const TITULOS: Record<TipoGrafico, string> = { gasto: "Gastos", ingreso: "Ingresos" };

/** Color de cada rebanada por su lugar (de mayor a menor); "Otros" va en gris. */
const color = (r: Rebanada, i: number) => (r.incluye ? "var(--serie-otros)" : `var(--serie-${i + 1})`);

const porcentaje = (parte: number, total: number) =>
  `${(total ? (parte / total) * 100 : 0).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;

/** Arco de una rebanada de dona, de `desde` a `hasta` (fracciones de la vuelta). */
function arco(desde: number, hasta: number, radio: number, interior: number): string {
  // Una sola rebanada: dos medias vueltas, porque un arco de 360° no se dibuja.
  if (hasta - desde >= 0.9999) return `${arco(0, 0.5, radio, interior)} ${arco(0.5, 1, radio, interior)}`;
  const punto = (f: number, r: number) => {
    const a = 2 * Math.PI * f - Math.PI / 2;
    return `${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`;
  };
  const grande = hasta - desde > 0.5 ? 1 : 0;
  return [
    `M ${punto(desde, radio)}`,
    `A ${radio} ${radio} 0 ${grande} 1 ${punto(hasta, radio)}`,
    `L ${punto(hasta, interior)}`,
    `A ${interior} ${interior} 0 ${grande} 0 ${punto(desde, interior)}`,
    "Z",
  ].join(" ");
}

interface Detalle {
  r: Rebanada;
  i: number;
  /** Dónde está el mouse sobre la torta; sin esto (desde la tabla) no se muestra el cartel. */
  x?: number;
  y?: number;
}

function Torta({
  titulo,
  lista,
  meses,
  alElegir,
}: {
  titulo: string;
  lista: Rebanada[];
  meses: number;
  /** Para abrir una categoría en sus subcategorías; sin esto las rebanadas no se pueden tocar. */
  alElegir?: (nombre: string) => void;
}) {
  const [marcada, setMarcada] = useState<Detalle | null>(null);
  const total = lista.reduce((s, r) => s + r.monto, 0);
  const elegible = (r: Rebanada) => Boolean(alElegir && !r.incluye);
  // Dónde empieza cada rebanada, como fracción de la vuelta.
  const inicios = lista.map((_, i) => lista.slice(0, i).reduce((s, r) => s + r.monto, 0) / total);

  return (
    <figure className={`${caja} @container flex min-w-0 flex-1 flex-col gap-4 p-4`}>
      <figcaption className="font-medium">{titulo}</figcaption>
      {lista.length === 0 ? (
        <p className={`text-sm ${textoSuave}`}>No hay movimientos con estos filtros.</p>
      ) : (
        <div className="flex flex-col items-center gap-5 @xl:flex-row @xl:items-start">
          <div className="relative w-56 shrink-0" onMouseLeave={() => setMarcada(null)}>
            <svg viewBox="-110 -110 220 220" role="img" aria-label={`${titulo}: total $ ${pesos(total)}`}>
              {lista.map((r, i) => {
                const desde = inicios[i];
                const hasta = inicios[i + 1] ?? 1;
                const activa = marcada?.r.nombre === r.nombre;
                return (
                  <path
                    key={r.nombre}
                    d={arco(desde, hasta, activa ? 104 : 100, 58)}
                    fill={color(r, i)}
                    stroke="var(--background)"
                    strokeWidth={lista.length > 1 ? 2 : 0}
                    strokeLinejoin="round"
                    opacity={marcada && !activa ? 0.45 : 1}
                    className={elegible(r) ? "cursor-pointer" : ""}
                    onMouseMove={(e) => {
                      const caja = e.currentTarget.ownerSVGElement!.parentElement!.getBoundingClientRect();
                      setMarcada({ r, i, x: e.clientX - caja.left, y: e.clientY - caja.top });
                    }}
                    onClick={() => elegible(r) && alElegir!(r.nombre)}
                  />
                );
              })}
              <text textAnchor="middle" y={-4} className="fill-current text-[11px] opacity-60">
                Total
              </text>
              <text textAnchor="middle" y={14} className="fill-current text-[15px] font-semibold tabular-nums">
                $ {pesos(total)}
              </text>
            </svg>
            {marcada?.x !== undefined && marcada.y !== undefined && (
              <div
                className="pointer-events-none absolute z-10 w-56 rounded-lg border border-black/10 bg-background p-3 text-xs shadow-lg dark:border-white/15"
                style={{ left: Math.max(-16, Math.min(marcada.x - 112, 16)), top: marcada.y + 16 }}
              >
                <InfoRebanada r={marcada.r} i={marcada.i} total={total} meses={meses} />
                {elegible(marcada.r) && <div className={`mt-2 ${textoSuave}`}>Tocá para ver sus subcategorías</div>}
              </div>
            )}
          </div>
          <table className="w-full min-w-0 text-sm">
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {lista.map((r, i) => (
                <tr
                  key={r.nombre}
                  onMouseEnter={() => setMarcada({ r, i })}
                  onMouseLeave={() => setMarcada(null)}
                  className={marcada && marcada.r.nombre !== r.nombre ? "opacity-60" : ""}
                >
                  <td className="py-1.5 pr-2">
                    <span className="flex items-center gap-2">
                      <span className="size-3 shrink-0 rounded-sm" style={{ background: color(r, i) }} />
                      {elegible(r) ? (
                        <button type="button" className="text-left hover:underline" onClick={() => alElegir!(r.nombre)}>
                          {r.nombre}
                        </button>
                      ) : (
                        <span title={r.incluye?.join(", ")}>{r.nombre}</span>
                      )}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right whitespace-nowrap tabular-nums">$ {pesos(r.monto)}</td>
                  <td className={`py-1.5 text-right whitespace-nowrap tabular-nums ${textoSuave}`}>
                    {porcentaje(r.monto, total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

function InfoRebanada({ r, i, total, meses }: { r: Rebanada; i: number; total: number; meses: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 font-medium">
        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: color(r, i) }} />
        {r.nombre}
      </div>
      <div className="flex justify-between gap-3">
        <span>$ {pesos(r.monto)}</span>
        <span className={textoSuave}>{porcentaje(r.monto, total)} del total</span>
      </div>
      {meses > 1 && <div className={textoSuave}>Promedio: $ {pesos(r.monto / meses)} por mes</div>}
      <div className={textoSuave}>
        {r.movimientos} {r.movimientos === 1 ? "movimiento" : "movimientos"}
        {r.previsto > 0 && ` · $ ${pesos(r.previsto)} todavía previsto`}
      </div>
      {r.incluye && <div className={textoSuave}>Incluye: {r.incluye.join(", ")}</div>}
    </div>
  );
}

export function GraficosInforme({ porciones, meses, actual }: { porciones: Porcion[]; meses: Mes[]; actual: Mes }) {
  const [ver, setVer] = useState<Ver>("gasto");
  const [categoria, setCategoria] = useState("");
  const [desde, setDesde] = useState(actual);
  const [hasta, setHasta] = useState(actual);
  const tipos: TipoGrafico[] = ver === "ambos" ? ["gasto", "ingreso"] : [ver];
  const [inicio, fin] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  const cantidad = meses.filter((m) => m >= inicio && m <= fin).length;
  const categorias = [
    ...new Set(
      porciones
        .filter((p) => tipos.includes(p.tipo) && p.mes >= inicio && p.mes <= fin && p.monto > 0)
        .map((p) => p.categoria),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const elegida = categorias.includes(categoria) ? categoria : "";

  return (
    <section className="flex flex-col gap-4 print:hidden">
      <div>
        <h2 className="text-lg font-semibold">Gráficos</h2>
        <p className={`text-sm ${textoSuave}`}>
          En qué se va (o de dónde viene) la plata. Pasá el mouse por una porción para ver el detalle; tocá una
          categoría para abrirla en sus subcategorías.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-1" role="radiogroup" aria-label="Qué mostrar">
          {(
            [
              ["gasto", "Gastos"],
              ["ingreso", "Ingresos"],
              ["ambos", "Ambos"],
            ] as const
          ).map(([valor, nombre]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={ver === valor}
              onClick={() => setVer(valor)}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                ver === valor
                  ? "border-foreground bg-foreground text-background"
                  : "border-black/15 dark:border-white/20"
              }`}
            >
              {nombre}
            </button>
          ))}
        </div>
        <label className={etiqueta}>
          Categoría
          <select value={elegida} onChange={(e) => setCategoria(e.target.value)} className={campo}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Desde
          <select value={desde} onChange={(e) => setDesde(e.target.value)} className={campo}>
            {meses.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Hasta
          <select value={hasta} onChange={(e) => setHasta(e.target.value)} className={campo}>
            {meses.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
                {m > actual ? " (previsto)" : ""}
              </option>
            ))}
          </select>
        </label>
        {elegida && (
          <button type="button" className={botonSecundario} onClick={() => setCategoria("")}>
            ← Todas las categorías
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        {tipos.map((tipo) => (
          <Torta
            key={`${tipo}-${elegida}`}
            titulo={`${TITULOS[tipo]}${elegida ? ` · ${elegida}` : " por categoría"}`}
            lista={rebanadas(porciones, { tipo, desde: inicio, hasta: fin, categoria: elegida || undefined })}
            meses={cantidad}
            alElegir={elegida ? undefined : setCategoria}
          />
        ))}
      </div>
    </section>
  );
}
