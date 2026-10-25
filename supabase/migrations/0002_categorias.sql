-- Categorías de ingresos y gastos, con subcategorías (un nivel), emoji y color.
--
-- Movimientos, compras en cuotas, préstamos y recurrentes pasan a guardar `categoria_id`.
-- La columna de texto `categoria` queda para lo cargado antes de esta migración.

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null default public.mi_hogar() references public.hogares on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  -- null = categoría principal. Solo hay un nivel de subcategorías.
  padre_id uuid,
  icono text not null default '' check (length(icono) <= 16),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  orden int not null default 0,
  archivada boolean not null default false,
  creado timestamptz not null default now(),
  unique (hogar_id, id),
  foreign key (hogar_id, padre_id) references public.categorias (hogar_id, id) on delete cascade
);

create unique index categorias_nombre_unico on public.categorias (
  hogar_id, tipo, coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nombre))
);

-- La subcategoría tiene el mismo tipo que su categoría, y una subcategoría no puede tener hijas.
create function public.validar_categoria() returns trigger
language plpgsql set search_path = ''
as $$
declare
  padre public.categorias;
begin
  if new.padre_id is null then
    if exists (select 1 from public.categorias c where c.padre_id = new.id and c.tipo <> new.tipo) then
      raise exception 'Las subcategorías tienen que ser del mismo tipo que su categoría';
    end if;
    return new;
  end if;
  select * into padre from public.categorias where id = new.padre_id;
  if padre.padre_id is not null then
    raise exception 'Una subcategoría no puede tener subcategorías';
  end if;
  if padre.tipo <> new.tipo then
    raise exception 'La subcategoría tiene que ser del mismo tipo que su categoría';
  end if;
  if exists (select 1 from public.categorias c where c.padre_id = new.id) then
    raise exception 'Una categoría con subcategorías no puede pasar a ser subcategoría';
  end if;
  return new;
end;
$$;

create trigger validar_categoria
  before insert or update on public.categorias
  for each row execute function public.validar_categoria();

alter table public.categorias enable row level security;
grant select, insert, update, delete on public.categorias to authenticated;
create policy "datos de mis hogares" on public.categorias for all to authenticated
  using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id));

-- categoria_id en lo que tiene categoría. Si se borra la categoría, queda sin categoría.
do $$
declare
  tabla text;
begin
  foreach tabla in array array['movimientos', 'planes_cuotas', 'prestamos', 'recurrentes'] loop
    execute format('alter table public.%I add column categoria_id uuid', tabla);
    execute format(
      'alter table public.%I add foreign key (hogar_id, categoria_id) '
      'references public.categorias (hogar_id, id) on delete set null (categoria_id)',
      tabla
    );
    execute format('create index %I on public.%I (categoria_id)', tabla || '_categoria', tabla);
  end loop;
end;
$$;

-- Categorías iniciales ----------------------------------------------------------------
-- Pocas principales para ver la previsión de un vistazo; el detalle va en subcategorías.
-- Ahorrar, invertir y pagar la tarjeta no son gastos: son transferencias entre cuentas.

