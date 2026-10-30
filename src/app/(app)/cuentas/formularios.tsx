"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { MONEDAS, simbolo } from "@/lib/datos/monedas";
import type { Cuenta } from "@/lib/finanzas/tipos";
import { boton, botonSecundario, campo, etiqueta } from "../../estilos";
import { pesosExactos } from "../../formato";
import {
  archivarCuenta,
  cambiarMesInicio,
  guardarCiclo,
  guardarCotizacion,
  guardarCuenta,
  traerCotizacion,
  type Resultado,
} from "./acciones";

function Mensaje({ estado, ok }: { estado: Resultado; ok: string }) {
  if (estado.error) return <p className="text-sm text-red-600">{estado.error}</p>;
  if (estado.ok) return <p className="text-sm text-green-700 dark:text-green-400">{ok}</p>;
  return null;
}

/** Personas ya cargadas como titulares, para sugerir. */
function CampoTitular({ titulares, inicial }: { titulares: string[]; inicial?: string }) {
  const lista = useId();
  return (
    <label className={etiqueta}>
      De quién es (opcional)
      <input
        name="titular"
        list={lista}
        maxLength={40}
        autoComplete="off"
        defaultValue={inicial}
        placeholder="Alexis, Sol, compartida…"
        className={campo}
      />
      <datalist id={lista}>
        {titulares.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </label>
  );
}

/** Alta de una cuenta (banco, billetera, efectivo, inversión), o edición si viene `inicial`. */
export function FormularioCuenta({ titulares, inicial }: { titulares: string[]; inicial?: Cuenta }) {
  const [estado, accion, pendiente] = useActionState(guardarCuenta.bind(null, inicial?.id ?? null), {});
  const [tipo, setTipo] = useState<string>(inicial?.tipo ?? "banco");
  const [moneda, setMoneda] = useState(inicial?.moneda ?? "ARS");

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2">
      <label className={etiqueta}>
        Nombre
        <input
          name="nombre"
          required
          defaultValue={inicial?.nombre}
          placeholder="Caja de ahorro, Mercado Pago, Plazo fijo…"
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
        </select>
      </label>
      <label className={etiqueta}>
        {`Saldo (${simbolo(moneda)}), al inicio del mes o a la fecha de abajo`}
        <input
          name="saldo"
          inputMode="decimal"
          placeholder="0"
          defaultValue={inicial ? pesosExactos(inicial.saldoInicial) : undefined}
          className={campo}
        />
      </label>
      <label className={etiqueta}>
        Fecha del saldo (opcional)
        <input name="saldo_fecha" type="date" defaultValue={inicial?.saldoFecha} className={campo} />
        <span className="text-xs font-normal opacity-70">
          Si cargaste el saldo que ves hoy en el banco, poné la fecha de hoy: lo de esta cuenta hasta ese día ya
          está en el saldo y no se vuelve a descontar.
        </span>
      </label>
      <label className={etiqueta}>
        Moneda
        <select name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)} className={campo}>
          <option value="ARS">Pesos ($)</option>
          <option value="USD">Dólares (US$)</option>
          <option value="EUR">Euros (€)</option>
        </select>
      </label>
      <CampoTitular titulares={titulares} inicial={inicial?.titular} />
      {moneda !== "ARS" ? (
        <p className="self-end pb-2 text-sm text-black/60 dark:text-white/60">
          Cuenta como disponible no inmediato: hay que cambiar la moneda para usarla.
        </p>
      ) : (
        <label className={etiqueta}>
          Disponibilidad
          <select
            name="disponibilidad"
            defaultValue={
              inicial?.tipo === tipo && inicial.disponibilidad ? inicial.disponibilidad : tipo === "inversion" ? "48h" : "inmediata"
            }
            key={tipo}
            className={campo}
          >
            <option value="inmediata">Disponible para gastar</option>
            <option value="48h">Disponible no inmediato (FCI, plazo fijo…)</option>
            <option value="reserva">Reserva de ahorro</option>
          </select>
        </label>
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

/** Alta de una tarjeta de crédito, o edición si viene `inicial`. */
export function FormularioTarjeta({
  cuentasPago,
  titulares,
  inicial,
}: {
  cuentasPago: { id: string; nombre: string }[];
  titulares: string[];
  inicial?: Cuenta;
}) {
  const [estado, accion, pendiente] = useActionState(guardarCuenta.bind(null, inicial?.id ?? null), {});

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tipo" value="tarjeta" />
      <label className={etiqueta}>
        Nombre
        <input name="nombre" required defaultValue={inicial?.nombre} placeholder="Visa Macro, Mastercard…" className={campo} />
      </label>
      <CampoTitular titulares={titulares} inicial={inicial?.titular} />
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
      <label className={etiqueta}>
        Se paga desde
        <select name="cuenta_pago_id" required defaultValue={inicial?.tarjeta?.cuentaPagoId} className={campo}>
          {cuentasPago.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        Límite de compra (opcional, $)
        <input
          name="limite"
          inputMode="decimal"
          placeholder="4.000.000"
          defaultValue={inicial?.tarjeta?.limite ? pesosExactos(inicial.tarjeta.limite) : undefined}
          className={campo}
        />
      </label>
      <label className={etiqueta}>
        Resumen ya cerrado a pagar en el primer mes ($)
        <input
          name="saldo"
          inputMode="decimal"
          placeholder="0"
          defaultValue={inicial ? pesosExactos(inicial.saldoInicial) : undefined}
          className={campo}
        />
        <span className="text-xs font-normal opacity-70">
          Si ese resumen ya lo pagaste antes de cargar el saldo de la cuenta de pago, dejalo en 0.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input
          name="pago_automatico"
          type="checkbox"
          defaultChecked={inicial?.tarjeta?.pagoAutomatico ?? true}
          className="mt-0.5 size-4"
        />
        <span>
          Pagar el resumen automáticamente al vencimiento, con lo que haya en la cuenta de pago. Si no alcanza, lo
          que falta queda como deuda. Si en el mes cargás un pago de tarjeta, se usa ese.
        </span>
      </label>
      {cuentasPago.length === 0 && (
        <p className="text-sm text-red-600 sm:col-span-2">Primero cargá la cuenta desde la que pagás la tarjeta.</p>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pendiente || cuentasPago.length === 0} className={boton}>
          {inicial ? "Guardar cambios" : "Agregar tarjeta"}
        </button>
        <Mensaje estado={estado} ok={inicial ? "Guardado." : "Tarjeta agregada."} />
      </div>
    </form>
  );
}

/** Cierre y vencimiento de un resumen. Con `mes`, el de ese mes, partiendo de las fechas que tiene ahora. */
export function FormularioCiclo({
  cuentaId,
  mes,
  cierre,
  vencimiento,
}: {
  cuentaId: string;
  mes?: string;
  cierre?: string;
  vencimiento?: string;
}) {
  const [estado, accion, pendiente] = useActionState(guardarCiclo.bind(null, cuentaId, mes ?? null), {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      <label className={etiqueta}>
        Cierre
        <input name="cierre" type="date" required defaultValue={cierre} className={campo} />
      </label>
      <label className={etiqueta}>
        Vencimiento
        <input name="vencimiento" type="date" required defaultValue={vencimiento} className={campo} />
      </label>
      <button type="submit" disabled={pendiente} className={botonSecundario}>
        {mes ? "Confirmar fechas" : "Guardar fechas"}
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

/** Tipo de cambio de una moneda: a mano, o traído de una cotización publicada. */
export function FormularioCotizacion({ moneda, valor }: { moneda: string; valor?: number }) {
  const [estado, accion, pendiente] = useActionState(guardarCotizacion.bind(null, moneda), {});
  const [trayendo, empezar] = useTransition();
  const [traida, setTraida] = useState<Resultado>({});
  const traer = (casa: string) =>
    empezar(async () => {
      setTraida(await traerCotizacion(moneda, casa));
    });
  const casas = [["bcra", "BCRA (se actualiza sola)"], ...(moneda === "USD" ? [["bolsa", "MEP"], ["blue", "Blue"]] : [])];

  return (
    <div className="flex flex-col gap-3">
      <form action={accion} className="flex flex-wrap items-end gap-3">
        <label className={etiqueta}>
          1 {MONEDAS[moneda as keyof typeof MONEDAS] ?? moneda} = $
          <input
            name="valor"
            inputMode="decimal"
            required
            defaultValue={valor ? valor.toLocaleString("es-AR") : undefined}
            placeholder="1.400"
            className={`${campo} w-36`}
          />
        </label>
        <button type="submit" disabled={pendiente} className={botonSecundario}>
          Guardar
        </button>
        <Mensaje estado={estado} ok="Guardado." />
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Traer cotización:</span>
        {casas.map(([casa, nombre]) => (
          <button
            key={casa}
            type="button"
            disabled={trayendo}
            onClick={() => traer(casa)}
            className="rounded-full border border-black/15 px-3 py-1 hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            {nombre}
          </button>
        ))}
        <Mensaje estado={traida} ok="Actualizada." />
      </div>
    </div>
  );
}
