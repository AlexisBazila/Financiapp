-- Titular de cada cuenta y presupuestos de algunas cuentas.
--
-- `titular` es la persona de la casa a la que pertenece la cuenta (texto libre, opcional).
-- `presupuestos.cuenta_ids` son las cuentas cuyos gastos cuentan para el presupuesto; null = todas.
-- `presupuestos.cuenta_id` sigue siendo la cuenta de la que sale lo que resta.

alter table public.cuentas add column titular text
  check (titular is null or char_length(titular) between 1 and 40);

alter table public.presupuestos add column cuenta_ids uuid[]
  check (cuenta_ids is null or cardinality(cuenta_ids) > 0);
