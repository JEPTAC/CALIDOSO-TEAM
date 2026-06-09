
begin;

-- =========================================================
-- SQL V12 - PERSISTENCIA ENTRE DISPOSITIVOS
-- No borra datos.
-- Permite que admin y super_admin guarden banner, mascota, equipo
-- y configuración operativa en system_settings para que se vea
-- desde cualquier PC o celular.
-- =========================================================

create extension if not exists pgcrypto;

-- Asegurar system_settings
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

-- Limpiar políticas de system_settings para evitar choques
drop policy if exists "system_settings_select_all" on public.system_settings;
drop policy if exists "system_settings_authenticated_all" on public.system_settings;
drop policy if exists "system_settings_admin_manage" on public.system_settings;
drop policy if exists "system_settings_portal_write" on public.system_settings;

-- Lectura pública/autenticada para que cualquier dispositivo cargue banner, mascota y visual
create policy "system_settings_select_all"
on public.system_settings
for select
to anon, authenticated
using (true);

-- Escritura autenticada para configuración del portal.
-- El frontend controla qué ve admin y qué ve super_admin.
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

-- Asegurar Storage público
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

create policy "portal_assets_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'portal-assets');

create policy "portal_assets_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'portal-assets');

create policy "portal_assets_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'portal-assets')
with check (bucket_id = 'portal-assets');

create policy "portal_assets_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'portal-assets');

commit;

-- Verifica que exista configuración compartida.
select
  setting_key,
  updated_at,
  jsonb_typeof(setting_value) as tipo
from public.system_settings
where setting_key like 'portal_home_settings%';
