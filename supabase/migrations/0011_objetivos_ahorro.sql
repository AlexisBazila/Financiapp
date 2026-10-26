-- Objetivos de ahorro o inversión: cuánto se planea pasar cada mes de una cuenta a otra.
--
-- El monto del mes es fijo (`monto`) o un porcentaje de los ingresos del mes (`porcentaje`), sin contar lo
-- que sobró del mes anterior. `montos_por_mes` cambia el monto de meses puntuales: {"2026-12": 47895668}.
-- Se repite todos los meses de `desde` a `hasta` (sin `hasta`, siempre). Las transferencias cargadas de
-- la cuenta de origen a la de destino en el mes cuentan como lo hecho; lo que falta, la previsión lo
-- prevé a fin de mes.

create table public.objetivos_ahorro (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  icono text not null default '' check (length(icono) <= 16),
  cuenta_origen_id uuid not null,
  cuenta_destino_id uuid not null,
  monto bigint check (monto > 0),
  porcentaje numeric(5, 2) check (porcentaje > 0 and porcentaje <= 100),
  montos_por_mes jsonb not null default '{}'::jsonb,
  desde public.mes not null,
  hasta public.mes,
  creado timestamptz not null default now(),
  foreign key (hogar_id, cuenta_origen_id) references public.cuentas (hogar_id, id),
  foreign key (hogar_id, cuenta_destino_id) references public.cuentas (hogar_id, id),
  check (cuenta_origen_id <> cuenta_destino_id),
  check ((monto is null) <> (porcentaje is null)),
  check (hasta is null or hasta >= desde)
);

alter table public.objetivos_ahorro enable row level security;
grant select, insert, update, delete on public.objetivos_ahorro to authenticated;
create policy "datos de mis hogares" on public.objetivos_ahorro for all to authenticated
  using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id));
