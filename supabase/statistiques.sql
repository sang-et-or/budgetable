-- Budgétable : compteur de visites anonyme. À exécuter une fois dans Supabase → SQL Editor → New query → Run.
-- Aucune donnée personnelle : pas d'adresse IP, pas d'identifiant, pas de cookie. Seulement l'action, la page,
-- la source (Google, Facebook, flyer…) et le type d'appareil. Tout le monde peut ajouter une ligne ; personne
-- ne peut lire les lignes. Seuls les comptes listés dans « admins » obtiennent les totaux, par la fonction stats_visites.

create table if not exists public.visites (
  id bigint generated always as identity primary key,
  cree timestamptz not null default now(),
  evenement text not null check (evenement in ('ouverture', 'page', 'semaine', 'compte', 'abonnement')),
  page text check (char_length(page) <= 80),
  source text check (char_length(source) <= 30),
  appareil text check (appareil in ('mobile', 'ordinateur'))
);
create index if not exists visites_cree on public.visites (cree);
alter table public.visites enable row level security;
drop policy if exists "compter une visite" on public.visites;
create policy "compter une visite" on public.visites for insert to anon, authenticated
  with check (cree > now() - interval '1 minute' and cree < now() + interval '1 minute');

-- comptes qui voient les statistiques (aucune règle d'accès : invisible depuis le site)
create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;

create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- totaux par jour, action, source et appareil (heure de Paris)
create or replace function public.stats_visites(jours int default 30)
returns table (jour date, evenement text, source text, appareil text, nombre bigint)
language sql stable security definer set search_path = '' as $$
  select (v.cree at time zone 'Europe/Paris')::date, v.evenement, coalesce(v.source, ''), coalesce(v.appareil, ''), count(*)
  from public.visites v
  where v.cree > now() - make_interval(days => least(greatest(jours, 1), 400))
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  group by 1, 2, 3, 4
  order by 1;
$$;
-- pages les plus vues (recettes, pages thématiques)
create or replace function public.stats_pages(jours int default 30)
returns table (page text, nombre bigint)
language sql stable security definer set search_path = '' as $$
  select v.page, count(*) from public.visites v
  where v.evenement = 'page' and v.page is not null
    and v.cree > now() - make_interval(days => least(greatest(jours, 1), 400))
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  group by 1 order by 2 desc limit 20;
$$;
revoke all on function public.est_admin() from public, anon;
revoke all on function public.stats_visites(int) from public, anon;
revoke all on function public.stats_pages(int) from public, anon;
grant execute on function public.est_admin() to authenticated;
grant execute on function public.stats_visites(int) to authenticated;
grant execute on function public.stats_pages(int) to authenticated;

-- durée de conservation : les lignes de plus de 13 mois sont effacées à chaque nouvelle visite du jour (recommandation CNIL)
create or replace function public.purger_visites() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.visites where cree < now() - interval '13 months';
  return null;
end;
$$;
drop trigger if exists purge_visites on public.visites;
create trigger purge_visites after insert on public.visites for each statement execute function public.purger_visites();

-- Pour voir les statistiques, ajoutez votre compte (remplacez l'adresse par celle de votre compte Budgétable) :
-- insert into public.admins (user_id) select id from auth.users where email = 'votre-adresse@exemple.fr' on conflict do nothing;
