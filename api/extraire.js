/* Budgétable — extraction d'une recette dans une page web.
 * Les sites de recettes publient leurs recettes au format standard schema.org « Recipe »
 * (JSON-LD), le même que lisent les moteurs de recherche. On ne lit que ça : nom, ingrédients,
 * nombre de parts, temps, photo. Repli : balises microdata itemprop="recipeIngredient".
 */
'use strict';

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', icirc: 'î', iuml: 'ï', ucirc: 'û', ugrave: 'ù', oelig: 'œ', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', rsquo: '’', lsquo: '‘', hellip: '…', laquo: '«', raquo: '»' };
function decoder(t) {
  return String(t || '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&([a-z0-9]+);/gi, (m, n) => (ENTITES[n.toLowerCase()] != null ? ENTITES[n.toLowerCase()] : m));
}
const propre = (t) => decoder(String(t || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function estRecette(o) {
  const t = o && o['@type'];
  return Array.isArray(t) ? t.some((x) => /recipe/i.test(x)) : /recipe/i.test(String(t || ''));
}
function trouverRecette(o, prof = 0) {
  if (!o || typeof o !== 'object' || prof > 6) return null;
  if (Array.isArray(o)) { for (const x of o) { const r = trouverRecette(x, prof + 1); if (r) return r; } return null; }
  if (estRecette(o)) return o;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    if (o[k]) { const r = trouverRecette(o[k], prof + 1); if (r) return r; }
  }
  return null;
}
function minutes(iso) {
  if (typeof iso === 'number') return iso;
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(iso || ''));
  if (!m) return null;
  const v = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return v > 0 ? v : null;
}
function parts(y) {
  const v = Array.isArray(y) ? y : [y];
  for (const x of v) {
    const n = parseInt(String(x == null ? '' : x).replace(/[^\d]+/g, ' ').trim().split(' ')[0], 10);
    if (n > 0 && n < 100) return n;
  }
  return null;
}
function image(i) {
  if (!i) return null;
  if (typeof i === 'string') return i;
  if (Array.isArray(i)) return image(i[0]);
  return i.url || i.contentUrl || null;
}
function texteIngredient(x) {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object') return x.text || x.name || [x.amount, x.unitText, x.ingredient].filter(Boolean).join(' ');
  return '';
}

/** html → { nom, ingredients: [lignes], portions, temps, image } ou null si aucune recette lisible */
function extraireRecette(html) {
  const blocs = [...String(html).matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const b of blocs) {
    let o;
    try { o = JSON.parse(b.trim()); } catch (e) {
      try { o = JSON.parse(b.trim().replace(/[\u0000-\u001f]+/g, ' ')); } catch (e2) { continue; }
    }
    const r = trouverRecette(o);
    if (!r) continue;
    const ing = [].concat(r.recipeIngredient || r.ingredients || []).map(texteIngredient).map(propre).filter((l) => l && l.length < 200);
    if (!ing.length) continue;
    return {
      nom: propre(r.name || r.headline || '').slice(0, 90),
      ingredients: ing.slice(0, 60),
      portions: parts(r.recipeYield),
      temps: minutes(r.totalTime) || ((minutes(r.prepTime) || 0) + (minutes(r.cookTime) || 0)) || null,
      image: image(r.image)
    };
  }
  // repli microdata
  const micro = [...String(html).matchAll(/<([a-z0-9]+)[^>]*itemprop=["'](?:recipeIngredient|ingredients)["'][^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => propre(m[2])).filter(Boolean);
  if (micro.length) {
    const titre = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    return { nom: titre ? propre(titre[1]).slice(0, 90) : '', ingredients: micro.slice(0, 60), portions: null, temps: null, image: null };
  }
  return null;
}

module.exports = { extraireRecette, decoder, minutes, parts };
