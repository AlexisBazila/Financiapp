-- Presupuestos: un monto mensual para un grupo de categorías.
--
-- Se repite todos los meses de `desde` a `hasta` (sin `hasta`, siempre). Lo gastado en esas categorías
-- se descuenta y lo que resta se prevé como gasto del mes, desde `cuenta_id`.

create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  icono text not null default '' check (length(icono) <= 16),
  monto bigint not null check (monto > 0),
  cuenta_id uuid not null,
  desde public.mes not null,
  hasta public.mes,
  -- Categorías o subcategorías; una categoría incluye sus subcategorías.
  categoria_ids uuid[] not null check (cardinality(categoria_ids) > 0),
  creado timestamptz not null default now(),
  foreign key (hogar_id, cuenta_id) references public.cuentas (hogar_id, id),
  check (hasta is null or hasta >= desde)
);

alter table public.presupuestos enable row level security;
grant select, insert, update, delete on public.presupuestos to authenticated;
create policy "datos de mis hogares" on public.presupuestos for all to authenticated
  using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id));
