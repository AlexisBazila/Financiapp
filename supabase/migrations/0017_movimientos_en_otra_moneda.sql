-- Gastos e ingresos en otra moneda en una cuenta en pesos, como una compra en dólares con la tarjeta.
-- `monto` queda en esa moneda y la app lo pasa a pesos con la cotización del día (tabla cotizaciones).
-- Nulo: el movimiento está en la moneda de la cuenta.

alter table public.movimientos
  add column moneda text check (moneda ~ '^[A-Z]{3}$' and moneda <> 'ARS');
