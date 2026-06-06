
begin;

create extension if not exists pgcrypto;

-- =========================================================
-- SQL SEGURO V6
-- No borra datos. No inserta datos demo.
-- Objetivo: restaurar lectura, Storage y system_settings para el portal estable.
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text default 'solicitante';
alter table public.profiles add column if not exists is_active boolean default true;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

insert into public.profiles (id, email, full_name, role, is_active, created_at, updated_at)
select u.id, lower(u.email), 'Juan Esteban Pérez', 'super_admin', true, now(), now()
from auth.users u
where lower(u.email) = 'j.perez@ei.com.co'
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = 'super_admin',
  is_active = true,
  updated_at = now();

update public.profiles
set role = 'super_admin',
    is_active = true,
    full_name = coalesce(full_name, 'Juan Esteban Pérez'),
    updated_at = now()
where lower(email) = 'j.perez@ei.com.co';

-- system_settings se usa para banner, mascota, equipo y Visual Studio.
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

-- Columnas mínimas no destructivas para que el frontend pueda leer y escribir lo básico.
alter table if exists public.app_modules add column if not exists title text;
alter table if exists public.app_modules add column if not exists name text;
alter table if exists public.app_modules add column if not exists description text;
alter table if exists public.app_modules add column if not exists url text;
alter table if exists public.app_modules add column if not exists external_url text;
alter table if exists public.app_modules add column if not exists image_url text;
alter table if exists public.app_modules add column if not exists icon_url text;
alter table if exists public.app_modules add column if not exists status text;
alter table if exists public.app_modules add column if not exists visibility text;
alter table if exists public.app_modules add column if not exists updated_at timestamptz default now();

alter table if exists public.news_posts add column if not exists description text;
alter table if exists public.news_posts add column if not exists content text;
alter table if exists public.news_posts add column if not exists image_url text;
alter table if exists public.news_posts add column if not exists file_url text;
alter table if exists public.news_posts add column if not exists external_url text;
alter table if exists public.news_posts add column if not exists status text;
alter table if exists public.news_posts add column if not exists visibility text;
alter table if exists public.news_posts add column if not exists updated_at timestamptz default now();

alter table if exists public.audit_reports add column if not exists title text;
alter table if exists public.audit_reports add column if not exists description text;
alter table if exists public.audit_reports add column if not exists content text;
alter table if exists public.audit_reports add column if not exists image_url text;
alter table if exists public.audit_reports add column if not exists file_url text;
alter table if exists public.audit_reports add column if not exists external_url text;
alter table if exists public.audit_reports add column if not exists status text;
alter table if exists public.audit_reports add column if not exists visibility text;
alter table if exists public.audit_reports add column if not exists updated_at timestamptz default now();

alter table if exists public.documents add column if not exists title text;
alter table if exists public.documents add column if not exists description text;
alter table if exists public.documents add column if not exists file_url text;
alter table if exists public.documents add column if not exists external_url text;
alter table if exists public.documents add column if not exists image_url text;
alter table if exists public.documents add column if not exists status text;
alter table if exists public.documents add column if not exists visibility text;
alter table if exists public.documents add column if not exists updated_at timestamptz default now();

alter table if exists public.publications add column if not exists title text;
alter table if exists public.publications add column if not exists description text;
alter table if exists public.publications add column if not exists content text;
alter table if exists public.publications add column if not exists file_url text;
alter table if exists public.publications add column if not exists external_url text;
alter table if exists public.publications add column if not exists image_url text;
alter table if exists public.publications add column if not exists publication_type text;
alter table if exists public.publications add column if not exists status text;
alter table if exists public.publications add column if not exists visibility text;
alter table if exists public.publications add column if not exists updated_at timestamptz default now();

-- Storage del portal.
insert into storage.buckets (id, name, public, file_size_limit)
values ('portal-assets', 'portal-assets', true, 62914560)
on conflict (id) do update set
  public = true,
  file_size_limit = 62914560;

-- RLS y lectura pública para que no desaparezca contenido existente.
alter table public.profiles enable row level security;
alter table public.system_settings enable row level security;
alter table if exists public.app_modules enable row level security;
alter table if exists public.news_posts enable row level security;
alter table if exists public.audit_reports enable row level security;
alter table if exists public.documents enable row level security;
alter table if exists public.publications enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles for select to authenticated using (true);

drop policy if exists "system_settings_select_all" on public.system_settings;
create policy "system_settings_select_all" on public.system_settings for select to anon, authenticated using (true);

drop policy if exists "system_settings_authenticated_all" on public.system_settings;
create policy "system_settings_authenticated_all" on public.system_settings for all to authenticated using (true) with check (true);

drop policy if exists "app_modules_select_all" on public.app_modules;
create policy "app_modules_select_all" on public.app_modules for select to anon, authenticated using (true);

drop policy if exists "news_posts_select_all" on public.news_posts;
create policy "news_posts_select_all" on public.news_posts for select to anon, authenticated using (true);

drop policy if exists "audit_reports_select_all" on public.audit_reports;
create policy "audit_reports_select_all" on public.audit_reports for select to anon, authenticated using (true);

drop policy if exists "documents_select_all" on public.documents;
create policy "documents_select_all" on public.documents for select to anon, authenticated using (true);

drop policy if exists "publications_select_all" on public.publications;
create policy "publications_select_all" on public.publications for select to anon, authenticated using (true);

-- Escritura autenticada para recuperar operación del panel sin depender de políticas dañadas.
drop policy if exists "app_modules_authenticated_all" on public.app_modules;
create policy "app_modules_authenticated_all" on public.app_modules for all to authenticated using (true) with check (true);

drop policy if exists "news_posts_authenticated_all" on public.news_posts;
create policy "news_posts_authenticated_all" on public.news_posts for all to authenticated using (true) with check (true);

drop policy if exists "audit_reports_authenticated_all" on public.audit_reports;
create policy "audit_reports_authenticated_all" on public.audit_reports for all to authenticated using (true) with check (true);

drop policy if exists "documents_authenticated_all" on public.documents;
create policy "documents_authenticated_all" on public.documents for all to authenticated using (true) with check (true);

drop policy if exists "publications_authenticated_all" on public.publications;
create policy "publications_authenticated_all" on public.publications for all to authenticated using (true) with check (true);

-- Storage policies.
drop policy if exists "portal_assets_public_read" on storage.objects;
create policy "portal_assets_public_read" on storage.objects for select to anon, authenticated using (bucket_id = 'portal-assets');

drop policy if exists "portal_assets_authenticated_insert" on storage.objects;
create policy "portal_assets_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id = 'portal-assets');

drop policy if exists "portal_assets_authenticated_update" on storage.objects;
create policy "portal_assets_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'portal-assets') with check (bucket_id = 'portal-assets');

drop policy if exists "portal_assets_authenticated_delete" on storage.objects;
create policy "portal_assets_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = 'portal-assets');

commit;
