"use client";

import { useMemo, useState } from "react";
import { aplicarEscenario } from "@/lib/finanzas/escenarios";
import { nombreMes } from "@/lib/finanzas/fechas";
import { calcularPrevision, type MesPrevision } from "@/lib/finanzas/prevision";
import type { Datos, Escenario, Mes } from "@/lib/finanzas/tipos";
import { pesos } from "./formato";

const BASE = "base";

interface Props {
  datos: Datos;
  escenarios: Escenario[];
  /** Mes de los saldos iniciales: la previsión se calcula desde acá. */
  desde: Mes;
  meses: number;
  /** Primer mes que se muestra; por defecto, `desde`. */
  visibleDesde?: Mes;
}

export function VistaPrevision({ datos, escenarios: todos, desde, meses, visibleDesde = desde }: Props) {
  const escenarios = useMemo(() => todos.filter((e) => e.estado === "activo"), [todos]);
  const [seleccionado, setSeleccionado] = useState(BASE);

  const previsiones = useMemo(() => {
    const opciones = { desde, meses };
    const visibles = (p: MesPrevision[]) => p.filter((m) => m.mes >= visibleDesde);
    const resultado: Record<string, MesPrevision[]> = { [BASE]: visibles(calcularPrevision(datos, opciones)) };
    for (const e of escenarios) {
      resultado[e.id] = visibles(calcularPrevision(aplicarEscenario(datos, todos, e.id), opciones));
    }
    return resultado;
  }, [datos, todos, escenarios, desde, meses, visibleDesde]);

  const prevision = previsiones[seleccionado];
  const opciones = [{ id: BASE, nombre: "Plan base" }, ...escenarios];

  return (
    <div className="flex flex-col gap-8">
      {escenarios.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Escenario">
          {opciones.map((o) => (
            <button
              key={o.id}
              role="tab"
              aria-selected={o.id === seleccionado}
              onClick={() => setSeleccionado(o.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                o.id === seleccionado
                  ? "border-foreground bg-foreground text-background"
                  : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              }`}
            >
              {o.nombre}
            </button>
          ))}
        </div>
      )}

      <Resumen mes={prevision[0]} />
      <Grilla prevision={prevision} />
      {escenarios.length > 0 && <Comparacion previsiones={previsiones} opciones={opciones} />}
    </div>
  );
}

function Resumen({ mes }: { mes: MesPrevision }) {
  const tarjetas = [
    { titulo: "Disponible", valor: mes.disponible, nota: "para gastar ya" },
    { titulo: "En 48 h", valor: mes.disponible48h, nota: "inversiones rescatables" },
    { titulo: "Reserva", valor: mes.reserva, nota: "ahorro apartado" },
    { titulo: "Deuda tarjetas", valor: mes.deudaTarjetas, nota: "resúmenes por pagar" },
  ];
  return (
    <section>
      <h2 className="mb-3 text-sm text-black/60 dark:text-white/60">
        Al cierre de {nombreMes(mes.mes)}
        {mes.pendientes > 0 && (
          <span className="text-amber-600"> · {mes.pendientes} movimientos por confirmar (montos estimados)</span>
        )}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <div className="text-sm text-black/60 dark:text-white/60">{t.titulo}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${t.valor < 0 ? "text-red-600" : ""}`}>
              $ {pesos(t.valor)}
            </div>
            <div className="text-xs text-black/50 dark:text-white/50">{t.nota}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function categorias(prevision: MesPrevision[], clave: "ingresosPorCategoria" | "egresosPorCategoria") {
  const todas = new Set(prevision.flatMap((m) => Object.keys(m[clave])));
  const total = (c: string) => prevision.reduce((s, m) => s + (m[clave][c] ?? 0), 0);
  return [...todas].sort((a, b) => total(b) - total(a));
}

function Grilla({ prevision }: { prevision: MesPrevision[] }) {
  const ingresos = categorias(prevision, "ingresosPorCategoria");
  const egresos = categorias(prevision, "egresosPorCategoria");

  const celda = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";
  const primera = "sticky left-0 bg-background px-3 py-1.5 text-left whitespace-nowrap";

  const fila = (titulo: string, valores: number[], clase = "") => (
    <tr key={titulo} className={clase}>
      <th scope="row" className={`${primera} font-normal`}>
        {titulo}
      </th>
      {valores.map((v, i) => (
        <td key={i} className={`${celda} ${v < 0 ? "text-red-600" : ""}`}>
          {v === 0 ? "–" : pesos(v)}
        </td>
      ))}
    </tr>
  );
  const separador = (titulo: string) => (
    <tr key={`sep-${titulo}`}>
      <th
        colSpan={prevision.length + 1}
        className={`${primera} pt-4 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50`}
      >
        {titulo}
      </th>
    </tr>
  );
  const total = "border-t border-black/10 font-semibold dark:border-white/15";

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Previsión mes a mes</h2>
      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/15">
              <th className={`${primera} font-semibold`}>Concepto</th>
              {prevision.map((m) => (
                <th key={m.mes} className={`${celda} font-semibold`}>
                  {nombreMes(m.mes)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {separador("Ingresos")}
            {ingresos.map((c) =>
              fila(
                c,
                prevision.map((m) => m.ingresosPorCategoria[c] ?? 0),
              ),
            )}
            {fila(
              "Total ingresos",
              prevision.map((m) => m.ingresos),
              total,
            )}
            {separador("Egresos")}
            {egresos.map((c) =>
              fila(
                c,
                prevision.map((m) => m.egresosPorCategoria[c] ?? 0),
              ),
            )}
            {fila(
              "Total egresos",
              prevision.map((m) => m.egresos),
              total,
            )}
            {fila(
              "Resultado del mes",
              prevision.map((m) => m.neto),
              total,
            )}
            {separador("Cuentas al cierre")}
            {fila(
              "Disponible",
              prevision.map((m) => m.disponible),
              "font-semibold",
            )}
            {fila(
              "En 48 h",
              prevision.map((m) => m.disponible48h),
            )}
            {fila(
              "Reserva",
              prevision.map((m) => m.reserva),
            )}
            {fila(
              "Deuda tarjetas",
              prevision.map((m) => m.deudaTarjetas),
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-black/50 dark:text-white/50">
        Las compras con tarjeta cuentan el mes en que se paga el resumen.
      </p>
    </section>
  );
}

function Comparacion({
  previsiones,
  opciones,
}: {
  previsiones: Record<string, MesPrevision[]>;
  opciones: { id: string; nombre: string }[];
}) {
  const base = previsiones[BASE];
  const celda = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";
  const primera = "sticky left-0 bg-background px-3 py-1.5 text-left whitespace-nowrap";

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Comparar escenarios</h2>
      <p className="mb-3 text-sm text-black/60 dark:text-white/60">
        Disponible al cierre de cada mes y, debajo, la diferencia contra el plan base.
      </p>
      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/15">
              <th className={`${primera} font-semibold`}>Escenario</th>
              {base.map((m) => (
                <th key={m.mes} className={`${celda} font-semibold`}>
                  {nombreMes(m.mes)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opciones.map((o) => (
              <tr key={o.id} className="border-b border-black/5 last:border-0 dark:border-white/10">
                <th scope="row" className={`${primera} font-normal`}>
                  {o.nombre}
                </th>
                {previsiones[o.id].map((m, i) => {
                  const diferencia = m.disponible - base[i].disponible;
                  return (
                    <td key={m.mes} className={celda}>
                      <div className={m.disponible < 0 ? "text-red-600" : ""}>{pesos(m.disponible)}</div>
                      {o.id !== BASE && (
                        <div
                          className={`text-xs ${diferencia < 0 ? "text-red-600" : "text-black/50 dark:text-white/50"}`}
                        >
                          {diferencia === 0 ? "=" : `${diferencia > 0 ? "+" : ""}${pesos(diferencia)}`}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
