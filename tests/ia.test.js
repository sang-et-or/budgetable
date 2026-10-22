// Assistant IA du site avec Mistral (service simulé) : la conversation est nettoyée, la réponse JSON renvoyée.
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.MISTRAL_API_KEY = 'cle-de-test';
const vraiFetch = global.fetch;
let envoye = null;
global.fetch = async (url, o) => {
  if (String(url).startsWith('https://api.mistral.ai/')) {
    envoye = JSON.parse(o.body);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"reponse":"Remplacez la crème par du lait et un peu de beurre."}' } }] }) };
  }
  return vraiFetch(url, o);
};
const { serveur } = require('../api/server.js');
test('ia : Mistral, messages alternés, réponse JSON', async () => {
  await new Promise((ok) => serveur.listen(0, ok));
  const port = serveur.address().port;
  const etat = await (await vraiFetch(`http://127.0.0.1:${port}/ia/etat`)).json();
  assert.deepEqual(etat, { disponible: true, vision: true });
  const r = await vraiFetch(`http://127.0.0.1:${port}/ia`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'https://budgetable.onrender.com' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Consignes' }, { role: 'user', content: 'Je n’ai pas de crème' }] }) });
  const j = await r.json();
  const refus = await vraiFetch(`http://127.0.0.1:${port}/ia`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: 'https://pirate.example' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'x' }] }) });
  serveur.close();
  assert.equal(r.status, 200);
  assert.match(j.reponse, /lait/);
  assert.equal(envoye.messages.length, 1, 'deux messages de la personne fusionnés');
  assert.equal(envoye.model, 'mistral-small-latest');
  assert.deepEqual(envoye.response_format, { type: 'json_object' });
  assert.equal(refus.status, 403);
});
