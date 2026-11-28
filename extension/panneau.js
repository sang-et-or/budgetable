/* Budgétable – panneau affiché sur le site du drive.
 * Il n'agit que sur clic de l'utilisateur : chercher un article, ajouter au panier,
 * ou « Tout mettre au panier » (lancé par la personne, arrêtable, ne commande ni ne paie jamais).
 * Les prix lus restent dans l'extension, sur cet ordinateur. */
(function () {
  if (window.__budgetablePanneau) return;
  window.__budgetablePanneau = true;
  const D = window.BudgetableDrives, L = window.BudgetableLecture, S = window.BudgetableStockage;
  const drive = D.driveDeLHote(location.hostname) || (window.__budgetableDriveTest ? D.DRIVES.find((d) => d.id === window.__budgetableDriveTest) : null);
  if (!drive) return;

  const euros = (n) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const etat = { liste: null, courant: 0, releves: {}, ajoutes: {}, replie: false, resultats: [], auto: null };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  const hote = document.createElement('div');
  hote.id = 'budgetable-panneau';
  hote.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646;';
  const ombre = hote.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(hote);

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: "Segoe UI", system-ui, sans-serif; }
    .p { width: 340px; max-height: 76vh; display: flex; flex-direction: column; background: #fffdf8; color: #1d2721; border: 2px solid #2f6b47; border-radius: 16px; box-shadow: 0 10px 30px rgb(0 0 0 / .25); overflow: hidden; font-size: 14px; line-height: 1.4; }
    .store { height: 14px; background: repeating-linear-gradient(90deg, #2f6b47 0 16px, #fbfaf3 16px 32px); }
    .t { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 14px; background: #2f6b47; color: #fff; }
    .t b { font-size: 15px; }
    .c { padding: 12px 14px; overflow-y: auto; display: grid; gap: 10px; }
    button { font: inherit; cursor: pointer; border-radius: 999px; border: 1px solid #c9d2c4; background: #fff; padding: 6px 12px; color: #1d2721; }
    button:focus-visible { outline: 3px solid #e3b44a; outline-offset: 2px; }
    .plein { background: #2f6b47; color: #fff; border-color: #2f6b47; font-weight: 600; }
    .lien { border: 0; background: none; color: #fff; text-decoration: underline; padding: 2px; }
    .art { background: #fbf1d6; border-radius: 12px; padding: 10px 12px; display: grid; gap: 4px; }
    .art strong { font-size: 16px; }
    .petit { font-size: 12px; color: #5b685f; }
    .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .prod { border: 1px solid #dde3d8; border-radius: 12px; padding: 8px 10px; display: grid; gap: 6px; }
    .prod .prix { font-weight: 700; font-variant-numeric: tabular-nums; }
    .etiq { display: inline-block; background: #f6d36b; color: #3a2a06; font-weight: 700; padding: 1px 8px; border-radius: 4px; }
    .ok { color: #2f6b47; font-weight: 600; }
    ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; max-height: 150px; overflow-y: auto; }
    li { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding: 3px 0; border-bottom: 1px dashed #dde3d8; }
    li.cur { font-weight: 700; }
    .auto { background: #e3eee5; border-radius: 12px; padding: 10px 12px; display: grid; gap: 6px; }
    .auto .plein { justify-self: start; }
    .barre { height: 8px; background: #fff; border-radius: 999px; overflow: hidden; }
    .barre i { display: block; height: 100%; background: #2f6b47; }
    .alerte { background: #fbe3dc; color: #6b1f10; border-radius: 10px; padding: 8px 10px; }
    .bilan li { align-items: center; }
    .bilan button { padding: 2px 8px; font-size: 12px; }
    .bulle { width: 64px; height: 64px; border-radius: 50%; background: #2f6b47; color: #fff; border: 3px solid #f6d36b; font-weight: 800; font-size: 12px; box-shadow: 0 6px 16px rgb(0 0 0 / .25); }`;

  // le site cache les prix tant que le magasin n'est pas choisi
  function prixCaches() {
    return [...document.querySelectorAll('button, a')].some((b) => /afficher le prix|choisir (?:mon|votre|un) magasin|saisissez votre adresse/i.test(b.textContent || ''))
      || /saisissez votre adresse|choisissez votre magasin/i.test((document.body.innerText || '').slice(0, 3000));
  }

  function lienRecherche(a) {
    if (drive.recherche) return drive.recherche(a.recherche);
    if (drive.rechercheDepuis) return drive.rechercheDepuis(location, a.recherche);
    return null;
  }

  function article() { return etat.liste ? etat.liste.articles[etat.courant] : null; }

  async function charger() {
    etat.liste = await S.lire('liste', null);
    etat.courant = Math.min(await S.lire('courant', 0), etat.liste ? etat.liste.articles.length - 1 : 0);
    etat.releves = await S.lire('releves', {});
    etat.ajoutes = await S.lire('ajoutes', {});
    etat.replie = await S.lire('replie', false);
    etat.auto = await S.lire('auto', null);
  }
  const sauverAuto = () => S.ecrire('auto', etat.auto);

  /* ---------- « Tout mettre au panier » ----------
   * Lancé par un clic de la personne, sur son compte déjà connecté, dans son navigateur.
   * Pour chaque article : ouvre la recherche du site, ajoute le produit le moins cher qui correspond
   * (et la quantité prévue), puis passe au suivant. Ne valide jamais la commande et ne paie jamais. */
  const FENETRE_BLOQUANTE = /connecte|identifi|mot de passe|choisi\w* (?:votre|un|mon) (?:magasin|drive|créneau)|code postal|votre adresse/i;
  function fenetreOuverte() {
    return [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], dialog[open]')]
      .some((d) => !hote.contains(d) && d.offsetParent !== null && FENETRE_BLOQUANTE.test(d.innerText || ''));
  }
  async function attendreProduits(a) {
    for (let k = 0; k < 24; k++) {
      const tous = L.lireProduits(document).filter((p) => !hote.contains(p.bouton));
      const meilleurs = L.meilleursPour(tous, a.recherche, a.unite);
      if (meilleurs.length) {
        await pause(700); // la page finit souvent de s'afficher : on relit une fois
        const encore = L.meilleursPour(L.lireProduits(document).filter((p) => !hote.contains(p.bouton)), a.recherche, a.unite);
        return { resultats: encore.length ? encore : meilleurs };
      }
      if (k >= 6 && prixCaches()) return { caches: true, resultats: [] };
      if (k >= 10 && tous.length) return { resultats: [] };
      await pause(500);
    }
    return { resultats: [] };
  }
  async function etapeAuto() {
    const au = etat.auto;
    if (!au || !au.actif || au.drive !== drive.id || !etat.liste) return;
    const arts = etat.liste.articles;
    while (au.i < arts.length && (etat.ajoutes[drive.id] || {})[arts[au.i].id]) { if (!au.bilan[arts[au.i].id]) au.bilan[arts[au.i].id] = { r: 'deja' }; au.i++; }
    if (au.i >= arts.length) { au.actif = false; au.fini = true; au.attente = null; await sauverAuto(); rendu(); return; }
    const a = arts[au.i];
    etat.courant = au.i; await S.ecrire('courant', au.i);
    if (au.attente !== a.id) {
      const url = lienRecherche(a);
      if (!url) { au.actif = false; au.arret = 'recherche'; await sauverAuto(); rendu(); return; }
      au.attente = a.id; await sauverAuto(); rendu();
      location.href = url;
      return;
    }
    rendu();
    const res = await attendreProduits(a);
    if (!etat.auto || !etat.auto.actif) return; // arrêté pendant l'attente
    if (res.caches) { au.actif = false; au.arret = 'magasin'; au.attente = null; await sauverAuto(); rendu(); return; }
    if (res.resultats.length) {
      const p = res.resultats[0];
      p.bouton.click();
      await pause(1200);
      if (fenetreOuverte()) { au.actif = false; au.arret = 'fenetre'; au.attente = null; await sauverAuto(); rendu(); return; }
      let n = 1;
      for (; n < a.conditionnements; n++) {
        const plus = L.plusDuProduit(p, document);
        if (!plus) break;
        plus.click(); await pause(900);
      }
      await noterReleve(a, p, true);
      au.bilan[a.id] = { r: 'ajoute', titre: p.titre, prix: p.prix, n, voulu: a.conditionnements };
    } else au.bilan[a.id] = { r: 'introuvable' };
    au.i++; au.attente = null; await sauverAuto(); rendu();
    await pause(1500 + Math.random() * 1000); // on laisse respirer le site entre deux recherches
    if (etat.auto && etat.auto.actif) etapeAuto();
  }
  function blocAuto() {
    const au = etat.auto && etat.auto.drive === drive.id ? etat.auto : null;
    const arts = etat.liste.articles, n = arts.length;
    if (au && au.actif) {
      const a = arts[Math.min(au.i, n - 1)];
      return `<div class="auto" role="status"><b>Remplissage du panier…</b><span class="petit">Article ${Math.min(au.i + 1, n)} sur ${n} : ${esc(a.nom)}</span>
        <div class="barre"><i style="width:${Math.round(au.i / n * 100)}%"></i></div>
        <span class="petit">Laissez cet onglet ouvert. Vous pouvez arrêter à tout moment.</span>
        <button data-a="auto-stop">Arrêter</button></div>`;
    }
    if (au && (au.fini || au.arret)) {
      const b = au.bilan || {};
      const ajoutes = arts.filter((x) => b[x.id] && b[x.id].r === 'ajoute');
      const total = ajoutes.reduce((t, x) => t + b[x.id].prix * b[x.id].n, 0);
      const introuvables = arts.filter((x) => b[x.id] && b[x.id].r === 'introuvable');
      const quantite = ajoutes.filter((x) => b[x.id].n < b[x.id].voulu);
      const raison = { magasin: 'Le site cache les prix : choisissez d’abord votre magasin, puis cliquez sur « Reprendre ».', fenetre: 'Le site a ouvert une fenêtre (connexion, magasin ou créneau). Terminez-la, puis cliquez sur « Reprendre ».', recherche: 'La recherche de ce drive n’est pas accessible d’ici : ouvrez d’abord votre magasin sur le site, puis cliquez sur « Reprendre ».', stop: 'Remplissage arrêté.' }[au.arret];
      return `<div class="auto"><b>${au.fini ? '✓ Panier rempli' : 'Remplissage en pause'}</b>
        ${raison ? `<div class="alerte petit">${raison}</div>` : ''}
        <span>${ajoutes.length} article${ajoutes.length > 1 ? 's' : ''} ajouté${ajoutes.length > 1 ? 's' : ''}${total ? ` · environ <b>${euros(total)}</b>` : ''}</span>
        ${quantite.length ? `<span class="petit">Quantité à vérifier : ${quantite.map((x) => `${esc(x.nom)} (${b[x.id].n} sur ${b[x.id].voulu})`).join(', ')}</span>` : ''}
        ${introuvables.length ? `<span class="petit">Pas trouvés ici :</span><ul class="bilan">${introuvables.map((x) => `<li><span>${esc(x.nom)}</span><button data-a="auto-voir" data-id="${esc(x.id)}">Chercher</button></li>`).join('')}</ul>` : ''}
        <span class="petit">Vérifiez votre panier sur le site, puis validez et payez vous-même.</span>
        <div class="row">${au.fini ? '' : '<button class="plein" data-a="auto-reprendre">Reprendre</button>'}<button data-a="auto-fermer">Fermer le bilan</button></div></div>`;
    }
    const reste = arts.filter((x) => !(etat.ajoutes[drive.id] || {})[x.id]).length;
    if (!reste) return '';
    return `<div class="auto"><button class="plein" data-a="auto-go">🛒 Tout mettre au panier (${reste} article${reste > 1 ? 's' : ''})</button>
      <span class="petit">Connecté à votre compte et votre magasin choisi, l’extension cherche chaque article et ajoute le moins cher qui correspond. Rien n’est commandé ni payé : vous vérifiez le panier et validez vous-même.</span></div>`;
  }

  async function noterReleve(a, p, ajoute) {
    etat.releves[drive.id] = etat.releves[drive.id] || {};
    etat.releves[drive.id][a.id] = { titre: p.titre, prix: p.prix, prixUnite: p.prixUnite, unite: p.unite, date: new Date().toISOString().slice(0, 10), magasin: drive.nom };
    await S.ecrire('releves', etat.releves);
    if (ajoute) {
      etat.ajoutes[drive.id] = etat.ajoutes[drive.id] || {};
      etat.ajoutes[drive.id][a.id] = true;
      await S.ecrire('ajoutes', etat.ajoutes);
    }
  }

  function lire() {
    const a = article();
    if (!a) { etat.resultats = []; return; }
    const tous = L.lireProduits(document).filter((p) => !hote.contains(p.bouton));
    etat.vusMaisEcartes = tous.length;
    etat.resultats = L.meilleursPour(tous, a.recherche, a.unite).slice(0, 3);
  }

  function rendu() {
    if (etat.replie) {
      ombre.innerHTML = `<style>${CSS}</style><button class="bulle" data-a="deplier" aria-label="Ouvrir le panneau Budgétable">Budgé&shy;table</button>`;
      return;
    }
    const a = article();
    let corps = '';
    if (!etat.liste) {
      corps = `<p>Aucune liste pour l’instant.</p><p class="petit">Dans Budgétable, onglet Courses, cliquez sur « Envoyer vers l’extension », puis collez la liste dans l’extension (icône Budgétable en haut du navigateur).</p>`;
    } else {
      const n = etat.liste.articles.length;
      corps += blocAuto();
      const rel = (etat.releves[drive.id] || {})[a.id];
      const ajoute = (etat.ajoutes[drive.id] || {})[a.id];
      corps += `<div class="art"><span class="petit">Article ${etat.courant + 1} sur ${n}</span><strong>${esc(a.nom)}</strong>
        <span class="petit">Besoin : ${esc(a.besoin)} · environ ${a.conditionnements} × ${esc(a.condLabel)}</span>
        ${rel ? `<span class="petit">Relevé ici : ${esc(rel.titre)} à <b>${euros(rel.prix)}</b>${ajoute ? ' · <span class="ok">ajouté au panier</span>' : ''}</span>` : ''}
        <div class="row">${lienRecherche(a) ? `<button class="plein" data-a="chercher">Chercher « ${esc(a.recherche)} »</button>` : `<button data-a="copier">Copier « ${esc(a.recherche)} »</button><span class="petit">puis utilisez la recherche du site</span>`}</div>
        <div class="row"><button data-a="prec" ${etat.courant === 0 ? 'disabled' : ''}>Précédent</button><button data-a="suiv" ${etat.courant >= n - 1 ? 'disabled' : ''}>Suivant</button></div></div>`;
      if (etat.resultats.length) {
        corps += `<div class="petit">Les moins chers affichés sur cette page :</div>` + etat.resultats.map((p, i) => `<div class="prod">
          <span>${esc(p.titre)}</span>
          <span class="row"><span class="etiq prix">${euros(p.prix)}</span>${p.prixUnite != null ? `<span class="petit">${euros(p.prixUnite)} / ${esc(p.unite)}</span>` : ''}</span>
          <span class="row"><button class="plein" data-a="ajouter" data-i="${i}">Ajouter au panier</button><button data-a="retenir" data-i="${i}">Retenir ce prix</button></span></div>`).join('');
      } else if (a) {
        corps += prixCaches()
          ? `<p><b>Choisissez d’abord votre magasin sur le site</b> (bouton « Afficher le prix » ou « Choisir mon magasin ») : les prix apparaîtront ensuite ici.</p>`
          : etat.vusMaisEcartes
            ? `<p class="petit">${etat.vusMaisEcartes} produit(s) sur la page, mais aucun ne correspond exactement (plats préparés ou autre unité). Ce drive n’a peut-être pas cet article : notez-le ailleurs.</p>`
            : `<p class="petit">Aucun produit correspondant n’est visible sur cette page. Lancez la recherche, ou faites défiler la page.</p>`;
      }
      if (drive.note) corps += `<p class="petit">${esc(drive.note)}</p>`;
      corps += `<details><summary class="petit">Toute la liste</summary><ul>${etat.liste.articles.map((x, i) => {
        const r = (etat.releves[drive.id] || {})[x.id];
        return `<li class="${i === etat.courant ? 'cur' : ''}"><span>${esc(x.nom)}</span><span>${r ? euros(r.prix) : '—'}${(etat.ajoutes[drive.id] || {})[x.id] ? ' ✓' : ''}</span></li>`;
      }).join('')}</ul></details>`;
    }
    ombre.innerHTML = `<style>${CSS}</style><section class="p" role="dialog" aria-label="Budgétable">
      <div class="store"></div>
      <div class="t"><b>Budgétable · ${esc(drive.nom)}</b><button class="lien" data-a="replier">Réduire</button></div>
      <div class="c">${corps}<p class="petit">Les prix lus restent sur cet ordinateur. C’est vous qui validez et payez la commande.</p></div></section>`;
  }

  ombre.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    const a = article();
    switch (b.dataset.a) {
      case 'replier': etat.replie = true; await S.ecrire('replie', true); break;
      case 'deplier': etat.replie = false; await S.ecrire('replie', false); break;
      case 'chercher': location.href = lienRecherche(a); return;
      case 'auto-go': etat.auto = { actif: true, drive: drive.id, i: 0, attente: null, bilan: {} }; await sauverAuto(); etapeAuto(); return;
      case 'auto-stop': if (etat.auto) { etat.auto.actif = false; etat.auto.arret = 'stop'; etat.auto.attente = null; await sauverAuto(); } break;
      case 'auto-reprendre': if (etat.auto) { etat.auto.actif = true; etat.auto.arret = null; etat.auto.attente = null; await sauverAuto(); etapeAuto(); } return;
      case 'auto-fermer': etat.auto = null; await sauverAuto(); break;
      case 'auto-voir': {
        const i = etat.liste.articles.findIndex((x) => x.id === b.dataset.id);
        if (i < 0) break;
        etat.courant = i; await S.ecrire('courant', i);
        const u = lienRecherche(etat.liste.articles[i]); if (u) { location.href = u; return; }
        lire(); break;
      }
      case 'copier': try { await navigator.clipboard.writeText(a.recherche); b.textContent = 'Copié'; } catch (e) { /* refusé */ } return;
      case 'prec': etat.courant = Math.max(0, etat.courant - 1); await S.ecrire('courant', etat.courant); lire(); break;
      case 'suiv': etat.courant = Math.min(etat.liste.articles.length - 1, etat.courant + 1); await S.ecrire('courant', etat.courant); lire(); break;
      case 'retenir': await noterReleve(a, etat.resultats[+b.dataset.i], false); break;
      case 'ajouter': {
        const p = etat.resultats[+b.dataset.i];
        p.bouton.click(); // clic de l'utilisateur transmis au bouton du site
        await noterReleve(a, p, true);
        break;
      }
      default: return;
    }
    rendu();
  });

  // le site peut afficher ses produits après coup : on relit quand la page change
  let minuteur = null;
  new MutationObserver((muts) => {
    if (muts.every((m) => hote.contains(m.target) || m.target === hote)) return;
    clearTimeout(minuteur);
    minuteur = setTimeout(() => { lire(); rendu(); }, 600);
  }).observe(document.body, { childList: true, subtree: true });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(async (ch) => {
      if (ch.liste) { etat.auto = null; await S.ecrire('auto', null); }
      if (ch.liste || (ch.courant && !(etat.auto && etat.auto.actif))) { await charger(); lire(); rendu(); }
    });
  }

  charger().then(() => { lire(); rendu(); etapeAuto(); });
})();
