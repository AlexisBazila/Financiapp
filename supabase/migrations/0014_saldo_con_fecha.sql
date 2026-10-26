-- Fecha del saldo inicial de cada cuenta.
--
-- Sin fecha, el saldo inicial es el del comienzo del mes de inicio y cuentan todos los movimientos del mes.
-- Con fecha (por ejemplo, el saldo que se ve hoy en el banco), los movimientos de la cuenta hasta ese día ya
-- están incluidos en el saldo: siguen contando como ingresos o gastos del mes, pero no lo vuelven a cambiar.

alter table public.cuentas add column saldo_fecha date;
