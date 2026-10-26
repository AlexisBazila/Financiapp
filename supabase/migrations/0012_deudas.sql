-- Deudas en cuotas que se pagan cuando conviene (por ejemplo la patente atrasada).
--
-- `cuotas` tiene cada cuota con el mes en que se planea pagar: [{"numero": 1, "monto": 4250600, "mes": "2026-12"}].
-- Las cuotas se mueven de mes y en un mes puede haber varias. Al pagar una queda un movimiento real con
-- origen {"tipo": "deuda", "deudaId": ..., "numero": ...}, que reemplaza a la cuota planificada.

create table public.deudas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  descripcion text not null check (length(btrim(descripcion)) between 1 and 80),
  categoria text not null,
  categoria_id uuid,
  contraparte text check (length(contraparte) <= 80),
  cuenta_id uuid not null,
  dia_del_mes smallint not null default 10 check (dia_del_mes between 1 and 31),
  cuotas jsonb not null default '[]'::jsonb check (jsonb_typeof(cuotas) = 'array'),
  creado timestamptz not null default now(),
  foreign key (hogar_id, cuenta_id) references public.cuentas (hogar_id, id),
  foreign key (hogar_id, categoria_id) references public.categorias (hogar_id, id) on delete set null (categoria_id)
);

alter table public.deudas enable row level security;
grant select, insert, update, delete on public.deudas to authenticated;
create policy "datos de mis hogares" on public.deudas for all to authenticated
  using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id));

-- Una sola cuota pagada por número, también en las deudas.
drop index public.movimientos_un_origen;
create unique index movimientos_un_origen on public.movimientos (
  hogar_id,
  (origen ->> 'tipo'),
  (coalesce(origen ->> 'planId', origen ->> 'prestamoId', origen ->> 'recurrenteId', origen ->> 'deudaId')),
  (coalesce(origen ->> 'numero', origen ->> 'mes'))
) where origen ->> 'tipo' <> 'manual';
