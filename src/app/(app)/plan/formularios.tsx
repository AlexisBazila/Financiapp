"use client";

import { useActionState, useState } from "react";
import type { Categoria } from "@/lib/datos/categorias";
import { boton, campo, etiqueta } from "../../estilos";
import { SelectorCategoria } from "../categorias/selector";
import {
  borrar,
  confirmarRecurrente,
  crearPlanCuotas,
  crearPrestamo,
  crearRecurrente,
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

function SelectorCuenta({ cuentas, etiquetaTexto = "Cuenta" }: { cuentas: Opcion[]; etiquetaTexto?: string }) {
  return (
    <label className={etiqueta}>
      {etiquetaTexto}
      <select name="cuenta_id" required className={campo}>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ConfirmarPendiente({
  recurrenteId,
  mes,
  montoSugerido,
  fechaSugerida,
}: {
  recurrenteId: string;
  mes: string;
  montoSugerido: string;
  fechaSugerida: string;
}) {
  const [estado, accion, pendiente] = useActionState(confirmarRecurrente.bind(null, recurrenteId, mes), {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <label className={etiqueta}>
        Monto real
        <input name="monto" inputMode="decimal" required defaultValue={montoSugerido} className={`${campo} w-36`} />
      </label>
      <label className={etiqueta}>
        Fecha
        <input name="fecha" type="date" required defaultValue={fechaSugerida} className={campo} />
      </label>
      <button type="submit" disabled={pendiente} className={boton}>
        Confirmar
      </button>
      <Mensaje estado={estado} ok="Confirmado." />
    </form>
  );
}

export function FormularioCuotas({
  cuentas,
  categorias,
  hoy,
}: {
  cuentas: Opcion[];
  categorias: Categoria[];
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearPlanCuotas, {});
  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-3">
      <label className={etiqueta}>
        Qué compraste
        <input name="descripcion" required placeholder="Heladera" className={campo} />
      </label>
      <SelectorCategoria categorias={categorias} tipo="egreso" />
      <SelectorCuenta cuentas={cuentas} etiquetaTexto="Pagado con" />
      <label className={etiqueta}>
        Fecha de compra
        <input name="fecha_compra" type="date" required defaultValue={hoy} className={campo} />
      </label>
      <label className={etiqueta}>
        Cantidad de cuotas
        <input name="cantidad" type="number" min={1} max={120} required className={campo} />
      </label>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-2">
        <label className={etiqueta}>
          Monto
          <select name="modo_monto" defaultValue="cuota" className={campo}>
            <option value="cuota">por cuota</option>
            <option value="total">total</option>
          </select>
        </label>
        <input name="monto" inputMode="decimal" required placeholder="$" aria-label="Monto" className={campo} />
      </div>
      <label className={etiqueta}>
        Interés anual (%) — vacío si es sin interés
        <input name="tasa_anual" inputMode="decimal" placeholder="0" className={campo} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pendiente || cuentas.length === 0} className={boton}>
          Agregar compra en cuotas
        </button>
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

export function FormularioPrestamo({
  cuentas,
  categorias,
  categoriaSugerida,
  hoy,
}: {
  cuentas: Opcion[];
  categorias: Categoria[];
  categoriaSugerida?: string;
  hoy: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearPrestamo, {});
  const [sistema, setSistema] = useState("frances");
  const manual = sistema === "manual";
  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-3">
      <label className={etiqueta}>
        Nombre
        <input name="descripcion" required placeholder="Crédito reparación auto" className={campo} />
      </label>
      <SelectorCuenta cuentas={cuentas} etiquetaTexto="Se paga desde" />
      <label className={etiqueta}>
        Primera cuota
        <input name="primera_cuota" type="date" required defaultValue={hoy} className={campo} />
      </label>
      <label className={etiqueta}>
        Sistema
        <select name="sistema" value={sistema} onChange={(e) => setSistema(e.target.value)} className={campo}>
          <option value="frances">Cuota fija (francés)</option>
          <option value="aleman">Cuota que baja (alemán)</option>
          <option value="manual">Cargo cada cuota a mano</option>
        </select>
      </label>
      {manual ? (
        <label className={`${etiqueta} sm:col-span-2`}>
          Cuotas, una por línea, en orden
          <textarea name="cuotas_manuales" rows={4} required placeholder={"39.511,10\n38.850,77\n…"} className={campo} />
        </label>
      ) : (
        <>
          <label className={etiqueta}>
            Capital pedido
            <input name="capital" inputMode="decimal" required placeholder="$" className={campo} />
          </label>
          <label className={etiqueta}>
            Cantidad de cuotas
            <input name="cantidad" type="number" min={1} max={480} required className={campo} />
          </label>
          <label className={etiqueta}>
            Tasa nominal anual (%)
            <input name="tasa_anual" inputMode="decimal" placeholder="0" className={campo} />
          </label>
        </>
      )}
      <SelectorCategoria categorias={categorias} tipo="egreso" valorInicial={categoriaSugerida} />
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pendiente || cuentas.length === 0} className={boton}>
          Agregar préstamo
        </button>
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

export function FormularioRecurrente({
  cuentas,
  categorias,
  mesActual,
}: {
  cuentas: Opcion[];
  categorias: Categoria[];
  mesActual: string;
}) {
  const [estado, accion, pendiente] = useActionState(crearRecurrente, {});
  const [tipo, setTipo] = useState("ingreso");
  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-3">
      <label className={etiqueta}>
        Nombre
        <input name="descripcion" required placeholder="Sueldo, Luz, Internet…" className={campo} />
      </label>
      <label className={etiqueta}>
        Tipo
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Gasto</option>
        </select>
      </label>
      <SelectorCategoria key={tipo} categorias={categorias} tipo={tipo === "ingreso" ? "ingreso" : "egreso"} />
      <SelectorCuenta cuentas={cuentas} />
      <label className={etiqueta}>
        Monto estimado
        <input name="monto" inputMode="decimal" required placeholder="$" className={campo} />
      </label>
      <label className={etiqueta}>
        Día del mes
        <input name="dia_del_mes" type="number" min={1} max={31} required defaultValue={1} className={campo} />
      </label>
      <label className={etiqueta}>
        Desde
        <input name="desde" type="month" required defaultValue={mesActual} className={campo} />
      </label>
      <label className={etiqueta}>
        Hasta (opcional)
        <input name="hasta" type="month" className={campo} />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input name="requiere_confirmacion" type="checkbox" defaultChecked={tipo === "ingreso"} key={tipo} />
        Confirmarlo cada mes antes de que cuente como real
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pendiente || cuentas.length === 0} className={boton}>
          Agregar recurrente
        </button>
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

export function BotonBorrar({
  tabla,
  id,
  pregunta,
}: {
  tabla: "planes_cuotas" | "prestamos" | "recurrentes";
  id: string;
  pregunta: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(pregunta)) void borrar(tabla, id);
      }}
      className="text-sm text-red-600 hover:underline"
    >
      Borrar
    </button>
  );
}
