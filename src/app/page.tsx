import { datosEjemplo, escenariosEjemplo, MES_INICIAL, MESES } from "@/lib/finanzas/datos-ejemplo";
import { VistaPrevision } from "./vista-prevision";

export default function Inicio() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Financiapp</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Previsión de las finanzas del hogar. Por ahora con datos de ejemplo; todavía no se guarda nada.
        </p>
      </header>
      <VistaPrevision datos={datosEjemplo} escenarios={escenariosEjemplo} desde={MES_INICIAL} meses={MESES} />
    </main>
  );
}
