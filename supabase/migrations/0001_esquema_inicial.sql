-- Esquema inicial de Financiapp.
--
-- Todo pertenece a un hogar. Cada usuario ve y modifica solo los datos de los hogares
-- de los que es miembro (políticas RLS). Las tablas no se exponen solas a la API:
-- los permisos se dan explícitamente al rol `authenticated`.
-- Montos en centavos (bigint). Meses como texto "AAAA-MM".

create domain public.mes as text check (value ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- Hogares y miembros ---------------------------------------------------------------

create table public.hogares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default 'Mi hogar',
  -- Los saldos iniciales de las cuentas son los del comienzo de este mes.
  mes_inicio public.mes not null default to_char(now(), 'YYYY-MM'),
  creado timestamptz not null default now()
);

create table public.miembros (
  hogar_id uuid not null references public.hogares on delete cascade,
  usuario_id uuid not null references auth.users on delete cascade,
  rol text not null default 'admin' check (rol in ('admin', 'miembro')),
  primary key (hogar_id, usuario_id)
);

create index miembros_usuario on public.miembros (usuario_id);

-- security definer para que las políticas puedan consultar miembros sin recursión.
create function public.es_miembro(hogar uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros m
    where m.hogar_id = hogar and m.usuario_id = (select auth.uid())
  );
$$;

-- Hogar del usuario actual; es el valor por defecto de hogar_id en todas las tablas.
create function public.mi_hogar() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.hogar_id from public.miembros m
  where m.usuario_id = (select auth.uid())
  order by m.hogar_id
  limit 1;
$$;

-- Al registrarse, cada usuario recibe su propio hogar.
create function public.crear_hogar_inicial() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  nuevo uuid;
begin
  insert into public.hogares default values returning id into nuevo;
  insert into public.miembros (hogar_id, usuario_id, rol) values (nuevo, new.id, 'admin');
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_hogar_inicial();

-- Cuentas y tarjetas ---------------------------------------------------------------

create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('efectivo', 'banco', 'billetera', 'inversion', 'tarjeta')),
  disponibilidad text not null default 'inmediata' check (disponibilidad in ('inmediata', '48h', 'reserva')),
  -- Saldo al comienzo de hogares.mes_inicio. En tarjetas, el resumen cerrado a pagar ese mes.
  saldo_inicial bigint not null default 0,
  dia_cierre int check (dia_cierre between 1 and 31),
  dia_vencimiento int check (dia_vencimiento between 1 and 31),
  cuenta_pago_id uuid,
  archivada boolean not null default false,
  creado timestamptz not null default now(),
  unique (hogar_id, id),
  foreign key (hogar_id, cuenta_pago_id) references public.cuentas (hogar_id, id),
  check (tipo <> 'tarjeta' or (dia_cierre is not null and dia_vencimiento is not null and cuenta_pago_id is not null))
);

create table public.ciclos_tarjeta (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  cuenta_id uuid not null,
  mes public.mes not null,
  cierre date not null,
  vencimiento date not null check (vencimiento > cierre),
  unique (cuenta_id, mes),
  foreign key (hogar_id, cuenta_id) references public.cuentas (hogar_id, id) on delete cascade
);

-- Movimientos y reglas que generan movimientos -------------------------------------

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  fecha date not null,
  descripcion text not null default '',
  tipo text not null check (tipo in ('ingreso', 'egreso', 'transferencia')),
  monto bigint not null check (monto > 0),
  cuenta_id uuid not null,
  cuenta_destino_id uuid,
  categoria text,
  estado text not null default 'real' check (estado in ('real', 'planificado', 'pendiente')),
  origen jsonb not null default '{"tipo": "manual"}',
  mes_resumen public.mes,
  creado_por uuid default auth.uid() references auth.users on delete set null,
  creado timestamptz not null default now(),
  foreign key (hogar_id, cuenta_id) references public.cuentas (hogar_id, id),
  foreign key (hogar_id, cuenta_destino_id) references public.cuentas (hogar_id, id),
  check ((tipo = 'transferencia') = (cuenta_destino_id is not null))
);

create index movimientos_hogar_fecha on public.movimientos (hogar_id, fecha);

create table public.planes_cuotas (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  descripcion text not null,
  categoria text not null,
  cuenta_id uuid not null,
  fecha_compra date not null,
  monto_total bigint not null check (monto_total > 0),
  cantidad int not null check (cantidad between 1 and 120),
  tasa_anual numeric(7, 3) not null default 0 check (tasa_anual >= 0),
  creado timestamptz not null default now(),
  foreign key (hogar_id, cuenta_id) references public.cuentas (hogar_id, id)
);

create table public.prestamos (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  descripcion text not null,
  categoria text not null,
  cuenta_id uuid not null,
  capital bigint not null default 0 check (capital >= 0),
  primera_cuota date not null,
  cantidad int not null check (cantidad between 1 and 480),
  tasa_anual numeric(7, 3) not null default 0 check (tasa_anual >= 0),
  sistema text not null check (sistema in ('frances', 'aleman', 'manual')),
  cuotas_manuales bigint[],
  creado timestamptz not null default now(),
  foreign key (hogar_id, cuenta_id) references public.cuentas (hogar_id, id)
);

create table public.recurrentes (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  descripcion text not null,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  categoria text not null,
  cuenta_id uuid not null,
  monto_estimado bigint not null check (monto_estimado > 0),
  dia_del_mes int not null check (dia_del_mes between 1 and 31),
  desde public.mes not null,
  hasta public.mes,
  requiere_confirmacion boolean not null default false,
  creado timestamptz not null default now(),
  foreign key (hogar_id, cuenta_id) references public.cuentas (hogar_id, id)
);

-- Escenarios: guardan solo sus diferencias con el plan base (ver src/lib/finanzas/escenarios.ts).
create table public.escenarios (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  nombre text not null,
  padre_id uuid,
  estado text not null default 'activo' check (estado in ('activo', 'aplicado', 'archivado')),
  cambios jsonb not null default '[]',
  creado timestamptz not null default now(),
  unique (hogar_id, id),
  foreign key (hogar_id, padre_id) references public.escenarios (hogar_id, id) on delete set null (padre_id)
);

-- Permisos y políticas ---------------------------------------------------------------

grant usage on schema public to authenticated;
grant execute on function public.es_miembro(uuid), public.mi_hogar() to authenticated;
revoke execute on function public.crear_hogar_inicial() from public, anon, authenticated;

alter table public.hogares enable row level security;
alter table public.miembros enable row level security;

grant select, update on public.hogares to authenticated;
create policy "ver mis hogares" on public.hogares for select to authenticated using (public.es_miembro(id));
create policy "editar mis hogares" on public.hogares for update to authenticated
  using (public.es_miembro(id)) with check (public.es_miembro(id));

grant select on public.miembros to authenticated;
create policy "ver miembros de mis hogares" on public.miembros for select to authenticated
  using (public.es_miembro(hogar_id));

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'cuentas', 'ciclos_tarjeta', 'movimientos', 'planes_cuotas', 'prestamos', 'recurrentes', 'escenarios'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tabla);
    execute format(
      'create policy "datos de mis hogares" on public.%I for all to authenticated '
      'using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id))',
      tabla
    );
  end loop;
end;
$$;
