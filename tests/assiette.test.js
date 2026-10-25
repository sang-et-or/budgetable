// Assiette minceur : ce qui fait partie du plat (farine, pâte, crème de la sauce, fromage gratiné…) n'est jamais réduit à part
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');
const BASE = ['farine', 'pate_feuilletee', 'pate_brisee', 'pate_sablee', 'pate_pizza', 'chapelure', 'creme', 'creme_liquide', 'lait_coco'];
test('la farine, les pâtes à tarte et la crème ne sont jamais « à moitié » : on prend une plus petite part', () => {
  let n = 0;
  for (const r of Object.values(E.REC)) {
    if (r.gourmand) continue;
    const a = E.assietteMinceur(r); if (!a) continue;
    for (const [id, f] of a.aj) if (BASE.includes(id)) { assert.ok(f === 0.75 || f === 1, `${r.nom} : ${id} ×${f}`); n++; }
    if (/^(Gratin|Quiche)/.test(r.nom)) { assert.ok(a.reduite, r.nom); assert.ok(a.ajout.length, r.nom + ' sans salade'); }
  }
  assert.ok(n > 10);
});
test('le riz, les pâtes ou la semoule servis à part se réduisent de moitié', () => {
  const r = Object.values(E.REC).find((x) => /avec du riz$/.test(x.nom) && x.modele === 'curry');
  const a = E.assietteMinceur(r);
  assert.equal((a.aj.find(([id]) => id === 'riz') || [])[1], 0.5);
});
test('la liste de courses ajoute la salade d’accompagnement et ne retire pas la farine', () => {
  const p = { ...E.profilParDefaut(), programme: { personnes: 1, cible: 1600, cibleRepas: 520 } };
  const q = Object.values(E.REC).find((x) => /^Quiche/.test(x.nom) && x.repas.includes('diner'));
  const plan = E.genererSemaine(p, { seed: 3 });
  plan.jours[1].diner = { recette: q.id, portions: 1 };
  const avec = E.listeCourses(plan, p), sans = E.listeCourses(plan, { ...p, programme: null });
  const qte = (l, id) => (l.articles.find((a) => a.id === id) || { quantite: 0 }).quantite;
  assert.ok(qte(avec, 'salade') > qte(sans, 'salade'));
  assert.ok(qte(avec, 'farine') <= qte(sans, 'farine') && qte(avec, 'farine') >= qte(sans, 'farine') * 0.7);
});
