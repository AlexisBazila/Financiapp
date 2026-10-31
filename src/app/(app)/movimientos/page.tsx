import Link from "next/link";
import { etiqueta } from "@/lib/datos/categorias";
import { cargarHogar } from "@/lib/datos/cargar";
import { hoy, mesDe } from "@/lib/finanzas/fechas";
import { expandir } from "@/lib/finanzas/prevision";
import type { Movimiento } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { categoriasElegidas, filtrar, FormularioFiltros, hayFiltros, leerFiltros, montoEnCategorias } from "./filtros";
import { NuevoMovimiento } from "./formularios";
import { movimientosDelMes } from "./opciones";
import { Leyenda, ListaMovimientos, MES, SelectorMes, tituloMes } from "./lista";

export default async function Movimientos({ searchParams }: PageProps<"/movimientos">) {
  const params = await searchParams;
  const pedido = params.mes;
  const filtros = leerFiltros(params);
  const actual = mesDe(hoy());
  const mes = typeof pedido === "string" && MES.test(pedido) ? pedido : actual;

  const { supabase } = await requerirUsuario();
  const hogar = await cargarHogar(supabase);
  const { datos, categorias, contrapartes } = hogar;
  const { opciones, pagosAutomaticos, ahorrosPrevistos } = movimientosDelMes(hogar, mes, actual);

  const delMes = [...expandir(datos, mes, mes), ...pagosAutomaticos, ...ahorrosPrevistos]
    .filter((m) => mesDe(m.fecha) === mes)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.descripcion.localeCompare(b.descripcion));
  const lista = filtrar(delMes, filtros, categorias, datos.presupuestos ?? []);
  // Filtrando por categoría, de los repartidos cuenta solo lo que es de ella.
  const elegidas = categoriasElegidas(filtros, categorias, datos.presupuestos ?? []);
  const repartidos = new Map(
    elegidas ? lista.filter((m) => m.partes?.length).map((m) => [m.id, montoEnCategorias(m, elegidas)]) : [],
  );
  const nombreFiltro = filtros.cat?.startsWith("grupo:")
    ? ((datos.presupuestos ?? []).find((p) => p.id === filtros.cat!.slice(6))?.nombre ?? "el presupuesto")
    : etiqueta(categorias.find((c) => c.id === filtros.cat) ?? { icono: "", nombre: "la categoría" });
  const suma = (tipo: Movimiento["tipo"]) =>
    lista.filter((m) => m.tipo === tipo).reduce((s, m) => s + (repartidos.get(m.id) ?? m.monto), 0);
  const sinConfirmar = lista.filter((m) => m.estado !== "real").length;
  const sinConciliar = lista.filter((m) => m.estado === "real" && !m.conciliado).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Movimientos</h1>
        {opciones.cuentas.length === 0 ? (
          <p className="text-sm">
            Primero{" "}
            <Link href="/cuentas" className="underline">
              cargá tus cuentas
            </Link>
            .
          </p>
        ) : (
          <NuevoMovimiento {...opciones} fechaSugerida={mes === actual ? hoy() : `${mes}-01`} />
        )}
      </div>

      <SelectorMes
        mes={mes}
        actual={actual}
        ruta="/movimientos"
        consulta={Object.entries(filtros)
          .map(([clave, valor]) => `&${clave}=${encodeURIComponent(valor)}`)
          .join("")}
      />

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>
          Ingresos{" "}
          <strong className="tabular-nums text-green-700 dark:text-green-400">$ {pesosExactos(suma("ingreso"))}</strong>
        </span>
        <span>
          Gastos{" "}
          <strong className="tabular-nums text-red-700 dark:text-red-400">$ {pesosExactos(suma("egreso"))}</strong>
        </span>
        <span className={textoSuave}>
          {sinConfirmar} sin confirmar · {sinConciliar} sin conciliar
          {hayFiltros(filtros) && ` · ${lista.length} de ${delMes.length} con los filtros`}
        </span>
      </div>

      <FormularioFiltros
        filtros={filtros}
        mes={mes}
        categorias={categorias}
        presupuestos={hogar.presupuestos}
        contrapartes={contrapartes}
      />

      <Leyenda />

      <ListaMovimientos
        lista={lista}
        nombres={new Map(datos.cuentas.map((c) => [c.id, c.nombre]))}
        categorias={new Map(categorias.map((c) => [c.id, c]))}
        guardados={new Set(datos.movimientos.map((m) => m.id))}
        opciones={opciones}
        filtro={elegidas ? { nombre: nombreFiltro, montos: repartidos } : undefined}
        vacio={
          hayFiltros(filtros)
            ? `Ningún movimiento de ${tituloMes(mes).toLowerCase()} coincide con los filtros.`
            : `No hay movimientos en ${tituloMes(mes).toLowerCase()}.`
        }
      />
    </div>
  );
}
