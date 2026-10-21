// Lancer avec : node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');

const profil = (modif = {}) => ({ ...E.profilParDefaut(), ...modif });
const famille = () => profil({ foyer: { adultes: 1, enfants: ['6-10', '3-5'] }, budget: 60 });
const recettesDu = (plan) => plan.jours.flatMap((j) => E.SLOTS.map((s) => j[s]).filter(Boolean)).map((m) => E.REC[m.recette]);

test('génère 7 déjeuners et 7 dîners', () => {
  const plan = E.genererSemaine(famille(), { seed: 42 });
  assert.equal(plan.jours.length, 7);
  for (const j of plan.jours) { assert.ok(j.dejeuner); assert.ok(j.diner); }
});

test('même graine = même semaine (reproductible)', () => {
  assert.deepEqual(E.genererSemaine(famille(), { seed: 7 }), E.genererSemaine(famille(), { seed: 7 }));
});

test('portions : 1 adulte + enfants 6-10 et 3-5 = 2,2 portions adulte', () => {
  assert.equal(E.portions(famille(), 0, 'diner'), 2.2);
});

test('déjeuners dehors en semaine : seuls ceux à la maison comptent, enfants le mercredi', () => {
  const p = famille();
  p.dejeuners = { mode: 'dehors', adultesMaison: 0, enfantsMaison: 'mercredi' };
  assert.equal(E.portions(p, 0, 'dejeuner'), 0);     // lundi : personne
  assert.equal(E.portions(p, 2, 'dejeuner'), 1.2);   // mercredi : les enfants
  assert.equal(E.portions(p, 5, 'dejeuner'), 2.2);   // samedi : tout le monde
  const plan = E.genererSemaine(p, { seed: 3 });
  assert.equal(plan.jours[0].dejeuner, null);
});

test('plus de 10 000 recettes, identifiants uniques, noms sans trou', () => {
  assert.ok(E.RECETTES.length >= 10000, String(E.RECETTES.length));
  assert.equal(new Set(E.RECETTES.map((r) => r.id)).size, E.RECETTES.length);
  for (const r of E.RECETTES) {
    assert.ok(!/undefined|null|\s,|\s\s/.test(r.nom), r.nom);
    assert.ok(r.etapes.length >= 3 && r.etapes.every((e) => !/undefined/.test(e)), r.id);
    for (const [id, q] of r.ing) assert.ok(E.ING[id] && q > 0, r.id + ' ' + id);
  }
});

test('SÉCURITÉ exhaustive : pour chaque allergène, aucune des 12 000+ recettes compatibles ne le contient', () => {
  for (const al of Object.keys(E.LIBELLES.allergies)) {
    const compat = E.recettesCompatibles(profil({ allergies: [al] }));
    assert.ok(compat.length > 0);
    for (const r of compat) assert.ok(!r.ing.some(([id]) => E.ING[id].tags.includes(al)), r.nom + ' / ' + al);
  }
});

test('SÉCURITÉ : aucune recette ne contient un allergène déclaré (200 semaines au hasard)', () => {
  const allergenes = Object.keys(E.LIBELLES.allergies);
  for (let s = 1; s <= 200; s++) {
    const a = allergenes.filter((_, i) => (s >> i) & 1).slice(0, 4);
    const p = profil({ allergies: a, equipement: ['plaque', 'four', 'micro'] });
    const plan = E.genererSemaine(p, { seed: s });
    for (const rec of recettesDu(plan)) {
      for (const [id] of rec.ing) {
        for (const al of a) assert.ok(!E.ING[id].tags.includes(al), `${rec.nom} contient ${al} (graine ${s})`);
      }
    }
  }
});

test('végétalien : aucun produit animal ; végétarien : ni viande ni poisson', () => {
  for (const regime of ['vegetalien', 'vegetarien']) {
    const plan = E.genererSemaine(profil({ regime }), { seed: 11 });
    for (const rec of recettesDu(plan)) for (const [id] of rec.ing) {
      const t = E.ING[id].tags;
      if (regime === 'vegetalien') assert.ok(!t.includes('animal'), rec.nom);
      else assert.ok(!t.includes('viande') && !t.includes('poisson'), rec.nom);
    }
  }
});

