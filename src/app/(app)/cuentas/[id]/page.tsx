import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarHogar } from "@/lib/datos/cargar";
import { simbolo } from "@/lib/datos/monedas";
import { estadoTarjeta, periodoDe, resumenDe } from "@/lib/finanzas/estado-tarjeta";
import { hoy, mesDe, mesesEntre, sumarMeses } from "@/lib/finanzas/fechas";
import { calcularPrevision, expandir } from "@/lib/finanzas/prevision";
import { resumenDeFecha } from "@/lib/finanzas/tarjeta";
import type { Cuenta as TipoCuenta, Movimiento } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../../estilos";
import { pesosExactos } from "../../../formato";
import { NuevoMovimiento } from "../../movimientos/formularios";
import { Leyenda, ListaMovimientos, MES, SelectorMes, tituloMes } from "../../movimientos/lista";
import { movimientosDelMes } from "../../movimientos/opciones";
import { FormularioCiclo } from "../formularios";
import { diaMes, TotalesTarjeta } from "../totales-tarjeta";

export default async function Cuenta({ params, searchParams }: PageProps<"/cuentas/[id]">) {
  const [{ id }, { mes: pedido }] = await Promise.all([params, searchParams]);
  const actual = mesDe(hoy());
  const mes = typeof pedido === "string" && MES.test(pedido) ? pedido : actual;

  const { supabase } = await requerirUsuario();
  const datosHogar = await cargarHogar(supabase);
  const { hogar, datos, categorias } = datosHogar;
  const cuenta = datos.cuentas.find((c) => c.id === id);
  if (!cuenta) notFound();

  if (cuenta.tarjeta) return <Tarjeta datosHogar={datosHogar} cuenta={cuenta} pedido={pedido} />;

  const { opciones, pagosAutomaticos, ahorrosPrevistos } = movimientosDelMes(datosHogar, mes, actual);
  const lista = [...expandir(datos, mes, mes), ...pagosAutomaticos, ...ahorrosPrevistos]
    .filter((m) => (m.cuentaId === id || m.cuentaDestinoId === id) && mesDe(m.fecha) === mes)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.descripcion.localeCompare(b.descripcion));

  // Saldo según la previsión, que parte de los saldos iniciales del mes de inicio. Sin presupuestos:
  // acá interesa lo cargado, no lo que se estima gastar.
  let saldos: { inicio: number; cierre: number } | undefined;
  if (mes >= hogar.mesInicio) {
    const prevision = calcularPrevision(
      { ...datos, presupuestos: [] },
      { desde: hogar.mesInicio, meses: mesesEntre(hogar.mesInicio, mes) + 1 },
    );
    const cierre = prevision[prevision.length - 1].saldos[id];
    const inicio = prevision.length > 1 ? prevision[prevision.length - 2].saldos[id] : cuenta.saldoInicial;
    saldos = { inicio, cierre };
  }
  const periodo = saldos ? saldos.cierre - saldos.inicio : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/cuentas" className={`text-sm hover:underline ${textoSuave}`}>
            ← Cuentas
          </Link>
          <h1 className="text-2xl font-semibold">{cuenta.nombre}</h1>
          {cuenta.titular && <p className={`text-sm ${textoSuave}`}>👤 {cuenta.titular}</p>}
        </div>
        {opciones.cuentas.length > 0 && (
          <NuevoMovimiento {...opciones} cuentaSugerida={id} fechaSugerida={mes === actual ? hoy() : `${mes}-01`} />
        )}
      </div>

      <SelectorMes mes={mes} actual={actual} ruta={`/cuentas/${id}`} />

      {saldos ? (
        <div className={`${caja} flex flex-wrap justify-between gap-4 p-4`}>
          <div>
            <div className={`text-sm ${textoSuave}`}>Saldo al cierre del mes</div>
            <div className="text-2xl font-semibold tabular-nums">
              {simbolo(cuenta.moneda)} {pesosExactos(saldos.cierre)}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-sm ${textoSuave}`}>Período</div>
            <div
              className={`text-xl font-semibold tabular-nums ${periodo >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
            >
              {periodo > 0 ? "+" : periodo < 0 ? "−" : ""}
              {simbolo(cuenta.moneda)} {pesosExactos(Math.abs(periodo))}
            </div>
          </div>
        </div>
      ) : (
        <p className={`text-sm ${textoSuave}`}>
          Antes del mes de inicio ({tituloMes(hogar.mesInicio)}) no se calculan saldos.
        </p>
      )}

      <Leyenda />

      <ListaMovimientos
        lista={lista}
        nombres={new Map(datos.cuentas.map((c) => [c.id, c.nombre]))}
        categorias={new Map(categorias.map((c) => [c.id, c]))}
        guardados={new Set(datos.movimientos.map((m) => m.id))}
        opciones={opciones}
        cuentaId={id}
        vacio={`No hay movimientos de ${cuenta.nombre} en ${tituloMes(mes).toLowerCase()}.`}
      />
    </div>
  );
}

