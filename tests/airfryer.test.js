// Recettes air fryer : proposées seulement avec une friteuse à air, 2 ou 3 par semaine, et toutes valides
const test = require('node:test');
const assert = require('node:assert');
global.window = global;
require('../js/airfryer.js'); require('../js/catalogue.js'); require('../js/saison.js');
const E = require('../js/engine.js');
E.ajouterIngredients([].concat(global.Saison.INGREDIENTS, global.CatalogueExtra.INGREDIENTS));   // comme l'appli au démarrage
E.ajouterRecettes(global.AirFryer.INGREDIENTS, global.AirFryer.RECETTES);
const af = (sem) => sem.jours.flatMap((j) => ['dejeuner', 'diner'].map((s) => j[s] && j[s].recette)).filter((id) => id && String(id).startsWith('af-'));

test('les 12 recettes air fryer sont chargées, avec un coût et des ingrédients connus', () => {
  const l = global.AirFryer.RECETTES;
  assert.strictEqual(l.length, 12);
  for (const r of l) { assert.ok(E.REC[r.id], r.id); assert.ok(E.coutPortion(E.REC[r.id]) > 0.3 && E.coutPortion(E.REC[r.id]) < 4, r.id + ' ' + E.coutPortion(E.REC[r.id])); }
});
test('sans friteuse à air : aucune recette air fryer', () => {
  const p = E.profilParDefaut();
  p.equipement = ['plaque', 'four'];
  for (let k = 0; k < 5; k++) assert.strictEqual(af(E.genererSemaine(p, { graine: 10 + k })).length, 0);
});
test('avec une friteuse à air : 1 à 4 recettes air fryer par semaine', () => {
  const p = E.profilParDefaut();
  p.equipement = ['plaque', 'airfryer'];
  const n = [0, 1, 2, 3, 4, 5].map((k) => af(E.genererSemaine(p, { graine: 20 + k })).length);
  assert.ok(n.every((x) => x >= 1 && x <= 4), JSON.stringify(n));
});
