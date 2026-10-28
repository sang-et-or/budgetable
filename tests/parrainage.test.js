'use strict';
// Parrainage (Stripe et Supabase simulés) : un mois offert à la marraine et à la filleule
const test = require('node:test');
const assert = require('node:assert');
process.env.STRIPE_SECRET_KEY = 'sk_test_simule';
const A = require('../api/abonnement.js');
const P = require('../api/parrainage.js');
const JOUR = 86400000;

// Stripe simulé avec de vrais clients en mémoire
function monde({ comptes, abonnes = [] }) {
  const clients = {};   // id → client
  const credits = [];
  let n = 0;
  const f = async (url, o = {}) => {
    const rep = (j, status = 200) => ({ ok: status < 400, status, json: async () => j });
    const corps = decodeURIComponent(o.body || '');
    if (url.includes('/auth/v1/user')) { const c = comptes[o.headers.Authorization.slice(7)]; return c ? rep(c) : rep({}, 401); }
    if (url.includes('/customers/search')) {
      const q = decodeURIComponent(url.split('query=')[1] || '');
      const m = /metadata\['(\w+)'\]:'([^']+)'/.exec(q);
      return rep({ data: Object.values(clients).filter((c) => c.metadata[m[1]] === m[2]).slice(0, 1) });
    }
    if (/\/customers$/.test(url)) { const id = 'cus_' + (++n); const meta = {}; for (const [, k, v] of corps.matchAll(/metadata\[(\w+)\]=([^&]*)/g)) meta[k] = v; clients[id] = { id, metadata: meta }; return rep(clients[id]); }
    if (/\/customers\/cus_\d+\/balance_transactions$/.test(url)) { credits.push({ client: url.split('/')[5], corps }); return rep({ id: 'cbtxn' }); }
    if (/\/customers\/cus_\d+$/.test(url)) { const c = clients[url.split('/').pop()]; for (const [, k, v] of corps.matchAll(/metadata\[(\w+)\]=([^&]*)/g)) c.metadata[k] = v; return rep(c); }
    if (url.includes('/subscriptions')) { const id = /customer=(cus_\d+)/.exec(url)[1]; return rep({ data: abonnes.includes(clients[id] && clients[id].metadata.budgetable_id) ? [{ status: 'active', current_period_end: Math.floor(Date.now() / 1000) + 20 * 86400 }] : [] }); }
    return rep({}, 404);
  };
  return { f, clients, credits };
}
const compte = (id, joursIlYa, confirme = true) => ({ id, email: id + '@ex.fr', created_at: new Date(Date.now() - joursIlYa * JOUR).toISOString(), ...(confirme ? { email_confirmed_at: new Date().toISOString() } : {}) });

test('code de la marraine, puis la filleule valide : un mois offert à toutes les deux', async () => {
  A._viderCache();
  const w = monde({ comptes: { marraine: compte('m-1', 40), filleule: compte('f-1', 1) } });
  const m = await P.moi('marraine', w.f);
  assert.match(m.code, /^[0-9A-F]{8}$/); assert.ok(m.lien.endsWith('/?parrain=' + m.code)); assert.strictEqual(m.filleuls, 0);
  const r = await P.valider('filleule', m.code.toLowerCase(), w.f);
  assert.ok(r.ok);
  // filleule : essai prolongé de 30 jours (7 + 30 environ)
  const ef = await A.etat('filleule', w.f);
  assert.ok(Date.parse(ef.finEssai) > Date.now() + 35 * JOUR, ef.finEssai);
  // marraine (essai fini, pas abonnée) : 30 jours d'accès offerts à partir d'aujourd'hui
  A._viderCache();
  const em = await A.etat('marraine', w.f);
  assert.ok(em.enEssai && Date.parse(em.finEssai) > Date.now() + 29 * JOUR);
  const m2 = await P.moi('marraine', w.f);
  assert.strictEqual(m2.filleuls, 1); assert.strictEqual(m2.moisGagnes, 1);
  // une seule fois par filleule
  assert.deepStrictEqual(await P.valider('filleule', m.code, w.f), { deja: true });
});

test('marraine abonnée : le mois est crédité sur sa prochaine facture', async () => {
  A._viderCache();
  const w = monde({ comptes: { marraine: compte('m-2', 90), filleule: compte('f-2', 2) }, abonnes: ['m-2'] });
  const m = await P.moi('marraine', w.f);
  await P.valider('filleule', m.code, w.f);
  assert.strictEqual(w.credits.length, 1);
  assert.ok(w.credits[0].corps.includes('amount=-299') && w.credits[0].corps.includes('currency=eur'));
});

test('refus : son propre code, code inconnu, adresse non confirmée, compte ancien', async () => {
  A._viderCache();
  const w = monde({ comptes: { moi: compte('x-1', 1), neuf: compte('x-2', 1, false), vieux: compte('x-3', 60) } });
  const m = await P.moi('moi', w.f);
  await assert.rejects(P.valider('moi', m.code, w.f), /propre code/);
  await assert.rejects(P.valider('moi', 'ABCDEF12', w.f), /inconnu/);
  await assert.rejects(P.valider('neuf', m.code, w.f), /Confirmez/);
  await assert.rejects(P.valider('vieux', m.code, w.f), /nouveaux comptes/);
  await assert.rejects(P.valider('moi', 'zz', w.f), /invalide/);
});

test('paiement après parrainage : les jours offerts restent gratuits', async () => {
  A._viderCache();
  const w = monde({ comptes: { marraine: compte('m-4', 40), filleule: compte('f-4', 1) } });
  const m = await P.moi('marraine', w.f);
  await P.valider('filleule', m.code, w.f);
  const appels = [];
  const f2 = async (url, o) => { appels.push({ url, o }); if (url.includes('/checkout/sessions')) return { ok: true, status: 200, json: async () => ({ url: 'https://checkout.stripe.com/x' }) }; return w.f(url, o); };
  await A.paiement('filleule', f2);
  const corps = decodeURIComponent(appels.find((x) => x.url.includes('/checkout/sessions')).o.body);
  const jours = +/trial_period_days\]=(\d+)/.exec(corps)[1];
  assert.ok(jours >= 35, 'jours gratuits : ' + jours);
});
