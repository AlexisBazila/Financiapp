import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { hoy as hoyAR, mesDe } from "@/lib/finanzas/fechas";
import { mesDeGasto } from "@/lib/finanzas/prevision";
import type { Cuenta, CuotaDeuda, Deuda, Movimiento } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { diaMes } from "../cuentas/totales-tarjeta";
import { BorrarDeuda, EditarCuotas, FormularioDeuda, MesDeuda } from "./formularios";

/** Cuotas pagadas (con su movimiento real) y pendientes agrupadas por el mes en que se planea pagarlas. */
function situacion(deuda: Deuda, movimientos: Movimiento[], cuentas: Map<string, Cuenta>) {
  const cargadas = new Map<number, Movimiento>();
  for (const m of movimientos) {
    if (m.origen.tipo === "deuda" && m.origen.deudaId === deuda.id) cargadas.set(m.origen.numero, m);
  }
  const pagadas: { cuota: CuotaDeuda; mov: Movimiento }[] = [];
  const porMes = new Map<string, CuotaDeuda[]>();
  for (const c of deuda.cuotas) {
    const mov = cargadas.get(c.numero);
    if (mov?.estado === "real") {
      pagadas.push({ cuota: c, mov });
      continue;
    }
    // Si se guardó como planificada desde Movimientos, vale lo guardado.
    const actual = mov ? { ...c, monto: mov.monto, mes: mesDeGasto(mov, cuentas) } : c;
    porMes.set(actual.mes, [...(porMes.get(actual.mes) ?? []), actual]);
  }
  return { pagadas, meses: [...porMes].sort(([a], [b]) => a.localeCompare(b)) };
}

export default async function Deudas() {
  const { supabase } = await requerirUsuario();
  const { datos, cuentasActivas, categorias: todas, contrapartes } = await cargarHogar(supabase);
  const hoy = hoyAR();
  const mesActual = mesDe(hoy);
  const cuentas = new Map(datos.cuentas.map((c) => [c.id, c]));
  const activas = datos.cuentas.filter((c) => cuentasActivas.includes(c.id)).map((c) => ({ id: c.id, nombre: c.nombre }));
  const categorias = todas.filter((c) => !c.archivada);
  const deudas = datos.deudas ?? [];

  if (activas.length === 0) {
    return (
      <p>
        Primero <Link href="/cuentas" className="underline">cargá tus cuentas</Link>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Deudas</h1>
        <p className={`mt-1 text-sm ${textoSuave}`}>
          Cuotas que pagás cuando te conviene, como la patente atrasada. Cada cuota va en un mes, y podés pasarla al
          mes anterior o al siguiente con las flechas, o juntar varias en el mismo mes. Con ✎ cambiás el monto de
          una cuota, y con ✎ Editar cuotas las cambiás todas juntas. La previsión las cuenta como gasto planificado
          de su mes; cuando las pagás quedan como movimiento real.
        </p>
      </div>

      {deudas.map((d) => {
        const { pagadas, meses } = situacion(d, datos.movimientos, cuentas);
        const restan = meses.reduce((s, [, cs]) => s + cs.reduce((t, c) => t + c.monto, 0), 0);
        const pagado = pagadas.reduce((s, p) => s + p.mov.monto, 0);
        const total = Math.max(0, ...d.cuotas.map((c) => c.numero));
        return (
          <section key={d.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-lg font-semibold">{d.descripcion}</h2>
              <span className={`text-sm ${textoSuave}`}>
                {cuentas.get(d.cuentaId)?.nombre}
                {d.contraparte && ` → ${d.contraparte}`} · pagadas {pagadas.length} de {d.cuotas.length}
              </span>
              <span className="ml-auto text-sm">
                Restan <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">−$ {pesosExactos(restan)}</span>
              </span>
              <BorrarDeuda id={d.id} nombre={d.descripcion} />
            </div>
            {meses.length > 0 && (
              <ul className={`${caja} divide-y divide-black/5 dark:divide-white/10`}>
                {meses.map(([mes, cuotas]) => (
                  <MesDeuda
                    key={mes}
                    deudaId={d.id}
                    mes={mes}
                    cuotas={cuotas}
                    total={total}
                    atrasado={mes < mesActual}
                    hoy={hoy}
                  />
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <EditarCuotas
                deudaId={d.id}
                cuotas={meses.flatMap(([, cs]) => cs)}
                total={total}
                mesActual={mesActual}
              />
            </div>
            {pagadas.length > 0 && (
              <details className="text-sm">
                <summary className={`cursor-pointer ${textoSuave}`}>
                  Pagadas: {pagadas.length} · $ {pesosExactos(pagado)}
                </summary>
                <ul className="mt-2 flex flex-col gap-1 pl-4">
                  {pagadas.map(({ cuota, mov }) => (
                    <li key={cuota.numero} className="flex gap-3">
                      <span className="text-green-700 dark:text-green-400">✓</span>
                      <span>
                        Cuota {cuota.numero}/{total}
                      </span>
                      <span className={textoSuave}>{diaMes(mov.fecha)}</span>
                      <span className="tabular-nums">$ {pesosExactos(mov.monto)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Nueva deuda</h2>
        <div className={`${caja} p-5`}>
          <FormularioDeuda cuentas={activas} categorias={categorias} contrapartes={contrapartes} mesActual={mesActual} />
        </div>
      </section>
    </div>
  );
}
