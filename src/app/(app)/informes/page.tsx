import { informeAMarkdown, SECCIONES, type Celda, type Informe } from "@/lib/finanzas/informe";
import { boton, caja, campo, etiqueta, textoSuave } from "../../estilos";
import { BotonesInforme } from "./botones";
import { informeDelHogar, leerParametros, PLAZOS } from "./datos";

const formato = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Valor({ celda }: { celda: Celda }) {
  if (typeof celda === "string") return <>{celda}</>;
  return <span className={celda < 0 ? "text-red-700 dark:text-red-400" : ""}>{formato.format(celda)}</span>;
}

function VistaInforme({ informe }: { informe: Informe }) {
  return (
    <article className="flex flex-col gap-6 print:gap-4 print:text-[10px]">
      <header>
        <h2 className="text-xl font-semibold">{informe.titulo}</h2>
        <ul className={`mt-2 list-disc pl-5 text-sm ${textoSuave} print:text-[10px]`}>
          {informe.notas.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </header>
      {informe.tablas.map((t) => (
        <section key={t.titulo} className="flex break-inside-avoid flex-col gap-2">
          <h3 className="font-semibold">{t.titulo}</h3>
          <p className={`text-sm ${textoSuave} print:text-[10px]`}>{t.nota}</p>
          <div className={`${caja} overflow-x-auto print:overflow-visible`}>
            <table className="w-full text-sm print:text-[9px]">
              <thead className={`text-left text-xs ${textoSuave} print:text-[9px]`}>
                <tr>
                  {t.columnas.map((c, i) => (
                    <th key={c} className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {t.filas.map((f, i) => (
                  <tr key={i} className={String(f[0]).toUpperCase() === f[0] && f[0] !== "" ? "font-semibold" : ""}>
                    {f.map((c, j) => (
                      <td
                        key={j}
                        className={`px-3 py-1.5 print:py-0.5 ${j > 0 ? "text-right" : ""} ${typeof c === "number" ? "whitespace-nowrap tabular-nums" : ""}`}
                      >
                        <Valor celda={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <section className="break-inside-avoid">
        <h3 className="font-semibold">Preguntas para analizar</h3>
        <ul className={`mt-2 list-disc pl-5 text-sm ${textoSuave} print:text-[10px]`}>
          {informe.preguntas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

export default async function Informes({ searchParams }: PageProps<"/informes">) {
  const parametros = await searchParams;
  const { incluir, atras, adelante, ver } = leerParametros(parametros);
  const informe = ver ? await informeDelHogar(parametros) : null;
  const consulta = new URLSearchParams([
    ["ver", "1"],
    ["atras", String(atras)],
    ["adelante", String(adelante)],
    ...incluir.map((s) => ["incluir", s]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Informes</h1>
        <p className={`mt-1 text-sm ${textoSuave}`}>
          Un resumen de tus finanzas para descargar en PDF o CSV, o copiar como texto. Está armado para pasárselo a una
          IA y pedirle ayuda con decisiones: cuánto podés invertir en una remodelación, qué cuota de auto podés pagar,
          dónde recortar.
        </p>
      </div>

      <form action="/informes" className={`${caja} flex flex-col gap-4 p-5 print:hidden`}>
        <input type="hidden" name="ver" value="1" />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Qué incluir (el resumen mensual va siempre)</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {Object.entries(SECCIONES).map(([clave, nombre]) => (
              <label key={clave} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="incluir"
                  value={clave}
                  defaultChecked={incluir.includes(clave as keyof typeof SECCIONES)}
                  className="size-4"
                />
                {nombre}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <label className={etiqueta}>
            Meses hacia atrás (reales)
            <select name="atras" defaultValue={atras} className={campo}>
              {PLAZOS.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "Solo el actual" : n}
                </option>
              ))}
            </select>
          </label>
          <label className={etiqueta}>
            Meses hacia adelante (previsión)
            <select name="adelante" defaultValue={adelante} className={campo}>
              {PLAZOS.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "Ninguno" : n}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={boton}>
            Generar informe
          </button>
        </div>
      </form>

      {informe && (
        <>
          <BotonesInforme csv={`/informes/csv?${consulta}`} texto={informeAMarkdown(informe)} />
          <VistaInforme informe={informe} />
        </>
      )}
    </div>
  );
}