test('sans porc et halal : jamais de porc', () => {
  for (const regime of ['sans_porc', 'halal']) {
    for (const rec of recettesDu(E.genererSemaine(profil({ regime }), { seed: 5 }))) {
      assert.ok(!rec.ing.some(([id]) => E.ING[id].tags.includes('porc')), rec.nom);
    }
  }
});

test('flexitarien : 3 repas avec viande au maximum', () => {
  const plan = E.genererSemaine(profil({ regime: 'flexitarien' }), { seed: 9 });
  assert.ok(recettesDu(plan).filter(E.contientViande).length <= 3);
});

test('sans four : aucune recette au four', () => {
  const plan = E.genererSemaine(profil({ equipement: ['plaque'] }), { seed: 2 });
  for (const rec of recettesDu(plan)) assert.ok(!rec.equip.includes('four'), rec.nom);
});

test('temps : en semaine, rien au-dessus de 20 min si demandé', () => {
  const plan = E.genererSemaine(profil({ temps: { semaine: 20, weekend: 60 } }), { seed: 4 });
  plan.jours.slice(0, 5).forEach((j) => E.SLOTS.forEach((s) => assert.ok(E.REC[j[s].recette].temps <= 20)));
});

test('test de goût : 12 plats variés, et les réponses changent les menus proposés', () => {
  const p = famille();
  const ids = E.selectionTest(p, 12, 4);
  assert.equal(ids.length, 12);
  assert.ok(new Set(ids.map((id) => E.REC[id].modele)).size >= 10, 'familles trop peu variées');
  let g = E.goutsVides();
  for (const id of ids) g = E.apprendre(g, id, E.REC[id].prot === 'saumon' || E.REC[id].cuisine === 'asiatique' ? 'adore' : 'non');
  const plan = E.genererSemaine({ ...p, gouts: g }, { seed: 4 });
  const aimes = recettesDu(plan).filter((r) => r.cuisine === 'asiatique' || r.prot === 'saumon').length;
  const avant = recettesDu(E.genererSemaine(p, { seed: 4 })).filter((r) => r.cuisine === 'asiatique' || r.prot === 'saumon').length;
  assert.ok(aimes > avant, `aimés ${aimes} vs ${avant}`);
  assert.ok(E.resumeGouts(g).aime.length > 0);
});

test('assistant IA : seules les clés connues sont retenues, valeurs bornées', () => {
  const g = E.fusionnerGouts(E.goutsVides(), { ingredients: { saumon: 9, inconnu: 3, tofu: 'x' }, cuisines: { asiatique: 2, martienne: 3 }, modeles: { curry: -2 } });
  assert.equal(g.ing.saumon, 3);
  assert.equal(g.ing.inconnu, undefined);
  assert.equal(g.ing.tofu, undefined);
  assert.equal(g.cuisine.asiatique, 2);
  assert.equal(g.cuisine.martienne, undefined);
  assert.equal(g.modele.curry, -2);
});

test('variété : pas deux fois le même plat avec une autre épice ou un autre féculent', () => {
  for (const seed of [3, 21, 44]) {
    const sigs = recettesDu(E.genererSemaine(famille(), { seed })).map((r) => r.sig || r.id);
    assert.equal(new Set(sigs).size, sigs.length, 'doublon graine ' + seed);
  }
});

test('variété : une recette ne revient pas plus de 2 fois par semaine', () => {
  const comptes = {};
  for (const r of recettesDu(E.genererSemaine(famille(), { seed: 21 }))) comptes[r.id] = (comptes[r.id] || 0) + 1;
  assert.ok(Math.max(...Object.values(comptes)) <= 2);
});

test('remplacer un repas change la recette et compte le remplacement', () => {
  const p = famille();
  const plan = E.genererSemaine(p, { seed: 8 });
  const nouveau = E.remplacerRepas(plan, 3, 'diner', p);
  assert.notEqual(nouveau.jours[3].diner.recette, plan.jours[3].diner.recette);
  assert.equal(nouveau.remplacements, 1);
});