/**
 * Una tarjeta se mira por período (del día siguiente al cierre anterior hasta el cierre), no por mes
 * calendario: `?mes=2026-11` es el período que cierra en noviembre.
 */
async function Tarjeta({
  datosHogar,
  cuenta,
  pedido,
}: {
  datosHogar: Awaited<ReturnType<typeof cargarHogar>>;
  cuenta: TipoCuenta;
  pedido: string | string[] | undefined;
}) {
  const { hogar, datos, categorias } = datosHogar;
  const id = cuenta.id;
  const fecha = hoy();
  const actual = resumenDeFecha(cuenta, fecha);
  const mes = typeof pedido === "string" && MES.test(pedido) ? pedido : actual;
  const periodo = periodoDe(cuenta, mes);
  const enPeriodo = (f: string) => f >= periodo.desde && f <= periodo.cierre;

  const delCierre = movimientosDelMes(datosHogar, mesDe(periodo.cierre), mesDe(fecha));
  const pagos = [
    ...delCierre.pagosAutomaticos,
    ...(mesDe(periodo.desde) === mesDe(periodo.cierre)
      ? []
      : movimientosDelMes(datosHogar, mesDe(periodo.desde), mesDe(fecha)).pagosAutomaticos),
  ];
  const deLaTarjeta = (m: Movimiento) =>
    m.tipo === "transferencia"
      ? (m.cuentaId === id || m.cuentaDestinoId === id) && enPeriodo(m.fecha)
      : m.cuentaId === id && resumenDe(cuenta, m) === mes;
  const lista = [...expandir(datos, sumarMeses(mes, -1), mes), ...pagos]
    .filter(deLaTarjeta)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.descripcion.localeCompare(b.descripcion));
  const consumo = lista.reduce(
    (total, m) => total + (m.tipo === "egreso" ? m.monto : m.tipo === "ingreso" ? -m.monto : 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/tarjetas" className={`text-sm hover:underline ${textoSuave}`}>
            ← Tarjetas
          </Link>
          <h1 className="text-2xl font-semibold">{cuenta.nombre}</h1>
          {cuenta.titular && <p className={`text-sm ${textoSuave}`}>👤 {cuenta.titular}</p>}
        </div>
        {delCierre.opciones.cuentas.length > 0 && (
          <NuevoMovimiento
            {...delCierre.opciones}
            cuentaSugerida={id}
            fechaSugerida={enPeriodo(fecha) ? fecha : periodo.desde}
          />
        )}
      </div>

      <div className={`${caja} p-4`}>
        <div className={`mb-3 text-sm ${textoSuave}`}>Hoy</div>
        <TotalesTarjeta estado={estadoTarjeta(datos, id, fecha, hogar.mesInicio)} />
      </div>

      <SelectorMes mes={mes} actual={actual} ruta={`/cuentas/${id}`} />

      <div className={`${caja} flex flex-col gap-3 p-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="font-medium">
              Período del {diaMes(periodo.desde)} al {diaMes(periodo.cierre)} · vence el {diaMes(periodo.vencimiento)}
            </div>
            <div className={`text-sm ${textoSuave}`}>
              {periodo.cargado ? "Fechas confirmadas" : "Fechas habituales, sin confirmar"}. Solo se ven las compras de
              este período; las de antes o después del cierre están en el período anterior o el siguiente.
            </div>
          </div>
          <div className="text-right">
            <div className={`text-sm ${textoSuave}`}>Consumo del período</div>
            <div
              className={`text-xl font-semibold tabular-nums ${consumo > 0 ? "text-red-600 dark:text-red-400" : ""}`}
            >
              {consumo > 0 ? "−" : ""}$ {pesosExactos(Math.abs(consumo))}
            </div>
          </div>
        </div>
        <details className="text-sm">
          <summary className={`cursor-pointer ${textoSuave}`}>Cambiar las fechas de este período</summary>
          <div className="mt-3">
            <FormularioCiclo
              key={`${periodo.cierre}-${periodo.vencimiento}`}
              cuentaId={id}
              mes={mes}
              cierre={periodo.cierre}
              vencimiento={periodo.vencimiento}
            />
          </div>
        </details>
      </div>

      <Leyenda />

      <ListaMovimientos
        lista={lista}
        nombres={new Map(datos.cuentas.map((c) => [c.id, c.nombre]))}
        categorias={new Map(categorias.map((c) => [c.id, c]))}
        guardados={new Set(datos.movimientos.map((m) => m.id))}
        opciones={delCierre.opciones}
        cuentaId={id}
        vacio={`No hay movimientos de ${cuenta.nombre} en este período.`}
      />
    </div>
  );
}
