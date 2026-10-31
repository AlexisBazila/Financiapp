-- Blanquear la contraseña de un usuario que se la olvidó. Lo hace un administrador de la app (a
-- cualquier cuenta) o un admin del hogar (a los miembros de su hogar), nunca a sí mismo.
-- Se genera una contraseña provisoria que se muestra una sola vez para pasársela a la persona; al
-- entrar con ella, la app le pide elegir una nueva. Se cierran sus sesiones abiertas.

-- En Supabase ya viene instalada en el esquema extensions; esto no hace nada si ya está.
create extension if not exists pgcrypto with schema extensions;

create function public.blanquear_contrasena(usuario uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  provisoria text;
begin
  if usuario = (select auth.uid()) or not (
    public.es_administrador()
    or exists (
      select 1 from public.miembros m
      where m.usuario_id = usuario and m.hogar_id = public.mi_hogar() and public.es_admin_del_hogar(m.hogar_id)
    )
  ) then
    raise exception 'No podés blanquear la contraseña de esta cuenta.';
  end if;

  -- 12 caracteres sin los que se confunden al dictarlos (0/O, 1/l/I).
  select string_agg(substr('abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (b % 54), 1), '')
  into provisoria
  from (select get_byte(extensions.gen_random_bytes(12), i) as b from generate_series(0, 11) i) bytes;

  update auth.users u
  set encrypted_password = extensions.crypt(provisoria, extensions.gen_salt('bf')),
      raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || '{"cambiar_clave": true}'::jsonb,
      updated_at = now()
  where u.id = usuario;
  if not found then
    raise exception 'No existe esa cuenta.';
  end if;

  delete from auth.sessions s where s.user_id = usuario;
  return provisoria;
end;
$$;

revoke execute on function public.blanquear_contrasena(uuid) from public, anon;
grant execute on function public.blanquear_contrasena(uuid) to authenticated;
