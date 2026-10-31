-- Budgétable : compteur des demandes à l'assistant IA (pour comparer avec la facture Mistral).
-- À exécuter une fois dans Supabase → SQL Editor → New query → coller ce fichier → Run.
-- Aucune donnée personnelle : ni question, ni réponse, ni adresse IP. Seulement le type de demande, le modèle
-- et le nombre de jetons (« tokens ») renvoyé par Mistral. Le serveur ajoute une ligne par appel ; personne ne
-- peut lire les lignes ; seuls les comptes de la table « admins » (voir statistiques.sql) obtiennent les totaux.

create table if not exists public.usage_ia (
  id bigint generated always as identity primary key,
  cree timestamptz not null default now(),
  usage text not null check (usage in ('chat', 'photo', 'ticket', 'ocr', 'autre')),
  modele text check (char_length(modele) <= 60),
  entree int not null default 0 check (entree between 0 and 400000),
  sortie int not null default 0 check (sortie between 0 and 50000),
  pages int not null default 0 check (pages between 0 and 100)
);
create index if not exists usage_ia_cree on public.usage_ia (cree);
alter table public.usage_ia enable row level security;
drop policy if exists "noter une demande" on public.usage_ia;
create policy "noter une demande" on public.usage_ia for insert to anon, authenticated
  with check (cree > now() - interval '1 minute' and cree < now() + interval '1 minute');

-- totaux par jour, type et modèle (heure de Paris), réservés aux admins
create or replace function public.stats_ia(jours int default 30)
returns table (jour date, usage text, modele text, appels bigint, entree bigint, sortie bigint, pages bigint)
language sql stable security definer set search_path = '' as $$
  select (u.cree at time zone 'Europe/Paris')::date, u.usage, coalesce(u.modele, ''), count(*), sum(u.entree), sum(u.sortie), sum(u.pages)
  from public.usage_ia u
  where u.cree > now() - make_interval(days => least(greatest(jours, 1), 400))
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  group by 1, 2, 3
  order by 1;
$$;
revoke all on function public.stats_ia(int) from public, anon;
grant execute on function public.stats_ia(int) to authenticated;

-- conservation : 13 mois
create or replace function public.purger_usage_ia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.usage_ia where cree < now() - interval '13 months';
  return null;
end;
$$;
drop trigger if exists purge_usage_ia on public.usage_ia;
create trigger purge_usage_ia after insert on public.usage_ia for each statement execute function public.purger_usage_ia();
