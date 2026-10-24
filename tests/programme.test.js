// Programme minceur : garde-fous et calculs prudents
const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/programme.js');
const base = { sexe: 'f', age: 40, taille: 165, poids: 80, objectif: 68, activite: '1.4', rythme: 'normale', tca: 'non', grossesse: 'non' };
test('refuse les mineurs, les TCA, la grossesse et un IMC bas', () => {
  assert.equal(P.verifier({ ...base, age: 16 }).stop, 'mineur');
  assert.equal(P.verifier({ ...base, tca: 'oui' }).stop, 'tca');
  assert.equal(P.verifier({ ...base, grossesse: 'oui' }).stop, 'grossesse');
  assert.equal(P.verifier({ ...base, poids: 48, objectif: 45 }).stop, 'imc_bas');
  assert.ok(P.verifier({ ...base, objectif: 45 }).erreurs.some((e) => /trop bas/.test(e)));
  assert.ok(P.verifier(base).ok);
});
test('la cible ne descend jamais sous les besoins de base ni 1200 kcal', () => {
  for (const poids of [50, 60, 80, 120]) for (const act of ['1.4', '1.9']) {
    const c = P.calculer({ ...base, poids, objectif: 49, activite: act }, -300);
    assert.ok(c.cible >= 1200 && c.cible >= c.base - 25, JSON.stringify(c));
    assert.ok(c.cible <= c.entretien);
  }
  const h = P.calculer({ ...base, sexe: 'h', poids: 70, taille: 160, age: 70 }, -300);
  assert.ok(h.cible >= 1500);
});
test('perte trop rapide → repère remonté ; palier de 2 semaines → baissé', () => {
  const prog = { ...base, poidsDepart: 80, pesees: [] };
  let r = P.adapter(prog, 78.8, 'bien');
  assert.ok(r.prog.ajustement > 0);
  r = P.adapter({ ...prog, pesees: [{ d: 'x', kg: 79 }] }, 78.95, 'bien');
  r = P.adapter(r.prog, 78.9, 'bien');
  assert.ok(r.prog.ajustement < 0, r.message);
});
test('portions : jamais plus qu’une part, ¾ ou ½ pour les plats riches', () => {
  assert.equal(P.portion(800, 540).f, 0.75);
  assert.equal(P.portion(1100, 500).f, 0.5);
  assert.equal(P.portion(400, 540).f, 1);
});
