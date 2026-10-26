# Financiapp

App web para registrar y prever las finanzas del hogar: cuentas, cuotas, tarjetas con cierre variable,
ingresos recurrentes que se confirman antes de impactar, ahorro reservado y simulaciones que se comparan
y se pueden aplicar al plan.

## Estado

Etapa 1 en curso: login, cuentas editables agrupadas por tipo y con titular (con tarjetas: cierre y vencimiento de cada mes, límite, deuda total y del período), movimientos, compras en cuotas,
préstamos, ingresos y gastos recurrentes (con confirmación mensual), categorías con subcategorías, emoji
y color, movimientos por mes que se confirman y concilian con el banco (con el comercio o la persona
de cada pago, como figura en el resumen), presupuestos
mensuales por categorías (de todas las cuentas o de algunas), la vista de cada cuenta y la previsión
con los datos guardados en Supabase. `/ejemplo` muestra la previsión con datos de muestra.

## Configurar Supabase y Vercel

1. En Supabase, abrí el **SQL Editor**, pegá cada archivo de `supabase/migrations/` en orden y ejecutalo.
2. En Supabase, en *Authentication → URL Configuration*, poné como **Site URL** la dirección de Vercel
   (por ejemplo `https://financiapp.vercel.app`) y agregala también en **Redirect URLs** como
   `https://financiapp.vercel.app/**`.
3. En Vercel, en *Settings → Environment Variables*, cargá `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project URL y publishable key de Supabase).

Para correrla en tu computadora, poné esas dos variables en un archivo `.env.local`.

## Cómo correrla

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # tests del motor de previsión
```

## Estructura

- `src/lib/finanzas/`: motor de previsión, sin dependencias de la interfaz.
  - `tipos.ts`: modelo de datos (montos en centavos enteros).
  - `cuotas.ts`: compras en cuotas y préstamos (francés, alemán o tabla manual).
  - `tarjeta.ts`: a qué resumen entra cada compra según el cierre de cada mes.
  - `estado-tarjeta.ts`: período de cada resumen, deuda total, deuda del período y disponible del límite.
  - `recurrentes.ts`: ocurrencias mensuales, pendientes hasta confirmarlas.
  - `escenarios.ts`: simulaciones como diferencias sobre el plan base; aplicar y archivar.
  - `prevision.ts`: la grilla mes a mes (ingresos, egresos, disponible, reserva, deuda de tarjetas).
- `src/lib/datos/`: lectura de Supabase, conversión al modelo del motor y categorías.
- `src/app/`: interfaz (Next.js). Las páginas con sesión están en `src/app/(app)/`.
- `supabase/migrations/`: tablas, permisos y políticas de acceso por hogar.
