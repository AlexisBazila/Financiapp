import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { hoy, mesDe, mesesEntre, nombreMes, sumarMeses } from "@/lib/finanzas/fechas";
import { calcularPrevision, disponibilidadDe, esAhorro, expandir } from "@/lib/finanzas/prevision";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { NuevoMovimiento } from "../movimientos/formularios";
import { ListaMovimientos } from "../movimientos/lista";
import { movimientosDelMes } from "../movimientos/opciones";
import { BotonQuitarMonto, FormularioMontoDelMes, FormularioObjetivo } from "./formularios";

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function Ahorro({ searchParams }: PageProps<"/ahorro">) {
  const { mes: pedido } = await searchParams;
  const fecha = hoy();
  const actual = mesDe(fecha);
  const { supabase } = await requerirUsuario();
  const datosHogar = await cargarHogar(supabase);
  const { hogar, datos, cuentasActivas, categorias } = datosHogar;
  const pedidoValido = typeof pedido === "string" && MES.test(pedido) ? pedido : actual;
  const mes = pedidoValido < hogar.mesInicio ? hogar.mesInicio : pedidoValido;

  const activas = datos.cuentas.filter((c) => cuentasActivas.includes(c.id));
  const origenes = activas.filter((c) => !c.tarjeta).map((c) => ({ id: c.id, nombre: c.nombre }));
  // Las cuentas de ahorro e inversión primero.
  const destinos = [...activas.filter((c) => !c.tarjeta)]
    .sort((a, b) => Number(disponibilidadDe(a) === "inmediata") - Number(disponibilidadDe(b) === "inmediata"))
    .map((c) => ({ id: c.id, nombre: c.nombre }));
  const nombres = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));
  const objetivos = datos.objetivos ?? [];

  const opciones = {
    desde: hogar.mesInicio,
    meses: mesesEntre(hogar.mesInicio, mes) + 1,
    mesActual: actual,
    hoy: fecha,
  };
  const plan = calcularPrevision(datos, opciones).at(-1)!;
  const real = calcularPrevision(datos, { ...opciones, estados: ["real"] }).at(-1)!;
  const ahorrado = (m: typeof plan) => m.reserva + m.disponible48h;
  const diferencia = ahorrado(plan) - ahorrado(real);

  // Ingresos a ahorro y retiros del mes: las transferencias entre una cuenta para gastar y una de ahorro.
  const { opciones: deMovimientos, ahorrosPrevistos } = movimientosDelMes(datosHogar, mes, actual);
  const deAhorro = new Set(datos.cuentas.filter(esAhorro).map((c) => c.id));
  const movimientosDeAhorro = [...expandir(datos, mes, mes), ...ahorrosPrevistos]
    .filter(
      (m) =>
        m.tipo === "transferencia" &&
        mesDe(m.fecha) === mes &&
        deAhorro.has(m.cuentaId) !== deAhorro.has(m.cuentaDestinoId ?? ""),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.descripcion.localeCompare(b.descripcion));
  const hayCuentasDeAhorro = deMovimientos.cuentas.some((c) => c.ahorro);
  const fechaSugerida = mes === actual ? fecha : `${mes}-01`;

  const flecha =
    "rounded-lg border border-black/15 px-3 py-1.5 text-lg leading-none hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ahorro e inversión</h1>
        <p className={`mt-1 text-sm ${textoSuave}`}>
          Lo que planeás pasar cada mes a tus cuentas de ahorro o inversión. Las transferencias que cargues a la cuenta
          de destino cuentan como hechas; lo que falta, la previsión lo pasa a fin de mes.
        </p>
      </div>

      <nav className="flex items-center gap-3" aria-label="Mes">
        <Link href={`/ahorro?mes=${sumarMeses(mes, -1)}`} className={flecha} aria-label="Mes anterior">
          ‹
        </Link>
        <h2 className="min-w-28 text-center text-lg font-semibold">{nombreMes(mes)}</h2>
        <Link href={`/ahorro?mes=${sumarMeses(mes, 1)}`} className={flecha} aria-label="Mes siguiente">
          ›
        </Link>
      </nav>

      <section className={`${caja} grid gap-4 p-5 sm:grid-cols-3`}>
        <div>
          <div className={`text-sm ${textoSuave}`}>Ahorrado real</div>
          <div className="text-2xl font-semibold tabular-nums text-green-700 dark:text-green-400">
            $ {pesosExactos(ahorrado(real))}
          </div>
          <div className={`text-xs ${textoSuave}`}>lo que está en las cuentas, con lo ya confirmado</div>
        </div>
        <div>
          <div className={`text-sm ${textoSuave}`}>Planificado al cierre de {nombreMes(mes)}</div>
          <div className="text-2xl font-semibold tabular-nums text-sky-700 dark:text-sky-400">
            $ {pesosExactos(ahorrado(plan))}
          </div>
          <div className={`text-xs ${textoSuave}`}>
            {diferencia > 0 ? `+$ ${pesosExactos(diferencia)} por pasar` : "nada pendiente"}
          </div>
        </div>
        <div>
          <div className={`text-sm ${textoSuave}`}>Objetivo del mes</div>
          <div className="text-2xl font-semibold tabular-nums">$ {pesosExactos(plan.ahorroDelMes)}</div>
          <div className={`text-xs ${textoSuave}`}>
            hecho $ {pesosExactos(plan.objetivos.reduce((total, o) => total + o.hecho, 0))}
          </div>
        </div>
        <p className={`text-xs sm:col-span-3 ${textoSuave}`}>
          Ahorrado es lo que hay en las cuentas marcadas como reserva de ahorro o disponible no inmediato.
        </p>
      </section>

      <section className={`${caja} flex flex-col gap-4 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Ingresos y retiros de {nombreMes(mes)}</h3>
            <p className={`text-sm ${textoSuave}`}>
              Lo que pasás a tus cuentas de ahorro o sacás de ellas, confirmado o planificado. Lo que sacás suma al
              total activos de la previsión: no es un ingreso, pero lo podés usar en el mes.
            </p>
          </div>
          {hayCuentasDeAhorro && (
            <div className="flex flex-wrap gap-2">
              <NuevoMovimiento
                {...deMovimientos}
                tipoInicial="ingreso_ahorro"
                texto="🐷 Ingreso a ahorro"
                fechaSugerida={fechaSugerida}
              />
              <NuevoMovimiento
                {...deMovimientos}
                tipoInicial="retiro_ahorro"
                texto="↩ Retiro de ahorro"
                fechaSugerida={fechaSugerida}
              />
            </div>
          )}
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <div className={textoSuave}>Ingresado (objetivos y otros)</div>
            <div className="text-lg font-semibold tabular-nums text-sky-700 dark:text-sky-400">
              $ {pesosExactos(plan.ahorroDelMes)}
            </div>
            <div className={`text-xs ${textoSuave}`}>confirmado $ {pesosExactos(real.ahorroDelMes)}</div>
          </div>
          <div>
            <div className={textoSuave}>Sacado de ahorro</div>
            <div className="text-lg font-semibold tabular-nums text-sky-700 dark:text-sky-400">
              $ {pesosExactos(plan.retirosAhorro)}
            </div>
            <div className={`text-xs ${textoSuave}`}>confirmado $ {pesosExactos(real.retirosAhorro)}</div>
          </div>
          <div>
            <div className={textoSuave}>Neto del mes</div>
            <div className="text-lg font-semibold tabular-nums">
              {plan.ahorroDelMes - plan.retirosAhorro < 0 ? "−" : ""}${" "}
              {pesosExactos(Math.abs(plan.ahorroDelMes - plan.retirosAhorro))}
            </div>
            <div className={`text-xs ${textoSuave}`}>ingresado − sacado, con lo planificado</div>
          </div>
        </div>
        {!hayCuentasDeAhorro ? (
          <p className={`text-sm ${textoSuave}`}>
            Para cargarlos necesitás una cuenta marcada como reserva de ahorro o disponible no inmediato.
          </p>
        ) : (
          <ListaMovimientos
            lista={movimientosDeAhorro}
            nombres={nombres}
            categorias={new Map(categorias.map((c) => [c.id, c]))}
            guardados={new Set(datos.movimientos.map((m) => m.id))}
            opciones={deMovimientos}
            vacio={`No hay ingresos ni retiros de ahorro en ${nombreMes(mes)}.`}
          />
        )}
      </section>

      {objetivos.length === 0 && <p className={textoSuave}>Todavía no hay objetivos de ahorro.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {objetivos.map((o) => {
          const delMes = plan.objetivos.find((x) => x.id === o.id);
          const porcentaje = delMes?.objetivo ? Math.min(100, Math.round((delMes.hecho / delMes.objetivo) * 100)) : 0;
          const falta = delMes ? Math.max(0, delMes.objetivo - delMes.hecho) : 0;
          const ajustes = Object.entries(o.montosPorMes ?? {}).sort(([a], [b]) => a.localeCompare(b));
          return (
            <section key={o.id} className={`${caja} flex flex-col gap-3 p-5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  {o.icono} {o.nombre}
                </h3>
                <span className="tabular-nums">
                  {o.porcentaje
                    ? `${o.porcentaje.toLocaleString("es-AR")}% de los ingresos`
                    : `$ ${pesosExactos(o.monto ?? 0)} / mes`}
                </span>
              </div>
              {delMes ? (
                <>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
                    role="progressbar"
                    aria-valuenow={porcentaje}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full rounded-full bg-sky-600" style={{ width: `${porcentaje}%` }} />
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span>
                      Objetivo de {nombreMes(mes)}{" "}
                      <strong className="tabular-nums">$ {pesosExactos(delMes.objetivo)}</strong>
                    </span>
                    <span>
                      Hecho <strong className="tabular-nums">$ {pesosExactos(delMes.hecho)}</strong>
                    </span>
                    <span
                      className={falta > 0 ? "text-sky-700 dark:text-sky-400" : "text-green-700 dark:text-green-400"}
                    >
                      {falta > 0 ? (
                        <>
                          Falta <strong className="tabular-nums">$ {pesosExactos(falta)}</strong>
                        </>
                      ) : (
                        "Cumplido ✓"
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <p className={`text-sm ${textoSuave}`}>No corre en {nombreMes(mes)}.</p>
              )}
              <p className={`text-xs ${textoSuave}`}>
                De {nombres.get(o.cuentaOrigenId)} a {nombres.get(o.cuentaDestinoId)} · todos los meses desde{" "}
                {nombreMes(o.desde)}
                {o.hasta ? ` hasta ${nombreMes(o.hasta)}` : ""}
              </p>
              {ajustes.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                  {ajustes.map(([m, monto]) => (
                    <li key={m} className="flex items-center gap-3">
                      <span className="tabular-nums">
                        {nombreMes(m)}: $ {pesosExactos(monto)} (a mano)
                      </span>
                      <BotonQuitarMonto id={o.id} mes={m} />
                    </li>
                  ))}
                </ul>
              )}
              <details className="text-sm">
                <summary className={`cursor-pointer ${textoSuave}`}>Poner a mano el monto de un mes</summary>
                <div className="mt-3">
                  <FormularioMontoDelMes id={o.id} mes={mes} />
                </div>
              </details>
              <details className="text-sm">
                <summary className={`cursor-pointer ${textoSuave}`}>Editar</summary>
                <div className="mt-3">
                  <FormularioObjetivo origenes={origenes} destinos={destinos} mesActual={actual} inicial={o} />
                </div>
              </details>
            </section>
          );
        })}
      </div>

      <details className={`${caja} p-5`} open={objetivos.length === 0}>
        <summary className="cursor-pointer font-medium">＋ Nuevo objetivo de ahorro o inversión</summary>
        <div className="mt-4">
          <FormularioObjetivo origenes={origenes} destinos={destinos} mesActual={actual} />
        </div>
      </details>
    </div>
  );
}
