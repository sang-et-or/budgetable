-- Budgétable : à exécuter une fois dans Supabase → SQL Editor → New query → Run.
-- Une ligne par compte, que seul son propriétaire peut lire ou modifier.
create table if not exists public.profils (
  id uuid primary key references auth.users(id) on delete cascade,
  donnees jsonb not null default '{}'::jsonb,
  maj timestamptz not null default now()
);
alter table public.profils enable row level security;

drop policy if exists "lire mon profil" on public.profils;
drop policy if exists "creer mon profil" on public.profils;
drop policy if exists "modifier mon profil" on public.profils;
drop policy if exists "supprimer mon profil" on public.profils;
create policy "lire mon profil" on public.profils for select to authenticated using ((select auth.uid()) = id);
create policy "creer mon profil" on public.profils for insert to authenticated with check ((select auth.uid()) = id);
create policy "modifier mon profil" on public.profils for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "supprimer mon profil" on public.profils for delete to authenticated using ((select auth.uid()) = id);

-- « Supprimer mon compte » depuis l'application : efface le compte et toutes ses données.
create or replace function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
