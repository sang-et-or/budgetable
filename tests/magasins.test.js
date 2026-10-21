// node --test tests/magasins.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/magasins.js');
const osm = require('./osm-harnes.json');
const HARNES = { lat: 50.452605, lon: 2.903981 };

test('données réelles de Harnes : drives triés par distance, stations et petits formats écartés', () => {
  const r = M.drivesProches(osm, HARNES);
  assert.ok(r.length >= 20);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].distanceKm >= r[i - 1].distanceKm);
  assert.ok(!r.some((m) => /station|city|express|contact/i.test(m.nom)), 'formats sans drive présents');
  assert.equal(r[0].enseigne, 'auchan');
  assert.ok(r.every((m) => m.carte.startsWith('https://www.openstreetmap.org/')));
});

test('un hypermarché et son drive voisin ne comptent qu’une fois (le drive est gardé)', () => {
  const leclercLoison = M.drivesProches(osm, HARNES).filter((m) => m.enseigne === 'leclerc' && m.distanceKm < 3.5);
  assert.equal(leclercLoison.length, 1);
  assert.equal(leclercLoison[0].drive, 'confirmé');
});

test('les drives marqués dans OpenStreetMap sont « confirmés », les autres « probables »', () => {
  const r = M.drivesProches(osm, HARNES);
  assert.equal(r.find((m) => m.nom === 'Carrefour Drive').drive, 'confirmé');
  assert.equal(r.find((m) => m.nom === 'Chronodrive.com').enseigne, 'chronodrive');
  assert.equal(r.find((m) => m.ville === 'Harnes').drive, 'probable');
});

test('coût du trajet aller-retour', () => {
  assert.equal(M.coutTrajet(3, 6.5, 1.8), 0.7); // 6 km × 6,5 L/100 × 1,80 €
});

test('recherche complète : adresse puis OpenStreetMap, avec serveur de secours si le premier échoue', async () => {
  const appels = [];
  const fauxFetch = async (url) => {
    appels.push(url);
    if (url.includes('api-adresse')) return { ok: true, json: async () => ({ features: [{ geometry: { coordinates: [2.903981, 50.452605] }, properties: { label: 'Harnes', postcode: '62440' } }] }) };
    if (url.includes('overpass-api.de')) return { ok: false, status: 502 };
    return { ok: true, json: async () => osm };
  };
  const r = await M.chercherDrives('62440', 10, fauxFetch);
  assert.equal(r.centre.nom, 'Harnes');
  assert.ok(r.magasins.length >= 20);
  assert.ok(appels.some((u) => u.includes('kumi')), 'le serveur de secours n’a pas été essayé');
  assert.match(r.sources, /OpenStreetMap/);
});

test('commune introuvable : message clair', async () => {
  const f = async () => ({ ok: true, json: async () => ({ features: [] }) });
  await assert.rejects(M.chercherDrives('zzzz', 10, f), /introuvable/);
});
