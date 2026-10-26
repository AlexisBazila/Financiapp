-- Pago del resumen de las tarjetas.
--
-- Con `pago_automatico`, la previsión paga lo vencido al vencimiento desde `cuenta_pago_id`, pero solo
-- hasta el saldo positivo de esa cuenta: lo que falta queda como deuda. Sin él, solo cuentan los pagos
-- cargados a mano (transferencias a la tarjeta). Un pago cargado en el mes reemplaza al automático.

alter table public.cuentas add column pago_automatico boolean not null default true;
