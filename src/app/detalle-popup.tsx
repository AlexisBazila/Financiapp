"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { nombreMes } from "@/lib/finanzas/fechas";
import type { Certeza, MovimientoDetalle } from "@/lib/finanzas/prevision";
import type { Mes } from "@/lib/finanzas/tipos";
import { pesos } from "./formato";

export interface ContenidoDetalle {
  titulo: string;
  meses: { mes: Mes; movimientos: MovimientoDetalle[]; resumen?: ReactNode }[];
}

const ESTADO: Record<Certeza, string> = {
  planificado: "sin confirmar",
  real: "confirmado",
  conciliado: "conciliado",
};

/** "23/10". */
const diaMes = (fecha: string) => `${Number(fecha.slice(8, 10))}/${Number(fecha.slice(5, 7))}`;

/** Ventana con los movimientos que forman un monto de la previsión, mes por mes. */
export function DetallePopup({
  contenido,
  cuentas,
  alCerrar,
}: {
  contenido: ContenidoDetalle;
  /** Nombre de cada cuenta. */
  cuentas: Record<string, string>;
  alCerrar: () => void;
}) {
  const ventana = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ventana.current?.showModal();
  }, []);
  // Solo los meses que tienen algo, para no llenar la ventana de meses vacíos.
  const meses = contenido.meses.filter((m) => m.movimientos.length > 0);

  return (
    <dialog
      ref={ventana}
      onClose={alCerrar}
      // Tocar afuera (el fondo) también cierra.
      onClick={(e) => e.target === ventana.current && ventana.current.close()}
      className="m-auto max-h-[85vh] w-[min(40rem,calc(100vw-2rem))] rounded-xl border border-black/10 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40 dark:border-white/15"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold">{contenido.titulo}</h3>
          <button
            type="button"
            onClick={() => ventana.current?.close()}
            aria-label="Cerrar"
            className="rounded-lg px-2 text-xl leading-none hover:bg-black/5 dark:hover:bg-white/10"
          >
            ×
          </button>
        </div>
        {meses.length === 0 && <p className="text-sm text-black/60 dark:text-white/60">No hay movimientos.</p>}
        {meses.map(({ mes, movimientos, resumen }) => {
          const total = movimientos.reduce((s, m) => s + m.monto, 0);
          return (
            <section key={mes} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 border-b border-black/10 pb-1 dark:border-white/15">
                <h4 className="font-medium">{nombreMes(mes)}</h4>
                <span className="text-sm font-semibold tabular-nums">$ {pesos(total)}</span>
              </div>
              {resumen && <div className="text-xs text-black/60 dark:text-white/60">{resumen}</div>}
              <ul className="flex flex-col gap-1 text-sm">
                {[...movimientos]
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                  .map((m, i) => (
                    <li key={`${m.id}-${i}`} className="flex items-baseline gap-3">
                      <span className="w-10 shrink-0 text-xs tabular-nums text-black/50 dark:text-white/50">
                        {diaMes(m.fecha)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={m.certeza === "planificado" ? "opacity-70" : ""}>
                          {m.descripcion}
                          {m.cuota && <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-400">{m.cuota}</span>}
                        </span>
                        <span className="block text-xs text-black/50 dark:text-white/50">
                          {cuentas[m.cuentaId] ?? ""} · {ESTADO[m.certeza]}
                        </span>
                      </span>
                      <span className={`shrink-0 tabular-nums ${m.certeza === "planificado" ? "opacity-70" : ""}`}>
                        {m.monto < 0 ? "−" : ""}$ {pesos(Math.abs(m.monto))}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      </div>
    </dialog>
  );
}
