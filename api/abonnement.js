/* Budgétable — abonnement (Stripe) : 7 jours d'essai gratuit, puis 2,99 € par mois.
 *
 * Aucune base de données à tenir : l'état de l'abonnement est lu directement chez Stripe (client retrouvé par
 * l'identifiant du compte Budgétable), et la personne est authentifiée par son jeton de session Supabase, vérifié
 * auprès de Supabase. L'essai court à partir de la création du compte (date tenue par Supabase, pas par l'appareil).
 *
 * Variables d'environnement (Render) : STRIPE_SECRET_KEY (obligatoire pour vendre), SUPABASE_URL, SUPABASE_ANON_KEY
 * (publique), PRIX_CENTIMES (299), ESSAI_JOURS (7), SITE (https://budgetable.fr),
 * COMPTES_OFFERTS (adresses e-mail séparées par des virgules : accès complet sans payer, adresse confirmée exigée).
 * PROMO_FIN (fin de l'offre, ex. 2026-11-25T23:59:59+01:00) et PROMO_JOURS_OFFERTS (30) : premier mois offert à qui s'abonne avant la fin.
 * Les comptes administrateurs (table admins de Supabase, vérifiée avec le jeton de la personne) ont aussi l'accès offert.
 */
'use strict';

const PRIX = +(process.env.PRIX_CENTIMES || 299);
const ESSAI_JOURS = +(process.env.ESSAI_JOURS || 7);
const SITE = (process.env.SITE || 'https://budgetable.fr').replace(/\/+$/, '');
const SUPA_URL = (process.env.SUPABASE_URL || 'https://wrcxlvdyegfjawmwtozk.supabase.co').replace(/\/+$/, '');
const SUPA_CLE = process.env.SUPABASE_ANON_KEY || 'sb_publishable_86qxUeodYl3N0Ey3jhFwfg_l3lnzvqW';
const cleStripe = () => process.env.STRIPE_SECRET_KEY || '';
const actif = () => /^(sk|rk)_(live|test)_/.test(cleStripe());

// comptes offerts (propriétaire, testeurs) : lus dans Render, jamais écrits dans le code
const offert = (u) => u.confirme && !!u.email && String(process.env.COMPTES_OFFERTS || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean).includes(u.email.toLowerCase());

// compte administrateur ? (fonction est_admin de Supabase, appelée avec le jeton de la personne : impossible à usurper)
async function estAdmin(jeton, f) {
  try {
    const r = await f(SUPA_URL + '/rest/v1/rpc/est_admin', { method: 'POST', headers: { apikey: SUPA_CLE, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) });
    return r.ok && (await r.json().catch(() => false)) === true;
  } catch (e) { return false; }
}
const offertA = async (u, jeton, f) => offert(u) || estAdmin(jeton, f);

const erreur = (msg, code) => Object.assign(new Error(msg), { code });

// offre de lancement : le premier mois est offert à qui s'abonne avant la fin de l'offre (en plus des jours d'essai restants)
const PROMO_FIN = Date.parse(process.env.PROMO_FIN || '2026-11-25T23:59:59+01:00');
const PROMO_JOURS = +(process.env.PROMO_JOURS_OFFERTS || 30);
const promoActive = (maintenant = Date.now()) => Number.isFinite(PROMO_FIN) && maintenant <= PROMO_FIN && PROMO_JOURS > 0;
const promoInfo = () => (promoActive() ? { fin: new Date(PROMO_FIN).toISOString(), joursOfferts: PROMO_JOURS } : null);

