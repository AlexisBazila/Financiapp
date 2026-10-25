import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { rutaCategoria } from "@/lib/datos/categorias";
import { hoy, mesDe, sumarMeses } from "@/lib/finanzas/fechas";
import { expandir } from "@/lib/finanzas/prevision";
import type { Movimiento } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { Punto } from "../categorias/selector";
import { AccionesMovimiento, NuevoMovimiento } from "./formularios";

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function tituloMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const nombre = new Date(anio, m - 1, 1).toLocaleDateString("es-AR", { month: "long" });
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

/** Cómo está un movimiento: sin confirmar, confirmado o conciliado con el banco. */
function situacion(m: Movimiento) {
  if (m.estado !== "real") {
    return {
      texto: m.estado === "pendiente" ? "Por confirmar" : "Sin confirmar",
      fila: "border-l-4 border-dashed border-l-black/25 bg-black/[0.02] dark:border-l-white/30 dark:bg-white/[0.03]",
      chip: "bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70",
    };
  }
  if (!m.conciliado) {
    return {
      texto: "Sin conciliar",
      fila: "border-l-4 border-l-amber-500",
      chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    };
  }
  return {
    texto: "Conciliado ✓",
    fila: "border-l-4 border-l-green-600",
    chip: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300",
  };
}

