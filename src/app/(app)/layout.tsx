import Link from "next/link";
import { Suspense } from "react";
import { textoSuave } from "../estilos";
import { salir } from "../login/acciones";

const SECCIONES = [
  { href: "/", nombre: "Previsión" },
  { href: "/movimientos", nombre: "Movimientos" },
  { href: "/plan", nombre: "Plan" },
  { href: "/presupuestos", nombre: "Presupuestos" },
  { href: "/ahorro", nombre: "Ahorro" },
  { href: "/cuentas", nombre: "Cuentas" },
  { href: "/categorias", nombre: "Categorías" },
];

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm sm:px-8">
          <span className="font-semibold">Financiapp</span>
          {SECCIONES.map((s) => (
            <Link key={s.href} href={s.href} className={`whitespace-nowrap hover:underline ${textoSuave}`}>
              {s.nombre}
            </Link>
          ))}
          <form action={salir} className="ml-auto">
            <button type="submit" className={`whitespace-nowrap hover:underline ${textoSuave}`}>
              Salir
            </button>
          </form>
        </div>
      </nav>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        <Suspense fallback={<p className={textoSuave}>Cargando…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
