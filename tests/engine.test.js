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

test('rituels : chaque dîner à thème respecte son thème (si une recette compatible existe)', () => {
  const p = Object.assign(E.profilParDefaut(), { foyer: { adultes: 2, enfants: ['6-10'] } });
  p.rituels = { 0: 'pates', 1: 'soupe', 2: 'enfants', 3: 'vege', 4: 'pizza', 5: 'poisson', 6: 'mijote' };
  for (let seed = 1; seed <= 20; seed++) {
    const plan = E.genererSemaine(p, { seed });
    plan.jours.forEach((jp) => {
      assert.ok(jp.diner.theme, 'thème absent');
      assert.ok(E.THEMES[jp.diner.theme].ok(E.REC[jp.diner.recette], { classiques: [] }), jp.jour + ' ' + jp.diner.theme + ' : ' + E.REC[jp.diner.recette].nom);
    });
    assert.equal(plan.jours[2].diner.aChoisir, true);
  }
});

test('nos classiques : environ deux par semaine, jamais deux fois le même', () => {
  const p = E.profilParDefaut();
  const classiques = ['bolognaise', 'curry_poulet', 'crepes_salees', 'gratin_pates', 'dahl'];
  for (let seed = 1; seed <= 15; seed++) {
    const plan = E.genererSemaine(p, { seed, classiques });
    const ids = plan.jours.flatMap((jp) => E.SLOTS.map((s) => jp[s] && jp[s].recette)).filter(Boolean);
    const vus = ids.filter((id) => classiques.includes(id));
    assert.ok(vus.length >= 2, 'classiques : ' + vus.length);
    assert.equal(new Set(vus).size, vus.length);
  }
});

test('3 idées : plats différents, compatibles avec les allergies, même thème, sans compter de remplacement', () => {
  const p = Object.assign(E.profilParDefaut(), { allergies: ['gluten', 'lait'], foyer: { adultes: 2, enfants: ['3-5'] } });
  p.rituels = { 4: 'pizza', 0: 'monde' };
  const plan = E.genererSemaine(p, { seed: 3 });
  for (let j = 0; j < 7; j++) for (const s of E.SLOTS) {
    const ids = E.propositions(plan, j, s, p, {});
    assert.ok(ids.length >= 1);
    assert.equal(new Set(ids.concat(plan.jours[j][s].recette)).size, ids.length + 1);
    for (const id of ids) {
      assert.ok(E.recetteCompatible(E.REC[id], p).ok, id);
      const th = plan.jours[j][s].theme;
      if (th && E.THEMES[th]) assert.ok(E.THEMES[th].ok(E.REC[id], {}) || !E.recettesCompatibles(p).some((r) => r.repas.includes(s) && E.THEMES[th].ok(r, {}) && r.id !== plan.jours[j][s].recette), th);
    }
    const choisi = E.choisirRepas(plan, j, s, ids[0]);
    assert.equal(choisi.jours[j][s].recette, ids[0]);
    assert.equal(choisi.remplacements, plan.remplacements);
  }
});

test('pourquoi ce plat : 1 à 3 raisons courtes, en français', () => {
  const p = E.profilParDefaut();
  p.gouts = E.apprendre(E.goutsVides(), 'curry_poulet', 'adore');
  const plan = E.genererSemaine(p, { seed: 5, notes: { bolognaise: 5 } });
  let total = 0;
  plan.jours.forEach((jp, j) => E.SLOTS.forEach((s) => {
    const r = E.pourquoi(jp[s].recette, plan, j, s, p, { notes: { bolognaise: 5 } });
    assert.ok(r.length <= 3);
    r.forEach((x) => { assert.ok(x.length < 70, x); assert.ok(!/undefined|NaN|de [aeiouyéœ]/i.test(x), x); });
    total += r.length;
  }));
  assert.ok(total >= 14, 'trop peu de raisons : ' + total);
});

test('mes recettes : proposées dans les menus, jamais à une personne allergique, ingrédients hors catalogue sans prix', () => {
  const S = require('../js/saisie.js');
  const g = S.devinerIngredients('Wok de crevettes');
  const crevettes = g.extras.find((x) => x.nom === 'crevettes');
  assert.ok(crevettes && crevettes.tags.includes('crustaces'));
  E.definirPerso([
    { id: 'p-wok', nom: 'Wok de crevettes', ing: g.coches, extras: g.extras },
    { id: 'p-cache', nom: 'Gâteau secret', ing: [['farine', 40], ['oeufs', 1]], extras: ['sucre'], proposer: false }
  ]);
  const p = E.profilParDefaut();
  let vu = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const plan = E.genererSemaine(p, { seed });
    const ids = plan.jours.flatMap((jp) => E.SLOTS.map((s) => jp[s] && jp[s].recette));
    if (ids.includes('p-wok')) vu++;
    assert.ok(!ids.includes('p-cache'), 'recette non proposée mise au menu');
  }
  assert.ok(vu >= 6, 'recette de la bibliothèque trop rarement proposée : ' + vu + '/12');
  const allergique = Object.assign(E.profilParDefaut(), { allergies: ['crustaces'] });
  for (let seed = 1; seed <= 12; seed++) {
    const plan = E.genererSemaine(allergique, { seed });
    assert.ok(!plan.jours.some((jp) => E.SLOTS.some((s) => jp[s] && jp[s].recette === 'p-wok')), 'crevettes proposées à un allergique');
  }
  assert.equal(E.rechercherPlats(allergique, 'wok crevettes').resultats.includes('p-wok'), false);
  assert.equal(E.rechercherPlats(p, 'gateau secret').resultats[0], 'p-cache');
  const plan = E.placerRecette(E.genererSemaine(p, { seed: 1 }), 0, 'diner', 'p-wok');
  const art = E.listeCourses(plan, p).articles.find((a) => a.nom === 'Crevettes');
  assert.ok(art && art.sansPrix && art.cout === 0);
  E.definirPerso([]);
  assert.equal(E.REC['p-wok'], undefined);
});

