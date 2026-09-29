-- Migración 010: usuarios con nombre y rol (dueños y admin).
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr dos veces.
--
-- Se entra con usuario y contraseña. Supabase Auth necesita un email, así que
-- cada usuario tiene uno interno que nadie ve: "vanesa" → vanesa@elbaratillo.app.
-- Por eso no hay "olvidé mi contraseña" por mail: la cambia el admin.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "perfiles ver" on profiles;
create policy "perfiles ver" on profiles
  for select to authenticated using (true);

-- Los cambios de perfiles pasan por las funciones de abajo, que controlan
-- que quien los pide sea admin. No hay política de insert/update/delete.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- Crea el usuario en Auth (con el email interno) y su perfil. No se expone:
-- la llaman admin_create_user y el SQL Editor.
create or replace function public._create_app_user(
  p_username text,
  p_full_name text,
  p_role text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_username text := lower(trim(p_username));
  v_email text := lower(trim(p_username)) || '@elbaratillo.app';
  v_id uuid;
begin
  if v_username !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'El usuario tiene que tener entre 3 y 30 letras o números, sin espacios.';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'La contraseña tiene que tener al menos 6 caracteres.';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Ya existe el usuario "%".', v_username;
  end if;

  v_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );
  insert into profiles (id, username, full_name, role)
  values (v_id, v_username, trim(p_full_name), p_role);
  return v_id;
end;
$$;

revoke all on function public._create_app_user(text, text, text, text) from public, anon, authenticated;

-- Lo que puede hacer el admin desde la pantalla Usuarios.
create or replace function public.admin_create_user(
  p_username text,
  p_full_name text,
  p_role text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Sólo el admin puede crear usuarios.';
  end if;
  if p_role not in ('owner', 'admin') then
    raise exception 'Rol inválido.';
  end if;
  return _create_app_user(p_username, p_full_name, p_role, p_password);
end;
$$;

create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
begin
  if not is_admin() then
    raise exception 'Sólo el admin puede cambiar contraseñas de otros.';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'La contraseña tiene que tener al menos 6 caracteres.';
  end if;
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
   where id = p_user_id;
end;
$$;

create or replace function public.admin_update_profile(p_user_id uuid, p_full_name text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Sólo el admin puede editar usuarios.';
  end if;
  if p_role not in ('owner', 'admin') then
    raise exception 'Rol inválido.';
  end if;
  -- Que siempre quede al menos un admin.
  if p_role <> 'admin'
     and exists (select 1 from profiles where id = p_user_id and role = 'admin')
     and (select count(*) from profiles where role = 'admin') = 1 then
    raise exception 'Tiene que quedar al menos un admin.';
  end if;
  update profiles set full_name = trim(p_full_name), role = p_role where id = p_user_id;
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not is_admin() then
    raise exception 'Sólo el admin puede borrar usuarios.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No podés borrar tu propio usuario.';
  end if;
  delete from auth.users where id = p_user_id; -- el perfil se borra en cascada
end;
$$;

revoke all on function public.admin_create_user(text, text, text, text) from public, anon;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
revoke all on function public.admin_update_profile(uuid, text, text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_create_user(text, text, text, text) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- Quién hizo cada cosa. auth.uid() se completa solo con el usuario que
-- inició sesión; lo cargado antes de esta migración queda sin autor.
alter table sales add column if not exists created_by uuid references profiles(id) on delete set null default auth.uid();
alter table account_movements add column if not exists created_by uuid references profiles(id) on delete set null default auth.uid();
alter table expenses add column if not exists created_by uuid references profiles(id) on delete set null default auth.uid();
alter table purchase_invoices add column if not exists created_by uuid references profiles(id) on delete set null default auth.uid();
