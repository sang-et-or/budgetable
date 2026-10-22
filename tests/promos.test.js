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
// prospectus Aldi : texte des pages (extrait réel)
const { offresProspectus, textesPages } = require('../api/promos.js');
const pages = ["Du mar. 20/10 au sam. 24/10 DES FRUITS ET LÉGUMES FRAIS TOUS LES JOURS À PRIX DISCOUNT ORANGES À JUS Variété Valencia. Catégorie 1. Calibre 5/6 (70/84 mm). Réf. 5016512 AFRIQUE DU SUD ORIGINE Le filet de 1.5 kg 2. 29 1. 53 Le kg MANDARINES Variété Nadorcott. Catégorie 1. Calibre 54/69 mm. Réf. 5022922 ORIGINE AFRIQUE DU SUD -21% 1. 79 (1) Le filet 750 g (2.39 € le kg) 2.29 Les offres de cette double page sont valables du 20/10/2026 au 24/10/2026. *Source Worldpanel, prix moyen payé au kilo de fruits et de légumes",
  "Du mar. 20/10 au lun. 26/10 I A * ST-CLÉMENT LE VOLAILLER ® GRIGNOT’ DE POULET (A) ** À déguster chaud ou froid. Au choix : nature ou mexicain. Réf. 5001663 / Réf. 5001664 I A * -26% 1. 79 (1) 250 g (7.16 € le kg) 2.45 ÉCONOMISEZ JUSQU’À 50 % SUR LE 2 ÈME PRODUIT I A * ST-CLÉMENT LE VOLAILLER ® FILETS DE POULET (B) Réf. 5003050 I A * XXL 11. 99 1.5 kg 8. 00 Le kg POUR VOTRE SANTÉ, ÉVITEZ DE MANGER TROP GRAS. WWW.MANGERBOUGER.FR",
  "À partir du mer. 21/10 LILY & DAN ® PYJAMA Réf. 5021071 5. 99 L‘ensemble"];
const ofs = offresProspectus(pages, { enseigne: 'Aldi', lien: 'https://catalogues.aldi.fr/x/', maintenant: Date.UTC(2026, 9, 21) });
const noms = ofs.map((o) => o.nom);
assert.ok(noms.includes('Oranges À Jus'), noms);
const mand = ofs.find((o) => o.nom === 'Mandarines'); assert.ok(mand && mand.prix === 1.79 && mand.prixAvant === 2.29 && mand.remise === '-21 %' && mand.cond === '750 g', JSON.stringify(mand));
const grig = ofs.find((o) => /Grignot/.test(o.nom)); assert.ok(grig && grig.prix === 1.79 && grig.remise === '-26 %' && /^St-Clément Le Volailler/.test(grig.nom), JSON.stringify(grig));
const fil = ofs.find((o) => /Filets De Poulet/.test(o.nom)); assert.ok(fil && fil.prix === 11.99 && fil.remise === 'Format XXL' && fil.cond === '1.5 kg', JSON.stringify(fil));
assert.ok(!noms.some((n) => /Pyjama/i.test(n)), 'page non alimentaire gardée');
assert.deepStrictEqual(textesPages('{"a":1,"pageTexts":["p1","p2"],"b":2}'), ['p1', 'p2']);
console.log('prospectus : ok');
