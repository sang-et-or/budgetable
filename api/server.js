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
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': ORIGINES.includes(origine) ? origine : ORIGINES[0], 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' }); return res.end(); }
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
