
begin;

-- SQL V9 - permisos para editar y eliminar
-- No borra datos. Solo asegura lectura/escritura/eliminación autenticada.

create table if not exists public.system_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid,
  updated_at timestamptz default now()
);

alter table public.system_settings enable row level security;

drop policy if exists "system_settings_select_all" on public.system_settings;
create policy "system_settings_select_all"
on public.system_settings
for select
to anon, authenticated
using (true);

drop policy if exists "system_settings_authenticated_all" on public.system_settings;
create policy "system_settings_authenticated_all"
on public.system_settings
for all
to authenticated
using (true)
with check (true);

alter table if exists public.app_modules enable row level security;
alter table if exists public.news_posts enable row level security;
alter table if exists public.audit_reports enable row level security;
alter table if exists public.documents enable row level security;
alter table if exists public.publications enable row level security;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-assets', 'portal-assets', true, 62914560, null)
on conflict (id)
do update set public = true, file_size_limit = 62914560, allowed_mime_types = null;

drop policy if exists "portal_assets_public_read" on storage.objects;
drop policy if exists "portal_assets_authenticated_insert" on storage.objects;
drop policy if exists "portal_assets_authenticated_update" on storage.objects;
drop policy if exists "portal_assets_authenticated_delete" on storage.objects;
drop policy if exists "portal_assets_public_insert" on storage.objects;
drop policy if exists "portal_assets_public_update" on storage.objects;
drop policy if exists "portal_assets_public_delete" on storage.objects;

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
