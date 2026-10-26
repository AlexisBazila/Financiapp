"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Categoria } from "@/lib/datos/categorias";
import { nombreMes, sumarMeses } from "@/lib/finanzas/fechas";
import type { CuotaDeuda } from "@/lib/finanzas/tipos";
import { boton, botonSecundario, campo, etiqueta, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { SelectorCategoria } from "../categorias/selector";
import { CampoContraparte } from "../movimientos/contraparte";
import {
  agregarCuota,
  borrarDeuda,
  crearDeuda,
  editarCuota,
  moverCuota,
  pagarCuotas,
  type Resultado,
} from "./acciones";

interface Opcion {
  id: string;
  nombre: string;
}

function Mensaje({ estado, ok = "Guardado." }: { estado: Resultado; ok?: string }) {
  if (estado.error) return <p className="text-sm text-red-600">{estado.error}</p>;
  if (estado.ok) return <p className="text-sm text-green-700 dark:text-green-400">{ok}</p>;
  return null;
}

/** Llama a `listo` cuando la acción terminó bien. */
function useAlTerminar(estado: Resultado, listo: () => void) {
  useEffect(() => {
    if (estado.ok) listo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
}

export function FormularioDeuda({
  cuentas,
  categorias,
  contrapartes,
  mesActual,
}: {
  cuentas: Opcion[];
  categorias: Categoria[];
  contrapartes: string[];
  mesActual: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearDeuda, {});
  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-3">
      <label className={etiqueta}>
        Nombre
        <input name="descripcion" required placeholder="Patente auto" className={campo} />
      </label>
      <SelectorCategoria categorias={categorias} tipo="egreso" />
      <CampoContraparte sugerencias={contrapartes} />
      <label className={etiqueta}>
        Se paga con
        <select name="cuenta_id" required className={campo}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        Cantidad de cuotas
        <input name="cantidad" type="number" min={1} max={120} required className={campo} />
      </label>
      <label className={etiqueta}>
        Monto de cada cuota
        <input name="monto" inputMode="decimal" required placeholder="$" className={campo} />
      </label>
      <label className={etiqueta}>
        Primera cuota en
        <input name="desde" type="month" required defaultValue={mesActual} className={campo} />
      </label>
      <label className={etiqueta}>
        Cuotas por mes, para arrancar
        <input name="por_mes" type="number" min={1} max={12} defaultValue={1} className={campo} />
      </label>
      <label className={etiqueta}>
        Día del mes en que pagás
        <input name="dia_del_mes" type="number" min={1} max={31} required defaultValue={10} className={campo} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pendiente || cuentas.length === 0} className={boton}>
          Agregar deuda
        </button>
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

const flecha =
  "rounded-md border border-black/15 px-2 py-0.5 text-xs transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10";

/** Una cuota pendiente: se pasa al mes anterior o al siguiente, o se edita su monto y su mes. */
function Cuota({ deudaId, cuota, total }: { deudaId: string; cuota: CuotaDeuda; total: number }) {
  const [pendiente, empezar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [estado, accion, guardando] = useActionState(editarCuota.bind(null, deudaId, cuota.numero), {});
  useAlTerminar(estado, () => setEditando(false));
  const mover = (n: number) => empezar(async () => void (await moverCuota(deudaId, cuota.numero, sumarMeses(cuota.mes, n))));

  if (editando) {
    return (
      <form action={accion} className="flex flex-wrap items-end gap-2 rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.05]">
        <span className="self-center text-sm font-medium">
          Cuota {cuota.numero}/{total}
        </span>
        <label className={etiqueta}>
          Monto
          <input name="monto" inputMode="decimal" required defaultValue={pesosExactos(cuota.monto)} className={`${campo} w-32`} />
        </label>
        <label className={etiqueta}>
          Mes
          <input name="mes" type="month" required defaultValue={cuota.mes} className={campo} />
        </label>
        <button type="submit" disabled={guardando} className={boton}>
          Guardar
        </button>
        <button type="button" onClick={() => setEditando(false)} className={botonSecundario}>
          Cancelar
        </button>
        <Mensaje estado={estado} />
      </form>
    );
  }
  return (
    <div className={`flex items-center gap-2 text-sm ${pendiente ? "opacity-50" : ""}`}>
      <button type="button" disabled={pendiente} onClick={() => mover(-1)} className={flecha} aria-label={`Pasar la cuota ${cuota.numero} al mes anterior`}>
        ◀
      </button>
      <button type="button" onClick={() => setEditando(true)} className="hover:underline">
        Cuota {cuota.numero}/{total} · <span className="tabular-nums">$ {pesosExactos(cuota.monto)}</span>
      </button>
      <button type="button" disabled={pendiente} onClick={() => mover(1)} className={flecha} aria-label={`Pasar la cuota ${cuota.numero} al mes siguiente`}>
        ▶
      </button>
    </div>
  );
}

/** Las cuotas pendientes de un mes, con el botón para registrar que se pagaron. */
export function MesDeuda({
  deudaId,
  mes,
  cuotas,
  total,
  atrasado,
  hoy,
}: {
  deudaId: string;
  mes: string;
  cuotas: CuotaDeuda[];
  total: number;
  atrasado: boolean;
  hoy: string;
}) {
  const [pagando, setPagando] = useState(false);
  const numeros = cuotas.map((c) => c.numero);
  const [estado, accion, pendiente] = useActionState(pagarCuotas.bind(null, deudaId, numeros), {});
  useAlTerminar(estado, () => setPagando(false));
  const suma = cuotas.reduce((s, c) => s + c.monto, 0);

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-20 font-medium capitalize">{nombreMes(mes)}</span>
        {atrasado && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-500/20 dark:text-red-300">
            atrasada
          </span>
        )}
        <span className={`text-sm ${textoSuave}`}>
          {cuotas.length} {cuotas.length === 1 ? "cuota" : "cuotas"}
        </span>
        <span className="ml-auto font-medium tabular-nums text-red-600 dark:text-red-400">−$ {pesosExactos(suma)}</span>
        {!pagando && (
          <button type="button" onClick={() => setPagando(true)} className={botonSecundario}>
            Pagué
          </button>
        )}
      </div>
      {pagando ? (
        <form action={accion} className="flex flex-wrap items-end gap-2">
          {cuotas.map((c) => (
            <label key={c.numero} className={etiqueta}>
              Cuota {c.numero}/{total}
              <input
                name={`monto_${c.numero}`}
                inputMode="decimal"
                required
                defaultValue={pesosExactos(c.monto)}
                className={`${campo} w-32`}
              />
            </label>
          ))}
          <label className={etiqueta}>
            Fecha del pago
            <input name="fecha" type="date" required defaultValue={hoy} className={campo} />
          </label>
          <button type="submit" disabled={pendiente} className={boton}>
            Registrar pago
          </button>
          <button type="button" onClick={() => setPagando(false)} className={botonSecundario}>
            Cancelar
          </button>
          <Mensaje estado={estado} />
        </form>
      ) : (
        <div className="flex flex-wrap gap-x-5 gap-y-2 pl-0 sm:pl-[5.75rem]">
          {cuotas.map((c) => (
            <Cuota key={c.numero} deudaId={deudaId} cuota={c} total={total} />
          ))}
        </div>
      )}
    </li>
  );
}

export function AgregarCuota({ deudaId, mesSugerido, montoSugerido }: { deudaId: string; mesSugerido: string; montoSugerido?: number }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(agregarCuota.bind(null, deudaId), {});
  useAlTerminar(estado, () => setAbierto(false));
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-sm hover:underline">
        ＋ Agregar cuota
      </button>
    );
  }
  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <label className={etiqueta}>
        Monto
        <input
          name="monto"
          inputMode="decimal"
          required
          defaultValue={montoSugerido ? pesosExactos(montoSugerido) : undefined}
          className={`${campo} w-32`}
        />
      </label>
      <label className={etiqueta}>
        Mes
        <input name="mes" type="month" required defaultValue={mesSugerido} className={campo} />
      </label>
      <button type="submit" disabled={pendiente} className={boton}>
        Agregar
      </button>
      <button type="button" onClick={() => setAbierto(false)} className={botonSecundario}>
        Cancelar
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function BorrarDeuda({ id, nombre }: { id: string; nombre: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(`¿Borrar "${nombre}"? Las cuotas ya pagadas quedan como movimientos.`)) void borrarDeuda(id);
      }}
      className="text-sm text-red-600 hover:underline"
    >
      Borrar
    </button>
  );
}
