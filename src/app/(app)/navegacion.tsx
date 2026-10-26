"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

/** Íconos de trazo, 24×24, con el color del texto. */
const trazo = (d: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5 shrink-0"
    aria-hidden
  >
    {d}
  </svg>
);

const SECCIONES = [
  {
    href: "/",
    nombre: "Previsión",
    icono: trazo(
      <>
        <path d="M3 3v18h18" />
        <path d="m7 15 4-4 3 3 5-6" />
      </>,
    ),
  },
  {
    href: "/movimientos",
    nombre: "Movimientos",
    icono: trazo(
      <>
        <path d="M7 4v16m0 0-3-3m3 3 3-3" />
        <path d="M17 20V4m0 0-3 3m3-3 3 3" />
      </>,
    ),
  },
  {
    href: "/plan",
    nombre: "Plan",
    icono: trazo(
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4m8-4v4" />
      </>,
    ),
  },
  {
    href: "/deudas",
    nombre: "Deudas",
    icono: trazo(
      <>
        <path d="M4 4h12l4 4v12H4z" />
        <path d="M8 10h8M8 14h8M8 18h4" />
      </>,
    ),
  },
  {
    href: "/presupuestos",
    nombre: "Presupuestos",
    icono: trazo(
      <>
        <path d="M21 12a9 9 0 1 1-9-9v9z" />
        <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
      </>,
    ),
  },
  {
    href: "/ahorro",
    nombre: "Ahorro",
    icono: trazo(
      <>
        <path d="M5 11a7 6 0 0 1 13-2h2v4l-2 1-1 3h-2v-1.5a8 8 0 0 1-4 0V17H9l-1-3a5 5 0 0 1-3-3z" />
        <path d="M11 7h3" />
      </>,
    ),
  },
  {
    href: "/cuentas",
    nombre: "Cuentas",
    icono: trazo(
      <>
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18" />
      </>,
    ),
  },
  {
    href: "/categorias",
    nombre: "Categorías",
    icono: trazo(
      <>
        <path d="M3 12V4h8l10 10-8 8z" />
        <circle cx="7.5" cy="8.5" r="1.5" />
      </>,
    ),
  },
];

const activa = (ruta: string, href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));

/** La sección actual sale de la URL; mientras no se sabe, el menú se muestra sin ninguna marcada. */
function conRuta(Menu: (props: { ruta: string }) => ReactNode) {
  function ConRuta() {
    return <Menu ruta={usePathname()} />;
  }
  return function MenuConRuta() {
    return (
      <Suspense fallback={<Menu ruta="" />}>
        <ConRuta />
      </Suspense>
    );
  };
}

/** Menú lateral en pantallas anchas. */
export const MenuLateral = conRuta(function Lateral({ ruta }: { ruta: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {SECCIONES.map((s) => (
        <li key={s.href}>
          <Link
            href={s.href}
            aria-current={activa(ruta, s.href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              activa(ruta, s.href) ? "bg-white/15 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {s.icono}
            {s.nombre}
          </Link>
        </li>
      ))}
    </ul>
  );
});

/** Menú de pestañas con íconos, debajo del logo, en el celular. */
export const MenuSuperior = conRuta(function Superior({ ruta }: { ruta: string }) {
  return (
    <ul className="flex gap-1 overflow-x-auto px-2 pb-2">
      {SECCIONES.map((s) => (
        <li key={s.href}>
          <Link
            href={s.href}
            aria-current={activa(ruta, s.href) ? "page" : undefined}
            className={`flex min-w-16 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] whitespace-nowrap ${
              activa(ruta, s.href) ? "bg-white/15 text-white" : "text-white/70"
            }`}
          >
            {s.icono}
            {s.nombre}
          </Link>
        </li>
      ))}
    </ul>
  );
});
