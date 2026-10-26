import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarHogar } from "@/lib/datos/cargar";
import { hoy, mesDe, mesesEntre } from "@/lib/finanzas/fechas";
import { calcularPrevision, expandir } from "@/lib/finanzas/prevision";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../../estilos";
import { pesosExactos } from "../../../formato";
import { NuevoMovimiento } from "../../movimientos/formularios";
import { Leyenda, ListaMovimientos, MES, SelectorMes, tituloMes } from "../../movimientos/lista";
import { movimientosDelMes } from "../../movimientos/opciones";

export default async function Cuenta({ params, searchParams }: PageProps<"/cuentas/[id]">) {
  const [{ id }, { mes: pedido }] = await Promise.all([params, searchParams]);
  const actual = mesDe(hoy());
  const mes = typeof pedido === "string" && MES.test(pedido) ? pedido : actual;

  const { supabase } = await requerirUsuario();
  const datosHogar = await cargarHogar(supabase);
  const { hogar, datos, categorias } = datosHogar;
  const cuenta = datos.cuentas.find((c) => c.id === id);
  if (!cuenta) notFound();

  const { opciones, pagosAutomaticos } = movimientosDelMes(datosHogar, mes, actual);
  const lista = [...expandir(datos, mes, mes), ...pagosAutomaticos]
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
  const esTarjeta = Boolean(cuenta.tarjeta);
  const periodo = saldos ? saldos.cierre - saldos.inicio : 0;
  // En una tarjeta el saldo es deuda: que suba es malo.
  const periodoBueno = esTarjeta ? periodo <= 0 : periodo >= 0;

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
          <NuevoMovimiento {...opciones} fechaSugerida={mes === actual ? hoy() : `${mes}-01`} />
        )}
      </div>

      <SelectorMes mes={mes} actual={actual} ruta={`/cuentas/${id}`} />

      {saldos ? (
        <div className={`${caja} flex flex-wrap justify-between gap-4 p-4`}>
          <div>
            <div className={`text-sm ${textoSuave}`}>{esTarjeta ? "Deuda" : "Saldo"} al cierre del mes</div>
            <div className="text-2xl font-semibold tabular-nums">$ {pesosExactos(saldos.cierre)}</div>
          </div>
          <div className="text-right">
            <div className={`text-sm ${textoSuave}`}>Período</div>
            <div
              className={`text-xl font-semibold tabular-nums ${periodoBueno ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
            >
              {periodo > 0 ? "+" : periodo < 0 ? "−" : ""}$ {pesosExactos(Math.abs(periodo))}
            </div>
          </div>
        </div>
      ) : (
        <p className={`text-sm ${textoSuave}`}>
          Antes del mes de inicio ({tituloMes(hogar.mesInicio)}) no se calculan saldos.
        </p>
      )}
      {esTarjeta && (
        <p className={`-mt-3 text-xs ${textoSuave}`}>
          Las compras suman a la deuda cuando cierra el resumen y se descuentan cuando se paga.
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
