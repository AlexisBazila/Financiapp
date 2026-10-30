-- Un movimiento repartido en varias categorías: por ejemplo un ticket de $100.000 con $50.000 de comida
-- y $50.000 de limpieza. El movimiento sigue siendo uno (un solo monto en la cuenta), pero cada parte
-- cuenta en su categoría y en sus presupuestos.
--
-- `reparto`: [{"categoria_id": uuid, "monto": centavos}, ...] que suma `monto`. Nulo: una sola categoría,
-- la de `categoria_id` (que en un reparto es la de la primera parte).

alter table public.movimientos
  add column reparto jsonb check (reparto is null or jsonb_typeof(reparto) = 'array');
