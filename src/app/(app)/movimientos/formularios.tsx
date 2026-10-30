"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import type { Categoria } from "@/lib/datos/categorias";
import type { Movimiento } from "@/lib/finanzas/tipos";
import { boton, botonSecundario, campo, etiqueta } from "../../estilos";
import { pesosExactos } from "../../formato";
import { SelectorCategoria } from "../categorias/selector";
import { CampoContraparte } from "./contraparte";
import { borrarMovimiento, guardarMovimiento, marcar, type Base } from "./acciones";

interface Opcion {
  id: string;
  nombre: string;
  /** Si es una tarjeta de crédito. */
  tarjeta?: boolean;
}

export interface Opciones {
  cuentas: Opcion[];
  /** Lo que vence este mes en cada tarjeta, para sugerir el monto de un pago. */
  aPagar?: Record<string, number>;
  categorias: Categoria[];
  /** Comercios y personas ya cargados, para sugerir. */
  contrapartes: string[];
}

function FormularioMovimiento({
  cuentas,
  categorias,
  contrapartes,
  aPagar,
  fechaSugerida,
  base,
  inicial,
  tipoInicial = "egreso",
  cuentaSugerida,
  alGuardar,
  alCancelar,
}: Opciones & {
  fechaSugerida: string;
  /** Cuenta elegida de entrada en un movimiento nuevo (la de la página donde se carga). */
  cuentaSugerida?: string;
  base?: Base;
  inicial?: Movimiento;
  /** Tipo con el que arranca un movimiento nuevo. */
  tipoInicial?: string;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [estado, accion, pendiente] = useActionState(guardarMovimiento.bind(null, base ?? null), {});
  const tarjetas = cuentas.filter((c) => c.tarjeta);
  const esPagoDeTarjeta = (m: Movimiento) =>
    m.tipo === "transferencia" && tarjetas.some((t) => t.id === m.cuentaDestinoId);
  const [tipo, setTipo] = useState<string>(
    inicial && esPagoDeTarjeta(inicial) ? "pago_tarjeta" : (inicial?.tipo ?? tipoInicial),
  );
  const esPago = tipo === "pago_tarjeta";
  const esTransferencia = tipo === "transferencia" || esPago;
  const sugeridaEsTarjeta = tarjetas.some((t) => t.id === cuentaSugerida);
  const [tarjeta, setTarjeta] = useState(
    inicial?.cuentaDestinoId ?? (sugeridaEsTarjeta ? cuentaSugerida : undefined) ?? tarjetas[0]?.id,
  );
  const [real, setReal] = useState(!inicial || inicial.estado === "real");
  const vence = esPago && tarjeta ? aPagar?.[tarjeta] : undefined;

  const alGuardarActual = useRef(alGuardar);
  useEffect(() => {
    alGuardarActual.current = alGuardar;
  });
  useEffect(() => {
    if (estado.ok) alGuardarActual.current();
  }, [estado]);

  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-wrap gap-2 sm:col-span-3" role="radiogroup" aria-label="Tipo">
        {[
          ["egreso", "Gasto"],
          ["ingreso", "Ingreso"],
          ["transferencia", "Entre cuentas"],
          ...(tarjetas.length > 0 ? [["pago_tarjeta", "Pago de tarjeta"]] : []),
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
        <input
          name="monto"
          inputMode="decimal"
          required
          placeholder="0"
          defaultValue={inicial ? pesosExactos(inicial.monto) : undefined}
          className={campo}
        />
        {vence !== undefined && vence > 0 && (
          <span className="text-xs font-normal opacity-70">Vence este mes: $ {pesosExactos(vence)}</span>
        )}
      </label>
      <label className={etiqueta}>
        Fecha
        <input name="fecha" type="date" required defaultValue={inicial?.fecha ?? fechaSugerida} className={campo} />
      </label>
      <label className={etiqueta}>
        {esTransferencia ? "Desde" : "Cuenta"}
        <select
          name="cuenta_id"
          required
          defaultValue={inicial?.cuentaId ?? (esPago && sugeridaEsTarjeta ? undefined : cuentaSugerida)}
          key={tipo}
          className={campo}
        >
          {(esPago ? cuentas.filter((c) => !c.tarjeta) : cuentas).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      {esPago ? (
        <label className={etiqueta}>
          Tarjeta
          <select
            name="cuenta_destino_id"
            required
            value={tarjeta}
            onChange={(e) => setTarjeta(e.target.value)}
            className={campo}
          >
            {tarjetas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : esTransferencia ? (
        <label className={etiqueta}>
          Hacia
          <select name="cuenta_destino_id" required defaultValue={inicial?.cuentaDestinoId} className={campo}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <SelectorCategoria
          key={tipo}
          categorias={categorias}
          tipo={tipo === "ingreso" ? "ingreso" : "egreso"}
          valorInicial={inicial?.tipo === tipo ? inicial.categoriaId : undefined}
        />
      )}
      {!esTransferencia && (
        <CampoContraparte
          sugerencias={contrapartes}
          tipo={tipo === "ingreso" ? "ingreso" : "egreso"}
          valorInicial={inicial?.contraparte}
        />
      )}
      <label className={etiqueta}>
        Descripción
        <input
          name="descripcion"
          defaultValue={inicial?.descripcion}
          placeholder={esPago ? "Pago de tarjeta" : undefined}
          className={campo}
        />
      </label>
      <label className={etiqueta}>
        Estado
        <select
          name="estado"
          value={real ? "real" : "planificado"}
          onChange={(e) => setReal(e.target.value === "real")}
          className={campo}
        >
          <option value="real">Confirmado (ya pasó)</option>
          <option value="planificado">Planificado (sin confirmar)</option>
        </select>
      </label>
      {real && (
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="conciliado"
            defaultChecked={inicial ? Boolean(inicial.conciliado) : true}
            className="size-4 accent-green-700"
          />
          Conciliado (ya figura en el banco)
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pendiente || cuentas.length === 0} className={boton}>
          Guardar
        </button>
        <button type="button" onClick={alCancelar} className={botonSecundario}>
          Cancelar
        </button>
        {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
      </div>
    </form>
  );
}

/**
 * Botón redondo "+" fijo abajo a la derecha que abre el formulario en una ventana, para cargar un
 * movimiento desde cualquier punto de la página sin volver arriba.
 */
export function NuevoMovimiento({
  fechaSugerida,
  cuentaSugerida,
  ...opciones
}: Opciones & { fechaSugerida: string; cuentaSugerida?: string }) {
  const [abierto, setAbierto] = useState(false);
  // Cambia en cada apertura para que el formulario arranque vacío.
  const [vez, setVez] = useState(0);
  const [guardado, setGuardado] = useState(false);
  const ventana = useRef<HTMLDialogElement>(null);
  // El portal necesita document.body: solo del lado del navegador.
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  useEffect(() => {
    if (!guardado) return;
    const t = setTimeout(() => setGuardado(false), 2500);
    return () => clearTimeout(t);
  }, [guardado]);

  if (opciones.cuentas.length === 0 || !montado) return null;
  const abrir = () => {
    setVez((v) => v + 1);
    setAbierto(true);
    ventana.current?.showModal();
  };
  const cerrar = () => ventana.current?.close();

  // En un portal, para que el botón fijo no dependa de dónde está ubicado en la página.
  return createPortal(
    <>
      <div className="fixed right-5 bottom-5 z-30 flex items-center gap-3 print:hidden">
        {guardado && (
          <span className="rounded-full bg-green-700 px-3 py-1.5 text-sm text-white shadow-lg">Guardado ✓</span>
        )}
        <button
          type="button"
          onClick={abrir}
          aria-label="Nuevo movimiento"
          title="Nuevo movimiento"
          className="flex size-14 items-center justify-center rounded-full bg-foreground text-3xl leading-none text-background shadow-xl transition-transform hover:scale-105 active:scale-95"
        >
          +
        </button>
      </div>
      <dialog
        ref={ventana}
        onClose={() => setAbierto(false)}
        onClick={(e) => e.target === ventana.current && cerrar()}
        className="m-auto max-h-[90dvh] w-[min(46rem,calc(100vw-1.5rem))] rounded-xl border border-black/10 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40 dark:border-white/15"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-semibold">Nuevo movimiento</h3>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="rounded-lg px-2 text-xl leading-none hover:bg-black/5 dark:hover:bg-white/10"
            >
              ×
            </button>
          </div>
          {abierto && (
            <FormularioMovimiento
              key={vez}
              {...opciones}
              fechaSugerida={fechaSugerida}
              cuentaSugerida={cuentaSugerida}
              alGuardar={() => {
                setGuardado(true);
                cerrar();
              }}
              alCancelar={cerrar}
            />
          )}
        </div>
      </dialog>
    </>,
    document.body,
  );
}

/** Confirmar, conciliar, editar y borrar un movimiento de la lista. */
export function AccionesMovimiento({
  mov,
  guardado,
  opciones,
}: {
  mov: Movimiento;
  /** false si es una cuota o un recurrente generado que todavía no se cargó. */
  guardado: boolean;
  opciones: Opciones;
}) {
  const [editando, setEditando] = useState(false);
  const [pendiente, empezar] = useTransition();
  const [conciliado, setConciliado] = useOptimistic(Boolean(mov.conciliado));
  const real = mov.estado === "real";
  const generado = mov.origen.tipo !== "manual";

  const enlace = "text-sm hover:underline disabled:opacity-50";
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {!real && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => empezar(() => marcar(mov, guardado, {}))}
            className={`${enlace} font-medium text-amber-700 dark:text-amber-400`}
          >
            Confirmar
          </button>
        )}
        {real && (
          <label className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={conciliado}
              disabled={pendiente}
              onChange={(e) => {
                const valor = e.target.checked;
                empezar(async () => {
                  setConciliado(valor);
                  await marcar(mov, guardado, { conciliado: valor });
                });
              }}
              className="size-4 accent-green-700"
            />
            Conciliado
          </label>
        )}
        <button type="button" onClick={() => setEditando((e) => !e)} className={enlace}>
          Editar
        </button>
        {guardado && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              const pregunta = generado
                ? "¿Borrar lo cargado? Vuelve a quedar como estaba planificado."
                : "¿Borrar este movimiento?";
              if (confirm(pregunta)) empezar(() => borrarMovimiento(mov.id));
            }}
            className={`${enlace} text-red-600`}
          >
            Borrar
          </button>
        )}
      </div>
      {editando && (
        <div className="mt-3 w-full rounded-lg border border-black/10 p-4 dark:border-white/15">
          <FormularioMovimiento
            {...opciones}
            fechaSugerida={mov.fecha}
            base={guardado ? { id: mov.id } : { origen: mov.origen, mesResumen: mov.mesResumen }}
            inicial={mov}
            alGuardar={() => setEditando(false)}
            alCancelar={() => setEditando(false)}
          />
        </div>
      )}
    </>
  );
}
