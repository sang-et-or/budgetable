'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { lireTicketAgent, nettoyer } = require('../api/ticket-agent.js');
const CAT = [{ id: 'pates', nom: 'Pâtes' }, { id: 'lait', nom: 'Lait' }, { id: 'emmental', nom: 'Emmental râpé' }, { id: 'banane', nom: 'Bananes' }];
const rep = (lignes, extra = {}) => JSON.stringify({ enseigne: 'LECLERC', date: '2026-10-24', total: 10.5, remisesGlobales: 0, lignes, ...extra });

test('l’agent relit le ticket quand la somme ne colle pas au total, et garde la lecture juste', async () => {
  const vus = [];
  const reponses = [
    rep([{ libelle: 'COQUIL 500G', nom: 'Coquillettes', id: 'pates', qte: 1, prix: 0.95 }, { libelle: 'LT 1/2 ECR', id: 'lait', qte: 1, prix: 6.55 }]),
    rep([{ libelle: 'COQUIL 500G', nom: 'Coquillettes', id: 'pates', qte: 1, prix: 0.95 }, { libelle: 'LT 1/2 ECR', id: 'lait', qte: 6, prixUnitaire: 0.99, prix: 5.94 }, { libelle: 'EMMENT RAP', id: 'emmental', prix: 2.1 }, { libelle: 'BANANE', id: 'banane', auKilo: true, poidsKg: 0.9, prixUnitaire: 1.68, prix: 1.51 }]),
  ];
  const r = await lireTicketAgent({ image: 'AAAA' }, { ocr: async () => 'TEXTE OCR', chat: async (m, o) => { vus.push({ m: m.map((x) => x.content), o }); return reponses.shift(); }, catalogue: CAT });
  assert.strictEqual(r.essais, 2);
  assert.strictEqual(r.verifie, true);
  assert.strictEqual(r.lignes.length, 4);
  assert.strictEqual(r.texte, 'TEXTE OCR');
  assert.match(vus[0].m[0], /TEXTE OCR/);
  assert.strictEqual(vus[0].o.image, 'AAAA');
  assert.match(vus[1].m[2], /7\.50 €.*10\.50 €/s);   // l'écart est donné au modèle
  assert.strictEqual(r.lignes[1].qte, 6);
});

test('remises par article et remises globales comptent dans le contrôle', async () => {
  const r = await lireTicketAgent({ texte: 'ticket collé…' }, { chat: async () => rep([{ libelle: 'PATES', id: 'pates', prix: 6, remise: 0.5 }, { libelle: 'LAIT', id: 'lait', prix: 6 }], { remisesGlobales: 1 }), catalogue: CAT });
  assert.strictEqual(r.verifie, true);
  assert.strictEqual(r.essais, 1);
  assert.strictEqual(r.lignes[0].prix, 5.5);
});

test('un produit ménager n’est jamais rattaché à un aliment ; un id inconnu est écarté', () => {
  const r = nettoyer({ total: 5, lignes: [{ libelle: 'LESSIVE', id: 'lait', categorie: 'maison', prix: 4 }, { libelle: 'TRUC', id: 'inconnu', prix: 1 }] }, CAT);
  assert.strictEqual(r.lignes[0].id, null);
  assert.strictEqual(r.lignes[1].id, null);
  assert.strictEqual(r.ecart, 0);
});

test('réponse illisible puis bonne réponse ; au plus 3 essais', async () => {
  const reps = ['désolé', rep([{ libelle: 'PATES', prix: 10.5 }])];
  const r = await lireTicketAgent({ image: 'A' }, { chat: async () => reps.shift(), catalogue: CAT });
  assert.strictEqual(r.essais, 2); assert.strictEqual(r.verifie, true);
  let n = 0;
  const r2 = await lireTicketAgent({ image: 'A' }, { chat: async () => { n++; return rep([{ libelle: 'PATES', prix: 3 }]); }, catalogue: CAT });
  assert.strictEqual(n, 3); assert.strictEqual(r2.verifie, false); assert.strictEqual(r2.ecart, -7.5);
});

test('suite d’un long ticket sans total : une seule lecture', async () => {
  let n = 0;
  const r = await lireTicketAgent({ image: 'A', suite: true }, { chat: async () => { n++; return JSON.stringify({ total: null, lignes: [{ libelle: 'PATES', prix: 1 }] }); }, catalogue: CAT });
  assert.strictEqual(n, 1); assert.strictEqual(r.lignes.length, 1);
});

test('PDF de drive : l’OCR est obligatoire', async () => {
  await assert.rejects(lireTicketAgent({ pdf: 'JVBER' }, { ocr: async () => '', chat: async () => '{}', catalogue: CAT }), /PDF/);
  const r = await lireTicketAgent({ pdf: 'JVBER' }, { ocr: async (d) => { assert.strictEqual(d.type, 'document_url'); return 'Pâtes 10,50'; }, chat: async (m, o) => { assert.strictEqual(o.image, null); return rep([{ libelle: 'Pâtes', prix: 10.5 }]); }, catalogue: CAT });
  assert.strictEqual(r.verifie, true);
});
