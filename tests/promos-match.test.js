// Rapprochement promotions ↔ liste de courses, et dates des offres (retours de test du 27 octobre)
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const PM = require('../js/promos-match.js');

const r = (nom) => PM.analyser({ nom }, E.ING);

test('un plat qui contient l’ingrédient n’est pas l’ingrédient', () => {
  assert.equal(r('Tarte aux pommes pur beurre'), null);
  assert.equal(r('Cheetos goût fromage'), null);
  assert.equal(r('Roulés au fromage'), null);
  assert.equal(r('Salade de concombres'), null);
  assert.equal(r('Yaourt aux fraises'), null);
  assert.equal(r('Escalope de poulet panée'), null);
  assert.equal(r('Nuggets de poulet'), null);
  assert.equal(r('Pizza jambon fromage'), null);
  assert.equal(r('Soupe de poireaux'), null);
  assert.equal(r('Crème de marrons'), null);
});

test('le même produit est une correspondance exacte, même avec la marque devant', () => {
  assert.deepEqual([r('PRÉSIDENT Beurre doux').id, r('PRÉSIDENT Beurre doux').niveau], ['beurre', 'exact']);
  assert.deepEqual([r('MILBONA Emmental râpé').id, r('MILBONA Emmental râpé').niveau], ['emmental', 'exact']);
  assert.deepEqual([r('Laitue').id, r('Laitue').niveau], ['salade', 'exact']);
  assert.deepEqual([r('Filets de poulet').id, r('Filets de poulet').niveau], ['poulet_filet', 'exact']);
  assert.equal(r('Pommes de terre de consommation').id, 'pomme_de_terre');
});

test('un produit proche est une alternative à vérifier', () => {
  assert.deepEqual([r('Comté râpé').id, r('Comté râpé').niveau], ['emmental', 'alternative']);
  assert.deepEqual([r('Mâche').id, r('Mâche').niveau], ['salade', 'alternative']);
  assert.deepEqual([r('Escalopes de dinde').id, r('Escalopes de dinde').niveau], ['poulet_filet', 'alternative']);
  assert.equal(r('Saumon fumé').niveau, 'alternative');
});

test('dates : en cours, à venir, terminée (test du 27 octobre)', () => {
  const le27 = new Date(2026, 9, 27, 10).getTime();
  assert.equal(PM.statut({ quand: '22.10. - 28.10. | En supermarché' }, le27).etat, 'en_cours');
  assert.equal(PM.statut({ quand: 'En magasin le 15/10' }, le27).etat, 'terminee');
  assert.equal(PM.statut({ quand: 'le 29/10' }, le27).etat, 'a_venir');
  assert.equal(PM.statut({ quand: '20.10. - 26.10.' }, le27).etat, 'terminee');
  assert.equal(PM.statut({ debut: new Date(2026, 9, 15).getTime() }, le27).etat, 'terminee');
  assert.equal(PM.statut({ debut: new Date(2026, 9, 29).getTime(), fin: new Date(2026, 10, 4).getTime() }, le27).etat, 'a_venir');
  assert.equal(PM.statut({ fin: new Date(2026, 9, 27).getTime() }, le27).etat, 'en_cours', 'valable jusqu’au soir');
  assert.equal(PM.statut({}, le27).etat, 'inconnu');
  assert.equal(PM.statut({ quand: '22.10. - 28.10.' }, le27).texte, 'du 22/10 au 28/10');
});

test('allergènes probables d’après le nom du produit', () => {
  assert.deepEqual(PM.allergenesProbables('Pâtes aux œufs'), ['gluten', 'oeuf']);
  assert.ok(PM.allergenesProbables('Beurre doux').includes('lait'));
  assert.deepEqual(PM.allergenesProbables('Lait de coco'), []);
});