/** Qui appelle ? Le jeton de session est vérifié par Supabase (impossible de se faire passer pour un autre compte). */
async function utilisateur(jeton, f = fetch) {
  if (!jeton || typeof jeton !== 'string' || jeton.length > 4000) throw erreur('Connectez-vous pour vous abonner', 401);
  const r = await f(SUPA_URL + '/auth/v1/user', { headers: { apikey: SUPA_CLE, Authorization: 'Bearer ' + jeton }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw erreur('Session expirée : reconnectez-vous', 401);
  const u = await r.json();
  if (!u || !u.id) throw erreur('Session expirée : reconnectez-vous', 401);
  return { id: u.id, email: u.email || '', confirme: !!(u.email_confirmed_at || u.confirmed_at), cree: Date.parse(u.created_at) || Date.now() };
}

// appel à l'API Stripe (formulaire encodé, comme l'exige Stripe)
async function stripe(chemin, { methode = 'GET', corps = null } = {}, f = fetch) {
  const enc = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => {
    const cle = pre ? `${pre}[${k}]` : k;
    if (v && typeof v === 'object') return enc(v, cle);
    return v === undefined || v === null ? [] : [`${encodeURIComponent(cle)}=${encodeURIComponent(String(v))}`];
  });
  const opts = { method: methode, headers: { Authorization: 'Bearer ' + cleStripe() }, signal: AbortSignal.timeout(15000) };
  let url = 'https://api.stripe.com/v1' + chemin;
  if (corps && methode === 'GET') url += (url.includes('?') ? '&' : '?') + enc(corps).join('&');
  else if (corps) { opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'; opts.body = enc(corps).join('&'); }
  const r = await f(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw erreur((j.error && j.error.message) || 'Paiement indisponible pour le moment', 502);
  return j;
}

// client Stripe du compte (retrouvé par l'identifiant du compte, enregistré dans ses métadonnées)
async function clientDe(u, creer, f) {
  const l = await stripe('/customers/search', { corps: { query: `metadata['budgetable_id']:'${u.id.replace(/'/g, '')}'`, limit: 1 } }, f);
  if (l.data && l.data[0]) return l.data[0];
  if (!creer) return null;
  return stripe('/customers', { methode: 'POST', corps: { email: u.email, metadata: { budgetable_id: u.id } } }, f);
}

const cache = new Map();   // état d'abonnement gardé 2 min par compte (moins d'appels à Stripe)

/** État : essai (jours restants), abonnement actif ou non, fin de période, résiliation demandée. */
async function etat(jeton, f = fetch, _site) {
  if (!actif()) return { disponible: false, prix: PRIX, essaiJours: ESSAI_JOURS, promo: promoInfo() };   // paiement pas encore branché : rien n'est bloqué
  const u = await utilisateur(jeton, f);
  let finEssai = u.cree + ESSAI_JOURS * 86400000;
  const base = () => ({ disponible: actif(), prix: PRIX, essaiJours: ESSAI_JOURS, finEssai: new Date(finEssai).toISOString(), enEssai: Date.now() < finEssai, abonne: false, promo: promoInfo() });
  if (await offertA(u, jeton, f)) return { ...base(), abonne: true, offert: true, statut: 'offert' };
  const c = cache.get(u.id);
  if (c && Date.now() - c.t < 120000) { finEssai = Math.max(finEssai, c.finEssai || 0); return { ...base(), ...c.v }; }
  const client = await clientDe(u, false, f);
  // mois offerts par le parrainage (date de fin d'accès gratuit, tenue chez Stripe)
  finEssai = Math.max(finEssai, accesOffert(client));
  let v = { abonne: false };
  if (client) {
    const subs = await stripe('/subscriptions', { corps: { customer: client.id, status: 'all', limit: 5 } }, f);
    const s = (subs.data || []).find((x) => ['active', 'trialing', 'past_due'].includes(x.status));
    if (s) v = { abonne: true, statut: s.status, finPeriode: new Date((s.current_period_end || (s.items && s.items.data && s.items.data[0] && s.items.data[0].current_period_end) || 0) * 1000).toISOString(), resiliation: !!s.cancel_at_period_end };
  }
  cache.set(u.id, { t: Date.now(), v, finEssai });
  if (cache.size > 5000) cache.clear();
  return { ...base(), ...v };
}
/** Fin de l'accès offert par le parrainage (0 si aucun). */
const accesOffert = (client) => (client && client.metadata && Date.parse(client.metadata.acces_offert_jusqua)) || 0;

/** Page de paiement Stripe : abonnement mensuel. Les jours d'essai restants sont offerts (aucun prélèvement avant la fin). */
async function paiement(jeton, f = fetch, site = SITE) {
  site = site || SITE;
  if (!actif()) throw erreur('L’abonnement ouvre très bientôt', 503);
  const u = await utilisateur(jeton, f);
  if (await offertA(u, jeton, f)) throw erreur('Votre accès est offert : rien à payer', 400);
  const client = await clientDe(u, true, f);
  const resteEssai = Math.floor((Math.max(u.cree + ESSAI_JOURS * 86400000, accesOffert(client)) - Date.now()) / 86400000);
  // pendant l'offre : un mois offert en plus (le premier prélèvement a lieu un mois après la fin de l'essai)
  const joursGratuits = Math.max(0, resteEssai) + (promoActive() ? PROMO_JOURS : 0);
  const s = await stripe('/checkout/sessions', { methode: 'POST', corps: {
    mode: 'subscription', customer: client.id, client_reference_id: u.id, locale: 'fr',
    line_items: { 0: { quantity: 1, price_data: { currency: 'eur', unit_amount: PRIX, recurring: { interval: 'month' }, product_data: { name: 'Budgétable — abonnement mensuel', description: 'Menus de la semaine, liste de courses, coachs et toutes les fonctions. Sans engagement.' } } } },
    subscription_data: { metadata: { budgetable_id: u.id }, ...(joursGratuits >= 1 ? { trial_period_days: Math.min(730, joursGratuits) } : {}), ...(promoActive() ? { description: 'Offre de lancement : premier mois offert' } : {}) },
    allow_promotion_codes: 'true',
    success_url: site + '/?abonnement=merci', cancel_url: site + '/?abonnement=annule',
  } }, f);
  cache.delete(u.id);
  return { url: s.url };
}

/** Espace client Stripe : changer de carte, voir les factures, résilier. */
async function portail(jeton, f = fetch, site = SITE) {
  site = site || SITE;
  if (!actif()) throw erreur('L’abonnement ouvre très bientôt', 503);
  const u = await utilisateur(jeton, f);
  const client = await clientDe(u, false, f);
  if (!client) throw erreur('Aucun abonnement sur ce compte', 404);
  const s = await stripe('/billing_portal/sessions', { methode: 'POST', corps: { customer: client.id, return_url: site + '/?abonnement=retour', locale: 'fr' } }, f);
  cache.delete(u.id);
  return { url: s.url };
}

module.exports = { etat, paiement, portail, actif, promoActive, promoInfo, PRIX, ESSAI_JOURS, utilisateur, stripe, clientDe, accesOffert, oublier: (id) => cache.delete(id), _viderCache: () => cache.clear() };
