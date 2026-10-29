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
import { DetallePopup, type ContenidoDetalle } from "./detalle-popup";
import { pesos } from "./formato";
import { Ayuda, patrimonioDe, TOTALIZADORES } from "./totalizadores";

const BASE = "base";

/** Qué muestra la grilla: todo lo previsto, solo lo confirmado, o lo confirmado contra lo previsto. */
type Vista = "plan" | "real" | "comparar";
const VISTAS: { id: Vista; nombre: string }[] = [
  { id: "plan", nombre: "Planificado" },
  { id: "real", nombre: "Real" },
  { id: "comparar", nombre: "Real vs planificado" },
];

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
  /** Fecha de hoy: lo que resta de un presupuesto con tarjeta no se prevé si su resumen ya cerró. */
  hoy?: string;
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
  hoy,
  subcategorias = {},
}: Props) {
  const escenarios = useMemo(() => todos.filter((e) => e.estado === "activo"), [todos]);
  const [seleccionado, setSeleccionado] = useState(BASE);
  const [vista, setVista] = useState<Vista>("plan");

  const previsiones = useMemo(() => {
    const opciones = { desde, meses, mesActual, hoy };
    const visibles = (p: MesPrevision[]) => p.filter((m) => m.mes >= visibleDesde);
    const resultado: Record<string, MesPrevision[]> = { [BASE]: visibles(calcularPrevision(datos, opciones)) };
    for (const e of escenarios) {
      resultado[e.id] = visibles(calcularPrevision(aplicarEscenario(datos, todos, e.id), opciones));
    }
    return resultado;
  }, [datos, todos, escenarios, desde, meses, visibleDesde, mesActual, hoy]);
  // Solo lo confirmado: sin lo planificado, lo pendiente, lo que resta de presupuestos y objetivos ni
  // pagos automáticos. Es igual en todos los escenarios, que solo cambian lo planificado.
  const real = useMemo(
    () => calcularPrevision(datos, { desde, meses, mesActual, hoy, estados: ["real"] }).filter((m) => m.mes >= visibleDesde),
    [datos, desde, meses, visibleDesde, mesActual, hoy],
  );

  // Último mes con algo confirmado (por ejemplo, compras con tarjeta del período que cierra el mes que
  // viene): hasta ahí hay datos reales para mostrar.
  const hastaReal = real.reduce(
    (ultimo, m) => (m.ingresos || m.egresos || m.consumoTarjetas ? (m.mes > ultimo ? m.mes : ultimo) : ultimo),
    mesActual ?? visibleDesde,
  );

  const prevision = previsiones[seleccionado];
  const nombresCuentas = useMemo(() => Object.fromEntries(datos.cuentas.map((c) => [c.id, c.nombre])), [datos.cuentas]);
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

      <Resumen mes={prevision[0]} real={real[0]} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Qué ver">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={v.id === vista}
              onClick={() => setVista(v.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                v.id === vista
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              }`}
            >
              {v.nombre}
            </button>
          ))}
          <span className="text-xs text-black/60 dark:text-white/60">
            {vista === "plan"
              ? "Todo lo previsto: lo confirmado más ingresos y gastos programados, cuotas, presupuestos y objetivos de ahorro."
              : vista === "real"
                ? "Solo lo confirmado y conciliado: cómo están y estuvieron las cuentas de verdad."
                : "Arriba lo real, abajo lo planificado: cómo va cada mes contra el plan."}
          </span>
        </div>
        <Grilla
          prevision={
            vista === "plan" ? prevision : vista === "real" ? real.filter((m) => m.mes <= hastaReal) : real
          }
          plan={vista === "comparar" ? prevision : undefined}
          hastaReal={hastaReal}
          subcategorias={subcategorias}
          cuentas={nombresCuentas}
        />
      </div>
      <Balance plan={prevision} real={real} hastaReal={hastaReal} />
      {escenarios.length > 0 && <Comparacion previsiones={previsiones} opciones={opciones} />}
    </div>
  );
}

function Resumen({ mes, real }: { mes: MesPrevision; real: MesPrevision }) {
  // Las deudas se muestran en negativo, para leerlas igual que los saldos. Arriba lo real (lo que hay en
  // las cuentas con lo confirmado) y abajo cómo queda al cierre del mes con lo planificado.
  const tarjetas = [
    { ...TOTALIZADORES.patrimonio, valor: patrimonioDe },
    { ...TOTALIZADORES.disponible, valor: (m: MesPrevision) => m.disponible },
    { ...TOTALIZADORES.noInmediato, valor: (m: MesPrevision) => m.disponible48h },
    { ...TOTALIZADORES.reserva, valor: (m: MesPrevision) => m.reserva },
    { ...TOTALIZADORES.deudaTarjetas, valor: (m: MesPrevision) => -m.deudaTarjetas, nota: "resúmenes por pagar" },
    {
      ...TOTALIZADORES.deudaCuotas,
      valor: (m: MesPrevision) => -m.deudaCuotas,
      nota: `$ ${pesos(mes.cuotasDelMes)} se pagan este mes`,
    },
  ];
  return (
    <section>
      <h2 className="mb-3 text-sm text-black/60 dark:text-white/60">
        Real hoy y planificado al cierre de {nombreMes(mes.mes)}
        {mes.pendientes > 0 && (
          <span className="text-amber-600"> · {mes.pendientes} movimientos por confirmar (montos estimados)</span>
        )}
        {mes.impagoTarjetas > 0 && (
          <span className="text-red-600"> · $ {pesos(mes.impagoTarjetas)} de tarjeta vencido sin pagar</span>
        )}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tarjetas.map((t) => {
          const hoy = t.valor(real);
          const plan = t.valor(mes);
          const cambio = plan - hoy;
          return (
            <div key={t.titulo} className="rounded-xl border border-black/10 p-4 dark:border-white/15" title={t.ayuda}>
              <div className="flex items-center gap-1 text-sm text-black/60 dark:text-white/60">
                {t.titulo}
                <Ayuda texto={t.ayuda} />
              </div>
              <div
                className={`mt-1 text-xl font-semibold tabular-nums ${
                  hoy < 0 ? "text-red-600 dark:text-red-400" : hoy > 0 ? "text-green-700 dark:text-green-400" : ""
                }`}
                title="Real: con lo confirmado"
              >
                {conSigno(hoy)}
              </div>
              <div className="mt-1 text-sm tabular-nums text-sky-700 dark:text-sky-400" title="Planificado al cierre del mes">
                plan {conSigno(plan)}
                {cambio !== 0 && (
                  <span className="ml-1 text-xs">
                    ({cambio > 0 ? "+" : "−"}
                    {pesos(Math.abs(cambio))})
                  </span>
                )}
              </div>
              <div className="text-xs text-black/50 dark:text-white/50">{t.nota}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** "$ 1.234" o "−$ 1.234". */
function conSigno(centavos: number): string {
  return `${centavos < 0 ? "−" : ""}$ ${pesos(Math.abs(centavos))}`;
}

type PorCategoria = "ingresosPorCategoria" | "cuentasPorCategoria" | "tarjetaPorCategoria";
const CLAVES: Record<"ingreso" | "egreso" | "tarjeta", PorCategoria> = {
  ingreso: "ingresosPorCategoria",
  egreso: "cuentasPorCategoria",
  tarjeta: "tarjetaPorCategoria",
};

function categorias(prevision: MesPrevision[], clave: PorCategoria) {
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

function Grilla({
  prevision,
  plan,
  hastaReal,
  subcategorias,
  cuentas,
}: {
  prevision: MesPrevision[];
  /** Para comparar: lo planificado de cada mes, que se muestra debajo de lo de `prevision`. */
  plan?: MesPrevision[];
  /** Al comparar, los meses posteriores no tienen nada real todavía: solo se muestra lo planificado. */
  hastaReal?: Mes;
  subcategorias: Record<string, string>;
  /** Nombre de cada cuenta, para el detalle. */
  cuentas: Record<string, string>;
}) {
  const [detalle, setDetalle] = useState<ContenidoDetalle | null>(null);
  const sinReal = (m: MesPrevision) => Boolean(plan && hastaReal && m.mes > hastaReal);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const alternar = (clave: string) =>
    setAbiertas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  const ingresos = categorias(plan ?? prevision, "ingresosPorCategoria");
  const egresos = categorias(plan ?? prevision, "cuentasPorCategoria");
  const enTarjeta = categorias(plan ?? prevision, "tarjetaPorCategoria");
  const hayTarjetas = (plan ?? prevision).some((m) => m.consumoTarjetas || m.venceTarjetas || m.impagoTarjetas);
  /** Al comparar, lo planificado del mes `i` debajo del valor. */
  const debajo = (valor: (m: MesPrevision) => number, i: number) =>
    plan && (
      <div className="text-[11px] font-normal text-sky-700/80 dark:text-sky-400/80" title="Planificado">
        {valor(plan[i]) === 0 ? "–" : pesos(valor(plan[i]))}
      </div>
    );
  const presupuestos = [
    ...new Map((plan ?? prevision).flatMap((m) => m.presupuestos).map((p) => [p.id, p.nombre])),
  ];
  const objetivos = [
    ...new Map(
      (plan ?? prevision).flatMap((m) => m.objetivos).map((o) => [o.id, `${o.icono ? `${o.icono} ` : ""}${o.nombre}`]),
    ),
  ];

  const celda = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";
  const primera = "sticky left-0 bg-background px-3 py-1.5 text-left whitespace-nowrap";

  const fila = (
    titulo: string,
    valor: (m: MesPrevision) => number,
    clase = "",
    tono?: (v: number, i: number) => string,
    abrir?: () => void,
  ) => (
    <tr key={titulo} className={clase}>
      <th scope="row" className={`${primera} font-normal`}>
        {abrir ? (
          <button type="button" onClick={abrir} className="text-left hover:underline" title="Ver el detalle">
            {titulo}
          </button>
        ) : (
          titulo
        )}
      </th>
      {prevision.map((m, i) => {
        const v = valor(m);
        return (
          <td key={m.mes} className={`${celda} ${tono ? tono(v, i) : v < 0 ? "text-red-600" : ""}`}>
            {sinReal(m) ? "" : v === 0 ? "–" : pesos(v)}
            {debajo(valor, i)}
          </td>
        );
      })}
    </tr>
  );
  const filaCategoria = (tipo: "ingreso" | "egreso" | "tarjeta", c: string) => {
    const clave = CLAVES[tipo];
    const tono = tipo === "ingreso" ? "ingreso" : "egreso";
    const grupo = `${tipo}:${c}`;
    const conDetalle = prevision.some((m) => (m.detalle[grupo]?.length ?? 0) > 0);
    const abierta = abiertas.has(grupo);
    return (
      <Fragment key={grupo}>
      <tr>
        <th scope="row" className={`${primera} font-normal`}>
          {conDetalle ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => alternar(grupo)}
                aria-expanded={abierta}
                aria-label={abierta ? `Plegar ${c}` : `Desplegar ${c}`}
                className="w-3 text-xs text-black/50 dark:text-white/50"
              >
                {abierta ? "▾" : "▸"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setDetalle({
                    titulo: c,
                    meses: prevision.map((m) => ({
                      mes: m.mes,
                      movimientos: (m.detalle[grupo] ?? []).flatMap((item) => item.movimientos),
                    })),
                  })
                }
                className="text-left hover:underline"
                title="Ver las transacciones"
              >
                {c}
              </button>
            </span>
          ) : (
            <span className="pl-[1.125rem]">{c}</span>
          )}
        </th>
        {prevision.map((m, i) => {
          const v = m[clave][c] ?? 0;
          const info: Celda | undefined = m.celdas[`${tipo}:${c}`];
          return (
            <td key={m.mes} className={`${celda} ${info ? TONOS[tono][info.certeza] : ""}`}>
              {!sinReal(m) && (
                <span className={info?.cuotas ? `${MARCA_CUOTAS} px-1.5 py-0.5` : ""}>{v === 0 ? "–" : pesos(v)}</span>
              )}
              {debajo((x) => x[clave][c] ?? 0, i)}
            </td>
          );
        })}
      </tr>
      {abierta && filasDetalle(tono, grupo)}
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
              <button
                type="button"
                onClick={() =>
                  setDetalle({
                    titulo: f.item.nombre,
                    meses: prevision.map((m) => ({ mes: m.mes, movimientos: f.meses.get(m.mes)?.movimientos ?? [] })),
                  })
                }
                className={`text-left hover:underline ${subs.length > 1 && sub ? "pl-3" : ""}`}
                title="Ver las transacciones"
              >
                {f.item.nombre}
              </button>
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
  const azul = () => "text-sky-700 dark:text-sky-400";
  const signo = (v: number) => (v < 0 ? "text-red-600" : v > 0 ? "text-green-700 dark:text-green-400" : "");

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Previsión mes a mes</h2>
      {detalle && <DetallePopup contenido={detalle} cuentas={cuentas} alCerrar={() => setDetalle(null)} />}
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
            {fila(
              "↪ Sobrante del mes anterior",
              (m: MesPrevision) => m.sobranteAnterior,
              "italic",
              signo,
            )}
            {ingresos.map((c) => filaCategoria("ingreso", c))}
            {fila(
              "Total ingresos",
              (m: MesPrevision) => m.ingresos,
              total,
              verde,
            )}
            {separador("Gastos de las cuentas · débito, efectivo y billeteras")}
            {egresos.map((c) => filaCategoria("egreso", c))}
            {fila(
              "Subtotal gastos",
              (m: MesPrevision) => m.egresosCuentas,
              total,
              rojo,
            )}
            {hayTarjetas && (
              <tr>
                <th scope="row" className={`${primera} font-normal`} title="El resumen de la tarjeta que vence este mes: lo comprado el mes anterior">
                  ↘ Deuda TC período anterior
                </th>
                {prevision.map((m, i) => (
                  <td key={m.mes} className={`${celda} text-red-700 dark:text-red-400`}>
                    {sinReal(m) ? "" : m.venceTarjetas === 0 ? "–" : pesos(m.venceTarjetas)}
                    {debajo((x) => x.venceTarjetas, i)}
                  </td>
                ))}
              </tr>
            )}
            {hayTarjetas &&
              fila(
                "Total gastos del mes",
                (m: MesPrevision) => m.gastosDelMes,
                total,
                rojo,
              )}
            {fila(
              "Resultado del mes",
              (m: MesPrevision) => m.resultado,
              total,
              signo,
            )}
            {objetivos.length > 0 && (
              <>
                {separador("Ahorro e inversión")}
                {objetivos.map(([id, nombre]) => {
                  const de = (m: MesPrevision) => m.objetivos.find((o) => o.id === id);
                  return (
                    <Fragment key={id}>
                      {fila(
                        nombre,
                        (m: MesPrevision) => de(m)?.objetivo ?? 0,
                        "bg-sky-50 font-semibold dark:bg-sky-500/10",
                        azul,
                      )}
                      {fila(
                        "· transferido",
                        (m: MesPrevision) => de(m)?.hecho ?? 0,
                        "",
                        azul,
                      )}
                    </Fragment>
                  );
                })}
              </>
            )}
            <tr className="border-t-2 border-black/20 dark:border-white/25">
              <th scope="row" className={`${primera} py-2.5`}>
                <div className="text-base font-bold">Resto</div>
                <div className="text-xs font-normal text-black/50 dark:text-white/50">
                  sobrante anterior + resultado − ahorro · pasa al mes siguiente
                </div>
              </th>
              {prevision.map((m, i) => (
                <td
                  key={m.mes}
                  className={`${celda} py-2.5 text-base font-bold ${
                    m.resto < 0
                      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                      : "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                  }`}
                  title={m.resto < 0 ? "Faltó: queda como deuda para el mes siguiente" : "Sobró sin asignar"}
                >
                  {sinReal(m) ? "" : m.resto === 0 ? "–" : `${m.resto < 0 ? "−" : ""}${pesos(Math.abs(m.resto))}`}
                  {debajo((x) => x.resto, i)}
                </td>
              ))}
            </tr>
            {hayTarjetas && (
              <>
                {separador("Tarjetas de crédito · lo del mes se paga el mes siguiente")}
                {enTarjeta.map((c) => filaCategoria("tarjeta", c))}
                {fila(
                  "Total mensual TC",
                  (m: MesPrevision) => m.consumoTarjetas,
                  `${total} bg-amber-50 dark:bg-amber-500/10`,
                  () => "text-amber-700 dark:text-amber-400",
                )}
                {prevision.some((m) => m.impagoTarjetas > 0) &&
                  fila(
                    "Vencido sin pagar",
                    (m: MesPrevision) => -m.impagoTarjetas,
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
                    (m: MesPrevision) => de(m)?.monto ?? 0,
                    // Una línea arriba de cada presupuesto, para ver dónde termina el anterior.
                    "font-semibold [&>*]:border-t [&>*]:border-black/15 [&>*]:pt-3 dark:[&>*]:border-white/20",
                    undefined,
                    () =>
                      setDetalle({
                        titulo: `${nombre} (presupuesto)`,
                        meses: prevision.flatMap((m) => {
                          const p = de(m);
                          return p
                            ? [
                                {
                                  mes: m.mes,
                                  movimientos: p.movimientos,
                                  resumen: `Presupuesto $ ${pesos(p.monto)} · gastado $ ${pesos(p.gastado)} · ${
                                    p.resto < 0 ? `te pasaste $ ${pesos(-p.resto)}` : `resta $ ${pesos(p.resto)}`
                                  }`,
                                },
                              ]
                            : [];
                        }),
                      }),
                  )}
                  {fila(
                    "· gastado",
                    (m: MesPrevision) => de(m)?.gastado ?? 0,
                    "",
                    rojo,
                  )}
                  {fila(
                    "· resto",
                    (m: MesPrevision) => de(m)?.resto ?? 0,
                    "",
                    signo,
                  )}
                </Fragment>
              );
            })}
            {separador("Cuentas al cierre")}
            {fila(
              "Disponible",
              (m: MesPrevision) => m.disponible,
              "font-semibold",
              signo,
            )}
            {fila(
              "No inmediato",
              (m: MesPrevision) => m.disponible48h,
              "",
              signo,
            )}
            {fila(
              "Reserva",
              (m: MesPrevision) => m.reserva,
              "",
              signo,
            )}
            {fila(
              "Deuda tarjetas",
              (m: MesPrevision) => -m.deudaTarjetas,
              "",
              signo,
            )}
            {fila(
              "Deuda en cuotas",
              (m: MesPrevision) => -m.deudaCuotas,
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
          <span className={`${MARCA_CUOTA_DETALLE} px-1.5`}>3/18 123</span> cuota (tocá ▸ en una categoría para desplegarla, o su nombre
          o el de un presupuesto para ver las transacciones)
        </span>
        <span>
          Lo comprado con tarjeta va en su grupo, en el mes en que cierra su resumen (el período del 23/10 al 19/11 es
          noviembre). Se paga el mes siguiente: ahí aparece como deuda TC período anterior (↘) y resta del resto. El
          pago automático usa solo lo que hay en la cuenta de pago; lo que no alcanza queda como vencido sin pagar.
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

/** Lo que tenés menos lo que debés de tarjeta al cierre del mes. */
const balanceDe = (m: MesPrevision) => m.disponible + m.disponible48h + m.reserva - m.deudaTarjetas;

const SERIES = {
  plan: { nombre: "Planificado", clase: "stroke-[#2a78d6] dark:stroke-[#3987e5]", relleno: "fill-[#2a78d6] dark:fill-[#3987e5]" },
  real: { nombre: "Real", clase: "stroke-[#16a34a]", relleno: "fill-[#16a34a]" },
};

/** Balance al cierre de cada mes, planificado y real, con el detalle del mes al pasar el mouse. */
function Balance({ plan, real, hastaReal }: { plan: MesPrevision[]; real: MesPrevision[]; hastaReal: Mes }) {
  const [activo, setActivo] = useState<number | null>(null);
  const meses = plan.map((m) => m.mes);
  const valoresPlan = plan.map(balanceDe);
  const valoresReal = real.filter((m) => m.mes <= hastaReal).map(balanceDe);
  if (meses.length < 2) return null;

  const ancho = 720;
  const alto = 240;
  const margen = { arriba: 16, derecha: 16, abajo: 28, izquierda: 64 };
  const todos = [...valoresPlan, ...valoresReal, 0];
  const minimo = Math.min(...todos);
  const maximo = Math.max(...todos);
  const paso = escalon((maximo - minimo) / 4 || 1);
  const desdeY = Math.floor(minimo / paso) * paso;
  const hastaY = Math.ceil(maximo / paso) * paso || paso;
  const x = (i: number) => margen.izquierda + (i * (ancho - margen.izquierda - margen.derecha)) / (meses.length - 1);
  const y = (v: number) => margen.arriba + ((hastaY - v) * (alto - margen.arriba - margen.abajo)) / (hastaY - desdeY);
  const linea = (valores: number[]) => valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const marcas = Array.from({ length: Math.round((hastaY - desdeY) / paso) + 1 }, (_, i) => desdeY + i * paso);
  const compacto = (v: number) => {
    const p = Math.round(v / 100);
    const abs = Math.abs(p);
    const texto = abs >= 1_000_000 ? `${(abs / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M` : `${Math.round(abs / 1000)} mil`;
    return `${p < 0 ? "−" : ""}$ ${abs === 0 ? "0" : texto}`;
  };
  const columna = (ancho - margen.izquierda - margen.derecha) / (meses.length - 1);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Balance al cierre de cada mes</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Disponible + no inmediato + reserva, menos la deuda de tarjetas.
          </p>
        </div>
        <div className="flex gap-4 text-sm" aria-label="Referencias">
          <span className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden>
              <line x1="0" y1="4" x2="22" y2="4" strokeWidth="2" strokeDasharray="5 3" className={SERIES.plan.clase} />
            </svg>
            Planificado
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden>
              <line x1="0" y1="4" x2="22" y2="4" strokeWidth="2" className={SERIES.real.clase} />
            </svg>
            Real
          </span>
        </div>
      </div>
      <div className="relative rounded-xl border border-black/10 p-3 dark:border-white/15">
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          className="h-auto w-full"
          role="img"
          aria-label="Balance planificado y real al cierre de cada mes"
          onMouseLeave={() => setActivo(null)}
        >
          {marcas.map((v) => (
            <g key={v}>
              <line
                x1={margen.izquierda}
                x2={ancho - margen.derecha}
                y1={y(v)}
                y2={y(v)}
                className={v === 0 ? "stroke-black/40 dark:stroke-white/40" : "stroke-black/10 dark:stroke-white/10"}
                strokeDasharray={v === 0 ? undefined : "3 3"}
              />
              <text x={margen.izquierda - 8} y={y(v) + 4} textAnchor="end" className="fill-black/55 text-[11px] dark:fill-white/55">
                {compacto(v)}
              </text>
            </g>
          ))}
          {meses.map((m, i) => (
            <text key={m} x={x(i)} y={alto - 8} textAnchor="middle" className="fill-black/55 text-[11px] dark:fill-white/55">
              {nombreMes(m)}
            </text>
          ))}
          {activo !== null && (
            <line
              x1={x(activo)}
              x2={x(activo)}
              y1={margen.arriba}
              y2={alto - margen.abajo}
              className="stroke-black/30 dark:stroke-white/30"
            />
          )}
          <path d={linea(valoresPlan)} fill="none" strokeWidth={2} strokeDasharray="6 4" className={SERIES.plan.clase} />
          <path d={linea(valoresReal)} fill="none" strokeWidth={2} className={SERIES.real.clase} />
          {valoresPlan.map((v, i) => (
            <circle
              key={`p${i}`}
              cx={x(i)}
              cy={y(v)}
              r={activo === i ? 5 : 3.5}
              className={`${SERIES.plan.relleno} stroke-background`}
              strokeWidth={2}
            />
          ))}
          {valoresReal.map((v, i) => (
            <circle
              key={`r${i}`}
              cx={x(i)}
              cy={y(v)}
              r={activo === i ? 5 : 3.5}
              className={`${SERIES.real.relleno} stroke-background`}
              strokeWidth={2}
            />
          ))}
          {meses.map((m, i) => (
            <rect
              key={`h${m}`}
              x={x(i) - columna / 2}
              y={0}
              width={columna}
              height={alto}
              fill="transparent"
              onMouseEnter={() => setActivo(i)}
              onClick={() => setActivo(i)}
            />
          ))}
        </svg>
        {activo !== null && (
          <div
            className="pointer-events-none absolute top-3 rounded-lg border border-black/10 bg-background px-3 py-2 text-sm shadow-md dark:border-white/15"
            style={{
              left: `${(x(activo) / ancho) * 100}%`,
              transform: activo > meses.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <div className="font-medium">{nombreMes(meses[activo])}</div>
            <div className="tabular-nums">Planificado: {conSigno(valoresPlan[activo])}</div>
            <div className="tabular-nums">
              Real: {activo < valoresReal.length ? conSigno(valoresReal[activo]) : "todavía no"}
            </div>
          </div>
        )}
      </div>
      <details className="mt-2 text-sm text-black/60 dark:text-white/60">
        <summary className="cursor-pointer">Ver como tabla</summary>
        <table className="mt-2 text-sm tabular-nums">
          <thead>
            <tr>
              <th className="pr-6 text-left font-medium">Mes</th>
              <th className="pr-6 text-right font-medium">Planificado</th>
              <th className="text-right font-medium">Real</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m, i) => (
              <tr key={m}>
                <td className="pr-6">{nombreMes(m)}</td>
                <td className="pr-6 text-right">{conSigno(valoresPlan[i])}</td>
                <td className="text-right">{i < valoresReal.length ? conSigno(valoresReal[i]) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

/** Un paso redondo (1, 2 o 5 por una potencia de 10) cercano a `bruto`. */
function escalon(bruto: number): number {
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const relativo = bruto / potencia;
  return (relativo <= 1 ? 1 : relativo <= 2 ? 2 : relativo <= 5 ? 5 : 10) * potencia;
}
