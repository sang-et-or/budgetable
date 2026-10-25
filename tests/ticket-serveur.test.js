// Ticket par l'agent du serveur, Mistral simulé : OCR puis modèle, relance si la somme ne colle pas.
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.MISTRAL_API_KEY = 'cle-de-test';
delete process.env.ANTHROPIC_API_KEY;
const vraiFetch = global.fetch;
const appels = [];
const reponses = [
  { total: 4.2, lignes: [{ libelle: 'COQUIL 500G', nom: 'Coquillettes 500 g', id: 'pates', prix: 0.95 }] },
  { total: 4.2, lignes: [{ libelle: 'COQUIL 500G', nom: 'Coquillettes 500 g', id: 'pates', prix: 0.95 }, { libelle: 'LESSIVE', id: 'pates', categorie: 'maison', prix: 3.25 }] },
];
global.fetch = async (url, o) => {
  url = String(url);
  if (url === 'https://api.mistral.ai/v1/ocr') { appels.push({ url, corps: JSON.parse(o.body) }); return { ok: true, json: async () => ({ pages: [{ markdown: 'COQUIL 500G 0,95\nLESSIVE 3,25\nTOTAL 4,20' }] }) }; }
  if (url === 'https://api.mistral.ai/v1/chat/completions') { appels.push({ url, corps: JSON.parse(o.body) }); return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(reponses.shift()) } }] }) }; }
  return vraiFetch(url, o);
};
const { serveur } = require('../api/server.js');

test('/ticket : OCR, extraction, contrôle du total et relance', async () => {
  await new Promise((ok) => serveur.listen(0, ok));
  const port = serveur.address().port;
  const etat = await (await vraiFetch(`http://127.0.0.1:${port}/ia/etat`)).json();
  const r = await vraiFetch(`http://127.0.0.1:${port}/ticket`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'https://budgetable.onrender.com' }, body: JSON.stringify({ image: 'data:image/jpeg;base64,AAAA' }) });
  const j = await r.json();
  serveur.close();
  assert.equal(etat.ticket, true); assert.equal(etat.pdf, true);
  assert.equal(r.status, 200);
  assert.equal(j.verifie, true);
  assert.equal(j.essais, 2);
  assert.deepEqual(j.lignes.map((l) => l.id), ['pates', null]);
  assert.equal(appels[0].corps.model, 'mistral-ocr-latest');
  const chat = appels[1].corps;
  assert.equal(chat.model, 'mistral-medium-latest');
  assert.equal(chat.temperature, 0);
  assert.equal(chat.messages[0].content[0].type, 'image_url');
  assert.ok(chat.messages[0].content[1].text.includes('TOTAL 4,20'));
  assert.ok(chat.messages[0].content[1].text.includes('parmesan='), 'catalogue élargi fourni');
  assert.equal(appels[2].corps.messages.length, 3);
});
