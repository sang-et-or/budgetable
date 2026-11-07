// Variété d'une semaine à l'autre : pas le même plat, ni un plat qui lui ressemble (même format, même protéine)
const test = require('node:test');
const assert = require('node:assert');
global.window = global;
const E = require('../js/engine.js');
const ids = (s) => s.jours.flatMap((j) => ['dejeuner', 'diner'].map((x) => j[x] && j[x].recette)).filter(Boolean);
const format = (r) => r.modele === 'maison' ? r.sig || r.id : r.modele + '|' + (r.prot || '');
function ressemblance(mod) {
  const p = E.profilParDefaut(); mod(p);
  let proche = 0, n = 0;
  for (let k = 0; k < 8; k++) {
    E.definirRecents([]);
    const a = ids(E.genererSemaine(p, { seed: 100 + k }));
    E.definirRecents(a);
    const b = ids(E.genererSemaine(p, { seed: 900 + k }));
    const fa = new Set(a.map((x) => format(E.REC[x])));
    proche += b.filter((x) => fa.has(format(E.REC[x]))).length; n += b.length;
  }
  E.definirRecents([]);
  return proche / n;
}
test('nouvelle semaine : peu de plats qui ressemblent à ceux de la semaine d’avant', () => {
  assert.ok(ressemblance(() => {}) < 0.12, 'profil par défaut');
  assert.ok(ressemblance((p) => { p.equipement = ['plaque']; }) < 0.12, 'plaque seule');
  assert.ok(ressemblance((p) => { p.regime = 'vegetarien'; }) < 0.35, 'végétarien (moins de recettes possibles)');
});
