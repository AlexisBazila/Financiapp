"use client";

import { useActionState, useId, useState } from "react";
import type { Cuenta } from "@/lib/finanzas/tipos";
import { boton, botonSecundario, campo, etiqueta } from "../../estilos";
import { pesosExactos } from "../../formato";
import { archivarCuenta, cambiarMesInicio, guardarCiclo, guardarCuenta, type Resultado } from "./acciones";

function Mensaje({ estado, ok }: { estado: Resultado; ok: string }) {
  if (estado.error) return <p className="text-sm text-red-600">{estado.error}</p>;
  if (estado.ok) return <p className="text-sm text-green-700 dark:text-green-400">{ok}</p>;
  return null;
}

/** Alta de una cuenta, o edición si viene `inicial`. */
export function FormularioCuenta({
  cuentasPago,
  titulares,
  inicial,
}: {
  cuentasPago: { id: string; nombre: string }[];
  /** Personas ya cargadas como titulares, para sugerir. */
  titulares: string[];
  inicial?: Cuenta;
}) {
  const [estado, accion, pendiente] = useActionState(guardarCuenta.bind(null, inicial?.id ?? null), {});
  const [tipo, setTipo] = useState<string>(inicial?.tipo ?? "banco");
  const esTarjeta = tipo === "tarjeta";
  const listaTitulares = useId();
  const pagos = cuentasPago.filter((c) => c.id !== inicial?.id);

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2">
      <label className={etiqueta}>
        Nombre
        <input
          name="nombre"
          required
          defaultValue={inicial?.nombre}
          placeholder="Caja de ahorro, Visa, Plazo fijo…"
          className={campo}
        />
      </label>
      <label className={etiqueta}>
        Tipo
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
          <option value="banco">Banco</option>
          <option value="efectivo">Efectivo</option>
          <option value="billetera">Billetera virtual</option>
          <option value="inversion">Inversión</option>
          <option value="tarjeta">Tarjeta de crédito</option>
        </select>
      </label>
      <label className={etiqueta}>
        {esTarjeta ? "Resumen ya cerrado a pagar ese mes ($)" : "Saldo al inicio del mes ($)"}
        <input
          name="saldo"
          inputMode="decimal"
          placeholder="0"
          defaultValue={inicial ? pesosExactos(inicial.saldoInicial) : undefined}
          className={campo}
        />
      </label>
      <label className={etiqueta}>
        De quién es (opcional)
        <input
          name="titular"
          list={listaTitulares}
          maxLength={40}
          autoComplete="off"
          defaultValue={inicial?.titular}
          placeholder="Alexis, Sol, compartida…"
          className={campo}
        />
        <datalist id={listaTitulares}>
          {titulares.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      {esTarjeta ? (
        <label className={etiqueta}>
          Se paga desde
          <select name="cuenta_pago_id" required defaultValue={inicial?.tarjeta?.cuentaPagoId} className={campo}>
            {pagos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className={etiqueta}>
          Disponibilidad
          <select
            name="disponibilidad"
            defaultValue={inicial?.tipo === tipo ? inicial.disponibilidad : tipo === "inversion" ? "48h" : "inmediata"}
            key={tipo}
            className={campo}
          >
            <option value="inmediata">Disponible para gastar</option>
            <option value="48h">Disponible con espera (48 h)</option>
            <option value="reserva">Reserva de ahorro</option>
          </select>
        </label>
      )}
      {esTarjeta && (
        <>
          <label className={etiqueta}>
            Día de cierre habitual
            <input
              name="dia_cierre"
              type="number"
              min={1}
              max={31}
              required
              defaultValue={inicial?.tarjeta?.diaCierre}
              className={campo}
            />
          </label>
          <label className={etiqueta}>
            Día de vencimiento habitual
            <input
              name="dia_vencimiento"
              type="number"
              min={1}
              max={31}
              required
              defaultValue={inicial?.tarjeta?.diaVencimiento}
              className={campo}
            />
          </label>
        </>
      )}
      {esTarjeta && pagos.length === 0 && (
        <p className="text-sm text-red-600 sm:col-span-2">Primero cargá la cuenta desde la que pagás la tarjeta.</p>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pendiente} className={boton}>
          {inicial ? "Guardar cambios" : "Agregar cuenta"}
        </button>
        <Mensaje estado={estado} ok={inicial ? "Guardado." : "Cuenta agregada."} />
      </div>
    </form>
  );
}

export function FormularioCiclo({ cuentaId }: { cuentaId: string }) {
  const [estado, accion, pendiente] = useActionState(guardarCiclo.bind(null, cuentaId), {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      <label className={etiqueta}>
        Cierre
        <input name="cierre" type="date" required className={campo} />
      </label>
      <label className={etiqueta}>
        Vencimiento
        <input name="vencimiento" type="date" required className={campo} />
      </label>
      <button type="submit" disabled={pendiente} className={botonSecundario}>
        Guardar fechas
      </button>
      <Mensaje estado={estado} ok="Guardado." />
    </form>
  );
}

export function FormularioMesInicio({ hogarId, mesInicio }: { hogarId: string; mesInicio: string }) {
  const [estado, accion, pendiente] = useActionState(cambiarMesInicio.bind(null, hogarId), {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      <label className={etiqueta}>
        Los saldos son del comienzo de
        <input name="mes_inicio" type="month" defaultValue={mesInicio} required className={campo} />
      </label>
      <button type="submit" disabled={pendiente} className={botonSecundario}>
        Cambiar
      </button>
      <Mensaje estado={estado} ok="Guardado." />
    </form>
  );
}

export function BotonArchivar({ id }: { id: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm("¿Archivar esta cuenta? Deja de aparecer en los formularios, pero no se borra nada.")) {
          void archivarCuenta(id);
        }
      }}
      className="text-sm text-red-600 hover:underline"
    >
      Archivar
    </button>
  );
}
