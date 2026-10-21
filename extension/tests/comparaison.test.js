// node --test tests/comparaison.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../comparaison.js');
const S = require('../stockage.js');
const L = require('../lecture.js');
const D = require('../drives.js');

const liste = { articles: [
  { id: 'riz', nom: 'Riz long', conditionnements: 1 },
  { id: 'oeufs', nom: 'Œufs', conditionnements: 2 },
  { id: 'tofu', nom: 'Tofu nature', conditionnements: 1 },
  { id: 'feta', nom: 'Feta', conditionnements: 1 }
] };
const releves = {
  auchan: { riz: { prix: 1.5 }, oeufs: { prix: 3.2 }, tofu: { prix: 2.9 } },
  leclerc: { riz: { prix: 1.7 }, oeufs: { prix: 2.9 }, tofu: { prix: 2.5 } }
};

test('chaque article va dans le drive où il est le moins cher', () => {
  const r = C.repartir(liste, releves);
  assert.deepEqual(r.paniers.auchan.articles.map((a) => a.id), ['riz']);
  assert.deepEqual(r.paniers.leclerc.articles.map((a) => a.id).sort(), ['oeufs', 'tofu']);
  assert.equal(r.paniers.leclerc.total, 2.9 * 2 + 2.5);
  assert.deepEqual(r.sansPrix, ['Feta']);
});

test('l’économie compare au meilleur drive unique, frais compris', () => {
  const r = C.repartir(liste, releves, { auchan: 0, leclerc: 0 });
  // tout chez Leclerc : 1.7 + 5.8 + 2.5 = 10 ; réparti : 1.5 + 5.8 + 2.5 = 9.8
  assert.equal(r.comparaison.meilleurSeul.d, 'leclerc');
  assert.equal(r.comparaison.meilleurSeul.total, 10);
  assert.equal(r.comparaison.reparti, 9.8);
  assert.equal(r.comparaison.economie, 0.2);
  const avecFrais = C.repartir(liste, releves, { auchan: 2 });
  assert.ok(avecFrais.comparaison.economie < 0, 'des frais de 2 € annulent une économie de 0,20 €');
});

test('export Budgétable : format reconnu et nettoyé, sinon message clair', () => {
  const d = S.lireExport('BUDGETABLE1:' + JSON.stringify({ date: '2026-10-20', articles: [{ id: 'riz', nom: 'Riz long', recherche: 'riz long', besoin: '150 g', conditionnements: 1, condLabel: 'paquet 1 kg' }, { nom: 'sans id' }] }));
  assert.equal(d.articles.length, 1);
  assert.throws(() => S.lireExport('n’importe quoi'), /Budgétable/);
});

test('reconnaissance des drives par adresse', () => {
  assert.equal(D.driveDeLHote('www.carrefour.fr').id, 'carrefour');
  assert.equal(D.driveDeLHote('fd12-courses.leclercdrive.fr').id, 'leclerc');
  assert.equal(D.driveDeLHote('exemple.com'), null);
});

test('pertinence : les mots de la recherche doivent être dans le nom, du moins cher au plus cher', () => {
  const produits = [
    { titre: 'Lentilles corail bio 1 kg', prix: 4.2, prixUnite: 4.2 },
    { titre: 'Lentilles vertes 500 g', prix: 2.1, prixUnite: null },
    { titre: 'Lentilles corail 500 g', prix: 1.89, prixUnite: 3.78 }
  ];
  const r = L.meilleursPour(produits, 'lentilles corail');
  assert.deepEqual(r.map((p) => p.prix), [1.89, 4.2]);
});

test('pas de velouté (litre) ni de plat préparé à la place de lentilles sèches (kilo)', () => {
  const produits = [
    { titre: 'Velouté Butternut & Lentilles Corail - 75cl', prix: 1.99, prixUnite: 2.65, unite: 'l' },
    { titre: 'Bol lentille corail dès 8 mois - 2x200g', prix: 2.49, prixUnite: 6.23, unite: 'kg' },
    { titre: 'Lentilles corail 500 g', prix: 1.89, prixUnite: 3.78, unite: 'kg' }
  ];
  assert.deepEqual(L.meilleursPour(produits, 'lentilles corail', 'g').map((p) => p.prix), [1.89]);
  assert.equal(L.meilleursPour(produits.slice(0, 2), 'lentilles corail', 'g').length, 0);
});

test('E.Leclerc : adresse de recherche construite depuis le magasin de l’utilisateur', () => {
  const lec = D.DRIVES.find((d) => d.id === 'leclerc');
  const loc = { origin: 'https://fd12-courses.leclercdrive.fr', pathname: '/magasin-046201-046201-loison.aspx' };
  assert.equal(lec.rechercheDepuis(loc, 'riz long'), 'https://fd12-courses.leclercdrive.fr/magasin-046201-046201-loison/recherche.aspx?TexteRecherche=riz%20long');
  assert.equal(lec.rechercheDepuis({ origin: 'https://www.leclercdrive.fr', pathname: '/' }, 'riz'), null);
});
