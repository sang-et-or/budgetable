/* Budgétable — interface (V0.1). Aucune dépendance. */
(function () {
  'use strict';
  const E = window.Engine;
  const L = E.LIBELLES;
  const CLE = 'budgetable.v1';
  const DANS_UN_CADRE = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  const LIMITE_GRATUITE = 3; // remplacements par semaine en formule Découverte

  /* ---------- état ---------- */
  let S = {
    profil: E.profilParDefaut(),
    etape: 0,
    edition: false,       // vient de l'écran profil → retour au profil
    vue: 'accueil',       // accueil | questionnaire | profil | app
    onglet: 'semaine',
    plan: null,
    notes: {},
    coches: {},
    premium: false,
    compteLocal: false,
    sensibleNonEnregistre: false,
    ceSoirOuvert: false,
    imprimable: false,
    drives: { cp: '', rayon: 10, mode: 'compromis', conso: 6.5, carburant: 1.8, enseigne: '' },
    confirmerSuppression: false,
    test: null,            // { ids, i, depuis: 'profil' | 'app' }
    ia: { tours: [], attente: false, message: '' },
    classiques: [],        // « nos classiques » : plats préférés de la famille (cœur, ou 5 étoiles)
    tourEnfant: 0,         // à quel enfant le tour de choisir le dîner « choix des enfants »
    rituelsVus: false      // la suggestion de rituels a été vue
  };
  let choix = null;        // fenêtre « 3 idées » : { jour, slot, idees, exclure, tour, enfants }
  let chef = null;        // assistant cuisine de la fiche ouverte : { cle, tours, attente, message }
  let iaDispo = null;      // null : on vérifie ; false : indisponible ; fonction : disponible
  // photo d'illustration posée sur le dessin : si la photo ne charge pas, le dessin reste visible
  function V(rec, taille, forme) {
    const svg = window.Visuels.illustration(rec, E, taille);
    const ph = window.Photos && window.Photos.photoPour(rec);
    if (!ph) return svg;
    const dim = forme === 'rect' ? 'width:100%;height:' + taille + 'px' : `width:${taille}px;height:${taille}px`;
    return `<span class="photo ${forme || 'rond'}" style="${dim}">${svg}<img src="${esc(ph.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
  }
  function creditPhoto(rec) {
    const ph = window.Photos && window.Photos.photoPour(rec);
    if (!ph) return 'Illustration dessinée à partir des ingrédients';
    return `Photo d’illustration : <a href="${esc(ph.page)}" target="_blank" rel="noopener">${esc(ph.auteur)}</a>, ${ph.licenceUrl ? `<a href="${esc(ph.licenceUrl)}" target="_blank" rel="noopener">${esc(ph.licence)}</a>` : esc(ph.licence)}, via Wikimedia Commons. Le plat préparé peut différer.`;
  }
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.parentElement && img.parentElement.classList.contains('photo')) img.parentElement.classList.add('sans-photo');
  }, true);
  let fiche = null; // { jour, slot } ou { recette }
  let toastTimer = null;

  /* ---------- stockage local (consentement pour les données sensibles) ---------- */
  function sauver() {
    const p = JSON.parse(JSON.stringify(S.profil));
    let marque = false;
    if (!p.consentementSante) {
      if (p.allergies.length || p.objectifs.includes('perte')) marque = true;
      p.allergies = [];
      p.objectifs = p.objectifs.filter((o) => o !== 'perte');
    }
    const a = { v: 1, profil: p, sensibleNonEnregistre: marque, vue: S.vue === 'questionnaire' ? 'accueil' : S.vue === 'test' ? (S.plan ? 'app' : 'profil') : S.vue, onglet: S.onglet, plan: S.plan, notes: S.notes, coches: S.coches, premium: S.premium, compteLocal: S.compteLocal, drives: S.drives, classiques: S.classiques, tourEnfant: S.tourEnfant, rituelsVus: S.rituelsVus };
    try { localStorage.setItem(CLE, JSON.stringify(a)); } catch (e) { /* stockage indisponible : l'appli marche quand même */ }
  }
  function charger() {
    try {
      const a = JSON.parse(localStorage.getItem(CLE) || 'null');
      if (!a || a.v !== 1) return;
      Object.assign(S, { profil: { ...E.profilParDefaut(), ...a.profil }, vue: a.vue || 'accueil', onglet: a.onglet || 'semaine', plan: a.plan, notes: a.notes || {}, coches: a.coches || {}, premium: !!a.premium, compteLocal: !!a.compteLocal, sensibleNonEnregistre: !!a.sensibleNonEnregistre, drives: { ...S.drives, ...(a.drives || {}) }, classiques: a.classiques || [], tourEnfant: a.tourEnfant || 0, rituelsVus: !!a.rituelsVus });
    } catch (e) { /* données illisibles : on repart de zéro */ }
  }

  /* ---------- outils ---------- */
  const optsMoteur = () => ({ notes: S.notes, classiques: S.classiques });
  function prenomDuTour() {
    const n = (S.profil.prenomsEnfants || []).map((x) => String(x || '').trim()).filter(Boolean);
    return n.length ? n[S.tourEnfant % n.length] : null;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euros = (n) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const nb = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const aujourdhui = () => (new Date().getDay() + 6) % 7;
  const tagDemo = '<span class="tag tag-demo" title="Prix de démonstration : ne viennent d’aucun magasin">Prix démo</span>';
  function quantite(q, unite) {
    if (unite === 'g') return q >= 1000 ? `${nb(q / 1000)} kg` : `${Math.ceil(q)} g`;
    if (unite === 'ml') return q >= 1000 ? `${nb(q / 1000)} L` : `${Math.ceil(q)} ml`;
    const r = Math.round(q * 4) / 4;
    return r < 1 ? `${nb(r)} (une part)` : `${nb(r)}`;
  }
  function toast(msg) {
    clearTimeout(toastTimer);
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    toastTimer = setTimeout(() => t.remove(), 2600);
  }
  const ICONES = {
    semaine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    soir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 13h16a8 8 0 0 1-16 0zM12 4v3M7 6l1.5 2M17 6l-1.5 2"/></svg>',
    courses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11h10.2L20 8H7"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',
    drives: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    profil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
  };
  const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="14" cy="18" r="12" fill="var(--poireau)"/><circle cx="14" cy="18" r="7.5" fill="none" stroke="var(--papier)" stroke-width="2"/><circle cx="24.5" cy="8" r="6.5" fill="var(--moutarde)" stroke="var(--papier)" stroke-width="1.5"/><path d="M26.6 5.6a3 3 0 1 0 0 4.8M21.6 7.3h3.6M21.6 8.9h3.6" fill="none" stroke="var(--papier)" stroke-width="1.2" stroke-linecap="round"/></svg>';

  /* ---------- questionnaire adaptatif ---------- */
  const kids = (p) => p.foyer.enfants.length > 0;
  const QUESTIONS = [
    { id: 'foyer', titre: 'Qui mange à la maison ?', aide: 'On calcule les portions à partir de là.', type: 'foyer' },
    { id: 'ages', quand: kids, titre: (p) => p.foyer.enfants.length > 1 ? 'Quel âge ont les enfants ?' : 'Quel âge a l’enfant ?', aide: 'Une tranche d’âge suffit, pas besoin de date de naissance.', type: 'ages' },
    { id: 'enfantsMode', quand: kids, titre: 'Les enfants mangent-ils la même chose que vous ?', type: 'unique', champ: 'enfantsMode', options: { pareil: 'Oui, le même plat', simple: 'Ils préfèrent les plats simples' } },
    { id: 'objectifs', titre: 'Qu’est-ce qui compte le plus pour vous ?', aide: 'Plusieurs choix possibles.', type: 'multi', champ: 'objectifs', options: L.objectifs, sensibles: ['perte'] },
    { id: 'sport', quand: (p) => p.objectifs.includes('muscle'), titre: 'Combien de séances de sport par semaine ?', aide: 'On privilégiera les plats riches en protéines et des portions plus généreuses.', type: 'unique', champ: 'seancesSport', nombre: true, options: { 1: '1 séance', 2: '2 ou 3', 4: '4 ou plus' } },
    { id: 'regime', titre: 'Suivez-vous un régime alimentaire ?', type: 'unique', champ: 'regime', options: L.regime },
    { id: 'allergies', titre: 'Des allergies ou intolérances dans le foyer ?', aide: 'Facultatif. Sert uniquement à écarter des recettes. Vérifiez toujours les étiquettes : une recette ne garantit pas l’absence de traces.', type: 'multi', champ: 'allergies', options: L.allergies, aucune: 'Aucune', passer: true, sensible: true },
    { id: 'consentement', quand: (p) => p.allergies.length > 0 || p.objectifs.includes('perte'), type: 'consentement', titre: 'Garder ces informations sur cet appareil ?' },
    { id: 'temps', titre: 'Combien de temps pour cuisiner un repas ?', type: 'temps' },
    { id: 'niveau', titre: 'En cuisine, vous êtes plutôt…', type: 'unique', champ: 'niveau', options: L.niveau },
    { id: 'equipement', titre: 'Qu’avez-vous dans la cuisine ?', type: 'multi', champ: 'equipement', options: L.equipement },
    { id: 'cuisines', titre: 'Quelles cuisines vous font envie ?', aide: 'On les proposera plus souvent.', type: 'multi', champ: 'cuisines', options: L.cuisines, aucune: 'Pas de préférence' },
    { id: 'refus', titre: (p) => kids(p) ? 'Ce que quelqu’un refuse de manger' : 'Ce que vous ne mangez pas', aide: 'Ces aliments seront écartés.', type: 'multi', champ: 'refus', options: L.refus, aucune: 'Rien de particulier' },
    { id: 'dejeuners', titre: 'Et les déjeuners en semaine ?', type: 'dejeuners' },
    { id: 'budget', titre: 'Quel budget pour les courses de la semaine ?', type: 'budget' },
    { id: 'provisions', titre: 'Qu’avez-vous déjà en réserve ?', aide: 'Ces produits ne seront pas ajoutés à la liste.', type: 'provisions' }
  ];
  const questionsActives = (p) => QUESTIONS.filter((q) => !q.quand || q.quand(p));

  function reaction(q, p) {
    const n = p.foyer.adultes, e = p.foyer.enfants.length;
    switch (q.id) {
      case 'ages': return `${pluriel(n, 'adulte')} et ${pluriel(e, 'enfant')} : les portions suivront l’âge de chacun.`;
      case 'objectifs': return e ? 'Bien noté pour les enfants.' : `Parfait, ${n > 1 ? 'des menus pour ' + n + ' adultes' : 'des menus pour une personne'}.`;
      case 'sport': return 'D’accord, on visera des repas qui soutiennent l’effort.';
      case 'regime': return p.objectifs.includes('perte') ? 'Pour la perte de poids, on proposera des plats plus légers. Pour un vrai suivi, parlez-en à un professionnel de santé.' : p.objectifs.includes('economies') ? 'Les économies seront prioritaires : moins de gaspillage, ingrédients partagés.' : null;
      case 'temps': return p.allergies.length ? `${pluriel(p.allergies.length, 'allergie')} prise${p.allergies.length > 1 ? 's' : ''} en compte. Aucune recette ne les contiendra.` : null;
      case 'equipement': return p.niveau === 'debutant' ? 'On restera sur des recettes faciles, étape par étape.' : null;
      case 'budget': return p.dejeuners.mode === 'dehors' ? 'Les déjeuners pris dehors ne seront pas comptés.' : null;
      default: return null;
    }
  }

  function vueQuestionnaire() {
    const p = S.profil;
    const qs = questionsActives(p);
    S.etape = Math.min(S.etape, qs.length - 1);
    const q = qs[S.etape];
    const titre = typeof q.titre === 'function' ? q.titre(p) : q.titre;
    const re = reaction(q, p);
    const pct = Math.round((S.etape / qs.length) * 100);
    return `<div class="wrap"><div class="store" aria-hidden="true"></div><div class="q-shell">
      <div class="spread"><div class="marque">${LOGO}Budgétable</div><span class="small muted num">${S.etape + 1} / ${qs.length}</span></div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avancement du questionnaire"><i style="width:${pct}%"></i></div>
      ${re ? `<p class="bulle">${esc(re)}</p>` : ''}
      <h1 id="q-titre">${esc(titre)}</h1>
      ${q.aide ? `<p class="q-aide">${esc(q.aide)}</p>` : ''}
      <div role="group" aria-labelledby="q-titre">${champQuestion(q, p)}</div>
      <div class="q-nav">
        <button class="btn" data-a="q-prec" ${S.etape === 0 && !S.edition ? 'disabled' : ''}>Retour</button>
        <div class="row">
          ${q.passer ? '<button class="btn btn-lien" data-a="q-passer">Je préfère ne pas répondre</button>' : ''}
          <button class="btn btn-plein" data-a="q-suiv">${S.edition ? 'Enregistrer' : S.etape === qs.length - 1 ? 'Voir mon profil' : 'Continuer'}</button>
        </div>
      </div>
    </div></div>`;
  }

  function chips(champ, options, valeurs, multi, aucune) {
    const sel = (k) => multi ? valeurs.includes(k) : String(valeurs) === String(k);
    let h = '<div class="choix">';
    if (aucune) h += `<button class="chip" data-a="chip-aucun" data-champ="${champ}" aria-pressed="${valeurs.length === 0}">${esc(aucune)}</button>`;
    for (const [k, v] of Object.entries(options)) h += `<button class="chip" data-a="chip" data-champ="${champ}" data-k="${esc(k)}" data-multi="${multi ? 1 : 0}" aria-pressed="${sel(k)}">${esc(v)}</button>`;
    return h + '</div>';
  }
  function compteur(id, label, val, min, max) {
    return `<div class="compteur"><span>${label}</span><div class="ctl">
      <button data-a="cpt" data-id="${id}" data-d="-1" aria-label="Retirer" ${val <= min ? 'disabled' : ''}>−</button>
      <output class="num" aria-live="polite">${val}</output>
      <button data-a="cpt" data-id="${id}" data-d="1" aria-label="Ajouter" ${val >= max ? 'disabled' : ''}>+</button></div></div>`;
  }

  function champQuestion(q, p) {
    switch (q.type) {
      case 'foyer': return compteur('adultes', 'Adultes (et ados de 18 ans ou plus)', p.foyer.adultes, 1, 8) + compteur('enfants', 'Enfants', p.foyer.enfants.length, 0, 8);
      case 'ages': return '<div class="stack">' + p.foyer.enfants.map((a, i) => `<div class="stack" style="gap:8px"><span class="eyebrow">Enfant ${i + 1}</span><div class="choix">${Object.entries(L.ages).map(([k, v]) => `<button class="chip" data-a="age" data-i="${i}" data-k="${k}" aria-pressed="${a === k}">${v}</button>`).join('')}</div></div>`).join('') + '</div>';
      case 'unique': return chips(q.champ, q.options, p[q.champ], false);
      case 'multi': return chips(q.champ, q.options, p[q.champ], true, q.aucune);
      case 'consentement': return `<div class="stack">
        <p>Vos allergies${p.objectifs.includes('perte') ? ' et votre objectif de perte de poids' : ''} sont des données de santé. Sans votre accord, elles servent pour cette séance uniquement et ne sont pas enregistrées.</p>
        <label class="case"><input type="checkbox" id="consent-sante" data-a="consent" ${p.consentementSante ? 'checked' : ''}><span>J’accepte que ces informations soient enregistrées <strong>sur cet appareil uniquement</strong>. Je peux les modifier ou les supprimer à tout moment dans « Profil ».</span></label>
        <p class="small muted">Rien n’est envoyé à un serveur. <a href="confidentialite.html" target="_blank" rel="noopener">Politique de confidentialité</a></p></div>`;
      case 'temps': return `<div class="stack">
        <div class="champ"><span>En semaine</span>${chips('temps.semaine', { 15: '15 min', 20: '20 min', 30: '30 min', 45: '45 min', 60: '1 h ou plus' }, p.temps.semaine, false)}</div>
        <div class="champ"><span>Le week-end</span>${chips('temps.weekend', { 20: '20 min', 30: '30 min', 45: '45 min', 60: '1 h', 90: 'J’ai le temps' }, p.temps.weekend, false)}</div></div>`;
      case 'dejeuners': {
        const d = p.dejeuners;
        let h = chips('dejeuners.mode', { maison: 'Tout le monde mange à la maison', dehors: 'Certains mangent dehors (travail, cantine)' }, d.mode, false);
        if (d.mode === 'dehors') {
          h += `<div class="sous-bloc" style="margin-top:16px">${compteur('adultesMaison', 'Adultes qui déjeunent à la maison en semaine', d.adultesMaison, 0, p.foyer.adultes)}
          ${kids(p) ? `<div class="champ"><span>Les enfants déjeunent à la maison…</span>${chips('dejeuners.enfantsMaison', { non: 'Jamais en semaine (cantine)', mercredi: 'Le mercredi', oui: 'Tous les jours' }, d.enfantsMaison, false)}</div>` : ''}</div>`;
        }
        return h;
      }
      case 'budget': return `<div class="stack">
        <div class="gros-chiffre num"><output id="budget-val">${euros(p.budget)}</output> <span class="small muted" style="font:500 1rem var(--f-texte)">par semaine</span></div>
        <input class="range" type="range" id="budget" min="20" max="250" step="5" value="${p.budget}" data-a="budget" aria-label="Budget hebdomadaire en euros">
        <p class="small muted">Si ce budget ne suffit pas, l’appli vous le dira et proposera des ajustements. Les montants de cette version sont des estimations de démonstration.</p></div>`;
      case 'provisions': {
        const courants = ['pates', 'riz', 'semoule', 'farine', 'tomates_concassees', 'oeufs', 'lait', 'beurre', 'pomme_de_terre', 'oignon', 'ail', 'emmental', 'thon', 'lentilles_vertes', 'sauce_soja'].filter((id) => E.ING[id]);
        const opts = Object.fromEntries(courants.map((id) => [id, E.ING[id].nom]));
        return `<div class="stack"><label class="case"><input type="checkbox" id="placard" data-a="placard" ${p.placardBase ? 'checked' : ''}><span><strong>Placard de base</strong> : huile, sel, poivre, épices courantes, bouillon, moutarde</span></label>
          <div class="champ"><span>Autres produits déjà présents</span>${chips('provisions', opts, p.provisions, true)}</div></div>`;
      }
    }
    return '';
  }

  function setChamp(chemin, valeur) {
    const [a, b] = chemin.split('.');
    if (b) S.profil[a] = { ...S.profil[a], [b]: valeur }; else S.profil[a] = valeur;
  }
  function getChamp(chemin) { const [a, b] = chemin.split('.'); return b ? S.profil[a][b] : S.profil[a]; }

  /* ---------- profil ---------- */
  function lignesProfil(p) {
    const liste = (arr, lib, vide) => arr.length ? arr.map((k) => lib[k] || k).join(', ') : vide;
    const enfants = p.foyer.enfants.length ? ' et ' + pluriel(p.foyer.enfants.length, 'enfant') + ' (' + p.foyer.enfants.map((a) => L.ages[a]).join(', ') + ')' : '';
    const dej = p.dejeuners.mode === 'maison' ? 'Tout le monde à la maison' : `${pluriel(p.dejeuners.adultesMaison, 'adulte')} à la maison${kids(p) ? ', enfants : ' + { non: 'cantine', mercredi: 'le mercredi', oui: 'tous les jours' }[p.dejeuners.enfantsMaison] : ''}`;
    return [
      ['foyer', 'Foyer', pluriel(p.foyer.adultes, 'adulte') + enfants],
      ['objectifs', 'Objectifs', liste(p.objectifs, L.objectifs, 'Aucun en particulier') + (p.objectifs.includes('muscle') ? ` · ${p.seancesSport >= 4 ? '4+' : p.seancesSport >= 2 ? '2–3' : '1'} séance(s) de sport` : '')],
      ['regime', 'Régime', L.regime[p.regime]],
      ['allergies', 'Allergies et intolérances', p.allergiesNonRenseignees ? 'Non renseigné' : liste(p.allergies, L.allergies, 'Aucune')],
      ['temps', 'Temps de cuisine', `${p.temps.semaine} min en semaine, ${p.temps.weekend >= 90 ? 'sans limite' : p.temps.weekend + ' min'} le week-end`],
      ['niveau', 'Niveau', L.niveau[p.niveau]],
      ['equipement', 'Équipement', liste(p.equipement, L.equipement, 'Aucun')],
      ['cuisines', 'Cuisines préférées', liste(p.cuisines, L.cuisines, 'Pas de préférence')],
      ['refus', 'Aliments écartés', liste(p.refus, L.refus, 'Aucun')],
      ['dejeuners', 'Déjeuners en semaine', dej],
      ['budget', 'Budget', euros(p.budget) + ' par semaine'],
      ['provisions', 'Provisions', (p.placardBase ? 'Placard de base' : 'Pas de placard de base') + (p.provisions.length ? ' + ' + p.provisions.map((id) => E.ING[id]?.nom).filter(Boolean).join(', ') : '')]
    ];
  }

  function blocProfil(p, avecConsent) {
    const nCompat = E.recettesCompatibles(p).length;
    return `<div class="profil-grille">${lignesProfil(p).map(([id, t, v]) => `
      <div class="profil-item"><div class="spread"><span class="eyebrow">${t}</span><button class="btn-lien btn small" data-a="modifier" data-q="${id}" aria-label="Modifier : ${t}">Modifier</button></div><span>${esc(v)}</span></div>`).join('')}</div>
      <p class="small muted">${pluriel(nCompat, 'recette compatible')} avec ce profil dans la base actuelle.${nCompat < 10 ? ' C’est peu : certaines reviendront dans la semaine.' : ''}</p>
      ${avecConsent && (p.allergies.length || p.objectifs.includes('perte')) ? `<p class="small">${p.consentementSante ? '<span class="tag tag-ok">Données de santé enregistrées avec votre accord</span>' : '<span class="tag tag-simu">Données de santé non enregistrées</span>'}</p>` : ''}`;
  }

  function vueProfilValidation() {
    return `<div class="wrap"><div class="store" aria-hidden="true"></div><div class="q-shell" style="max-width:860px">
      <div class="marque">${LOGO}Budgétable</div>
      <p class="eyebrow">Votre profil alimentaire</p>
      <h1>Vérifiez avant de créer la semaine</h1>
      <p class="muted">Tout reste modifiable ensuite dans l’onglet « Profil ».</p>
      ${blocProfil(S.profil, true)}
      <section class="carte stack" style="gap:10px"><div class="spread"><h2>Le test de goût</h2><span class="tag tag-ok">1 minute</span></div>
        <p>12 plats passent à l’écran : dites « J’adore », « Pourquoi pas » ou « Pas pour moi ». Budgétable apprend vos goûts et vous propose d’abord ce que vous aimez.</p>
        <div><button class="btn btn-plein" data-a="test-go" data-depuis="profil">Faire le test de goût</button></div></section>
      <div class="q-nav"><button class="btn" data-a="q-reprendre">Revenir aux questions</button><button class="btn" data-a="valider">Passer et créer ma semaine</button></div>
    </div></div>`;
  }

  /* ---------- test de goût ---------- */
  function vueTest() {
    const t = S.test;
    if (t.i >= t.ids.length) return vueTestFin();
    const rec = E.REC[t.ids[t.i]];
    const pct = Math.round((t.i / t.ids.length) * 100);
    return `<div class="wrap"><div class="store" aria-hidden="true"></div><div class="q-shell" style="max-width:560px">
      <div class="spread"><div class="marque">${LOGO}Budgétable</div><span class="small muted num">${t.i + 1} / ${t.ids.length}</span></div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avancement du test de goût"><i style="width:${pct}%"></i></div>
      <p class="eyebrow">Test de goût</p>
      <article class="carte-test">
        <div class="carte-test-illu">${V(rec, 220)}</div>
        <div class="stack" style="gap:6px;text-align:center">
          <h1 style="font-size:1.45rem">${esc(rec.nom)}</h1>
          <p class="meta" style="justify-content:center"><span>${esc(L.cuisines[rec.cuisine] || 'Maison')}</span><span>${rec.temps} min</span><span class="part num">${euros(E.coutPortion(rec))} la part</span></p>
        </div>
      </article>
      <div class="reponses" role="group" aria-label="Votre avis sur ce plat">
        <button class="btn rep-non" data-a="test-rep" data-k="non">Pas pour moi</button>
        <button class="btn" data-a="test-rep" data-k="pourquoi">Pourquoi pas</button>
        <button class="btn btn-plein" data-a="test-rep" data-k="adore">J’adore</button>
      </div>
      <div class="row" style="justify-content:center"><button class="btn-lien btn small" data-a="test-rep" data-k="passer">Je ne sais pas, passer</button></div>
    </div></div>`;
  }

  function puces(liste, classe) { return liste.map((t) => `<span class="tag ${classe}" style="text-transform:none;letter-spacing:0;font-size:.85rem;padding:4px 10px">${esc(t)}</span>`).join(' '); }

  function blocGouts() {
    const r = E.resumeGouts(S.profil.gouts);
    if (!r.aime.length && !r.evite.length) return '<p class="muted">Pas encore de goûts enregistrés : faites le test ou parlez à l’assistant.</p>';
    return `${r.aime.length ? `<div class="stack" style="gap:6px"><span class="eyebrow">Vous aimez</span><div class="row">${puces(r.aime, 'tag-ok')}</div></div>` : ''}
      ${r.evite.length ? `<div class="stack" style="gap:6px"><span class="eyebrow">Moins pour vous</span><div class="row">${puces(r.evite, 'tag-non')}</div></div>` : ''}`;
  }

  function blocIA() {
    if (iaDispo === null) return '<p class="small muted">Recherche de l’assistant IA…</p>';
    if (!iaDispo) return `<div class="bandeau bandeau-info small"><span>L’assistant IA fonctionne dans la version en ligne de Budgétable, ouverte depuis Claude. Ici, le test de goût et vos notes suffisent à apprendre vos goûts.</span></div>`;
    const tours = S.ia.tours;
    return `<div class="chat" aria-live="polite">${tours.length ? tours.map((t) => `<p class="bulle-chat ${t.role === 'user' ? 'moi' : ''}">${esc(t.content)}</p>`).join('') : '<p class="bulle-chat">Bonjour ! Racontez-moi ce que vous aimez manger, ce que vous n’aimez pas, vos plats préférés d’enfance… Je traduis tout ça en préférences pour vos menus.</p>'}
        ${S.ia.attente ? '<p class="bulle-chat"><span class="muted">Je réfléchis…</span></p>' : ''}</div>
      ${S.ia.message ? `<p class="small" style="color:var(--tomate)">${esc(S.ia.message)}</p>` : ''}
      <label class="champ"><span class="sr">Votre message à l’assistant</span><textarea id="ia-texte" rows="3" style="min-height:80px;font-family:inherit;font-size:.95rem" placeholder="Ex. : j’adore les plats épicés et le poisson, mais les champignons, très peu pour moi."></textarea></label>
      <div class="row"><button class="btn btn-plein" data-a="ia-envoyer" ${S.ia.attente ? 'disabled' : ''}>Envoyer</button><span class="small muted">L’assistant utilise votre compte Claude ; il vous demandera votre accord la première fois.</span></div>`;
  }

  function vueTestFin() {
    return `<div class="wrap"><div class="q-shell" style="max-width:720px">
      <div class="marque">${LOGO}Budgétable</div>
      <div class="nappe" aria-hidden="true"></div>
      <p class="eyebrow">Votre palais</p>
      <h1>Merci, vos goûts sont notés</h1>
      ${blocGouts()}
      <section class="carte stack"><div class="spread"><h2>Affiner avec l’assistant goût</h2><span class="tag tag-ok">IA</span></div>${blocIA()}</section>
      <div class="q-nav"><button class="btn" data-a="test-go" data-depuis="${S.test.depuis}">Refaire le test</button><button class="btn btn-plein" data-a="test-fin">Créer ma semaine avec ces goûts</button></div>
    </div></div>`;
  }

  const ILLU_TABLE = `<svg viewBox="0 0 420 300" role="img" aria-label="Une assiette fumante sur une nappe à carreaux, à côté d’une tirelire et d’une pile de pièces">
    <defs><pattern id="vichy" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="var(--surface)"/><rect width="12" height="24" fill="var(--poireau)" opacity=".22"/><rect width="24" height="12" fill="var(--poireau)" opacity=".22"/></pattern></defs>
    <path d="M20 170 L400 170 L420 290 L0 290 Z" fill="url(#vichy)" stroke="var(--poireau)" stroke-width="2"/>
    <ellipse cx="170" cy="200" rx="104" ry="34" fill="var(--surface)" stroke="var(--encre)" stroke-width="3"/>
    <ellipse cx="170" cy="196" rx="70" ry="20" fill="var(--moutarde-pale)" stroke="var(--encre)" stroke-width="2"/>
    <circle cx="150" cy="192" r="10" fill="var(--tomate)"/><circle cx="178" cy="188" r="8" fill="var(--poireau)"/><circle cx="196" cy="198" r="9" fill="var(--moutarde)"/><circle cx="160" cy="203" r="6" fill="var(--poireau)"/>
    <path d="M150 160 q-10 -18 0 -36 q10 -18 0 -36 M172 156 q-10 -18 0 -36 q10 -18 0 -36 M194 160 q-10 -18 0 -36 q10 -18 0 -36" fill="none" stroke="var(--encre-douce)" stroke-width="3" stroke-linecap="round" opacity=".5"/>
    <path d="M52 182 v58 M44 182 v18 a8 8 0 0 0 16 0 v-18" fill="none" stroke="var(--encre)" stroke-width="4" stroke-linecap="round"/>
    <path d="M290 186 v56 M290 186 q14 6 0 30" fill="none" stroke="var(--encre)" stroke-width="4" stroke-linecap="round"/>
    <g transform="translate(300 96)">
      <ellipse cx="50" cy="44" rx="44" ry="32" fill="var(--poireau-pale)" stroke="var(--encre)" stroke-width="3"/>
      <ellipse cx="94" cy="42" rx="8" ry="10" fill="var(--poireau-pale)" stroke="var(--encre)" stroke-width="3"/>
      <path d="M68 16 l10 -14 l6 18" fill="var(--poireau-pale)" stroke="var(--encre)" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="76" cy="34" r="3" fill="var(--encre)"/><rect x="40" y="12" width="22" height="5" rx="2" fill="var(--encre)"/>
      <rect x="24" y="70" width="10" height="12" rx="3" fill="var(--encre)"/><rect x="62" y="70" width="10" height="12" rx="3" fill="var(--encre)"/>
      <path d="M6 40 q-10 -4 -6 -12 q4 -6 8 0" fill="none" stroke="var(--encre)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="51" cy="-8" r="11" fill="var(--moutarde)" stroke="var(--encre)" stroke-width="2.5"/><text x="51" y="-3.5" text-anchor="middle" font-size="13" font-weight="800" fill="var(--encre)" font-family="var(--f-titre)">€</text>
    </g>
    <g fill="var(--moutarde)" stroke="var(--encre)" stroke-width="2.5"><ellipse cx="352" cy="232" rx="22" ry="7"/><ellipse cx="352" cy="222" rx="22" ry="7"/><ellipse cx="352" cy="212" rx="22" ry="7"/></g>
  </svg>`;

  const PIED = '<nav class="pied small" aria-label="Informations légales"><a href="mentions-legales.html">Mentions légales</a><a href="confidentialite.html">Confidentialité</a><a href="conditions.html">Conditions d’utilisation</a></nav>';
  function vueAccueil() {
    return `<div class="wrap"><div class="store" aria-hidden="true"></div><div class="stack" style="max-width:980px;margin:0 auto;gap:28px">
      <div class="marque">${LOGO}Budgétable</div>
      <div class="accueil-hero">
        <div class="stack">
          <p class="eyebrow">Bien manger, petit budget</p>
          <h1>Des bons petits plats toute la semaine, sans vider le porte-monnaie</h1>
          <p class="muted">Deux minutes de questions, et Budgétable prépare vos 7 déjeuners et 7 dîners, les recettes et une liste de courses qui évite le gaspillage.</p>
          <div class="row"><button class="btn btn-plein" data-a="commencer">Préparer ma semaine</button></div>
        </div>
        <div class="stickers">${ILLU_TABLE}<span class="sticker s1">Zéro gaspi</span><span class="sticker s2">Petit budget</span><span class="sticker s3">Fait maison</span></div>
      </div>
      <div class="promesses">
        <div class="promesse"><span class="pastille verte">1</span><div><strong>${E.RECETTES.length.toLocaleString('fr-FR')} recettes pour toute la tablée</strong><p class="small muted">Un test de goût pour vous proposer d’abord ce que vous aimez.</p></div></div>
        <div class="promesse"><span class="pastille or">€</span><div><strong>Le prix de chaque assiette</strong><p class="small muted">Votre budget suivi semaine après semaine.</p></div></div>
        <div class="promesse"><span class="pastille rouge">0</span><div><strong>Zéro gaspillage</strong><p class="small muted">Les mêmes ingrédients reviennent pour finir les paquets.</p></div></div>
      </div>
      <div class="bandeau bandeau-demo small"><span class="tag tag-demo">Version de test</span><span>Les menus et listes fonctionnent réellement. Les prix sont des estimations de démonstration : aucun prix de magasin n’est encore branché.</span></div>
      ${PIED}
    </div></div>`;
  }

  /* ---------- application ---------- */
  const ONGLETS = [['semaine', 'Semaine'], ['soir', 'Ce soir'], ['courses', 'Courses'], ['drives', 'Drives'], ['profil', 'Profil']];
  function vueApp() {
    const nav = `<nav class="nav" aria-label="Navigation principale">${ONGLETS.map(([k, v]) => `<button data-a="onglet" data-k="${k}" ${S.onglet === k ? 'aria-current="page"' : ''}>${ICONES[k]}<span>${v}</span></button>`).join('')}</nav>`;
    const contenu = { semaine: ongletSemaine, soir: ongletSoir, courses: ongletCourses, drives: ongletDrives, profil: ongletProfil }[S.onglet]();
    return `<div class="wrap"><div class="store" aria-hidden="true"></div><div class="app">${nav}<main class="stack" style="min-width:0">
      <div class="ecran-seul"><div class="entete" style="margin-bottom:10px"><div class="marque">${LOGO}Budgétable</div>${S.premium ? '<span class="tag tag-ok">Premium (test)</span>' : '<span class="tag tag-simu">Formule Découverte</span>'}</div><div class="nappe" aria-hidden="true"></div></div>
      ${contenu}</main></div></div>`;
  }

  function bandeauSensible() {
    if (!S.sensibleNonEnregistre) return '';
    return `<div class="bandeau bandeau-alerte"><div class="stack" style="gap:8px"><strong>Vos allergies n’ont pas été gardées sur cet appareil</strong>
      <span class="small">Vous n’aviez pas donné votre accord pour les enregistrer. Les menus déjà créés en tenaient compte, mais les nouveaux non : renseignez-les à nouveau avant de changer un repas.</span>
      <div><button class="btn btn-petit btn-plein" data-a="modifier" data-q="allergies">Renseigner mes allergies</button></div></div></div>`;
  }

  function tirelire(niveau, ok) {
    const h = Math.max(0, Math.min(1, niveau)), y = 82 - 60 * h;
    return `<svg viewBox="0 0 120 100" role="img" aria-label="Tirelire remplie à ${Math.round(h * 100)} %">
      <defs><clipPath id="corps-tirelire"><ellipse cx="56" cy="54" rx="42" ry="30"/></clipPath></defs>
      <ellipse cx="56" cy="54" rx="42" ry="30" fill="var(--surface)"/>
      <rect x="10" y="${y}" width="100" height="${100 - y}" fill="${ok ? 'var(--poireau)' : 'var(--tomate)'}" opacity=".8" clip-path="url(#corps-tirelire)"/>
      <ellipse cx="56" cy="54" rx="42" ry="30" fill="none" stroke="var(--encre)" stroke-width="3"/>
      <ellipse cx="99" cy="52" rx="8" ry="10" fill="var(--surface)" stroke="var(--encre)" stroke-width="3"/>
      <path d="M74 27 l9 -13 l6 17" fill="var(--surface)" stroke="var(--encre)" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="82" cy="44" r="3" fill="var(--encre)"/><rect x="44" y="22" width="22" height="5" rx="2" fill="var(--encre)"/>
      <rect x="30" y="80" width="10" height="12" rx="3" fill="var(--encre)"/><rect x="68" y="80" width="10" height="12" rx="3" fill="var(--encre)"/>
      <circle class="${ok ? 'piece-qui-tombe' : ''}" cx="55" cy="10" r="8" fill="var(--moutarde)" stroke="var(--encre)" stroke-width="2"/>
    </svg>`;
  }

  function blocBudget() {
    const a = E.analyseBudget(S.plan, S.profil);
    const max = Math.max(a.estimation, a.budget) * 1.1;
    return `<section class="carte budget" aria-label="Budget de la semaine">
      <div class="spread"><h2>Budget de la semaine</h2>${tagDemo}</div>
      <div class="tirelire-bloc">${tirelire(a.ok ? Math.max(0.08, -a.ecart / a.budget) : 0, a.ok)}
        <p class="message-eco ${a.ok ? '' : 'manque'}">${a.ok ? `Il reste <b class="num">${euros(-a.ecart)}</b> dans la tirelire cette semaine` : `Il manque <b class="num">${euros(a.ecart)}</b> pour tenir le budget`}</p></div>
      <div class="chiffres"><div><span class="small muted">Courses à faire</span><br><strong class="num">${euros(a.estimation)}</strong></div>
        <div><span class="small muted">Budget</span><br><strong class="num">${euros(a.budget)}</strong></div>
        <div><span class="small muted">Réellement consommé</span><br><span class="num" style="font-weight:700;font-size:1.15rem">${euros(a.consomme)}</span></div></div>
      <div class="jauge ${a.ok ? '' : 'depasse'}" role="img" aria-label="Estimation ${euros(a.estimation)} pour un budget de ${euros(a.budget)}"><i style="width:${(a.estimation / max) * 100}%"></i><b style="left:${(a.budget / max) * 100}%"></b></div>
      ${a.ok ? `<p class="small">Dans le budget, avec ${euros(-a.ecart)} de marge. Les paquets entamés serviront les semaines suivantes.</p>`
        : `<div class="bandeau bandeau-alerte small"><div class="stack" style="gap:8px"><strong>Comment remplir la tirelire :</strong>
          <span>L’écart entre « courses à faire » et « réellement consommé » vient des paquets entiers : un sac de 2,5 kg de pommes de terre ne se finit pas en une semaine.</span>
          <ul style="margin:0;padding-left:1.1em">${a.conseils.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
          <div><button class="btn btn-petit btn-plein" data-a="ajuster">Ajuster au budget</button></div></div></div>`}
      <p class="small muted">${esc(a.source.detail)}</p></section>`;
  }

  function ligneRepas(m, j, slot) {
    const lab = slot === 'dejeuner' ? 'Déjeuner' : 'Dîner';
    if (!m) return `<div class="repas"><span class="eyebrow">${lab}</span><span class="vide">Pris dehors</span></div>`;
    const r = E.REC[m.recette];
    const note = S.notes[r.id];
    const th = m.theme && E.THEMES[m.theme];
    if (m.aChoisir) {
      const prenom = prenomDuTour();
      return `<div class="repas repas-enfants"><div class="vignette">${V(r, 64)}</div><div class="repas-corps"><span class="eyebrow">${lab} · ${prenom ? 'le choix de ' + esc(prenom) : 'le choix des enfants'}</span>
        <strong>${prenom ? `C’est au tour de ${esc(prenom)} de choisir !` : 'Les enfants choisissent le dîner'}</strong>
        <span class="small muted">Trois plats en photo, on touche celui qui fait envie. En attendant : ${esc(r.nom)}.</span>
        <div><button class="btn btn-petit btn-plein" data-a="choix" data-j="${j}" data-s="${slot}" data-enfants="1">Faire choisir</button></div></div></div>`;
    }
    const raison = E.pourquoi(r.id, S.plan, j, slot, S.profil, optsMoteur()).find((x) => !th || !x.startsWith(th.libelle));
    const classique = S.classiques.includes(r.id);
    return `<div class="repas repas-illu"><div class="vignette">${V(r, 64)}</div><div class="repas-corps"><span class="eyebrow">${lab}${th ? ` · <span class="theme">${esc(th.libelle)}</span>` : ''}${m.choisiPar ? ` · choisi par ${esc(m.choisiPar)}` : ''}</span>
      <button class="titre-repas" data-a="fiche" data-j="${j}" data-s="${slot}">${classique ? '<span class="coeur" aria-label="Classique de la famille">♥</span> ' : ''}${esc(r.nom)}</button>
      <div class="meta"><span>${r.temps} min</span><span>${nb(m.portions)} portion${m.portions > 1 ? 's' : ''}</span><span class="part num">${euros(E.coutPortion(r))} la part</span>${note ? `<span aria-label="Votre note : ${note} sur 5">${'★'.repeat(note)}</span>` : ''}</div>
      ${raison ? `<span class="pourquoi small">${esc(raison)}</span>` : ''}
      <div><button class="btn btn-petit" data-a="choix" data-j="${j}" data-s="${slot}">3 idées pour ce repas</button></div></div></div>`;
  }

  function moyenneAssiette() {
    let parts = 0;
    S.plan.jours.forEach((jp) => E.SLOTS.forEach((s) => { if (jp[s]) parts += jp[s].portions; }));
    if (!parts) return '';
    const l = E.listeCourses(S.plan, S.profil);
    return `<div class="moyenne"><span>Une assiette vous revient en moyenne à</span><strong class="num">${euros(l.consomme / parts)}</strong><span class="small muted">sur ${nb(parts)} parts adultes cette semaine · prix démo</span></div>`;
  }

  function ongletSemaine() {
    if (!S.plan) return '<p>Aucune semaine.</p>';
    const t = aujourdhui();
    const restants = S.premium ? 'Remplacements illimités' : `${Math.max(0, LIMITE_GRATUITE - S.plan.remplacements)} remplacement(s) gratuit(s) restant(s) cette semaine`;
    return `${bandeauSensible()}
      <div class="ardoise ardoise-titre"><span class="craie-petit">Au menu cette semaine</span><h1 class="craie">7 déjeuners, 7 dîners</h1><span class="craie-ligne">fait maison, petit prix, zéro gaspi</span></div>
      <div class="row ecran-seul"><button class="btn" data-a="nouvelle">Nouvelle semaine</button></div>
      ${S.plan.alertes.map((a) => `<div class="bandeau bandeau-demo small">${esc(a)}</div>`).join('')}
      ${blocBudget()}
      ${moyenneAssiette()}
      ${suggestionRituels()}
      <p class="small muted">Touchez un plat pour la recette et pour le noter, ou « 3 idées » pour choisir autre chose.</p>
      <div class="jours">${S.plan.jours.map((jp, j) => `<article class="jour ${j === t ? 'aujourdhui' : ''}" data-j="${j}"><header><h3>${jp.jour}</h3>${j === t ? '<span class="tag tag-ok">Aujourd’hui</span>' : ''}</header>
        ${ligneRepas(jp.dejeuner, j, 'dejeuner')}${ligneRepas(jp.diner, j, 'diner')}</article>`).join('')}</div>
      ${carteRituels()}
      <p class="small muted">${restants}.</p>`;
  }

  /* ---------- rituels de la semaine, classiques, prénoms des enfants ---------- */
  function suggestionRituels() {
    const p = S.profil;
    if (p.rituels || S.rituelsVus) return '';
    const sug = E.rituelsSuggeres(p);
    const texte = Object.entries(sug).sort((a, b) => a[0] - b[0]).map(([j, t]) => `${E.JOURS[j].toLowerCase()} : ${E.THEMES[t].libelle.toLowerCase()}`).join(' · ');
    return `<div class="idee-rituels"><div class="stack" style="gap:6px"><strong>Et si on se créait des rituels ?</strong>
      <span class="small">Des rendez-vous qu’on attend avec plaisir : ${esc(texte)}. Le reste de la semaine reste libre.</span>
      <div class="row"><button class="btn btn-petit btn-plein" data-a="rituels-oui">Essayer ces rituels</button><button class="btn btn-petit" data-a="rituels-non">Non merci</button></div></div></div>`;
  }
  function optionsTheme(j, actuel) {
    const p = S.profil;
    const ids = ['pates', 'pizza', 'mijote', 'soupe', 'monde', 'vege', 'poisson', 'oeufs', 'rapide']
      .concat(p.foyer.enfants.length ? ['enfants'] : []).concat(S.classiques.length ? ['classique'] : []);
    return `<option value="">Libre</option>` + ids.map((t) => `<option value="${t}" ${actuel === t ? 'selected' : ''}>${esc(E.THEMES[t].libelle)}</option>`).join('');
  }
  function carteRituels() {
    const p = S.profil, r = p.rituels || {};
    const nEnfants = p.foyer.enfants.length;
    const prenoms = p.prenomsEnfants || [];
    return `<details class="carte rituels" ${S.rituelsOuverts ? 'open' : ''}><summary data-a="rituels-ouvrir"><strong>Nos rituels et nos classiques</strong> <span class="small muted">· soirées à thème, plats préférés${nEnfants ? ', choix des enfants' : ''}</span></summary>
      <div class="stack" style="gap:14px;margin-top:12px">
        <div class="stack" style="gap:8px"><h3>Les dîners à thème</h3>
          <div class="grille-rituels">${E.JOURS.map((jn, j) => `<label class="champ"><span>${jn}</span><select data-a="rituel" data-j="${j}">${optionsTheme(j, r[j])}</select></label>`).join('')}</div>
          ${S.rituelsModifies ? '<div><button class="btn btn-plein btn-petit" data-a="rituels-appliquer">Refaire la semaine avec ces rituels</button></div>' : ''}
        </div>
        ${nEnfants ? `<div class="stack" style="gap:8px"><h3>Le choix des enfants</h3>
          <p class="small muted">Le soir « Le choix des enfants », c’est un enfant qui choisit le dîner parmi 3 plats en photo, chacun son tour d’une semaine à l’autre. Prénoms facultatifs, gardés sur cet appareil.</p>
          <div class="row">${Array.from({ length: nEnfants }, (_, i) => `<label class="champ" style="max-width:160px"><span>Enfant ${i + 1}</span><input type="text" maxlength="20" data-a="prenom" data-i="${i}" value="${esc(prenoms[i] || '')}" placeholder="Prénom"></label>`).join('')}</div></div>` : ''}
        <div class="stack" style="gap:8px"><h3>Nos classiques ${S.classiques.length ? `(${S.classiques.length})` : ''}</h3>
          <p class="small muted">Les valeurs sûres de la famille : deux reviennent chaque semaine, entre les découvertes. Ajoutez-en avec le cœur dans une recette (ou en lui donnant 5 étoiles).</p>
          ${S.classiques.length ? `<div class="row">${S.classiques.filter((id) => E.REC[id]).map((id) => `<span class="tag tag-classique">♥ ${esc(E.REC[id].nom)} <button class="btn-lien" data-a="classique" data-r="${id}" aria-label="Retirer ${esc(E.REC[id].nom)} des classiques">✕</button></span>`).join('')}</div>` : '<p class="small">Aucun classique pour l’instant.</p>'}
        </div>
      </div></details>`;
  }

  /* ---------- fenêtre « 3 idées pour ce repas » (et choix des enfants) ---------- */
  function ouvrirChoix(j, slot, enfants) {
    choix = { jour: j, slot, enfants: !!enfants, exclure: [], tour: 0, idees: [] };
    choix.idees = E.propositions(S.plan, j, slot, S.profil, optsMoteur());
  }
  function vueChoix() {
    if (!choix || !S.plan) return '';
    const m = S.plan.jours[choix.jour][choix.slot];
    if (!m) return '';
    const ids = [m.recette, ...choix.idees];
    const enf = choix.enfants, prenom = prenomDuTour();
    const titre = enf ? (prenom ? `À toi de choisir, ${esc(prenom)} !` : 'Les enfants choisissent le dîner !')
      : `${choix.slot === 'diner' ? 'Dîner' : 'Déjeuner'} du ${E.JOURS[choix.jour].toLowerCase()} : qu’est-ce qui vous ferait plaisir ?`;
    const th = m.theme && E.THEMES[m.theme] && m.theme !== 'enfants' ? E.THEMES[m.theme].libelle : '';
    const cartes = ids.map((id, i) => {
      const r = E.REC[id];
      const raisons = enf ? [] : E.pourquoi(id, S.plan, choix.jour, choix.slot, S.profil, optsMoteur());
      const actuel = i === 0 && !enf && !m.aChoisir;
      return `<article class="choix-carte ${actuel ? 'actuel' : ''} ${enf ? 'enfant' : ''}">
        ${V(r, enf ? 220 : 160, 'rect')}
        <div class="stack" style="gap:6px;padding:12px 14px 14px">
          ${actuel ? '<span class="tag tag-ok">Prévu</span>' : ''}
          <h3>${esc(r.nom)}</h3>
          <div class="meta"><span>${r.temps} min</span><span class="part num">${euros(E.coutPortion(r))} la part</span></div>
          ${raisons.length ? `<ul class="raisons">${raisons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          <div class="row"><button class="btn ${actuel ? '' : 'btn-plein'}" data-a="choisir" data-r="${id}">${enf ? 'Celui-là !' : actuel ? 'Garder ce plat' : 'Je choisis ce plat'}</button>
          ${enf ? '' : `<button class="btn-lien small" data-a="fiche-r" data-r="${id}">La recette</button>`}</div>
        </div></article>`;
    }).join('');
    const reste = S.premium ? '' : ` (${Math.max(0, LIMITE_GRATUITE - S.plan.remplacements)} restante${LIMITE_GRATUITE - S.plan.remplacements > 1 ? 's' : ''})`;
    return `<div class="voile" data-a="fermer-choix-fond"><div class="fiche fenetre-choix" role="dialog" aria-modal="true" aria-labelledby="choix-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px">${th ? `<span class="eyebrow">${esc(th)}</span>` : ''}<h2 id="choix-titre">${titre}</h2></div>
        <button class="btn btn-petit" data-a="fermer-choix" aria-label="Fermer">Fermer</button></div>
      <div class="grille-choix ${enf ? 'enfants' : ''}">${cartes}</div>
      ${enf ? '' : `<div class="row"><button class="btn" data-a="autres-idees">Encore d’autres idées${reste}</button><span class="small muted">Le budget et la liste de courses se mettent à jour tout seuls.</span></div>`}
    </div></div>`;
  }

  const CLOCHE = `<svg class="cloche" viewBox="0 0 120 90" aria-hidden="true"><ellipse cx="60" cy="78" rx="54" ry="8" fill="#fbfaf3" opacity=".9"/><path d="M14 74a46 46 0 0 1 92 0z" fill="#d9dcd6" stroke="#fbfaf3" stroke-width="3"/><path d="M30 52a32 32 0 0 1 22-20" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/><circle cx="60" cy="24" r="6" fill="#d9dcd6" stroke="#fbfaf3" stroke-width="3"/></svg>`;

  function ongletSoir() {
    const r = E.ceSoir(S.plan, S.profil, aujourdhui(), optsMoteur());
    if (!S.ceSoirOuvert) {
      return `<section class="ce-soir ardoise">${CLOCHE}<h1>Qu’est-ce qu’on mange ce soir ?</h1><button class="btn" data-a="ce-soir">Soulever la cloche</button></section>`;
    }
    const prevu = r.prevu ? E.REC[r.prevu.recette] : null;
    return `<section class="ce-soir ardoise"><p class="craie-petit">Ce soir, ${E.JOURS[aujourdhui()].toLowerCase()}</p>
        ${prevu ? `<div style="border-radius:50%;background:#fbfaf3;padding:8px">${V(prevu, 170)}</div><p class="reponse">${esc(prevu.nom)}</p><p>${prevu.temps} min · ${nb(r.prevu.portions)} portions · déjà dans votre liste</p>
          <button class="btn" data-a="fiche" data-j="${aujourdhui()}" data-s="diner">Voir la recette</button>` : '<p class="reponse">Rien de prévu ce soir</p>'}
      </section>
      <section class="stack"><h2>Pas envie ? Trois idées en 20 minutes</h2>
        <div class="jours">${r.idees.map((i) => { const rec = E.REC[i.recette]; return `<article class="jour"><div class="repas repas-illu"><div class="vignette">${V(rec, 64)}</div><div class="repas-corps"><button class="titre-repas" data-a="fiche-r" data-r="${rec.id}">${esc(rec.nom)}</button>
          <div class="meta"><span>${rec.temps} min</span><span>${i.manquants ? pluriel(i.manquants, 'produit') + ' à acheter' : 'Tout est déjà dans votre liste'}</span></div></div></div></article>`; }).join('')}</div></section>`;
  }

  /* ---------- liens vers les drives (recherche publique de chaque site, sans données récupérées) ----------
   * verifie : adresse de recherche testée le 20/10/2026. Les autres sont à confirmer en cliquant. */
  const DRIVES = {
    carrefour: { nom: 'Carrefour', url: (q) => `https://www.carrefour.fr/s?q=${encodeURIComponent(q)}`, accueil: 'https://www.carrefour.fr/', verifie: true },
    leclerc: { nom: 'E.Leclerc', url: (q) => `https://www.e.leclerc/recherche?q=${encodeURIComponent(q)}`, accueil: 'https://www.leclercdrive.fr/', verifie: false, note: 'Choisissez votre magasin sur le site pour voir ses prix.' },
    auchan: { nom: 'Auchan', url: (q) => `https://www.auchan.fr/recherche?text=${encodeURIComponent(q)}`, accueil: 'https://www.auchan.fr/', verifie: true },
    intermarche: { nom: 'Intermarché', url: (q) => `https://www.intermarche.com/recherche/${encodeURIComponent(q)}`, accueil: 'https://www.intermarche.com/', verifie: false },
    coursesu: { nom: 'Courses U', url: (q) => `https://www.coursesu.com/recherche?q=${encodeURIComponent(q)}`, accueil: 'https://www.coursesu.com/', verifie: true },
    chronodrive: { nom: 'Chronodrive', url: () => 'https://www.chronodrive.com/', accueil: 'https://www.chronodrive.com/', verifie: true, note: 'Utilisez la recherche du site Chronodrive : sa recherche directe n’accepte pas les liens.' }
  };
  // les enseignes de « mes drives » d'abord, avec la ville du magasin choisi
  function enseignesOrdonnees() {
    const r = S.drives.recherche, choisis = S.drives.choisis || [];
    const lieux = {};
    if (r && r.magasins) r.magasins.filter((m) => choisis.includes(m.id)).forEach((m) => { if (!lieux[m.enseigne]) lieux[m.enseigne] = m.ville || `à ${nb(m.distanceKm)} km`; });
    return Object.entries(DRIVES).map(([k, d]) => [k, d, lieux[k]]).sort((a, b) => (b[2] ? 1 : 0) - (a[2] ? 1 : 0));
  }
  const termeRecherche = (nom) => nom.replace(/\(.*?\)/g, '').replace(/\d+\s*%/g, '').replace(/Œ/g, 'Oe').replace(/œ/g, 'oe').replace(/\s+/g, ' ').trim().toLowerCase();

  function exportExtension(liste) {
    const articles = liste.articles.filter((a) => !a.enStock).map((a) => ({ id: a.id, nom: a.nom, recherche: termeRecherche(a.nom), unite: a.unite, besoin: quantite(a.quantite, a.unite), conditionnements: a.conditionnements, condLabel: a.condLabel }));
    return 'BUDGETABLE1:' + JSON.stringify({ date: new Date().toISOString().slice(0, 10), articles });
  }

  // L'extension Budgétable, si elle est installée, se signale sur la page (data-budgetable-extension)
  // et reçoit la liste directement. Sinon : copie dans le presse-papiers, à coller dans l'extension.
  function envoyerExtension(texte) {
    const absente = async () => {
      let copie = false;
      try { await navigator.clipboard.writeText(texte); copie = true; } catch (e) { /* copie refusée */ }
      S.envoiExt = { etat: 'absente', copie };
      toast('Extension Budgétable non détectée');
      rendre();
    };
    if (!document.documentElement.dataset.budgetableExtension) { absente(); return; }
    const fin = setTimeout(() => { window.removeEventListener('message', reponse); absente(); }, 3000);
    function reponse(ev) {
      if (ev.source !== window || !ev.data || !/^budgetable:liste-(recue|erreur)$/.test(ev.data.type)) return;
      clearTimeout(fin); window.removeEventListener('message', reponse);
      if (ev.data.type === 'budgetable:liste-recue') { S.envoiExt = { etat: 'ok', n: ev.data.n }; toast(`Liste envoyée à l’extension (${ev.data.n} articles)`); }
      else { S.envoiExt = { etat: 'erreur', message: ev.data.message }; toast('L’extension a refusé la liste'); }
      rendre();
    }
    window.addEventListener('message', reponse);
    window.postMessage({ type: 'budgetable:liste', texte }, location.origin);
  }

  function etatEnvoiExtension() {
    const e = S.envoiExt;
    if (!e) return '';
    if (e.etat === 'ok') return `<div class="bandeau bandeau-ok small" role="status"><span><strong>Liste envoyée à l’extension : ${e.n} articles.</strong> Ouvrez votre drive dans ce navigateur : le panneau Budgétable vous y attend, en bas à droite.</span></div>`;
    if (e.etat === 'erreur') return `<div class="bandeau bandeau-alerte small" role="status"><span>L’extension a refusé la liste : ${esc(e.message)}</span></div>`;
    return `<div class="bandeau bandeau-alerte small" role="status"><div class="stack" style="gap:6px"><strong>L’extension Budgétable n’est pas détectée dans ce navigateur.</strong>
      <span>Elle s’installe en 2 minutes sur ordinateur, dans Chrome ou Edge (pas sur téléphone). ${e.copie ? 'En attendant, la liste a été copiée : vous pouvez la coller dans l’extension.' : ''}</span>
      <div><a class="btn btn-petit btn-plein" href="extension.html" target="_blank" rel="noopener">Installer l’extension</a></div></div></div>`;
  }

  function listeTexte(liste) {
    const par = {};
    liste.articles.filter((a) => !a.enStock).forEach((a) => { (par[a.rayon] = par[a.rayon] || []).push(a); });
    return Object.entries(par).map(([r, as]) => `${r.toUpperCase()}\n` + as.map((a) => `- ${a.nom} : ${quantite(a.quantite, a.unite)} (${a.conditionnements} × ${a.condLabel})`).join('\n')).join('\n\n');
  }

  function ongletCourses() {
    const liste = E.listeCourses(S.plan, S.profil);
    const par = {};
    liste.articles.forEach((a) => { (par[a.rayon] = par[a.rayon] || []).push(a); });
    const imprimerDispo = !DANS_UN_CADRE && typeof window.print === 'function';
    return `<div class="spread"><div><p class="eyebrow">Liste de courses</p><h1>Pour la semaine</h1></div>
      <div class="row ecran-seul">
        <button class="btn" data-a="copier-liste">Copier la liste</button>
        <button class="btn" data-a="export-extension">Envoyer vers l’extension</button>
        <button class="btn" data-a="imprimable">${S.imprimable ? 'Quitter la version imprimable' : 'Version imprimable'}</button>
        ${imprimerDispo ? '<button class="btn btn-plein" data-a="imprimer">Imprimer ou PDF</button>' : ''}
      </div>${etatEnvoiExtension()}</div>
      ${S.imprimable && !imprimerDispo ? '<p class="bandeau bandeau-info small ecran-seul">Pour obtenir un PDF, ouvrez Budgétable installé sur votre appareil et utilisez « Imprimer ou PDF ». Ici, la version imprimable sert d’aperçu.</p>' : ''}
      <section class="carte stack ecran-seul" style="gap:12px"><div class="spread"><h2>Remplir mon panier drive</h2>${S.drives.enseigne ? `<a class="btn btn-petit" href="${DRIVES[S.drives.enseigne].accueil}" target="_blank" rel="noopener">Ouvrir ${esc(DRIVES[S.drives.enseigne].nom)} ↗</a>` : ''}</div>
        <p class="small">Choisissez votre drive : chaque article aura un bouton qui ouvre sa recherche sur le site du drive. Vous comparez et ajoutez au panier vous-même, puis vous validez votre commande chez eux.</p>
        <p class="small">Plus rapide sur ordinateur : avec l’<a href="extension.html" target="_blank" rel="noopener">extension Budgétable</a>, votre liste vous suit sur le site du drive et les prix les plus bas sont repérés pour vous.</p>
        <div class="choix" role="radiogroup" aria-label="Mon drive">${enseignesOrdonnees().map(([k, d, lieu]) => `<button class="chip" role="radio" data-a="enseigne" data-k="${k}" aria-pressed="${S.drives.enseigne === k}" aria-checked="${S.drives.enseigne === k}">${esc(d.nom)}${lieu ? ` <span class="small muted">· ${esc(lieu)}</span>` : ''}</button>`).join('')}</div>
        ${S.drives.enseigne && DRIVES[S.drives.enseigne].note ? `<p class="small muted">${esc(DRIVES[S.drives.enseigne].note)}</p>` : ''}
        ${S.drives.enseigne && !DRIVES[S.drives.enseigne].verifie ? '<p class="small muted">Lien de recherche pas encore vérifié pour ce site : s’il n’affiche pas le bon produit, dites-le-nous.</p>' : ''}
      </section>
      <div class="ticket"><div class="ticket-tete"><strong>Budgétable</strong><span class="small muted">Liste de la semaine · ${new Date().toLocaleDateString('fr-FR')}</span><span>${tagDemo}</span></div>
      <div class="colonnes">${Object.entries(par).map(([rayon, as]) => `<section class="rayon"><h3><span>${esc(rayon)}</span><span class="num small muted">${euros(as.filter((a) => !a.enStock).reduce((s, a) => s + a.cout, 0))}</span></h3>
        ${as.map((a) => `<div class="article ${S.coches[a.id] ? 'coche' : ''} ${a.enStock ? 'stock' : ''}">
          <input type="checkbox" id="c-${a.id}" data-a="cocher" data-id="${a.id}" ${S.coches[a.id] ? 'checked' : ''} ${a.enStock ? 'disabled' : ''} aria-label="Acheté : ${esc(a.nom)}">
          <label class="nom" for="c-${a.id}">${esc(a.nom)}</label>
          <span class="prix num">${a.enStock ? 'En réserve' : euros(a.cout)}</span>
          <div class="detail"><span>Besoin : ${quantite(a.quantite, a.unite)}</span><span>Acheter : ${a.conditionnements} × ${esc(a.condLabel)}</span>
          <button class="btn-lien btn small ecran-seul" data-a="stock" data-id="${a.id}">${a.enStock ? 'Je n’en ai plus' : 'J’en ai déjà'}</button>
          ${S.drives.enseigne && !a.enStock ? `<a class="btn btn-petit ecran-seul" href="${DRIVES[S.drives.enseigne].url(termeRecherche(a.nom))}" target="_blank" rel="noopener" aria-label="Chercher ${esc(a.nom)} chez ${esc(DRIVES[S.drives.enseigne].nom)} (nouvel onglet)">Chercher chez ${esc(DRIVES[S.drives.enseigne].nom)} ↗</a>` : ''}</div></div>`).join('')}</section>`).join('')}</div>
      ${liste.economieStock > 0 ? `<p class="small" style="padding-top:12px">Grâce à vos réserves : <strong class="num">${euros(liste.economieStock)}</strong> économisés</p>` : ''}
      <div class="ticket-total"><span>Total estimé</span><span class="num">${euros(liste.total)}</span></div></div>`;
  }

  function blocMesDrives() {
    const d = S.drives, r = d.recherche;
    const choisis = d.choisis || [];
    let liste = '';
    if (r && r.magasins) {
      liste = r.magasins.length ? `<p class="small">${pluriel(r.magasins.length, 'drive')} autour de ${esc(r.centre.nom)} (${esc(r.centre.codePostal || '')}), dans un rayon de ${d.rayon} km · recherche du ${new Date(r.date).toLocaleDateString('fr-FR')}</p>
        <div class="liste-magasins">${r.magasins.map((m) => {
          const site = DRIVES[m.enseigne];
          return `<label class="magasin"><input type="checkbox" data-a="choisir-magasin" data-id="${esc(m.id)}" ${choisis.includes(m.id) ? 'checked' : ''}>
            <span class="magasin-corps"><strong>${esc(m.nom)}</strong><span class="small muted">${m.ville ? esc(m.ville) + ' · ' : ''}${nb(m.distanceKm)} km · trajet aller-retour ≈ ${euros(window.Magasins.coutTrajet(m.distanceKm, +d.conso, +d.carburant))} · <a href="${esc(m.carte)}" target="_blank" rel="noopener">voir sur la carte</a></span></span>
            <span class="tag ${m.drive === 'confirmé' ? 'tag-ok' : 'tag-simu'}">${m.drive === 'confirmé' ? 'Drive' : 'Drive probable'}</span>
            ${site ? `<a class="btn btn-petit" href="${site.accueil}" target="_blank" rel="noopener">Site ↗</a>` : '<span class="small muted">site non pris en charge</span>'}</label>`;
        }).join('')}</div>
        <p class="small muted">${esc(r.sources)} « Drive probable » : magasin d’une enseigne qui propose le drive ; vérifiez sur son site. Trajet calculé avec ${nb(+d.conso)} L/100 km et ${euros(+d.carburant)} le litre (à régler plus bas).</p>`
        : `<p>Aucun drive trouvé dans ce rayon. Agrandissez-le.</p>`;
    }
    return `<section class="carte stack"><div class="spread"><h2>Mes drives près de chez moi</h2><span class="tag tag-ok">Données ouvertes</span></div>
      <div class="form-grille">
        <label class="champ"><span>Commune ou code postal</span><input type="text" id="d-cp" data-a="drive-champ" data-k="cp" value="${esc(d.cp)}" placeholder="Ex. 62440 ou Harnes" autocomplete="postal-code"></label>
        <label class="champ"><span>Rayon : <output class="num">${d.rayon} km</output></span><input class="range" type="range" id="d-rayon" min="2" max="30" step="1" value="${d.rayon}" data-a="drive-champ" data-k="rayon"></label>
      </div>
      <div class="row"><button class="btn btn-plein" data-a="chercher-drives" ${S.rechercheDrives === 'cours' ? 'disabled' : ''}>${S.rechercheDrives === 'cours' ? 'Recherche…' : 'Trouver les drives'}</button>
        ${choisis.length ? `<span class="small">${pluriel(choisis.length, 'drive choisi', 'drives choisis')} : ils apparaîtront dans vos courses.</span>` : ''}</div>
      ${S.rechercheErreur ? `<p class="small" style="color:var(--tomate)">${esc(S.rechercheErreur)}</p>` : ''}
      ${liste}</section>`;
  }

  async function chercherDrives() {
    const lieu = (S.drives.cp || '').trim();
    if (!lieu) { S.rechercheErreur = 'Indiquez une commune ou un code postal.'; rendre(); return; }
    S.rechercheDrives = 'cours'; S.rechercheErreur = ''; rendre();
    try {
      S.drives.recherche = await window.Magasins.chercherDrives(lieu, +S.drives.rayon);
      const ids = S.drives.recherche.magasins.map((m) => m.id);
      S.drives.choisis = (S.drives.choisis || []).filter((id) => ids.includes(id));
    } catch (e) {
      S.rechercheErreur = e instanceof TypeError
        ? 'Recherche impossible ici : elle a besoin d’Internet. Elle fonctionne dans le fichier Budgetable.html et sur le site en ligne, pas dans l’aperçu Claude.'
        : (e.message || 'La recherche a échoué. Réessayez.');
    }
    S.rechercheDrives = '';
    rendre();
  }

  function ongletDrives() {
    const d = S.drives;
    const liste = E.listeCourses(S.plan, S.profil);
    const res = E.optimiserDrives(liste.articles, E.magasinsDemo(), { mode: d.mode, consoL100: +d.conso, prixCarburant: +d.carburant });
    const autre = E.optimiserDrives(liste.articles, E.magasinsDemo(), { mode: d.mode === 'minimum' ? 'compromis' : 'minimum', consoL100: +d.conso, prixCarburant: +d.carburant });
    return `<div><p class="eyebrow">Comparateur de drives</p><h1>Où faire les courses ?</h1></div>
      ${blocMesDrives()}
      <div class="bandeau bandeau-info small"><div class="stack" style="gap:6px"><strong>Et les prix de vos drives ?</strong>
        <span>Les enseignes ne publient pas leurs prix pour d’autres sites. L’extension Budgétable pour Chrome les lit pour vous, sur votre compte, pendant que vous faites vos courses en ligne, et vous dit dans quel drive prendre chaque produit. Le transfert automatique du panier n’existe pas.</span></div></div>
      <section class="carte stack"><div class="spread"><h2>Simulateur</h2><span class="tag tag-demo">Magasins fictifs</span></div>
        <p class="small muted">Pour voir le calcul « un panier par drive » : les magasins et leurs prix sont inventés.</p>
        <div class="form-grille">
          <label class="champ"><span>Consommation (L/100 km)</span><input type="number" id="d-conso" step="0.1" min="2" max="15" value="${d.conso}" data-a="drive-champ" data-k="conso"></label>
          <label class="champ"><span>Prix du carburant (€/L) <span class="tag tag-demo">démo</span></span><input type="number" id="d-carbu" step="0.01" min="0.5" max="4" value="${d.carburant}" data-a="drive-champ" data-k="carburant"></label>
        </div>
        <div class="choix" role="radiogroup" aria-label="Mode de calcul">
          <button class="chip" role="radio" data-a="drive-mode" data-k="minimum" aria-pressed="${d.mode === 'minimum'}" aria-checked="${d.mode === 'minimum'}">Prix minimum</button>
          <button class="chip" role="radio" data-a="drive-mode" data-k="compromis" aria-pressed="${d.mode === 'compromis'}" aria-checked="${d.mode === 'compromis'}">Meilleur compromis</button>
        </div>
        <p class="small muted">${d.mode === 'minimum' ? 'Le total le plus bas, même s’il faut passer dans plusieurs drives.' : 'Chaque drive en plus doit faire gagner au moins 5 € pour valoir le détour.'}</p>
        ${res ? `<div class="chiffres"><div><span class="small muted">Total trajets compris</span><br><strong class="num">${euros(res.total)}</strong></div>
          <div class="small"><span class="num">${euros(res.produits)}</span> de produits · <span class="num">${euros(res.frais)}</span> de frais · <span class="num">${euros(res.trajet)}</span> de carburant</div></div>
          ${autre ? `<p class="small">En mode « ${d.mode === 'minimum' ? 'meilleur compromis' : 'prix minimum'} » : ${euros(autre.total)} avec ${pluriel(autre.magasins.length, 'drive')}.</p>` : ''}
          ${res.manquant.length ? `<p class="small">Introuvable : ${esc(res.manquant.join(', '))}.</p>` : ''}
          <div class="colonnes">${res.magasins.map((m) => `<section class="rayon"><h3><span>${esc(m.nom)}</span><span class="num small">${euros(m.sousTotal)}</span></h3>
            ${m.articles.map((a) => `<div class="article" style="grid-template-columns:1fr auto"><span>${esc(a.nom)}</span><span class="prix num">${euros(a.cout)}</span></div>`).join('')}
            <p class="small muted" style="padding-top:6px">Données de démonstration · générées le 20/10/2026</p></section>`).join('')}</div>` : '<p>Aucun résultat.</p>'}
      </section>`;
  }

  function ongletProfil() {
    const exportJson = JSON.stringify({ profil: S.profil, notes: S.notes, plan: S.plan }, null, 2);
    return `<div><p class="eyebrow">Profil</p><h1>Votre foyer et vos données</h1></div>
      <section class="stack"><h2>Profil alimentaire</h2>${blocProfil(S.profil, true)}</section>
      <section class="carte stack"><div class="spread"><h2>Vos goûts</h2><div class="row"><button class="btn btn-petit btn-plein" data-a="test-go" data-depuis="app">Faire le test de goût</button><button class="btn btn-petit" data-a="gouts-effacer">Effacer mes goûts</button></div></div>
        ${blocGouts()}<p class="small muted">Vos notes de recettes affinent aussi vos goûts.</p></section>
      <section class="carte stack"><div class="spread"><h2>Assistant goût</h2><span class="tag tag-ok">IA</span></div>${blocIA()}</section>
      ${window.Photos ? `<details class="carte"><summary><strong>Crédits photos</strong> <span class="small muted">· photos d’illustration sous licence libre, via Wikimedia Commons</span></summary>
        <ul class="credits">${window.Photos.credits().map((ph) => `<li><a href="${esc(ph.page)}" target="_blank" rel="noopener">${esc(decodeURIComponent(ph.page.split('File:')[1]).replace(/_/g, ' '))}</a> — ${esc(ph.auteur)} — ${ph.licenceUrl ? `<a href="${esc(ph.licenceUrl)}" target="_blank" rel="noopener">${esc(ph.licence)}</a>` : esc(ph.licence)}</li>`).join('')}</ul></details>` : ''}
      <section class="stack"><div class="spread"><h2>Formules</h2><span class="tag tag-simu">Aucun paiement</span></div>
        <div class="offres">
          <div class="offre ${S.premium ? '' : 'active'}"><span class="eyebrow">Découverte</span><span class="prix-offre">Gratuit</span>
            <ul><li>Une semaine de menus à la fois</li><li>${LIMITE_GRATUITE} remplacements de repas par semaine</li><li>Liste de courses et budget estimé</li></ul></div>
          <div class="offre ${S.premium ? 'active' : ''}"><span class="eyebrow">Premium</span><span class="prix-offre num">4,99 €<span class="small muted" style="font:500 .9rem var(--f-texte)"> / mois (indicatif)</span></span>
            <ul><li>Remplacements illimités</li><li>Ajustement automatique au budget</li><li>Comparaison des drives, dès que les vrais prix seront disponibles</li></ul>
            <label class="case"><input type="checkbox" id="premium-test" data-a="premium" ${S.premium ? 'checked' : ''}><span>Activer Premium en mode test (aucun paiement : Stripe sera branché plus tard)</span></label></div>
        </div></section>
      <section class="stack"><div class="spread"><h2>Compte</h2><span class="tag tag-simu">Simulé</span></div>
        <p>${S.compteLocal ? 'Compte local actif : vos préférences sont gardées <strong>sur cet appareil</strong>.' : 'Vos préférences sont gardées sur cet appareil uniquement.'} Les vrais comptes (connexion par e-mail, plusieurs appareils) arrivent à l’étape 3.</p></section>
      <section class="stack"><h2>Mes données</h2>
        <label class="case"><input type="checkbox" id="consent-profil" data-a="consent" ${S.profil.consentementSante ? 'checked' : ''}><span>Enregistrer mes allergies et objectifs de santé sur cet appareil</span></label>
        <div class="champ"><span>Export de vos données (format JSON)</span><textarea id="export" readonly aria-label="Export JSON de vos données">${esc(exportJson)}</textarea></div>
        <div class="row"><button class="btn" data-a="copier-export">Copier l’export</button>
          ${S.confirmerSuppression ? '<span class="small">Tout effacer sur cet appareil ? Cette action est définitive.</span><button class="btn btn-petit" data-a="suppr-non">Annuler</button><button class="btn btn-petit" style="border-color:var(--tomate);color:var(--tomate)" data-a="suppr-oui">Oui, tout effacer</button>' : '<button class="btn" data-a="supprimer">Supprimer toutes mes données</button>'}</div>
      </section>
      ${PIED}`;
  }

  /* ---------- fiche recette ---------- */
  // nom simplifié pour une recherche externe : « Poêlée de courgettes au poulet, façon provençale » → « poêlée de courgettes au poulet »
  function termeMarmiton(nom) {
    return String(nom).split(/,| façon | aux épices/)[0].replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
  }
  function cleFiche() { return fiche ? (fiche.recette || fiche.jour + '-' + fiche.slot) : ''; }

  const QUESTIONS_CHEF = ['Il me manque un ingrédient', 'Comment savoir si c’est cuit ?', 'Une version que les enfants aimeront', 'Que faire des restes ?'];
  function blocChef(r, portions) {
    if (iaDispo === null) return '<p class="small muted">Recherche de l’assistant IA…</p>';
    if (!iaDispo) return '<p class="small muted">Dans la version en ligne de Budgétable, ouverte depuis Claude, un commis IA répond ici à vos questions pendant que vous cuisinez : ingrédient manquant, cuisson, version pour les enfants, restes…</p>';
    const c = chef && chef.cle === cleFiche() ? chef : { tours: [], attente: false, message: '' };
    return `<div class="chat" aria-live="polite">${c.tours.length ? c.tours.map((t) => `<p class="bulle-chat ${t.role === 'user' ? 'moi' : ''}">${esc(t.content)}</p>`).join('') : `<p class="bulle-chat">Je suis là pendant que vous cuisinez ${esc(r.nom.charAt(0).toLowerCase() + r.nom.slice(1))} pour ${nb(portions)} portion${portions > 1 ? 's' : ''}. Une question ?</p>`}
        ${c.attente ? '<p class="bulle-chat"><span class="muted">Je regarde la recette…</span></p>' : ''}</div>
      ${c.message ? `<p class="small" style="color:var(--tomate)">${esc(c.message)}</p>` : ''}
      ${c.tours.length ? '' : `<div class="row" style="gap:6px">${QUESTIONS_CHEF.map((q) => `<button class="btn btn-petit" data-a="chef-question" data-q="${esc(q)}" ${c.attente ? 'disabled' : ''}>${esc(q)}</button>`).join('')}</div>`}
      <label class="champ"><span class="sr">Votre question au commis</span><input id="chef-texte" type="text" maxlength="500" placeholder="Ex. : je n’ai pas de crème, je mets quoi ?" autocomplete="off"></label>
      <div class="row"><button class="btn btn-plein btn-petit" data-a="chef-envoyer" ${c.attente ? 'disabled' : ''}>Demander</button><span class="small muted">Réponses générées par IA : en cas de doute sur une allergie, fiez-vous à l’étiquette des produits.</span></div>`;
  }

  function vueFiche() {
    if (!fiche) return '';
    const m = fiche.recette ? { recette: fiche.recette, portions: E.portions(S.profil, aujourdhui(), 'diner') } : S.plan.jours[fiche.jour][fiche.slot];
    const r = E.REC[m.recette];
    const eq = E.equilibre(r);
    const note = S.notes[r.id] || 0;
    return `<div class="voile" data-a="fermer-fond"><div class="fiche" data-cle="${cleFiche()}" role="dialog" aria-modal="true" aria-labelledby="fiche-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:6px"><span class="eyebrow">${fiche.recette ? 'Idée' : esc(S.plan.jours[fiche.jour].jour) + ' · ' + (fiche.slot === 'dejeuner' ? 'déjeuner' : 'dîner')}</span><h2 id="fiche-titre">${esc(r.nom)}</h2></div>
        <button class="btn btn-petit" data-a="fermer" aria-label="Fermer">Fermer</button></div>
      <figure class="fiche-illu">${V(r, 220, 'rect')}<figcaption class="small muted">${creditPhoto(r)}</figcaption></figure>
      <div class="meta"><span>${r.temps} min</span><span>${['', 'Facile', 'Moyen', 'Avancé'][r.niveau]}</span><span>${nb(m.portions)} portion${m.portions > 1 ? 's' : ''} adulte${m.portions > 1 ? 's' : ''}</span><span class="num">≈ ${euros(E.coutPortion(r) * m.portions)}</span>${tagDemo}</div>
      <div class="equi"><span class="tag ${eq.legumes ? 'tag-ok' : 'tag-simu'}">Légumes ${eq.legumes ? '✓' : '—'}</span><span class="tag ${eq.feculent ? 'tag-ok' : 'tag-simu'}">Féculent ${eq.feculent ? '✓' : '—'}</span><span class="tag ${eq.proteine ? 'tag-ok' : 'tag-simu'}">Protéines ${eq.proteine ? '✓' : '—'}</span></div>
      ${!eq.legumes || !eq.feculent ? `<p class="small muted">Pour compléter : ${!eq.legumes ? 'une crudité ou un fruit' : ''}${!eq.legumes && !eq.feculent ? ' et ' : ''}${!eq.feculent ? 'du pain' : ''}.</p>` : ''}
      <div class="stack" style="gap:8px"><h3>Ingrédients</h3><ul>${r.ing.map(([id, q]) => `<li>${esc(E.ING[id].nom)} : <span class="num">${quantite(q * m.portions, E.ING[id].unite)}</span></li>`).join('')}</ul></div>
      <div class="stack" style="gap:8px"><h3>Préparation</h3><ol>${r.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol></div>
      <p class="small"><a class="lien-externe" href="https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(termeMarmiton(r.nom))}" target="_blank" rel="noopener">Voir des recettes similaires sur Marmiton ↗</a><br><span class="muted">Site extérieur, sans lien avec Budgétable. Les quantités et le prix affichés ici ne s'y appliquent pas.</span></p>
      <section class="commis stack" style="gap:8px"><div class="spread"><h3>Le commis de cuisine</h3><span class="tag tag-ok">IA</span></div>${blocChef(r, m.portions)}</section>
      <div><button class="btn btn-petit ${S.classiques.includes(r.id) ? 'btn-plein' : ''}" data-a="classique" data-r="${r.id}" aria-pressed="${S.classiques.includes(r.id)}">${S.classiques.includes(r.id) ? '♥ Un classique de la famille' : '♡ Ajouter à nos classiques'}</button></div>
      <div class="stack" style="gap:6px"><h3>Votre avis</h3><div class="etoiles" role="radiogroup" aria-label="Noter la recette">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= note ? 'on' : ''}" data-a="noter" data-r="${r.id}" data-n="${n}" role="radio" aria-checked="${n === note}" aria-label="${n} sur 5">★</button>`).join('')}</div>
        <p class="small muted">${note === 1 ? 'Cette recette ne sera plus proposée.' : note ? 'Merci : les recettes bien notées reviendront plus souvent.' : 'Une étoile : on ne la propose plus. Cinq : plus souvent.'}</p></div>
    </div></div>`;
  }

  /* ---------- rendu ---------- */
  function rendre() {
    document.documentElement.classList.toggle('imprimable', S.imprimable && S.vue === 'app' && S.onglet === 'courses');
    const app = document.getElementById('app');
    if (S.vue === 'test' && !S.test) S.vue = S.plan ? 'app' : 'profil';
    const html = { accueil: vueAccueil, questionnaire: vueQuestionnaire, profil: vueProfilValidation, app: vueApp, test: vueTest }[S.vue]();
    const avant = document.querySelector('.fiche');
    const haut = avant ? avant.scrollTop : 0;
    const memeFiche = avant && avant.dataset.cle === cleFiche();
    app.innerHTML = html + vueChoix() + vueFiche();
    const apres = document.querySelector('.fiche');
    if (apres && memeFiche) apres.scrollTop = haut;
    const fil = document.querySelector('.fiche .chat');
    if (fil) fil.scrollTop = fil.scrollHeight;
    sauver();
  }

  function nouvellePlanification() {
    if (S.plan) S.tourEnfant++;
    S.plan = E.genererSemaine(S.profil, { seed: Math.floor(Math.random() * 1e9), notes: S.notes, classiques: S.classiques });
    S.coches = {};
    S.ceSoirOuvert = false;
  }

  function allerQuestion(id) {
    const qs = questionsActives(S.profil);
    S.etape = Math.max(0, qs.findIndex((q) => q.id === id));
    S.edition = true;
    S.vue = 'questionnaire';
  }

  function suivant() {
    const qs = questionsActives(S.profil);
    const q = qs[S.etape];
    if (q.id === 'allergies') { S.profil.allergiesNonRenseignees = false; S.sensibleNonEnregistre = false; }
    if (S.edition) {
      // si la question a ouvert une question dépendante (ex. enfants → âges), on la pose aussi
      const suivante = questionsActives(S.profil)[S.etape + 1];
      if (suivante && ['ages', 'enfantsMode', 'sport', 'consentement'].includes(suivante.id) && !(suivante.id === 'consentement' && S.profil.consentementSante)) { S.etape++; return; }
      S.edition = false;
      S.vue = S.plan ? 'app' : 'profil';
      if (S.plan) S.onglet = 'profil';
      return;
    }
    if (S.etape < qs.length - 1) S.etape++; else S.vue = 'profil';
  }

  /* ---------- événements ---------- */
  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;
    if ((a === 'fermer-fond' || a === 'fermer-choix-fond') && ev.target !== el) return;
    const p = S.profil;
    switch (a) {
      case 'commencer': S.vue = 'questionnaire'; S.etape = 0; break;
      case 'q-suiv': suivant(); break;
      case 'q-prec': if (S.edition && S.etape === 0) { S.edition = false; S.vue = S.plan ? 'app' : 'profil'; } else S.etape = Math.max(0, S.etape - 1); break;
      case 'q-passer': p.allergies = []; p.allergiesNonRenseignees = true; suivant(); break;
      case 'q-reprendre': S.vue = 'questionnaire'; S.etape = 0; break;
      case 'cpt': {
        const d = +el.dataset.d;
        if (el.dataset.id === 'adultes') { p.foyer.adultes = Math.max(1, p.foyer.adultes + d); p.dejeuners.adultesMaison = Math.min(p.dejeuners.adultesMaison, p.foyer.adultes); }
        else if (el.dataset.id === 'enfants') { if (d > 0) p.foyer.enfants.push('6-10'); else p.foyer.enfants.pop(); }
        else if (el.dataset.id === 'adultesMaison') p.dejeuners.adultesMaison = Math.max(0, Math.min(p.foyer.adultes, p.dejeuners.adultesMaison + d));
        break;
      }
      case 'age': p.foyer.enfants[+el.dataset.i] = el.dataset.k; break;
      case 'chip': {
        const champ = el.dataset.champ, k = el.dataset.k;
        if (el.dataset.multi === '1') {
          const v = getChamp(champ);
          setChamp(champ, v.includes(k) ? v.filter((x) => x !== k) : [...v, k]);
          if (champ === 'allergies') p.allergiesNonRenseignees = false;
        } else {
          const q = QUESTIONS.find((x) => x.champ === champ);
          setChamp(champ, q && q.nombre ? +k : (/^\d+$/.test(k) && champ.startsWith('temps') ? +k : k));
          if (champ === 'dejeuners.mode' && k === 'dehors') p.dejeuners.adultesMaison = Math.min(p.dejeuners.adultesMaison, p.foyer.adultes);
        }
        break;
      }
      case 'chip-aucun': setChamp(el.dataset.champ, []); if (el.dataset.champ === 'allergies') p.allergiesNonRenseignees = false; break;
      case 'consent': p.consentementSante = el.checked; if (el.checked) S.sensibleNonEnregistre = false; toast(el.checked ? 'Données de santé enregistrées sur cet appareil' : 'Données de santé non enregistrées'); break;
      case 'placard': p.placardBase = el.checked; break;
      case 'modifier': allerQuestion(el.dataset.q); break;
      case 'valider': S.compteLocal = true; nouvellePlanification(); S.vue = 'app'; S.onglet = 'semaine'; break;
      case 'onglet': S.onglet = el.dataset.k; S.imprimable = false; window.scrollTo(0, 0); break;
      case 'nouvelle':
        if (S.sensibleNonEnregistre) { allerQuestion('allergies'); break; }
        nouvellePlanification(); toast('Nouvelle semaine créée'); break;
      case 'changer': {
        if (S.sensibleNonEnregistre) { allerQuestion('allergies'); break; }
        if (!S.premium && S.plan.remplacements >= LIMITE_GRATUITE) { toast('Limite de la formule Découverte atteinte : activez Premium (test) dans Profil'); return; }
        const j = +el.dataset.j, s = el.dataset.s;
        const avant = S.plan.jours[j][s].recette;
        S.plan = E.remplacerRepas(S.plan, j, s, p, optsMoteur());
        toast(S.plan.jours[j][s].recette === avant ? 'Pas d’autre recette compatible pour ce repas' : `Remplacé par : ${E.REC[S.plan.jours[j][s].recette].nom}`);
        break;
      }
      case 'ajuster': {
        if (S.sensibleNonEnregistre) { allerQuestion('allergies'); break; }
        const r = E.ajusterAuBudget(S.plan, p, optsMoteur());
        S.plan = { ...r.plan, alertes: S.plan.alertes.concat(r.atteint ? [] : [`Même avec les recettes compatibles les moins chères, l’estimation reste à ${euros(r.estimation)}. Pistes : augmenter un peu le budget, indiquer vos provisions, ou prévoir des déjeuners dehors.`]) };
        toast(r.changements.length ? `${pluriel(r.changements.length, 'repas remplacé')}, économie ${euros(r.changements.reduce((s, c) => s + c.gain, 0))}` : 'Aucun remplacement moins cher trouvé');
        break;
      }
      case 'fiche': fiche = { jour: +el.dataset.j, slot: el.dataset.s }; break;
      case 'fiche-r': fiche = { recette: el.dataset.r }; break;
      case 'fermer': case 'fermer-fond': fiche = null; break;
      case 'noter': {
        const n = +el.dataset.n;
        S.notes[el.dataset.r] = n;
        p.gouts = E.apprendre(p.gouts, el.dataset.r, n >= 5 ? 'adore' : n === 4 ? 'pourquoi' : n <= 2 ? 'non' : '');
        if (n === 5 && !S.classiques.includes(el.dataset.r)) { S.classiques.push(el.dataset.r); toast('5 étoiles : ajouté à « Nos classiques » ♥'); }
        if (n <= 2) S.classiques = S.classiques.filter((x) => x !== el.dataset.r);
        break;
      }
      case 'classique': {
        const id = el.dataset.r;
        if (S.classiques.includes(id)) { S.classiques = S.classiques.filter((x) => x !== id); toast('Retiré de nos classiques'); }
        else { S.classiques.push(id); toast('Ajouté à nos classiques ♥ : il reviendra régulièrement'); }
        break;
      }
      case 'choix': ouvrirChoix(+el.dataset.j, el.dataset.s, el.dataset.enfants === '1'); break;
      case 'fermer-choix': case 'fermer-choix-fond': choix = null; break;
      case 'choisir': {
        const { jour, slot, enfants } = choix;
        const avant = S.plan.jours[jour][slot].recette;
        S.plan = E.choisirRepas(S.plan, jour, slot, el.dataset.r);
        const nom = E.REC[el.dataset.r].nom;
        if (enfants) {
          const prenom = prenomDuTour();
          if (prenom) S.plan.jours[jour][slot].choisiPar = prenom;
          toast(prenom ? `Super choix, ${prenom} ! ${E.JOURS[jour]} soir : ${nom}` : `Super choix ! ${E.JOURS[jour]} soir : ${nom}`);
        } else toast(el.dataset.r === avant ? 'On garde ce plat' : `C’est noté : ${nom}`);
        choix = null;
        break;
      }
      case 'autres-idees': {
        if (!S.premium && S.plan.remplacements >= LIMITE_GRATUITE) { toast('Plus d’idées supplémentaires cette semaine en formule Découverte : activez Premium (test) dans Profil'); return; }
        choix.exclure.push(...choix.idees);
        choix.tour++;
        const idees = E.propositions(S.plan, choix.jour, choix.slot, p, { ...optsMoteur(), exclure: choix.exclure, tour: choix.tour });
        if (!idees.length) { toast('Pas d’autre plat compatible pour ce repas'); return; }
        choix.idees = idees;
        S.plan = { ...S.plan, remplacements: S.plan.remplacements + 1 };
        break;
      }
      case 'rituels-oui': p.rituels = E.rituelsSuggeres(p); S.rituelsVus = true; nouvellePlanification(); toast('Rituels en place : la semaine a été refaite avec eux'); break;
      case 'rituels-non': S.rituelsVus = true; break;
      case 'rituels-ouvrir': S.rituelsOuverts = !el.parentElement.open; return;
      case 'rituels-appliquer': S.rituelsModifies = false; nouvellePlanification(); toast('Nouvelle semaine avec vos rituels'); break;
      case 'test-go':
        S.test = { ids: E.selectionTest(p, 12, Math.floor(Math.random() * 1e9), window.Photos ? (r) => !!window.Photos.photoFidele(r) : null), i: 0, depuis: el.dataset.depuis };
        S.vue = 'test'; window.scrollTo(0, 0); break;
      case 'test-rep':
        if (el.dataset.k !== 'passer') p.gouts = E.apprendre(p.gouts, S.test.ids[S.test.i], el.dataset.k);
        S.test.i++; break;
      case 'test-fin':
        if (S.sensibleNonEnregistre) { S.test = null; allerQuestion('allergies'); break; }
        S.compteLocal = true; nouvellePlanification(); S.test = null; S.vue = 'app'; S.onglet = 'semaine';
        toast('Semaine créée avec vos goûts'); break;
      case 'gouts-effacer': p.gouts = E.goutsVides(); toast('Goûts effacés'); break;
      case 'ia-envoyer': envoyerIA(); return;
      case 'chef-envoyer': { const z = document.getElementById('chef-texte'); envoyerChef(z ? z.value : ''); return; }
      case 'chef-question': envoyerChef(el.dataset.q); return;
      case 'ce-soir': S.ceSoirOuvert = true; break;
      case 'cocher': S.coches[el.dataset.id] = el.checked; break;
      case 'stock': {
        const id = el.dataset.id;
        if (p.placardBase && E.PLACARD_BASE.includes(id) && !p.provisions.includes(id)) {
          // on retire un produit du placard de base : les autres restent en réserve
          p.placardBase = false;
          p.provisions = [...new Set([...p.provisions, ...E.PLACARD_BASE.filter((x) => x !== id)])];
        } else {
          p.provisions = p.provisions.includes(id) ? p.provisions.filter((x) => x !== id) : [...p.provisions, id];
        }
        break;
      }
      case 'imprimable': S.imprimable = !S.imprimable; break;
      case 'imprimer': window.print(); return;
      case 'copier-liste': copier(listeTexte(E.listeCourses(S.plan, p)), null); return;
      case 'export-extension': envoyerExtension(exportExtension(E.listeCourses(S.plan, p))); return;
      case 'copier-export': copier(document.getElementById('export').value, document.getElementById('export')); return;
      case 'drive-mode': S.drives.mode = el.dataset.k; break;
      case 'chercher-drives': chercherDrives(); return;
      case 'choisir-magasin': {
        const c = new Set(S.drives.choisis || []);
        if (el.checked) c.add(el.dataset.id); else c.delete(el.dataset.id);
        S.drives.choisis = [...c];
        const m = S.drives.recherche.magasins.find((x) => x.id === el.dataset.id);
        if (el.checked && m && DRIVES[m.enseigne] && !S.drives.enseigne) S.drives.enseigne = m.enseigne;
        break;
      }
      case 'enseigne': S.drives.enseigne = S.drives.enseigne === el.dataset.k ? '' : el.dataset.k; break;
      case 'premium': S.premium = el.checked; toast(el.checked ? 'Premium activé en mode test, sans paiement' : 'Retour à la formule Découverte'); break;
      case 'supprimer': S.confirmerSuppression = true; break;
      case 'suppr-non': S.confirmerSuppression = false; break;
      case 'suppr-oui':
        try { localStorage.removeItem(CLE); } catch (e) { /* rien à effacer */ }
        S = { ...S, profil: E.profilParDefaut(), plan: null, notes: {}, coches: {}, premium: false, compteLocal: false, vue: 'accueil', confirmerSuppression: false, sensibleNonEnregistre: false };
        rendre();
        try { localStorage.removeItem(CLE); } catch (e) { /* idem */ }
        toast('Toutes vos données ont été effacées de cet appareil');
        return;
      default: return;
    }
    rendre();
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.a === 'prenom') {
      const n = [...(S.profil.prenomsEnfants || [])];
      n[+el.dataset.i] = el.value.slice(0, 20);
      S.profil.prenomsEnfants = n;
      sauver();
      return;
    }
    if (el.dataset.a === 'budget') {
      S.profil.budget = +el.value;
      const o = document.getElementById('budget-val'); if (o) o.textContent = euros(S.profil.budget);
      sauver();
    } else if (el.dataset.a === 'drive-champ') {
      S.drives[el.dataset.k] = el.dataset.k === 'cp' ? el.value : +el.value;
      if (el.dataset.k === 'cp') { sauver(); return; }
      if (el.type === 'range') { const o = el.parentElement.querySelector('output'); if (o) o.textContent = el.value + ' km'; sauver(); return; }
    }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.a === 'drive-champ' && el.type === 'number') rendre();
    if (el.dataset.a === 'rituel') {
      const r = { ...(S.profil.rituels || {}) };
      if (el.value) r[el.dataset.j] = el.value; else delete r[el.dataset.j];
      S.profil.rituels = r; S.rituelsVus = true; S.rituelsModifies = true; S.rituelsOuverts = true;
      rendre();
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && fiche) { fiche = null; rendre(); } else if (ev.key === 'Escape' && choix) { choix = null; rendre(); }
    if (ev.key === 'Enter' && ev.target.id === 'chef-texte') { ev.preventDefault(); envoyerChef(ev.target.value); }
  });

  /* ---------- assistant goût (IA) : version en ligne seulement ---------- */
  function consignesIA() {
    const ings = E.DATA.ingredients.filter((i) => ['P', 'L', 'F', 'D'].includes(i.groupe)).map((i) => `${i.id}=${i.nom}`).join(', ');
    const cuis = Object.entries(L.cuisines).map(([k, v]) => `${k}=${v}`).join(', ');
    const mods = Object.entries(E.MODELES).filter(([k]) => k !== 'maison').map(([k, v]) => `${k}=${v.libelle}`).join(', ');
    const deja = E.resumeGouts(S.profil.gouts);
    return `Tu es l’assistant goût de Budgétable, une application française qui prépare les menus de la semaine d’un foyer avec un petit budget.
