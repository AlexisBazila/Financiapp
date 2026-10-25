import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { BotonArchivar, FormularioCiclo, FormularioCuenta, FormularioMesInicio } from "./formularios";

const TIPOS: Record<string, string> = {
  efectivo: "Efectivo",
  banco: "Banco",
  billetera: "Billetera virtual",
  inversion: "Inversión",
  tarjeta: "Tarjeta de crédito",
};

const DISPONIBILIDAD: Record<string, string> = {
  inmediata: "disponible",
  "48h": "disponible en 48 h",
  reserva: "reserva de ahorro",
};

export default async function Cuentas() {
  const { supabase } = await requerirUsuario();
  const { hogar, datos, cuentasActivas } = await cargarHogar(supabase);
  const activas = datos.cuentas.filter((c) => cuentasActivas.includes(c.id));
  const cuentasPago = activas.filter((c) => !c.tarjeta).map((c) => ({ id: c.id, nombre: c.nombre }));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Cuentas</h1>

      <section className={`${caja} p-5`}>
        <FormularioMesInicio hogarId={hogar.id} mesInicio={hogar.mesInicio} />
        <p className={`mt-2 text-sm ${textoSuave}`}>
          La previsión parte de los saldos que cargues acá para ese mes. Los movimientos anteriores no se cuentan.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        {activas.length === 0 && <p className={textoSuave}>Todavía no cargaste cuentas.</p>}
        {activas.map((c) => (
          <div key={c.id} className={`${caja} flex flex-col gap-3 p-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <Link href={`/cuentas/${c.id}`} className="font-medium hover:underline">
                  {c.nombre} ›
                </Link>
                <div className={`text-sm ${textoSuave}`}>
                  {TIPOS[c.tipo]}
                  {c.tarjeta
                    ? ` · cierra el ${c.tarjeta.diaCierre}, vence el ${c.tarjeta.diaVencimiento}`
                    : ` · ${DISPONIBILIDAD[c.disponibilidad]}`}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="tabular-nums">$ {pesosExactos(c.saldoInicial)}</span>
                <BotonArchivar id={c.id} />
              </div>
            </div>
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
                    Los meses sin fechas cargadas usan el día de cierre y vencimiento habituales.
                  </p>
                </div>
              </details>
            )}
          </div>
        ))}
      </section>

      <section className={`${caja} p-5`}>
        <h2 className="mb-4 text-lg font-semibold">Agregar cuenta</h2>
        <FormularioCuenta cuentasPago={cuentasPago} />
      </section>
    </div>
  );
}
