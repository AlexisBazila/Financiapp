"use client";

import { useActionState, useState } from "react";
import type { ObjetivoAhorro } from "@/lib/finanzas/tipos";
import { boton, botonSecundario, campo, etiqueta } from "../../estilos";
import { pesosExactos } from "../../formato";
import { borrarObjetivo, guardarMontoDelMes, guardarObjetivo, quitarMontoDelMes } from "./acciones";

interface Opcion {
  id: string;
  nombre: string;
}

export function FormularioObjetivo({
  origenes,
  destinos,
  mesActual,
  inicial,
}: {
  /** Cuentas de las que puede salir la plata. */
  origenes: Opcion[];
  /** Cuentas de ahorro o inversión, primero. */
  destinos: Opcion[];
  mesActual: string;
  inicial?: ObjetivoAhorro;
}) {
  const [estado, accion, pendiente] = useActionState(guardarObjetivo.bind(null, inicial?.id ?? null), {});
  const [modo, setModo] = useState(inicial?.porcentaje ? "porcentaje" : "monto");

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-3">
      <div className="grid grid-cols-[5rem_1fr] gap-2">
        <label className={etiqueta}>
          Ícono
          <input name="icono" defaultValue={inicial?.icono} placeholder="🐷" className={`${campo} text-center`} />
        </label>
        <label className={etiqueta}>
          Nombre
          <input
            name="nombre"
            required
            maxLength={60}
            defaultValue={inicial?.nombre}
            placeholder="Ahorro mensual"
            className={campo}
          />
        </label>
      </div>
      <label className={etiqueta}>
        Sale de
        <select name="cuenta_origen_id" required defaultValue={inicial?.cuentaOrigenId} className={campo}>
          {origenes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        Va a
        <select name="cuenta_destino_id" required defaultValue={inicial?.cuentaDestinoId} className={campo}>
          {destinos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Cuánto por mes</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="modo" value="monto" checked={modo === "monto"} onChange={() => setModo("monto")} />
          Un monto fijo
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="modo"
            value="porcentaje"
            checked={modo === "porcentaje"}
            onChange={() => setModo("porcentaje")}
          />
          Un porcentaje de los ingresos del mes
        </label>
      </fieldset>
      {modo === "monto" ? (
        <label className={etiqueta}>
          Monto por mes ($)
          <input
            name="monto"
            inputMode="decimal"
            required
            defaultValue={inicial?.monto ? pesosExactos(inicial.monto) : undefined}
            placeholder="100.000"
            className={campo}
          />
        </label>
      ) : (
        <label className={etiqueta}>
          Porcentaje de los ingresos (%)
          <input
            name="porcentaje"
            inputMode="decimal"
            required
            defaultValue={inicial?.porcentaje ? String(inicial.porcentaje).replace(".", ",") : undefined}
            placeholder="15"
            className={campo}
          />
          <span className="text-xs text-black/60 dark:text-white/60">
            Sobre lo que entra en el mes, sin contar lo que sobró del mes anterior.
          </span>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className={etiqueta}>
          Desde
          <input name="desde" type="month" required defaultValue={inicial?.desde ?? mesActual} className={campo} />
        </label>
        <label className={etiqueta}>
          Hasta (opcional)
          <input name="hasta" type="month" defaultValue={inicial?.hasta} className={campo} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pendiente || origenes.length === 0} className={boton}>
          {inicial ? "Guardar cambios" : "Crear objetivo"}
        </button>
        {inicial && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`¿Borrar el objetivo "${inicial.nombre}"?`)) void borrarObjetivo(inicial.id);
            }}
            className="text-sm text-red-600 hover:underline"
          >
            Borrar
          </button>
        )}
        {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
        {estado.ok && <p className="text-sm text-green-700 dark:text-green-400">Guardado.</p>}
      </div>
    </form>
  );
}

/** Monto puesto a mano para un mes puntual, en vez del fijo o el porcentaje. */
export function FormularioMontoDelMes({ id, mes }: { id: string; mes: string }) {
  const [estado, accion, pendiente] = useActionState(guardarMontoDelMes.bind(null, id), {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      <label className={etiqueta}>
        Mes
        <input name="mes" type="month" required defaultValue={mes} className={campo} />
      </label>
      <label className={etiqueta}>
        Monto ese mes ($)
        <input name="monto" inputMode="decimal" required placeholder="478.956,68" className={`${campo} w-40`} />
      </label>
      <button type="submit" disabled={pendiente} className={botonSecundario}>
        Poner a mano
      </button>
      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
      {estado.ok && <p className="text-sm text-green-700 dark:text-green-400">Guardado.</p>}
    </form>
  );
}

export function BotonQuitarMonto({ id, mes }: { id: string; mes: string }) {
  return (
    <button type="button" onClick={() => void quitarMontoDelMes(id, mes)} className="text-xs text-red-600 hover:underline">
      Quitar
    </button>
  );
}
