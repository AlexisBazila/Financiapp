// Lista de movimientos de un mes, separados por día. La usan Movimientos y la página de cada cuenta.

import Link from "next/link";
import { Fragment } from "react";
import { rutaCategoria, type Categoria } from "@/lib/datos/categorias";
import { sumarMeses } from "@/lib/finanzas/fechas";
import type { Movimiento } from "@/lib/finanzas/tipos";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { Punto } from "../categorias/selector";
import { AccionesMovimiento, type Opciones } from "./formularios";

export const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function tituloMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const nombre = new Date(anio, m - 1, 1).toLocaleDateString("es-AR", { month: "long" });
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

/** "Viernes, 9 de octubre" */
function tituloDia(fecha: string): string {
  const texto = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;
}

/** ‹ Octubre 2026 › */
export function SelectorMes({
  mes,
  actual,
  ruta,
  consulta = "",
}: {
  mes: string;
  actual: string;
  ruta: string;
  /** Otros parámetros de la URL que se mantienen al cambiar de mes, como "&tipo=egreso". */
  consulta?: string;
}) {
  const flecha =
    "rounded-lg border border-black/15 px-3 py-1.5 text-lg leading-none hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";
  return (
    <nav className="flex flex-wrap items-center gap-3" aria-label="Mes">
      <Link href={`${ruta}?mes=${sumarMeses(mes, -1)}${consulta}`} className={flecha} aria-label="Mes anterior">
        ‹
      </Link>
      <h2 className="min-w-40 text-center text-lg font-semibold">{tituloMes(mes)}</h2>
      <Link href={`${ruta}?mes=${sumarMeses(mes, 1)}${consulta}`} className={flecha} aria-label="Mes siguiente">
        ›
      </Link>
      {mes !== actual && (
        <Link href={ruta} className={`text-sm underline ${textoSuave}`}>
          Volver a este mes
        </Link>
      )}
    </nav>
  );
}

/** Cómo está un movimiento: sin confirmar, confirmado o conciliado con el banco. */
function situacion(m: Pick<Movimiento, "estado" | "conciliado">) {
  if (m.estado !== "real") {
    return {
      texto: m.estado === "pendiente" ? "Por confirmar" : "Sin confirmar",
      chip: "bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70",
    };
  }
  if (!m.conciliado) {
    return { texto: "Sin conciliar", chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" };
  }
  return { texto: "Conciliado ✓", chip: "bg-black/80 text-white dark:bg-white/85 dark:text-black" };
}

const CHIP_CUOTA = "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300";

function Chip({ children, clase }: { children: React.ReactNode; clase: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${clase}`}>{children}</span>;
}

/**
 * +1 si entra plata, -1 si sale, 0 si es una transferencia vista desde todas las cuentas.
 * Desde una cuenta, una transferencia suma si llega a ella y resta si sale.
 */
export function signo(m: Movimiento, cuentaId?: string): number {
  if (m.tipo === "ingreso") return 1;
  if (m.tipo === "egreso") return -1;
  if (!cuentaId) return 0;
  return m.cuentaId === cuentaId ? -1 : 1;
}

/** Color del monto y del borde: verde si entra, rojo si sale; más claro si no está confirmado. */
function colores(s: number, confirmado: boolean) {
  if (s > 0) {
    return confirmado
      ? { monto: "text-green-700 dark:text-green-400", borde: "border-r-green-600" }
      : { monto: "text-green-600/60 dark:text-green-400/60", borde: "border-r-green-500/40" };
  }
  if (s < 0) {
    return confirmado
      ? { monto: "text-red-700 dark:text-red-400", borde: "border-r-red-600" }
      : { monto: "text-red-500/60 dark:text-red-400/60", borde: "border-r-red-500/40" };
  }
  return confirmado
    ? { monto: "text-sky-700 dark:text-sky-400", borde: "border-r-sky-500" }
    : { monto: "text-sky-600/60 dark:text-sky-400/60", borde: "border-r-sky-500/40" };
}

export function Leyenda() {
  return (
    <details className={`text-sm ${textoSuave}`}>
      <summary className="cursor-pointer">¿Qué significa cada color y estado?</summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        <li>
          <span className="font-semibold text-green-700 dark:text-green-400">Verde</span> entra plata,{" "}
          <span className="font-semibold text-red-700 dark:text-red-400">rojo</span> sale,{" "}
          <span className="font-semibold text-sky-700 dark:text-sky-400">celeste</span> se mueve entre tus cuentas. Más
          claro si todavía no está confirmado.
        </li>
        <li>
          <Chip clase={situacion({ estado: "planificado" }).chip}>Sin confirmar</Chip> Planificado: la previsión lo
          cuenta, pero todavía no pasó.
        </li>
        <li>
          <Chip clase={situacion({ estado: "real" }).chip}>Sin conciliar</Chip> Ya pasó, falta chequearlo con el
          resumen del banco o la tarjeta.
        </li>
        <li>
          <Chip clase={situacion({ estado: "real", conciliado: true }).chip}>Conciliado ✓</Chip> Ya pasó y coincide con
          el banco.
        </li>
        <li>
          <Chip clase={CHIP_CUOTA}>Cuota 3/12</Chip> Cuota de una compra o un préstamo, en cualquier estado.
        </li>
      </ul>
    </details>
  );
}

export function ListaMovimientos({
  lista,
  nombres,
  categorias,
  guardados,
  opciones,
  cuentaId,
  vacio,
}: {
  lista: Movimiento[];
  nombres: Map<string, string>;
  categorias: Map<string, Categoria>;
  guardados: Set<string>;
  opciones: Opciones;
  /** Si es la lista de una cuenta: las transferencias suman o restan según el sentido. */
  cuentaId?: string;
  vacio: string;
}) {
  if (lista.length === 0) return <p className={textoSuave}>{vacio}</p>;

  const dias = new Map<string, Movimiento[]>();
  for (const m of lista) dias.set(m.fecha, [...(dias.get(m.fecha) ?? []), m]);

  return (
    <ul className={`${caja} overflow-hidden`}>
      {[...dias].map(([fecha, delDia]) => {
        const neto = delDia.reduce((total, m) => total + signo(m, cuentaId) * m.monto, 0);
        return (
          <Fragment key={fecha}>
            <li className="flex items-center justify-between gap-3 border-b border-black/5 bg-black/[0.04] px-4 py-1.5 text-sm font-medium dark:border-white/10 dark:bg-white/[0.06]">
              <span>{tituloDia(fecha)}</span>
              {neto !== 0 && (
                <span
                  className={`text-xs tabular-nums ${neto > 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
                >
                  {neto > 0 ? "+" : "−"}$ {pesosExactos(Math.abs(neto))}
                </span>
              )}
            </li>
            {delDia.map((m) => (
              <Fila
                key={m.id}
                m={m}
                nombres={nombres}
                categorias={categorias}
                guardado={guardados.has(m.id)}
                opciones={opciones}
                cuentaId={cuentaId}
              />
            ))}
          </Fragment>
        );
      })}
    </ul>
  );
}

