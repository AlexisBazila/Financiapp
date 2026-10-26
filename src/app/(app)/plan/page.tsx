import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { generarCuotasPlan, generarCuotasPrestamo } from "@/lib/finanzas/cuotas";
import { hoy as hoyAR, mesDe, nombreMes } from "@/lib/finanzas/fechas";
import { instanciarRecurrente } from "@/lib/finanzas/recurrentes";
import type { Cuenta, Movimiento } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import {
  BotonBorrar,
  ConfirmarCuota,
  ConfirmarPendiente,
  EditarPrestamo,
  FormularioCuotas,
  FormularioPrestamo,
  FormularioRecurrente,
} from "./formularios";

/**
 * "cuota 4 de 12 · restan $ 512.000": las de antes de empezar a usar la app, las confirmadas y, si se debitan
 * solas, las que ya vencieron hasta hoy.
 */
function progreso(
  cuotas: Movimiento[],
  hoy: string,
  { inicio = "", confirmadas = new Set<number>(), soloConfirmadas = false } = {},
): string {
  const numero = (c: Movimiento) => (c.origen.tipo === "prestamo" || c.origen.tipo === "cuotas" ? c.origen.numero : 0);
  const paga = (c: Movimiento) =>
    c.fecha < inicio || confirmadas.has(numero(c)) || (!soloConfirmadas && c.fecha <= hoy);
  const pagadas = cuotas.filter(paga).length;
  const restante = cuotas.filter((c) => !paga(c)).reduce((s, c) => s + c.monto, 0);
  if (pagadas >= cuotas.length) return "terminado";
  const actual = pagadas === 0 ? `empieza en ${nombreMes(mesDe(cuotas[0].fecha))}` : `cuota ${pagadas} de ${cuotas.length}`;
  return `${actual} · restan $ ${pesosExactos(restante)}`;
}

