import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { hoy } from "@/lib/finanzas/fechas";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { BotonBorrar, FormularioMovimiento } from "./formularios";

const ULTIMOS = 100;

export default async function Movimientos() {
  const { supabase } = await requerirUsuario();
  const { datos, cuentasActivas } = await cargarHogar(supabase);
  const nombres = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));
  const cuentas = datos.cuentas.filter((c) => cuentasActivas.includes(c.id)).map((c) => ({ id: c.id, nombre: c.nombre }));
  const categorias = [...new Set(datos.movimientos.flatMap((m) => (m.categoria ? [m.categoria] : [])))].sort();
  const ultimos = [...datos.movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, ULTIMOS);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Movimientos</h1>

      <section className={`${caja} p-5`}>
        {cuentas.length === 0 ? (
          <p className="text-sm">
            Primero <Link href="/cuentas" className="underline">cargá tus cuentas</Link>.
          </p>
        ) : (
          <FormularioMovimiento cuentas={cuentas} categorias={categorias} hoy={hoy()} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Últimos movimientos</h2>
        {ultimos.length === 0 ? (
          <p className={textoSuave}>Todavía no hay movimientos.</p>
        ) : (
          <ul className={`${caja} divide-y divide-black/5 dark:divide-white/10`}>
            {ultimos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className={`tabular-nums ${textoSuave}`}>{m.fecha}</span>
                <span className="min-w-0 flex-1">
                  {m.descripcion || m.categoria || (m.tipo === "transferencia" ? "Transferencia" : "Sin descripción")}
                  <span className={`block text-xs ${textoSuave}`}>
                    {m.tipo === "transferencia"
                      ? `${nombres.get(m.cuentaId)} → ${nombres.get(m.cuentaDestinoId ?? "")}`
                      : `${nombres.get(m.cuentaId)}${m.categoria ? ` · ${m.categoria}` : ""}`}
                    {m.estado !== "real" && " · planificado"}
                  </span>
                </span>
                <span
                  className={`tabular-nums ${m.tipo === "ingreso" ? "text-green-700 dark:text-green-400" : ""}`}
                >
                  {m.tipo === "ingreso" ? "+" : m.tipo === "egreso" ? "−" : ""}$ {pesosExactos(m.monto)}
                </span>
                <BotonBorrar id={m.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
