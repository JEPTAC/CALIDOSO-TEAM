begin;

-- =========================================================
-- SQL V20 - REPARACIÓN ESTABLE + ELOGIOS + CRÉDITOS APPS
-- No borra datos.
-- Corrige:
-- 1. Campos faltantes en compliments: sender_name, sender_email, created_by.
-- 2. Campos de crédito en app_modules: creator_name, creator_role, creator_credit.
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- 1. ELOGIOS / COMENTARIOS DEL EQUIPO
-- =========================================================

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

create policy "compliments_select_authenticated"
on public.compliments
for select
to authenticated
using (true);

create policy "compliments_insert_public"
on public.compliments
for insert
to anon, authenticated
with check (true);

-- =========================================================
-- 2. CRÉDITOS DE CREADOR EN APPS
-- =========================================================

create table if not exists public.app_modules (
  id uuid primary key default gen_random_uuid()
);

alter table public.app_modules add column if not exists creator_name text;
alter table public.app_modules add column if not exists creator_role text;
alter table public.app_modules add column if not exists creator_credit text;

update public.app_modules
set
  creator_name = coalesce(nullif(creator_name, ''), 'Juan Esteban Pérez'),
  creator_role = coalesce(nullif(creator_role, ''), 'Analista de Calidad'),
  creator_credit = coalesce(
    nullif(creator_credit, ''),
    'Creado por Juan Esteban Pérez · Analista de Calidad'
  )
where creator_name is null
   or creator_name = ''
   or creator_role is null
   or creator_role = ''
   or creator_credit is null
   or creator_credit = '';

commit;

-- =========================================================
-- VERIFICACIÓN
-- =========================================================

select
  'compliments' as tabla,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'compliments'
  and column_name in (
    'sender_name',
    'sender_email',
    'created_by',
    'team_member_name',
    'rating',
    'message',
    'created_at'
  )

union all

select
  'app_modules' as tabla,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'app_modules'
  and column_name in (
    'creator_name',
    'creator_role',
    'creator_credit'
  )
order by tabla, column_name;
