/* Budgétable — lecteur de recettes (petit service web sur Render).
 *
 * GET /recette?url=https://…  →  { nom, ingredients: [lignes], portions, temps, image, site }
 * GET /sante                   →  ok
 *
 * Il lit UNE page publique, à la demande de la personne qui a collé le lien, et n'en garde que la
 * fiche recette standard (schema.org). Garde-fous : http(s) seulement, pas d'adresses internes,
 * 3 redirections au plus, 3 Mo au plus, 10 s au plus, 30 lectures par minute et par personne.
 * Aucun journal des liens lus, aucun cookie.
 */
'use strict';
const http = require('http');
const dns = require('dns').promises;
const net = require('net');
const { extraireRecette } = require('./extraire.js');

const PORT = process.env.PORT || 10000;
// reconnaissance des produits sur une photo (placard, frigo) : seulement si une clé d'API est configurée sur Render
const CLE_API = process.env.ANTHROPIC_API_KEY || '';
const MODELE_VISION = process.env.MODELE_VISION || 'claude-haiku-5-5';
const MAX_PHOTOS_JOUR = +(process.env.MAX_PHOTOS_JOUR || 300);
const MAX_PHOTOS_HEURE_IP = +(process.env.MAX_PHOTOS_HEURE_IP || 12);
let CATALOGUE = [];
try { CATALOGUE = require('../js/engine.js').DATA.ingredients.map((i) => ({ id: i.id, nom: i.nom, unite: i.unite, cond: i.cond })); } catch (e) { /* pas de catalogue : la vision sera désactivée */ }
const ORIGINES = (process.env.ORIGINES || 'https://budgetable.onrender.com').split(',').map((s) => s.trim());
const MAX_OCTETS = 3 * 1024 * 1024;
const AGENT = 'Mozilla/5.0 (compatible; BudgetableRecettes/1.0; +https://budgetable.onrender.com)';

