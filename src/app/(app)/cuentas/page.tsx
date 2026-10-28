import Link from "next/link";
import { cargarHogar } from "@/lib/datos/cargar";
import { estadoTarjeta } from "@/lib/finanzas/estado-tarjeta";
import { hoy, mesDe, mesesEntre, nombreMes } from "@/lib/finanzas/fechas";
import { calcularPrevision, disponibilidadDe } from "@/lib/finanzas/prevision";
import type { Cuenta, Movimiento } from "@/lib/finanzas/tipos";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { caja, textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";
import { simbolo } from "@/lib/datos/monedas";
import {
  BotonArchivar,
  FormularioCotizacion,
  FormularioCuenta,
  FormularioMesInicio,
} from "./formularios";
import { Ayuda, TOTALIZADORES } from "../../totalizadores";

const verde = "text-green-700 dark:text-green-400";
const rojo = "text-red-600 dark:text-red-400";

/** "$ 1.234,00", "−US$ 5,00" */
function monto(valor: number, moneda?: string) {
  return `${valor < 0 ? "−" : ""}${simbolo(moneda)} ${pesosExactos(Math.abs(valor))}`;
}

/** Saldo real de hoy (lo confirmado), en verde si hay plata y en rojo si es deuda; abajo, cómo cierra el mes con lo planificado. */
function Saldo({ cuenta, real, plan, mes }: { cuenta: Cuenta; real: number; plan: number; mes: string }) {
  return (
    <span className="flex flex-col items-end" title="Saldo inicial más lo confirmado hasta hoy">
      <span className={`text-lg font-semibold tabular-nums ${real > 0 ? verde : real < 0 ? rojo : ""}`}>
        {monto(real, cuenta.moneda)}
      </span>
      {cuenta.moneda && cuenta.cambio && (
        <span className={`text-xs tabular-nums ${textoSuave}`}>
          ≈ $ {pesosExactos(Math.round(Math.abs(real) * cuenta.cambio))}
        </span>
      )}
      {plan !== real && (
        <span className={`text-xs tabular-nums ${textoSuave}`}>
          al cierre de {nombreMes(mes)} con lo planificado: {monto(plan, cuenta.moneda)}
        </span>
      )}
    </span>
  );
}

/** Lo que entró y salió de la cuenta en el mes (lo confirmado), con una barra que compara las dos cosas. */
function BalanceDelMes({
  entradas,
  salidas,
  moneda,
  mes,
}: {
  entradas: number;
  salidas: number;
  moneda?: string;
  mes: string;
}) {
  const balance = entradas - salidas;
  const mayor = Math.max(entradas, salidas, 1);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className={textoSuave}>Balance de {nombreMes(mes)}</span>
        <span className="tabular-nums">
          <span className={verde}>+{monto(entradas, moneda)}</span>{" "}
          <span className={rojo}>−{monto(salidas, moneda)}</span> ={" "}
          <strong className={balance > 0 ? verde : balance < 0 ? rojo : ""}>
            {balance > 0 ? "+" : ""}
            {monto(balance, moneda)}
          </strong>
        </span>
      </div>
      <div
        className="grid gap-0.5"
        role="img"
        aria-label={`Entró ${monto(entradas, moneda)} y salió ${monto(salidas, moneda)}`}
      >
        <div className="h-1.5 rounded-full bg-green-600" style={{ width: `${(entradas / mayor) * 100}%` }} />
        <div className="h-1.5 rounded-full bg-red-600" style={{ width: `${(salidas / mayor) * 100}%` }} />
      </div>
    </div>
  );
}

/** Entradas y salidas confirmadas de cada cuenta (no tarjeta) en el mes, en la moneda de cada cuenta. */
function movimientoDelMes(movimientos: Movimiento[], cuentas: Map<string, Cuenta>, mes: string) {
  const resultado = new Map<string, { entradas: number; salidas: number }>();
  const sumar = (id: string, campo: "entradas" | "salidas", valor: number) => {
    const actual = resultado.get(id) ?? { entradas: 0, salidas: 0 };
    actual[campo] += valor;
    resultado.set(id, actual);
  };
  for (const m of movimientos) {
    if (m.estado !== "real" || mesDe(m.fecha) !== mes) continue;
    if (m.tipo === "ingreso") sumar(m.cuentaId, "entradas", m.monto);
    else if (m.tipo === "egreso") sumar(m.cuentaId, "salidas", m.monto);
    else if (m.cuentaDestinoId) {
      sumar(m.cuentaId, "salidas", m.monto);
      const origen = cuentas.get(m.cuentaId);
      const destino = cuentas.get(m.cuentaDestinoId);
      sumar(m.cuentaDestinoId, "entradas", Math.round((m.monto * (origen?.cambio ?? 1)) / (destino?.cambio ?? 1)));
    }
  }
  return resultado;
}

