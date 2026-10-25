-- Comercio, persona o cuenta a la que va un pago (o de la que viene un cobro). Opcional.
--
-- Sirve para conciliar: en el resumen de la tarjeta figura el comercio ("BERCOMAT"), no lo que compraste.
-- Las cuotas, los préstamos y los recurrentes lo pasan a cada movimiento que generan.

alter table public.movimientos add column contraparte text
  check (contraparte is null or char_length(contraparte) between 1 and 80);
alter table public.planes_cuotas add column contraparte text
  check (contraparte is null or char_length(contraparte) between 1 and 80);
alter table public.prestamos add column contraparte text
  check (contraparte is null or char_length(contraparte) between 1 and 80);
alter table public.recurrentes add column contraparte text
  check (contraparte is null or char_length(contraparte) between 1 and 80);
