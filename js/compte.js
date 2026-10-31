/* Budgétable — comptes (Supabase) : inscription, connexion, mot de passe oublié, synchronisation des données.
 * Utilise directement l'API publique de Supabase (Auth + base PostgREST), sans bibliothèque.
 * Configuration : js/config.js → window.BUDGETABLE_SUPABASE = { url: 'https://xxxx.supabase.co', cle: 'clé anon publique' }.
 * La clé « anon » est publique par nature : la sécurité vient des règles de la base (chacun ne lit que sa ligne).
 */
(function (root) {
  'use strict';
  const CONF = root.BUDGETABLE_SUPABASE || {};
  const URL_BASE = String(CONF.url || '').replace(/\/+$/, '');
  const CLE = String(CONF.cle || '');
  const CLE_SESSION = 'budgetable.session';
  const actif = () => !!(URL_BASE && CLE && /^https:\/\//.test(URL_BASE));

  let session = null;
  try { session = JSON.parse(localStorage.getItem(CLE_SESSION) || 'null'); } catch (e) { session = null; }
  const garder = (s) => { session = s; try { if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s)); else localStorage.removeItem(CLE_SESSION); } catch (e) { /* stockage indisponible */ } };

  // messages d'erreur de Supabase → français
  const ERREURS = [
    [/invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
    [/email not confirmed/i, 'Confirmez d’abord votre adresse : cliquez sur le lien reçu par e-mail.'],
    [/user already registered|already been registered/i, 'Un compte existe déjà avec cette adresse : connectez-vous.'],
    [/password should be at least|weak password|password is too short/i, 'Mot de passe trop court : 8 caractères au moins.'],
    [/rate limit|too many/i, 'Trop d’essais : patientez une minute.'],
    [/unable to validate email|invalid email|email address .* is invalid/i, 'Adresse e-mail invalide.'],
    [/signups not allowed/i, 'Les inscriptions sont fermées pour le moment.'],
    [/token has expired|otp_expired|link is invalid/i, 'Ce lien a expiré : demandez-en un nouveau.'],
    [/same password|different from the old/i, 'Choisissez un mot de passe différent de l’ancien.']
  ];
  function traduire(msg) {
    const m = String(msg || '');
    const t = ERREURS.find(([rx]) => rx.test(m));
    return t ? t[1] : (m ? 'Erreur : ' + m : 'Le service de comptes ne répond pas. Réessayez dans un instant.');
  }
  async function appel(chemin, { methode = 'POST', corps, jeton, entetes = {} } = {}) {
    if (!actif()) throw new Error('Comptes pas encore activés');
    let rep;
    try {
      rep = await fetch(URL_BASE + chemin, { method: methode, headers: { apikey: CLE, 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}), ...entetes }, body: corps ? JSON.stringify(corps) : undefined, signal: AbortSignal.timeout(15000) });
    } catch (e) { throw new Error(traduire('')); }
    const texte = await rep.text();
    let json = null; try { json = texte ? JSON.parse(texte) : null; } catch (e) { json = null; }
    if (!rep.ok) throw Object.assign(new Error(traduire(json && (json.msg || json.message || json.error_description || json.error_code || json.error))), { statut: rep.status });
    return json;
  }
  const versSession = (r) => (r && r.access_token ? { jeton: r.access_token, renouv: r.refresh_token, expire: Date.now() + (r.expires_in || 3600) * 1000, user: r.user ? { id: r.user.id, email: r.user.email } : (session && session.user) } : null);
  const retour = () => (typeof location !== 'undefined' ? location.origin + location.pathname : '');

  async function jetonValide() {
    if (!session) return null;
    if (Date.now() < session.expire - 60000) return session.jeton;
    try { garder(versSession(await appel('/auth/v1/token?grant_type=refresh_token', { corps: { refresh_token: session.renouv } }))); return session && session.jeton; }
    catch (e) { if (e.statut >= 400 && e.statut < 500) garder(null); return null; }
  }

  /** Inscription : renvoie { confirmer: true } si un e-mail de confirmation est parti, ou la session si la confirmation est désactivée. */
  async function inscrire(email, motDePasse, prenom) {
    let parrain = ''; try { parrain = (JSON.parse(localStorage.getItem('budgetable.parrain') || 'null') || {}).code || ''; } catch (e) { /* */ }
    const r = await appel('/auth/v1/signup?redirect_to=' + encodeURIComponent(retour()), { corps: { email, password: motDePasse, data: { ...(prenom ? { prenom } : {}), ...(parrain ? { parrain } : {}) } } });
    if (r && r.access_token) { garder(versSession(r)); return { connecte: true }; }
    return { confirmer: true };
  }
  async function connecter(email, motDePasse) {
    garder(versSession(await appel('/auth/v1/token?grant_type=password', { corps: { email, password: motDePasse } })));
    return session;
  }
  async function lienMagique(email) { await appel('/auth/v1/otp?redirect_to=' + encodeURIComponent(retour()), { corps: { email, create_user: false } }); }
  async function motDePasseOublie(email) { await appel('/auth/v1/recover?redirect_to=' + encodeURIComponent(retour()), { corps: { email } }); }
  async function changerMotDePasse(motDePasse) { const j = await jetonValide(); if (!j) throw new Error('Session expirée : reconnectez-vous.'); await appel('/auth/v1/user', { methode: 'PUT', jeton: j, corps: { password: motDePasse } }); }
  async function deconnecter() { const j = session && session.jeton; garder(null); if (j && actif()) { try { await appel('/auth/v1/logout', { jeton: j }); } catch (e) { /* déjà expirée */ } } }

  /** Retour depuis un lien reçu par e-mail (#access_token=…&type=signup|recovery|magiclink) ou une erreur. */
  function lireRetour() {
    if (typeof location === 'undefined' || !/access_token=|error_description=/.test(location.hash)) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    if (p.get('error_description') || p.get('error')) return { erreur: traduire(p.get('error_code') || p.get('error_description')) };
    garder({ jeton: p.get('access_token'), renouv: p.get('refresh_token'), expire: Date.now() + (+p.get('expires_in') || 3600) * 1000, user: null });
    return { type: p.get('type') || 'magiclink' };
  }
  async function moi() {
    const j = await jetonValide(); if (!j) return null;
    const u = await appel('/auth/v1/user', { methode: 'GET', jeton: j });
    if (u && u.id) { session.user = { id: u.id, email: u.email, prenom: (u.user_metadata || {}).prenom || '', parrain: (u.user_metadata || {}).parrain || '' }; garder(session); }
    return session.user;
  }

  /* ---------- données : une ligne par compte dans la table « profils » ---------- */
  async function lireDonnees() {
    const j = await jetonValide(); if (!j || !session.user) return null;
    const r = await appel(`/rest/v1/profils?id=eq.${encodeURIComponent(session.user.id)}&select=donnees,maj`, { methode: 'GET', jeton: j });
    return Array.isArray(r) && r[0] ? { donnees: r[0].donnees, maj: Date.parse(r[0].maj) || 0 } : null;
  }
  async function ecrireDonnees(donnees) {
    const j = await jetonValide(); if (!j || !session.user) return false;
    await appel('/rest/v1/profils?on_conflict=id', { jeton: j, entetes: { Prefer: 'resolution=merge-duplicates,return=minimal' }, corps: { id: session.user.id, donnees, maj: new Date().toISOString() } });
    return true;
  }
  async function supprimerCompte() {
    const j = await jetonValide(); if (!j) throw new Error('Session expirée : reconnectez-vous.');
    await appel('/rest/v1/rpc/supprimer_mon_compte', { jeton: j, corps: {} });
    garder(null);
  }

  /* ---------- compteur de visites anonyme (aucune donnée personnelle, aucun cookie) ---------- */
  function compter(evenement, { page = null, source = null } = {}) {
    try {
      if (!actif() || (typeof navigator !== 'undefined' && navigator.webdriver) || /^(localhost|127\.)/.test(location.hostname)) return;
      const appareil = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'ordinateur';
      fetch(URL_BASE + '/rest/v1/visites', { method: 'POST', keepalive: true, headers: { apikey: CLE, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ evenement, page: page ? String(page).slice(0, 80) : null, source: source ? String(source).slice(0, 30) : null, appareil }) }).catch(() => {});
    } catch (e) { /* le compteur ne doit jamais gêner l'appli */ }
  }
  async function estAdmin() { const j = await jetonValide(); if (!j) return false; try { return (await appel('/rest/v1/rpc/est_admin', { jeton: j, corps: {} })) === true; } catch (e) { return false; } }
  async function statistiques(jours) {
    const j = await jetonValide(); if (!j) throw new Error('Session expirée : reconnectez-vous.');
    const [lignes, pages, ia] = await Promise.all([appel('/rest/v1/rpc/stats_visites', { jeton: j, corps: { jours } }), appel('/rest/v1/rpc/stats_pages', { jeton: j, corps: { jours } }).catch(() => []),
      appel('/rest/v1/rpc/stats_ia', { jeton: j, corps: { jours } }).catch(() => null)]);   // null : compteur IA pas encore installé (supabase/usage_ia.sql)
    return { lignes: Array.isArray(lignes) ? lignes : [], pages: Array.isArray(pages) ? pages : [], ia: Array.isArray(ia) ? ia : null };
  }
  root.Compte = { compter, estAdmin, statistiques, jetonValide, actif, connecte: () => !!session, utilisateur: () => (session && session.user) || null, inscrire, connecter, lienMagique, motDePasseOublie, changerMotDePasse, deconnecter, lireRetour, moi, lireDonnees, ecrireDonnees, supprimerCompte, traduire };
})(typeof window !== 'undefined' ? window : globalThis);
