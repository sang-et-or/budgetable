// Lecture des tickets de caisse et récapitulatifs de drive
const test = require('node:test');
const assert = require('node:assert');
const T = require('../js/ticket.js');
const LIDL = `LIDL
Lidl France SNC
12 rue de la Gare 62440 Harnes
                              EUR
COQUILLETTES 500G           0,89 A
LAIT DEMI-ECREME 1L         1,90 A
  2 x 0,95
BANANES                          A
  1,234 kg x 1,49 EUR/kg    1,84
FILETS POULET 450G          4,79 A
REMISE LIDL PLUS           -0,50
LESSIVE LIQUIDE             5,99 B
-----------------------------------
TOTAL                      14,96
CB                         14,96
TVA A 5,5%   0,45
Merci de votre visite  24/10/2026 18:42`;
test('ticket Lidl : enseigne, date, articles, remises, au kilo', () => {
  const r = T.analyser(LIDL);
  assert.equal(r.enseigne.id, 'lidl');
  assert.equal(r.date, '2026-10-24');
  assert.equal(r.total, 14.96);
  const noms = r.lignes.map((l) => l.libelle);
  assert.ok(noms.includes('COQUILLETTES 500G') && noms.includes('BANANES') && noms.includes('FILETS POULET 450G'), noms.join(' | '));
  assert.ok(!noms.some((n) => /TOTAL|TVA|CB|Merci/.test(n)));
  const ban = r.lignes.find((l) => l.libelle === 'BANANES');
  assert.equal(ban.prix, 1.84); assert.equal(ban.poids.q, 1234);
  const poulet = r.lignes.find((l) => /POULET/.test(l.libelle));
  assert.equal(poulet.prix, 4.29); // remise déduite
  const lait = r.lignes.find((l) => /LAIT/.test(l.libelle));
  assert.equal(lait.qte, 2); assert.equal(lait.prixUnitaire, 0.95);
});
test('prix ramené au paquet du catalogue', () => {
  const pates = { unite: 'g', cond: 500 }, banane = { unite: 'g', cond: 1000 }, poulet = { unite: 'g', cond: 500 };
  assert.equal(T.prixPaquet({ libelle: 'COQUILLETTES 500G', prix: 0.89, qte: 1, prixUnitaire: 0.89, poids: { q: 500, unite: 'g' } }, pates), 0.89);
  assert.equal(T.prixPaquet({ libelle: 'BANANES', prix: 1.84, qte: 1, prixUnitaire: 1.49, poids: { q: 1234, unite: 'g' }, auKilo: true }, banane), 1.49);
  assert.equal(T.prixPaquet({ libelle: 'FILETS POULET 450G', prix: 4.29, qte: 1, prixUnitaire: 4.29, poids: { q: 450, unite: 'g' } }, poulet), 4.77);
});
test('récapitulatif de drive collé', () => {
  const r = T.analyser(`Votre commande Carrefour Drive
Riz long grain Carrefour 1kg   1 x 1,49 €   1,49 €
Tomates concassées 400g   3   2,37 €
Emmental râpé 200 g   2,15 €
Sous-total 6,01 €
Frais de préparation 0,00 €`);
  assert.equal(r.enseigne.id, 'carrefour');
  assert.ok(r.lignes.length >= 3, JSON.stringify(r.lignes));
});

test('confusions de lecture corrigées (photo)', () => {
  const r = T.analyser('COQUILLETTES 5O0G   e,89 A\nRIZ LONG 1KG   1,S9\nLAIT 1L  2 x O,95   1,9O\nTOTAL 4,38');
  const noms = r.lignes.map((l) => l.libelle + '=' + l.prix);
  assert.ok(noms.includes('COQUILLETTES 500G=0.89'), noms.join(' | '));
  assert.ok(noms.includes('RIZ LONG 1KG=1.59'), noms.join(' | '));
  assert.equal(r.lignes.find((l) => /LAIT/.test(l.libelle)).prixUnitaire, 0.95);
});

test('codes-barres, « € » mal lu, quantité devant le libellé, colonnes espacées', () => {
  const r = T.analyser(`CARREFOUR MARKET
3017620422003 PATE A TARTINER 400G      2,99 E
2 X YAOURT NATURE X4                     2,40 C
x2 BAGUETTE TRADITION                    2,20
LENTILLES VERTES 500G   1 , 49
TOTAL A PAYER                            9,08`);
  const l = Object.fromEntries(r.lignes.map((x) => [x.libelle, x]));
  assert.ok(l['PATE A TARTINER 400G'] && l['PATE A TARTINER 400G'].prix === 2.99, Object.keys(l).join(' | '));
  assert.ok(l['YAOURT NATURE X4'] && l['YAOURT NATURE X4'].qte === 2 && l['YAOURT NATURE X4'].prixUnitaire === 1.2, JSON.stringify(l['YAOURT NATURE X4']));
  assert.ok(l['BAGUETTE TRADITION'] && l['BAGUETTE TRADITION'].qte === 2);
  assert.ok(l['LENTILLES VERTES 500G'] && l['LENTILLES VERTES 500G'].prix === 1.49, Object.keys(l).join(' | '));
  assert.equal(r.total, 9.08);
});

test('lecture réelle d’une photo (texte rendu par le lecteur)', () => {
  const lu = 'LIDL\nLid! France SNC\n\nCOQUILLETTES 5006        0,59 A\nLAIT DEMT ECRÈME 1L       1,90 À\n2 x 0,95\nBANANES                       A\n1,234 kg x 1,49 EUR/kg 1,84\nOEUFS PLEIN AIR X6        1,99 À\nFILETS POULET 450G       4,79 A\nTOMATES CONCASSEES 460G 0,65 À\nEMMENTAL RAPE 200G        1,89 À\nLESSIVE LIQUIDE          5,99 B\nTOTAL                   19,63\ncB                      19,63\n\n24/10/2026 18:42\n';
  const r = T.analyser(lu);
  assert.equal(r.lignes.length, 8, r.lignes.map((l) => l.libelle + '=' + l.prix).join(' | '));
  const somme = Math.round(r.lignes.reduce((s, l) => s + l.prix, 0) * 100) / 100;
  assert.ok(Math.abs(somme - r.total) < 0.02, somme + ' / ' + r.total);
  assert.ok(r.lignes.find((l) => /COQUILLETTES 500G/.test(l.libelle)));
  const lait = r.lignes.find((l) => /LAIT/.test(l.libelle)); assert.equal(lait.prix, 1.9); assert.equal(lait.qte, 2);
  assert.ok(r.lignes.find((l) => /OEUFS PLEIN AIR X6/.test(l.libelle)));
});
