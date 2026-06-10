begin;

-- =========================================================
-- SQL V19 - CRÉDITOS DE CREADOR EN APPS
-- No borra datos.
-- Agrega campos para mostrar una etiqueta de creador en cada App.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.app_modules (
  id uuid primary key default gen_random_uuid()
);

alter table public.app_modules add column if not exists creator_name text;
alter table public.app_modules add column if not exists creator_role text;
alter table public.app_modules add column if not exists creator_credit text;

-- Valor base para las Apps que ya existían y no tenían crédito.
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

select
  id,
  title,
  name,
  creator_name,
  creator_role,
  creator_credit
from public.app_modules
order by updated_at desc nulls last
limit 20;