function ipInterne(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return ipInterne(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}
async function verifierUrl(brut) {
  let u;
  try { u = new URL(brut); } catch (e) { throw Object.assign(new Error('Lien invalide'), { code: 400 }); }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw Object.assign(new Error('Lien invalide'), { code: 400 });
  if (u.port && !['80', '443'].includes(u.port)) throw Object.assign(new Error('Lien invalide'), { code: 400 });
  const hote = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(hote)) throw Object.assign(new Error('Adresse refusée'), { code: 400 });
  const ips = net.isIP(hote) ? [{ address: hote }] : await dns.lookup(hote, { all: true }).catch(() => { throw Object.assign(new Error('Site introuvable'), { code: 404 }); });
  if (!ips.length || ips.some((x) => ipInterne(x.address))) throw Object.assign(new Error('Adresse refusée'), { code: 400 });
  return u;
}
// photo d'une recette : 5 Mo au plus, images seulement (le site la réduit ensuite à 480 px)
async function lireImage(brut) {
  let u = await verifierUrl(brut);
  for (let saut = 0; saut < 4; saut++) {
    const rep = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': AGENT, Accept: 'image/avif,image/webp,image/jpeg,image/png,image/*' } });
    if (rep.status >= 300 && rep.status < 400 && rep.headers.get('location')) { u = await verifierUrl(new URL(rep.headers.get('location'), u).href); continue; }
    if (!rep.ok) throw Object.assign(new Error(`Le site a répondu ${rep.status}`), { code: 502 });
    const type = (rep.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp|avif|gif)$/i.test(type)) throw Object.assign(new Error('Ce lien n’est pas une photo'), { code: 422 });
    const lecteur = rep.body.getReader();
    const morceaux = []; let total = 0;
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.length;
      if (total > 5 * 1024 * 1024) { lecteur.cancel(); throw Object.assign(new Error('Photo trop lourde'), { code: 413 }); }
      morceaux.push(value);
    }
    return { octets: Buffer.concat(morceaux), type };
  }
  throw Object.assign(new Error('Trop de redirections'), { code: 502 });
}
async function lirePage(brut) {
  let u = await verifierUrl(brut);
  for (let saut = 0; saut < 4; saut++) {
    const rep = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': AGENT, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
    if (rep.status >= 300 && rep.status < 400 && rep.headers.get('location')) {
      u = await verifierUrl(new URL(rep.headers.get('location'), u).href);
      continue;
    }
    if (!rep.ok) throw Object.assign(new Error(`Le site a répondu ${rep.status}`), { code: 502 });
    const type = rep.headers.get('content-type') || '';
    if (!/html|xml/i.test(type)) throw Object.assign(new Error('Ce lien n’est pas une page web'), { code: 422 });
    const lecteur = rep.body.getReader();
    const morceaux = []; let total = 0;
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.length;
      if (total > MAX_OCTETS) { lecteur.cancel(); break; }
      morceaux.push(value);
    }
    return { html: Buffer.concat(morceaux).toString('utf8'), url: u };
  }
  throw Object.assign(new Error('Trop de redirections'), { code: 502 });
}

// petite mémoire (1 h) et limite de débit par adresse
const photosIP = new Map();
let photosJour = { jour: '', n: 0 };
function quotaPhotos(ip) {
  const j = new Date().toISOString().slice(0, 10);
  if (photosJour.jour !== j) photosJour = { jour: j, n: 0 };
  if (photosJour.n >= MAX_PHOTOS_JOUR) return 'Trop de photos aujourd’hui sur Budgétable, réessayez demain';
  const t = Date.now();
  const l = (photosIP.get(ip) || []).filter((x) => t - x < 3600000);
  if (l.length >= MAX_PHOTOS_HEURE_IP) return 'Trop de photos cette heure-ci, réessayez un peu plus tard';
  l.push(t); photosIP.set(ip, l); photosJour.n++;
  if (photosIP.size > 5000) photosIP.clear();
  return null;
}
function lireCorps(req, max) {
  return new Promise((ok, ko) => {
    const morceaux = []; let total = 0;
    req.on('data', (c) => { total += c.length; if (total > max) { ko(Object.assign(new Error('Photo trop lourde'), { code: 413 })); req.destroy(); } else morceaux.push(c); });
    req.on('end', () => ok(Buffer.concat(morceaux).toString('utf8')));
    req.on('error', ko);
  });
}
async function reconnaitre(base64) {
  const liste = CATALOGUE.map((i) => `${i.id} = ${i.nom} (${i.unite === 'pièce' ? 'pièces' : i.unite}, paquet ${i.cond})`).join('\n');
  const consigne = `Tu aides une famille à faire l'inventaire de sa cuisine. Voici une photo (placard, frigo, congélateur, plan de travail ou un seul produit).
Liste les aliments que tu VOIS vraiment, en les rattachant au catalogue ci-dessous quand c'est le même aliment (sinon mets-les dans "autres").
Estime la quantité restante dans l'unité du catalogue (g, ml ou pièces) : un paquet plein = la taille du paquet, entamé = moins.
Ne devine pas ce qui est caché. Réponds UNIQUEMENT en JSON, sans texte autour :
{"produits":[{"id":"<id du catalogue>","quantite":<nombre>,"confiance":<0 à 1>}],"autres":["<aliment hors catalogue>"]}
Catalogue :
${liste}`;
  const rep = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(45000),
    headers: { 'content-type': 'application/json', 'x-api-key': CLE_API, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELE_VISION, max_tokens: 1200, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } }, { type: 'text', text: consigne }] }] })
  });
  if (!rep.ok) throw Object.assign(new Error('Le service de reconnaissance ne répond pas'), { code: 502 });
  const j = await rep.json();
  const texte = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  const m = /\{[\s\S]*\}/.exec(texte);
  if (!m) return { produits: [], autres: [] };
  let o; try { o = JSON.parse(m[0]); } catch (e) { return { produits: [], autres: [] }; }
  const ids = new Map(CATALOGUE.map((i) => [i.id, i]));
  const vus = new Set();
  const produits = (Array.isArray(o.produits) ? o.produits : []).filter((x) => x && ids.has(x.id) && !vus.has(x.id) && vus.add(x.id)).map((x) => {
    const i = ids.get(x.id);
    let q = Number(x.quantite); if (!(q > 0)) q = i.cond; q = Math.min(q, i.cond * 12);
    return { id: x.id, quantite: Math.round(q * 100) / 100, confiance: Math.max(0, Math.min(1, Number(x.confiance) || 0.5)) };
  }).slice(0, 40);
  const autres = (Array.isArray(o.autres) ? o.autres : []).map((x) => String(x).slice(0, 40)).filter(Boolean).slice(0, 15);
  return { produits, autres };
}
const memoire = new Map();
const debit = new Map();
function tropDeDemandes(ip) {
  const t = Date.now();
  const l = (debit.get(ip) || []).filter((x) => t - x < 60000);
  l.push(t); debit.set(ip, l);
  if (debit.size > 5000) debit.clear();
  return l.length > 30;
}

function repondre(res, code, corps, origine) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  if (origine && (ORIGINES.includes(origine) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine))) h['Access-Control-Allow-Origin'] = origine;
  res.writeHead(code, h);
  res.end(JSON.stringify(corps));
}

const serveur = http.createServer(async (req, res) => {
  const origine = req.headers.origin;
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': ORIGINES.includes(origine) ? origine : ORIGINES[0], 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }); return res.end(); }
  if (u.pathname === '/vision') {
    if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST seulement' }, origine);
    if (!CLE_API || !CATALOGUE.length) return repondre(res, 503, { erreur: 'non_configure' }, origine);
    if (origine && !ORIGINES.includes(origine) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) return repondre(res, 403, { erreur: 'Origine refusée' }, origine);
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    try {
      const corps = await lireCorps(req, 2.5 * 1024 * 1024);
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(JSON.parse(corps).image || '');
      if (!m) return repondre(res, 400, { erreur: 'Photo illisible' }, origine);
      const refus = quotaPhotos(ip);
      if (refus) return repondre(res, 429, { erreur: refus }, origine);
      return repondre(res, 200, await reconnaitre(m[1]), origine);
    } catch (e) {
      const code = Number.isInteger(e.code) ? e.code : (e.name === 'TimeoutError' ? 504 : 502);
      return repondre(res, code, { erreur: e.code ? e.message : 'Reconnaissance impossible pour le moment' }, origine);
    }
  }
  if (u.pathname === '/sante' || u.pathname === '/') return repondre(res, 200, { ok: true }, origine);
  if (u.pathname === '/image' && req.method === 'GET') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (tropDeDemandes(ip)) return repondre(res, 429, { erreur: 'Trop de demandes' }, origine);
    try {
      const { octets, type } = await lireImage(u.searchParams.get('url') || '');
      const h = { 'Content-Type': type, 'Content-Length': octets.length, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", Vary: 'Origin' };
      if (origine && (ORIGINES.includes(origine) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine))) h['Access-Control-Allow-Origin'] = origine;
      res.writeHead(200, h); return res.end(octets);
    } catch (e) {
      const code = Number.isInteger(e.code) ? e.code : 502;
      return repondre(res, code, { erreur: e.code ? e.message : 'Photo introuvable' }, origine);
    }
  }
  if (u.pathname !== '/recette' || req.method !== 'GET') return repondre(res, 404, { erreur: 'Introuvable' }, origine);
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (tropDeDemandes(ip)) return repondre(res, 429, { erreur: 'Trop de demandes, réessayez dans une minute' }, origine);
  const lien = u.searchParams.get('url') || '';
  if (lien.length > 2000) return repondre(res, 400, { erreur: 'Lien trop long' }, origine);
  const deja = memoire.get(lien);
  if (deja && Date.now() - deja.t < 3600000) return repondre(res, 200, deja.r, origine);
  try {
    const { html, url } = await lirePage(lien);
    const r = extraireRecette(html);
    if (!r) return repondre(res, 422, { erreur: 'Pas de fiche recette lisible sur cette page' }, origine);
    r.site = url.hostname.replace(/^www\./, '');
    memoire.set(lien, { t: Date.now(), r });
    if (memoire.size > 300) memoire.delete(memoire.keys().next().value);
    repondre(res, 200, r, origine);
  } catch (e) {
    const code = e.code && Number.isInteger(e.code) ? e.code : (e.name === 'TimeoutError' ? 504 : 502);
    repondre(res, code, { erreur: code === 504 ? 'Le site met trop de temps à répondre' : (e.code ? e.message : 'Impossible de lire cette page') }, origine);
  }
});
if (require.main === module) serveur.listen(PORT, () => console.log('Lecteur de recettes prêt sur le port', PORT));
module.exports = { serveur, ipInterne, verifierUrl };
