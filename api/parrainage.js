/* Budgétable — parrainage : « Invitez une amie : un mois offert à toutes les deux ».
 *
 * Pas de base de données en plus : tout est noté dans les métadonnées des clients Stripe (comme l'abonnement).
 *   - parrain_code       : le code de parrainage du compte (8 caractères, tiré de son identifiant)
 *   - compte_cree        : date de création du compte (pour calculer la fin de son essai)
 *   - parraine_par       : client Stripe de la marraine (une seule fois par compte)
 *   - acces_offert_jusqua: fin de l'accès gratuit offert par le parrainage
 *   - filleuls, mois_gagnes : compteurs de la marraine (12 mois offerts au plus)
 * Récompense : sans abonnement, 30 jours d'accès gratuit en plus ; avec un abonnement, un mois crédité sur la prochaine facture.
 * Règles : la filleule confirme son adresse e-mail, crée son compte depuis moins de 30 jours, et ne peut pas se parrainer.
 */
'use strict';
const crypto = require('crypto');
const A = require('./abonnement.js');
const JOUR = 86400000;
const MAX_MOIS = 12;
const SITE = (process.env.SITE || 'https://budgetable.fr').replace(/\/+$/, '');
const erreur = (msg, code) => Object.assign(new Error(msg), { code });

const codeDe = (id) => crypto.createHash('sha256').update('budgetable-parrain:' + id).digest('hex').slice(0, 8).toUpperCase();
const nettoyer = (c) => String(c || '').toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8);

async function abonneStripe(client, f) {
  const subs = await A.stripe('/subscriptions', { corps: { customer: client.id, status: 'all', limit: 5 } }, f);
  return (subs.data || []).some((x) => ['active', 'trialing', 'past_due'].includes(x.status));
}
async function majClient(client, meta, f) {
  return A.stripe('/customers/' + client.id, { methode: 'POST', corps: { metadata: meta } }, f);
}
/** Un mois offert : crédit sur la prochaine facture si abonnée, sinon 30 jours d'accès gratuit en plus. */
async function offrirMois(client, finEssaiCompte, f) {
  if (await abonneStripe(client, f)) {
    await A.stripe(`/customers/${client.id}/balance_transactions`, { methode: 'POST', corps: { amount: -A.PRIX, currency: 'eur', description: 'Parrainage Budgétable : un mois offert' } }, f);
    return { credit: true };
  }
  const depart = Math.max(Date.now(), finEssaiCompte || 0, A.accesOffert(client));
  return { acces: new Date(depart + 30 * JOUR).toISOString() };
}

/** Mon code, mon lien et mes compteurs (le client Stripe est créé si besoin, pour y noter le code). */
async function moi(jeton, f = fetch) {
  if (!A.actif()) throw erreur('Le parrainage ouvre avec l’abonnement', 503);
  const u = await A.utilisateur(jeton, f);
  let client = await A.clientDe(u, true, f);
  const code = codeDe(u.id);
  const m = client.metadata || {};
  if (m.parrain_code !== code || !m.compte_cree) client = await majClient(client, { parrain_code: code, compte_cree: new Date(u.cree).toISOString() }, f);
  const mm = client.metadata || {};
  return { code, lien: `${SITE}/?parrain=${code}`, filleuls: +mm.filleuls || 0, moisGagnes: +mm.mois_gagnes || 0, maxMois: MAX_MOIS, parraine: !!mm.parraine_par, accesOffertJusqua: mm.acces_offert_jusqua || null };
}

/** La filleule valide le code reçu, une fois son compte créé et son adresse confirmée. */
async function valider(jeton, codeRecu, f = fetch) {
  if (!A.actif()) throw erreur('Le parrainage ouvre avec l’abonnement', 503);
  const u = await A.utilisateur(jeton, f);
  const code = nettoyer(codeRecu);
  if (code.length !== 8) throw erreur('Code de parrainage invalide', 400);
  if (!u.confirme) throw erreur('Confirmez d’abord votre adresse e-mail (lien reçu par e-mail)', 403);
  if (code === codeDe(u.id)) throw erreur('Vous ne pouvez pas utiliser votre propre code', 400);
  if (Date.now() - u.cree > 30 * JOUR) throw erreur('Le parrainage est réservé aux nouveaux comptes', 403);
  const filleule = await A.clientDe(u, true, f);
  if ((filleule.metadata || {}).parraine_par) return { deja: true };
  const l = await A.stripe('/customers/search', { corps: { query: `metadata['parrain_code']:'${code}'`, limit: 1 } }, f);
  const marraine = l.data && l.data[0];
  if (!marraine) throw erreur('Code de parrainage inconnu', 404);
  if (marraine.id === filleule.id) throw erreur('Vous ne pouvez pas utiliser votre propre code', 400);
  // la filleule : un mois offert
  const rf = await offrirMois(filleule, u.cree + A.ESSAI_JOURS * JOUR, f);
  await majClient(filleule, { parraine_par: marraine.id, parraine_le: new Date().toISOString(), ...(rf.acces ? { acces_offert_jusqua: rf.acces } : {}) }, f);
  // la marraine : un mois offert, 12 au plus
  const mm = marraine.metadata || {};
  const dejaGagnes = +mm.mois_gagnes || 0;
  let rm = { plafond: true };
  if (dejaGagnes < MAX_MOIS) {
    rm = await offrirMois(marraine, mm.compte_cree ? Date.parse(mm.compte_cree) + A.ESSAI_JOURS * JOUR : 0, f);
    await majClient(marraine, { filleuls: (+mm.filleuls || 0) + 1, mois_gagnes: dejaGagnes + 1, ...(rm.acces ? { acces_offert_jusqua: rm.acces } : {}) }, f);
  } else await majClient(marraine, { filleuls: (+mm.filleuls || 0) + 1 }, f);
  A.oublier(u.id); if (mm.budgetable_id) A.oublier(mm.budgetable_id);
  return { ok: true, filleule: rf, marraine: rm.plafond ? 'plafond' : 'ok' };
}

module.exports = { moi, valider, codeDe };
