'use strict';
// Placard : un produit frais entamé (viande, poisson) qui ne sert plus dans la semaine est retiré en entier
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const avec = (id, max = 1e9) => Object.values(E.REC).find((r) => !r.id.startsWith('g-') && r.ing.some(([i, q]) => i === id && q <= max));
test('poulet 500 g, recette 120 g, plus de poulet prévu : tout le poulet est retiré', () => {
  const r = avec('poulet_filet'), m = { recette: r.id, portions: 1 };
  const res = E.consommationAvecFin(m, [], { poulet_filet: 500, riz: 1000 });
  const st = E.retirerDuStock({ poulet_filet: 500, riz: 1000 }, res.retraits);
  assert.equal(st.poulet_filet, undefined);
  assert.ok(res.finis.some(([id]) => id === 'poulet_filet'));
  if (r.ing.some(([i]) => i === 'riz')) assert.ok(st.riz > 0 && st.riz < 1000, 'l’épicerie garde son reste');
});
test('encore du poulet dans un repas à venir : on ne retire que la quantité de la recette', () => {
  const r = avec('poulet_filet'), m = { recette: r.id, portions: 1 }, q = r.ing.find(([i]) => i === 'poulet_filet')[1];
  const st = E.retirerDuStock({ poulet_filet: 500 }, E.consommationAvecFin(m, [m], { poulet_filet: 500 }).retraits);
  assert.equal(st.poulet_filet, 500 - q);
});
test('lot de sachets (5 × 100 g) : seul le sachet entamé est retiré', () => {
  const r = avec('boeuf_hache', 100), m = { recette: r.id, portions: 1 };
  const st = E.retirerDuStock({ boeuf_hache: 500 }, E.consommationAvecFin(m, [], { boeuf_hache: 500 }).retraits);
  assert.equal(st.boeuf_hache, 400);
});
test('repas pris dehors ou fait de restes : rien n’est retiré', () => {
  const r = avec('poulet_filet');
  assert.deepEqual(E.consommationAvecFin({ recette: r.id, portions: 1, dehors: true }, [], { poulet_filet: 500 }).retraits, []);
});
