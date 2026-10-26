"use client";

import { Fragment, useMemo, useState } from "react";
import { aplicarEscenario } from "@/lib/finanzas/escenarios";
import { nombreMes } from "@/lib/finanzas/fechas";
import {
  calcularPrevision,
  type Celda,
  type Certeza,
  type DetalleItem,
  type MesPrevision,
} from "@/lib/finanzas/prevision";
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
  /** Mes actual: lo que resta de los presupuestos se prevé desde acá. */
  mesActual?: Mes;
  /** Nombre (con emoji) de cada subcategoría, para el detalle de cada categoría. */
  subcategorias?: Record<string, string>;
}

export function VistaPrevision({
  datos,
  escenarios: todos,
  desde,
  meses,
  visibleDesde = desde,
  mesActual,
  subcategorias = {},
}: Props) {
  const escenarios = useMemo(() => todos.filter((e) => e.estado === "activo"), [todos]);
  const [seleccionado, setSeleccionado] = useState(BASE);

  const previsiones = useMemo(() => {
    const opciones = { desde, meses, mesActual };
    const visibles = (p: MesPrevision[]) => p.filter((m) => m.mes >= visibleDesde);
    const resultado: Record<string, MesPrevision[]> = { [BASE]: visibles(calcularPrevision(datos, opciones)) };
    for (const e of escenarios) {
      resultado[e.id] = visibles(calcularPrevision(aplicarEscenario(datos, todos, e.id), opciones));
    }
    return resultado;
  }, [datos, todos, escenarios, desde, meses, visibleDesde, mesActual]);

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
      <Grilla prevision={prevision} subcategorias={subcategorias} />
      {escenarios.length > 0 && <Comparacion previsiones={previsiones} opciones={opciones} />}
    </div>
  );
}

