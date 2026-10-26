-- Cuentas en otras monedas y tipos de cambio.
--
-- `cuentas.moneda`: código ISO de la moneda de la cuenta; sus saldos y movimientos están en esa moneda.
-- `cotizaciones`: cuántos pesos vale una unidad de cada moneda, para sumar todo en pesos en la previsión.
-- Se carga a mano o se trae de una cotización publicada (`fuente`).

alter table public.cuentas add column moneda text not null default 'ARS' check (moneda ~ '^[A-Z]{3}$');

create table public.cotizaciones (
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  moneda text not null check (moneda ~ '^[A-Z]{3}$' and moneda <> 'ARS'),
  -- Pesos por unidad de la moneda.
  valor numeric(14, 4) not null check (valor > 0),
  fuente text not null default 'manual' check (length(fuente) <= 40),
  actualizada timestamptz not null default now(),
  primary key (hogar_id, moneda)
);

alter table public.cotizaciones enable row level security;
grant select, insert, update, delete on public.cotizaciones to authenticated;
create policy "datos de mis hogares" on public.cotizaciones for all to authenticated
  using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id));
