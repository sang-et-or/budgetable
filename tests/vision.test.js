// Reconnaissance par photo : la réponse du modèle est filtrée sur le catalogue (service simulé).
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ANTHROPIC_API_KEY = 'cle-de-test';
const vraiFetch = global.fetch;
let envoye = null;
global.fetch = async (url, o) => {
  if (String(url).startsWith('https://api.anthropic.com/')) {
    envoye = JSON.parse(o.body);
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Voici : {"produits":[{"id":"pates","quantite":600,"confiance":0.9},{"id":"inconnu","quantite":3},{"id":"oeufs","quantite":"x"},{"id":"pates","quantite":1}],"autres":["cornichons"]}' }] }) };
  }
  return vraiFetch(url, o);
};
const { serveur } = require('../api/server.js');

test('vision : produits du catalogue seulement, quantités bornées', async () => {
  await new Promise((ok) => serveur.listen(0, ok));
  const port = serveur.address().port;
  const r = await vraiFetch(`http://127.0.0.1:${port}/vision`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'https://budgetable.onrender.com' }, body: JSON.stringify({ image: 'data:image/jpeg;base64,AAAA' }) });
  const j = await r.json();
  serveur.close();
  assert.equal(r.status, 200);
  assert.deepEqual(j.produits.map((p) => p.id), ['pates', 'oeufs']);
  assert.equal(j.produits[0].quantite, 600);
  assert.equal(j.produits[1].quantite, 12, 'quantité illisible : un paquet');
  assert.deepEqual(j.autres, ['cornichons']);
  assert.equal(envoye.messages[0].content[0].type, 'image');
  assert.ok(envoye.messages[0].content[1].text.includes('pates = Pâtes'));
});
