begin;

-- =========================================================
-- SQL V18 - ELOGIOS VISIBLES EN EL PORTAL
-- Crea/asegura la tabla public.compliments.
-- Los elogios se guardan ahí y el portal los muestra:
-- 1) En Inicio > Elogios del equipo.
-- 2) En el popup de cada integrante.
-- 3) En Administración > Elogios.
-- No borra datos.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.compliments (
  id uuid primary key default gen_random_uuid(),
  team_member_id text,
  team_member_name text,
  rating integer,
  message text,
  sender_name text,
  sender_email text,
  created_by uuid,
  created_at timestamptz default now()
);

alter table public.compliments add column if not exists team_member_id text;
alter table public.compliments add column if not exists team_member_name text;
alter table public.compliments add column if not exists rating integer;
alter table public.compliments add column if not exists message text;
alter table public.compliments add column if not exists sender_name text;
alter table public.compliments add column if not exists sender_email text;
alter table public.compliments add column if not exists created_by uuid;
alter table public.compliments add column if not exists created_at timestamptz default now();

alter table public.compliments
drop constraint if exists compliments_rating_check;

alter table public.compliments
add constraint compliments_rating_check
check (
  rating is null
  or rating between 1 and 5
);

create index if not exists compliments_created_at_idx
on public.compliments (created_at desc);

create index if not exists compliments_team_member_id_idx
on public.compliments (team_member_id);

create index if not exists compliments_team_member_name_idx
on public.compliments (team_member_name);

alter table public.compliments enable row level security;

drop policy if exists "compliments_select_authenticated" on public.compliments;
drop policy if exists "compliments_select_public" on public.compliments;
drop policy if exists "compliments_insert_public" on public.compliments;
drop policy if exists "compliments_insert_authenticated" on public.compliments;
drop policy if exists "compliments_admin_read" on public.compliments;
drop policy if exists "compliments_super_admin_read" on public.compliments;

-- Lectura:
-- Queda para usuarios autenticados del portal.
-- Si quieres que visitantes no logueados también vean los elogios, cambia "to authenticated" por "to anon, authenticated".
create policy "compliments_select_authenticated"
on public.compliments
for select
to authenticated
using (true);

-- Inserción:
-- Permite enviar elogios desde el portal, con o sin sesión.
create policy "compliments_insert_public"
on public.compliments
for insert
to anon, authenticated
with check (true);

commit;

select
  created_at,
  team_member_name,
  rating,
  message,
  sender_name,
  sender_email
from public.compliments
order by created_at desc
limit 20;
