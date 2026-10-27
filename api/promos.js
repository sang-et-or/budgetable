/* Budgétable — promotions alimentaires du moment (lecture automatique).
 *
 * Sources : les pages publiques « offres » de lidl.fr (catégories /c/…) et le texte du prospectus de la semaine d'Aldi
 * (catalogues.aldi.fr, visionneuse iPaper), autorisés par leur robots.txt.
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

/* ---------- Aldi : texte du prospectus de la semaine (visionneuse iPaper, texte de chaque page dans la page) ---------- */
const ALDI = 'https://www.aldi.fr';
const NON_ALIMENTAIRE = /lessive|shampo|gel douche|dentifrice|papier toilette|essuie|nettoyant|adoucissant|désodorisant|chrysanth|plante|fleur|jardin|outil|perceuse|lampe|guirlande|jouet|peluche|pyjama|vêtement|pull|chaussette|veste|coussin|couette|vaisselle|poêle|casserole|batterie|chargeur|compresseur|voiture|pneu|décoration|bougie|seau citrouille|litière|croquettes|pâtée|liqueur|bière|vin |alcool/i;
const STOP = new Set(['PRIX', 'DISCOUNT', 'XXL', 'ORIGINE', 'FRANCE', 'ITALIE', 'ESPAGNE', 'MAROC', 'BELGIQUE', 'AFRIQUE', 'NOUVEAU', 'NOS', 'BONS', 'PLANS', 'SEMAINE', 'CUIT', 'JOUR', 'ÉCONOMISEZ', 'JUSQU’À', 'OFFERT', 'ALDI', 'MEILLEURE', 'QUALITÉ', 'PRODUITS', 'RÉCOMPENSÉS', 'RETROUVEZ', 'ÈME', 'SUR', 'LOT', 'PRODUIT', 'MOINS', 'CHER', 'QU’AILLEURS', 'ÉLABORÉ', 'ÉLABORÉEN', 'EN', 'SAVEURS', 'TOUS', 'JOURS', 'FRAIS', 'LÉGUMES', 'FRUITS', 'ET', 'DES', 'DU', 'SUD', 'LA', 'DE', 'LE', 'À', 'LES', '%', '2', '3']);
const majuscule = (w) => /[A-ZÀ-ÖØ-Ý]/.test(w) && !/[a-zß-öø-ÿ]/.test(w.replace(/[’']/g, ''));
const motNom = (w) => w === '®' || w === '&' || (majuscule(w) && !/[()|]/.test(w)) || /^\d+$/.test(w);
/** Offres alimentaires lues dans le texte des pages du prospectus. */
function offresProspectus(pages, { enseigne = 'Aldi', lien = '', maintenant = Date.now() } = {}) {
  const out = [];
  pages.forEach((texte, n) => {
    const t = String(texte).replace(/\s+/g, ' ');
    // pages alimentaires : elles portent le message « mangerbouger » ou parlent du rayon frais
    if (!/MANGERBOUGER|rayon frais|rayon surgel|fruits et l[ée]gumes|abus d.alcool/i.test(t)) return;
    const dates = /au (?:[a-z]{3,8}\.? )?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i.exec(t);
    let fin = null, debut = null;
    if (dates) { const an = dates[3] ? +dates[3] : new Date(maintenant).getFullYear(); fin = new Date(an, +dates[2] - 1, +dates[1], 23, 59).getTime(); }
    // début de l'offre (« du mer. 29/10 », « à partir du 29/10 ») : une offre de la semaine prochaine n'est pas « en cours »
    const dd = /(?:\bdu|à partir du|a partir du|dès le|des le)\s+(?:[a-z]{3,8}\.?\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i.exec(t);
    if (dd) { const an = dd[3] ? +dd[3] : new Date(maintenant).getFullYear(); debut = new Date(an, +dd[2] - 1, +dd[1], 0, 0).getTime(); if (fin && debut > fin) debut = null; }
    const morceaux = t.split(/Réf\. ?\d+(?: ?\/ ?Réf\. ?\d+)*/);
    for (let i = 1; i < morceaux.length; i++) {
      // nom : la dernière suite de mots en capitales avant « Réf. » (marque ® comprise)
      const mots0 = morceaux[i - 1].replace(/\((?:[A-F]|\d)\)|\bI A \*/g, ' ').replace(/(\S)[*✪]+/g, '$1').replace(/(^|\s)[*✪]+(?=\s|$)/g, ' | ').replace(/\s+/g, ' ').trim().split(' ');
      let k = mots0.length - 1;
      while (k >= 0 && !(majuscule(mots0[k]) && mots0[k].replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 2)) k--;
      if (k < 0) continue;
      let d = k;
      while (d > 0 && motNom(mots0[d - 1])) d--;
      let mots = mots0.slice(d, k + 1);
      const desc = mots0.slice(k + 1).join(' ');
      const r = mots.indexOf('®');
      if (r >= 0) { mots = mots.slice(Math.max(0, r - 3)); while (mots.indexOf('®') > 0 && STOP.has(mots[0]) && !['LE', 'LA', 'LES', 'DE', 'DU', 'DES', 'ET'].includes(mots[0])) mots.shift(); }
      else { mots = mots.slice(-8); while (mots.length > 1 && STOP.has(mots[0])) mots.shift(); }
      if (d > 0 && /^\d+\.$/.test(mots0[d - 1]) && /^\d+$/.test(mots[0])) mots.shift(); // reste d'un prix « 2. 99 »
      while (mots.length > 1 && /^\d+$/.test(mots[0]) && /^\d+$/.test(mots[1])) mots.shift();
      const nomBrut = mots.join(' ').trim();
      if (nomBrut.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 4) continue;
      const apres = morceaux[i].slice(0, 260);
      const px = /(\d{1,3})\. ?(\d{2})\b/.exec(apres);
      if (!px) continue;
      const prix = +(px[1] + '.' + px[2]);
      const avantPrix = apres.slice(0, px.index);
      const suite = apres.slice(px.index + px[0].length, px.index + px[0].length + 110);
      const deuxieme = /-\s?(\d{1,2}) ?% ?SUR ?LE ?2/i.exec(apres);
      const pct = deuxieme ? null : /-\s?(\d{1,2}) ?%/.exec(avantPrix);
      const offert = /(\+\s?\d{1,3} ?% OFFERT|\d+ \+ \d+ OFFERTS?)/i.exec(avantPrix);
      const unite = /(\d+(?:[.,]\d+)?\s?(?:x \d+ ?)?(?:kg|g|cl|ml|L)\b)/;
      const cond = unite.exec(avantPrix.slice(-45)) || unite.exec(suite.slice(0, 40)) || unite.exec(suite);
      const kg = /\((\d+[.,]\d{2}) ?€ ?(?:le|la) ?(kg|L|dose)\)/i.exec(suite) || /\((\d+[.,]\d{2}) ?€ ?le ?(kg|L)\)/i.exec(avantPrix);
      let prixAvant = null;
      if (pct) { const m = /\)\s*(\d{1,3}\.\d{2})\b/.exec(suite); if (m && +m[1] > prix) prixAvant = +m[1]; }
      const remise = pct ? `-${pct[1]} %` : deuxieme ? `-${deuxieme[1]} % sur le 2e` : offert ? offert[1].replace(/\s+/g, ' ').toLowerCase() : /XXL/.test(avantPrix) ? 'Format XXL' : /LOT DE/.test(avantPrix) ? 'Lot' : 'Prix prospectus';
      const lisible = nomBrut.toLowerCase().replace(/ ®/g, '').replace(/(^|[\s'’-])([a-zà-ÿ])/g, (m0, a, b) => a + b.toUpperCase());
      const phrase = desc.split(/\.\s/)[0].replace(/\.$/, '');
      const complement = /^[A-Z]?[a-zàâéèêç]/.test(phrase) && phrase.length <= 70 && !/réf|prix|origine|catégorie|variét|calibre|mg sur|^le |^la |produit de/i.test(phrase) ? ' — ' + phrase : '';
      const nom = (lisible + complement).slice(0, 120);
      if (NON_ALIMENTAIRE.test(nom)) continue;
      if (fin && fin < maintenant - 86400000) continue;
      out.push({ id: `${enseigne.toLowerCase()}-p${n + 1}-${i}`, enseigne, nom, prix, prixAvant, remise, lidlPlus: false, cond: cond ? cond[1].replace(/\s+/g, ' ') : '', prixKg: kg ? `1 ${kg[2]} = ${kg[1].replace('.', ',')}` : '', debut, fin, quand: '', lien: lien || '', image: null, rayon: 'Prospectus', page: n + 1 });
    }
  });
  return out;
}
async function lireUrl(url) {
  const rep = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': AGENT, Accept: 'text/html', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
  if (!rep.ok) throw Object.assign(new Error('HTTP ' + rep.status), { code: 502 });
  const t = await rep.text();
  return t.length > 6e6 ? t.slice(0, 6e6) : t;
}
function textesPages(html) {
  const m = /"pageTexts":(\[[\s\S]*?\])(?=,"|\})/.exec(html);
  if (!m) return [];
  try { return JSON.parse(m[1]).map(String); } catch (e) { return []; }
}
const lienAldi = (page) => (/"link":"(https:\/\/catalogues\.aldi\.fr\/[^"\\]+)/.exec(page) || [])[1];
async function promosAldi() {
  const page = await lireUrl(ALDI + '/catalogues/cette-semaine.html');
  const lien = lienAldi(page);
  if (!lien) return { offres: [], prospectus: [] };
  const html = await lireUrl(lien);
  const pages = textesPages(html);
  const titre = ((/"dates?":"([^"]{4,40})"/.exec(html) || /Du (?:[a-z]+\.? )?\d{1,2}\/\d{1,2} au (?:[a-z]+\.? )?\d{1,2}\/\d{1,2}/i.exec(pages[0] || '') || [])[0] || 'Catalogue de la semaine');
  const prospectus = [{ enseigne: 'Aldi', titre: 'Prospectus de la semaine' + (/^Du /.test(titre) ? ' · ' + titre.replace(/^Du /, 'du ') : ''), lien, integrable: true, pages: pages.length }];
  try { const suivant = lienAldi(await lireUrl(ALDI + '/catalogues/semaine-prochaine.html')); if (suivant && suivant !== lien) prospectus.push({ enseigne: 'Aldi', titre: 'Prospectus de la semaine prochaine', lien: suivant, integrable: true }); } catch (e) { /* pas encore publié */ }
  return { offres: offresProspectus(pages, { enseigne: 'Aldi', lien }), prospectus };
}
/** Catalogues Lidl en ligne (s'ouvrent sur lidl.fr : leur visionneuse ne s'affiche pas dans un autre site). */
async function prospectusLidl() {
  const h = await lire('/c/catalogues-en-ligne/s10017753');
  const vus = new Set(), out = [];
  for (const m of h.matchAll(/href="(?:https:\/\/www\.lidl\.fr)?(\/l\/catalogue-de-la-semaine\/([a-z0-9-]+)\/ar\/0[^"]*)"/g)) {
    if (vus.has(m[2])) continue; vus.add(m[2]);
    const d = /du-(\d{2})-(\d{2})-au-(\d{2})-(\d{2})-(.*)/.exec(m[2]);
    const titre = d ? `${d[5].replace(/-/g, ' ').replace(/^les /, 'Les ')} · du ${d[1]}/${d[2]} au ${d[3]}/${d[4]}` : m[2].replace(/-/g, ' ');
    out.push({ enseigne: 'Lidl', titre: titre.charAt(0).toUpperCase() + titre.slice(1), lien: BASE + decoder(m[1]), integrable: false });
  }
  return out.slice(0, 4);
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
    let aldi = { offres: [], prospectus: [] }, lidlCat = [];
    try { aldi = await promosAldi(); } catch (e) { /* prospectus indisponible */ }
    try { lidlCat = await prospectusLidl(); } catch (e) { /* catalogues indisponibles */ }
    const r = { offres: [...offres.values(), ...aldi.offres], prospectus: [...aldi.prospectus, ...lidlCat], sources: [{ enseigne: 'Lidl', pages: lues, lien: BASE }, { enseigne: 'Aldi', offres: aldi.offres.length, lien: ALDI + '/catalogues.html' }], maj: Date.now() };
    if (r.offres.length || !cache) cache = { t: Date.now(), r };
    return r;
  })();
  try { return await enCours; } finally { enCours = null; }
}

module.exports = { promosDuMoment, grilles, liensOffres, offre, decoder, offresProspectus, textesPages };