/** Orden y título de cada grupo de la pantalla. */
const GRUPOS: [Cuenta["tipo"], string][] = [
  ["banco", "🏦 Bancos"],
  ["billetera", "📱 Billeteras virtuales"],
  ["efectivo", "💵 Efectivo"],
  ["inversion", "📈 Inversiones"],
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
  const titulares = [...new Set(datos.cuentas.map((c) => c.titular).filter((t): t is string => Boolean(t)))].sort();
  const fecha = hoy();
  const mesActual = mesDe(fecha);
  const cuentasPorId = new Map(datos.cuentas.map((c) => [c.id, c]));
  // Desde los saldos iniciales hasta el mes actual: solo lo confirmado (real) y con lo planificado (plan).
  const opciones = {
    desde: hogar.mesInicio,
    meses: Math.max(1, mesesEntre(hogar.mesInicio, mesActual) + 1),
    mesActual,
    hoy: fecha,
  };
  const real = calcularPrevision(datos, { ...opciones, estados: ["real"] }).at(-1)!;
  const plan = calcularPrevision(datos, opciones).at(-1)!;
  const delMes = movimientoDelMes(datos.movimientos, cuentasPorId, mesActual);
  // La deuda de las tarjetas, como en cada tarjeta: resúmenes sin pagar más el período en curso.
  const estados = activas.filter((c) => c.tarjeta).map((c) => estadoTarjeta(datos, c.id, fecha, hogar.mesInicio));
  const deudaTarjetas = estados.reduce((s, e) => s + e.deudaTotal, 0);
  // Cuotas que faltan: las de tarjeta de resúmenes posteriores al período en curso, y las demás desde el mes que viene.
  const deudaCuotas = estados.reduce((s, e) => s + e.cuotasFuturas, 0) + real.cuotasFuturasSinTarjeta;
  const totales = [
    {
      ...TOTALIZADORES.patrimonio,
      valor: real.disponible + real.disponible48h + real.reserva - deudaTarjetas - deudaCuotas,
    },
    { ...TOTALIZADORES.disponible, valor: real.disponible },
    { ...TOTALIZADORES.noInmediato, valor: real.disponible48h },
    { ...TOTALIZADORES.reserva, valor: real.reserva },
    { ...TOTALIZADORES.deudaTarjetas, valor: -deudaTarjetas, nota: "resúmenes sin pagar + período en curso" },
    { ...TOTALIZADORES.deudaCuotas, valor: -deudaCuotas, nota: "lo que falta de cuotas" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Cuentas</h1>

      <section className={`${caja} p-5`}>
        <FormularioMesInicio hogarId={hogar.id} mesInicio={hogar.mesInicio} />
        <p className={`mt-2 text-sm ${textoSuave}`}>
          La previsión parte de los saldos iniciales que cargues en cada cuenta (en Editar) para ese mes. Los
          movimientos anteriores no se cuentan.
        </p>
      </section>

      {activas.length > 0 && (
        <section>
          <h2 className={`mb-3 text-sm ${textoSuave}`}>Saldos reales hoy: saldo inicial más todo lo confirmado</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {totales.map((t) => (
              <div key={t.titulo} className={`${caja} p-4`} title={t.ayuda}>
                <div className={`flex items-center gap-1 text-sm ${textoSuave}`}>
                  {t.titulo}
                  <Ayuda texto={t.ayuda} />
                </div>
                <div className={`text-xl font-semibold tabular-nums ${t.valor > 0 ? verde : t.valor < 0 ? rojo : ""}`}>
                  {monto(t.valor)}
                </div>
                <div className={`text-xs ${textoSuave}`}>{t.nota}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activas.length === 0 && <p className={textoSuave}>Todavía no cargaste cuentas.</p>}
      <p className={`text-sm ${textoSuave}`}>
        Las tarjetas de crédito tienen su propia sección:{" "}
        <Link href="/tarjetas" className="underline">
          Tarjetas
        </Link>
        .
      </p>
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
                      {DISPONIBILIDAD[disponibilidadDe(c)]}
                      {c.moneda ? " (hay que cambiarla)" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Saldo cuenta={c} real={real.saldos[c.id] ?? 0} plan={plan.saldos[c.id] ?? 0} mes={mesActual} />
                    <BotonArchivar id={c.id} />
                  </div>
                </div>
                <BalanceDelMes
                  entradas={delMes.get(c.id)?.entradas ?? 0}
                  salidas={delMes.get(c.id)?.salidas ?? 0}
                  moneda={c.moneda}
                  mes={mesActual}
                />
                <details className="text-sm">
                  <summary className={`cursor-pointer ${textoSuave}`}>Editar</summary>
                  <div className="mt-3">
                    <FormularioCuenta titulares={titulares} inicial={c} />
                  </div>
                </details>
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
              Las cuentas en otras monedas se suman en pesos con este valor. Podés cargarlo a mano o traer la cotización
              de compra del día.
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
        <FormularioCuenta titulares={titulares} />
      </section>
    </div>
  );
}
