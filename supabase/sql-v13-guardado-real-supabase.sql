begin;

-- =========================================================
-- SQL V13 - GUARDADO REAL EN SUPABASE
-- Objetivo:
-- 1. Que banners, mascota, equipo y configuración del portal
--    se guarden en public.system_settings.
-- 2. Que todos los equipos lean los mismos cambios.
-- 3. Que imágenes/GIF/videos suban al bucket público portal-assets.
-- 4. Evitar fallas por RLS usando funciones SECURITY DEFINER.
-- No borra datos.
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- 1. ASEGURAR PROFILES MÍNIMO
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  role text default 'solicitante',
  is_active boolean default true,
  process_area text,
  accessible_mode boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text default 'solicitante';
alter table public.profiles add column if not exists is_active boolean default true;
alter table public.profiles add column if not exists process_area text;
alter table public.profiles add column if not exists accessible_mode boolean default false;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (
  role is null
  or role in (
    'super_admin',
    'admin',
    'calidad',
    'auditoria',
    'consulta',
    'solicitante',
    'analista',
    'jefe_auditoria',
    'jefe_general',
    'editor',
    'viewer'
  )
);

-- =========================================================
-- 2. ASEGURAR USUARIOS CLAVE
-- =========================================================

insert into public.profiles (
  id,
  email,
  full_name,
  role,
  process_area,
  is_active,
  accessible_mode,
  created_at,
  updated_at
)
values
(
  '1b875ebb-7f18-46db-a004-9f4ee39e7d9a',
  'j.montoya@ei.com.co',
  'Juan Camilo Montoya',
  'admin',
  'Calidad y Mejoramiento Continuo',
  true,
  false,
  now(),
  now()
),
(
  '9b11bfaa-392a-4f9f-a91e-246b3316e042',
  'l.grisales@ei.com.co',
  'Luis Grisales',
  'admin',
  'Auditoría Interna',
  true,
  false,
  now(),
  now()
),
(
  '4734e2f7-0499-419f-b05b-cccfcffc8107',
  'm.zamudio@ei.com.co',
  'María Fernanda Zamudio',
  'admin',
  'Calidad y Mejoramiento Continuo',
  true,
  false,
  now(),
  now()
),
(
  '88d41223-cc6e-4519-9e92-1c3b4d2739c7',
  'y.castro@ei.com.co',
  'Yessica Castro',
  'admin',
  'Auditoría y Calidad',
  true,
  false,
  now(),
  now()
)
on conflict (id)
do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  process_area = excluded.process_area,
  is_active = excluded.is_active,
  accessible_mode = excluded.accessible_mode,
  updated_at = now();

insert into public.profiles (
  id,
  email,
  full_name,
  role,
  process_area,
  is_active,
  accessible_mode,
  created_at,
  updated_at
)
select
  u.id,
  lower(u.email),
  'Juan Esteban Pérez',
  'super_admin',
  'Calidad y Mejoramiento Continuo',
  true,
  false,
  now(),
  now()
from auth.users u
where lower(u.email) = 'j.perez@ei.com.co'
on conflict (id)
do update set
  email = excluded.email,
  full_name = 'Juan Esteban Pérez',
  role = 'super_admin',
  process_area = 'Calidad y Mejoramiento Continuo',
  is_active = true,
  accessible_mode = false,
  updated_at = now();

update public.profiles
set role = 'admin',
    updated_at = now()
where role = 'super_admin'
  and lower(email) <> 'j.perez@ei.com.co';

update public.profiles
set role = 'super_admin',
    full_name = 'Juan Esteban Pérez',
    is_active = true,
    process_area = 'Calidad y Mejoramiento Continuo',
    updated_at = now()
where lower(email) = 'j.perez@ei.com.co';

-- =========================================================
-- 3. SYSTEM_SETTINGS
-- =========================================================

create table if not exists public.system_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid,
  updated_at timestamptz default now()
);

alter table public.system_settings add column if not exists setting_value jsonb default '{}'::jsonb;
alter table public.system_settings add column if not exists description text;
alter table public.system_settings add column if not exists updated_by uuid;
alter table public.system_settings add column if not exists updated_at timestamptz default now();

alter table public.system_settings enable row level security;

drop policy if exists "system_settings_select_all" on public.system_settings;
drop policy if exists "system_settings_authenticated_all" on public.system_settings;
drop policy if exists "system_settings_admin_manage" on public.system_settings;
drop policy if exists "system_settings_portal_write" on public.system_settings;

