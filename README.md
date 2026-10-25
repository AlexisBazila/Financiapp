# Financiapp

App web para registrar y prever las finanzas del hogar: cuentas, cuotas, tarjetas con cierre variable,
ingresos recurrentes que se confirman antes de impactar, ahorro reservado y simulaciones que se comparan
y se pueden aplicar al plan.

## Estado

Etapa 1 en curso. Hoy la app muestra la previsión con datos de ejemplo; todavía no guarda nada.

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
  - `recurrentes.ts`: ocurrencias mensuales, pendientes hasta confirmarlas.
  - `escenarios.ts`: simulaciones como diferencias sobre el plan base; aplicar y archivar.
  - `prevision.ts`: la grilla mes a mes (ingresos, egresos, disponible, reserva, deuda de tarjetas).
- `src/app/`: interfaz (Next.js).
