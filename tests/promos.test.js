// Lecture des promotions Lidl : fiches data-grid-data → offres normalisées
const assert = require('assert');
const { grilles, liensOffres, offre, decoder } = require('../api/promos.js');
const enc = (o) => JSON.stringify(o).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const maintenant = Date.UTC(2026, 9, 22, 12);
const f1 = { category: 'Food', productId: 1, fullTitle: 'L\'ÉTAL DU BOUCHER 4 crépinettes de porc', canonicalPath: '/p/x/p1', image: 'https://www.lidl.fr/assets/a.png',
  price: { price: 2.99, packaging: { text: '500 g' }, discount: { deletedPrice: 3.99, percentageDiscount: 25, showDiscount: true } },
  storeStartDate: maintenant / 1000 - 86400, storeEndDate: maintenant / 1000 + 5 * 86400, keyfacts: { wonCategoryPrimary: 'Mondes/Food/Viande et volaille/Porc' },
  stockAvailability: { badgeInfo: { badges: [{ text: '22.10. - 28.10. | En supermarché' }] } } };
const f2 = { category: 'Food', productId: 2, fullTitle: 'Goulash de porc', canonicalPath: '/p/y/p2', price: {}, lidlPlus: [{ price: { price: 4.25 } }], storeStartDate: maintenant / 1000, storeEndDate: maintenant / 1000 + 86400 };
const f3 = { category: 'Non Food', productId: 3, fullTitle: 'Perceuse', price: { price: 29.99, discount: { deletedPrice: 39.99 } } };
const f4 = { category: 'Food', productId: 4, fullTitle: 'Pâtes', price: { price: 0.89 } }; // prix normal : pas une promo
const f5 = { ...f1, productId: 5, storeEndDate: maintenant / 1000 - 10 }; // terminée
const html = `<a href="/c/offres-flash/a10080780">x</a><a href="https://www.lidl.fr/c/xxl/a10092435">y</a><div data-grid-data="${enc(f1)}"></div><div data-grid-data="${enc(f2)}"></div><div data-grid-data="${enc(f3)}"></div><div data-grid-data="${enc(f4)}"></div><div data-grid-data="${enc(f5)}"></div>`;
assert.deepStrictEqual(liensOffres(html).sort(), ['/c/offres-flash/a10080780', '/c/xxl/a10092435']);
const g = grilles(html); assert.strictEqual(g.length, 5);
const o = g.map((x) => offre(x, maintenant)).filter(Boolean);
assert.strictEqual(o.length, 2, JSON.stringify(o));
assert.strictEqual(o[0].nom, 'L\'ÉTAL DU BOUCHER 4 crépinettes de porc');
assert.strictEqual(o[0].prix, 2.99); assert.strictEqual(o[0].prixAvant, 3.99); assert.strictEqual(o[0].remise, '-25 %');
assert.strictEqual(o[0].lien, 'https://www.lidl.fr/p/x/p1'); assert.strictEqual(o[0].cond, '500 g'); assert.strictEqual(o[0].rayon, 'Viande et volaille · Porc');
assert.strictEqual(o[1].lidlPlus, true); assert.strictEqual(o[1].prix, 4.25);
assert.strictEqual(decoder('a &amp; b &#39;c&#x27;'), "a & b 'c'");
console.log('promos : ok');