export default async function Plan() {
  const { supabase } = await requerirUsuario();
  const { hogar, datos, cuentasActivas, categorias: todas, contrapartes } = await cargarHogar(supabase);
  const hoy = hoyAR();
  const mesActual = mesDe(hoy);
  const cuentasPorId = new Map<string, Cuenta>(datos.cuentas.map((c) => [c.id, c]));
  const activas = datos.cuentas.filter((c) => cuentasActivas.includes(c.id));
  const opciones = activas.map((c) => ({ id: c.id, nombre: c.nombre }));
  const sinTarjetas = activas.filter((c) => !c.tarjeta).map((c) => ({ id: c.id, nombre: c.nombre }));
  const categorias = todas.filter((c) => !c.archivada);
  const cuotasDePrestamos = categorias.find((c) => c.tipo === "egreso" && c.nombre === "Cuotas de préstamos")?.id;

  /** Números de cuota ya cargados de cada préstamo (confirmados a mano). */
  const confirmadas = new Map<string, Set<number>>();
  for (const m of datos.movimientos) {
    if (m.origen.tipo !== "prestamo" || m.estado !== "real") continue;
    const set = confirmadas.get(m.origen.prestamoId) ?? new Set<number>();
    set.add(m.origen.numero);
    confirmadas.set(m.origen.prestamoId, set);
  }
  const cargadas = new Set(
    datos.movimientos.flatMap((m) => (m.origen.tipo === "prestamo" ? [`${m.origen.prestamoId}:${m.origen.numero}`] : [])),
  );
  const finDeMes = `${mesActual}-31`;
  const pendientes = [
    ...datos.recurrentes
      .filter((r) => r.requiereConfirmacion)
      .flatMap((r) => instanciarRecurrente(r, datos.movimientos, hogar.mesInicio, mesActual)),
    ...datos.prestamos
      .filter((p) => p.requiereConfirmacion)
      .flatMap(generarCuotasPrestamo)
      .filter(
        (c) =>
          c.estado === "pendiente" &&
          c.origen.tipo === "prestamo" &&
          c.fecha >= `${hogar.mesInicio}-01` &&
          c.fecha <= finDeMes &&
          !cargadas.has(`${c.origen.prestamoId}:${c.origen.numero}`),
      ),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (activas.length === 0) {
    return (
      <p>
        Primero <Link href="/cuentas" className="underline">cargá tus cuentas</Link>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold">Plan</h1>

      {pendientes.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Por confirmar</h2>
          <p className={`mb-3 text-sm ${textoSuave}`}>
            Hasta que los confirmes, la previsión usa el monto estimado.
          </p>
          <ul className={`${caja} divide-y divide-black/5 dark:divide-white/10`}>
            {pendientes.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="text-sm">
                  <span className="font-medium">{p.descripcion}</span>{" "}
                  <span className={textoSuave}>
                    · {nombreMes(p.origen.tipo === "recurrente" ? p.origen.mes : mesDe(p.fecha))} ·{" "}
                    {p.origen.tipo === "prestamo" ? "cuota" : "estimado"} $
                    {pesosExactos(p.monto)}
                  </span>
                </div>
                {p.origen.tipo === "prestamo" && <ConfirmarCuota mov={p} />}
                {p.origen.tipo === "recurrente" && (
                  <ConfirmarPendiente
                    recurrenteId={p.origen.recurrenteId}
                    mes={p.origen.mes}
                    montoSugerido={pesosExactos(p.monto)}
                    fechaSugerida={p.fecha}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Compras en cuotas</h2>
        {datos.planesCuotas.length > 0 && (
          <ul className={`${caja} divide-y divide-black/5 dark:divide-white/10`}>
            {datos.planesCuotas.map((p) => {
              const cuenta = cuentasPorId.get(p.cuentaId);
              const cuotas = cuenta ? generarCuotasPlan(p, cuenta) : [];
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="min-w-48 flex-1">
                    <span className="font-medium">{p.descripcion}</span>
                    <span className={`block text-xs ${textoSuave}`}>
                      {cuenta?.nombre}
                      {p.contraparte && ` → ${p.contraparte}`} · {p.cantidad} cuotas de $ {pesosExactos(cuotas[0]?.monto ?? 0)}
                      {p.tasaAnual ? ` · ${p.tasaAnual}% anual` : " · sin interés"}
                    </span>
                  </span>
                  <span className={textoSuave}>{cuotas.length > 0 && progreso(cuotas, hoy)}</span>
                  <BotonBorrar tabla="planes_cuotas" id={p.id} pregunta={`¿Borrar "${p.descripcion}" y todas sus cuotas?`} />
                </li>
              );
            })}
          </ul>
        )}
        <div className={`${caja} p-5`}>
          <FormularioCuotas cuentas={opciones} categorias={categorias} contrapartes={contrapartes} hoy={hoy} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Préstamos</h2>
        {datos.prestamos.length > 0 && (
          <ul className={`${caja} divide-y divide-black/5 dark:divide-white/10`}>
            {datos.prestamos.map((p) => {
              const cuotas = generarCuotasPrestamo(p).filter((c) => c.tipo === "egreso");
              const iguales = cuotas.every((c) => c.monto === cuotas[0]?.monto);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="min-w-48 flex-1">
                    <span className="font-medium">{p.descripcion}</span>
                    <span className={`block text-xs ${textoSuave}`}>
                      {cuentasPorId.get(p.cuentaId)?.nombre}
                      {p.contraparte && ` → ${p.contraparte}`} · {cuotas.length} cuotas
                      {p.sistema !== "manual"
                        ? ` · ${p.tasaAnual}% anual`
                        : iguales && cuotas.length > 0
                          ? ` de $ ${pesosExactos(cuotas[0].monto)}`
                          : " cargadas a mano"}
                      {p.requiereConfirmacion ? " · se confirma cada cuota" : " · se debita sola"}
                      {p.ingreso && ` · entró $ ${pesosExactos(p.ingreso.monto)} en ${nombreMes(p.ingreso.mes)}`}
                    </span>
                  </span>
                  <span className={textoSuave}>
                    {cuotas.length > 0 && progreso(cuotas, hoy, {
                        inicio: `${hogar.mesInicio}-01`,
                        confirmadas: confirmadas.get(p.id),
                        soloConfirmadas: p.requiereConfirmacion,
                      })}
                  </span>
                  <EditarPrestamo
                    inicial={p}
                    cuentas={sinTarjetas}
                    categorias={categorias}
                    contrapartes={contrapartes}
                    hoy={hoy}
                  />
                  <BotonBorrar tabla="prestamos" id={p.id} pregunta={`¿Borrar el préstamo "${p.descripcion}"?`} />
                </li>
              );
            })}
          </ul>
        )}
        <div className={`${caja} p-5`}>
          <FormularioPrestamo
            cuentas={sinTarjetas}
            categorias={categorias}
            contrapartes={contrapartes}
            categoriaSugerida={cuotasDePrestamos}
            hoy={hoy}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ingresos y gastos que se repiten</h2>
        {datos.recurrentes.length > 0 && (
          <ul className={`${caja} divide-y divide-black/5 dark:divide-white/10`}>
            {datos.recurrentes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-48 flex-1">
                  <span className="font-medium">{r.descripcion}</span>
                  <span className={`block text-xs ${textoSuave}`}>
                    {cuentasPorId.get(r.cuentaId)?.nombre}
                    {r.contraparte && ` ${r.tipo === "ingreso" ? "←" : "→"} ${r.contraparte}`} · día {r.diaDelMes} · desde {nombreMes(r.desde)}
                    {r.hasta ? ` hasta ${nombreMes(r.hasta)}` : ""}
                    {r.requiereConfirmacion ? " · se confirma cada mes" : ""}
                  </span>
                </span>
                <span className={`tabular-nums ${r.tipo === "ingreso" ? "text-green-700 dark:text-green-400" : ""}`}>
                  {r.tipo === "ingreso" ? "+" : "−"}$ {pesosExactos(r.montoEstimado)}
                </span>
                <BotonBorrar
                  tabla="recurrentes"
                  id={r.id}
                  pregunta={`¿Borrar "${r.descripcion}"? Los meses ya confirmados quedan como movimientos.`}
                />
              </li>
            ))}
          </ul>
        )}
        <div className={`${caja} p-5`}>
          <FormularioRecurrente
            cuentas={opciones}
            categorias={categorias}
            contrapartes={contrapartes}
            mesActual={mesActual}
          />
        </div>
      </section>
    </div>
  );
}
