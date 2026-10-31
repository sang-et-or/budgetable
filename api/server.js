/* Budgétable — lecteur de recettes (petit service web sur Render).
 *
 * GET /recette?url=https://…  →  { nom, ingredients: [lignes], portions, temps, image, site }
 * POST /parrainage/moi, /parrainage/valider  →  code de parrainage, validation (un mois offert à chacune)
 * GET /promos                  →  { offres: [...], sources, maj } (promotions alimentaires du moment, voir promos.js)
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
const { promosDuMoment } = require('./promos.js');
const { lireTicketAgent } = require('./ticket-agent.js');
const Abonnement = require('./abonnement.js');
const Parrainage = require('./parrainage.js');

const PORT = process.env.PORT || 10000;
// intelligence artificielle de Budgétable (commis de cuisine, goûts, photo du placard) : hébergée ici,
// avec la clé d'API du site. Les visiteurs n'ont besoin d'aucun compte. Fournisseur au choix :
// Mistral AI (français, serveurs en Europe) avec MISTRAL_API_KEY, ou Anthropic avec ANTHROPIC_API_KEY.
const FOURNISSEUR = process.env.MISTRAL_API_KEY ? 'mistral' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : '';
const CLE_API = process.env.MISTRAL_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const MODELE_TEXTE = process.env.MODELE_TEXTE || (FOURNISSEUR === 'mistral' ? 'mistral-small-latest' : 'claude-haiku-5-5');
const MODELE_VISION = process.env.MODELE_VISION || (FOURNISSEUR === 'mistral' ? 'mistral-small-latest' : 'claude-haiku-5-5');
// tickets : un modèle plus fort que pour la conversation (lecture fine des chiffres), et l'OCR de documents de Mistral
const MODELE_TICKET = process.env.MODELE_TICKET || (FOURNISSEUR === 'mistral' ? 'mistral-medium-latest' : 'claude-sonnet-5-5');
const MODELE_OCR = process.env.MODELE_OCR || 'mistral-ocr-latest';
const MAX_IA_JOUR = +(process.env.MAX_IA_JOUR || 2000);
const MAX_IA_HEURE_IP = +(process.env.MAX_IA_HEURE_IP || 60);
const MAX_PHOTOS_JOUR = +(process.env.MAX_PHOTOS_JOUR || 300);
const MAX_PHOTOS_HEURE_IP = +(process.env.MAX_PHOTOS_HEURE_IP || 12);
let CATALOGUE = [];
try { CATALOGUE = require('../js/engine.js').DATA.ingredients.map((i) => ({ id: i.id, nom: i.nom, unite: i.unite, cond: i.cond })); } catch (e) { /* pas de catalogue : la vision sera désactivée */ }
let CATALOGUE_TICKET = CATALOGUE.slice();
try { require('../js/catalogue.js'); const vus = new Set(CATALOGUE.map((i) => i.id)); CATALOGUE_TICKET = CATALOGUE.concat((globalThis.CatalogueExtra.INGREDIENTS || []).filter((i) => !vus.has(i.id)).map((i) => ({ id: i.id, nom: i.nom }))); } catch (e) { /* catalogue de base seulement */ }
// adresses du site toujours autorisées, plus celles de la variable ORIGINES (Render)
const ORIGINES = [...new Set(['https://budgetable.fr', 'https://www.budgetable.fr', 'https://budgetable.onrender.com', ...String(process.env.ORIGINES || '').split(',').map((s) => s.trim()).filter(Boolean)])];
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
const iaIP = new Map();
let iaJour = { jour: '', n: 0 };
function quotaIA(ip) {
  const j = new Date().toISOString().slice(0, 10);
  if (iaJour.jour !== j) iaJour = { jour: j, n: 0 };
  if (iaJour.n >= MAX_IA_JOUR) return 'L’assistant a beaucoup travaillé aujourd’hui : réessayez demain';
  const t = Date.now();
  const l = (iaIP.get(ip) || []).filter((x) => t - x < 3600000);
  if (l.length >= MAX_IA_HEURE_IP) return 'Beaucoup de questions cette heure-ci : réessayez un peu plus tard';
  l.push(t); iaIP.set(ip, l); iaJour.n++;
  if (iaIP.size > 5000) iaIP.clear();
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
// un appel au modèle : messages [{ role, content }], image facultative (base64 JPEG) → texte de la réponse
/* ---------- compteur des demandes à l'IA (pour comparer avec la facture Mistral) ----------
 * Une ligne par appel au modèle : type (chat, photo, ticket, ocr), modèle, jetons d'entrée et de sortie, pages (OCR).
 * Aucune donnée personnelle (ni question, ni réponse, ni adresse IP). Table « usage_ia » : voir supabase/usage_ia.sql. */
const SUPA_URL = (process.env.SUPABASE_URL || 'https://wrcxlvdyegfjawmwtozk.supabase.co').replace(/\/+$/, '');
const SUPA_CLE = process.env.SUPABASE_ANON_KEY || 'sb_publishable_86qxUeodYl3N0Ey3jhFwfg_l3lnzvqW';
function noterUsage(usage, modele, entree = 0, sortie = 0, pages = 0) {
  if (process.env.SANS_COMPTEUR_IA) return;
  try {
    fetch(SUPA_URL + '/rest/v1/usage_ia', { method: 'POST', signal: AbortSignal.timeout(8000), headers: { apikey: SUPA_CLE, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ usage, modele: String(modele || '').slice(0, 60), entree: Math.max(0, entree | 0), sortie: Math.max(0, sortie | 0), pages: Math.max(0, pages | 0) }) }).catch(() => {});
  } catch (e) { /* le compteur ne doit jamais gêner l'assistant */ }
}
async function appelerModele(messages, { image = null, modele = MODELE_TEXTE, max = 800, json = true, temperature = 0.4, imageEnTete = false, delai = 45000, usage = 'chat' } = {}) {
  let url, entetes, corps;
  const avecImage = (k) => image && k === (imageEnTete ? 0 : messages.length - 1);
  if (FOURNISSEUR === 'mistral') {
    const msgs = messages.map((m, k) => avecImage(k)
      ? { role: m.role, content: [{ type: 'image_url', image_url: 'data:image/jpeg;base64,' + image }, { type: 'text', text: m.content }] }
      : { role: m.role, content: m.content });
    url = 'https://api.mistral.ai/v1/chat/completions';
    entetes = { 'content-type': 'application/json', authorization: 'Bearer ' + CLE_API };
    corps = { model: modele, max_tokens: max, temperature, messages: msgs, ...(json ? { response_format: { type: 'json_object' } } : {}) };
  } else {
    const msgs = messages.map((m, k) => avecImage(k)
      ? { role: m.role, content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }, { type: 'text', text: m.content }] }
      : { role: m.role, content: m.content });
    url = 'https://api.anthropic.com/v1/messages';
    entetes = { 'content-type': 'application/json', 'x-api-key': CLE_API, 'anthropic-version': '2023-06-01' };
    corps = { model: modele, max_tokens: max, temperature, messages: msgs };
  }
  const rep = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(delai), headers: entetes, body: JSON.stringify(corps) });
  if (rep.status === 429) throw Object.assign(new Error('L’assistant est très sollicité : réessayez dans quelques minutes'), { code: 429 });
  if (!rep.ok) throw Object.assign(new Error('L’assistant ne répond pas pour le moment'), { code: 502 });
  const j = await rep.json();
  const u = j.usage || {};
  noterUsage(usage, j.model || modele, u.prompt_tokens != null ? u.prompt_tokens : u.input_tokens, u.completion_tokens != null ? u.completion_tokens : u.output_tokens);
  return FOURNISSEUR === 'mistral' ? String(((j.choices || [])[0] || {}).message?.content || '') : (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
}
const extraireJSON = (texte) => { const m = /\{[\s\S]*\}/.exec(texte || ''); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { return null; } };
// conversations : les deux rôles alternent, en commençant par la personne (exigence des fournisseurs)
function nettoyerMessages(liste) {
  const res = [];
  for (const m of (Array.isArray(liste) ? liste : []).slice(-12)) {
    const role = m && m.role === 'assistant' ? 'assistant' : 'user';
    const content = String((m && m.content) || '').slice(0, 6000);
    if (!content) continue;
    if (res.length && res[res.length - 1].role === role) res[res.length - 1].content += '\n\n' + content;
    else res.push({ role, content });
  }
  while (res.length && res[0].role !== 'user') res.shift();
  return res.reduce((t, m) => t + m.content.length, 0) > 24000 ? null : res;
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
  const o = extraireJSON(await appelerModele([{ role: 'user', content: consigne }], { image: base64, modele: MODELE_VISION, max: 1200, usage: 'photo' }));
  if (!o) return { produits: [], autres: [] };
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
/** OCR de documents (Mistral) : photo ou PDF → texte (markdown). */
async function ocrMistral(document) {
  const rep = await fetch('https://api.mistral.ai/v1/ocr', { method: 'POST', signal: AbortSignal.timeout(40000), headers: { 'content-type': 'application/json', authorization: 'Bearer ' + CLE_API }, body: JSON.stringify({ model: MODELE_OCR, document }) });
  if (!rep.ok) throw new Error('ocr ' + rep.status);
  const j = await rep.json();
  noterUsage('ocr', j.model || MODELE_OCR, 0, 0, (j.usage_info && j.usage_info.pages_processed) || (j.pages || []).length);
  return (j.pages || []).map((p) => p.markdown || '').join('\n');
}
/** Ticket de caisse (photo, PDF ou texte collé) → articles vérifiés contre le total, voir ticket-agent.js. */
function lireTicket(entree) {
  return lireTicketAgent(entree, {
    ocr: FOURNISSEUR === 'mistral' ? ocrMistral : null,
    chat: (messages, { image }) => appelerModele(messages, { image, modele: MODELE_TICKET, max: 8000, temperature: 0, imageEnTete: true, delai: 60000, usage: 'ticket' }),
    catalogue: CATALOGUE_TICKET,
  });
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
  if (u.pathname === '/ia/etat') return repondre(res, 200, { disponible: !!CLE_API, vision: !!CLE_API && CATALOGUE.length > 0, ticket: !!CLE_API, pdf: FOURNISSEUR === 'mistral' }, origine);
  if (u.pathname === '/ia') {
    if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST seulement' }, origine);
    if (!CLE_API) return repondre(res, 503, { erreur: 'non_configure' }, origine);
    if (origine && !ORIGINES.includes(origine) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) return repondre(res, 403, { erreur: 'Origine refusée' }, origine);
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    try {
      const msgs = nettoyerMessages(JSON.parse(await lireCorps(req, 64 * 1024)).messages);
      if (!msgs || !msgs.length) return repondre(res, 400, { erreur: 'Question illisible' }, origine);
      const refus = quotaIA(ip);
      if (refus) return repondre(res, 429, { erreur: refus }, origine);
      const o = extraireJSON(await appelerModele(msgs, { max: 700 }));
      return repondre(res, 200, o || { reponse: '' }, origine);
    } catch (e) {
      const code = Number.isInteger(e.code) ? e.code : (e.name === 'TimeoutError' ? 504 : 502);
      return repondre(res, code, { erreur: e.code ? e.message : 'L’assistant n’a pas pu répondre' }, origine);
    }
  }
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
  if (u.pathname === '/ticket') {
    if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST seulement' }, origine);
    if (!CLE_API) return repondre(res, 503, { erreur: 'non_configure' }, origine);
    if (origine && !ORIGINES.includes(origine) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) return repondre(res, 403, { erreur: 'Origine refusée' }, origine);
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    try {
      const o = JSON.parse(await lireCorps(req, 9 * 1024 * 1024));
      const img = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(o.image || '');
      const pdf = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(o.pdf || '');
      const texte = typeof o.texte === 'string' ? o.texte.slice(0, 20000) : '';
      if (!img && !pdf && texte.trim().length < 10) return repondre(res, 400, { erreur: 'Ticket illisible' }, origine);
      const refus = quotaPhotos(ip);
      if (refus) return repondre(res, 429, { erreur: refus }, origine);
      return repondre(res, 200, await lireTicket({ image: img && img[1], pdf: pdf && pdf[1], texte, suite: !!o.suite }), origine);
    } catch (e) {
      const code = Number.isInteger(e.code) ? e.code : (e.name === 'TimeoutError' ? 504 : 502);
      return repondre(res, code, { erreur: e.code ? e.message : 'Lecture du ticket impossible pour le moment' }, origine);
    }
  }
  // abonnement : état, page de paiement, espace client (le jeton de session voyage dans le corps : pas de pré-requête CORS)
  // parrainage : mon code et mes compteurs, ou validation du code reçu (jeton dans le corps, comme l'abonnement)
  if (u.pathname === '/parrainage/moi' || u.pathname === '/parrainage/valider') {
    if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST seulement' }, origine);
    if (origine && !ORIGINES.includes(origine) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) return repondre(res, 403, { erreur: 'Origine refusée' }, origine);
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (tropDeDemandes(ip)) return repondre(res, 429, { erreur: 'Trop de demandes' }, origine);
    try {
      const o = JSON.parse(await lireCorps(req, 16 * 1024) || '{}');
      const r = u.pathname === '/parrainage/moi' ? await Parrainage.moi(o.jeton) : await Parrainage.valider(o.jeton, o.code);
      return repondre(res, 200, r, origine);
    } catch (e) {
      const code = Number.isInteger(e.code) ? e.code : 502;
      return repondre(res, code, { erreur: e.code ? e.message : 'Parrainage indisponible pour le moment' }, origine);
    }
  }
  if (u.pathname === '/abonnement/etat' || u.pathname === '/abonnement/payer' || u.pathname === '/abonnement/gerer') {
    if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST seulement' }, origine);
    if (origine && !ORIGINES.includes(origine) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) return repondre(res, 403, { erreur: 'Origine refusée' }, origine);
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (tropDeDemandes(ip)) return repondre(res, 429, { erreur: 'Trop de demandes' }, origine);
    try {
      const o = JSON.parse(await lireCorps(req, 16 * 1024) || '{}');
      const f = u.pathname === '/abonnement/etat' ? Abonnement.etat : u.pathname === '/abonnement/payer' ? Abonnement.paiement : Abonnement.portail;
      // retour après paiement : sur l'adresse d'où vient la personne (budgetable.fr ou l'adresse Render)
      const site = origine && ORIGINES.includes(origine) ? origine : null;
      return repondre(res, 200, await f(o.jeton, undefined, site), origine);
    } catch (e) {
      const code = Number.isInteger(e.code) ? e.code : 502;
      return repondre(res, code, { erreur: e.code ? e.message : 'Paiement indisponible pour le moment' }, origine);
    }
  }
  if (u.pathname === '/sante' || u.pathname === '/') return repondre(res, 200, { ok: true }, origine);
  if (u.pathname === '/promos' && req.method === 'GET') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (tropDeDemandes(ip)) return repondre(res, 429, { erreur: 'Trop de demandes' }, origine);
    try { return repondre(res, 200, await promosDuMoment(), origine); } catch (e) { return repondre(res, 502, { erreur: 'Promotions indisponibles pour le moment' }, origine); }
  }
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
