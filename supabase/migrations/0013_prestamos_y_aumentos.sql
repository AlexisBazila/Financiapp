-- Presupuestos con aumento mensual y préstamos más completos.
--
-- `aumento_mensual`: % que sube el presupuesto cada mes desde `desde`, para acompañar la inflación.
-- `requiere_confirmacion`: las cuotas del préstamo quedan pendientes hasta confirmarlas (si no, se debitan solas).
-- `ingreso_mes` e `ingreso_monto`: la plata del préstamo que entra a la cuenta y en qué mes; sin ellos, solo
-- cuentan las cuotas.

alter table public.presupuestos
  add column aumento_mensual numeric(5, 2) not null default 0 check (aumento_mensual >= 0 and aumento_mensual <= 100);

alter table public.prestamos
  add column requiere_confirmacion boolean not null default false,
  add column ingreso_mes public.mes,
  add column ingreso_monto bigint check (ingreso_monto > 0),
  add check ((ingreso_mes is null) = (ingreso_monto is null));
