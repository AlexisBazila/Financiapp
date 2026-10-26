-- Límite de compra de las tarjetas, para ver cuánto queda disponible.
--
-- En centavos, como los saldos. Opcional: sin límite cargado no se muestra el disponible.

alter table public.cuentas add column limite bigint check (limite > 0);