test('une recette notée 1 étoile n’est plus proposée', () => {
  const p = famille();
  const plan = E.genererSemaine(p, { seed: 8 });
  const cible = plan.jours[0].diner.recette;
  const plan2 = E.genererSemaine(p, { seed: 8, notes: { [cible]: 1 } });
  assert.ok(!recettesDu(plan2).some((r) => r.id === cible));
});

test('liste de courses : conditionnements arrondis au supérieur, provisions déduites', () => {
  const p = famille();
  const plan = E.genererSemaine(p, { seed: 8 });
  const l1 = E.listeCourses(plan, p);
  for (const a of l1.articles) assert.ok(a.conditionnements * E.ING[a.id].cond >= a.quantite - 1e-6);
  const premier = l1.articles.find((a) => !a.enStock);
  const l2 = E.listeCourses(plan, { ...p, provisions: [premier.id] });
  assert.ok(Math.abs(l1.total - premier.cout - l2.total) < 0.011);
  assert.equal(l1.source.type, 'demo');
});

test('budget insuffisant : alerte, conseils, et l’ajustement fait baisser le coût', () => {
  const p = { ...famille(), budget: 25 };
  const plan = E.genererSemaine(p, { seed: 8 });
  const a = E.analyseBudget(plan, p);
  assert.equal(a.ok, false);
  assert.ok(a.conseils.length > 0);
  const aj = E.ajusterAuBudget(plan, p);
  assert.ok(aj.estimation < a.estimation);
  assert.ok(aj.changements.length > 0);
});

test('ce soir : renvoie le dîner prévu et des idées rapides compatibles', () => {
  const p = famille();
  const plan = E.genererSemaine(p, { seed: 8 });
  const r = E.ceSoir(plan, p, 2);
  assert.equal(r.prevu.recette, plan.jours[2].diner.recette);
  assert.ok(r.idees.length > 0);
  for (const i of r.idees) assert.ok(E.REC[i.recette].temps <= 20);
});

test('drives (démo) : le mode compromis n’utilise jamais plus de magasins que le mode minimum', () => {
  const p = famille();
  const liste = E.listeCourses(E.genererSemaine(p, { seed: 8 }), p);
  const mags = E.magasinsDemo();
  const min = E.optimiserDrives(liste.articles, mags, { mode: 'minimum' });
  const comp = E.optimiserDrives(liste.articles, mags, { mode: 'compromis', penaliteMagasin: 5 });
  assert.ok(comp.magasins.length <= min.magasins.length);
  assert.ok(min.total <= comp.total + 1e-9);
  const n = min.magasins.reduce((s, m) => s + m.articles.length, 0);
  assert.equal(n + min.manquant.length, liste.articles.filter((a) => !a.enStock).length);
});

test('test de goût : uniquement des plats avec une vraie photo, quel que soit le profil', () => {
  const P = require('../js/photos.js');
  for (const mod of [{}, { regime: 'vegetalien' }, { allergies: ['gluten', 'lactose'] }, { regime: 'vegetarien', allergies: ['gluten', 'oeuf'] }]) {
    const p = Object.assign(E.profilParDefaut(), mod);
    const ids = E.selectionTest(p, 12, 3, (r) => !!P.photoFidele(r));
    assert.ok(ids.length >= 8, 'trop peu de plats : ' + ids.length);
    for (const id of ids) { assert.ok(P.photoFidele(E.REC[id]), id); assert.ok(E.recetteCompatible(E.REC[id], p).ok, id); }
  }
});

test('chacun des 12 000+ menus a une vraie photo de son type de plat, créditée', () => {
  const P = require('../js/photos.js');
  for (const r of E.RECETTES) {
    const ph = P.photoFidele(r);
    assert.ok(ph && ph.src.startsWith('https://upload.wikimedia.org/') && ph.auteur && ph.licenceUrl, r.id);
  }
});
