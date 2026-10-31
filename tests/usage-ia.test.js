'use strict';
// Compteur des demandes à l'IA : chaque appel à Mistral ajoute une ligne (type, modèle, jetons), sans contenu
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.MISTRAL_API_KEY = 'cle-de-test';
test('une question au chat est notée avec les jetons renvoyés par Mistral', async () => {
  const notes = [];
  const vrai = global.fetch;
  global.fetch = async (url, o) => {
    if (String(url).includes('/rest/v1/usage_ia')) { notes.push(JSON.parse(o.body)); return { ok: true, status: 201, json: async () => ({}) }; }
    if (String(url).includes('api.mistral.ai')) return { ok: true, status: 200, json: async () => ({ model: 'mistral-small-2506', choices: [{ message: { content: '{"reponse":"Bonjour"}' } }], usage: { prompt_tokens: 1234, completion_tokens: 56 } }) };
    return vrai(url, o);
  };
  const { serveur } = require('../api/server.js');
  await new Promise((ok) => serveur.listen(0, ok));
  const port = serveur.address().port;
  try {
    const r = await vrai(`http://127.0.0.1:${port}/ia`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Combien coûte l’abonnement ?' }] }) });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { reponse: 'Bonjour' });
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(notes.length, 1);
    assert.deepEqual(notes[0], { usage: 'chat', modele: 'mistral-small-2506', entree: 1234, sortie: 56, pages: 0 });
    assert.ok(!JSON.stringify(notes).includes('abonnement'), 'aucun contenu de la question');
  } finally { serveur.close(); global.fetch = vrai; }
});
