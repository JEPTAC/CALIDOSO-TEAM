begin;

-- =========================================================
-- SQL V17 - ELOGIOS CON NOMBRE DEL REMITENTE
-- No borra información.
-- Agrega campos para guardar quién envió la calificación o elogio.
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

alter table public.compliments enable row level security;

drop policy if exists "compliments_select_authenticated" on public.compliments;
drop policy if exists "compliments_insert_public" on public.compliments;
drop policy if exists "compliments_insert_authenticated" on public.compliments;
drop policy if exists "compliments_admin_read" on public.compliments;

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

commit;

select
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
    'message'
  )
order by column_name;
