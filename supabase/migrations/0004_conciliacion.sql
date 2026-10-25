-- Conciliación de movimientos y cuotas cargadas.
--
-- `conciliado` marca un movimiento chequeado contra el extracto del banco o la tarjeta; no cambia la previsión.
-- Las cuotas y los recurrentes se generan solos; cuando se confirman o se editan se guardan como movimiento
-- con su origen, y ese movimiento reemplaza al generado. Puede haber uno solo por cuota o por mes.

alter table public.movimientos add column conciliado boolean not null default false;

create unique index movimientos_un_origen on public.movimientos (
  hogar_id,
  (origen ->> 'tipo'),
  (coalesce(origen ->> 'planId', origen ->> 'prestamoId', origen ->> 'recurrenteId')),
  (coalesce(origen ->> 'numero', origen ->> 'mes'))
) where origen ->> 'tipo' <> 'manual';
