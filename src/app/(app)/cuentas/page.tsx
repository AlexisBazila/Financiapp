import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import type { Cuenta } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { simbolo } from "@/lib/datos/monedas";
import {
  BotonArchivar,
  FormularioCiclo,
  FormularioCotizacion,
  FormularioCuenta,
  FormularioMesInicio,
} from "./formularios";

/** Saldo inicial en la moneda de la cuenta: verde si hay plata, rojo y negativo si es deuda. */
function Saldo({ cuenta }: { cuenta: Cuenta }) {
  // En una tarjeta el saldo es lo que se debe.
  const valor = cuenta.tarjeta ? -cuenta.saldoInicial : cuenta.saldoInicial;
  const color = valor > 0 ? "text-green-700 dark:text-green-400" : valor < 0 ? "text-red-600 dark:text-red-400" : "";
  return (
    <span className="flex flex-col items-end" title={cuenta.tarjeta ? "Resumen a pagar al inicio" : "Saldo al inicio"}>
      <span className={`font-medium tabular-nums ${color}`}>
        {valor < 0 ? "−" : ""}
        {simbolo(cuenta.moneda)} {pesosExactos(Math.abs(valor))}
      </span>
      {cuenta.moneda && cuenta.cambio && (
        <span className={`text-xs tabular-nums ${textoSuave}`}>
          ≈ $ {pesosExactos(Math.round(Math.abs(valor) * cuenta.cambio))}
        </span>
      )}
    </span>
  );
}

/** Orden y título de cada grupo de la pantalla. */
const GRUPOS: [Cuenta["tipo"], string][] = [
  ["banco", "🏦 Bancos"],
  ["billetera", "📱 Billeteras virtuales"],
  ["efectivo", "💵 Efectivo"],
  ["inversion", "📈 Inversiones"],
  ["tarjeta", "💳 Tarjetas de crédito"],
];

const DISPONIBILIDAD: Record<string, string> = {
  inmediata: "Disponible",
  "48h": "Disponible no inmediato",
  reserva: "Reserva de ahorro",
};

export default async function Cuentas() {
  const { supabase } = await requerirUsuario();
  const { hogar, datos, cuentasActivas, cotizaciones } = await cargarHogar(supabase);
  const activas = datos.cuentas.filter((c) => cuentasActivas.includes(c.id));
  const monedas = [...new Set(activas.flatMap((c) => (c.moneda ? [c.moneda] : [])))];
  const cuentasPago = activas.filter((c) => !c.tarjeta).map((c) => ({ id: c.id, nombre: c.nombre }));
  const titulares = [...new Set(datos.cuentas.map((c) => c.titular).filter((t): t is string => Boolean(t)))].sort();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Cuentas</h1>

      <section className={`${caja} p-5`}>
        <FormularioMesInicio hogarId={hogar.id} mesInicio={hogar.mesInicio} />
        <p className={`mt-2 text-sm ${textoSuave}`}>
          La previsión parte de los saldos que cargues acá para ese mes. Los movimientos anteriores no se cuentan.
        </p>
      </section>

      {activas.length === 0 && <p className={textoSuave}>Todavía no cargaste cuentas.</p>}
      {GRUPOS.map(([tipo, titulo]) => {
        const delTipo = activas.filter((c) => c.tipo === tipo);
        if (delTipo.length === 0) return null;
        return (
          <section key={tipo} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{titulo}</h2>
            {delTipo.map((c) => (
              <div key={c.id} className={`${caja} flex flex-col gap-3 p-4`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/cuentas/${c.id}`} className="font-medium hover:underline">
                        {c.nombre} ›
                      </Link>
                      {c.titular && (
                        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                          👤 {c.titular}
                        </span>
                      )}
                    </div>
                    <div className={`text-sm ${textoSuave}`}>
                      {c.tarjeta
                        ? `Cierra el ${c.tarjeta.diaCierre}, vence el ${c.tarjeta.diaVencimiento} · ${
                            c.tarjeta.pagoAutomatico === false ? "pago a mano" : "pago automático"
                          }`
                        : DISPONIBILIDAD[c.disponibilidad]}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Saldo cuenta={c} />
                    <BotonArchivar id={c.id} />
                  </div>
                </div>
                <details className="text-sm">
                  <summary className={`cursor-pointer ${textoSuave}`}>Editar</summary>
                  <div className="mt-3">
                    <FormularioCuenta cuentasPago={cuentasPago} titulares={titulares} inicial={c} />
                  </div>
                </details>
                {c.tarjeta && (
                  <details className="text-sm">
                    <summary className={`cursor-pointer ${textoSuave}`}>
                      Fechas de cierre de cada mes ({c.tarjeta.ciclos.length} cargadas)
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      <ul className="flex flex-col gap-1">
                        {[...c.tarjeta.ciclos]
                          .sort((a, b) => b.mes.localeCompare(a.mes))
                          .map((ciclo) => (
                            <li key={ciclo.mes} className="tabular-nums">
                              {ciclo.mes}: cierra {ciclo.cierre}, vence {ciclo.vencimiento}
                            </li>
                          ))}
                      </ul>
                      <FormularioCiclo cuentaId={c.id} />
                      <p className={textoSuave}>
                        Los meses sin fechas cargadas usan el día de cierre y vencimiento habituales. Lo que compres
                        después del cierre entra en el resumen del mes siguiente.
                      </p>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </section>
        );
      })}

      {monedas.length > 0 && (
        <section className={`${caja} flex flex-col gap-5 p-5`}>
          <div>
            <h2 className="text-lg font-semibold">Tipos de cambio</h2>
            <p className={`text-sm ${textoSuave}`}>
              Las cuentas en otras monedas se suman en pesos con este valor. Podés cargarlo a mano o traer la
              cotización de compra del día.
            </p>
          </div>
          {monedas.map((m) => {
            const cotizacion = cotizaciones[m];
            return (
              <div key={m} className="flex flex-col gap-2">
                <h3 className="font-medium">
                  {m}
                  {cotizacion ? (
                    <span className={`ml-2 text-sm font-normal ${textoSuave}`}>
                      $ {cotizacion.valor.toLocaleString("es-AR")} · {cotizacion.fuente} ·{" "}
                      {new Date(cotizacion.actualizada).toLocaleDateString("es-AR")}
                    </span>
                  ) : (
                    <span className="ml-2 text-sm font-normal text-red-600">sin cargar: se cuenta 1 a 1</span>
                  )}
                </h3>
                <FormularioCotizacion moneda={m} valor={cotizacion?.valor} />
              </div>
            );
          })}
        </section>
      )}

      <section className={`${caja} p-5`}>
        <h2 className="mb-4 text-lg font-semibold">Agregar cuenta</h2>
        <FormularioCuenta cuentasPago={cuentasPago} titulares={titulares} />
      </section>
    </div>
  );
}
