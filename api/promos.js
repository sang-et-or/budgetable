/* Budgétable — promotions alimentaires du moment (lecture automatique).
 *
 * Source : les pages publiques « offres » de lidl.fr (catégories /c/…), autorisées par son robots.txt.
 * Les offres y sont décrites dans les attributs data-grid-data de chaque fiche produit.
 * Lecture polie : une page à la fois, 30 pages au plus, au plus une fois toutes les 6 heures pour tout le site.
 * Les autres enseignes (Carrefour, Auchan, E.Leclerc, Intermarché, U, Aldi) bloquent la lecture automatique
 * ou l'interdisent dans leur robots.txt : elles ne sont pas lues.
 */
'use strict';
const AGENT = 'Mozilla/5.0 (compatible; BudgetablePromos/1.0; +https://budgetable.onrender.com)';
const BASE = 'https://www.lidl.fr';
const DEPARTS = ['/', '/c/manger-boire/s10068374', '/c/bons-plans-lidl/s10076293'];
const DUREE = 6 * 3600 * 1000;
const MAX_PAGES = 30;

const ENTITES = { quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function decoder(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITES[e.toLowerCase()] != null ? ENTITES[e.toLowerCase()] : m;
  });
}
/** Fiches produit d'une page lidl.fr (attributs data-grid-data). */
function grilles(html) {
  const out = [];
  const rx = /data-grid-data="([^"]+)"/g;
  let m;
  while ((m = rx.exec(html))) { try { out.push(JSON.parse(decoder(m[1]))); } catch (e) { /* fiche illisible */ } }
  return out;
}
/** Pages d'offres liées depuis une page (identifiants « a… »). */
function liensOffres(html) {
  const s = new Set();
  const rx = /(?:https:\/\/www\.lidl\.fr)?(\/c\/[a-z0-9-]+\/a\d+)/g;
  let m;
  while ((m = rx.exec(html))) s.add(m[1]);
  return [...s];
}
const nombre = (x) => (typeof x === 'number' && isFinite(x) ? Math.round(x * 100) / 100 : null);
/** Une fiche Lidl → offre normalisée, ou null si ce n'est pas une offre alimentaire en cours ou à venir. */
function offre(d, maintenant = Date.now()) {
  if (!d || d.category !== 'Food') return null;
  const p = d.price || {};
  const lp = Array.isArray(d.lidlPlus) && d.lidlPlus[0] && d.lidlPlus[0].price ? d.lidlPlus[0].price : null;
  const reg = d.regionsPrices && Object.values(d.regionsPrices)[0];
  const dsc = (p.discount && p.discount.showDiscount !== undefined ? p.discount : null) || (reg && reg.currentPrice && reg.currentPrice.discount) || {};
  const prix = nombre(p.price) != null ? nombre(p.price) : lp ? nombre(lp.price) : null;
  if (prix == null) return null;
  const prixAvant = nombre(dsc.deletedPrice);
  const remise = String(dsc.discountText || (dsc.percentageDiscount ? `-${dsc.percentageDiscount} %` : '') || '').trim();
  const debut = d.storeStartDate ? d.storeStartDate * 1000 : null;
  const fin = d.storeEndDate ? d.storeEndDate * 1000 : null;
  if (fin && fin < maintenant) return null;
  if (debut && debut > maintenant + 8 * 86400000) return null;
  if (!prixAvant && !remise && !lp) return null; // pas une promotion
  const badge = d.stockAvailability && d.stockAvailability.badgeInfo && d.stockAvailability.badgeInfo.badges && d.stockAvailability.badgeInfo.badges[0];
  const rayon = String((d.keyfacts && d.keyfacts.wonCategoryPrimary) || '').split('/').filter(Boolean).slice(-2).join(' · ');
  return {
    id: 'lidl-' + (d.productId || d.itemId || d.erpNumber),
    enseigne: 'Lidl',
    nom: String(d.fullTitle || d.title || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    prix, prixAvant, remise: remise.slice(0, 40),
    lidlPlus: !nombre(p.price) && !!lp,
    cond: String((p.packaging && p.packaging.text) || (lp && lp.packaging && lp.packaging.text) || '').slice(0, 40),
    prixKg: String((p.basePrice && p.basePrice.text) || (lp && lp.basePrice && lp.basePrice.text) || '').slice(0, 40),
    debut, fin, quand: badge ? String(badge.text || '').slice(0, 60) : '',
    lien: d.canonicalPath ? BASE + d.canonicalPath : BASE,
    image: typeof d.image === 'string' && d.image.startsWith('https://www.lidl.fr/') ? d.image : null,
    rayon
  };
}

async function lire(chemin) {
  const rep = await fetch(BASE + chemin, { redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': AGENT, Accept: 'text/html', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
  if (!rep.ok) throw Object.assign(new Error('Lidl ' + rep.status), { code: 502 });
  const t = await rep.text();
  return t.length > 4e6 ? t.slice(0, 4e6) : t;
}
async function autorise() {
  try {
    const t = await (await fetch(BASE + '/robots.txt', { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': AGENT } })).text();
    const blocs = t.split(/\n(?=user-agent:)/i).filter((b) => /user-agent:\s*\*/i.test(b));
    return !blocs.some((b) => /^\s*disallow:\s*\/c\/?\s*$/im.test(b) || /^\s*disallow:\s*\/\s*$/im.test(b));
  } catch (e) { return true; }
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

let cache = null, enCours = null;
/** Toutes les offres alimentaires du moment (mémoire de 6 h). */
async function promosDuMoment() {
  if (cache && Date.now() - cache.t < DUREE) return cache.r;
  if (enCours) return enCours;
  enCours = (async () => {
    if (!(await autorise())) return { offres: [], sources: [], erreur: 'Lecture non autorisée par le site' };
    const pages = new Set();
    for (const d of DEPARTS) { try { liensOffres(await lire(d)).forEach((l) => pages.add(l)); } catch (e) { /* page de départ indisponible */ } await pause(300); }
    const offres = new Map();
    let lues = 0;
    for (const chemin of [...pages].slice(0, MAX_PAGES)) {
      try { for (const g of grilles(await lire(chemin))) { const o = offre(g); if (o && !offres.has(o.id)) offres.set(o.id, o); } lues++; } catch (e) { /* page suivante */ }
      await pause(250);
    }
    const r = { offres: [...offres.values()], sources: [{ enseigne: 'Lidl', pages: lues, lien: BASE }], maj: Date.now() };
    if (r.offres.length || !cache) cache = { t: Date.now(), r };
    return r;
  })();
  try { return await enCours; } finally { enCours = null; }
}

module.exports = { promosDuMoment, grilles, liensOffres, offre, decoder };
