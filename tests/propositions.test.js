// « Encore d'autres idées » : pas deux fois le même plat ni la même variante, et des familles de plats qui changent
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');
test('six séries d’idées sans répétition de plat ni de variante', () => {
  for (const seed of [5, 9, 21]) for (const [j, sl] of [[5, 'diner'], [2, 'dejeuner']]) {
    const p = E.profilParDefaut(); const plan = E.genererSemaine(p, { seed });
    if (!plan.jours[j][sl]) continue;
    const ex = [], sigs = new Set(), modeles = {};
    for (let t = 0; t < 6; t++) {
      const ids = E.propositions(plan, j, sl, p, { exclure: ex, tour: t, notes: {}, classiques: [] });
      for (const id of ids) {
        const r = E.REC[id];
        assert.ok(!ex.includes(id), 'plat déjà proposé : ' + r.nom);
        assert.ok(!sigs.has(r.sig || r.id), 'variante déjà proposée : ' + r.nom);
        sigs.add(r.sig || r.id); if (r.modele !== 'maison') modeles[r.modele] = (modeles[r.modele] || 0) + 1;
      }
      ex.push(...ids);
    }
    assert.ok(Math.max(...Object.values(modeles)) <= 3, 'trop de plats de la même famille : ' + JSON.stringify(modeles));
  }
});