test('saisie : ingrédients proposés d’après le nom, en respectant le profil', () => {
  const S = require('../js/saisie.js');
  const ids = (g) => g.coches.map(([id]) => id);
  assert.ok(['pates', 'boeuf_hache', 'tomates_concassees'].every((x) => ids(S.devinerIngredients('Lasagnes de mamie')).includes(x)));
  assert.ok(!ids(S.devinerIngredients('Chili sin carne végétarien')).includes('boeuf_hache'));
  assert.ok(!ids(S.devinerIngredients('Lasagnes', Object.assign(E.profilParDefaut(), { allergies: ['gluten'] }))).includes('pates'));
  assert.ok(ids(S.devinerIngredients('Velouté de potiron')).includes('courge'));
  assert.ok(!ids(S.devinerIngredients('Velouté de potiron')).includes('poireau'));
  assert.deepEqual(S.devinerIngredients('Gâteau au chocolat').suggestions, []);
  assert.ok(S.chercherIngredients('champ').includes('champignon'));
});

test('placard : ajout, retrait, nettoyage', () => {
  let st = E.ajouterAuStock({}, [['pates', 500], ['pates', 500], ['oeufs', 6]]);
  assert.equal(st.pates, 1000);
  st = E.retirerDuStock(st, [['oeufs', 10], ['pates', 300]]);
  assert.equal(st.pates, 700);
  assert.ok(!('oeufs' in st), 'un produit épuisé disparaît');
});

test('placard : la liste de courses ne rachète pas ce qui est à la maison', () => {
  const p = famille();
  const plan = E.genererSemaine(p, { seed: 7 });
  const sans = E.listeCourses(plan, p);
  const art = sans.articles.find((a) => !a.sansPrix && !a.enStock && E.ING[a.id].groupe !== 'A');
  const avec = E.listeCourses(plan, { ...p, stock: { [art.id]: 100000 } });
  const a2 = avec.articles.find((a) => a.id === art.id);
  assert.ok(a2.couvertParPlacard && a2.auPlacard > 0);
  assert.ok(avec.total < sans.total);
});

test('placard : idées de recettes avec ce qu’on a', () => {
  const p = profil({ stock: { courgette: 1000, pates: 1000, oeufs: 12, emmental: 400 } });
  const idees = E.recettesAvecStock(p, { slot: 'diner', jour: 2, n: 3 });
  assert.equal(idees.length, 3);
  for (const x of idees) assert.ok(x.utilise.length >= 2, E.REC[x.recette].nom);
  assert.ok(E.ceSoir(null, p, 2).avecPlacard.length >= 1);
});

test('placard : cuisiner un repas le déduit', () => {
  const plan = E.genererSemaine(famille(), { seed: 3 });
  const conso = E.consommationRepas(plan.jours[0].diner);
  assert.ok(conso.length);
  let st = E.ajouterAuStock({}, conso.map(([id, q]) => [id, q * 2]));
  st = E.retirerDuStock(st, conso);
  for (const [id, q] of conso) if (st[id] != null) assert.ok(Math.abs(st[id] - Math.round(q * 100) / 100) < 0.02, id);
});

test('lien de recette : lignes d’ingrédients → quantités par personne', () => {
  const S = require('../js/saisie.js');
  const r = S.analyserIngredients(['200 g de lardons', '3 œufs', '20 cl de crème fraîche', '1 pâte brisée', 'Sel, poivre', '300 g de crevettes'], 4, profil({ allergies: ['crustaces'] }));
  const q = Object.fromEntries(r.coches);
  assert.equal(q.lardons, 50); assert.equal(q.oeufs, 0.75); assert.equal(q.creme, 50);
  assert.ok(r.extras.find((x) => x.nom === 'pâte à tarte').coche);
  const cr = r.extras.find((x) => x.nom === 'crevettes');
  assert.ok(cr && !cr.coche && cr.alerte, 'un allergène n’est jamais coché d’office');
  assert.deepEqual(r.ignores, ['Sel, poivre']);
  assert.equal(S.nomDepuisLien('https://www.marmiton.org/recettes/recette_quiche-lorraine_30283.aspx'), 'Quiche lorraine');
});
