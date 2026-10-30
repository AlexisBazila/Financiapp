"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import type { Categoria } from "@/lib/datos/categorias";
import type { Movimiento } from "@/lib/finanzas/tipos";
import { boton, botonSecundario, campo, etiqueta } from "../../estilos";
import { pesosExactos } from "../../formato";
import { CampoContraparte } from "./contraparte";
import { CategoriaOReparto } from "./reparto";
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
  alGuardar,
  alCancelar,
}: Opciones & {
  fechaSugerida: string;
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
  const [tipo, setTipo] = useState<string>(inicial && esPagoDeTarjeta(inicial) ? "pago_tarjeta" : (inicial?.tipo ?? tipoInicial));
  const esPago = tipo === "pago_tarjeta";
  const esTransferencia = tipo === "transferencia" || esPago;
  const [total, setTotal] = useState(inicial ? pesosExactos(inicial.monto) : "");
  const [tarjeta, setTarjeta] = useState(inicial?.cuentaDestinoId ?? tarjetas[0]?.id);
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
          value={total}
          onChange={(e) => setTotal(e.target.value)}
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
        <select name="cuenta_id" required defaultValue={inicial?.cuentaId} key={tipo} className={campo}>
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
        <CategoriaOReparto
          key={tipo}
          categorias={categorias}
          tipo={tipo === "ingreso" ? "ingreso" : "egreso"}
          total={total}
          inicial={inicial?.tipo === tipo ? inicial.categoriaId : undefined}
          partesIniciales={inicial?.tipo === tipo ? inicial.partes : undefined}
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
        <select name="estado" defaultValue={inicial && inicial.estado !== "real" ? "planificado" : "real"} className={campo}>
          <option value="real">Confirmado (ya pasó)</option>
          <option value="planificado">Planificado (sin confirmar)</option>
        </select>
      </label>
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

/** Botón "Nuevo movimiento" que despliega el formulario. */
const RAPIDOS = [
  { tipo: "egreso", nombre: "− Gasto", clase: "bg-red-600 text-white hover:bg-red-700" },
  { tipo: "ingreso", nombre: "＋ Ingreso", clase: "bg-green-700 text-white hover:bg-green-800" },
  { tipo: "transferencia", nombre: "⇄ Transferencia", clase: "bg-sky-700 text-white hover:bg-sky-800" },
];

/**
 * Botón para cargar un movimiento. Con `rapido`, un botón por tipo (gasto, ingreso, transferencia) que
 * abre el formulario con ese tipo elegido.
 */
export function NuevoMovimiento({
  fechaSugerida,
  rapido = false,
  ...opciones
}: Opciones & { fechaSugerida: string; rapido?: boolean }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [guardados, setGuardados] = useState(0);

  if (opciones.cuentas.length === 0) return null;
  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {rapido ? (
          RAPIDOS.map((r) => (
            <button
              key={r.tipo}
              type="button"
              onClick={() => setAbierto(r.tipo)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${r.clase}`}
            >
              {r.nombre}
            </button>
          ))
        ) : (
          <button type="button" onClick={() => setAbierto("egreso")} className={boton}>
            ＋ Nuevo movimiento
          </button>
        )}
        {guardados > 0 && <p className="text-sm text-green-700 dark:text-green-400">Guardado.</p>}
      </div>
    );
  }
  return (
    <div className="w-full rounded-xl border border-black/10 p-5 dark:border-white/15">
      <FormularioMovimiento
        {...opciones}
        tipoInicial={abierto}
        fechaSugerida={fechaSugerida}
        alGuardar={() => {
          setAbierto(null);
          setGuardados((n) => n + 1);
        }}
        alCancelar={() => setAbierto(null)}
      />
    </div>
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
