import { informeACSV } from "@/lib/finanzas/informe";
import { informeDelHogar } from "../datos";

export async function GET(pedido: Request) {
  const parametros = Object.fromEntries(
    [...new URL(pedido.url).searchParams.keys()].map((k) => [k, new URL(pedido.url).searchParams.getAll(k)]),
  );
  const informe = await informeDelHogar(parametros);
  return new Response(informeACSV(informe), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="informe-finanzas-${informe.generado}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