Ton rôle : comprendre ce que la personne aime manger, en conversation, puis traduire ses préférences en poids chiffrés.
Règles :
- Réponds en français, en vouvoyant, chaleureusement, en 2 ou 3 phrases maximum, puis pose UNE question courte pour affiner (ou aucune si tout est clair).
- Ne renvoie que les préférences exprimées dans le DERNIER message de la personne (les précédentes sont déjà enregistrées).
- Poids de -3 (déteste) à 3 (adore). N’invente rien : si un aliment n’est pas évoqué, ne le mets pas.
- Ne déduis jamais d’allergie, de régime ou d’information de santé. Si la personne en parle, dis-lui de les indiquer dans son profil (questionnaire), car c’est là qu’elles sont appliquées en sécurité.
- Utilise UNIQUEMENT ces identifiants. Ingrédients : ${ings}. Cuisines : ${cuis}. Types de plats : ${mods}.
Goûts déjà connus : aime ${deja.aime.join(', ') || 'rien encore'} ; moins ${deja.evite.join(', ') || 'rien encore'}.
Réponds uniquement avec un objet JSON de cette forme :
{"reponse": "ton message à la personne", "ingredients": {"saumon": 2}, "cuisines": {"asiatique": 1}, "modeles": {"curry": 2}}`;
  }

  async function envoyerIA() {
    const zone = document.getElementById('ia-texte');
    const texte = zone ? zone.value.trim() : '';
    if (!texte || !iaDispo || S.ia.attente) return;
    S.ia.tours.push({ role: 'user', content: texte.slice(0, 1500) });
    S.ia.attente = true; S.ia.message = '';
    rendre();
    const tours = S.ia.tours.slice(-10);
    try {
      const r = await iaDispo.json([{ role: 'user', content: consignesIA() }, ...tours], { cache: false, modelTier: 'quick' });
      const reponse = r && typeof r.reponse === 'string' ? r.reponse : 'C’est noté.';
      S.profil.gouts = E.fusionnerGouts(S.profil.gouts, r || {});
      S.ia.tours.push({ role: 'assistant', content: reponse.slice(0, 1200) });
    } catch (e) {
      const code = e && e.code;
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) { iaDispo = false; S.ia.message = ''; }
      else if (code === 'rate_limited') S.ia.message = 'L’assistant est très sollicité : réessayez dans quelques minutes.';
      else if (code === 'session_expired') S.ia.message = 'Reconnectez-vous à Claude, puis réessayez.';
      else if (code !== 'cancelled') S.ia.message = 'L’assistant n’a pas pu répondre. Réessayez.';
      S.ia.tours.pop();
    }
    S.ia.attente = false;
    rendre();
  }

  /* ---------- commis de cuisine (IA) : aide pendant la recette ---------- */
  function consignesChef() {
    const m = fiche.recette ? { recette: fiche.recette, portions: E.portions(S.profil, aujourdhui(), 'diner') } : S.plan.jours[fiche.jour][fiche.slot];
    const r = E.REC[m.recette];
    const p = S.profil;
    const interdits = [].concat((p.allergies || []).map((a) => 'allergie ' + ((L.allergies || {})[a] || a)), p.regime && p.regime !== 'aucun' ? ['régime ' + ((L.regime || {})[p.regime] || p.regime)] : [], (p.refus || []).map((x) => 'n’aime pas ' + (E.ING[x] ? E.ING[x].nom : x)));
    return `Tu es le commis de cuisine de Budgétable, une application française de menus économiques. La personne est en train de cuisiner cette recette :
