import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { actualizarCotizaciones, monedasAActualizar } from "@/lib/datos/bcra";
import { requerirUsuario } from "@/lib/supabase/servidor";
import { textoSuave } from "../estilos";
import { salir } from "../login/acciones";
import { MenuLateral, MenuSuperior } from "./navegacion";

const logo = (
  <Link href="/" aria-label="Financiapp, inicio">
    <Image src="/logo-blanco.png" alt="Financiapp" width={640} height={123} priority className="h-8 w-auto" />
  </Link>
);

const botonSalir = (
  <form action={salir}>
    <button type="submit" className="text-sm text-white/60 hover:text-white hover:underline">
      Salir
    </button>
  </form>
);

/**
 * Pone al día las cotizaciones del BCRA (dólar, euro y real) la primera vez que se entra después de las
 * 17 hs. No muestra nada y no frena la página: corre aparte, dentro de su propio Suspense.
 */
async function ActualizarCotizaciones() {
  const { supabase } = await requerirUsuario();
  const { data } = await supabase.from("cotizaciones").select("moneda, fuente, actualizada");
  const actuales = Object.fromEntries((data ?? []).map((c) => [c.moneda as string, c]));
  await actualizarCotizaciones(supabase, monedasAActualizar(actuales, new Date()));
  return null;
}

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="sticky top-0 z-10 hidden h-screen w-56 shrink-0 flex-col gap-8 bg-black px-4 py-6 lg:flex">
        <div className="px-2">{logo}</div>
        <nav aria-label="Secciones" className="flex-1">
          <MenuLateral />
        </nav>
        <div className="px-3">{botonSalir}</div>
      </aside>
      <header className="sticky top-0 z-10 bg-black lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {logo}
          {botonSalir}
        </div>
        <nav aria-label="Secciones">
          <MenuSuperior />
        </nav>
      </header>
      <Suspense>
        <ActualizarCotizaciones />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-8 sm:px-8">
        <Suspense fallback={<p className={textoSuave}>Cargando…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