function Fila({
  m,
  nombres,
  categorias,
  guardado,
  opciones,
  cuentaId,
}: {
  m: Movimiento;
  nombres: Map<string, string>;
  categorias: Map<string, Categoria>;
  guardado: boolean;
  opciones: Opciones;
  cuentaId?: string;
}) {
  const estado = situacion(m);
  const s = signo(m, cuentaId);
  const color = colores(s, m.estado === "real");
  const ruta = m.categoriaId ? rutaCategoria(categorias, m.categoriaId) : m.categoria;
  const puntoColor = m.categoriaId ? categorias.get(m.categoriaId)?.color : undefined;
  const cuota =
    m.origen.tipo === "cuotas" || m.origen.tipo === "prestamo" || m.origen.tipo === "deuda" ? m.origen : undefined;
  const pagoDeTarjeta =
    m.tipo === "transferencia" && opciones.cuentas.some((c) => c.tarjeta && c.id === m.cuentaDestinoId);

  return (
    <li
      className={`flex flex-col gap-2 border-r-4 border-b border-b-black/5 px-4 py-3 text-sm last:border-b-0 dark:border-b-white/10 ${color.borde}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {puntoColor ? <Punto color={puntoColor} /> : <span className="size-3" />}
        <span className="min-w-48 flex-1">
          <span className="font-medium">
            {m.descripcion ||
              (m.categoriaId && categorias.get(m.categoriaId)?.nombre) ||
              m.categoria ||
              (m.tipo === "transferencia" ? "Transferencia" : "Sin descripción")}
          </span>
          <span className={`block text-xs ${textoSuave}`}>
            {m.tipo === "transferencia"
              ? `${nombres.get(m.cuentaId)} → ${nombres.get(m.cuentaDestinoId ?? "")}`
              : `${nombres.get(m.cuentaId)}${m.contraparte ? ` ${s > 0 ? "←" : "→"} ${m.contraparte}` : ""}${ruta ? ` · ${ruta}` : ""}`}
          </span>
        </span>
        {cuota && (
          <Chip clase={CHIP_CUOTA}>
            {cuota.tipo === "prestamo" ? "Préstamo" : cuota.tipo === "deuda" ? "Deuda · cuota" : "Cuota"} {cuota.numero}/
            {cuota.total}
          </Chip>
        )}
        {pagoDeTarjeta && (
          <Chip clase="bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300">
            💳 Pago de tarjeta{guardado ? "" : " · automático"}
          </Chip>
        )}
        {m.id.startsWith("ahorro:") && (
          <Chip clase="bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300">Objetivo de ahorro · falta</Chip>
        )}
        {m.origen.tipo === "recurrente" && (
          <Chip clase="bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300">Recurrente</Chip>
        )}
        <Chip clase={estado.chip}>{estado.texto}</Chip>
        <span className={`ml-auto w-32 text-right font-medium tabular-nums ${color.monto}`}>
          {s > 0 ? "+" : s < 0 ? "−" : ""}$ {pesosExactos(m.monto)}
        </span>
      </div>
      <div className="pl-6">
        <AccionesMovimiento mov={m} guardado={guardado} opciones={opciones} />
      </div>
    </li>
  );
}
