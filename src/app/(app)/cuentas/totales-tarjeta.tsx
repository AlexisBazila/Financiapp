import type { EstadoTarjeta } from "@/lib/finanzas/estado-tarjeta";
import type { Fecha } from "@/lib/finanzas/tipos";
import { textoSuave } from "../../estilos";
import { pesosExactos } from "../../formato";

/** "23/10". */
export const diaMes = (fecha: Fecha) => `${Number(fecha.slice(8, 10))}/${Number(fecha.slice(5, 7))}`;

const deuda = (centavos: number) => `${centavos > 0 ? "−" : ""}$ ${pesosExactos(Math.abs(centavos))}`;

/** El mismo total contando solo lo conciliado: lo que ya figura en el resumen del banco. */
function Conciliado({ centavos }: { centavos: number }) {
  return (
    <div className="mt-1 text-sm tabular-nums" title="Solo compras y pagos marcados como conciliados">
      <span className={textoSuave}>Conciliado: </span>
      <span className="font-medium">{deuda(centavos)}</span>
    </div>
  );
}

/**
 * Deuda total, deuda del período y lo que queda del límite. El disponible va de verde a rojo a medida que
 * se acerca al límite.
 */
export function TotalesTarjeta({ estado, compacto = false }: { estado: EstadoTarjeta; compacto?: boolean }) {
  const { periodo, limite, disponible } = estado;
  const usado = limite && disponible !== undefined ? Math.min(1, Math.max(0, 1 - disponible / limite)) : 0;
  // 120 es verde y 0 es rojo.
  const color = `hsl(${Math.round(120 * (1 - usado))} 70% 45%)`;
  const rojo = "text-red-600 dark:text-red-400";
  const numero = compacto ? "font-semibold tabular-nums" : "text-xl font-semibold tabular-nums";

  return (
    <div className={`grid gap-4 ${compacto ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-3"}`}>
      <div>
        <div className={`text-sm ${textoSuave}`}>Deuda total</div>
        <div className={`${numero} ${estado.deudaTotal > 0 ? rojo : ""}`}>{deuda(estado.deudaTotal)}</div>
        <div className={`text-xs ${textoSuave}`}>resúmenes sin pagar + período en curso</div>
        <Conciliado centavos={estado.deudaTotalConciliada} />
      </div>
      <div>
        <div className={`text-sm ${textoSuave}`}>Deuda del período</div>
        <div className={`${numero} ${estado.consumoPeriodo > 0 ? rojo : ""}`}>{deuda(estado.consumoPeriodo)}</div>
        <div className={`text-xs ${textoSuave}`}>
          del {diaMes(periodo.desde)} al {diaMes(periodo.cierre)} · vence el {diaMes(periodo.vencimiento)}
        </div>
        <Conciliado centavos={estado.consumoPeriodoConciliado} />
      </div>
      <div className={compacto ? "col-span-2 sm:col-span-1" : ""}>
        {limite !== undefined && disponible !== undefined ? (
          <>
            <div className={`text-sm ${textoSuave}`}>Disponible del límite</div>
            <div className={numero} style={{ color: disponible < 0 ? undefined : color }}>
              <span className={disponible < 0 ? rojo : ""}>
                {disponible < 0 ? "−" : ""}$ {pesosExactos(Math.abs(disponible))}
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
              role="progressbar"
              aria-label="Límite usado"
              aria-valuenow={Math.round(usado * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full" style={{ width: `${usado * 100}%`, backgroundColor: color }} />
            </div>
            <div className={`mt-1 text-xs ${textoSuave}`}>
              de $ {pesosExactos(limite)}
              {estado.cuotasFuturas > 0 && ` · $ ${pesosExactos(estado.cuotasFuturas)} en cuotas futuras`}
            </div>
          </>
        ) : (
          <>
            <div className={`text-sm ${textoSuave}`}>Disponible del límite</div>
            <div className={`text-sm ${textoSuave}`}>Cargá el límite en Editar para verlo.</div>
          </>
        )}
      </div>
    </div>
  );
}