function Resumen({ mes }: { mes: MesPrevision }) {
  // Las deudas se muestran en negativo, para leerlas igual que los saldos.
  const tarjetas = [
    { titulo: "Disponible", valor: mes.disponible, nota: "para gastar ya" },
    { titulo: "No inmediato", valor: mes.disponible48h, nota: "FCI, dólares, plazo fijo" },
    { titulo: "Reserva", valor: mes.reserva, nota: "ahorro apartado" },
    { titulo: "Deuda tarjetas", valor: -mes.deudaTarjetas, nota: "resúmenes por pagar" },
    {
      titulo: "Deuda en cuotas",
      valor: -mes.deudaCuotas,
      nota: `al cierre · $ ${pesos(mes.cuotasDelMes)} se pagan este mes`,
    },
  ];
  return (
    <section>
      <h2 className="mb-3 text-sm text-black/60 dark:text-white/60">
        Al cierre de {nombreMes(mes.mes)}
        {mes.pendientes > 0 && (
          <span className="text-amber-600"> · {mes.pendientes} movimientos por confirmar (montos estimados)</span>
        )}
        {mes.impagoTarjetas > 0 && (
          <span className="text-red-600"> · $ {pesos(mes.impagoTarjetas)} de tarjeta vencido sin pagar</span>
        )}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <div className="text-sm text-black/60 dark:text-white/60">{t.titulo}</div>
            <div
              className={`mt-1 text-xl font-semibold tabular-nums ${
                t.valor < 0 ? "text-red-600 dark:text-red-400" : t.valor > 0 ? "text-green-700 dark:text-green-400" : ""
              }`}
            >
              {conSigno(t.valor)}
            </div>
            <div className="text-xs text-black/50 dark:text-white/50">{t.nota}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** "$ 1.234" o "−$ 1.234". */
function conSigno(centavos: number): string {
  return `${centavos < 0 ? "−" : ""}$ ${pesos(Math.abs(centavos))}`;
}

function categorias(prevision: MesPrevision[], clave: "ingresosPorCategoria" | "egresosPorCategoria") {
  const todas = new Set(prevision.flatMap((m) => Object.keys(m[clave])));
  const total = (c: string) => prevision.reduce((s, m) => s + (m[clave][c] ?? 0), 0);
  return [...todas].sort((a, b) => total(b) - total(a));
}

/** Verde para ingresos y rojo para gastos: más claro si no está confirmado, más oscuro si ya se concilió. */
const TONOS: Record<"ingreso" | "egreso", Record<Certeza, string>> = {
  ingreso: {
    planificado: "text-green-600/60 dark:text-green-400/60",
    real: "text-green-700 dark:text-green-400",
    conciliado: "font-semibold text-green-800 dark:text-green-300",
  },
  egreso: {
    planificado: "text-red-500/60 dark:text-red-400/60",
    real: "text-red-600 dark:text-red-400",
    conciliado: "font-semibold text-red-800 dark:text-red-300",
  },
};
const MARCA_CUOTAS = "rounded ring-1 ring-inset ring-violet-400/70 dark:ring-violet-400/50";

const MARCA_CUOTA_DETALLE = "rounded ring-1 ring-inset ring-amber-400";

function Grilla({ prevision, subcategorias }: { prevision: MesPrevision[]; subcategorias: Record<string, string> }) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const alternar = (clave: string) =>
    setAbiertas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  const ingresos = categorias(prevision, "ingresosPorCategoria");
  const egresos = categorias(prevision, "egresosPorCategoria");
  const presupuestos = [
    ...new Map(prevision.flatMap((m) => m.presupuestos).map((p) => [p.id, p.nombre])),
  ];

  const celda = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";
  const primera = "sticky left-0 bg-background px-3 py-1.5 text-left whitespace-nowrap";

  const fila = (
    titulo: string,
    valores: number[],
    clase = "",
    tono?: (v: number, i: number) => string,
  ) => (
    <tr key={titulo} className={clase}>
      <th scope="row" className={`${primera} font-normal`}>
        {titulo}
      </th>
      {valores.map((v, i) => (
        <td key={i} className={`${celda} ${tono ? tono(v, i) : v < 0 ? "text-red-600" : ""}`}>
          {v === 0 ? "–" : pesos(v)}
        </td>
      ))}
    </tr>
  );
  const filaCategoria = (tipo: "ingreso" | "egreso", c: string) => {
    const clave = tipo === "ingreso" ? "ingresosPorCategoria" : "egresosPorCategoria";
    const grupo = `${tipo}:${c}`;
    const conDetalle = prevision.some((m) => (m.detalle[grupo]?.length ?? 0) > 0);
    const abierta = abiertas.has(grupo);
    return (
      <Fragment key={grupo}>
      <tr>
        <th scope="row" className={`${primera} font-normal`}>
          {conDetalle ? (
            <button
              type="button"
              onClick={() => alternar(grupo)}
              aria-expanded={abierta}
              className="flex items-center gap-1.5 text-left hover:underline"
            >
              <span className="w-3 text-xs text-black/50 dark:text-white/50">{abierta ? "▾" : "▸"}</span>
              {c}
            </button>
          ) : (
            <span className="pl-[1.125rem]">{c}</span>
          )}
        </th>
        {prevision.map((m) => {
          const v = m[clave][c] ?? 0;
          const info: Celda | undefined = m.celdas[`${tipo}:${c}`];
          return (
            <td key={m.mes} className={`${celda} ${info ? TONOS[tipo][info.certeza] : ""}`}>
              <span className={info?.cuotas ? `${MARCA_CUOTAS} px-1.5 py-0.5` : ""}>{v === 0 ? "–" : pesos(v)}</span>
            </td>
          );
        })}
      </tr>
      {abierta && filasDetalle(tipo, grupo)}
      </Fragment>
    );
  };

  /** Cada compra, cuota o movimiento de una categoría, agrupados por subcategoría. */
  const filasDetalle = (tipo: "ingreso" | "egreso", grupo: string) => {
    const porClave = new Map<string, { item: DetalleItem; meses: Map<Mes, DetalleItem> }>();
    for (const m of prevision) {
      for (const item of m.detalle[grupo] ?? []) {
        const fila = porClave.get(item.clave) ?? { item, meses: new Map() };
        fila.meses.set(m.mes, item);
        porClave.set(item.clave, fila);
      }
    }
    const nombreSub = (item: DetalleItem) => (item.categoriaId && subcategorias[item.categoriaId]) || "";
    const total = (f: { meses: Map<Mes, DetalleItem> }) => [...f.meses.values()].reduce((s, i) => s + i.monto, 0);
    const filas = [...porClave.values()].sort(
      (a, b) => nombreSub(a.item).localeCompare(nombreSub(b.item), "es") || total(b) - total(a),
    );
    const subs = [...new Set(filas.map((f) => nombreSub(f.item)))];
    const sangria = "pl-9 text-xs";

    return subs.flatMap((sub) => {
      const delSub = filas.filter((f) => nombreSub(f.item) === sub);
      const subtotal =
        subs.length > 1 && sub ? (
          <tr key={`${grupo}:sub:${sub}`} className="bg-black/[0.02] dark:bg-white/[0.03]">
            <th scope="row" className={`${primera} ${sangria} font-medium`}>
              {sub}
            </th>
            {prevision.map((m) => {
              const v = delSub.reduce((s, f) => s + (f.meses.get(m.mes)?.monto ?? 0), 0);
              return (
                <td key={m.mes} className={`${celda} text-xs font-medium`}>
                  {v === 0 ? "–" : pesos(v)}
                </td>
              );
            })}
          </tr>
        ) : null;
      return [
        subtotal,
        ...delSub.map((f) => (
          <tr key={`${grupo}:${f.item.clave}`} className="bg-black/[0.02] dark:bg-white/[0.03]">
            <th scope="row" className={`${primera} ${sangria} font-normal`}>
              <span className={subs.length > 1 && sub ? "pl-3" : ""}>{f.item.nombre}</span>
              {sub && subs.length === 1 && <span className="ml-1.5 text-black/50 dark:text-white/50">· {sub}</span>}
            </th>
            {prevision.map((m) => {
              const item = f.meses.get(m.mes);
              return (
                <td key={m.mes} className={`${celda} text-xs ${item ? TONOS[tipo][item.certeza] : ""}`}>
                  {item ? (
                    <span
                      title={item.cuota ? `Cuota ${item.cuota}` : undefined}
                      className={item.cuota ? `${MARCA_CUOTA_DETALLE} px-1.5 py-0.5` : ""}
                    >
                      {item.cuota && <span className="mr-1 opacity-70">{item.cuota}</span>}
                      {pesos(item.monto)}
                    </span>
                  ) : (
                    "–"
                  )}
                </td>
              );
            })}
          </tr>
        )),
      ];
    });
  };
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
  const verde = () => "text-green-700 dark:text-green-400";
  const rojo = () => "text-red-700 dark:text-red-400";
  const signo = (v: number) => (v < 0 ? "text-red-600" : v > 0 ? "text-green-700 dark:text-green-400" : "");

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
            {ingresos.map((c) => filaCategoria("ingreso", c))}
            {fila(
              "Total ingresos",
              prevision.map((m) => m.ingresos),
              total,
              verde,
            )}
            {separador("Egresos")}
            {egresos.map((c) => filaCategoria("egreso", c))}
            {fila(
              "Total egresos",
              prevision.map((m) => m.egresos),
              total,
              rojo,
            )}
            {fila(
              "Resultado del mes",
              prevision.map((m) => m.neto),
              total,
              signo,
            )}
            {prevision.some((m) => m.consumoTarjetas || m.venceTarjetas || m.impagoTarjetas) && (
              <>
                {separador("Tarjetas de crédito")}
                {fila(
                  "Consumo del mes",
                  prevision.map((m) => m.consumoTarjetas),
                  "",
                  () => "text-amber-700 dark:text-amber-400",
                )}
                <tr>
                  <th scope="row" className={`${primera} font-normal`}>
                    Deuda del mes anterior
                  </th>
                  {prevision.map((m) => (
                    <td key={m.mes} className={`${celda} text-red-700 dark:text-red-400`}>
                      {m.venceTarjetas === 0 ? "–" : `↘ ${pesos(m.venceTarjetas)}`}
                    </td>
                  ))}
                </tr>
                {prevision.some((m) => m.impagoTarjetas > 0) &&
                  fila(
                    "Vencido sin pagar",
                    prevision.map((m) => -m.impagoTarjetas),
                    "font-semibold",
                  )}
              </>
            )}
            {presupuestos.length > 0 && separador("Presupuestos")}
            {presupuestos.map(([id, nombre]) => {
              const de = (m: MesPrevision) => m.presupuestos.find((p) => p.id === id);
              return (
                <Fragment key={id}>
                  {fila(
                    `${nombre} (presupuesto)`,
                    prevision.map((m) => de(m)?.monto ?? 0),
                    "font-semibold",
                  )}
                  {fila(
                    "· gastado",
                    prevision.map((m) => de(m)?.gastado ?? 0),
                    "",
                    rojo,
                  )}
                  {fila(
                    "· resto",
                    prevision.map((m) => de(m)?.resto ?? 0),
                    "",
                    signo,
                  )}
                </Fragment>
              );
            })}
            {separador("Cuentas al cierre")}
            {fila(
              "Disponible",
              prevision.map((m) => m.disponible),
              "font-semibold",
              signo,
            )}
            {fila(
              "No inmediato",
              prevision.map((m) => m.disponible48h),
              "",
              signo,
            )}
            {fila(
              "Reserva",
              prevision.map((m) => m.reserva),
              "",
              signo,
            )}
            {fila(
              "Deuda tarjetas",
              prevision.map((m) => -m.deudaTarjetas),
              "",
              signo,
            )}
            {fila(
              "Deuda en cuotas",
              prevision.map((m) => -m.deudaCuotas),
              "",
              signo,
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/60 dark:text-white/60">
        <span>
          <span className={TONOS.egreso.planificado}>■</span>
          <span className={TONOS.ingreso.planificado}>■</span> sin confirmar
        </span>
        <span>
          <span className={TONOS.egreso.real}>■</span>
          <span className={TONOS.ingreso.real}>■</span> confirmado
        </span>
        <span>
          <span className={TONOS.egreso.conciliado}>■</span>
          <span className={TONOS.ingreso.conciliado}>■</span> conciliado
        </span>
        <span>
          <span className={`${MARCA_CUOTAS} px-1.5`}>123</span> incluye cuotas
        </span>
        <span>
          <span className={`${MARCA_CUOTA_DETALLE} px-1.5`}>3/18 123</span> cuota (tocá ▸ en una categoría para ver el
          detalle)
        </span>
        <span>
          Lo consumido con tarjeta en un mes (↘) se paga el mes siguiente y ahí se cuenta en los egresos. El pago
          automático usa solo lo que hay en la cuenta de pago; lo que no alcanza queda como vencido sin pagar.
        </span>
      </div>
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
