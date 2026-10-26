import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import type { Cuenta } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { BotonArchivar, FormularioCiclo, FormularioCuenta, FormularioMesInicio } from "./formularios";

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
  "48h": "Disponible en 48 h",
  reserva: "Reserva de ahorro",
};

export default async function Cuentas() {
  const { supabase } = await requerirUsuario();
  const { hogar, datos, cuentasActivas } = await cargarHogar(supabase);
  const activas = datos.cuentas.filter((c) => cuentasActivas.includes(c.id));
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
                    <span className="tabular-nums" title={c.tarjeta ? "Resumen a pagar al inicio" : "Saldo al inicio"}>
                      $ {pesosExactos(c.saldoInicial)}
                    </span>
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

      <section className={`${caja} p-5`}>
        <h2 className="mb-4 text-lg font-semibold">Agregar cuenta</h2>
        <FormularioCuenta cuentasPago={cuentasPago} titulares={titulares} />
      </section>
    </div>
  );
}