create function public.crear_categorias_iniciales(hogar uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cat jsonb;
  sub jsonb;
  nueva uuid;
  i int := 0;
  j int;
begin
  for cat in select * from jsonb_array_elements($json$[
    {"t":"egreso","n":"Alimentos","i":"🛒","c":"#16a34a","s":[["Supermercado","🛒"],["Verdulería","🥬"],["Carnicería","🥩"],["Panadería","🥖"],["Lácteos y huevos","🥛"],["Dietética","🌾"],["Bebidas","🥤"]]},
    {"t":"egreso","n":"Hogar","i":"🏠","c":"#ea580c","s":[["Alquiler y expensas","🔑"],["Mantenimiento y arreglos","🔧"],["Remodelaciones","🧱"],["Decoración","🖼️"],["Electrodomésticos","🔌"],["Limpieza del hogar","🧽"]]},
    {"t":"egreso","n":"Servicios","i":"💡","c":"#ca8a04","s":[["Luz","💡"],["Gas","🔥"],["Agua","💧"],["Internet","🌐"],["Telefonía","📱"],["Suscripciones","📺"]]},
    {"t":"egreso","n":"Auto y transporte","i":"🚗","c":"#2563eb","s":[["Combustible","⛽"],["Seguro del auto","🛡️"],["Taller y mantenimiento","🔧"],["Patente y peajes","🧾"],["Estacionamiento","🅿️"],["Transporte público","🚌"]]},
    {"t":"egreso","n":"Salud","i":"🩺","c":"#dc2626","s":[["Farmacia","💊"],["Consultas médicas","🏥"],["Obra social o prepaga","🪪"]]},
    {"t":"egreso","n":"Ropa y cuidado personal","i":"👕","c":"#db2777","s":[["Ropa y calzado","👟"],["Belleza","💄"],["Peluquería","💈"],["Gimnasio","🏋️"]]},
    {"t":"egreso","n":"Educación","i":"🎓","c":"#7c3aed","s":[["Cursos","📝"],["Inglés","🇬🇧"],["Libros y materiales","📚"]]},
    {"t":"egreso","n":"Ocio y salidas","i":"🎉","c":"#0891b2","s":[["Restaurantes y delivery","🍔"],["Cafetería","☕"],["Heladería","🍦"],["Viajes","✈️"],["Salidas","🎬"]]},
    {"t":"egreso","n":"Regalos y eventos","i":"🎁","c":"#e11d48","s":[["Regalos","🎁"],["Celebraciones","🎂"]]},
    {"t":"egreso","n":"Seguros","i":"🛡️","c":"#475569","s":[["Seguro de vida","❤️"],["Seguro viajero","🧳"]]},
    {"t":"egreso","n":"Finanzas","i":"💳","c":"#0f766e","s":[["Cuotas de préstamos","🏦"],["Intereses","📉"],["Comisiones bancarias","🧾"],["Impuestos","🏛️"]]},
    {"t":"egreso","n":"Emprendimientos","i":"🧁","c":"#9333ea","s":[["Bynailtica","💅"],["AB System","💻"]]},
    {"t":"egreso","n":"Otros gastos","i":"📦","c":"#64748b","s":[]},
    {"t":"ingreso","n":"Sueldo","i":"💼","c":"#15803d","s":[["Sueldo","💵"],["Aguinaldo","🎄"],["Premios y bonos","🏆"],["Viáticos","🚗"]]},
    {"t":"ingreso","n":"Emprendimientos","i":"🧁","c":"#9333ea","s":[["Bynailtica","💅"],["AB System","💻"]]},
    {"t":"ingreso","n":"Rendimientos","i":"📈","c":"#0d9488","s":[["Intereses y FCI","📈"],["Dividendos","💹"]]},
    {"t":"ingreso","n":"Reintegros","i":"↩️","c":"#0284c7","s":[["Devoluciones","↩️"],["Descuentos y reintegros","🏷️"]]},
    {"t":"ingreso","n":"Otros ingresos","i":"➕","c":"#64748b","s":[]}
  ]$json$::jsonb) loop
    i := i + 1;
    insert into public.categorias (hogar_id, nombre, tipo, icono, color, orden)
    values (hogar, cat->>'n', cat->>'t', cat->>'i', cat->>'c', i)
    returning id into nueva;
    j := 0;
    -- Cada subcategoría es [nombre, ícono].
    for sub in select * from jsonb_array_elements(cat->'s') loop
      j := j + 1;
      insert into public.categorias (hogar_id, nombre, tipo, padre_id, icono, color, orden)
      values (hogar, sub->>0, cat->>'t', nueva, sub->>1, cat->>'c', j);
    end loop;
  end loop;
end;
$$;

revoke execute on function public.crear_categorias_iniciales(uuid) from public, anon, authenticated;

-- Los hogares nuevos arrancan con las categorías iniciales.
create or replace function public.crear_hogar_inicial() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  nuevo uuid;
begin
  insert into public.hogares default values returning id into nuevo;
  insert into public.miembros (hogar_id, usuario_id, rol) values (nuevo, new.id, 'admin');
  perform public.crear_categorias_iniciales(nuevo);
  return new;
end;
$$;

-- Y los que ya existen, también.
select public.crear_categorias_iniciales(h.id)
from public.hogares h
where not exists (select 1 from public.categorias c where c.hogar_id = h.id);

-- Lo cargado antes con categoría de texto se asocia a la categoría del mismo nombre, si existe.
update public.movimientos m set categoria_id = c.id
from public.categorias c
where m.categoria_id is null and m.categoria is not null and m.tipo <> 'transferencia'
  and c.hogar_id = m.hogar_id and c.tipo = m.tipo and lower(c.nombre) = lower(btrim(m.categoria));

update public.recurrentes r set categoria_id = c.id
from public.categorias c
where r.categoria_id is null
  and c.hogar_id = r.hogar_id and c.tipo = r.tipo and lower(c.nombre) = lower(btrim(r.categoria));

update public.planes_cuotas p set categoria_id = c.id
from public.categorias c
where p.categoria_id is null
  and c.hogar_id = p.hogar_id and c.tipo = 'egreso' and lower(c.nombre) = lower(btrim(p.categoria));

update public.prestamos p set categoria_id = c.id
from public.categorias c
where p.categoria_id is null
  and c.hogar_id = p.hogar_id and c.tipo = 'egreso'
  and lower(c.nombre) = case when p.categoria = 'Créditos' then 'cuotas de préstamos' else lower(btrim(p.categoria)) end;
