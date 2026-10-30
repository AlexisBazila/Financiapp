-- Acceso restringido. Hasta ahora cualquiera con el link podía crearse una cuenta (con un hogar
-- propio y vacío). Desde acá, crear una cuenta exige un código de invitación:
--   · invitación a un hogar: la crea un admin del hogar; quien la usa entra a ese hogar.
--   · licencia (hogar_id nulo): la crea un administrador de la app; quien la usa recibe un hogar nuevo.
-- Los administradores de la app además ven todas las cuentas y pueden suspender hogares.

-- Administradores de la app ---------------------------------------------------------

create table public.administradores (
  usuario_id uuid primary key references auth.users on delete cascade
);

-- El primer usuario registrado es el dueño de la app.
insert into public.administradores (usuario_id)
select id from auth.users order by created_at limit 1;

alter table public.administradores enable row level security;

create function public.es_administrador() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.administradores a where a.usuario_id = (select auth.uid()));
$$;

create function public.es_admin_del_hogar(hogar uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros m
    where m.hogar_id = hogar and m.usuario_id = (select auth.uid()) and m.rol = 'admin'
  );
$$;

-- Hogares suspendidos ---------------------------------------------------------------

alter table public.hogares add column activo boolean not null default true;

-- Un hogar suspendido deja de ser visible para sus miembros: todas las políticas pasan por acá.
create or replace function public.es_miembro(hogar uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.miembros m join public.hogares h on h.id = m.hogar_id
    where m.hogar_id = hogar and m.usuario_id = (select auth.uid()) and h.activo
  );
$$;

create or replace function public.mi_hogar() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.hogar_id from public.miembros m join public.hogares h on h.id = m.hogar_id
  where m.usuario_id = (select auth.uid()) and h.activo
  order by m.hogar_id
  limit 1;
$$;

-- Invitaciones y licencias ----------------------------------------------------------

create table public.invitaciones (
  codigo text primary key default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  -- Nulo: licencia para un hogar nuevo.
  hogar_id uuid references public.hogares on delete cascade,
  rol text not null default 'miembro' check (rol in ('admin', 'miembro')),
  -- Si se completa, solo sirve para ese email.
  email text,
  nota text,
  creada_por uuid default auth.uid() references auth.users on delete set null,
  creada timestamptz not null default now(),
  vence timestamptz not null default now() + interval '14 days',
  usada_por uuid references auth.users on delete set null,
  usada timestamptz
);

alter table public.invitaciones enable row level security;
grant select, insert, delete on public.invitaciones to authenticated;

create policy "ver invitaciones" on public.invitaciones for select to authenticated
  using (case when hogar_id is null then public.es_administrador() else public.es_admin_del_hogar(hogar_id) end);
create policy "crear invitaciones" on public.invitaciones for insert to authenticated
  with check (
    usada_por is null
    and case when hogar_id is null then public.es_administrador() else public.es_admin_del_hogar(hogar_id) end
  );
create policy "borrar invitaciones sin usar" on public.invitaciones for delete to authenticated
  using (
    usada_por is null
    and case when hogar_id is null then public.es_administrador() else public.es_admin_del_hogar(hogar_id) end
  );

create function public.normalizar_codigo(codigo text) returns text
language sql immutable set search_path = ''
as $$
  select upper(regexp_replace(coalesce(codigo, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Para que el formulario de registro avise antes de intentar crear la cuenta.
create function public.invitacion_valida(codigo text, email text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.invitaciones i
    where i.codigo = public.normalizar_codigo(invitacion_valida.codigo)
      and i.usada_por is null and i.vence > now()
      and (i.email is null or lower(i.email) = lower(btrim(invitacion_valida.email)))
  );
$$;

grant execute on function public.invitacion_valida(text, text) to anon, authenticated;

-- Al registrarse: sin una invitación válida la cuenta no se crea.
create or replace function public.crear_hogar_inicial() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invitaciones;
  hogar uuid;
begin
  select * into inv from public.invitaciones i
  where i.codigo = public.normalizar_codigo(new.raw_user_meta_data->>'invitacion')
    and i.usada_por is null and i.vence > now()
    and (i.email is null or lower(i.email) = lower(new.email))
  for update;
  if not found then
    raise exception 'Hace falta un código de invitación válido para crear una cuenta.';
  end if;

  if inv.hogar_id is null then
    insert into public.hogares default values returning id into hogar;
    insert into public.miembros (hogar_id, usuario_id, rol) values (hogar, new.id, 'admin');
    perform public.crear_categorias_iniciales(hogar);
  else
    insert into public.miembros (hogar_id, usuario_id, rol) values (inv.hogar_id, new.id, inv.rol);
  end if;

  update public.invitaciones set usada_por = new.id, usada = now() where codigo = inv.codigo;
  return new;
end;
$$;

-- Miembros del hogar ----------------------------------------------------------------

create function public.miembros_de_mi_hogar()
returns table (usuario_id uuid, email text, rol text, yo boolean)
language sql stable security definer set search_path = ''
as $$
  select m.usuario_id, u.email::text, m.rol, m.usuario_id = (select auth.uid())
  from public.miembros m join auth.users u on u.id = m.usuario_id
  where m.hogar_id = public.mi_hogar()
  order by u.created_at;
$$;

-- Un admin saca a otro miembro de su hogar (no a sí mismo).
create function public.quitar_miembro(usuario uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  hogar uuid := public.mi_hogar();
begin
  if not public.es_admin_del_hogar(hogar) or usuario = (select auth.uid()) then
    raise exception 'No podés quitar a este miembro.';
  end if;
  delete from public.miembros m where m.hogar_id = hogar and m.usuario_id = usuario;
end;
$$;

-- Vista de administración -----------------------------------------------------------

create function public.usuarios_de_la_app()
returns table (usuario_id uuid, email text, creado timestamptz, ultimo_ingreso timestamptz,
               hogar_id uuid, hogar text, hogar_activo boolean, rol text)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, h.id, h.nombre, h.activo, m.rol
  from auth.users u
  left join public.miembros m on m.usuario_id = u.id
  left join public.hogares h on h.id = m.hogar_id
  where public.es_administrador()
  order by u.created_at;
$$;

-- Suspender o reactivar un hogar. El propio no, para no quedarse afuera.
create function public.cambiar_acceso_hogar(hogar uuid, activo boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_administrador() or hogar = public.mi_hogar() then
    raise exception 'No podés cambiar el acceso de este hogar.';
  end if;
  update public.hogares h set activo = cambiar_acceso_hogar.activo where h.id = hogar;
end;
$$;

revoke execute on function
  public.es_administrador(), public.es_admin_del_hogar(uuid), public.miembros_de_mi_hogar(),
  public.quitar_miembro(uuid), public.usuarios_de_la_app(), public.cambiar_acceso_hogar(uuid, boolean)
from public, anon;
grant execute on function
  public.es_administrador(), public.es_admin_del_hogar(uuid), public.miembros_de_mi_hogar(),
  public.quitar_miembro(uuid), public.usuarios_de_la_app(), public.cambiar_acceso_hogar(uuid, boolean)
to authenticated;
