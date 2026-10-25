"use client";

import { useActionState, useState } from "react";
import { boton, campo, etiqueta } from "../../estilos";
import { borrarMovimiento, crearMovimiento } from "./acciones";

interface Opcion {
  id: string;
  nombre: string;
}

export function FormularioMovimiento({
  cuentas,
  categorias,
  hoy,
}: {
  cuentas: Opcion[];
  categorias: string[];
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearMovimiento, {});
  const [tipo, setTipo] = useState("egreso");
  const esTransferencia = tipo === "transferencia";

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-3">
      <div className="flex gap-2 sm:col-span-3" role="radiogroup" aria-label="Tipo">
        {[
          ["egreso", "Gasto"],
          ["ingreso", "Ingreso"],
          ["transferencia", "Entre cuentas"],
        ].map(([valor, nombre]) => (
          <label
            key={valor}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm ${
              tipo === valor
                ? "border-foreground bg-foreground text-background"
                : "border-black/15 dark:border-white/20"
            }`}
          >
            <input
              type="radio"
              name="tipo"
              value={valor}
              checked={tipo === valor}
              onChange={() => setTipo(valor)}
              className="sr-only"
            />
            {nombre}
          </label>
        ))}
      </div>
      <label className={etiqueta}>
        Monto ($)
        <input name="monto" inputMode="decimal" required placeholder="0" className={campo} />
      </label>
      <label className={etiqueta}>
        Fecha
        <input name="fecha" type="date" required defaultValue={hoy} className={campo} />
      </label>
      <label className={etiqueta}>
        {esTransferencia ? "Desde" : "Cuenta"}
        <select name="cuenta_id" required className={campo}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      {esTransferencia ? (
        <label className={etiqueta}>
          Hacia
          <select name="cuenta_destino_id" required className={campo}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className={etiqueta}>
          Categoría
          <input name="categoria" list="categorias" placeholder="Hogar, Automóvil…" className={campo} />
          <datalist id="categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      )}
      <label className={etiqueta}>
        Descripción
        <input name="descripcion" className={campo} />
      </label>
      <label className={etiqueta}>
        Estado
        <select name="estado" defaultValue="real" className={campo}>
          <option value="real">Ya pasó (real)</option>
          <option value="planificado">Planificado</option>
        </select>
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pendiente || cuentas.length === 0} className={boton}>
          Guardar
        </button>
        {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
        {estado.ok && <p className="text-sm text-green-700 dark:text-green-400">Guardado.</p>}
      </div>
    </form>
  );
}

export function BotonBorrar({ id }: { id: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm("¿Borrar este movimiento?")) void borrarMovimiento(id);
      }}
      className="text-red-600 hover:underline"
      aria-label="Borrar"
    >
      Borrar
    </button>
  );
}