function Chip({ children, clase }: { children: React.ReactNode; clase: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${clase}`}>{children}</span>;
}

export default async function Movimientos({ searchParams }: PageProps<"/movimientos">) {
  const { mes: pedido } = await searchParams;
  const actual = mesDe(hoy());
  const mes = typeof pedido === "string" && MES.test(pedido) ? pedido : actual;

  const { supabase } = await requerirUsuario();
  const { datos, cuentasActivas, categorias } = await cargarHogar(supabase);
  const nombres = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const opciones = {
    cuentas: datos.cuentas.filter((c) => cuentasActivas.includes(c.id)).map((c) => ({ id: c.id, nombre: c.nombre })),
    categorias: categorias.filter((c) => !c.archivada),
  };
  const guardados = new Set(datos.movimientos.map((m) => m.id));

  const lista = expandir(datos, mes, mes)
    .filter((m) => mesDe(m.fecha) === mes)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.descripcion.localeCompare(b.descripcion));
  const suma = (tipo: Movimiento["tipo"]) => lista.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.monto, 0);
  const sinConfirmar = lista.filter((m) => m.estado !== "real").length;
  const sinConciliar = lista.filter((m) => m.estado === "real" && !m.conciliado).length;

  const flecha = "rounded-lg border border-black/15 px-3 py-1.5 text-lg leading-none hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Movimientos</h1>
        {opciones.cuentas.length === 0 ? (
          <p className="text-sm">
            Primero <Link href="/cuentas" className="underline">cargá tus cuentas</Link>.
          </p>
        ) : (
          <NuevoMovimiento {...opciones} fechaSugerida={mes === actual ? hoy() : `${mes}-01`} />
        )}
      </div>

      <nav className="flex items-center gap-3" aria-label="Mes">
        <Link href={`/movimientos?mes=${sumarMeses(mes, -1)}`} className={flecha} aria-label="Mes anterior">
          ‹
        </Link>
        <h2 className="min-w-40 text-center text-lg font-semibold">{tituloMes(mes)}</h2>
        <Link href={`/movimientos?mes=${sumarMeses(mes, 1)}`} className={flecha} aria-label="Mes siguiente">
          ›
        </Link>
        {mes !== actual && (
          <Link href="/movimientos" className={`text-sm underline ${textoSuave}`}>
            Volver a este mes
          </Link>
        )}
      </nav>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>
          Ingresos <strong className="tabular-nums text-green-700 dark:text-green-400">$ {pesosExactos(suma("ingreso"))}</strong>
        </span>
        <span>
          Gastos <strong className="tabular-nums">$ {pesosExactos(suma("egreso"))}</strong>
        </span>
        <span className={textoSuave}>
          {sinConfirmar} sin confirmar · {sinConciliar} sin conciliar
        </span>
      </div>

      <details className={`text-sm ${textoSuave}`}>
        <summary className="cursor-pointer">¿Qué significa cada estado?</summary>
        <ul className="mt-2 flex flex-col gap-1.5">
          <li>
            <Chip clase={situacion({ estado: "planificado" } as Movimiento).chip}>Sin confirmar</Chip> Planificado: la
            previsión lo cuenta, pero todavía no pasó. Al confirmarlo queda como real.
          </li>
          <li>
            <Chip clase={situacion({ estado: "real" } as Movimiento).chip}>Sin conciliar</Chip> Ya pasó, pero no lo
            chequeaste contra el resumen del banco o la tarjeta.
          </li>
          <li>
            <Chip clase={situacion({ estado: "real", conciliado: true } as Movimiento).chip}>Conciliado ✓</Chip> Ya pasó
            y coincide con el banco.
          </li>
          <li>
            <Chip clase="bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300">Cuota 3/12</Chip>{" "}
            Cuota de una compra o un préstamo, en cualquier estado.
          </li>
        </ul>
      </details>

      {lista.length === 0 ? (
        <p className={textoSuave}>No hay movimientos en {tituloMes(mes).toLowerCase()}.</p>
      ) : (
        <ul className={`${caja} divide-y divide-black/5 overflow-hidden dark:divide-white/10`}>
          {lista.map((m) => {
            const s = situacion(m);
            const ruta = m.categoriaId ? rutaCategoria(porId, m.categoriaId) : m.categoria;
            const color = m.categoriaId ? porId.get(m.categoriaId)?.color : undefined;
            const cuota = m.origen.tipo === "cuotas" || m.origen.tipo === "prestamo" ? m.origen : undefined;
            return (
              <li key={m.id} className={`flex flex-col gap-2 px-4 py-3 text-sm ${s.fila}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`tabular-nums ${textoSuave}`}>{m.fecha.slice(8)}/{m.fecha.slice(5, 7)}</span>
                  {color ? <Punto color={color} /> : <span className="size-3" />}
                  <span className="min-w-48 flex-1">
                    <span className="font-medium">
                      {m.descripcion ||
                        (m.categoriaId && porId.get(m.categoriaId)?.nombre) ||
                        m.categoria ||
                        (m.tipo === "transferencia" ? "Transferencia" : "Sin descripción")}
                    </span>
                    <span className={`block text-xs ${textoSuave}`}>
                      {m.tipo === "transferencia"
                        ? `${nombres.get(m.cuentaId)} → ${nombres.get(m.cuentaDestinoId ?? "")}`
                        : `${nombres.get(m.cuentaId)}${ruta ? ` · ${ruta}` : ""}`}
                    </span>
                  </span>
                  {cuota && (
                    <Chip clase="bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300">
                      {cuota.tipo === "prestamo" ? "Préstamo" : "Cuota"} {cuota.numero}/{cuota.total}
                    </Chip>
                  )}
                  {m.origen.tipo === "recurrente" && (
                    <Chip clase="bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300">Recurrente</Chip>
                  )}
                  <Chip clase={s.chip}>{s.texto}</Chip>
                  <span
                    className={`ml-auto w-32 text-right tabular-nums ${m.tipo === "ingreso" ? "text-green-700 dark:text-green-400" : ""} ${m.estado !== "real" ? textoSuave : "font-medium"}`}
                  >
                    {m.tipo === "ingreso" ? "+" : m.tipo === "egreso" ? "−" : ""}$ {pesosExactos(m.monto)}
                  </span>
                </div>
                <div className="pl-12">
                  <AccionesMovimiento mov={m} guardado={guardados.has(m.id)} opciones={opciones} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
