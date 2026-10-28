import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { estadoTarjeta, periodoDe } from "@/lib/finanzas/estado-tarjeta";
import { hoy, sumarMeses } from "@/lib/finanzas/fechas";
import { resumenDeFecha } from "@/lib/finanzas/tarjeta";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { BotonArchivar, FormularioCiclo, FormularioTarjeta } from "../cuentas/formularios";
import { diaMes, TotalesTarjeta } from "../cuentas/totales-tarjeta";
import { tituloMes } from "../movimientos/lista";

/** Períodos que se muestran para revisar sus fechas: el anterior, el actual y los dos siguientes. */
const PERIODOS = [-1, 0, 1, 2];

const rojo = "text-red-600 dark:text-red-400";

export default async function Tarjetas() {
  const { supabase } = await requerirUsuario();
  const { hogar, datos, cuentasActivas } = await cargarHogar(supabase);
  const activas = datos.cuentas.filter((c) => cuentasActivas.includes(c.id));
  const tarjetas = activas.filter((c) => c.tarjeta);
  const cuentasPago = activas.filter((c) => !c.tarjeta).map((c) => ({ id: c.id, nombre: c.nombre }));
  const titulares = [...new Set(datos.cuentas.map((c) => c.titular).filter((t): t is string => Boolean(t)))].sort();
  const nombres = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));
  const fecha = hoy();
  const estados = new Map(tarjetas.map((c) => [c.id, estadoTarjeta(datos, c.id, fecha, hogar.mesInicio)]));
  const deudaTotal = [...estados.values()].reduce((s, e) => s + e.deudaTotal, 0);
  const consumoPeriodo = [...estados.values()].reduce((s, e) => s + e.consumoPeriodo, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Tarjetas de crédito</h1>
        <p className={`text-sm ${textoSuave}`}>
          Lo que comprás con tarjeta es gasto del mes en que cierra el resumen, y se paga el mes siguiente desde la
          cuenta de pago.
        </p>
      </div>

      {tarjetas.length > 1 && (
        <section className="grid grid-cols-2 gap-3 sm:max-w-xl">
          <div className={`${caja} p-4`} title="Resúmenes cerrados sin pagar más lo que va del período en curso, de todas las tarjetas">
            <div className={`text-sm ${textoSuave}`}>Deuda total</div>
            <div className={`text-xl font-semibold tabular-nums ${deudaTotal > 0 ? rojo : ""}`}>
              {deudaTotal > 0 ? "−" : ""}$ {pesosExactos(Math.abs(deudaTotal))}
            </div>
          </div>
          <div className={`${caja} p-4`} title="Lo comprado en el período en curso de todas las tarjetas">
            <div className={`text-sm ${textoSuave}`}>Período en curso</div>
            <div className="text-xl font-semibold tabular-nums">$ {pesosExactos(consumoPeriodo)}</div>
          </div>
        </section>
      )}

      {tarjetas.length === 0 && <p className={textoSuave}>Todavía no cargaste tarjetas.</p>}
      {tarjetas.map((c) => (
        <section key={c.id} className={`${caja} flex flex-col gap-3 p-4`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/cuentas/${c.id}`} className="font-medium hover:underline">
                  💳 {c.nombre} ›
                </Link>
                {c.titular && (
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">👤 {c.titular}</span>
                )}
              </div>
              <div className={`text-sm ${textoSuave}`}>
                Cierra el {c.tarjeta!.diaCierre}, vence el {c.tarjeta!.diaVencimiento} · se paga desde{" "}
                {nombres.get(c.tarjeta!.cuentaPagoId)} ·{" "}
                {c.tarjeta!.pagoAutomatico === false ? "pago a mano" : "pago automático"}
              </div>
            </div>
            <BotonArchivar id={c.id} />
          </div>
          <TotalesTarjeta estado={estados.get(c.id)!} compacto />
          <details className="text-sm">
            <summary className={`cursor-pointer ${textoSuave}`}>Editar</summary>
            <div className="mt-3">
              <FormularioTarjeta cuentasPago={cuentasPago} titulares={titulares} inicial={c} />
            </div>
          </details>
          <details className="text-sm">
            <summary className={`cursor-pointer ${textoSuave}`}>Fechas de cierre y vencimiento de cada mes</summary>
            <div className="mt-3 flex flex-col gap-4">
              <p className={textoSuave}>
                El cierre cambia mes a mes: confirmá las fechas de cada resumen cuando las sepas (están en el resumen
                anterior o en la app del banco). Cada período empieza el día después del cierre anterior. Los meses sin
                confirmar usan el día de cierre y vencimiento habituales.
              </p>
              {PERIODOS.map((n) => {
                const periodo = periodoDe(c, sumarMeses(resumenDeFecha(c, fecha), n));
                return (
                  <div key={periodo.mes} className="flex flex-col gap-2">
                    <div className="font-medium">
                      {tituloMes(periodo.mes)}
                      <span className={`ml-2 font-normal ${textoSuave}`}>
                        del {diaMes(periodo.desde)} al {diaMes(periodo.cierre)} · vence el {diaMes(periodo.vencimiento)}{" "}
                        · {periodo.cargado ? "confirmado" : "habitual, sin confirmar"}
                        {n === 0 && " · en curso"}
                      </span>
                    </div>
                    <FormularioCiclo
                      key={`${periodo.cierre}-${periodo.vencimiento}`}
                      cuentaId={c.id}
                      mes={periodo.mes}
                      cierre={periodo.cierre}
                      vencimiento={periodo.vencimiento}
                    />
                  </div>
                );
              })}
            </div>
          </details>
        </section>
      ))}

      <section className={`${caja} p-5`}>
        <h2 className="mb-4 text-lg font-semibold">Agregar tarjeta</h2>
        <FormularioTarjeta cuentasPago={cuentasPago} titulares={titulares} />
      </section>
    </div>
  );
}