Nom : ${r.nom} — ${nb(m.portions)} portion(s) adulte(s), ${r.temps} min, niveau ${['', 'facile', 'moyen', 'avancé'][r.niveau]}.
Ingrédients : ${r.ing.map(([id, q]) => `${E.ING[id].nom} ${quantite(q * m.portions, E.ING[id].unite)}`).join(' ; ')}.
Étapes : ${r.etapes.map((e, i) => `${i + 1}. ${e}`).join(' ')}
Contraintes du foyer à respecter absolument dans tes suggestions : ${interdits.length ? interdits.join(', ') : 'aucune indiquée'}.
Règles :
- Réponds en français, en vouvoyant, de façon concrète et rassurante, en 4 phrases maximum (ou une courte liste).
- Propose des solutions simples et peu chères, avec ce qu’on a souvent dans un placard.
- Ne propose jamais un ingrédient contraire aux contraintes ci-dessus. Pour une allergie, rappelle de vérifier l’étiquette.
- Sécurité alimentaire : volaille, porc et viande hachée toujours bien cuits à cœur ; restes au réfrigérateur sous 2 h, à consommer sous 2 à 3 jours.
- Si la question n’a rien à voir avec la cuisine ou les repas, ramène poliment vers la recette.
Réponds uniquement avec un objet JSON : {"reponse": "ton message"}`;
  }

  async function envoyerChef(question) {
    const texte = String(question || '').trim();
    if (!texte || !iaDispo || !fiche) return;
    if (!chef || chef.cle !== cleFiche()) chef = { cle: cleFiche(), tours: [], attente: false, message: '' };
    if (chef.attente) return;
    chef.tours.push({ role: 'user', content: texte.slice(0, 500) });
    chef.attente = true; chef.message = '';
    rendre();
    const moi = chef;
    try {
      const r = await iaDispo.json([{ role: 'user', content: consignesChef() }, ...moi.tours.slice(-8)], { cache: false, modelTier: 'quick' });
      moi.tours.push({ role: 'assistant', content: (r && typeof r.reponse === 'string' ? r.reponse : 'Je n’ai pas bien compris : pouvez-vous reformuler ?').slice(0, 1500) });
    } catch (e) {
      const code = e && e.code;
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) iaDispo = false;
      else if (code === 'rate_limited') moi.message = 'Le commis est très sollicité : réessayez dans quelques minutes.';
      else if (code === 'session_expired') moi.message = 'Reconnectez-vous à Claude, puis réessayez.';
      else if (code !== 'cancelled') moi.message = 'Le commis n’a pas pu répondre. Réessayez.';
      moi.tours.pop();
    }
    moi.attente = false;
    if (chef === moi) rendre();
  }

  async function detecterIA() {
    try {
      iaDispo = window.claude && typeof window.claude.use === 'function' ? (await window.claude.use('sample')) || false : false;
    } catch (e) { iaDispo = false; }
    if (fiche || S.vue === 'test' || (S.vue === 'app' && S.onglet === 'profil')) rendre();
  }

  async function copier(texte, zone) {
    try { await navigator.clipboard.writeText(texte); toast('Copié'); }
    catch (e) {
      if (zone) { zone.focus(); zone.select(); toast('Sélectionné : utilisez Copier de votre appareil'); }
      else toast('Copie impossible ici : passez par la version imprimable');
    }
  }

  /* ---------- démarrage ---------- */
  charger();
  detecterIA();
  if (S.vue === 'app' && !S.plan) S.vue = 'accueil';
  rendre();
  if ('serviceWorker' in navigator && !DANS_UN_CADRE && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible */ });
  }
})();