create policy "system_settings_select_all"
on public.system_settings
for select
to anon, authenticated
using (true);

create policy "system_settings_authenticated_all"
on public.system_settings
for all
to authenticated
using (
  setting_key in (
    'portal_home_settings_v6',
    'portal_home_settings',
    'portal_visual_studio'
  )
  or setting_key like 'portal_home_settings%'
)
with check (
  setting_key in (
    'portal_home_settings_v6',
    'portal_home_settings',
    'portal_visual_studio'
  )
  or setting_key like 'portal_home_settings%'
);

-- =========================================================
-- 4. FUNCIONES RPC PARA EVITAR FALLAS DE RLS
-- =========================================================

create or replace function public.portal_user_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('super_admin', 'admin')
  );
$$;

create or replace function public.portal_get_home_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
begin
  select setting_value
  into v_settings
  from public.system_settings
  where setting_key = 'portal_home_settings_v6'
  limit 1;

  return coalesce(v_settings, '{}'::jsonb);
end;
$$;

create or replace function public.portal_save_home_settings(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para guardar cambios del portal.'
      using errcode = '42501';
  end if;

  if not public.portal_user_can_manage() then
    raise exception 'Este usuario no tiene permisos para guardar cambios globales del portal.'
      using errcode = '42501';
  end if;

  insert into public.system_settings (
    setting_key,
    setting_value,
    description,
    updated_by,
    updated_at
  )
  values (
    'portal_home_settings_v6',
    coalesce(payload, '{}'::jsonb),
    'Configuración global del portal Dream Team Calidad',
    auth.uid(),
    now()
  )
  on conflict (setting_key)
  do update set
    setting_value = excluded.setting_value,
    description = excluded.description,
    updated_by = excluded.updated_by,
    updated_at = now();

  return coalesce(payload, '{}'::jsonb);
end;
$$;

revoke all on function public.portal_user_can_manage() from public;
revoke all on function public.portal_get_home_settings() from public;
revoke all on function public.portal_save_home_settings(jsonb) from public;

grant execute on function public.portal_user_can_manage() to authenticated;
grant execute on function public.portal_get_home_settings() to anon, authenticated;
grant execute on function public.portal_save_home_settings(jsonb) to authenticated;

-- =========================================================
-- 5. STORAGE PORTAL-ASSETS
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'portal-assets',
  'portal-assets',
  true,
  62914560,
  null
)
on conflict (id)
do update set
  public = true,
  file_size_limit = 62914560,
  allowed_mime_types = null;

drop policy if exists "portal_assets_public_read" on storage.objects;
drop policy if exists "portal_assets_authenticated_insert" on storage.objects;
drop policy if exists "portal_assets_authenticated_update" on storage.objects;
drop policy if exists "portal_assets_authenticated_delete" on storage.objects;
drop policy if exists "portal_assets_public_insert" on storage.objects;
drop policy if exists "portal_assets_public_update" on storage.objects;
drop policy if exists "portal_assets_public_delete" on storage.objects;
drop policy if exists "portal_assets_admin_insert" on storage.objects;
drop policy if exists "portal_assets_admin_update" on storage.objects;
drop policy if exists "portal_assets_admin_delete" on storage.objects;
drop policy if exists "portal_assets_super_admin_insert" on storage.objects;
drop policy if exists "portal_assets_super_admin_update" on storage.objects;
drop policy if exists "portal_assets_super_admin_delete" on storage.objects;

create policy "portal_assets_public_read"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'portal-assets'
);

create policy "portal_assets_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'portal-assets'
);

create policy "portal_assets_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'portal-assets'
)
with check (
  bucket_id = 'portal-assets'
);

create policy "portal_assets_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'portal-assets'
);

commit;

-- =========================================================
-- VERIFICACIÓN
-- =========================================================

select
  setting_key,
  updated_at,
  jsonb_typeof(setting_value) as tipo
from public.system_settings
where setting_key = 'portal_home_settings_v6';

select
  id,
  email,
  full_name,
  role,
  is_active
from public.profiles
where lower(email) in (
  'j.perez@ei.com.co',
  'j.montoya@ei.com.co',
  'l.grisales@ei.com.co',
  'm.zamudio@ei.com.co',
  'y.castro@ei.com.co'
)
order by email;
