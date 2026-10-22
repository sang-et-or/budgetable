const test = require('node:test');
const assert = require('node:assert/strict');
const { extraireRecette, minutes } = require('../api/extraire.js');
const { ipInterne } = require('../api/server.js');

test('lit la fiche recette JSON-LD (@graph, entités HTML)', () => {
  const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":["Recipe"],"name":"Quiche lorraine","recipeYield":"6 personnes","totalTime":"PT1H5M","recipeIngredient":["200 g de lardons","3 &oelig;ufs","20 cl de cr&egrave;me fra&icirc;che","1 p&acirc;te bris&eacute;e"],"image":["https://x/y.jpg"]}]}</script></head></html>`;
  const r = extraireRecette(html);
  assert.equal(r.nom, 'Quiche lorraine');
  assert.equal(r.portions, 6);
  assert.equal(r.temps, 65);
  assert.deepEqual(r.ingredients, ['200 g de lardons', '3 œufs', '20 cl de crème fraîche', '1 pâte brisée']);
});
test('repli microdata', () => {
  const r = extraireRecette('<h1>Soupe</h1><li itemprop="recipeIngredient">2 <b>poireaux</b></li><li itemprop="recipeIngredient">1 l d’eau</li>');
  assert.deepEqual(r.ingredients, ['2 poireaux', '1 l d’eau']);
});
test('pas de recette → null', () => assert.equal(extraireRecette('<p>rien</p>'), null));
test('durées', () => { assert.equal(minutes('PT45M'), 45); assert.equal(minutes('PT1H'), 60); });
test('adresses internes refusées', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '169.254.169.254', '172.20.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1']) assert.ok(ipInterne(ip), ip);
  for (const ip of ['151.101.1.1', '2a00:1450::1']) assert.ok(!ipInterne(ip), ip);
});
