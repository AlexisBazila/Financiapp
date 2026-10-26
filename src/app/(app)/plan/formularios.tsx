"use client";

import { useActionState, useEffect, useState } from "react";
import type { Categoria } from "@/lib/datos/categorias";
import type { Movimiento, Prestamo } from "@/lib/finanzas/tipos";
import { boton, botonSecundario, campo, etiqueta } from "../../estilos";
import { pesosExactos } from "../../formato";
import { SelectorCategoria } from "../categorias/selector";
import { CampoContraparte } from "../movimientos/contraparte";
import {
  borrar,
  confirmarCuota,
  confirmarRecurrente,
  crearPlanCuotas,
  crearRecurrente,
  guardarPrestamo,
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
  contrapartes,
  hoy,
}: {
  cuentas: Opcion[];
  categorias: Categoria[];
  contrapartes: string[];
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
      <CampoContraparte sugerencias={contrapartes} />
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

/** Cómo se muestra un préstamo cargado al editarlo: cuotas a mano todas iguales son una cuota fija. */
function sistemaInicial(p?: Prestamo): string {
  if (!p) return "fija";
  if (p.sistema !== "manual") return p.sistema;
  const cuotas = p.cuotasManuales ?? [];
  return cuotas.length > 0 && cuotas.every((c) => c === cuotas[0]) ? "fija" : "manual";
}

export function FormularioPrestamo({
  cuentas,
  categorias,
  contrapartes,
  categoriaSugerida,
  hoy,
  inicial,
  alGuardar,
}: {
  cuentas: Opcion[];
  categorias: Categoria[];
  contrapartes: string[];
  categoriaSugerida?: string;
  hoy: string;
  inicial?: Prestamo;
  alGuardar?: () => void;
}) {
  const [estado, accion, pendiente] = useActionState(guardarPrestamo.bind(null, inicial?.id ?? null), {});
  const [sistema, setSistema] = useState(sistemaInicial(inicial));
  const [conIngreso, setConIngreso] = useState(Boolean(inicial?.ingreso));
  useEffect(() => {
    if (estado.ok) alGuardar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
  const manuales = inicial?.cuotasManuales ?? [];
  const pesos = (c?: number) => (c ? pesosExactos(c) : undefined);

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-3">
      <label className={etiqueta}>
        Nombre
        <input
          name="descripcion"
          required
          defaultValue={inicial?.descripcion}
          placeholder="Crédito reparación auto"
          className={campo}
        />
      </label>
      <label className={etiqueta}>
        Se paga desde
        <select name="cuenta_id" required defaultValue={inicial?.cuentaId} className={campo}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        Primera cuota
        <input name="primera_cuota" type="date" required defaultValue={inicial?.primeraCuota ?? hoy} className={campo} />
      </label>
      <label className={etiqueta}>
        Cuotas
        <select name="sistema" value={sistema} onChange={(e) => setSistema(e.target.value)} className={campo}>
          <option value="fija">Cuota fija que informa el banco</option>
          <option value="manual">Cargo cada cuota a mano</option>
          <option value="frances">Calcular: cuota fija (francés)</option>
          <option value="aleman">Calcular: cuota que baja (alemán)</option>
        </select>
      </label>
      {sistema === "fija" && (
        <>
          <label className={etiqueta}>
            Monto de la cuota
            <input name="cuota" inputMode="decimal" required defaultValue={pesos(manuales[0])} placeholder="$" className={campo} />
          </label>
          <label className={etiqueta}>
            Cantidad de cuotas
            <input name="cantidad" type="number" min={1} max={480} required defaultValue={inicial?.cantidad} className={campo} />
          </label>
        </>
      )}
      {sistema === "manual" && (
        <label className={`${etiqueta} sm:col-span-2`}>
          Cuotas, una por línea, en orden
          <textarea
            name="cuotas_manuales"
            rows={4}
            required
            defaultValue={manuales.length > 0 ? manuales.map((c) => pesosExactos(c)).join("\n") : undefined}
            placeholder={"35.569,78\n35.120,40\n…"}
            className={campo}
          />
        </label>
      )}
      {(sistema === "frances" || sistema === "aleman") && (
        <>
          <label className={etiqueta}>
            Cantidad de cuotas
            <input name="cantidad" type="number" min={1} max={480} required defaultValue={inicial?.cantidad} className={campo} />
          </label>
          <label className={etiqueta}>
            Tasa nominal anual (%)
            <input name="tasa_anual" inputMode="decimal" defaultValue={inicial?.tasaAnual || undefined} placeholder="0" className={campo} />
          </label>
        </>
      )}
      <label className={etiqueta}>
        {sistema === "frances" || sistema === "aleman" ? "Capital pedido" : "Monto pedido (opcional)"}
        <input
          name="capital"
          inputMode="decimal"
          required={sistema === "frances" || sistema === "aleman"}
          defaultValue={pesos(inicial?.capital)}
          placeholder="$"
          className={campo}
        />
      </label>
      <label className={etiqueta}>
        Cada cuota
        <select name="debito" defaultValue={inicial?.requiereConfirmacion ? "confirmar" : "auto"} className={campo}>
          <option value="auto">Se debita sola de la cuenta</option>
          <option value="confirmar">La confirmo cuando se debita</option>
        </select>
      </label>
      <SelectorCategoria categorias={categorias} tipo="egreso" valorInicial={inicial?.categoriaId ?? categoriaSugerida} />
      <CampoContraparte sugerencias={contrapartes} valorInicial={inicial?.contraparte} />
      <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-3 sm:col-span-3 dark:border-white/15">
        <label className="flex items-center gap-2 text-sm">
          <input
            name="registrar_ingreso"
            type="checkbox"
            checked={conIngreso}
            onChange={(e) => setConIngreso(e.target.checked)}
            className="size-4"
          />
          Registrar la plata del préstamo como ingreso
        </label>
        {conIngreso ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={etiqueta}>
              Mes en que entró
              <input
                name="ingreso_mes"
                type="month"
                required
                defaultValue={inicial?.ingreso?.mes ?? (inicial?.primeraCuota ?? hoy).slice(0, 7)}
                className={campo}
              />
            </label>
            <label className={etiqueta}>
              Monto que entró
              <input
                name="ingreso_monto"
                inputMode="decimal"
                defaultValue={pesos(inicial?.ingreso?.monto ?? inicial?.capital)}
                placeholder="Vacío: el monto pedido"
                className={campo}
              />
            </label>
          </div>
        ) : (
          <p className="text-xs opacity-70">Sin marcar, solo cuentan las cuotas (por ejemplo, si el préstamo ya lo recibiste antes).</p>
        )}
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pendiente || cuentas.length === 0} className={boton}>
          {inicial ? "Guardar cambios" : "Agregar préstamo"}
        </button>
        {inicial && alGuardar && (
          <button type="button" onClick={alGuardar} className={botonSecundario}>
            Cancelar
          </button>
        )}
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

/** Botón que despliega el formulario para editar un préstamo cargado. */
export function EditarPrestamo(props: Omit<Parameters<typeof FormularioPrestamo>[0], "alGuardar" | "inicial"> & { inicial: Prestamo }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-sm hover:underline">
        Editar
      </button>
    );
  }
  return (
    <div className="mt-2 w-full rounded-lg border border-black/10 p-4 dark:border-white/15">
      <FormularioPrestamo {...props} alGuardar={() => setAbierto(false)} />
    </div>
  );
}

export function ConfirmarCuota({ mov }: { mov: Movimiento }) {
  const [estado, accion, pendiente] = useActionState(confirmarCuota.bind(null, mov), {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <label className={etiqueta}>
        Monto debitado
        <input name="monto" inputMode="decimal" required defaultValue={pesosExactos(mov.monto)} className={`${campo} w-36`} />
      </label>
      <label className={etiqueta}>
        Fecha
        <input name="fecha" type="date" required defaultValue={mov.fecha} className={campo} />
      </label>
      <button type="submit" disabled={pendiente} className={boton}>
        Confirmar
      </button>
      <Mensaje estado={estado} ok="Confirmada." />
    </form>
  );
}

export function FormularioRecurrente({
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
      <CampoContraparte sugerencias={contrapartes} tipo={tipo === "ingreso" ? "ingreso" : "egreso"} />
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
