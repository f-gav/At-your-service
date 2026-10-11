-- Patch 1: permit Project Moon characters without touching existing rows or RLS.
-- PostgreSQL's original inline system CHECK is named characters_system_check.
alter table public.characters drop constraint if exists characters_system_check;
alter table public.characters add constraint characters_system_check
  check (system in ('dnd5e', 'pf2e', 'vtm5e', 'prmoon'));
