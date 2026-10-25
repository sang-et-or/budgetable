'use strict';
// Préparation de la photo d'un ticket : papier repéré et redressé, texte droit, lignes à la bonne taille.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const IM = require('../js/ticket-image.js');
const TK = require('../js/ticket.js');
function lirePGM(f) { const b = fs.readFileSync(f); const m = /P5\s+(\d+)\s+(\d+)\s+255\s/.exec(b.toString('latin1', 0, 40)); return { w: +m[1], h: +m[2], d: b.subarray(m[0].length) }; }

test('ticket penché sur une table : repéré, remis à plat et à la bonne taille', () => {
  const i = lirePGM(__dirname + '/fixtures/ticket-penche.pgm');
  const t0 = Date.now();
  const r = IM.pretraiter(i.d, i.w, i.h);
  assert.ok(Date.now() - t0 < 8000, 'assez rapide pour un téléphone');
  assert.strictEqual(r.infos.papier, true);
  assert.strictEqual(r.largeur, 1100);
  assert.ok(r.hauteur > 1800 && r.hauteur < 3200, r.hauteur);
  assert.ok(Math.abs(r.infos.angle) <= 1, 'plus d’inclinaison résiduelle : ' + r.infos.angle);
  assert.ok(r.infos.pas > 35 && r.infos.pas < 90, 'pas des lignes ' + r.infos.pas);
  // le bord de la table a disparu : les marges sont blanches
  const col = (x) => { let s = 0; for (let y = 0; y < r.hauteur; y++) s += r.gris[y * r.largeur + x]; return s / r.hauteur; };
  assert.ok(col(2) > 200 && col(r.largeur - 3) > 200);
});

test('image sans papier distinct (gros plan) : simplement mise à l’échelle', () => {
  const w = 600, h = 1200, d = new Uint8ClampedArray(w * h).fill(245);
  for (let y = 100; y < 1100; y += 40) for (let x = 50; x < 550; x++) if ((x >> 3) % 2) for (let k = 0; k < 14; k++) d[(y + k) * w + x] = 30;
  const r = IM.pretraiter(d, w, h);
  assert.strictEqual(r.infos.papier, false);
  assert.strictEqual(r.largeur, 1100);
});

test('chiffres mal lus corrigés par le calcul (quantité, poids, total)', () => {
  const a = TK.analyser(`LIDL
PATES 0,95 A
TOMATES PELEES 400G 8,79 A
POMMES GALA
  4X 2,95   11,88
BANANES
  1,250 kg x 1,60 EUR/kg  2,00
SUCRE 1,25
REMISE IMMEDIATE -6,30
JUS 1,79
REMISE IMMEDIATE 30
BEURRE   239A
3 ARTICLES SOUS - TOTAL 20,37
TOTAL A PAYER   EUR
CB SANS CONTACT
20,37`);
  assert.strictEqual(a.total, 20.37);
  assert.deepStrictEqual(a.lignes.map((l) => l.prix), [0.95, 0.79, 11.8, 2, 0.95, 1.49, 2.39]);
  assert.ok(a.lignes[1].corrige && a.lignes[2].corrige);
});

test('deux prix à 0,xx lus 8,xx : corrigés ensemble quand une seule solution colle au total', () => {
  const a = TK.analyser('LAIT 8,99\nTOMATES PELEES 400G 8,79\nPATES 1,20\nRIZ 2,29\nSOUS-TOTAL 5,27\nTOTAL A PAYER 8,27\nCB 5,27\nTVA 5.5% 4,99 0,28 5,27');
  assert.strictEqual(a.total, 5.27, 'sous-total et paiement concordent');
  assert.deepStrictEqual(a.lignes.map((l) => l.prix), [0.99, 0.79, 1.2, 2.29]);
});
