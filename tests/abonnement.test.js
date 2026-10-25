'use strict';
// Abonnement (Stripe et Supabase simulés) : essai de 7 jours, 2,99 €/mois, état lu chez Stripe
const test = require('node:test');
const assert = require('node:assert');
process.env.STRIPE_SECRET_KEY = 'sk_test_simule';
const A = require('../api/abonnement.js');
const JOUR = 86400000;
function faux({ creeIlYa = 2, clients = [], abonnements = [] } = {}) {
  const appels = [];
  const f = async (url, o = {}) => {
    appels.push({ url, o });
    const rep = (j, status = 200) => ({ ok: status < 400, status, json: async () => j });
    if (url.includes('/auth/v1/user')) return o.headers.Authorization === 'Bearer bon' ? rep({ id: 'u-1', email: 'moi@exemple.fr', created_at: new Date(Date.now() - creeIlYa * JOUR).toISOString() }) : rep({}, 401);
    if (url.includes('/customers/search')) return rep({ data: clients });
    if (url.endsWith('/customers')) return rep({ id: 'cus_nouveau' });
    if (url.includes('/subscriptions')) return rep({ data: abonnements });
    if (url.includes('/checkout/sessions')) return rep({ url: 'https://checkout.stripe.com/c/pay/test' });
    if (url.includes('/billing_portal/sessions')) return rep({ url: 'https://billing.stripe.com/p/session/test' });
    return rep({}, 404);
  };
  return { f, appels };
}
test('essai : 7 jours à partir de la création du compte', async () => {
  const { f } = faux({ creeIlYa: 2 });
  const e = await A.etat('bon', f);
  assert.strictEqual(e.disponible, true); assert.strictEqual(e.enEssai, true); assert.strictEqual(e.abonne, false); assert.strictEqual(e.prix, 299);
  const e2 = await A.etat('bon', faux({ creeIlYa: 9 }).f);
  assert.ok(e2.enEssai === false || e2.abonne === false);
});
test('jeton invalide : refusé', async () => { await assert.rejects(A.etat('mauvais', faux().f), /reconnectez/); await assert.rejects(A.etat(null, faux().f), /Connectez-vous/); });
test('abonné : lu chez Stripe (actif, fin de période, résiliation)', async () => {
  A._viderCache();
  const { f } = faux({ creeIlYa: 30, clients: [{ id: 'cus_1' }], abonnements: [{ status: 'active', current_period_end: Math.floor(Date.now() / 1000) + 20 * 86400, cancel_at_period_end: true }] });
  const e = await A.etat('bon', f);
  assert.strictEqual(e.abonne, true); assert.strictEqual(e.resiliation, true); assert.ok(Date.parse(e.finPeriode) > Date.now());
});
test('paiement : abonnement mensuel à 2,99 €, jours d’essai restants offerts, client relié au compte', async () => {
  const { f, appels } = faux({ creeIlYa: 3 });
  const r = await A.paiement('bon', f);
  assert.match(r.url, /^https:\/\/checkout\.stripe\.com\//);
  const cree = appels.find((x) => x.url.endsWith('/customers'));
  assert.ok(decodeURIComponent(cree.o.body).includes('metadata[budgetable_id]=u-1'));
  const corps = decodeURIComponent(appels.find((x) => x.url.includes('/checkout/sessions')).o.body);
  assert.ok(corps.includes('mode=subscription') && corps.includes('[unit_amount]=299') && corps.includes('[currency]=eur') && corps.includes('[interval]=month'), corps);
  assert.ok(/trial_period_days\]=[34]/.test(corps), 'reste de l’essai offert : ' + corps);
  assert.ok(corps.includes('success_url=https://budgetable.fr/?abonnement=merci'));
  // essai fini : pas de jours offerts
  const b = faux({ creeIlYa: 10, clients: [{ id: 'cus_1' }] });
  await A.paiement('bon', b.f);
  assert.ok(!decodeURIComponent(b.appels.find((x) => x.url.includes('/checkout/sessions')).o.body).includes('trial_period_days'));
});
test('espace client Stripe (résilier, carte, factures)', async () => {
  const r = await A.portail('bon', faux({ clients: [{ id: 'cus_1' }] }).f);
  assert.match(r.url, /^https:\/\/billing\.stripe\.com\//);
  await assert.rejects(A.portail('bon', faux({ clients: [] }).f), /Aucun abonnement/);
});
test('paiement pas encore branché : rien n’est bloqué', async () => {
  const k = process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_SECRET_KEY;
  const e = await A.etat(null, faux().f);
  assert.strictEqual(e.disponible, false);
  process.env.STRIPE_SECRET_KEY = k;
});
