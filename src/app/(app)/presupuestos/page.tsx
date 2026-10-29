import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { etiqueta } from "@/lib/datos/categorias";
import { hoy, mesDe, nombreMes, sumarMeses } from "@/lib/finanzas/fechas";
import { calcularPrevision } from "@/lib/finanzas/prevision";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { FormularioPresupuesto } from "./formularios";

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function Presupuestos({ searchParams }: PageProps<"/presupuestos">) {
  const { mes: pedido } = await searchParams;
  const actual = mesDe(hoy());
  const mes = typeof pedido === "string" && MES.test(pedido) ? pedido : actual;

  const { supabase } = await requerirUsuario();
  const { datos, categorias, presupuestos, cuentasActivas } = await cargarHogar(supabase);
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const cuentas = datos.cuentas
    .filter((c) => cuentasActivas.includes(c.id))
    .map((c) => ({ id: c.id, nombre: c.tarjeta ? `💳 ${c.nombre}` : c.nombre }));
  const nombres = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));
  const activas = categorias.filter((c) => !c.archivada);
  const [delMes] = calcularPrevision(datos, { desde: mes, meses: 1 });
  const resumen = new Map(delMes.presupuestos.map((p) => [p.id, p]));
  // Solo los que corren en el mes; los demás quedan aparte, plegados, para poder editarlos.
  const delMesElegido = presupuestos.filter((p) => resumen.has(p.id));
  const otros = presupuestos.filter((p) => !resumen.has(p.id));
  const meses = (p: (typeof presupuestos)[number]) =>
    p.hasta === p.desde
      ? `solo ${nombreMes(p.desde)}`
      : `${p.cadaMeses && p.cadaMeses > 1 ? (p.cadaMeses === 12 ? "una vez por año" : `cada ${p.cadaMeses} meses`) : "todos los meses"} desde ${nombreMes(p.desde)}${p.hasta ? ` hasta ${nombreMes(p.hasta)}` : ""}`;

  const flecha =
    "rounded-lg border border-black/15 px-3 py-1.5 text-lg leading-none hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Presupuestos</h1>
        <p className={`mt-1 text-sm ${textoSuave}`}>
          Lo que gastás en las categorías de cada presupuesto se descuenta del monto del mes. Lo que resta, la previsión
          lo cuenta como gasto hasta fin de mes. Lo comprado con tarjeta cuenta en el mes del período del resumen (si
          noviembre va del 23/10 al 19/11, una compra del 25/10 es de noviembre).
        </p>
      </div>

      <nav className="flex items-center gap-3" aria-label="Mes">
        <Link href={`/presupuestos?mes=${sumarMeses(mes, -1)}`} className={flecha} aria-label="Mes anterior">
          ‹
        </Link>
        <h2 className="min-w-28 text-center text-lg font-semibold">{nombreMes(mes)}</h2>
        <Link href={`/presupuestos?mes=${sumarMeses(mes, 1)}`} className={flecha} aria-label="Mes siguiente">
          ›
        </Link>
      </nav>

      {presupuestos.length === 0 && <p className={textoSuave}>Todavía no hay presupuestos.</p>}
      {presupuestos.length > 0 && delMesElegido.length === 0 && (
        <p className={textoSuave}>Ningún presupuesto corre en {nombreMes(mes)}.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {delMesElegido.map((p) => {
          const r = resumen.get(p.id)!;
          const porcentaje = r ? Math.min(100, Math.round((r.gastado / r.monto) * 100)) : 0;
          const pasado = r && r.resto < 0;
          return (
            <section key={p.id} className={`${caja} flex flex-col gap-3 p-5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  {p.icono} {p.nombre}
                </h3>
                <span className="text-right">
                  <span className="tabular-nums">
                    $ {pesosExactos(r?.monto ?? p.monto)} en {nombreMes(mes)}
                  </span>
                  {p.aumentoMensual ? (
                    <span className={`block text-xs ${textoSuave}`}>
                      sube {String(p.aumentoMensual).replace(".", ",")} % por mes desde {nombreMes(p.desde)}
                    </span>
                  ) : null}
                </span>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
                role="progressbar"
                aria-valuenow={porcentaje}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full ${pasado ? "bg-red-600" : porcentaje > 85 ? "bg-amber-500" : "bg-green-600"}`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  Gastado <strong className="tabular-nums">$ {pesosExactos(r.gastado)}</strong>
                </span>
                <span className={pasado ? "font-semibold text-red-600" : "text-green-700 dark:text-green-400"}>
                  {pasado ? "Te pasaste " : "Resta "}
                  <strong className="tabular-nums">$ {pesosExactos(Math.abs(r.resto))}</strong>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.categoriaIds.map((id) => {
                  const c = porId.get(id);
                  return (
                    c && (
                      <span
                        key={id}
                        className="rounded-full border px-2 py-0.5 text-xs"
                        style={{ borderColor: c.color }}
                      >
                        {etiqueta(c)}
                        {!c.padreId && " (toda)"}
                      </span>
                    )
                  );
                })}
              </div>
              <p className={`text-xs ${textoSuave}`}>
                {p.cuentaIds
                  ? `Gastos de ${p.cuentaIds.map((id) => nombres.get(id)).join(", ")}`
                  : "Gastos de todas las cuentas"}{" "}
                · lo que resta sale de {nombres.get(p.cuentaId)} · {meses(p)}
              </p>
              <details className="text-sm">
                <summary className={`cursor-pointer ${textoSuave}`}>Editar</summary>
                <div className="mt-3">
                  <FormularioPresupuesto cuentas={cuentas} categorias={activas} mesActual={actual} inicial={p} />
                </div>
              </details>
            </section>
          );
        })}
      </div>

      {otros.length > 0 && (
        <details className="text-sm">
          <summary className={`cursor-pointer ${textoSuave}`}>De otros meses ({otros.length})</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {otros.map((p) => (
              <li key={p.id} className={`${caja} p-3`}>
                <details>
                  <summary className="cursor-pointer">
                    {p.icono} {p.nombre} <span className={textoSuave}>· {meses(p)}</span>
                  </summary>
                  <div className="mt-3">
                    <FormularioPresupuesto cuentas={cuentas} categorias={activas} mesActual={actual} inicial={p} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className={`${caja} p-5`} open={presupuestos.length === 0}>
        <summary className="cursor-pointer font-medium">＋ Nuevo presupuesto</summary>
        <div className="mt-4">
          <FormularioPresupuesto cuentas={cuentas} categorias={activas} mesActual={actual} />
        </div>
      </details>
    </div>
  );
}
