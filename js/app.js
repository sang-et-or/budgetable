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
    rituelsVus: false,     // la suggestion de rituels a été vue
    modeCourses: null,     // courses guidées sur le drive : { ouvert, i, absents, prix }
    bibliotheque: [],      // « Mes recettes » : recettes perso (nom, lien, ingrédients cochés)
    ranges: {},            // achats de la semaine déjà rangés dans le placard { ingrédient: true }
    deduits: {},           // repas de la semaine traités pour le placard { 'jour-slot': 'cuisine' | 'ignore' }
    gourmandPerso: []      // desserts et goûters ajoutés par la personne
  };
  let edition = null;      // saisie d'une recette : { id?, nom, lien, repas, temps, etape, ing: [{id,q,coche}], extras: [{nom,tags,coche,alerte}], retires, source, placer }
  let auMenu = null;       // « mettre au menu » une recette de la bibliothèque : { id }
  let choix = null;        // fenêtre « 3 idées » : { jour, slot, idees, exclure, tour, enfants }
  let chef = null;        // assistant cuisine de la fiche ouverte : { cle, tours, attente, message }
  let iaDispo = null;      // null : on vérifie ; false : indisponible ; fonction : disponible
  // photo d'illustration posée sur le dessin : si la photo ne charge pas, le dessin reste visible
  function V(rec, taille, forme) {
    if (rec.gourmand && !rec.photo) {
      const dim = forme === 'rect' ? 'width:100%;height:' + taille + 'px' : `width:${taille}px;height:${taille}px`;
      return `<span class="visuel-gourmand ${rec.type} ${forme || 'rond'}" style="${dim};font-size:${Math.round(taille * (forme === 'rect' ? 0.42 : 0.55))}px" aria-hidden="true">${rec.emoji}</span>`;
    }
    const svg = window.Visuels.illustration(rec, E, taille);
    const src = rec.base && E.REC[rec.base] ? E.REC[rec.base] : rec;
    const ph = src.photo ? { src: src.photo } : src.perso ? null : window.Photos && window.Photos.photoPour(src);
    if (!ph) return svg;
    const dim = forme === 'rect' ? 'width:100%;height:' + taille + 'px' : `width:${taille}px;height:${taille}px`;
    return `<span class="photo ${forme || 'rond'}" style="${dim}">${svg}<img src="${esc(ph.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
  }
  /* ---------- calories et Nutri-Score estimés ---------- */
  const nutri = (rec) => (window.Nutrition ? window.Nutrition.de(rec, E.ING) : null);
  function nutriMini(rec) {
    const n = nutri(rec);
    if (!n) return '';
    return `<span class="nutri-mini" title="Estimation pour une portion adulte${n.lettre ? ` · Nutri-Score estimé ${n.lettre}` : ''}">${n.lettre ? `<span class="ns-lettre ns-${n.lettre}" aria-label="Nutri-Score estimé ${n.lettre}">${n.lettre}</span>` : ''}<span class="num">${n.kcal} kcal</span></span>`;
  }
  function nutriFiche(rec, unite) {
    const n = nutri(rec);
    if (!n) return '';
    const pp = n.parPortion;
    const g1 = (v) => nb(Math.round(v * 10) / 10);
    return `<div class="bloc-nutri">
      <div class="spread" style="align-items:center;gap:12px">
        ${n.lettre ? `<div class="echelle-ns" role="img" aria-label="Nutri-Score estimé : ${n.lettre}"><span class="ns-titre">NUTRI-SCORE</span><div class="ns-lettres">${['A', 'B', 'C', 'D', 'E'].map((l) => `<span class="ns-${l} ${l === n.lettre ? 'actif' : ''}">${l}</span>`).join('')}</div></div>` : '<span class="small muted">Nutri-Score : pas assez d’informations sur les ingrédients.</span>'}
        <div class="stack" style="gap:0;text-align:right"><strong class="num kcal-gros">${n.kcal} kcal</strong><span class="small muted">par ${unite}</span></div>
      </div>
      <div class="meta small"><span>Protéines ${g1(pp.prot)} g</span><span>Sucres ${g1(pp.sucres)} g</span><span>Graisses saturées ${g1(pp.ags)} g</span><span>Fibres ${g1(pp.fibres)} g</span><span>Sel ${g1(pp.sel)} g</span></div>
      <p class="small muted" style="margin:0">Estimation calculée à partir des ingrédients et des tables de composition des aliments (méthode Nutri-Score 2017, plat cuit). Ce n’est pas un étiquetage officiel.</p>
    </div>`;
  }
  function creditPhoto(rec) {
    if (rec.photo) return rec.photoSource === 'perso' ? 'Votre photo' : `Photo : ${esc(rec.photoSource || 'site de la recette')}${rec.lien ? ` (<a href="${esc(rec.lien)}" target="_blank" rel="noopener noreferrer">voir la recette</a>)` : ''}`;
    if (rec.perso) return 'Illustration dessinée à partir des ingrédients';
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
  let dernierEnregistre = null;
  function sauver() {
    const p = JSON.parse(JSON.stringify(S.profil));
    let marque = false;
    if (!p.consentementSante) {
      if (p.allergies.length || p.objectifs.includes('perte')) marque = true;
      p.allergies = [];
      p.objectifs = p.objectifs.filter((o) => o !== 'perte');
      delete p.programme;
      delete p.sport;
    }
    const a = { v: 1, profil: p, sensibleNonEnregistre: marque, vue: S.vue === 'questionnaire' ? 'accueil' : S.vue === 'test' ? (S.plan ? 'app' : 'profil') : S.vue, onglet: S.onglet, plan: S.plan, notes: S.notes, coches: S.coches, premium: S.premium, compteLocal: S.compteLocal, drives: S.drives, classiques: S.classiques, tourEnfant: S.tourEnfant, rituelsVus: S.rituelsVus, modeCourses: S.modeCourses, bibliotheque: S.bibliotheque, ranges: S.ranges, deduits: S.deduits, planDu: S.planDu, dernierRangement: S.dernierRangement || null, vue3d: S.vue3d, gourmandPerso: S.gourmandPerso, budgetCalc: S.budgetCalc || null, budgetPeriode: S.budgetPeriode || 'semaine', presencesGarder: !!S.presencesGarder, retraits: S.retraits || {}, journal: S.journal || [], ajouts: S.ajouts || [], objectifKcal: S.objectifKcal || null, calcKcal: S.calcKcal || null, saisonGardees: S.saisonGardees || [], variantes: S.variantes || [], versionsPreferees: S.versionsPreferees || {}, ingredientsManuels: S.ingredientsManuels || [], alertesPromos: S.alertesPromos || [], alertesVues: (S.alertesVues || []).slice(-800), alertesNotif: !!S.alertesNotif, alertesNotifiees: S.alertesNotifiees || [], installIgnore: !!S.installIgnore, prixMagasins: S.prixMagasins || {}, tickets: S.tickets || [], magasinActif: S.magasinActif || '', correspondances: S.correspondances || {} };
    const texte = JSON.stringify(a);
    // compte : on n'envoie que quand quelque chose a vraiment changé
    if (texte !== dernierEnregistre) {
      if (dernierEnregistre !== null) { try { localStorage.setItem('budgetable.maj', String(Date.now())); } catch (e) { /* */ } if (typeof planifierSync === 'function') planifierSync(); }
      dernierEnregistre = texte;
    }
    try { localStorage.setItem(CLE, texte); } catch (e) {
      // mémoire pleine (souvent à cause des photos) : on prévient, l'appli marche quand même
      if (e && /quota/i.test(e.name + e.message) && typeof toast === 'function') toast('Mémoire du navigateur pleine : retirez quelques photos de vos recettes pour que tout soit gardé');
    }
  }
  // catalogue élargi + produits des desserts et de saison : enregistrés avant les recettes perso qui peuvent les utiliser
  (function catalogueComplet() {
    const extra = window.CatalogueExtra, G = window.Gourmand, Sa = window.Saison, PD = window.PetitDej;
    E.ajouterIngredients([].concat(G ? G.INGREDIENTS : [], Sa ? Sa.INGREDIENTS : [], extra ? extra.INGREDIENTS : [], PD ? PD.INGREDIENTS : []));
    if (window.Nutrition) for (const src of [Sa && Sa.NUTRITION, extra && extra.NUTRITION, PD && PD.NUTRITION]) for (const [k, v] of Object.entries(src || {})) if (!window.Nutrition.TABLE[k]) window.Nutrition.TABLE[k] = v;
    if (extra && window.Saisie && window.Saisie.etendre) window.Saisie.etendre(extra.MOTS, extra.Q);
    if (PD && window.Saisie && window.Saisie.etendre) window.Saisie.etendre(PD.MOTS, { graines_chia: 10, muesli: 50, proteine_poudre: 25 });
  })();
  function charger() {
    try {
      const a = JSON.parse(localStorage.getItem(CLE) || 'null');
      if (!a || a.v !== 1) return;
      Object.assign(S, { profil: { ...E.profilParDefaut(), ...a.profil }, vue: a.vue || 'accueil', onglet: a.onglet || 'semaine', plan: a.plan, notes: a.notes || {}, coches: a.coches || {}, premium: !!a.premium, compteLocal: !!a.compteLocal, sensibleNonEnregistre: !!a.sensibleNonEnregistre, drives: { ...S.drives, ...(a.drives || {}) }, classiques: a.classiques || [], tourEnfant: a.tourEnfant || 0, rituelsVus: !!a.rituelsVus, modeCourses: a.modeCourses || null, bibliotheque: Array.isArray(a.bibliotheque) ? a.bibliotheque : [], ranges: a.ranges || {}, deduits: a.deduits || {}, planDu: a.planDu || null, dernierRangement: a.dernierRangement || null, vue3d: a.vue3d, gourmandPerso: Array.isArray(a.gourmandPerso) ? a.gourmandPerso : [], budgetCalc: a.budgetCalc || null, budgetPeriode: a.budgetPeriode || 'semaine', presencesGarder: !!a.presencesGarder, retraits: a.retraits || {}, journal: Array.isArray(a.journal) ? a.journal : [], ajouts: Array.isArray(a.ajouts) ? a.ajouts : [], objectifKcal: a.objectifKcal || null, calcKcal: a.calcKcal || null, saisonGardees: Array.isArray(a.saisonGardees) ? a.saisonGardees : [], variantes: Array.isArray(a.variantes) ? a.variantes : [], versionsPreferees: a.versionsPreferees || {}, ingredientsManuels: Array.isArray(a.ingredientsManuels) ? a.ingredientsManuels : [], alertesPromos: Array.isArray(a.alertesPromos) ? a.alertesPromos : [], alertesVues: Array.isArray(a.alertesVues) ? a.alertesVues : [], alertesNotif: !!a.alertesNotif, alertesNotifiees: Array.isArray(a.alertesNotifiees) ? a.alertesNotifiees : [], installIgnore: !!a.installIgnore, prixMagasins: a.prixMagasins || {}, tickets: Array.isArray(a.tickets) ? a.tickets : [], magasinActif: a.magasinActif || '', correspondances: a.correspondances || {} });
      enregistrerManuels();
      E.definirPerso(S.bibliotheque);
      // comptes créés avant : les provisions du questionnaire n'étaient pas rangées au placard
      if (S.plan && !Array.isArray(S.profil.provisionsRangees)) rangerProvisions(S.profil);
    } catch (e) { /* données illisibles : on repart de zéro */ }
    finally { definirGourmand(); E.definirVariantes(S.variantes || []); try { appliquerPrixMagasin(); } catch (e) { /* prix de démonstration */ } }
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
  /** Jour (0 = lundi) par lequel commence la semaine du planning : le jour de sa création. */
  const debutSemaine = () => (S.planDu ? (new Date(S.planDu + 'T12:00:00').getDay() + 6) % 7 : aujourdhui());
  /** Les jours du planning dans l'ordre de la semaine, à partir du premier jour : [jp, index du jour]. */
  const ordreJours = () => { const d = debutSemaine(); return [0, 1, 2, 3, 4, 5, 6].map((k) => (d + k) % 7); };
  /** Repas d'aujourd'hui déjà passés à la création de la semaine : on ne les prévoit pas (déjeuner après 13 h, dîner après 21 h). */
  function retirerRepasPasses() {
    if (!S.plan) return;
    S.plan.jours.forEach((x) => { delete x.passes; });
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60, jp = S.plan.jours[aujourdhui()];
    const passes = (h >= 13 ? ['dejeuner'] : []).concat(h >= 21 ? ['diner'] : []);
    passes.forEach((sl) => { jp[sl] = null; });
    if (passes.includes('dejeuner')) delete jp.gamelles;
    if (passes.length) jp.passes = passes;
  }
  /** Si la semaine n'a pas commencé aujourd'hui : proposer de la faire démarrer aujourd'hui, sans changer les plats. */
  /** Après « Refaire les plats » : pouvoir revenir aux plats d'avant. */
  function bandeauRefaire() {
    if (!S.planAvantRefaire) return '';
    return `<div class="bandeau bandeau-info small ecran-seul bandeau-refaire" role="status"><span>🔄 Nouveaux plats proposés. Les repas déjà mangés, pris dehors ou choisis par vous n’ont pas bougé.</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-petit" data-a="refaire-plats">Encore</button><button class="btn btn-petit" data-a="refaire-annuler">Revenir aux plats d’avant</button><button class="btn-lien small" data-a="refaire-ok" aria-label="Fermer">✕</button></span></div>`;
  }
  function boutonDemarrer() {
    if (!S.plan || !S.planDu || debutSemaine() === aujourdhui() && S.planDu === ISO(new Date())) return '';
    const auj = E.JOURS[aujourdhui()].toLowerCase();
    return `<div class="bandeau bandeau-info small ecran-seul bandeau-demarrer"><span>Votre semaine commence ${E.JOURS[debutSemaine()].toLowerCase()} ${new Date(S.planDu + 'T12:00:00').getDate()}. La faire démarrer aujourd’hui (${auj}) ? Les plats restent les mêmes, dans l’ordre des jours.</span><button class="btn btn-petit btn-plein" data-a="demarrer-auj">Démarrer aujourd’hui</button></div>`;
  }
  const joursOrdonnes = () => ordreJours().map((j) => [S.plan.jours[j], j]);
  const posJour = (j) => ordreJours().indexOf(j);
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
    sport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-3 4 1 3 3 3-1M11 15l2-5"/></svg>',
    minceur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 9a5 5 0 0 1 8 0l-2.5 2.5M12 11.5l1.5-2"/></svg>',
    petitdej: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3c0 1.5 1.5 1.5 1.5 3M12 3c0 1.5 1.5 1.5 1.5 3"/></svg>',
    semaine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    soir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 13h16a8 8 0 0 1-16 0zM12 4v3M7 6l1.5 2M17 6l-1.5 2"/></svg>',
    courses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11h10.2L20 8H7"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',
    drives: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    gourmand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h12l-1.6 8.2a1 1 0 0 1-1 .8H8.6a1 1 0 0 1-1-.8z"/><path d="M5 12a3 3 0 0 1 2.2-2.9A4.8 4.8 0 0 1 12 5a4.8 4.8 0 0 1 4.8 4.1A3 3 0 0 1 19 12"/><path d="M12 5V3"/></svg>',
    apports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    promos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>',
    journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>',
    profil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    placard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M10 7.5h4M10 16.5h4"/></svg>',
    recettes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6M9 11h6"/></svg>'
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
    { id: 'provisions', titre: 'Qu’avez-vous déjà en réserve ?', aide: 'Ils seront rangés dans votre placard et ne seront pas ajoutés à la liste de courses.', type: 'provisions' }
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
        <input class="range" type="range" id="budget" min="20" max="300" step="5" value="${Math.min(300, p.budget)}" data-a="budget" aria-label="Budget hebdomadaire en euros">
        <div class="row" style="gap:8px"><button class="btn btn-petit" data-a="budget-ouvrir">Taper un montant ou calculer mon budget</button></div>
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
      <section class="carte stack" style="gap:10px"><div class="spread"><h2>Le test de goût</h2><span class="tag tag-ok">2 minutes</span></div>
        <p>En 3 étapes : les aliments que vous aimez ou refusez, vos cuisines et types de plats préférés, puis une dizaine de plats choisis selon vos réponses. Budgétable vous propose ensuite ce que vous aimez, et plus jamais ce que vous refusez.</p>
        <div><button class="btn btn-plein" data-a="test-go" data-depuis="profil">Faire le test de goût</button></div></section>
      <div class="q-nav"><button class="btn" data-a="q-reprendre">Revenir aux questions</button><button class="btn" data-a="valider">Passer et créer ma semaine</button></div>
    </div></div>`;
  }

  /* ---------- test de goût ---------- */
  /* ---------- test de goût complet : 1. les aliments, 2. cuisines et plats, 3. des plats choisis selon les réponses ---------- */
  const TUILES_GOUT = [
    ['Viandes et poissons', [['poulet', 'Poulet', '🍗', ['poulet_filet', 'cuisses_poulet']], ['boeuf', 'Bœuf', '🥩', ['boeuf_hache', 'steak']], ['porc', 'Porc', '🐖', ['porc']], ['jambon', 'Jambon', '🍖', ['jambon', 'des_jambon']], ['charcut', 'Lardons, saucisses', '🌭', ['lardons', 'saucisse', 'chorizo', 'bacon']], ['dinde', 'Dinde', '🦃', ['dinde']], ['saumon', 'Saumon', '🐟', ['saumon', 'saumon_fume']], ['poisson', 'Poisson blanc', '🐠', ['colin', 'cabillaud']], ['thon', 'Thon', '🥫', ['thon']], ['crevettes', 'Crevettes', '🦐', ['crevettes']]]],
    ['Œufs et protéines végétales', [['oeufs', 'Œufs', '🥚', ['oeufs']], ['lentilles', 'Lentilles', '🟤', ['lentilles_vertes', 'lentilles_corail']], ['pois_chiches', 'Pois chiches', '🧆', ['pois_chiches']], ['haricots', 'Haricots rouges ou blancs', '🫘', ['haricots_rouges', 'haricots_blancs']], ['tofu', 'Tofu', '🥢', ['tofu']]]],
    ['Légumes', [['brocoli', 'Brocoli', '🥦', ['brocoli']], ['courgette', 'Courgettes', '🥒', ['courgette']], ['aubergine', 'Aubergines', '🍆', ['aubergine']], ['poivron', 'Poivrons', '🫑', ['poivron']], ['epinards', 'Épinards', '🥬', ['epinards']], ['champignon', 'Champignons', '🍄', ['champignon']], ['chou', 'Chou', '🥬', ['chou']], ['courge', 'Courge, potiron', '🎃', ['courge', 'potiron']], ['poireau', 'Poireaux', '🌿', ['poireau']], ['tomate', 'Tomates', '🍅', ['tomate', 'tomate_cerise']], ['carotte', 'Carottes', '🥕', ['carotte']], ['haricots_verts', 'Haricots verts', '🫛', ['haricots_verts']], ['petits_pois', 'Petits pois', '🟢', ['petits_pois']], ['patate_douce', 'Patate douce', '🍠', ['patate_douce']], ['endives', 'Endives', '🥬', ['endives']], ['mais', 'Maïs', '🌽', ['mais']]]],
    ['Féculents', [['pates', 'Pâtes', '🍝', ['pates']], ['riz', 'Riz', '🍚', ['riz']], ['pdt', 'Pommes de terre', '🥔', ['pomme_de_terre']], ['semoule', 'Semoule', '🌾', ['semoule']], ['quinoa', 'Quinoa', '🌾', ['quinoa']]]],
    ['Fromages et crème', [['fromage', 'Fromage râpé', '🧀', ['emmental', 'comte', 'parmesan']], ['feta', 'Feta', '🧀', ['feta']], ['mozza', 'Mozzarella', '🧀', ['mozzarella']], ['chevre', 'Fromage de chèvre', '🐐', ['chevre']], ['creme', 'Crème', '🥛', ['creme', 'creme_liquide']]]]
  ];
  const VAL_GOUT = { adore: 2.5, ok: 0.4, non: -3 };
  const AVIS_GOUT = [['adore', '😍', 'J’adore'], ['ok', '🙂', 'Ça va'], ['non', '🙅', 'Non merci']];
  const tuileIds = (ids) => ids.filter((id) => E.ING[id]);
  function avisDepuisGouts(ids, g) {
    const w = Math.max(...ids.map((id) => ((g || {}).ing || {})[id] || 0)), mn = Math.min(...ids.map((id) => ((g || {}).ing || {})[id] || 0));
    return mn <= -2.4 ? 'non' : w >= 2 ? 'adore' : '';
  }
  const enteteTest = (n, titre, sous) => `<div class="spread"><div class="marque">${LOGO}Budgétable</div><span class="small muted num">Étape ${n} sur 3</span></div>
      <div class="progress" role="progressbar" aria-valuenow="${(n - 1) * 33}" aria-valuemin="0" aria-valuemax="100" aria-label="Avancement du test de goût"><i style="width:${(n - 1) * 33 + 8}%"></i></div>
      <p class="eyebrow">Test de goût</p><h1 style="margin:0">${titre}</h1><p class="muted" style="margin:0">${sous}</p>`;
  function vueTestAliments() {
    const c = S.test.aliments;
    const n = Object.values(c).filter(Boolean).length;
    return `<div class="wrap"><div class="store" aria-hidden="true"></div><div class="q-shell stack" style="max-width:820px;gap:14px">
      ${enteteTest(1, 'Les aliments', 'Dites ce que vous aimez et ce que vous ne voulez pas voir dans vos menus. Laissez vide si ça vous est égal.')}
      ${TUILES_GOUT.map(([groupe, tuiles]) => { const l = tuiles.filter(([, , , ids]) => tuileIds(ids).length); return l.length ? `<section class="stack" style="gap:8px"><h2 style="margin:0;font-size:1.05rem">${groupe}</h2><div class="grille-gout">${l.map(([k, nom, emoji]) => `<div class="tuile-gout ${c[k] ? 'avis-' + c[k] : ''}"><span class="tuile-nom"><span aria-hidden="true">${emoji}</span> ${esc(nom)}</span><span class="tuile-avis" role="radiogroup" aria-label="${esc(nom)}">${AVIS_GOUT.map(([v, e, t]) => `<button role="radio" data-a="gout-tuile" data-k="${k}" data-v="${v}" aria-checked="${c[k] === v}" aria-label="${esc(nom)} : ${t}" title="${t}">${e}</button>`).join('')}</span></div>`).join('')}</div></section>` : ''; }).join('')}
      <div class="legende-gout small muted">😍 J’adore : proposé plus souvent · 🙂 Ça va · 🙅 Non merci : plus jamais dans vos menus</div>
      <div class="q-nav"><button class="btn" data-a="test-quitter">Plus tard</button><button class="btn btn-plein" data-a="test-etape" data-k="styles">Continuer${n ? ` (${n} réponse${n > 1 ? 's' : ''})` : ''}</button></div>
    </div></div>`;
  }
  function vueTestStyles() {
    const t = S.test;
    const tri = (cle, k, nom) => `<div class="tuile-gout ${t[cle][k] ? 'avis-' + t[cle][k] : ''}"><span class="tuile-nom">${esc(nom)}</span><span class="tuile-avis" role="radiogroup" aria-label="${esc(nom)}">${AVIS_GOUT.map(([v, e, x]) => `<button role="radio" data-a="gout-style" data-cle="${cle}" data-k="${k}" data-v="${v}" aria-checked="${t[cle][k] === v}" aria-label="${esc(nom)} : ${x}" title="${x}">${e}</button>`).join('')}</span></div>`;
    return `<div class="wrap"><div class="store" aria-hidden="true"></div><div class="q-shell stack" style="max-width:820px;gap:14px">
      ${enteteTest(2, 'Cuisines et façons de cuisiner', 'Pour varier vos semaines avec ce qui vous plaît vraiment.')}
      <section class="stack" style="gap:8px"><h2 style="margin:0;font-size:1.05rem">Les cuisines</h2><div class="grille-gout">${Object.entries(L.cuisines).map(([k, v]) => tri('cuisines', k, v)).join('')}</div></section>
      <section class="stack" style="gap:8px"><h2 style="margin:0;font-size:1.05rem">Les types de plats</h2><div class="grille-gout">${Object.entries(E.MODELES).filter(([k]) => !['maison', 'perso', 'gourmand'].includes(k)).map(([k, m]) => tri('modeles', k, m.libelle)).join('')}</div></section>
      <section class="stack" style="gap:8px"><h2 style="margin:0;font-size:1.05rem">Les épices</h2><div class="row" role="radiogroup" style="gap:6px">${[['-2', '🌿 Pas d’épices'], ['0', '🙂 Un peu'], ['1.5', '🌶️ J’aime quand ça relève']].map(([v, x]) => `<button class="chip" role="radio" data-a="gout-epice" data-v="${v}" aria-checked="${String(t.epice) === v}" aria-pressed="${String(t.epice) === v}">${x}</button>`).join('')}</div></section>
      <div class="q-nav"><button class="btn" data-a="test-etape" data-k="aliments">← Retour</button><button class="btn btn-plein" data-a="test-etape" data-k="plats">Continuer : quelques plats à juger</button></div>
    </div></div>`;
  }
  /** Enregistre les réponses des étapes 1 et 2 dans les goûts. */
  function appliquerTestGout() {
    const t = S.test, p = S.profil;
    let g = { ...E.goutsVides(), ...JSON.parse(JSON.stringify(p.gouts || E.goutsVides())) };
    for (const [, tuiles] of TUILES_GOUT) for (const [k, , , ids] of tuiles) {
      const v = t.aliments[k]; const l = tuileIds(ids);
      if (!v) { for (const id of l) if (t.avant[k] && !v) delete g.ing[id]; continue; }
      for (const id of l) g.ing[id] = VAL_GOUT[v];
    }
    for (const [cle, dest] of [['cuisines', 'cuisine'], ['modeles', 'modele']]) for (const [k, v] of Object.entries(t[cle])) { if (v) g[dest][k] = VAL_GOUT[v] * 0.8; else delete g[dest][k]; }
    if (t.epice !== '' && t.epice != null) g.epice = +t.epice;
    p.gouts = g;
  }
  /** Les plats à juger : ceux qui apprennent le plus (aliments et types de plats pas encore notés), sans ce qui est refusé. */
  function selectionAdaptative(n) {
    const p = S.profil, g = p.gouts || {};
    const photo = window.Photos ? (r) => !!window.Photos.photoFidele(r) : () => true;
    const pool = E.recettesCompatibles(p).filter((r) => r.repas.includes('diner') && !E.contientDeteste(r, g));
    const avecPhoto = pool.filter(photo);
    const base = avecPhoto.length >= n * 2 ? avecPhoto : pool;
    const vus = { ing: new Set(), modele: {}, prot: {} };
    const choix = [];
    for (let k = 0; k < n && base.length; k++) {
      let best = null, bs = -Infinity;
      for (const r of base) {
        if (choix.includes(r) || choix.some((c) => (c.sig || c.id) === (r.sig || r.id))) continue;
        const marquants = E.ingredientsMarquants(r);
        const inconnus = marquants.filter((id) => !(g.ing || {})[id] && !vus.ing.has(id)).length;
        const s = inconnus * 1.5 - (vus.modele[r.modele] || 0) * 3 - (vus.prot[r.prot] || 0) * 2 + (((g.modele || {})[r.modele] || 0) === 0 ? 1 : 0) + Math.random() * 1.5 + Math.min(2, E.scoreGout(r, g) * 0.3);
        if (s > bs) { bs = s; best = r; }
      }
      if (!best) break;
      choix.push(best); E.ingredientsMarquants(best).forEach((id) => vus.ing.add(id));
      vus.modele[best.modele] = (vus.modele[best.modele] || 0) + 1; vus.prot[best.prot] = (vus.prot[best.prot] || 0) + 1;
    }
    return choix.map((r) => r.id);
  }
  function vueTest() {
    const t = S.test;
    if (t.etape === 'aliments') return vueTestAliments();
    if (t.etape === 'styles') return vueTestStyles();
    if (t.i >= t.ids.length) return vueTestFin();
    const rec = E.REC[t.ids[t.i]];
    const pct = Math.round((t.i / t.ids.length) * 100);
    return `<div class="wrap"><div class="store" aria-hidden="true"></div><div class="q-shell" style="max-width:560px">
      <div class="spread"><div class="marque">${LOGO}Budgétable</div><span class="small muted num">${t.i + 1} / ${t.ids.length}</span></div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avancement du test de goût"><i style="width:${pct}%"></i></div>
      <p class="eyebrow">Test de goût · étape 3 sur 3 : ces plats vous tentent ?</p>
      <article class="carte-test">
        <div class="carte-test-illu">${V(rec, t.pourquoi ? 110 : 220)}</div>
        <div class="stack" style="gap:6px;text-align:center">
          <h1 style="font-size:1.45rem">${esc(rec.nom)}</h1>
          <p class="meta" style="justify-content:center"><span>${esc(L.cuisines[rec.cuisine] || 'Maison')}</span><span>${rec.temps} min</span><span class="part num">${euros(E.coutPortion(rec))} la part</span>${nutriMini(rec)}</p>
        </div>
      </article>
      ${t.pourquoi ? questionPourquoi(rec) : `<div class="reponses" role="group" aria-label="Votre avis sur ce plat">
        <button class="btn rep-non" data-a="test-rep" data-k="non">Pas pour moi</button>
        <button class="btn" data-a="test-rep" data-k="pourquoi">Pourquoi pas</button>
        <button class="btn btn-plein" data-a="test-rep" data-k="adore">J’adore</button>
      </div>
      <div class="row" style="justify-content:center"><button class="btn-lien btn small" data-a="test-rep" data-k="passer">Je ne sais pas, passer</button></div>`}
    </div></div>`;
  }
  const nomCourt = (id) => E.ING[id].nom.replace(/\s*\([^)]*\)\s*$/, '');
  function questionPourquoi(rec) {
    const choix = S.test.raisons || [];
    const opts = E.ingredientsMarquants(rec).map((id) => ['ing:' + id, nomCourt(id)]).concat(rec.cuisine && L.cuisines[rec.cuisine] ? [['cuisine:' + rec.cuisine, 'La cuisine ' + L.cuisines[rec.cuisine].toLowerCase()]] : []);
    return `<section class="carte stack pourquoi-non" style="gap:10px" aria-live="polite">
        <strong>Qu’est-ce qui ne vous plaît pas ?</strong>
        <span class="small muted">Touchez ce que vous n’aimez pas : le reste ne sera pas compté contre ce plat.</span>
        <div class="row" style="gap:6px" role="group" aria-label="Ce qui ne vous plaît pas">${opts.map(([k, n]) => `<button class="chip" data-a="test-raison" data-k="${k}" aria-pressed="${choix.includes(k)}">${esc(n)}</button>`).join('')}</div>
        <div class="row" style="gap:8px"><button class="btn btn-plein" data-a="test-raisons-ok" ${choix.length ? '' : 'disabled'}>Valider</button><button class="btn" data-a="test-raisons-rien">Rien de précis, juste ce plat</button></div>
        <button class="btn-lien small" data-a="test-raisons-retour" style="justify-self:start">← Changer ma réponse</button>
      </section>`;
  }

  function puces(liste, classe) { return liste.map((t) => `<span class="tag ${classe}" style="text-transform:none;letter-spacing:0;font-size:.85rem;padding:4px 10px">${esc(t)}</span>`).join(' '); }

  function blocGouts() {
    const r = E.resumeGouts(S.profil.gouts);
    const d = r.details;
    const puce = (x, sens) => `<span class="puce-gout ${sens}"><span>${esc(x.nom)}</span>${sens === 'non' ? `<button class="btn-mini" data-a="gout-regler" data-t="${x.type}" data-c="${x.cle}" data-v="aime" aria-label="En fait, j’aime : ${esc(x.nom)}">♥ J’aime</button>` : ''}<button class="btn-mini" data-a="gout-regler" data-t="${x.type}" data-c="${x.cle}" data-v="neutre" aria-label="Retirer ${esc(x.nom)}" title="Retirer">✕</button></span>`;
    const listes = !d.aime.length && !d.evite.length ? '<p class="muted">Pas encore de goûts enregistrés : faites le test, ou ajoutez-les ci-dessous.</p>'
      : `${d.aime.length ? `<div class="stack" style="gap:6px"><span class="eyebrow">Vous aimez</span><div class="row" style="gap:6px">${d.aime.map((x) => puce(x, 'oui')).join('')}</div></div>` : ''}
      ${d.evite.length ? `<div class="stack" style="gap:6px"><span class="eyebrow">Moins pour vous</span><div class="row" style="gap:6px">${d.evite.map((x) => puce(x, 'non')).join('')}</div></div>` : ''}
      <p class="small muted" style="margin:0">Une erreur ? Touchez ✕ pour retirer, ou « ♥ J’aime » si vous aimez en fait. Pour dire qu’un aliment ne vous plaît pas, cherchez-le ci-dessous.</p>`;
    return `<div class="stack bloc-gouts" style="gap:12px">${listes}
      <label class="champ"><span>Ajouter un aliment que vous aimez ou pas</span><input type="search" id="gout-cherche" data-a="gout-cherche" placeholder="Ex. pois chiches, poisson, champignons…" autocomplete="off"></label>
      <div id="gout-propositions" class="stack" style="gap:6px"></div></div>`;
  }
  function propositionsGout(t) {
    if (t.length < 2) return '';
    const ids = window.Saisie.chercherIngredients(t, 6).filter((id) => E.ING[id] && !E.ING[id].perso);
    if (!ids.length) return '<span class="small muted">Aliment inconnu de Budgétable.</span>';
    const g = S.profil.gouts || {};
    return ids.map((id) => { const w = (g.ing || {})[id] || 0; return `<div class="spread ligne-gout"><span>${esc(nomCourt(id))}${w >= 0.9 ? ' <span class="small muted">· aimé</span>' : w <= -0.9 ? ' <span class="small muted">· pas aimé</span>' : ''}</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-petit" data-a="gout-regler" data-t="ing" data-c="${id}" data-v="aime">♥ J’aime</button><button class="btn btn-petit" data-a="gout-regler" data-t="ing" data-c="${id}" data-v="non">Pas pour moi</button></span></div>`; }).join('');
  }

  function blocIA() {
    if (iaDispo === null) return '<p class="small muted">Recherche de l’assistant IA…</p>';
    if (!iaDispo) return `<div class="bandeau bandeau-info small"><span>L’assistant IA n’est pas disponible pour le moment. Le test de goût et vos notes suffisent à apprendre vos goûts.</span></div>`;
    const tours = S.ia.tours;
    return `<div class="chat" aria-live="polite">${tours.length ? tours.map((t) => `<p class="bulle-chat ${t.role === 'user' ? 'moi' : ''}">${esc(t.content)}</p>`).join('') : '<p class="bulle-chat">Bonjour ! Racontez-moi ce que vous aimez manger, ce que vous n’aimez pas, vos plats préférés d’enfance… Je traduis tout ça en préférences pour vos menus.</p>'}
        ${S.ia.attente ? '<p class="bulle-chat"><span class="muted">Je réfléchis…</span></p>' : ''}</div>
      ${S.ia.message ? `<p class="small" style="color:var(--tomate)">${esc(S.ia.message)}</p>` : ''}
      <label class="champ"><span class="sr">Votre message à l’assistant</span><textarea id="ia-texte" rows="3" style="min-height:80px;font-family:inherit;font-size:.95rem" placeholder="Ex. : j’adore les plats épicés et le poisson, mais les champignons, très peu pour moi."></textarea></label>
      <div class="row"><button class="btn btn-plein" data-a="ia-envoyer" ${S.ia.attente ? 'disabled' : ''}>Envoyer</button><span class="small muted">L’assistant est fourni par Budgétable, sans compte à créer.</span></div>`;
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
  /* ---------- comptes : fenêtre de connexion / inscription et synchronisation ---------- */
  const C = window.Compte || { actif: () => false, connecte: () => false, utilisateur: () => null };
  let compte = { vue: null, msg: '', erreur: '', charge: false, sync: null, voir: false };
  let minuterieSync = null;
  function planifierSync() {
    if (!C.connecte()) return;
    clearTimeout(minuterieSync);
    minuterieSync = setTimeout(envoyerSync, 2500);
  }
  async function envoyerSync() {
    clearTimeout(minuterieSync); minuterieSync = null;
    if (!C.connecte()) return;
    try {
      const d = JSON.parse(localStorage.getItem(CLE) || 'null');
      if (!d) return;
      await C.ecrireDonnees(d);
      compte.sync = { t: Date.now(), ok: true };
      try { localStorage.setItem('budgetable.sync', String(Date.now())); } catch (e) { /* */ }
    } catch (e) { compte.sync = { t: Date.now(), ok: false, erreur: e.message }; }
    if (S.onglet === 'profil' && S.vue === 'app') rendre();
  }
  // à la connexion : on reprend les données du compte si elles sont plus récentes, sinon on y enregistre celles de l'appareil
  async function synchroniserConnexion() {
    try {
      await C.moi();
      const distant = await C.lireDonnees();
      const local = JSON.parse(localStorage.getItem(CLE) || 'null');
      const majLocale = +(localStorage.getItem('budgetable.maj') || 0);
      if (distant && distant.donnees && distant.donnees.v === 1 && (!local || !local.plan || distant.maj > majLocale)) {
        localStorage.setItem(CLE, JSON.stringify(distant.donnees));
        charger();
        if (S.vue === 'accueil' && S.plan) S.vue = 'app';
        toast('Bon retour ! Vos menus et vos réglages sont là');
      } else if (local) { await envoyerSync(); toast('Vos données sont enregistrées dans votre compte'); }
      compte.sync = { t: Date.now(), ok: true };
    } catch (e) { compte.sync = { t: Date.now(), ok: false, erreur: e.message }; }
    rendre();
  }
  function champMdp(id, auto, label) {
    return `<label class="champ"><span>${label}</span><span class="mdp"><input type="${compte.voir ? 'text' : 'password'}" id="${id}" name="${id}" autocomplete="${auto}" minlength="8" required><button type="button" class="btn-lien small" data-a="compte-voir" aria-label="${compte.voir ? 'Masquer' : 'Afficher'} le mot de passe">${compte.voir ? 'Masquer' : 'Afficher'}</button></span></label>`;
  }
  function vueCompte() {
    if (!compte.vue) return '';
    const v = compte.vue;
    const titre = { inscription: 'Créer mon compte', connexion: 'Se connecter', oubli: 'Mot de passe oublié', 'nouveau-mdp': 'Nouveau mot de passe', envoye: 'Regardez vos e-mails', inactif: 'Comptes bientôt disponibles' }[v];
    const msg = compte.erreur ? `<p class="bandeau bandeau-alerte small" role="alert">${esc(compte.erreur)}</p>` : compte.msg ? `<p class="bandeau bandeau-ok small" role="status">${esc(compte.msg)}</p>` : '';
    const bouton = (t) => `<button class="btn btn-plein btn-grand" type="submit" ${compte.charge ? 'disabled' : ''}>${compte.charge ? 'Un instant…' : t}</button>`;
    let corps = '';
    if (v === 'inactif') corps = `<p>La création de comptes sera ouverte très bientôt. En attendant, Budgétable fonctionne entièrement sans compte : vos menus et réglages restent sur cet appareil.</p><div><button class="btn btn-plein" data-a="compte-sans">Continuer sans compte</button></div>`;
    else if (v === 'envoye') corps = `<p>${esc(compte.msg || 'Un e-mail vient de partir.')}</p><p class="small muted">Pensez à regarder dans les indésirables. Le lien ramène sur Budgétable et vous connecte.</p><div><button class="btn" data-a="compte-vue" data-k="connexion">Retour à la connexion</button></div>`;
    else if (v === 'inscription') corps = `<form class="stack form-compte" data-form="inscription" style="gap:12px" novalidate>
        <p class="small muted" style="margin:0">Gratuit. Retrouvez vos menus, listes et recettes sur tous vos appareils.</p>${msg}
        <label class="champ"><span>Prénom <span class="muted">(facultatif)</span></span><input type="text" id="c-prenom" name="prenom" autocomplete="given-name" maxlength="40"></label>
        <label class="champ"><span>E-mail</span><input type="email" id="c-email" name="email" autocomplete="email" required></label>
        ${champMdp('c-mdp', 'new-password', 'Mot de passe <span class="muted">(8 caractères au moins)</span>')}
        <label class="case small"><input type="checkbox" id="c-accord" required><span>J’accepte les <a href="conditions.html" target="_blank" rel="noopener">conditions d’utilisation</a> et que mes données Budgétable soient enregistrées dans mon compte (hébergé en Europe, voir la <a href="confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>).</span></label>
        ${bouton('Créer mon compte')}
        <p class="small" style="margin:0">Déjà un compte ? <button type="button" class="btn-lien" data-a="compte-vue" data-k="connexion">Se connecter</button></p></form>`;
    else if (v === 'connexion') corps = `<form class="stack form-compte" data-form="connexion" style="gap:12px" novalidate>${msg}
        <label class="champ"><span>E-mail</span><input type="email" id="c-email" name="email" autocomplete="email" required></label>
        ${champMdp('c-mdp', 'current-password', 'Mot de passe')}
        ${bouton('Se connecter')}
        <div class="row" style="gap:14px"><button type="button" class="btn-lien small" data-a="compte-vue" data-k="oubli">Mot de passe oublié ?</button><button type="button" class="btn-lien small" data-a="compte-lien">Recevoir un lien de connexion par e-mail</button></div>
        <p class="small" style="margin:0">Pas encore de compte ? <button type="button" class="btn-lien" data-a="compte-vue" data-k="inscription">Créer un compte</button></p></form>`;
    else if (v === 'oubli') corps = `<form class="stack form-compte" data-form="oubli" style="gap:12px" novalidate>${msg}
        <p class="small muted" style="margin:0">Indiquez votre adresse : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
        <label class="champ"><span>E-mail</span><input type="email" id="c-email" name="email" autocomplete="email" required></label>
        ${bouton('Envoyer le lien')}
        <p class="small" style="margin:0"><button type="button" class="btn-lien" data-a="compte-vue" data-k="connexion">Retour</button></p></form>`;
    else if (v === 'nouveau-mdp') corps = `<form class="stack form-compte" data-form="nouveau-mdp" style="gap:12px" novalidate>${msg}
        ${champMdp('c-mdp', 'new-password', 'Nouveau mot de passe <span class="muted">(8 caractères au moins)</span>')}
        ${bouton('Enregistrer')}</form>`;
    return `<div class="voile" data-a="compte-fond"><div class="fiche fenetre-compte" role="dialog" aria-modal="true" aria-labelledby="compte-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="row" style="gap:10px;align-items:center"><span class="logo-compte">${LOGO}</span><h2 id="compte-titre">${titre}</h2></div><button class="btn btn-petit" data-a="compte-fermer">Fermer</button></div>
      ${corps}</div></div>`;
  }
  // rafraîchit la fenêtre sans perdre ce qui est déjà tapé
  function rendreCompte() {
    const vals = [...document.querySelectorAll('.form-compte input')].map((x) => [x.id, x.type === 'checkbox' ? x.checked : x.value]);
    rendre();
    vals.forEach(([id, v]) => { const x = document.getElementById(id); if (x) { if (x.type === 'checkbox') x.checked = v; else x.value = v; } });
  }
  function ouvrirCompte(vue) { compte = { ...compte, vue: C.actif() ? vue : 'inactif', msg: '', erreur: '', charge: false }; }
  async function soumettreCompte(form) {
    const v = form.dataset.form;
    const val = (n) => (form.querySelector(`[name="${n}"]`) || {}).value || '';
    const email = val('email').trim(), mdp = val('c-mdp');
    if (v !== 'nouveau-mdp' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { compte.erreur = 'Adresse e-mail invalide.'; return rendreCompte(); }
    if ((v === 'inscription' || v === 'nouveau-mdp' || v === 'connexion') && mdp.length < (v === 'connexion' ? 1 : 8)) { compte.erreur = v === 'connexion' ? 'Indiquez votre mot de passe.' : 'Mot de passe trop court : 8 caractères au moins.'; return rendreCompte(); }
    if (v === 'inscription' && !form.querySelector('#c-accord').checked) { compte.erreur = 'Cochez la case pour accepter les conditions.'; return rendreCompte(); }
    compte.charge = true; compte.erreur = ''; rendreCompte();
    try {
      if (v === 'inscription') {
        const r = await C.inscrire(email, mdp, val('prenom').trim());
        if (r.connecte) { compte.vue = null; toast('Compte créé, bienvenue !'); await synchroniserConnexion(); }
        else compte = { ...compte, vue: 'envoye', msg: `Un e-mail de confirmation est parti à ${email}. Cliquez sur le lien qu’il contient pour activer votre compte.` };
      } else if (v === 'connexion') { await C.connecter(email, mdp); compte.vue = null; toast('Connecté'); await synchroniserConnexion(); }
      else if (v === 'oubli') { await C.motDePasseOublie(email); compte = { ...compte, vue: 'envoye', msg: `Si un compte existe pour ${email}, un lien pour changer le mot de passe vient d’y être envoyé.` }; }
      else if (v === 'nouveau-mdp') { await C.changerMotDePasse(mdp); compte.vue = null; toast('Mot de passe changé'); }
    } catch (e) { compte.erreur = e.message; }
    compte.charge = false; rendreCompte();
  }
  async function lienConnexion() {
    const champ = document.getElementById('c-email');
    const email = champ ? champ.value.trim() : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { compte.erreur = 'Indiquez d’abord votre adresse e-mail.'; return rendreCompte(); }
    compte.charge = true; rendreCompte();
    try { await C.lienMagique(email); compte = { ...compte, vue: 'envoye', msg: `Un lien de connexion vient de partir à ${email}.` }; } catch (e) { compte.erreur = e.message; }
    compte.charge = false; rendreCompte();
  }
  function blocCompte() {
    const u = C.utilisateur();
    if (!C.connecte()) return `<section class="stack bloc-compte"><h2>Mon compte</h2>
      <p>${C.actif() ? 'Créez un compte gratuit pour retrouver vos menus, votre liste et vos recettes sur votre téléphone et votre ordinateur. Sans compte, tout reste sur cet appareil.' : 'Vos réglages sont gardés sur cet appareil. Les comptes (retrouver ses menus sur tous ses appareils) ouvrent très bientôt.'}</p>
      <div class="row" style="gap:8px"><button class="btn btn-plein" data-a="compte-ouvrir" data-k="inscription">Créer un compte</button><button class="btn" data-a="compte-ouvrir" data-k="connexion">Se connecter</button></div></section>`;
    const s = compte.sync;
    return `<section class="stack bloc-compte"><h2>Mon compte</h2>
      <div class="carte-compte"><span class="avatar" aria-hidden="true">${esc(((u && (u.prenom || u.email)) || '?').charAt(0).toUpperCase())}</span><div class="stack" style="gap:2px;min-width:0"><strong>${esc((u && u.prenom) || 'Connecté')}</strong><span class="small muted" style="overflow-wrap:anywhere">${esc((u && u.email) || '')}</span>
        <span class="small ${s && !s.ok ? 'alerte-ing' : 'pourquoi'}">${s ? (s.ok ? `Synchronisé à ${new Date(s.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Synchronisation impossible pour le moment : vos changements restent sur cet appareil') : 'Synchronisation automatique'}</span></div></div>
      <div class="row" style="gap:8px"><button class="btn btn-petit" data-a="compte-sync">↻ Synchroniser</button><button class="btn btn-petit" data-a="compte-vue-mdp">Changer le mot de passe</button><button class="btn btn-petit" data-a="compte-deconnecter">Se déconnecter</button></div>
      ${S.confirmerSupprCompte ? `<div class="bandeau bandeau-alerte small"><div class="stack" style="gap:8px"><strong>Supprimer définitivement votre compte ?</strong><span>Le compte et les données enregistrées en ligne seront effacés. Ce qui est sur cet appareil reste là.</span><div class="row" style="gap:8px"><button class="btn btn-petit btn-danger" data-a="compte-supprimer-ok">Oui, supprimer</button><button class="btn btn-petit" data-a="compte-supprimer-non">Annuler</button></div></div></div>` : '<div><button class="btn-lien small" data-a="compte-supprimer">Supprimer mon compte</button></div>'}</section>`;
  }

  /* ---------- installer l'appli sur le téléphone ou l'ordinateur ---------- */
  let invitationInstall = null;
  const estInstallee = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const surIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); invitationInstall = ev; rendre(); });
  window.addEventListener('appinstalled', () => { invitationInstall = null; S.installee = true; toast('Budgétable est installé : retrouvez-le sur votre écran d’accueil'); rendre(); });
  function boutonInstaller(classe) {
    if (estInstallee() || DANS_UN_CADRE) return '';
    return `<button class="btn ${classe || ''}" data-a="installer">📲 Installer l’appli</button>`;
  }
  async function installer() {
    if (invitationInstall) {
      invitationInstall.prompt();
      try { const r = await invitationInstall.userChoice; if (r && r.outcome === 'accepted') S.installee = true; } catch (e) { /* */ }
      invitationInstall = null; rendre(); return;
    }
    S.aideInstall = true; rendre();
  }
  function bandeauInstaller() {
    if (estInstallee() || DANS_UN_CADRE || S.installIgnore || S.installee) return '';
    if (!invitationInstall && !surIOS()) return '';
    return `<div class="bandeau-installer ecran-seul"><img src="icons/icon-192.png" alt="" width="40" height="40"><div class="stack" style="gap:0;flex:1;min-width:0"><strong>Budgétable sur votre écran d’accueil</strong><span class="small muted">Une icône, plein écran, même sans connexion.</span></div><button class="btn btn-petit btn-plein" data-a="installer">Installer</button><button class="btn-lien small" data-a="installer-plus-tard" aria-label="Plus tard">✕</button></div>`;
  }
  function vueAideInstall() {
    if (!S.aideInstall) return '';
    const ios = surIOS();
    const partager = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
    const etapes = ios
      ? [[`Touchez le bouton <strong>Partager</strong> ${partager} en bas de Safari (en haut sur iPad).`, 'Il faut ouvrir Budgétable dans <strong>Safari</strong>.'], ['Faites défiler et touchez <strong>« Sur l’écran d’accueil »</strong>.', ''], ['Touchez <strong>« Ajouter »</strong> en haut à droite.', 'L’icône Budgétable apparaît avec vos autres applis.']]
      : /android/i.test(navigator.userAgent)
        ? [['Ouvrez le menu <strong>⋮</strong> de Chrome, en haut à droite.', ''], ['Touchez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.', ''], ['Confirmez avec <strong>« Installer »</strong>.', 'L’icône Budgétable apparaît sur l’écran d’accueil.']]
        : [['Dans Chrome ou Edge, cliquez sur l’icône <strong>Installer</strong> ⊕ à droite de la barre d’adresse.', 'Ou menu ⋮ puis « Installer Budgétable ».'], ['Confirmez avec <strong>« Installer »</strong>.', 'Budgétable s’ouvre dans sa propre fenêtre.'], ['Sur Safari (Mac) : menu <strong>Fichier</strong> puis <strong>« Ajouter au Dock »</strong>.', '']];
    return `<div class="voile" data-a="aide-install-fond"><div class="fiche fenetre-install" role="dialog" aria-modal="true" aria-labelledby="install-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="row" style="gap:12px;align-items:center"><img src="icons/icon-192.png" alt="" width="52" height="52" style="border-radius:12px"><div class="stack" style="gap:2px"><span class="eyebrow">${ios ? 'iPhone et iPad' : /android/i.test(navigator.userAgent) ? 'Android' : 'Ordinateur'}</span><h2 id="install-titre">Installer Budgétable</h2></div></div><button class="btn btn-petit" data-a="aide-install-fermer">Fermer</button></div>
      <ol class="etapes-install">${etapes.map(([t, d], i) => `<li><span class="num-etape">${i + 1}</span><div><p style="margin:0">${t}</p>${d ? `<p class="small muted" style="margin:4px 0 0">${d}</p>` : ''}</div></li>`).join('')}</ol>
      <p class="small muted" style="margin:0">C’est gratuit et sans magasin d’applications. L’appli se met à jour toute seule et garde vos menus et votre liste même sans connexion.</p>
    </div></div>`;
  }

  function vueAccueil() {
    const nbRec = E.RECETTES.length.toLocaleString('fr-FR');
    const nbIng = E.DATA.ingredients.filter((i) => !i.perso).length;
    const connecte = C.connecte();
    const FONCTIONS = [
      ['semaine', '#2f7a4f', 'Vos menus de la semaine', '7 déjeuners et 7 dîners selon vos goûts, votre budget, vos allergies et qui mange à la maison.'],
      ['courses', '#2f6fa3', 'La liste de courses toute faite', 'Rangée par rayon, avec les quantités exactes. À cocher en magasin, à envoyer ou à faire sur votre drive.'],
      ['placard', '#a8743f', 'Zéro gaspillage', 'Budgétable sait ce qu’il reste au placard et finit les paquets entamés avant d’en racheter.'],
      ['promos', '#d0502e', 'Les promos du moment', 'Les promotions de la semaine comparées à votre liste, pour payer moins cher.'],
      ['soir', '#c08a12', 'Gamelles et restes', 'On cuisine un peu plus le soir pour la gamelle du lendemain, avec les bonnes quantités.'],
      ['apports', '#2b8a7e', 'Bien manger, simplement', 'Calories, Nutri-Score, bilan de la semaine et coachs : minceur, sportif, famille, femmes de 40 ans et plus.']
    ];
    return `<div class="wrap accueil"><div class="store" aria-hidden="true"></div>
      <header class="accueil-entete"><div class="marque">${LOGO}Budgétable</div>
        <div class="row" style="gap:8px">${boutonInstaller('btn-petit')}${S.plan ? '<button class="btn btn-petit btn-plein" data-a="compte-reprendre">Ma semaine →</button>' : ''}${connecte ? (S.plan ? '' : '<button class="btn btn-petit" data-a="compte-reprendre">Mon espace</button>') : `<button class="btn btn-petit" data-a="compte-ouvrir" data-k="connexion">Se connecter</button>${S.plan ? '' : '<button class="btn btn-petit btn-plein" data-a="compte-ouvrir" data-k="inscription">Créer un compte</button>'}`}</div></header>
      <section class="accueil-hero">
        <div class="stack" style="gap:16px">
          <p class="eyebrow">Bien manger, petit budget</p>
          <h1>Des bons petits plats toute la semaine, sans vider le porte-monnaie</h1>
          <p class="accueil-sous">Deux minutes de questions, et Budgétable prépare vos menus, les recettes et une liste de courses qui évite le gaspillage.</p>
          <div class="row" style="gap:10px">${S.plan ? '<button class="btn btn-plein btn-grand" data-a="compte-reprendre">Retrouver ma semaine</button>' : '<button class="btn btn-plein btn-grand" data-a="commencer">Préparer ma semaine</button>'}${connecte ? '' : '<button class="btn btn-grand" data-a="compte-ouvrir" data-k="inscription">Créer mon compte gratuit</button>'}</div>
          <p class="small muted" style="margin:0">Gratuit · sans carte bancaire · à installer sur votre téléphone en un geste</p>
        </div>
        <div class="stickers">${ILLU_TABLE}<span class="sticker s1">Zéro gaspi</span><span class="sticker s2">Petit budget</span><span class="sticker s3">Fait maison</span></div>
      </section>
      <section class="chiffres" aria-label="Budgétable en chiffres">
        <div><strong class="num">${nbRec}</strong><span>recettes adaptées à votre foyer</span></div>
        <div><strong class="num">${nbIng}</strong><span>produits suivis, avec leur prix</span></div>
        <div><strong class="num">≈ 2 €</strong><span>l’assiette en moyenne, fait maison</span></div>
      </section>
      <section class="stack" style="gap:16px"><div class="titre-section"><p class="eyebrow">Tout au même endroit</p><h2>De l’idée du menu au panier</h2></div>
        <div class="fonctions">${FONCTIONS.map(([ic, c, t, d]) => `<article class="fonction" style="--c:${c}"><span class="fonction-ic">${ICONES[ic]}</span><h3>${t}</h3><p class="small muted">${d}</p></article>`).join('')}</div>
      </section>
      <section class="stack etapes-accueil" style="gap:16px"><div class="titre-section"><p class="eyebrow">Comment ça marche</p><h2>Trois étapes, et c’est prêt</h2></div>
        <ol class="etapes">
          <li><span class="num-etape">1</span><div><strong>Vous répondez à quelques questions</strong><p class="small muted">Qui mange à la maison, votre budget, vos goûts, vos allergies, le temps que vous avez.</p></div></li>
          <li><span class="num-etape">2</span><div><strong>Budgétable prépare la semaine</strong><p class="small muted">Menus variés, recettes pas à pas, quantités pour votre foyer. Changez un plat en un geste.</p></div></li>
          <li><span class="num-etape">3</span><div><strong>Vous faites les courses</strong><p class="small muted">Liste par rayon, promos du moment, drive guidé, placard mis à jour. Et bon appétit !</p></div></li>
        </ol>
      </section>
      <section class="carte stack compte-accueil" style="gap:12px"><h2>${connecte ? 'Vous êtes connecté' : 'Un compte pour vous suivre partout'}</h2>
        <p class="muted" style="margin:0">${connecte ? 'Vos menus, votre liste et vos recettes sont enregistrés dans votre compte et vous suivent sur tous vos appareils.' : 'Avec un compte gratuit, vos menus, votre liste et vos recettes vous suivent sur votre téléphone et votre ordinateur. Sans compte, tout fonctionne aussi : vos données restent sur cet appareil.'}</p>
        <div class="row" style="gap:8px">${connecte ? '<button class="btn btn-plein" data-a="compte-reprendre">Retrouver ma semaine</button>' : '<button class="btn btn-plein" data-a="compte-ouvrir" data-k="inscription">Créer mon compte</button><button class="btn" data-a="compte-ouvrir" data-k="connexion">J’ai déjà un compte</button>'}</div>
      </section>
      <section class="stack" style="gap:10px"><div class="titre-section"><p class="eyebrow">Questions fréquentes</p><h2>Bon à savoir</h2></div>
        <div class="faq">
          <details><summary>Est-ce vraiment gratuit ?</summary><p>Oui : menus, recettes, liste de courses, placard et suivi sont gratuits. Une formule Premium pourra s’ajouter plus tard pour des options en plus.</p></details>
          <details><summary>Faut-il créer un compte ?</summary><p>Non. Le compte sert seulement à retrouver vos données sur plusieurs appareils. Sans compte, tout reste sur votre appareil.</p></details>
          <details><summary>Les prix sont-ils ceux de mon magasin ?</summary><p>Ce sont des prix moyens estimés, pour comparer et tenir un budget. Les promotions du moment viennent des enseignes et sont à vérifier en magasin.</p></details>
          <details><summary>Et mes allergies ?</summary><p>Budgétable ne propose jamais un plat qui contient un aliment que vous avez signalé. Ces informations de santé ne sont enregistrées qu’avec votre accord.</p></details>
        </div>
      </section>
      <section class="appel-final"><h2>Prêt pour une semaine plus simple ?</h2><button class="btn btn-plein btn-grand" data-a="commencer">Préparer ma semaine</button></section>
      <div class="bandeau bandeau-demo small"><span class="tag tag-demo">Version de test</span><span>Les menus et listes fonctionnent réellement. Les prix sont des estimations de démonstration.</span></div>
      ${PIED}
    </div>`;
  }

  /* ---------- application ---------- */
  const GROUPES_NAV = [['Planifier', ['semaine', 'soir', 'recettes', 'petitdej', 'gourmand']], ['Faire les courses', ['courses', 'promos', 'placard']], ['Suivre', ['sport', 'minceur', 'apports', 'journal']], ['', ['profil']]];
  const COULEURS_NAV = { semaine: '#2f7a4f', soir: '#c08a12', recettes: '#b8492f', gourmand: '#c2577a', petitdej: '#d98a1f', courses: '#2f6fa3', promos: '#d0502e', placard: '#a8743f', apports: '#2b8a7e', minceur: '#3f8f5a', sport: '#2c6fb5', journal: '#6b5ea8', profil: '#5b6b62' };
  const ONGLETS = [['semaine', 'Semaine'], ['soir', 'Ce soir'], ['recettes', 'Recettes'], ['petitdej', 'Petit-déj'], ['gourmand', 'Gourmand'], ['placard', 'Placard'], ['courses', 'Courses'], ['promos', 'Promos'], ['sport', 'Sport'], ['minceur', 'Minceur'], ['apports', 'Apports'], ['journal', 'Journal'], ['profil', 'Profil']];
  function vueApp() {
    const bouton = (k) => { const v = (ONGLETS.find((x) => x[0] === k) || [k, k])[1]; return `<button data-a="onglet" data-k="${k}" style="--c:${COULEURS_NAV[k] || 'var(--poireau)'}" ${S.onglet === k ? 'aria-current="page"' : ''}><span class="nav-ic">${ICONES[k]}</span><span>${v}</span>${k === 'promos' && promos && promos.offres && promos.offres.length ? (nouvellesAlertes().length ? `<em class="nav-badge alerte">🔔 ${nouvellesAlertes().length}</em>` : `<em class="nav-badge">${promos.offres.length}</em>`) : ''}</button>`; };
    const nav = `<nav class="nav" aria-label="Navigation principale"><button class="nav-accueil" data-a="accueil" style="--c:#5b6b62"><span class="nav-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg></span><span>Accueil</span></button>${GROUPES_NAV.map(([titre, ks]) => `${titre ? `<span class="nav-groupe" aria-hidden="true">${titre}</span>` : '<span class="nav-sep" aria-hidden="true"></span>'}${ks.map(bouton).join('')}`).join('')}</nav>`;
    if (S.onglet === 'drives') { S.onglet = 'courses'; S.drivesOuverts = true; }
    const contenu = { semaine: ongletSemaine, soir: ongletSoir, recettes: ongletRecettes, gourmand: ongletGourmand, petitdej: ongletPetitDej, apports: ongletApports, minceur: ongletMinceur, sport: ongletSport, journal: ongletJournal, placard: ongletPlacard, courses: ongletCourses, promos: ongletPromos, profil: ongletProfil }[S.onglet]();
    return `<div class="wrap"><div class="store" aria-hidden="true"></div><div class="app"><aside class="cote">${nav}${bandeauNutri()}</aside><main class="stack" style="min-width:0">
      <div class="ecran-seul"><div class="entete" style="margin-bottom:10px"><button class="marque marque-lien" data-a="accueil" title="Page d’accueil">${LOGO}Budgétable</button><div class="row" style="gap:8px;align-items:center">${S.premium ? '<span class="tag tag-ok">Premium (test)</span>' : '<span class="tag tag-simu">Formule Découverte</span>'}${C.connecte() ? `<button class="puce-compte" data-a="onglet" data-k="profil" title="Mon compte"><span class="avatar petit" aria-hidden="true">${esc(((C.utilisateur() && (C.utilisateur().prenom || C.utilisateur().email)) || '?').charAt(0).toUpperCase())}</span><span class="sr">Mon compte</span></button>` : '<button class="btn btn-petit" data-a="compte-ouvrir" data-k="inscription">Créer un compte</button>'}</div></div><div class="nappe" aria-hidden="true"></div></div>
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

  /* ---------- budget : montant libre et calculateur à partir des charges du foyer ---------- */
  const SEMAINES_PAR_MOIS = 52 / 12;
  const CHARGES = [
    ['logement', 'Loyer ou crédit immobilier'], ['energie', 'Électricité, gaz, chauffage'], ['eau', 'Eau'], ['assurances', 'Assurances (habitation, auto, santé)'],
    ['transport', 'Transport, carburant, crédit auto'], ['telecom', 'Téléphone, internet, box'], ['credits', 'Autres crédits'], ['enfants', 'Garde, cantine, école'],
    ['impots', 'Impôts, taxe foncière (par mois)'], ['abonnements', 'Abonnements, sport, loisirs'], ['autres', 'Autres dépenses fixes']
  ];
  const NIVEAUX = [['serre', 'Serré', 0.22], ['equilibre', 'Équilibré', 0.3], ['confort', 'Confort', 0.38]];
  const nombre = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
  function calculBudget() {
    const c = S.budgetCalc || {};
    const revenus = nombre(c.revenu1) + nombre(c.revenu2) + nombre(c.aides);
    const charges = CHARGES.reduce((t, [k]) => t + nombre((c.charges || {})[k]), 0);
    const epargne = nombre(c.epargne);
    const reste = revenus - charges - epargne;
    const parts = (S.profil.foyer.adultes || 1) + (S.profil.foyer.enfants || []).length * 0.6;
    const propositions = NIVEAUX.map(([k, nom, taux]) => ({ k, nom, semaine: Math.max(0, Math.round(reste * taux / SEMAINES_PAR_MOIS)) }));
    return { revenus, charges, epargne, reste, parts, propositions, parJour: reste / 30 / Math.max(1, (S.profil.foyer.adultes || 1) + (S.profil.foyer.enfants || []).length) };
  }
  function resultatCalcul() {
    const r = calculBudget();
    if (!r.revenus) return '<p class="small muted">Indiquez vos revenus et vos charges : le calcul se fait au fur et à mesure.</p>';
    const estimation = S.plan ? E.listeCourses(S.plan, S.profil).total : null;
    const choisi = (S.budgetCalc || {}).niveau || 'equilibre';
    return `<div class="stack" style="gap:10px">
      <div class="chiffres-calc"><div><span class="small muted">Revenus</span><strong class="num">${euros(r.revenus)}</strong></div><div><span class="small muted">Charges${r.epargne ? ' et épargne' : ''}</span><strong class="num">− ${euros(r.charges + r.epargne)}</strong></div><div><span class="small muted">Reste à vivre</span><strong class="num ${r.reste < 0 ? 'negatif' : ''}">${euros(r.reste)}</strong></div></div>
      <span class="small muted">par mois · soit environ ${euros(Math.max(0, r.parJour))} par jour et par personne pour tout le reste (courses, vêtements, loisirs…)</span>
      ${r.reste <= 0 ? `<div class="bandeau bandeau-alerte small"><span>Vos charges dépassent vos revenus ce mois-ci. Des aides existent : votre CAF, le CCAS de votre mairie (aide alimentaire, épiceries solidaires), ou un conseiller « Point conseil budget », gratuit, qui aide à faire le point.</span></div>`
        : `<div class="stack" style="gap:6px"><strong>Budget courses conseillé</strong>
          <div class="propositions-budget" role="radiogroup" aria-label="Niveau de budget">${r.propositions.map((x) => `<button class="choix-budget" role="radio" data-a="calc-niveau" data-k="${x.k}" aria-checked="${choisi === x.k}"><span class="small">${x.nom}</span><strong class="num">${euros(x.semaine)}</strong><span class="small muted">par semaine</span></button>`).join('')}</div>
          <span class="small muted">Environ ${Math.round(NIVEAUX.find(([k]) => k === choisi)[2] * 100)} % du reste à vivre, pour les repas à la maison.${estimation != null ? ` Votre semaine actuelle est estimée à ${euros(estimation)}.` : ''}</span>
          ${r.propositions.find((x) => x.k === choisi).semaine < 20 * r.parts ? '<span class="small">C’est très serré : Budgétable choisira les plats les moins chers, et le Placard vous aidera à ne rien racheter. Le CCAS de votre mairie peut aussi vous orienter vers une épicerie solidaire.</span>' : ''}
          <button class="btn btn-plein" data-a="calc-appliquer">Utiliser ${euros(r.propositions.find((x) => x.k === choisi).semaine)} par semaine</button></div>`}
    </div>`;
  }
  function vueBudget() {
    if (!S.budgetOuvert) return '';
    const c = S.budgetCalc || {};
    const champ = (cle, label, valeur, aide) => `<label class="champ champ-euros"><span>${label}${aide ? ` <span class="small muted">${aide}</span>` : ''}</span><span class="saisie-euros"><input type="text" inputmode="decimal" autocomplete="off" data-a="calc-champ" data-k="${cle}" value="${esc(valeur || '')}" placeholder="0"><span aria-hidden="true">€</span></span></label>`;
    return `<div class="voile" data-a="budget-fond"><div class="fiche fenetre-budget" role="dialog" aria-modal="true" aria-labelledby="budget-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Budget courses</span><h2 id="budget-titre">Mon budget</h2></div>
        <button class="btn btn-petit" data-a="budget-fermer">Fermer</button></div>
      <section class="stack" style="gap:8px"><h3>Je connais mon budget</h3>
        <div class="row" style="gap:8px;align-items:flex-end">
          <label class="champ champ-euros" style="max-width:170px"><span>Montant</span><span class="saisie-euros"><input type="text" inputmode="decimal" id="budget-libre" autocomplete="off" value="${esc(String(S.budgetSaisi != null ? Math.round(S.budgetSaisi) : S.budgetPeriode === 'mois' ? Math.round(S.profil.budget * SEMAINES_PAR_MOIS) : S.profil.budget))}"><span aria-hidden="true">€</span></span></label>
          <div class="row" role="radiogroup" style="gap:4px">${[['semaine', 'par semaine'], ['mois', 'par mois']].map(([k, v]) => `<button class="chip" role="radio" data-a="budget-periode" data-k="${k}" aria-checked="${(S.budgetPeriode || 'semaine') === k}" aria-pressed="${(S.budgetPeriode || 'semaine') === k}">${v}</button>`).join('')}</div>
        </div>
        <div><button class="btn btn-plein btn-petit" data-a="budget-valider">Enregistrer ce budget</button></div>
      </section>
      <section class="stack" style="gap:10px"><h3>Je calcule mon budget</h3>
        <p class="small muted" style="margin:0">À partir de ce qui rentre et de ce qui sort chaque mois. Ces chiffres restent sur votre appareil.</p>
        <details class="carte" open><summary><strong>Revenus du foyer</strong> <span class="small muted">· nets, par mois</span></summary><div class="grille-calc">
          ${champ('revenu1', 'Salaire ou revenu 1', c.revenu1)}${champ('revenu2', 'Salaire ou revenu 2', c.revenu2)}${champ('aides', 'Allocations, aides, pensions', c.aides)}</div></details>
        <details class="carte" open><summary><strong>Charges fixes</strong> <span class="small muted">· par mois</span></summary><div class="grille-calc">
          ${CHARGES.map(([k, v]) => champ('c:' + k, v, (c.charges || {})[k])).join('')}</div></details>
        <details class="carte"><summary><strong>Épargne</strong> <span class="small muted">· facultatif</span></summary><div class="grille-calc">${champ('epargne', 'Mettre de côté chaque mois', c.epargne)}</div></details>
        <div id="calc-resultat" class="carte resultat-calc" aria-live="polite">${resultatCalcul()}</div>
      </section>
    </div></div>`;
  }

  function blocBudget() {
    const a = E.analyseBudget(S.plan, S.profil);
    const max = Math.max(a.estimation, a.budget) * 1.1;
    return `<section class="carte budget" aria-label="Budget de la semaine">
      <div class="spread"><h2>Budget de la semaine</h2><div class="row" style="gap:6px;align-items:center">${tagDemo}<button class="btn btn-petit" data-a="budget-ouvrir">Modifier ou calculer</button></div></div>
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

  /** Étoile des favoris : un plat favori revient environ trois fois par semaine, sans se répéter. */
  const etoileFav = (id) => { const f = S.classiques.includes(id); return `<button class="etoile-fav ${f ? 'on' : ''}" data-a="classique" data-r="${id}" aria-pressed="${f}" aria-label="${f ? 'Retirer des favoris' : 'Ajouter aux favoris'}" title="${f ? 'Dans vos favoris' : 'Ajouter aux favoris'}">${f ? '★' : '☆'}</button>`; };
  function ligneRepas(m, j, slot) {
    const lab = slot === 'dejeuner' ? 'Déjeuner' : 'Dîner';
    if (!m) return S.plan && S.plan.jours[j] && (S.plan.jours[j].passes || []).includes(slot) && posJour(j) === 0 ? `<div class="repas repas-passe"><span class="eyebrow">${lab}</span><span class="vide">Déjà passé : la semaine commence au ${slot === 'dejeuner' ? 'dîner' : 'déjeuner de demain'}</span></div>` : `<div class="repas"><span class="eyebrow">${lab}</span><span class="vide">Pris dehors</span></div>`;
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
    return `<div class="repas repas-illu ${m.dehors ? 'repas-dehors' : ''}"><div class="vignette">${V(r, 64)}</div><div class="repas-corps"><span class="eyebrow">${lab}${th ? ` · <span class="theme">${esc(th.libelle)}</span>` : ''}${m.choisiPar ? ` · choisi par ${esc(m.choisiPar)}` : ''}${r.variante ? ' · <span class="theme">✏️ ma version</span>' : ''}</span>
      <div class="titre-fav"><button class="titre-repas" data-a="fiche" data-j="${j}" data-s="${slot}">${esc(r.nom)}</button>${etoileFav(r.id)}</div>
      <div class="meta">${m.deRestes ? '<span>♻ restes d’hier soir</span>' : `<span>${r.temps} min</span>`}<span>${nb(m.portions)} portion${m.portions > 1 ? 's' : ''}${m.plus ? ` <strong class="plus-restes">+${nb(m.plus)}</strong>` : ''}</span><span class="part num">${euros(E.coutPortion(r))} la part</span>${nutriMini(r)}${note ? `<span aria-label="Votre note : ${note} sur 5">${'★'.repeat(note)}</span>` : ''}</div>
      ${m.extra ? `<span class="pourquoi small">Cuisinez ${pluriel(E.aCuisiner(m), 'portion')} : ${esc([m.extra.gamelles ? 'gamelles de demain' : '', m.extra.demain ? 'déjeuner de demain' : '', m.extra.congel ? 'congélateur' : ''].filter(Boolean).join(', '))}</span>` : raison && !m.deRestes && S.deduits[j + '-' + slot] !== 'cuisine' ? `<span class="pourquoi small">${esc(raison)}</span>` : ''}
      ${ligneMinceur(m, j, slot)}
      ${blocMange(r, j, slot)}</div></div>`;
  }
  // « C'est mangé » : on déduit du placard, puis on note le plat pour apprendre les goûts
  const AVIS = [[5, '😋', 'Adoré'], [4, '🙂', 'Bon'], [3, '😐', 'Moyen'], [1, '😕', 'Pas aimé']];
  function blocMange(r, j, slot) {
    const k = j + '-' + slot;
    if (S.deduits[k] === 'dehors') {
      return `<div class="mange-ok dehors-ok stack" style="gap:6px"><span class="small"><strong>🍽 Mangé dehors</strong> · ce plat ne compte pas : ni placard, ni courses, ni suivi <button class="btn-lien small" data-a="dehors-annuler" data-j="${j}" data-s="${slot}">annuler</button></span>
        <div><button class="btn btn-petit" data-a="dehors-noter" data-j="${j}" data-s="${slot}">Noter ce que j’ai mangé</button></div></div>`;
    }
    if (S.deduits[k] !== 'cuisine') {
      const restes = S.plan && S.plan.jours[j][slot] && S.plan.jours[j][slot].deRestes;
      const autres = `${restes ? '' : `<button class="btn btn-petit" data-a="choix" data-j="${j}" data-s="${slot}">Changer ce plat</button>`}<button class="btn btn-petit btn-dehors" data-a="dehors" data-j="${j}" data-s="${slot}" title="Repas pris à l’extérieur : le plat ne compte pas">🍽 Mangé dehors</button><button class="btn btn-petit" data-a="deplacer" data-j="${j}" data-s="${slot}" title="Mettre ce plat un autre jour">📅 Déplacer</button>`;
      if (mqMobile.matches) return `<div class="row" style="gap:6px"><button class="btn btn-petit btn-mange" data-a="mange" data-j="${j}" data-s="${slot}">✓ C’est mangé</button>${S.menuRepas === k ? autres : `<button class="btn btn-petit btn-plus" data-a="repas-plus" data-k="${k}" aria-label="Autres actions">⋯</button>`}</div>`;
      return `<div class="row" style="gap:6px">${restes ? '' : `<button class="btn btn-petit" data-a="choix" data-j="${j}" data-s="${slot}">Changer ce plat</button>`}<button class="btn btn-petit btn-mange" data-a="mange" data-j="${j}" data-s="${slot}">✓ C’est mangé</button><button class="btn btn-petit btn-dehors" data-a="dehors" data-j="${j}" data-s="${slot}" title="Repas pris à l’extérieur : le plat ne compte pas">🍽 Mangé dehors</button><button class="btn btn-petit" data-a="deplacer" data-j="${j}" data-s="${slot}" title="Mettre ce plat un autre jour">📅 Déplacer</button></div>`;
    }
    const note = S.notes[r.id] || 0;
    return `<div class="mange-ok stack" style="gap:6px">
      <span class="small"><strong>✓ Mangé</strong> · placard mis à jour <button class="btn-lien small" data-a="mange-annuler" data-j="${j}" data-s="${slot}">annuler</button></span>
      <div class="avis-rapide" role="radiogroup" aria-label="Votre avis sur ${esc(r.nom)}"><span class="small muted">Vous avez aimé ?</span>${AVIS.map(([n, e, t]) => `<button role="radio" aria-checked="${note === n}" class="${note === n ? 'on' : ''}" data-a="avis" data-r="${r.id}" data-n="${n}" title="${t}"><span aria-hidden="true">${e}</span><span class="small">${t}</span></button>`).join('')}</div>
    </div>`;
  }

  function moyenneAssiette() {
    let parts = 0;
    S.plan.jours.forEach((jp) => E.SLOTS.forEach((s) => { if (jp[s]) parts += jp[s].portions; }));
    if (!parts) return '';
    const l = E.listeCourses(S.plan, S.profil);
    return `<div class="moyenne"><span>Une assiette vous revient en moyenne à</span><strong class="num">${euros(l.consomme / parts)}</strong><span class="small muted">sur ${nb(parts)} parts adultes cette semaine · prix démo</span></div>`;
  }

  // téléphone : un jour à la fois, outils repliés
  const mqMobile = window.matchMedia ? window.matchMedia('(max-width: 699px)') : { matches: false };
  if (mqMobile.addEventListener) mqMobile.addEventListener('change', () => rendre());
  function carteJour(jp, j, t) {
    const totalMinceur = minceurDansSemaine() ? (() => { const rep = P.repartition(cibleProg()); const pd = (jp.gourmand || []).find((g) => g.moment === 'petitdej' && E.REC[g.recette]); const k = (pd ? (NUT(E.REC[pd.recette]) || {}).kcal || 0 : 0) + ['dejeuner', 'diner'].reduce((t, sl) => { const x = assietteRepas(jp[sl], j, sl, rep); return t + (x && !x.dehors ? x.kcal : 0); }, 0) + rep.collation; return `<span class="total-minceur small num" title="Total estimé pour vous, collation comprise">🥗 ≈ ${nb(Math.round(k / 10) * 10)} kcal</span>`; })() : '';
    return `<article class="jour ${j === t ? 'aujourdhui' : ''}" data-j="${j}"><header><h3>${jp.jour} <span class="date-jour">${new Date(dateDuJour(j) + 'T12:00:00').getDate()}</span></h3>${totalMinceur}${j === t ? '<span class="tag tag-ok">Aujourd’hui</span>' : ''}</header>
        ${lignesGourmandes(jp, true)}${!jp.dejeuner && jp.gamelles && jp.gamelles.n ? carteGamelle(j, true) : ligneRepas(jp.dejeuner, j, 'dejeuner') + (jp.dejeuner ? carteGamelle(j, false) : '')}${ligneRepas(jp.diner, j, 'diner')}${lignesGourmandes(jp, false)}</article>`;
  }
  function semaineMobile() {
    const t = aujourdhui();
    const j = S.jourMobile != null ? S.jourMobile : t;
    const liste = S.semaineEnListe;
    const ouvert = S.outilMobile || '';
    let repas = 0, couverts = 0;
    for (let x = 0; x < 7; x++) for (const sl of E.SLOTS) { const pr = presenceDe(x, sl); const n = pr.a + pr.e.filter(Boolean).length + pr.invA + pr.invE; if (n) { repas++; couverts += n; } }
    const g = S.profil.gamelles;
    const a = E.analyseBudget(S.plan, S.profil);
    const nut = window.Nutrition ? window.Nutrition.bilanSemaine(S.plan, E.REC, E.ING) : null;
    const coach = COACHS[S.profil.coach];
    const outils = [
      ['presences', '👥', 'Qui mange cette semaine', `${repas} repas · ${couverts} couverts`, blocPresences],
      ['gamelles', '🥡', 'Gamelles et restes', g && g.n && (g.jours || []).length ? `${g.n} par jour, ${g.jours.length} jours` : 'Aucune gamelle prévue', blocGamelles],
      ['coach', '🎯', 'Coach', coach ? `${coach.emoji} ${coach.court}` : 'Choisir un objectif', blocCoach],
      ['coachs', '🏃', 'Sport et minceur', S.profil.sport ? `${faitesSemaine().length}/${programmeSport().length} séances cette semaine` : S.profil.programme ? `Programme minceur · semaine ${S.profil.programme.semaine || 1}` : 'Coach sportif et programme minceur', blocMesCoachs],
      ['nutrition', '🥦', 'Bilan nutritionnel', nut ? `${nut.atteints} repères sur ${nut.reperes.length} atteints` : '—', blocNutritionSemaine],
      ['budget', '💶', 'Budget', a.ok ? `${euros(a.estimation)} · il reste ${euros(-a.ecart)}` : `${euros(a.estimation)} · ${euros(a.ecart)} de trop`, () => blocBudget() + moyenneAssiette()]
    ];
    const jours = joursOrdonnes().map(([jp, x]) => `<button class="jour-puce ${x === t ? 'auj' : ''}" role="tab" data-a="jour-mobile" data-j="${x}" aria-selected="${!liste && x === j}"><span>${JOURS_COURTS[x]}</span><strong>${new Date(dateDuJour(x) + 'T12:00:00').getDate()}</strong></button>`).join('');
    return `${bandeauSensible()}
      <div class="entete-semaine-m"><div><p class="eyebrow">Au menu</p><h1>Ma semaine</h1></div><button class="btn btn-petit" data-a="semaine-liste" aria-pressed="${!!liste}">${liste ? 'Un jour à la fois' : 'Toute la semaine'}</button></div>
      ${bandeauCoachs()}
      ${S.plan.alertes.map((x) => `<div class="bandeau bandeau-demo small">${esc(x)}</div>`).join('')}
      ${bandeauAlertes()}
      ${bandeauInstaller()}
      ${liste ? '' : `<div class="jours-puces" role="tablist" aria-label="Jour">${jours}</div>`}
      <div class="jours jours-m">${liste ? joursOrdonnes().map(([jp, x]) => carteJour(jp, x, t)).join('') : carteJour(S.plan.jours[j], j, t)}</div>
      ${suggestionRituels()}
      <section class="outils-m" aria-label="Réglages de la semaine"><h2 class="titre-outils">Ma semaine en un coup d’œil</h2>
        ${outils.map(([k, ic, titre, resume, f]) => `<div class="outil-m ${ouvert === k ? 'ouvert' : ''}"><button class="outil-tete" data-a="outil-mobile" data-k="${k}" aria-expanded="${ouvert === k}"><span class="outil-ic" aria-hidden="true">${ic}</span><span class="stack" style="gap:0;min-width:0;text-align:left"><strong>${titre}</strong><span class="small muted">${esc(resume)}</span></span><span class="chevron" aria-hidden="true">›</span></button>${ouvert === k ? `<div class="outil-corps">${f()}</div>` : ''}</div>`).join('')}
      </section>
      ${boutonDemarrer()}${carteMinceurSemaine()}
      <div class="actions-semaine-m"><button class="btn btn-petit" data-a="envoi-ouvrir" data-k="menu">📤 Envoyer</button><button class="btn btn-petit" data-a="affiche-ouvrir">🖨 Pour le frigo</button><button class="btn btn-petit btn-plein" data-a="refaire-plats">🔄 Refaire les plats</button><button class="btn btn-petit" data-a="nouvelle">↻ Nouvelle semaine</button></div>
      ${bandeauRefaire()}
      ${carteRituels()}`;
  }
  function ongletSemaine() {
    if (!S.plan) return '<p>Aucune semaine.</p>';
    if (mqMobile.matches) return semaineMobile();
    const t = aujourdhui();
    const restants = 'Changez vos plats autant que vous voulez';
    return `${bandeauSensible()}
      <div class="ardoise ardoise-titre"><span class="craie-petit">Au menu cette semaine</span><h1 class="craie">7 déjeuners, 7 dîners</h1><span class="craie-ligne">fait maison, petit prix, zéro gaspi</span></div>
      ${boutonDemarrer()}${carteMinceurSemaine()}
      ${bandeauRefaire()}
      <div class="row ecran-seul"><button class="btn btn-plein" data-a="refaire-plats" title="Nouveaux plats sur les mêmes jours ; les repas déjà mangés ou choisis restent">🔄 Refaire les plats</button><button class="btn" data-a="nouvelle" title="Recommence une semaine à partir d’aujourd’hui">Nouvelle semaine</button><button class="btn" data-a="affiche-ouvrir">🖨 Menu à afficher sur le frigo</button><button class="btn" data-a="envoi-ouvrir" data-k="menu">📤 Envoyer le menu</button></div>
      ${S.plan.alertes.map((a) => `<div class="bandeau bandeau-demo small">${esc(a)}</div>`).join('')}
      ${bandeauAlertes()}
      ${bandeauInstaller()}
      ${blocPresences()}
      ${blocGamelles()}
      ${blocCoach()}
      <div class="nutri-mobile">${blocNutritionSemaine()}</div>
      ${blocBudget()}
      ${moyenneAssiette()}
      ${suggestionRituels()}
      <p class="small muted">Touchez un plat pour la recette et pour le noter, ou « 3 idées » pour choisir autre chose.</p>
      <div class="jours">${joursOrdonnes().map(([jp, j]) => carteJour(jp, j, t)).join('')}</div>
      ${carteRituels()}
      <p class="small muted">${restants}.</p>`;
  }

  /* ---------- gamelles du midi et restes ---------- */
  const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  function majGamelles() {
    if (!S.plan) return;
    S.plan = E.appliquerPresences(S.plan, { ...S.profil, presences: S.plan.presences || S.profil.presences || {} }, optsMoteur());
    S.plan.debut = debutSemaine();
    E.organiserRestes(S.plan, S.profil);
  }
  function texteGamelle(j) {
    const g = S.plan.jours[j].gamelles;
    if (!g || !g.n) return '';
    return g.mode === 'restes' ? `restes du dîner de ${E.JOURS[g.source].toLowerCase()}` : 'plat à préparer la veille au soir';
  }
  // carte « gamelle » à la place du déjeuner (personne ne mange à la maison ce midi) ou ligne sous le déjeuner
  function carteGamelle(j, seule) {
    const g = S.plan.jours[j].gamelles;
    if (!g || !g.n || !E.REC[g.recette]) return '';
    const r = E.REC[g.recette];
    if (!seule) return `<button class="ligne-gamelle" data-a="gamelle-fiche" data-j="${j}"><span aria-hidden="true">🥡</span> ${pluriel(g.n, 'gamelle')} : ${esc(r.nom)} <span class="small muted">· ${texteGamelle(j)}</span></button>`;
    return `<div class="repas repas-illu repas-gamelle"><div class="vignette">${V(r, 64)}</div><div class="repas-corps"><span class="eyebrow">Déjeuner · 🥡 ${pluriel(g.n, 'gamelle')}</span>
      <button class="titre-repas" data-a="gamelle-fiche" data-j="${j}">${esc(r.nom)}</button>
      <span class="small ${g.mode === 'restes' ? 'pourquoi' : ''}">${g.mode === 'restes' ? `Restes du dîner de ${E.JOURS[g.source].toLowerCase()} : rien à cuisiner ce midi` : 'À préparer la veille au soir, quantités dans la recette'}</span>
      <div class="row" style="gap:6px"><button class="btn btn-petit" data-a="gamelles-ouvrir">Régler les gamelles</button></div></div></div>`;
  }
  function blocGamelles() {
    if (!S.plan) return '';
    const g = S.profil.gamelles;
    const restes = [];
    S.plan.jours.forEach((jp, j) => E.SLOTS.forEach((sl) => { const m = jp[sl]; if (m && m.extra && (m.extra.demain || m.extra.congel)) restes.push(`${E.JOURS[j].toLowerCase()} ${sl === 'diner' ? 'soir' : 'midi'} : ${[m.extra.demain ? 'déjeuner du lendemain' : '', m.extra.congel ? pluriel(m.extra.congel, 'portion') + ' au congélateur' : ''].filter(Boolean).join(' et ')}`); }));
    if (!g || !g.n || !(g.jours || []).length) {
      return `<section class="carte stack gamelles" style="gap:8px"><div class="spread"><h2>🥡 Gamelles et restes</h2></div>
        <p class="small" style="margin:0">Vous emportez votre déjeuner au travail ? Budgétable cuisine un peu plus le soir et met le reste en gamelle pour le lendemain midi : les quantités et la liste de courses suivent toutes seules.</p>
        <div class="row" style="gap:6px"><button class="btn btn-petit btn-plein" data-a="gamelles-ouvrir">Prévoir mes gamelles</button></div>
        ${restes.length ? `<p class="small muted" style="margin:0">Restes prévus : ${esc(restes.join(' · '))}.</p>` : '<p class="small muted" style="margin:0">Pour cuisiner en plus et garder des restes, ouvrez un plat : « Quantités et restes ».</p>'}</section>`;
    }
    const jours = S.plan.jours.map((jp, j) => [j, jp.gamelles]).filter(([, x]) => x && x.n);
    return `<section class="carte stack gamelles" style="gap:8px"><div class="spread"><h2>🥡 Gamelles du midi</h2><button class="btn btn-petit" data-a="gamelles-ouvrir">Régler</button></div>
      <p class="small muted" style="margin:0">${pluriel(g.n, 'gamelle')} par jour, ${esc(g.jours.slice().sort().map((j) => JOURS_COURTS[j].toLowerCase()).join(', '))}${g.mode === 'plat' ? ' · un plat préparé à part' : ' · avec les restes du dîner de la veille'}</p>
      <ul class="liste-gamelles">${jours.map(([j, x]) => `<li><strong>${JOURS_COURTS[j]}.</strong> <button class="btn-lien" data-a="gamelle-fiche" data-j="${j}">${esc(E.REC[x.recette].nom)}</button> <span class="small muted">${texteGamelle(j)}</span></li>`).join('')}</ul>
      ${restes.length ? `<p class="small muted" style="margin:0">Autres restes prévus : ${esc(restes.join(' · '))}.</p>` : ''}</section>`;
  }
  function vueGamelles() {
    if (!S.gamellesOuvert || !S.plan) return '';
    const g = { n: 1, jours: [0, 1, 2, 3, 4], mode: 'restes', ...(S.profil.gamelles || {}) };
    const parJour = S.plan.jours.map((jp, j) => [j, jp]).filter(([j]) => g.n && g.jours.includes(j));
    return `<div class="voile" data-a="gamelles-fond"><div class="fiche fenetre-gamelles" role="dialog" aria-modal="true" aria-labelledby="gam-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Semaine</span><h2 id="gam-titre">Mes gamelles du midi</h2></div><button class="btn btn-petit" data-a="gamelles-fermer">Fermer</button></div>
      <div class="spread ligne-presence"><span>Gamelles à préparer par jour</span><div class="row" style="gap:6px;align-items:center;flex-wrap:nowrap"><button class="btn btn-petit" data-a="gamelles-n" data-d="-1" aria-label="Une gamelle de moins" ${g.n <= 0 ? 'disabled' : ''}>−</button><strong class="num" style="min-width:1.5em;text-align:center">${g.n}</strong><button class="btn btn-petit" data-a="gamelles-n" data-d="1" aria-label="Une gamelle de plus">+</button></div></div>
      <div class="stack" style="gap:6px"><span class="small"><strong>Les jours</strong></span><div class="row" style="gap:6px">${JOURS_COURTS.map((jn, j) => `<button class="chip" data-a="gamelles-jour" data-j="${j}" aria-pressed="${g.jours.includes(j)}">${jn}</button>`).join('')}</div></div>
      <div class="stack" style="gap:6px" role="radiogroup" aria-label="Comment préparer les gamelles"><span class="small"><strong>Comment ?</strong></span>
        ${[['restes', 'Avec les restes du dîner de la veille', 'On cuisine plus le soir, le reste part dans la gamelle. Le moins cher et le plus simple.'], ['plat', 'Un plat à emporter, préparé à part', 'Salades, bowls, wraps, quiches : des plats qui se mangent froids ou se réchauffent bien.']].map(([k, t, d]) => `<button class="choix-gamelle" role="radio" aria-checked="${g.mode === k}" data-a="gamelles-mode" data-k="${k}"><strong>${t}</strong><span class="small muted">${d}</span></button>`).join('')}</div>
      ${parJour.length ? `<div class="stack" style="gap:6px"><span class="small"><strong>Jour par jour</strong></span><ul class="liste-gamelles detail">${parJour.map(([j, jp]) => { const x = jp.gamelles || {}; const mode = jp.gamelleMode || g.mode; return `<li><div class="spread" style="align-items:center"><strong>${E.JOURS[j]}</strong><span class="row" style="gap:4px">${[['restes', 'Restes'], ['plat', 'Plat à part'], ['non', 'Pas ce jour-là']].map(([k, v]) => `<button class="chip chip-petit" data-a="gamelle-jour-mode" data-j="${j}" data-k="${k}" aria-pressed="${mode === k}">${v}</button>`).join('')}</span></div>
          ${x.n && E.REC[x.recette] ? `<span class="small"><button class="btn-lien" data-a="gamelle-fiche" data-j="${j}">${esc(E.REC[x.recette].nom)}</button> · ${x.mode === 'restes' ? `restes du dîner de ${E.JOURS[x.source].toLowerCase()} (cuisiné pour ${pluriel(x.n, 'personne')} de plus)` : 'préparé la veille au soir'}${x.mode === 'plat' ? ` · <button class="btn-lien small" data-a="gamelle-changer" data-j="${j}">Un autre plat</button>` : ''}</span>${x.force ? '<span class="small muted">Pas de dîner la veille dans le planning : on prévoit un plat à part.</span>' : ''}` : '<span class="small muted">Pas de gamelle ce jour-là.</span>'}</li>`; }).join('')}</ul></div>` : ''}
      <p class="small muted" style="margin:0">Les restes se gardent 2 à 3 jours au réfrigérateur dans une boîte fermée : mettez la gamelle au frais dès la fin du repas. Ceux qui emportent une gamelle ne sont plus comptés au déjeuner à la maison.</p>
      <div><button class="btn btn-plein" data-a="gamelles-fermer">C’est réglé</button></div>
    </div></div>`;
  }
  // fiche : quantités à table, restes à prévoir, total à cuisiner
  function blocQuantites(m) {
    if (!fiche) return '';
    const pas = (a, val, label, min) => `<div class="row" style="gap:6px;align-items:center;flex-wrap:nowrap"><button class="btn btn-petit" data-a="${a}" data-d="-1" aria-label="${label} : moins" ${val <= min ? 'disabled' : ''}>−</button><strong class="num" style="min-width:2em;text-align:center">${nb(val)}</strong><button class="btn btn-petit" data-a="${a}" data-d="1" aria-label="${label} : plus">+</button></div>`;
    if (fiche.recette) return `<section class="carte-quantites stack" style="gap:8px"><h3>Quantités</h3><div class="spread"><span>Nombre de portions</span>${pas('fiche-portions', m.portions, 'Portions', 1)}</div><span class="small muted">Les quantités des ingrédients s’adaptent.</span></section>`;
    if (m.deRestes) return `<div class="bandeau bandeau-ok small">♻ Ce sont les restes du dîner d’hier : rien à cuisiner, il suffit de réchauffer ${pluriel(m.portions, 'portion')}.</div>`;
    const j = fiche.jour, sl = fiche.slot;
    const ex = m.extra || { gamelles: 0, demain: 0, congel: 0 };
    const suiv = S.plan.jours[j + 1];
    const demainOk = sl === 'diner' && suiv && suiv.dejeuner;
    const vers = m.restes && m.restes.vers;
    const parts = [`${nb(m.portions)} à table`].concat(ex.gamelles ? [`${nb(ex.gamelles)} pour ${pluriel(S.plan.jours[j + 1].gamelles.n, 'gamelle')} de demain`] : [], ex.demain ? [`${nb(ex.demain)} pour le déjeuner de demain`] : [], ex.congel ? [`${nb(ex.congel)} au congélateur`] : []);
    return `<section class="carte-quantites stack" style="gap:10px"><h3>Quantités et restes</h3>
      <div class="spread"><span>À table${m.manuel ? ' <button class="btn-lien small" data-a="fiche-portions-auto">revenir au calcul auto</button>' : ''}</span>${pas('fiche-portions', m.portions, 'Portions à table', 0.5)}</div>
      <div class="stack" style="gap:6px"><span class="small"><strong>Cuisiner en plus pour avoir des restes ?</strong></span><div class="row" style="gap:6px">
        <button class="chip" data-a="fiche-restes" data-k="non" aria-pressed="${!vers}">Non</button>
        ${demainOk ? `<button class="chip" data-a="fiche-restes" data-k="dejeuner" aria-pressed="${vers === 'dejeuner'}">Pour le déjeuner de demain</button>` : ''}
        <button class="chip" data-a="fiche-restes" data-k="congel" aria-pressed="${vers === 'congel'}">Pour le congélateur</button></div>
        ${vers === 'congel' ? `<div class="spread"><span class="small">Portions à congeler</span>${pas('fiche-congel', ex.congel || m.restes.n || 0, 'Portions à congeler', 1)}</div>` : ''}
        ${vers === 'dejeuner' ? `<span class="small muted">Le déjeuner de ${E.JOURS[j + 1].toLowerCase()} devient « restes » : rien à racheter pour ce repas.</span>` : ''}
        ${ex.gamelles ? `<span class="small pourquoi">+ ${nb(ex.gamelles)} pour les gamelles de ${E.JOURS[j + 1].toLowerCase()} midi</span>` : ''}</div>
      <div class="total-cuisson"><span>À cuisiner</span><strong class="num">${pluriel(E.aCuisiner(m), 'portion')}</strong></div>
      ${parts.length > 1 ? `<span class="small muted">${esc(parts.join(' + '))}. Les quantités ci-dessous sont pour tout ce qu’il faut cuisiner.</span>` : ''}
    </section>`;
  }

  /* ---------- affiche du frigo : la semaine en une page A4 paysage à imprimer ---------- */
  const STYLES_AFFICHE = [['papier', 'Papier crème'], ['ardoise', 'Ardoise'], ['eco', 'Économie d’encre']];
  function optsAffiche() { return { style: 'papier', images: true, douceurs: true, notes: true, titre: '', ...(S.afficheOpts || {}) }; }
  function celluleAffiche(m, o, g) {
    const gam = g && g.n && E.REC[g.recette] ? `<span class="aff-tag">🥡 ${pluriel(g.n, 'gamelle')}${m ? '' : ''}</span>` : '';
    if (!m && gam) { const r = E.REC[g.recette]; return `<div class="aff-case">${o.images && o.style !== 'eco' ? `<div class="aff-img">${V(r, 64).replace(/ loading="lazy"/g, '')}</div>` : ''}${gam}<strong>${esc(r.nom)}</strong><span class="aff-meta">${g.mode === 'restes' ? 'restes d’hier soir' : 'préparée la veille'}</span><span class="aff-coche" aria-hidden="true"></span></div>`; }
    if (!m) return '<div class="aff-case aff-vide"><span>Repas libre</span></div>';
    const r = E.REC[m.recette];
    if (!r) return '<div class="aff-case aff-vide"><span>—</span></div>';
    if (m.aChoisir) { const pr = prenomDuTour(); return `<div class="aff-case aff-enfants"><span class="aff-surprise" aria-hidden="true">?</span><strong>${pr ? 'Le choix de ' + esc(pr) : 'Le choix des enfants'}</strong><span class="aff-meta">surprise !</span></div>`; }
    const img = o.images && o.style !== 'eco' ? `<div class="aff-img">${V(r, 64).replace(/ loading="lazy"/g, '')}</div>` : '';
    return `<div class="aff-case">${img}${m.deRestes ? '<span class="aff-tag">♻ restes</span>' : ''}<strong>${esc(r.nom)}</strong><span class="aff-meta">${m.deRestes ? 'd’hier soir' : r.temps + ' min'}${m.choisiPar ? ' · choisi par ' + esc(m.choisiPar) : ''}${m.plus ? ` · +${nb(m.plus)} pour les restes` : ''}</span>${gam}<span class="aff-coche" aria-hidden="true"></span></div>`;
  }
  function affiche() {
    const o = optsAffiche(), p = S.plan;
    const o0 = ordreJours(), d0 = new Date(dateDuJour(o0[0]) + 'T12:00:00'), d6 = new Date(dateDuJour(o0[6]) + 'T12:00:00');
    const memeMois = d0.getMonth() === d6.getMonth();
    const periode = `du ${E.JOURS[o0[0]].toLowerCase()} ${d0.getDate()}${memeMois ? '' : ' ' + d0.toLocaleDateString('fr-FR', { month: 'long' })} au ${E.JOURS[o0[6]].toLowerCase()} ${d6.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    const lignes = [['dejeuner', 'Midi', '☀️'], ['diner', 'Soir', '🌙']].filter(([sl]) => p.jours.some((jp) => jp[sl]));
    const douceurs = o.douceurs && p.jours.some((jp) => (jp.gourmand || []).some((g) => E.REC[g.recette]));
    const cases = (j) => (p.jours[j].gourmand || []).filter((g) => E.REC[g.recette]).map((g) => `<span class="aff-douceur">${E.REC[g.recette].emoji} ${esc(E.REC[g.recette].nom)}</span>`).join('') || '<span class="aff-meta">—</span>';
    const cols = `grid-template-columns: 74px repeat(7, minmax(0, 1fr))`;
    return `<div class="affiche aff-${o.style}" lang="fr">
      <header class="aff-tete"><div><h1 class="aff-titre">${esc(o.titre || 'Au menu cette semaine')}</h1><p class="aff-periode">${periode}</p></div>
        <div class="aff-marque"><span class="aff-cloche" aria-hidden="true">🍽️</span><span>Budgétable</span></div></header>
      <div class="aff-grille" style="${cols}">
        <span></span>${joursOrdonnes().map(([jp, j]) => `<div class="aff-jour"><strong>${esc(jp.jour)}</strong><span>${new Date(dateDuJour(j) + 'T12:00:00').getDate()}</span></div>`).join('')}
        ${lignes.map(([sl, lib, ic]) => `<div class="aff-moment"><span aria-hidden="true">${ic}</span>${lib}</div>${joursOrdonnes().map(([jp]) => celluleAffiche(jp[sl], o, sl === 'dejeuner' ? jp.gamelles : null)).join('')}`).join('')}
        ${douceurs ? `<div class="aff-moment"><span aria-hidden="true">🍪</span>Douceur</div>${joursOrdonnes().map(([jp, j]) => `<div class="aff-case aff-case-douceur">${cases(j)}</div>`).join('')}` : ''}
      </div>
      ${o.notes ? `<footer class="aff-pied"><div class="aff-notes"><strong>À ne pas oublier</strong><i></i><i></i></div><div class="aff-notes"><strong>À racheter</strong><i></i><i></i></div><p class="aff-astuce">Cochez la case quand le plat est mangé ✓</p></footer>` : ''}
    </div>`;
  }
  function vueAffiche() {
    if (!S.afficheOuverte || !S.plan) return '';
    const o = optsAffiche();
    const imprimerDispo = !DANS_UN_CADRE && typeof window.print === 'function';
    const coche = (k, lib) => `<label class="case small"><input type="checkbox" data-a="affiche-opt" data-k="${k}" ${o[k] ? 'checked' : ''}><span>${lib}</span></label>`;
    return `<div class="affiche-voile" role="dialog" aria-modal="true" aria-label="Menu à afficher sur le frigo">
      <div class="affiche-outils ecran-seul">
        <div class="spread" style="align-items:center"><h2>Le menu du frigo</h2><div class="row" style="gap:6px">${imprimerDispo ? '<button class="btn btn-plein" data-a="affiche-imprimer">🖨 Imprimer ou PDF</button>' : ''}<button class="btn" data-a="affiche-fermer">Fermer</button></div></div>
        <div class="row" style="gap:6px" role="radiogroup" aria-label="Style">${STYLES_AFFICHE.map(([k, v]) => `<button class="chip" role="radio" data-a="affiche-style" data-k="${k}" aria-checked="${o.style === k}" aria-pressed="${o.style === k}">${v}</button>`).join('')}</div>
        <div class="row" style="gap:12px">${o.style !== 'eco' ? coche('images', 'Photos des plats') : ''}${coche('douceurs', 'Desserts et goûters')}${coche('notes', 'Cadre « à ne pas oublier »')}</div>
        <label class="champ"><span>Titre de l’affiche</span><input type="text" id="affiche-titre" maxlength="48" value="${esc(o.titre)}" placeholder="Au menu cette semaine"></label>
        ${imprimerDispo ? '<p class="small muted" style="margin:0">Une page A4 à l’horizontale. Dans la fenêtre d’impression, gardez « Graphiques d’arrière-plan » coché pour les couleurs.</p>' : '<p class="small muted" style="margin:0">Pour imprimer, ouvrez Budgétable dans votre navigateur ou installé sur votre appareil.</p>'}
      </div>
      <div class="affiche-cadre"><div class="affiche-echelle">${affiche()}</div></div>
    </div>`;
  }
  function ajusterAffiche() {
    const c = document.querySelector('.affiche-cadre'), a = document.querySelector('.affiche');
    if (!c || !a) return;
    const k = Math.min(1, c.clientWidth / 1123);
    a.style.transform = `scale(${k})`;
    c.querySelector('.affiche-echelle').style.height = Math.ceil(794 * k) + 'px';
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
    return `<details class="carte rituels" ${S.rituelsOuverts ? 'open' : ''}><summary data-a="rituels-ouvrir"><strong>Nos rituels et nos favoris</strong> <span class="small muted">· soirées à thème, plats préférés${nEnfants ? ', choix des enfants' : ''}</span></summary>
      <div class="stack" style="gap:14px;margin-top:12px">
        <div class="stack" style="gap:8px"><h3>Les dîners à thème</h3>
          <div class="grille-rituels">${E.JOURS.map((jn, j) => `<label class="champ"><span>${jn}</span><select data-a="rituel" data-j="${j}">${optionsTheme(j, r[j])}</select></label>`).join('')}</div>
          ${S.rituelsModifies ? '<div><button class="btn btn-plein btn-petit" data-a="rituels-appliquer">Refaire la semaine avec ces rituels</button></div>' : ''}
        </div>
        ${nEnfants ? `<div class="stack" style="gap:8px"><h3>Le choix des enfants</h3>
          <p class="small muted">Le soir « Le choix des enfants », c’est un enfant qui choisit le dîner parmi 3 plats en photo, chacun son tour d’une semaine à l’autre. Prénoms facultatifs, gardés sur cet appareil.</p>
          <div class="row">${Array.from({ length: nEnfants }, (_, i) => `<label class="champ" style="max-width:160px"><span>Enfant ${i + 1}</span><input type="text" maxlength="20" data-a="prenom" data-i="${i}" value="${esc(prenoms[i] || '')}" placeholder="Prénom"></label>`).join('')}</div></div>` : ''}
        <div class="stack" style="gap:8px"><h3>⭐ Nos favoris ${S.classiques.length ? `(${S.classiques.length})` : ''}</h3>
          <p class="small muted">Les valeurs sûres de la famille : deux reviennent chaque semaine, entre les découvertes. Ajoutez-en avec le cœur dans une recette (ou en lui donnant 5 étoiles).</p>
          ${S.classiques.length ? `<div class="row">${S.classiques.filter((id) => E.REC[id]).map((id) => `<span class="tag tag-classique">★ ${esc(E.REC[id].nom)} <button class="btn-lien" data-a="classique" data-r="${id}" aria-label="Retirer ${esc(E.REC[id].nom)} des favoris">✕</button></span>`).join('')}</div>` : '<p class="small">Aucun favori pour l’instant : touchez l’étoile ☆ à côté d’un plat.</p>'}
        </div>
      </div></details>`;
  }

  /* ---------- courses guidées sur le drive (sans extension) ---------- */
  const aAcheter = (liste) => liste.articles.filter((a) => !a.enStock);
  function resteCourses(liste) {
    const m = S.modeCourses || { absents: {} };
    return aAcheter(liste).filter((a) => !S.coches[a.id] && !(m.absents || {})[a.id]).length;
  }
  function vueCourses() {
    const m = S.modeCourses;
    if (!m || !m.ouvert || !S.plan || !S.drives.enseigne) return '';
    const d = DRIVES[S.drives.enseigne];
    const articles = aAcheter(E.listeCourses(S.plan, S.profil));
    const n = articles.length;
    const faits = articles.filter((a) => S.coches[a.id] || m.absents[a.id]).length;
    const barre = `<div class="progress" role="progressbar" aria-valuenow="${faits}" aria-valuemin="0" aria-valuemax="${n}" aria-label="Avancement des courses"><i style="width:${n ? Math.round(faits / n * 100) : 100}%"></i></div>`;
    const tete = (titre) => `<div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Mes courses chez ${esc(d.nom)} · ${faits} / ${n}</span><h2 id="courses-titre">${titre}</h2></div>
      <button class="btn btn-petit" data-a="courses-fermer">Fermer</button></div>${barre}`;
    if (m.i >= n) {
      const panier = articles.filter((a) => S.coches[a.id]);
      const absents = articles.filter((a) => m.absents[a.id]);
      const saisis = panier.filter((a) => m.prix[a.id] > 0);
      const totalSaisi = saisis.reduce((s2, a) => s2 + m.prix[a.id], 0);
      const estime = saisis.reduce((s2, a) => s2 + a.cout, 0);
      return `<div class="voile" data-a="courses-fond"><div class="fiche fenetre-courses" role="dialog" aria-modal="true" aria-labelledby="courses-titre">
        ${tete(absents.length ? 'Presque fini !' : 'Tout est dans votre panier !')}
        <p><strong>${pluriel(panier.length, 'article')}</strong> dans votre panier ${esc(d.nom)}.${saisis.length ? ` Prix notés : <strong class="num">${euros(totalSaisi)}</strong> pour ${pluriel(saisis.length, 'article')} (estimation Budgétable : ${euros(estime)}).` : ''}</p>
        ${absents.length ? `<div class="stack" style="gap:6px"><strong>Pas trouvés chez ${esc(d.nom)} :</strong><ul class="liste-absents">${absents.map((a) => `<li><span>${esc(a.nom)}</span><button class="btn-lien small" data-a="courses-aller" data-id="${a.id}">Réessayer</button></li>`).join('')}</ul>
          <p class="small muted">Astuce : un produit proche fait souvent l’affaire (autre marque, autre conditionnement).</p></div>` : ''}
        <a class="btn btn-plein btn-grand" href="${d.accueil}" target="_blank" rel="noopener">Valider ma commande sur ${esc(d.nom)} ↗</a>
        <button class="btn btn-grand" data-a="ranger-achats">Courses récupérées ? Les ranger dans mon placard</button>
        <p class="small muted">Vérifiez votre panier sur le site du drive (quantités, prix, créneau de retrait) avant de payer.</p>
        <div class="row"><button class="btn" data-a="courses-fermer">Retour à ma liste</button><button class="btn-lien small" data-a="courses-zero">Tout recommencer</button></div>
      </div></div>`;
    }
    const a = articles[m.i];
    const etat = S.coches[a.id] ? 'panier' : m.absents[a.id] ? 'absent' : '';
    return `<div class="voile" data-a="courses-fond"><div class="fiche fenetre-courses" role="dialog" aria-modal="true" aria-labelledby="courses-titre">
      ${tete(esc(a.nom))}
      <div class="article-courses">
        <span class="eyebrow">${esc(a.rayon)}</span>
        <p class="a-prendre">À prendre : <strong>${a.libre ? `${a.manuel} (ajouté à la main)` : a.sansPrix ? 'selon votre recette' : `${a.conditionnements} × ${esc(a.condLabel)}`}</strong></p>
        <p class="small muted">${a.sansPrix ? 'Ingrédient hors catalogue : prix à voir sur le drive' : `${a.unite !== 'pièce' ? `Pour vos recettes : ${quantite(a.quantite, a.unite)} · ` : ''}estimation ${euros(a.cout)}`}</p>
        ${etat ? `<span class="tag ${etat === 'panier' ? 'tag-ok' : 'tag-simu'}">${etat === 'panier' ? 'Dans votre panier' : 'Pas trouvé'}</span>` : ''}
      </div>
      <a class="btn btn-grand btn-chercher" href="${d.url(termeRecherche(a.nom))}" target="_blank" rel="noopener">1. Chercher « ${esc(termeRecherche(a.nom))} » chez ${esc(d.nom)} ↗</a>
      <p class="small muted">Le site du drive s’ouvre dans un nouvel onglet. Ajoutez le produit à votre panier, puis revenez ici.</p>
      <button class="btn btn-plein btn-grand" data-a="courses-panier" data-id="${a.id}">2. ✓ C’est dans mon panier</button>
      <label class="champ prix-paye"><span>Prix affiché (facultatif, pour suivre votre budget réel)</span><input type="text" inputmode="decimal" autocomplete="off" pattern="[0-9]+([,.][0-9]{1,2})?" placeholder="ex. 1,89" data-a="courses-prix" data-id="${a.id}" value="${m.prix[a.id] || ''}"></label>
      <div class="row" style="justify-content:space-between"><button class="btn" data-a="courses-absent" data-id="${a.id}">Pas trouvé</button><button class="btn" data-a="courses-stock" data-id="${a.id}">J’en ai déjà</button></div>
      <div class="row" style="justify-content:space-between"><button class="btn-lien small" data-a="courses-prec" ${m.i === 0 ? 'disabled' : ''}>← Précédent</button><button class="btn-lien small" data-a="courses-suiv">Passer →</button></div>
    </div></div>`;
  }
  function coursesSuivant() {
    const articles = aAcheter(E.listeCourses(S.plan, S.profil));
    const m = S.modeCourses;
    let i = m.i + 1;
    while (i < articles.length && (S.coches[articles[i].id] || m.absents[articles[i].id])) i++;
    m.i = i;
  }

  /* ---------- recherche d'un plat dans la fenêtre de changement ---------- */
  function resultatsRecherche() {
    if (!choix) return '';
    const t = (choix.recherche || '').trim();
    if (t.length < 2) return '<p class="small muted">Tapez quelques lettres : vos recettes et les 12 000 plats de Budgétable. Rien ne correspond ? Créez le plat, les ingrédients vous seront proposés.</p>';
    const r = E.rechercherPlats(S.profil, t, { slot: choix.slot, n: 6 });
    const lignes = r.resultats.map((id) => { const rec = E.REC[id]; return `<li><button class="resultat" data-a="choisir" data-r="${id}"><span class="vignette">${V(rec, 40)}</span><span><strong>${esc(rec.nom)}</strong><span class="small muted">${rec.perso ? 'Mes recettes · ' : ''}${rec.temps} min · ${euros(E.coutPortion(rec))} la part</span></span></button></li>`; }).join('');
    return `${lignes ? `<ul class="resultats">${lignes}</ul>` : `<p class="small">Aucun plat « ${esc(t)} » dans Budgétable${r.masques ? ` compatible avec votre profil (${pluriel(r.masques, 'plat écarté')} pour vos allergies, régime ou goûts)` : ''}.</p>`}
      <button class="btn btn-petit btn-plein" data-a="saisir-plat">+ Créer « ${esc(t)} » : je coche les ingrédients</button>`;
  }

  /* ---------- saisie d'une recette (bibliothèque) : nom, lien, ingrédients proposés à cocher ---------- */
  function ouvrirEdition(depart = {}) {
    const ex = depart.id ? (depart.gourmand ? S.gourmandPerso : S.bibliotheque).find((r) => r.id === depart.id) : null;
    edition = ex ? {
      id: ex.id, nom: ex.nom, lien: ex.lien || '', photo: ex.photo || null, photoSource: ex.photoSource || '', personnes: ex.personnes || personnesFoyer(), repas: ex.repas && ex.repas.length === 1 ? ex.repas[0] : 'tous', temps: ex.temps || '', etape: 'ingredients', proposer: ex.proposer !== false,
      ing: ex.ing.map(([id, q]) => ({ id, q, coche: true })), extras: (ex.extras || []).map((x) => ({ ...(typeof x === 'string' ? { nom: x, tags: [] } : x), coche: true })), retires: [], source: '', placer: null
    } : { nom: depart.nom || '', lien: '', photo: null, photoSource: '', personnes: personnesFoyer(), repas: depart.slot || 'tous', temps: '', etape: 'nom', proposer: true, ing: [], extras: [], retires: [], source: '', placer: depart.placer || null };
    edition.gourmand = !!depart.gourmand;
    edition.type = ex && ex.type ? ex.type : 'gouter';
    if (ex && depart.gourmand) edition.personnes = ex.parts || ex.personnes || edition.personnes;
    if (!ex && edition.nom.trim().length >= 2) devinerEdition();
  }
  // sucre, chocolat, fruits… devinés comme « autres ingrédients » : ce sont maintenant des produits du catalogue
  function extrasVersCatalogue(ed) {
    const restants = [];
    for (const x of ed.extras) {
      const id = window.Saisie.versCatalogue(x.nom);
      if (id && !E.ingredientInterdit(E.ING[id], S.profil)) { if (!ed.ing.some((y) => y.id === id)) ed.ing.push({ id, q: window.Saisie.QTE_SUCRE[id] || 20, coche: x.coche }); }
      else restants.push(x);
    }
    ed.extras = restants;
  }
  const personnesFoyer = () => Math.max(1, Math.min(12, (S.profil.foyer.adultes || 1) + (S.profil.foyer.enfants || []).length));
  function devinerEdition() {
    const g = window.Saisie.devinerIngredients(edition.nom, S.profil);
    const garde = edition.ing.filter((x) => x.manuel);
    edition.ing = g.coches.map(([id, q]) => ({ id, q, coche: true })).concat(g.suggestions.map(([id, q]) => ({ id, q, coche: false })));
    for (const x of garde) if (!edition.ing.some((y) => y.id === x.id)) edition.ing.push(x);
    ajouterIdees(g.dessert);
    edition.extras = g.extras.concat(edition.extras.filter((x) => x.manuel && !g.extras.some((y) => y.nom === x.nom)));
    if (g.dessert) for (const n of ['sucre', 'chocolat']) if (!edition.extras.some((y) => y.nom === n)) edition.extras.push({ nom: n, tags: window.Saisie.tagsExtra(n) || [], coche: false });
    edition.retires = g.retires; edition.source = g.source; edition.etape = 'ingredients'; edition.ignores = [];
    extrasVersCatalogue(edition);
  }
  // idées à ajouter d'un clic : ingrédients courants, jamais un ingrédient interdit par le profil
  function ajouterIdees(dessert) {
    const idees = dessert ? ['oeufs', 'lait', 'beurre', 'farine', 'creme', 'yaourt', 'citron']
      : ['oignon', 'ail', 'huile_olive', 'beurre', 'creme', 'emmental', 'persil', 'citron', 'tomates_concassees', 'champignon', 'carotte', 'courgette', 'riz', 'pates', 'pomme_de_terre', 'oeufs', 'lait', 'bouillon'];
    for (const id of idees) {
      if (edition.ing.filter((x) => !x.coche).length >= 12) break;
      if (!edition.ing.some((y) => y.id === id) && !E.ingredientInterdit(E.ING[id], S.profil)) edition.ing.push({ id, q: window.Saisie.QTE[id] || 100, coche: false });
    }
  }

  /* ---------- lecture du lien : la vraie liste d'ingrédients de la recette ---------- */
  const LECTEUR = window.BUDGETABLE_LECTEUR || 'https://budgetable-recettes.onrender.com';
  const lienValide = (l) => /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(String(l || '').trim());
  let minuterieLien = null;
  async function lireLien() {
    const ed = edition;
    if (!ed || !lienValide(ed.lien)) return;
    const lien = ed.lien.trim();
    let site = '';
    try { site = new URL(lien).hostname.replace(/^www\./, ''); } catch (e) { return; }
    ed.lecture = { etat: 'encours', lien, site };
    rendre();
    let d = null, message = '';
    try {
      const rep = await fetch(`${LECTEUR}/recette?url=${encodeURIComponent(lien)}`, { signal: AbortSignal.timeout ? AbortSignal.timeout(70000) : undefined });
      const j = await rep.json().catch(() => ({}));
      if (rep.ok && j.ingredients && j.ingredients.length) d = j; else message = j.erreur || 'Impossible de lire cette page';
    } catch (e) { message = 'Lecture impossible pour le moment (connexion ?)'; }
    if (edition !== ed || ed.lien.trim() !== lien) return;   // fenêtre fermée ou lien changé entre-temps
    if (d) appliquerRecette(d);
    else {
      ed.lecture = { etat: 'echec', lien, site, message };
      if (ed.nom.trim().length < 2) ed.nom = window.Saisie.nomDepuisLien(lien);
      if (ed.nom.trim().length >= 2 && !ed.ing.some((x) => x.coche)) devinerEdition();
    }
    rendre();
  }
  // photo réduite à 480 px (JPEG ~30 Ko) : elle tient dans le navigateur, même hors ligne
  async function reduirePhoto(blob) {
    const img = await createImageBitmap(blob);
    const k = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  }
  async function photoDuSite(url, site) {
    const ed = edition;
    if (!ed || !url || ed.photoSource === 'perso') return;
    ed.photoAttente = true; rendre();
    try {
      const rep = await fetch(`${LECTEUR}/image?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout ? AbortSignal.timeout(40000) : undefined });
      if (!rep.ok) throw new Error();
      const d = await reduirePhoto(await rep.blob());
      if (edition === ed && ed.photoSource !== 'perso') { ed.photo = d; ed.photoSource = site || ''; }
    } catch (e) { /* pas de photo : le dessin reste */ }
    if (edition === ed) { ed.photoAttente = false; rendre(); }
  }
  async function photoPerso(fichier) {
    const ed = edition;
    if (!ed || !fichier) return;
    if (!/^image\//.test(fichier.type)) { toast('Choisissez une photo (JPEG, PNG…)'); return; }
    try {
      const d = await reduirePhoto(fichier);
      if (edition === ed) { ed.photo = d; ed.photoSource = 'perso'; rendre(); toast('Photo ajoutée'); }
    } catch (e) { toast('Cette photo ne peut pas être lue'); }
  }
  function blocPhoto(e) {
    const apercu = e.photo ? `<img src="${esc(e.photo)}" alt="Photo du plat">` : `<span class="photo-vide">${e.photoAttente ? '<span class="rond-attente" aria-hidden="true"></span>' : '📷'}</span>`;
    const legende = e.photoAttente ? 'Récupération de la photo…' : e.photo ? (e.photoSource === 'perso' ? 'Votre photo' : `Photo de ${esc(e.photoSource || 'la recette')}`) : 'Pas encore de photo';
    return `<div class="bloc-photo"><div class="apercu-photo">${apercu}</div>
      <div class="stack" style="gap:6px"><strong class="small">${legende}</strong>
        <label class="btn btn-petit ${e.photo ? '' : 'btn-plein'} choisir-photo">${e.photo && e.photoSource !== 'perso' ? 'Mettre ma propre photo' : e.photo ? 'Changer la photo' : 'Ajouter une photo'}<input type="file" accept="image/*" data-a="ed-photo" class="visuellement-cache"></label>
        ${e.photo ? '<button class="btn-lien small" data-a="ed-photo-retirer" style="align-self:flex-start">Retirer la photo</button>' : '<span class="small muted">Prenez votre plat en photo ou choisissez-en une : elle reste sur cet appareil.</span>'}</div></div>`;
  }
  function appliquerRecette(d) {
    const ed = edition;
    if (ed.nom.trim().length < 2 && d.nom) ed.nom = d.nom.split(/\s+[:|–—-]\s+/)[0].replace(/\s+(facile|rapide|maison)$/i, '').trim() || d.nom;
    if (!ed.temps && d.temps > 0 && d.temps < 600) ed.temps = d.temps;
    const a = window.Saisie.analyserIngredients(d.ingredients, d.portions, S.profil);
    const garde = ed.ing.filter((x) => x.manuel && !a.coches.some(([id]) => id === x.id));
    ed.ing = a.coches.map(([id, q]) => ({ id, q, coche: true })).concat(garde);
    ed.extras = a.extras.concat(ed.extras.filter((x) => x.manuel && !a.extras.some((y) => y.nom === x.nom)));
    ajouterIdees(/gateau|cake|tarte|crumble|clafoutis|flan|cookie|muffin|brownie|fondant|crepe/.test(E.norm(ed.nom)) || a.extras.some((x) => x.nom === 'sucre'));
    if (d.portions > 0 && d.portions <= 30) ed.personnes = d.portions;
    ed.retires = a.retires; ed.ignores = a.ignores; ed.etape = 'ingredients';
    ed.source = `la recette ${d.site || ''}`.trim();
    ed.lecture = { etat: 'ok', lien: ed.lien.trim(), site: d.site, n: a.coches.length + a.extras.length, portions: d.portions };
    if (d.image && !(ed.photo && ed.photoSource === 'perso')) setTimeout(() => photoDuSite(d.image, d.site), 0);
  }
  function etatLecture(e) {
    const l = e.lecture;
    if (!l || l.lien !== e.lien.trim()) return lienValide(e.lien) ? `<div><button class="btn btn-petit btn-plein" data-a="ed-lire">Reprendre les ingrédients de cette recette</button></div>` : '';
    if (l.etat === 'encours') return `<p class="lecture small" role="status"><span class="rond-attente" aria-hidden="true"></span> Lecture de la recette sur ${esc(l.site)}… <span class="muted">(la première lecture peut prendre jusqu’à une minute)</span></p>`;
    if (l.etat === 'ok') return `<p class="lecture lecture-ok small" role="status">✓ ${pluriel(l.n, 'ingrédient repris', 'ingrédients repris')} de ${esc(l.site)}${l.portions ? `, recette pour ${l.portions}` : ''}. Vérifiez et décochez si besoin.${e.ignores && e.ignores.length ? ` <span class="muted">Non comptés : ${esc(e.ignores.slice(0, 6).join(', ').toLowerCase())}.</span>` : ''}</p>`;
    return `<p class="lecture lecture-echec small" role="status">${esc(l.message)} sur ${esc(l.site)}. ${e.ing.some((x) => x.coche) ? 'Ingrédients proposés d’après le nom du plat : vérifiez-les.' : 'Écrivez le nom du plat pour qu’on vous propose les ingrédients.'} <button class="btn-lien small" data-a="ed-lire">Réessayer</button></p>`;
  }
  const libAllergie = (r) => String(r || '').replace(/allergie : (\w+)/, (m, a) => 'allergie : ' + ((L.allergies || {})[a] || a).toLowerCase());
  function qteTexte(id, q) {
    const i = E.ING[id];
    if (i.unite === 'pièce') return q >= 1 ? `${nb(q)} par personne` : 'un peu';
    return `${nb(q)} ${i.unite} par personne`;
  }
  // quantité pour toute la recette (N personnes), arrondie comme on l'écrirait
  function qteRecette(id, q, n) {
    const t = q * n, i = E.ING[id];
    if (i.unite === 'pièce') return Math.round(t * 4) / 4;
    return t >= 100 ? Math.round(t / 5) * 5 : t >= 10 ? Math.round(t) : Math.round(t * 10) / 10;
  }
  const uniteCourte = (id) => { const i = E.ING[id]; return i.unite === 'pièce' ? (/oeuf/.test(id) ? 'œuf(s)' : id === 'pain' ? 'baguette(s)' : id === 'bouillon' ? 'cube(s)' : 'pièce(s)') : i.unite; };
  // liens de recherche du plat sur internet (ouverts dans un nouvel onglet ; rien n'est envoyé tant qu'on ne clique pas)
  function liensRecherche(nom) {
    const t = String(nom || '').trim();
    if (t.length < 2) return '<p class="small muted">Écrivez le nom du plat : vous pourrez chercher sa recette sur internet, puis coller son lien ci-dessous.</p>';
    const q = encodeURIComponent(t);
    const qr = encodeURIComponent(/recette/i.test(t) ? t : 'recette ' + t);
    const liens = [
      ['Sur internet', `https://www.google.com/search?q=${qr}`],
      ['Marmiton', `https://www.marmiton.org/recettes/recherche.aspx?aqt=${q}`],
      ['En vidéo', `https://www.youtube.com/results?search_query=${qr}`]
    ];
    return `<div class="stack" style="gap:6px"><span class="small"><strong>Chercher « ${esc(t)} »</strong> <span class="muted">· s’ouvre dans un nouvel onglet ; copiez ensuite le lien de la recette qui vous plaît</span></span>
      <div class="row" style="gap:6px">${liens.map(([lib, url]) => `<a class="chip lien-chercher" href="${url}" target="_blank" rel="noopener noreferrer">${lib} ↗</a>`).join('')}</div></div>`;
  }
  function vueEdition() {
    if (!edition) return '';
    const e = edition;
    const lienOk = !e.lien || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(e.lien.trim());
    const nCoches = e.ing.filter((x) => x.coche).length + e.extras.filter((x) => x.coche).length;
    const ou = e.placer ? `${e.placer.slot === 'diner' ? 'dîner' : 'déjeuner'} du ${E.JOURS[e.placer.jour].toLowerCase()}` : '';
    const aProposer = e.ing.map((x, i) => [x, i]).filter(([x]) => !x.coche);
    const extrasProposes = e.extras.map((x, i) => [x, i]).filter(([x]) => !x.coche);
    const dansRecette = e.ing.map((x, i) => [x, i]).filter(([x]) => x.coche);
    const extrasDans = e.extras.map((x, i) => [x, i]).filter(([x]) => x.coche);
    const ingredients = e.etape !== 'ingredients' ? '' : `<div class="stack" style="gap:12px">
        <div class="spread" style="align-items:center"><h3>Ingrédients</h3>
          <div class="row personnes-recette" style="gap:6px;align-items:center;flex-wrap:nowrap"><span class="small">Recette pour</span>
            <button class="btn btn-petit" data-a="ed-pers" data-d="-1" aria-label="Une personne de moins" ${e.personnes <= 1 ? 'disabled' : ''}>−</button>
            <strong class="num" id="ed-personnes" aria-live="polite">${e.personnes}</strong>
            <button class="btn btn-petit" data-a="ed-pers" data-d="1" aria-label="Une personne de plus" ${e.personnes >= 30 ? 'disabled' : ''}>+</button><span class="small">pers.</span></div></div>
        <div class="propositions stack" style="gap:8px">
          <span class="small"><strong>Touchez pour ajouter</strong>${e.source ? ` <span class="muted">· idées d’après le ${esc(e.source)}</span>` : ''}</span>
          ${aProposer.length || extrasProposes.length ? `<div class="row puces-ajout">${aProposer.map(([x, i]) => `<button class="chip puce-ajout" data-a="ed-ajouter" data-type="ing" data-i="${i}">+ ${esc(E.ING[x.id].nom)}</button>`).join('')}${extrasProposes.map(([x, i]) => `<button class="chip puce-ajout ${x.alerte ? 'puce-alerte' : ''}" data-a="ed-ajouter" data-type="extra" data-i="${i}">+ ${esc(x.nom)}${x.alerte ? ` (${esc(libAllergie(x.alerte))})` : ''}</button>`).join('')}</div>` : '<span class="small muted">Toutes les idées sont dans votre recette.</span>'}
          <label class="champ"><span>Un autre ingrédient ?</span><input type="search" id="ajout-ing" data-a="ajout-ing" placeholder="Ex. courgette, crème, crevettes…" autocomplete="off"></label>
          <div id="propositions-ing" class="row" style="gap:6px"></div>
        </div>
        <div class="dans-recette stack" style="gap:6px">
          <div class="spread"><strong>Dans votre recette (${nCoches})</strong><span class="small muted">décochez pour retirer</span></div>
          ${nCoches ? `<ul class="ing-cocher">${dansRecette.map(([x, i]) => `<li class="ing-qte"><label class="case"><input type="checkbox" data-a="ed-ing" data-i="${i}" checked><span>${esc(E.ING[x.id].nom)}</span></label>
              <span class="qte-saisie"><input type="text" inputmode="decimal" data-a="ed-qte" data-i="${i}" value="${nb(qteRecette(x.id, x.q, e.personnes))}" aria-label="Quantité de ${esc(E.ING[x.id].nom)} pour ${e.personnes} personnes"><span class="small muted">${esc(uniteCourte(x.id))}</span></span></li>`).join('')}
            ${extrasDans.map(([x, i]) => `<li><label class="case"><input type="checkbox" data-a="ed-extra" data-i="${i}" checked><span>${esc(x.nom.charAt(0).toUpperCase() + x.nom.slice(1))} <span class="small muted">· hors catalogue, prix à voir en magasin</span>${x.alerte ? ` <strong class="alerte-ing">Attention : ${esc(libAllergie(x.alerte))}</strong>` : ''}</span></label></li>`).join('')}</ul>`
            : '<p class="small muted">Aucun ingrédient pour l’instant : touchez les idées ci-dessus.</p>'}
          <p class="small muted">Quantités pour ${pluriel(e.personnes, 'personne')}, modifiables. Pour vos menus, Budgétable les adapte à votre foyer.</p>
        </div>
        ${e.retires.length ? `<p class="small">Non proposés : ${esc(e.retires.map(libAllergie).join(', '))}.</p>` : ''}
      </div>`;
    return `<div class="voile" data-a="edition-fond"><div class="fiche fenetre-edition" role="dialog" aria-modal="true" aria-labelledby="edition-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">${e.id ? 'Modifier une recette' : 'Mes recettes'}${ou ? ' · pour le ' + ou : ''}</span><h2 id="edition-titre">${e.id ? esc(e.nom) : e.gourmand ? 'Ajouter un dessert ou un goûter' : 'Ajouter une recette'}</h2></div>
        <button class="btn btn-petit" data-a="edition-fermer">Fermer</button></div>
      <label class="champ"><span>Nom du plat</span><input type="text" id="ed-nom" data-a="ed-champ" data-k="nom" maxlength="90" value="${esc(e.nom)}" placeholder="Ex. Lasagnes de mamie, Wok de crevettes…" autocomplete="off"></label>
      ${blocPhoto(e)}
      <div id="liens-recherche">${liensRecherche(e.nom)}</div>
      <label class="champ"><span>Lien de la recette (facultatif)</span><input type="url" id="ed-lien" data-a="ed-champ" data-k="lien" inputmode="url" value="${esc(e.lien)}" placeholder="https://www.marmiton.org/recettes/…" autocomplete="off"></label>
      ${lienOk ? `<div id="etat-lecture">${etatLecture(e)}</div>` : '<p class="small alerte-ing">Le lien doit commencer par https:// (copiez-le depuis la barre d’adresse).</p>'}
      <div class="row" style="gap:12px;align-items:flex-end">
        ${e.gourmand ? `<label class="champ" style="max-width:190px"><span>C’est</span><select data-a="ed-champ" data-k="type"><option value="gouter" ${e.type === 'gouter' ? 'selected' : ''}>Un goûter</option><option value="dessert" ${e.type === 'dessert' ? 'selected' : ''}>Un dessert</option></select></label>`
          : `<label class="champ" style="max-width:190px"><span>Pour</span><select data-a="ed-champ" data-k="repas"><option value="tous" ${e.repas === 'tous' ? 'selected' : ''}>Midi et soir</option><option value="dejeuner" ${e.repas === 'dejeuner' ? 'selected' : ''}>Le midi</option><option value="diner" ${e.repas === 'diner' ? 'selected' : ''}>Le soir</option></select></label>`}
        <label class="champ" style="max-width:150px"><span>Temps (min, facultatif)</span><input type="text" inputmode="numeric" data-a="ed-champ" data-k="temps" value="${esc(String(e.temps || ''))}" placeholder="30"></label>
      </div>
      ${e.lecture && e.lecture.etat === 'encours' ? '' : e.etape === 'nom' ? `<button class="btn btn-plein btn-grand" data-a="ed-deviner">Trouver les ingrédients</button>` : `<div><button class="btn btn-petit" data-a="ed-deviner">Reproposer d’après le nom</button></div>`}
      ${ingredients}
      ${e.etape === 'ingredients' ? `${e.gourmand ? '' : `<label class="case"><input type="checkbox" data-a="ed-proposer" ${e.proposer ? 'checked' : ''}><span>Me la proposer dans mes menus de la semaine</span></label>`}
        <button class="btn btn-plein btn-grand" data-a="ed-enregistrer">${e.gourmand ? 'Enregistrer dans mes gourmandises' : ou ? `Enregistrer et mettre au ${esc(ou)}` : 'Enregistrer dans Mes recettes'}</button>
        ${e.gourmand && e.id ? `<button class="btn-lien small" data-a="gourmand-suppr" data-r="${e.id}" style="justify-self:start">Supprimer cette recette</button>` : ''}` : ''}
    </div></div>`;
  }
  function enregistrerEdition() {
    const e = edition;
    const nom = e.nom.trim();
    if (nom.length < 2) { toast('Donnez un nom au plat'); return false; }
    const lien = e.lien.trim();
    if (lien && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(lien)) { toast('Le lien doit commencer par https://'); return false; }
    const ing = e.ing.filter((x) => x.coche).map((x) => [x.id, x.q]);
    const extras = e.extras.filter((x) => x.coche).map((x) => ({ nom: x.nom, tags: x.tags || [] }));
    if (!ing.length && !extras.length) { toast('Cochez au moins un ingrédient'); return false; }
    const temps = parseInt(e.temps, 10);
    if (e.gourmand) {
      const g = { id: e.id || 'gp-' + Date.now().toString(36), nom, lien: lien || '', type: e.type === 'dessert' ? 'dessert' : 'gouter', emoji: e.type === 'dessert' ? '🍮' : '🧁', parts: e.personnes, photo: e.photo || null, photoSource: e.photo ? e.photoSource : '', temps: temps > 0 && temps < 600 ? temps : null, ing, extras };
      const k = S.gourmandPerso.findIndex((x) => x.id === g.id);
      if (k >= 0) S.gourmandPerso[k] = g; else S.gourmandPerso.unshift(g);
      definirGourmand();
      toast(e.id ? 'Recette modifiée' : `« ${nom} » ajouté à vos gourmandises`);
      S.filtreGourmand = 'tout';
      edition = null;
      return true;
    }
    const rec = { id: e.id || 'p-' + Date.now().toString(36), nom, lien: lien || '', personnes: e.personnes, photo: e.photo || null, photoSource: e.photo ? e.photoSource : '', repas: e.repas === 'tous' ? ['dejeuner', 'diner'] : [e.repas], temps: temps > 0 && temps < 600 ? temps : null, ing, extras, proposer: e.proposer, cree: e.id ? undefined : new Date().toISOString().slice(0, 10) };
    const i = S.bibliotheque.findIndex((r) => r.id === rec.id);
    if (i >= 0) S.bibliotheque[i] = { ...S.bibliotheque[i], ...rec, cree: S.bibliotheque[i].cree }; else S.bibliotheque.unshift(rec);
    E.definirPerso(S.bibliotheque);
    if (e.placer && S.plan) {
      S.plan = E.placerRecette(S.plan, e.placer.jour, e.placer.slot, rec.id);
      toast(`« ${nom} » ajouté à Mes recettes et mis au menu`);
      choix = null;
    } else toast(e.id ? 'Recette modifiée' : `« ${nom} » ajouté à Mes recettes`);
    const compat = E.recetteCompatible(E.REC[rec.id], S.profil);
    if (!compat.ok) toast(`Attention : cette recette ne respecte pas votre profil (${libAllergie(compat.raison)}). Elle ne vous sera pas proposée automatiquement.`);
    edition = null;
    return true;
  }

  /* ---------- onglet « Placard » : ce qui reste à la maison ---------- */
  const PLACARD_RAPIDE = ['pates', 'riz', 'semoule', 'farine', 'pomme_de_terre', 'oeufs', 'lait', 'beurre', 'creme', 'emmental', 'oignon', 'ail', 'carotte', 'courgette', 'tomates_concassees', 'lentilles_corail', 'pois_chiches', 'thon', 'jambon', 'poulet_filet'];
  function pasStock(id) { const i = E.ING[id]; return i.unite === 'pièce' ? (i.cond === 1 ? 0.25 : 1) : (i.cond >= 500 ? 100 : 50); }
  function achatsARanger() {
    if (!S.plan) return [];
    return E.listeCourses(S.plan, S.profil).articles.filter((a) => S.coches[a.id] && !S.ranges[a.id] && !a.enStock && !a.sansPrix && a.conditionnements > 0);
  }
  // tout ce qu'il reste à acheter (et à ranger) dans la liste de la semaine
  function articlesARangerTous() {
    if (!S.plan) return [];
    return E.listeCourses(S.plan, S.profil).articles.filter((a) => !S.ranges[a.id] && !a.enStock && !a.sansPrix && a.conditionnements > 0);
  }
  function rangerArticles(achats) {
    const ajouts = achats.map(E.achatArticle).filter(Boolean);
    S.profil.stock = E.ajouterAuStock(S.profil.stock, ajouts);
    achats.forEach((a) => { S.ranges[a.id] = true; S.coches[a.id] = true; });
    S.dernierRangement = { quand: new Date().toISOString(), ajouts };
    S.choixRanger = false;
    if (S.modeCourses) S.modeCourses.ouvert = false;
    S.onglet = 'placard';
    window.scrollTo(0, 0);
    toast(`${pluriel(achats.length, 'article rangé', 'articles rangés')} dans votre placard`);
  }
  function blocCoursesFaites() {
    const restants = articlesARangerTous();
    const coches = restants.filter((a) => S.coches[a.id]);
    if (!restants.length) {
      return Object.keys(S.ranges).length ? `<section class="carte stack courses-faites ecran-seul" style="gap:8px"><strong>✓ Courses rangées dans le placard</strong><div class="row" style="gap:6px"><button class="btn btn-petit" data-a="onglet" data-k="placard">Voir mon placard</button><button class="btn btn-petit btn-plein" data-a="ticket-ouvrir">🧾 Comparer mon ticket</button></div></section>` : '';
    }
    if (S.choixRanger && coches.length && coches.length < restants.length) {
      return `<section class="carte stack courses-faites ecran-seul" style="gap:10px"><strong>Qu’avez-vous rapporté ?</strong>
        <button class="btn btn-plein" data-a="ranger-tout">Tout a été acheté (${pluriel(restants.length, 'article')})</button>
        <button class="btn" data-a="ranger-achats">Seulement les articles cochés (${coches.length})</button>
        <button class="btn-lien small" data-a="ranger-annuler-choix" style="align-self:flex-start">Annuler</button></section>`;
    }
    return `<section class="carte stack courses-faites ecran-seul" style="gap:8px">
      <button class="btn btn-plein btn-grand" data-a="courses-faites">✓ Courses faites : tout mettre au placard</button>
      <button class="btn" data-a="ticket-ouvrir">🧾 J’ai mon ticket : comparer les prix et tout ranger</button>
      <span class="small muted">${coches.length && coches.length < restants.length ? `${coches.length} sur ${restants.length} articles cochés : on vous demandera ce que vous avez rapporté.` : `${pluriel(restants.length, 'article')} ajoutés à votre placard, avec leurs quantités. Ensuite, les repas cuisinés s’en déduisent.`}</span></section>`;
  }
  function repasATraiter() {
    if (!S.plan) return [];
    const t = aujourdhui(), h = new Date().getHours();
    // la semaine commence le jour de sa création : seuls les repas des jours déjà passés depuis sont à traiter
    const res = [];
    const pt = posJour(t), ecart = S.planDu ? Math.round((new Date(ISO(new Date()) + 'T12:00:00') - new Date(S.planDu + 'T12:00:00')) / 864e5) : 0;
    joursOrdonnes().forEach(([jp, j]) => E.SLOTS.forEach((sl) => {
      const m = jp[sl];
      if (!m || S.deduits[j + '-' + sl]) return;
      const passe = ecart >= 7 || posJour(j) < pt;
      if (passe || (j === t && (sl === 'dejeuner' ? h >= 14 : h >= 21))) res.push({ j, sl, m });
    }));
    return res;
  }
  function blocAvecPlacard(idees, titre, depuisPlacard) {
    if (!idees || !idees.length) return '';
    return `<section class="stack avec-placard"><div class="spread" style="align-items:baseline"><h2>${esc(titre)}</h2>${depuisPlacard ? '<button class="btn-lien" data-a="vers-soir">Plus d’idées dans « Ce soir » →</button>' : ''}</div>
      <div class="jours">${idees.map((x) => { const rec = E.REC[x.recette]; return `<article class="jour"><div class="repas repas-illu"><div class="vignette">${V(rec, 64)}</div><div class="repas-corps">
        <button class="titre-repas" data-a="fiche-r" data-r="${rec.id}">${esc(rec.nom)}</button>
        <span class="pourquoi small">Utilise : ${esc(x.utilise.map((id) => E.ING[id].nom.toLowerCase()).join(', '))}</span>
        <span class="small muted">${x.manquants.length ? `Il manque : ${esc(x.manquants.map((id) => E.ING[id].nom.toLowerCase()).join(', '))}` : 'Tout est déjà à la maison'}</span>
        <div class="row" style="gap:6px">${S.plan && S.plan.jours[aujourdhui()].diner ? `<button class="btn btn-petit btn-plein" data-a="placard-ce-soir" data-r="${rec.id}">Au menu ce soir</button>` : ''}${depuisPlacard ? `<button class="btn btn-petit" data-a="vers-soir" data-r="${rec.id}">Voir dans « Ce soir » →</button>` : ''}</div></div></div></article>`; }).join('')}</div></section>`;
  }
  /* ---------- la cuisine : frigo, congélateur, placard et corbeille qu'on ouvre ---------- */
  const EMOJI = { oignon: '🧅', ail: '🧄', carotte: '🥕', courgette: '🥒', tomate: '🍅', poivron: '🫑', pomme_de_terre: '🥔', poireau: '🥬', champignon: '🍄', brocoli: '🥦', salade: '🥬', concombre: '🥒', aubergine: '🍆', courge: '🍠', citron: '🍋', persil: '🌿', patate_douce: '🍠', chou: '🥬',
    poulet_filet: '🍗', cuisses_poulet: '🍗', boeuf_hache: '🥩', jambon: '🍖', lardons: '🥓', saucisse: '🌭', saumon: '🐟', oeufs: '🥚', lait: '🥛', beurre: '🧈', creme: '🥛', emmental: '🧀', mozzarella: '🧀', feta: '🧀', yaourt: '🍶', tofu: '🍱',
    pates: '🍝', riz: '🍚', semoule: '🌾', quinoa: '🌾', farine: '🌾', lentilles_corail: '🫘', lentilles_vertes: '🫘', pois_chiches: '🫘', haricots_rouges: '🫘', haricots_blancs: '🫘', pois_casses: '🫛', mais: '🌽', tomates_concassees: '🥫', lait_coco: '🥥', thon: '🥫',
    huile_olive: '🫒', curry: '🍛', cumin: '🧂', paprika: '🌶️', bouillon: '🍲', sauce_soja: '🍶', moutarde: '🫙', tortillas: '🫓', colin: '🐟', epinards: '🥬', haricots_verts: '🫛', petits_pois: '🫛', pain: '🥖', pain_mie: '🍞', sucre: '🍬', chocolat: '🍫', cacao: '🍫', levure: '🧁', sucre_vanille: '🌼', confiture: '🍓', miel: '🍯', flocons_avoine: '🥣', compote: '🍏', pate_brisee: '🥧', pomme: '🍎', banane: '🍌', fraises: '🍓' };
  const SEC = new Set(['pomme_de_terre', 'oignon', 'ail', 'courge', 'patate_douce', 'citron', 'pain', 'pain_mie', 'pomme', 'banane']);
  const EPICES = new Set(['huile_olive', 'curry', 'cumin', 'paprika', 'bouillon', 'sauce_soja', 'moutarde']);
  const CONSERVES = new Set(['tomates_concassees', 'lait_coco', 'thon', 'mais', 'pois_chiches', 'haricots_rouges', 'haricots_blancs']);
  function zoneDe(id) {
    const r = E.ING[id].rayon;
    if (SEC.has(id)) return 'corbeille';
    if (r === 'Surgelés') return 'congel';
    if (r === 'Épicerie' || r === 'Épicerie sucrée') return 'placard';
    return 'frigo';
  }
  const ZONES = {
    placard: { nom: 'Le placard', etageres: [['Pâtes, riz, farine et sucre', (id) => !EPICES.has(id) && !CONSERVES.has(id)], ['Conserves', (id) => CONSERVES.has(id)], ['Huiles, épices et sauces', (id) => EPICES.has(id)]], rapide: ['pates', 'riz', 'farine', 'semoule', 'tomates_concassees', 'thon', 'huile_olive', 'lentilles_corail'] },
    frigo: { nom: 'Le frigo', etageres: [['Crèmerie', (id) => E.ING[id].rayon === 'Crèmerie et frais'], ['Viandes et poissons', (id) => E.ING[id].rayon === 'Viandes et poissons'], ['Bac à légumes', (id) => E.ING[id].rayon === 'Fruits et légumes']], rapide: ['oeufs', 'lait', 'beurre', 'creme', 'emmental', 'jambon', 'courgette', 'carotte'] },
    congel: { nom: 'Le congélateur', etageres: [['Surgelés', () => true]], rapide: ['epinards', 'haricots_verts', 'petits_pois', 'colin'] },
    corbeille: { nom: 'La corbeille', etageres: [['Légumes et pain', () => true]], rapide: ['pomme_de_terre', 'oignon', 'ail', 'citron', 'pain'] }
  };
  function produitCuisine(id, st, nouveaux) {
    const i = E.ING[id], q = st[id], part = Math.min(1, q / i.cond);
    const sel = S.stockSel === id;
    return `<button class="produit ${sel ? 'sel' : ''} ${part < 0.25 ? 'presque-fini' : ''}" data-a="stock-sel" data-id="${id}" aria-pressed="${sel}" aria-label="${esc(i.nom)} : ${quantite(q, i.unite)}">
      <span class="emoji" aria-hidden="true">${EMOJI[id] || '🥣'}</span><span class="p-nom">${esc(i.nom.replace(/\s*\(.*\)$/, ''))}</span><span class="p-qte num">${quantite(q, i.unite)}</span>
      <span class="jauge" aria-hidden="true"><i style="width:${Math.round(part * 100)}%"></i></span>${nouveaux.has(id) ? '<span class="pastille-nouveau" aria-hidden="true"></span>' : ''}</button>`;
  }
  function interieur(zone, ids, st, nouveaux) {
    const z = ZONES[zone];
    const dedans = ids.filter((id) => zoneDe(id) === zone);
    const sel = S.stockSel && dedans.includes(S.stockSel) ? E.ING[S.stockSel] : null;
    const detail = () => `<div class="produit-detail" role="group" aria-label="${esc(sel.nom)}"><span class="emoji" aria-hidden="true">${EMOJI[sel.id] || '🥣'}</span><div class="stack" style="gap:2px;flex:1;min-width:0"><strong>${esc(sel.nom)}</strong><span class="small"><span class="num">${quantite(st[sel.id], sel.unite)}</span> · ${esc(sel.condLabel)}</span></div>
        <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn btn-petit" data-a="stock-moins" data-id="${sel.id}" aria-label="Moins de ${esc(sel.nom)}">−</button><button class="btn btn-petit" data-a="stock-plus" data-id="${sel.id}" aria-label="Plus de ${esc(sel.nom)}">+</button><button class="btn btn-petit btn-suppr" data-a="stock-fini" data-id="${sel.id}" aria-label="Supprimer ${esc(sel.nom)} du placard" title="Supprimer du placard">🗑</button></div></div>`;
    const manquent = z.rapide.filter((id) => !st[id] && !E.ingredientInterdit(E.ING[id], S.profil)).slice(0, 6);
    return `<div class="interieur">
      <div class="spread int-tete"><strong>${esc(z.nom)}</strong><button class="btn btn-petit" data-a="cuisine-ouvrir" data-z="${zone}">Fermer</button></div>
      ${z.etageres.map(([nom, f]) => { const l = dedans.filter(f).sort((a, b) => E.ING[a].nom.localeCompare(E.ING[b].nom, 'fr')); return `<div class="etagere"><span class="etagere-nom">${esc(nom)}</span><div class="rangee">${l.length ? l.map((id) => produitCuisine(id, st, nouveaux)).join('') : '<span class="vide small">Rien ici</span>'}</div>${sel && l.includes(sel.id) ? detail() : ''}</div>`; }).join('')}
      ${!sel && dedans.length ? '<p class="small muted aide-cuisine">Touchez un produit pour changer sa quantité.</p>' : ''}
      ${manquent.length ? `<div class="row puces-ajout" style="gap:6px"><span class="small">Ranger ici :</span>${manquent.map((id) => `<button class="chip puce-ajout" data-a="stock-ajouter" data-id="${id}">+ ${esc(E.ING[id].nom.replace(/\s*\(.*\)$/, ''))}</button>`).join('')}</div>` : ''}
    </div>`;
  }
  /* ---------- ajouter au placard en photo : code-barres (Open Food Facts) ou photo du placard (IA) ---------- */
  // catégories Open Food Facts (de la plus précise à la plus générale) → catalogue
  const CATEGORIES_OFF = {
    'en:pastas': 'pates', 'en:dry-pastas': 'pates', 'en:rices': 'riz', 'en:semolinas': 'semoule', 'en:couscous': 'semoule', 'en:quinoa': 'quinoa',
    'en:flours': 'farine', 'en:wheat-flours': 'farine', 'en:red-lentils': 'lentilles_corail', 'en:lentils': 'lentilles_vertes', 'en:green-lentils': 'lentilles_vertes',
    'en:chickpeas': 'pois_chiches', 'en:red-kidney-beans': 'haricots_rouges', 'en:kidney-beans': 'haricots_rouges', 'en:white-beans': 'haricots_blancs', 'en:split-peas': 'pois_casses',
    'en:sweet-corns': 'mais', 'en:canned-corn': 'mais', 'en:tomato-sauces': 'tomates_concassees', 'en:canned-tomatoes': 'tomates_concassees', 'en:crushed-tomatoes': 'tomates_concassees',
    'en:tomato-pulps': 'tomates_concassees', 'en:tomato-purees': 'tomates_concassees', 'en:tomato-concentrates': 'tomates_concassees', 'en:coconut-milks': 'lait_coco',
    'en:tunas': 'thon', 'en:canned-tunas': 'thon', 'en:olive-oils': 'huile_olive', 'en:extra-virgin-olive-oils': 'huile_olive', 'en:vegetable-oils': 'huile_olive', 'en:sunflower-oils': 'huile_olive',
    'en:curry-powders': 'curry', 'en:cumin': 'cumin', 'en:paprika': 'paprika', 'en:bouillon-cubes': 'bouillon', 'en:stock-cubes': 'bouillon', 'en:soy-sauces': 'sauce_soja', 'en:mustards': 'moutarde',
    'en:tortillas': 'tortillas', 'en:wraps': 'tortillas', 'en:eggs': 'oeufs', 'en:chicken-eggs': 'oeufs', 'en:milks': 'lait', 'en:semi-skimmed-milks': 'lait', 'en:whole-milks': 'lait', 'en:skimmed-milks': 'lait',
    'en:butters': 'beurre', 'en:creams': 'creme', 'en:fresh-creams': 'creme', 'en:cooking-creams': 'creme', 'en:grated-cheeses': 'emmental', 'en:emmental': 'emmental', 'en:gruyere': 'emmental', 'en:comte': 'emmental',
    'en:mozzarella': 'mozzarella', 'en:feta': 'feta', 'en:yogurts': 'yaourt', 'en:plain-yogurts': 'yaourt', 'en:tofu': 'tofu', 'en:hams': 'jambon', 'en:white-hams': 'jambon', 'en:cooked-hams': 'jambon',
    'en:lardons': 'lardons', 'en:bacons': 'lardons', 'en:sausages': 'saucisse', 'en:salmons': 'saumon', 'en:salmon-fillets': 'saumon', 'en:chicken-breasts': 'poulet_filet', 'en:chicken-fillets': 'poulet_filet',
    'en:chicken-legs': 'cuisses_poulet', 'en:chicken-thighs': 'cuisses_poulet', 'en:ground-beef': 'boeuf_hache', 'en:minced-beef': 'boeuf_hache', 'en:beef-burgers': 'boeuf_hache',
    'en:hakes': 'colin', 'en:pollocks': 'colin', 'en:cods': 'colin', 'en:white-fish': 'colin', 'en:breaded-fish': 'colin', 'en:frozen-spinachs': 'epinards', 'en:spinachs': 'epinards',
    'en:green-beans': 'haricots_verts', 'en:peas': 'petits_pois', 'en:green-peas': 'petits_pois', 'en:baguettes': 'pain', 'en:sandwich-breads': 'pain_mie', 'en:sliced-breads': 'pain_mie', 'en:potatoes': 'pomme_de_terre', 'en:carrots': 'carotte'
  };
  function produitVersAjout(p) {
    const nom = String(p.product_name_fr || p.product_name || p.generic_name_fr || '').trim();
    let id = null;
    for (const t of (p.categories_tags || []).slice().reverse()) if (CATEGORIES_OFF[t]) { id = CATEGORIES_OFF[t]; break; }
    const ligne = window.Saisie.analyserLigne(`${p.quantity || ''} ${nom}`);
    if (!id && ligne && ligne.id) id = ligne.id;
    if (!id || !E.ING[id]) return { nom, id: null };
    const i = E.ING[id];
    let q = null;
    const pq = parseFloat(p.product_quantity), u = String(p.product_quantity_unit || 'g').toLowerCase();
    if (i.unite !== 'pièce' && pq > 0) q = pq * ({ kg: 1000, l: 1000, cl: 10, dl: 100 }[u] || 1);
    if (q == null && ligne && ligne.id === id && ligne.total > 0) q = ligne.total;
    if (q == null && i.unite === 'pièce') { const m = /(\d+)/.exec(String(p.quantity || '')); if (m && +m[1] < 60) q = +m[1]; }
    if (!(q > 0) || q > i.cond * 20) q = i.cond;
    return { nom, id, q };
  }
  async function chercherProduit(code) {
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_fr,generic_name_fr,brands,quantity,product_quantity,product_quantity_unit,categories_tags,image_front_small_url`, { signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
      const j = await r.json();
      if (j.status !== 1 || !j.product) return { code, inconnu: true };
      return { code, ...produitVersAjout(j.product), marque: String(j.product.brands || '').split(',')[0].trim(), image: j.product.image_front_small_url || null };
    } catch (e) { return { code, erreur: true }; }
  }
  function ajouterParPhoto(ajouts) {
    if (!ajouts.length) return;
    S.profil.stock = E.ajouterAuStock(S.profil.stock, ajouts);
    S.dernierRangement = { quand: new Date().toISOString(), ajouts, source: 'photo' };
  }
  async function photoProduit(fichier) {
    if (!fichier) return;
    S.photoEtat = { etat: 'encours', message: 'Lecture du code-barres…' }; rendre();
    let codes = [];
    try { codes = await window.CodeBarre.lirePhoto(fichier); } catch (e) { codes = []; }
    if (!codes.length) {
      S.photoEtat = { etat: 'erreur', message: 'Aucun code-barres lisible sur cette photo. Prenez le code-barres de près, bien éclairé et net, ou utilisez « Photo du placard ».' }; rendre(); return;
    }
    S.photoEtat = { etat: 'encours', message: `${pluriel(codes.length, 'code-barres lu', 'codes-barres lus')}, recherche du produit…` }; rendre();
    const res = await Promise.all(codes.slice(0, 8).map(chercherProduit));
    const ajouts = res.filter((x) => x.id).map((x) => [x.id, x.q]);
    ajouterParPhoto(ajouts);
    S.photoEtat = { etat: 'resultat', produits: res, autres: [] };
    if (ajouts.length) toast(`${pluriel(ajouts.length, 'produit ajouté', 'produits ajoutés')} au placard`);
    rendre();
  }
  async function photoPlacard(fichier) {
    if (!fichier) return;
    S.photoEtat = { etat: 'encours', message: 'Envoi de la photo et reconnaissance des produits… (jusqu’à une minute)' }; rendre();
    let rep = null, j = {};
    try {
      const bmp = await createImageBitmap(fichier);
      const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      rep = await fetch(`${LECTEUR}/vision`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ image: c.toDataURL('image/jpeg', 0.8) }), signal: AbortSignal.timeout ? AbortSignal.timeout(90000) : undefined });
      j = await rep.json().catch(() => ({}));
    } catch (e) { rep = null; }
    if (rep && rep.ok) {
      const produits = (j.produits || []).filter((x) => E.ING[x.id] && x.confiance >= 0.35);
      const ajouts = produits.map((x) => [x.id, x.quantite]);
      ajouterParPhoto(ajouts);
      S.photoEtat = { etat: 'resultat', produits: produits.map((x) => ({ id: x.id, q: x.quantite, nom: E.ING[x.id].nom, ia: true })), autres: j.autres || [] };
      toast(ajouts.length ? `${pluriel(ajouts.length, 'produit reconnu', 'produits reconnus')} et ajoutés au placard` : 'Aucun produit reconnu sur cette photo');
      rendre(); return;
    }
    // reconnaissance indisponible : on lit au moins les codes-barres visibles
    const pasActive = rep && j.erreur === 'non_configure';
    let codes = [];
    try { codes = await window.CodeBarre.lirePhoto(fichier); } catch (e) { codes = []; }
    const res = codes.length ? await Promise.all(codes.slice(0, 8).map(chercherProduit)) : [];
    ajouterParPhoto(res.filter((x) => x.id).map((x) => [x.id, x.q]));
    const pourquoi = pasActive ? 'La reconnaissance des produits sans code-barres n’est pas encore activée sur Budgétable.' : (j.erreur || 'La reconnaissance des produits ne répond pas pour le moment.');
    S.photoEtat = res.length ? { etat: 'resultat', produits: res, autres: [], note: `${pourquoi} Les codes-barres visibles ont été lus.` } : { etat: 'erreur', message: `${pourquoi} Aucun code-barres lisible non plus : prenez plutôt chaque produit de près avec « Photo d’un produit ».` };
    rendre();
  }
  function blocPhotoStock() {
    const e = S.photoEtat;
    const res = !e ? '' : e.etat === 'encours' ? `<p class="lecture small" role="status"><span class="rond-attente" aria-hidden="true"></span> ${esc(e.message)}</p>`
      : e.etat === 'erreur' ? `<p class="lecture lecture-echec small" role="status">${esc(e.message)}</p>`
      : `<div class="stack resultat-photo" role="status" style="gap:6px">${e.note ? `<p class="small muted" style="margin:0">${esc(e.note)}</p>` : ''}
          <ul class="liste-photo">${e.produits.map((x) => `<li>${x.image ? `<img src="${esc(x.image)}" alt="" referrerpolicy="no-referrer">` : `<span class="emoji" aria-hidden="true">${x.id ? (EMOJI[x.id] || '🥣') : '❔'}</span>`}<span class="stack" style="gap:0;min-width:0"><strong class="small">${esc(x.nom || (x.inconnu ? `Code ${x.code}` : 'Produit'))}${x.marque ? ` <span class="muted">· ${esc(x.marque)}</span>` : ''}</strong>
            <span class="small ${x.id ? 'placard-info' : 'muted'}">${x.id ? `${esc(E.ING[x.id].nom)} : + ${quantite(x.q, E.ING[x.id].unite)} au placard` : x.inconnu ? 'Produit inconnu d’Open Food Facts' : x.erreur ? 'Recherche impossible (connexion ?)' : 'Pas suivi par Budgétable'}</span></span></li>`).join('')}</ul>
          ${e.autres && e.autres.length ? `<p class="small muted" style="margin:0">Vus mais pas suivis : ${esc(e.autres.join(', '))}.</p>` : ''}
          ${!e.produits.length ? '<p class="small muted" style="margin:0">Rien n’a été ajouté.</p>' : ''}</div>`;
    return `<section class="carte stack photo-stock" style="gap:10px"><div class="spread"><strong>Ajouter en photo</strong>${e && e.etat !== 'encours' ? '<button class="btn-lien small" data-a="photo-effacer">Effacer</button>' : ''}</div>
      <div class="row" style="gap:8px">
        <label class="btn btn-plein btn-petit choisir-photo">📷 Photo du placard ou du frigo<input type="file" accept="image/*" capture="environment" data-a="photo-placard" class="visuellement-cache"></label>
        <label class="btn btn-petit choisir-photo">🏷️ Photo d’un produit (code-barres)<input type="file" accept="image/*" capture="environment" data-a="photo-produit" class="visuellement-cache"></label>
      </div>
      <span class="small muted">Les produits reconnus sont ajoutés tout seuls ; vous pouvez annuler juste après.</span>
      ${res}</section>`;
  }

  /* cuisine 3D : three.js chargé au premier passage dans le Placard */
  let three = null;   // null : pas demandé ; 'chargement' ; true ; false (échec)
  const veut3D = () => S.vue3d !== false && window.Cuisine3D && window.Cuisine3D.disponible() && three !== false;
  function chargerThree() {
    if (three) return;
    three = 'chargement';
    const sc = document.createElement('script');
    sc.src = 'js/vendor/three-r160.min.js';
    sc.onload = () => { three = !!window.THREE; rendre(); };
    sc.onerror = () => { three = false; rendre(); };
    document.head.appendChild(sc);
  }
  function donnees3D() {
    const st = S.profil.stock || {};
    const nouveaux = new Set(S.dernierRangement ? S.dernierRangement.ajouts.map(([id]) => id) : []);
    const z = { frigo: { cremerie: [], viandes: [], legumes: [] }, congel: { surgeles: [] }, placard: { feculents: [], conserves: [], epices: [] }, corbeille: { tout: [] } };
    Object.keys(st).filter((id) => E.ING[id]).sort((a, b) => E.ING[a].nom.localeCompare(E.ING[b].nom, 'fr')).forEach((id) => {
      const i = E.ING[id], zone = zoneDe(id);
      const cle = zone === 'frigo' ? (i.rayon === 'Crèmerie et frais' ? 'cremerie' : i.rayon === 'Viandes et poissons' ? 'viandes' : 'legumes')
        : zone === 'placard' ? (EPICES.has(id) ? 'epices' : CONSERVES.has(id) ? 'conserves' : 'feculents') : zone === 'congel' ? 'surgeles' : 'tout';
      z[zone][cle].push({ id, zone, emoji: EMOJI[id] || '🥣', part: Math.min(1, st[id] / i.cond), nouveau: nouveaux.has(id) });
    });
    const sombre = document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    return { zones: z, ouvert: S.cuisine || null, sel: S.stockSel || null, sombre };
  }
  function monter3D() {
    const el = document.getElementById('scene-cuisine');
    if (!el) return;
    if (three !== true) { chargerThree(); return; }
    const ok = window.Cuisine3D.monter(el, donnees3D(), {
      ouvrir: (zone) => { S.cuisine = S.cuisine === zone ? null : zone; S.stockSel = null; rendre(); },
      choisir: (id) => { S.stockSel = S.stockSel === id ? null : id; rendre(); }
    });
    if (!ok) { three = false; rendre(); }
  }
  function vueCuisine3D(st, ids, nouveaux) {
    const o = S.cuisine || null;
    const n = (zone) => ids.filter((id) => zoneDe(id) === zone).length;
    const noms = { frigo: 'le frigo', congel: 'le congélateur', placard: 'le placard', corbeille: 'la corbeille' };
    return `<section class="cuisine-3d" aria-label="Ma cuisine en 3D">
      <div class="scene3d" id="scene-cuisine">${three === true ? '' : '<div class="chargement-3d small muted"><span class="rond-attente" aria-hidden="true"></span> Préparation de la cuisine…</div>'}</div>
      <p class="small muted aide-3d">Touchez un meuble pour l’ouvrir · glissez pour tourner</p>
      <div class="row zones-3d" role="group" aria-label="Ouvrir un meuble">${['frigo', 'congel', 'placard', 'corbeille'].map((zn) => `<button class="chip" data-a="cuisine-ouvrir" data-z="${zn}" aria-pressed="${o === zn}" aria-label="${o === zn ? 'Fermer' : 'Ouvrir'} ${noms[zn]} (${pluriel(n(zn), 'produit')})">${{ frigo: '🧊 Frigo', congel: '❄️ Congélateur', placard: '🚪 Placard', corbeille: '🧺 Corbeille' }[zn]} <span class="compte">${n(zn)}</span></button>`).join('')}</div>
      ${o ? `<div class="panneau-3d">${interieur(o, ids, st, nouveaux)}</div>` : ''}
      <button class="btn-lien small" data-a="cuisine-vue" data-v="plat" style="justify-self:start">Voir la cuisine à plat</button>
    </section>`;
  }
  function vueCuisine(st, ids, nouveaux) {
    if (veut3D()) return vueCuisine3D(st, ids, nouveaux);
    const o = S.cuisine || null;
    const n = (zone) => ids.filter((id) => zoneDe(id) === zone).length;
    const porte = (zone, classe, libelle) => `<button class="porte ${classe}" data-a="cuisine-ouvrir" data-z="${zone}" aria-expanded="${o === zone}" aria-label="${o === zone ? 'Fermer' : 'Ouvrir'} ${libelle} (${pluriel(n(zone), 'produit')})"><span class="poignee" aria-hidden="true"></span><span class="etiquette">${esc(libelle.replace(/^(le|la) /i, ''))}<span class="compte">${n(zone)}</span></span></button>`;
    const corb = ids.filter((id) => zoneDe(id) === 'corbeille');
    return `<section class="cuisine ${o ? 'ouverte-' + o : ''}" aria-label="Ma cuisine : ouvrez le frigo, le congélateur ou le placard">
      <div class="meuble meuble-placard ${o === 'placard' ? 'ouvert' : ''}">
        <div class="caisson">${o === 'placard' ? interieur('placard', ids, st, nouveaux) : ''}</div>
        <div class="portes-doubles">${porte('placard', 'porte-g', 'le placard')}<button class="porte porte-d" data-a="cuisine-ouvrir" data-z="placard" tabindex="-1" aria-hidden="true"><span class="poignee"></span></button></div>
      </div>
      <div class="rangee-bas">
        <div class="meuble meuble-frigo ${o === 'frigo' || o === 'congel' ? 'ouvert' : ''}">
          <div class="compartiment congel ${o === 'congel' ? 'ouvert' : ''}"><div class="caisson">${o === 'congel' ? interieur('congel', ids, st, nouveaux) : ''}</div>${porte('congel', 'porte-congel', 'le congélateur')}</div>
          <div class="compartiment frigo ${o === 'frigo' ? 'ouvert' : ''}"><div class="caisson">${o === 'frigo' ? interieur('frigo', ids, st, nouveaux) : ''}</div>${porte('frigo', 'porte-frigo', 'le frigo')}</div>
        </div>
        <div class="plan-travail ${o === 'corbeille' ? 'ouvert' : ''}">
          <button class="corbeille" data-a="cuisine-ouvrir" data-z="corbeille" aria-expanded="${o === 'corbeille'}" aria-label="${o === 'corbeille' ? 'Fermer' : 'Voir'} la corbeille (${pluriel(corb.length, 'produit')})">
            <span class="dans-corbeille" aria-hidden="true">${corb.slice(0, 6).map((id) => EMOJI[id] || '🥣').join('') || '<span class="small muted">vide</span>'}</span><span class="panier" aria-hidden="true"></span><span class="etiquette">Corbeille<span class="compte">${corb.length}</span></span></button>
          ${o === 'corbeille' ? `<div class="caisson">${interieur('corbeille', ids, st, nouveaux)}</div>` : ''}
        </div>
      </div>
      <div class="sol" aria-hidden="true"></div>
    </section>${window.Cuisine3D && window.Cuisine3D.disponible() && three !== false ? '<button class="btn-lien small" data-a="cuisine-vue" data-v="3d">Voir la cuisine en 3D</button>' : ''}`;
  }
  function ongletPlacard() {
    const st = S.profil.stock || {};
    const ids = Object.keys(st).filter((id) => E.ING[id]);
    const aRanger = achatsARanger();
    const repas = repasATraiter();
    const par = {};
    ids.forEach((id) => { (par[E.ING[id].rayon] = par[E.ING[id].rayon] || []).push(id); });
    const ligne = (id) => {
      const i = E.ING[id], q = st[id];
      const part = Math.min(1, q / i.cond);
      return `<li class="ligne-stock ${nouveaux.has(id) ? 'nouveau' : ''}"><div class="stack" style="gap:2px;flex:1;min-width:0"><span><strong>${esc(i.nom)}</strong> <span class="num">${quantite(q, i.unite)}</span>${nouveaux.has(id) ? ' <span class="tag-nouveau">nouveau</span>' : ''}</span>
          <span class="jauge" aria-hidden="true"><i style="width:${Math.round(part * 100)}%"></i></span><span class="small muted">${q >= i.cond ? pluriel(Math.floor(q / i.cond), 'paquet') + (q % i.cond > i.cond * 0.05 ? ' et un entamé' : '') : 'paquet entamé'} · ${esc(i.condLabel)}</span></div>
        <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn btn-petit" data-a="stock-moins" data-id="${id}" aria-label="Moins de ${esc(i.nom)}">−</button><button class="btn btn-petit" data-a="stock-plus" data-id="${id}" aria-label="Plus de ${esc(i.nom)}">+</button><button class="btn btn-petit btn-suppr" data-a="stock-fini" data-id="${id}" aria-label="Supprimer ${esc(i.nom)} du placard" title="Supprimer du placard">🗑</button></div></li>`;
    };
    const dr = S.dernierRangement;
    const nouveaux = new Set(dr ? dr.ajouts.map(([id]) => id) : []);
    const quand = dr ? new Date(dr.quand) : null;
    const bilan = dr ? `<section class="carte stack bilan-rangement" style="gap:8px"><strong>✓ ${dr.source === 'photo' ? 'Ajouté par photo' : 'Courses rangées'} ${quand.toDateString() === new Date().toDateString() ? 'aujourd’hui' : 'le ' + quand.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
        <span class="small">${pluriel(dr.ajouts.length, 'produit ajouté', 'produits ajoutés')} : ${esc(dr.ajouts.slice(0, 10).map(([id, q]) => `${E.ING[id] ? E.ING[id].nom.toLowerCase() : id} (${quantite(q, E.ING[id] ? E.ING[id].unite : '')})`).join(', '))}${dr.ajouts.length > 10 ? '…' : ''}</span>
        <div class="row" style="gap:8px"><button class="btn btn-petit" data-a="rangement-ok">C’est bon</button><button class="btn-lien small" data-a="rangement-annuler">${dr.source === 'photo' ? 'Annuler cet ajout' : 'Annuler ce rangement'}</button></div></section>` : '';
    const avec = ids.length ? E.recettesAvecStock(S.profil, { slot: 'diner', jour: aujourdhui(), n: 4, notes: S.notes }) : [];
    return `<div><p class="eyebrow">À la maison</p><h1>Mon placard</h1></div>
      <p class="muted">Ce qu’il vous reste, mis à jour avec vos courses et les repas cuisinés. Budgétable s’en sert pour vous proposer des plats et pour ne pas vous faire racheter ce que vous avez.</p>
      ${S.supprStock && E.ING[S.supprStock[0]] ? `<div class="bandeau-suppr" role="status"><span>🗑 ${esc(E.ING[S.supprStock[0]].nom)} supprimé du placard</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-petit" data-a="stock-suppr-annuler">Annuler</button><button class="btn-lien small" data-a="stock-suppr-ok" aria-label="Fermer">✕</button></span></div>` : ''}
      ${blocPhotoStock()}
      ${bilan}
      ${aRanger.length ? `<section class="carte stack a-faire" style="gap:8px"><strong>${pluriel(aRanger.length, 'article acheté', 'articles achetés')} à ranger</strong>
        <span class="small">${esc(aRanger.slice(0, 8).map((a) => a.nom).join(', '))}${aRanger.length > 8 ? '…' : ''}</span>
        <div><button class="btn btn-plein" data-a="ranger-achats">Ranger mes courses dans le placard</button></div></section>` : ''}
      ${repas.length ? `<section class="carte stack a-faire" style="gap:8px"><strong>Avez-vous cuisiné ces repas ?</strong>
        <span class="small muted">Ils seront déduits du placard. Décochez ceux que vous n’avez pas faits.</span>
        <ul class="liste-repas-faits">${repas.map(({ j, sl, m }) => `<li><label class="case"><input type="checkbox" data-a="repas-fait" data-k="${j}-${sl}" ${S.repasDecoches && S.repasDecoches[j + '-' + sl] ? '' : 'checked'}><span>${E.JOURS[j]} ${sl === 'diner' ? 'soir' : 'midi'} : ${esc(E.REC[m.recette].nom)}</span></label></li>`).join('')}</ul>
        <div class="row"><button class="btn btn-plein" data-a="deduire-repas">Mettre à jour le placard</button></div></section>` : ''}
      <section class="stack" style="gap:10px"><div class="spread"><h2>Ma cuisine</h2>${ids.length ? `<span class="small muted">${pluriel(ids.length, 'produit')}</span>` : ''}</div>
        <p class="small ${ids.length ? 'muted' : ''}" style="margin:0">${!ids.length ? 'Votre placard est vide pour Budgétable. Ouvrez un meuble pour y ranger ce que vous avez déjà, ou ajoutez-le plus bas : vos menus l’utiliseront en premier.' : S.cuisine ? 'Touchez « Fermer » pour refermer.' : 'Ouvrez le frigo, le congélateur ou le placard pour voir ce qu’il y a dedans.'}</p>
        ${vueCuisine(st, ids, nouveaux)}
      </section>
      ${avec.length ? blocAvecPlacard(avec, 'Que cuisiner avec ce que j’ai ?', true) : ''}
      <details class="stack liste-detaillee" ${S.listeStockOuverte ? 'open' : ''}><summary data-a="liste-stock-ouvrir"><strong>Tout le placard en liste</strong> <span class="small muted">· ${pluriel(ids.length, 'produit')}</span></summary><div class="stack" style="gap:10px;margin-top:10px">
        ${ids.length ? Object.entries(par).sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([rayon, l]) => `<div class="stack" style="gap:4px"><span class="eyebrow">${esc(rayon)}</span><ul class="liste-stock">${l.sort((a, b) => E.ING[a].nom.localeCompare(E.ING[b].nom, 'fr')).map(ligne).join('')}</ul></div>`).join('')
          : '<p class="small">Votre placard est vide pour Budgétable. Ajoutez ce que vous avez déjà ci-dessous : vos menus l’utiliseront en premier.</p>'}
      </div></details>
      <section class="carte stack" style="gap:10px"><h2>Ajouter ce que j’ai déjà</h2>
        <p class="small muted">Touchez un produit : un paquet entier est ajouté. Ajustez ensuite avec − et +.</p>
        <div class="row puces-ajout">${PLACARD_RAPIDE.filter((id) => !st[id]).map((id) => `<button class="chip puce-ajout" data-a="stock-ajouter" data-id="${id}">+ ${esc(E.ING[id].nom)}</button>`).join('')}</div>
        <label class="champ"><span>Un autre produit ?</span><input type="search" id="stock-cherche" data-a="stock-cherche" placeholder="Ex. lait de coco, saumon, quinoa…" autocomplete="off"></label>
        <div id="stock-propositions" class="row" style="gap:6px"></div>
      </section>`;
  }

  /* ---------- idées de saison (bibliothèque) ---------- */
  const MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const saisonDu = (m) => ([12, 1, 2].includes(m) ? 'hiver' : [3, 4, 5].includes(m) ? 'printemps' : [6, 7, 8].includes(m) ? 'été' : 'automne');
  const FILTRES_SAISON = [['tout', 'Toutes'], ['rapide', '30 min ou moins'], ['enfants', 'Pour les enfants'], ['vege', 'Sans viande ni poisson'], ['gamelle', 'Pour les gamelles'], ['gardees', '♥ Gardées']];
  function blocSaison() {
    if (!E.ideesSaison) return '';
    const mois = new Date().getMonth() + 1;
    const toutes = E.ideesSaison(mois);
    if (!toutes.length) return '';
    const gardees = S.saisonGardees || [];
    const f = S.filtreSaison || 'tout';
    const compat = toutes.filter((r) => E.recetteCompatible(r, S.profil).ok);
    const sansViande = (r) => !r.ing.some(([id]) => E.ING[id].tags.includes('viande') || E.ING[id].tags.includes('poisson'));
    const test = { tout: () => true, rapide: (r) => r.temps <= 30, enfants: (r) => r.tags.includes('enfants'), vege: sansViande, gamelle: (r) => ['salade', 'bowl', 'quiche', 'mijote', 'curry', 'gratin', 'pates'].includes(r.modele), gardees: (r) => gardees.includes(r.id) };
    const nbF = (k) => compat.filter(test[k]).length;
    const liste = compat.filter(test[f]).sort((a, b) => (gardees.includes(b.id) - gardees.includes(a.id)) || E.coutPortion(a) - E.coutPortion(b));
    const leg = [...new Set(toutes.flatMap((r) => r.ing.map(([id]) => id)).filter((id) => E.ING[id].groupe === 'L' && !['oignon', 'ail', 'persil', 'citron', 'tomates_concassees'].includes(id)))].slice(0, 7).map((id) => E.ING[id].nom.toLowerCase());
    return `<section class="stack saison" style="gap:12px" aria-labelledby="titre-saison">
      <div class="entete-saison"><p class="eyebrow">🍂 De saison en ${MOIS_NOMS[mois - 1]}</p><h2 id="titre-saison">Idées de recettes d’${saisonDu(mois) === 'automne' ? 'automne' : saisonDu(mois) === 'hiver' ? 'hiver' : saisonDu(mois) === 'été' ? 'été' : 'printemps'}</h2>
        <p class="small muted" style="margin:0">Les légumes du moment sont moins chers et meilleurs : ${esc(leg.join(', '))}… Gardez celles qui vous plaisent : elles seront proposées dans vos menus.</p></div>
      <div class="row" role="group" aria-label="Filtrer les idées" style="gap:6px">${FILTRES_SAISON.filter(([k]) => k === 'tout' || nbF(k)).map(([k, v]) => `<button class="chip" data-a="saison-filtre" data-k="${k}" aria-pressed="${f === k}">${v} <span class="small muted">${nbF(k)}</span></button>`).join('')}</div>
      ${liste.length ? `<div class="jours">${liste.map((r) => { const g = gardees.includes(r.id); return `<article class="jour carte-recette carte-saison"><div class="repas repas-illu"><div class="vignette">${V(r, 64)}</div><div class="repas-corps">
          <button class="titre-repas" data-a="fiche-r" data-r="${r.id}">${esc(r.nom)}</button>
          ${r.accroche ? `<span class="small accroche">${esc(r.accroche)}</span>` : ''}
          <div class="meta"><span>${r.temps} min</span><span class="part num">${euros(E.coutPortion(r))} la part</span>${nutriMini(r)}</div>
          <div class="row" style="gap:6px">${S.plan ? `<button class="btn btn-petit btn-plein" data-a="au-menu" data-r="${r.id}">Mettre au menu</button>` : ''}<button class="btn btn-petit ${g ? 'garde' : ''}" data-a="saison-garder" data-r="${r.id}" aria-pressed="${g}">${g ? '♥ Gardée' : '♡ Garder'}</button></div>
          ${g ? '<span class="pourquoi small">Proposée dans vos menus</span>' : ''}</div></div></article>`; }).join('')}</div>` : '<p class="small">Aucune idée avec ce filtre.</p>'}
      ${toutes.length > compat.length ? `<p class="small muted" style="margin:0">${pluriel(toutes.length - compat.length, 'idée masquée', 'idées masquées')} : elles ne respectent pas votre profil (allergies, régime ou équipement).</p>` : ''}
    </section>`;
  }

  /* ---------- onglet « Mes recettes » ---------- */
  const domaine = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  function ongletRecettes() {
    const recs = S.bibliotheque.map((r) => E.REC[r.id]).filter(Boolean);
    const favs = S.classiques.map((id) => E.REC[id]).filter((r) => r && !r.gourmand);
    const blocFavoris = `<section class="carte stack favoris" style="gap:10px"><div class="spread"><h2>⭐ Mes favoris</h2><span class="small muted">${favs.length ? pluriel(favs.length, 'plat') + ' · ils reviennent environ 3 fois par semaine' : ''}</span></div>
      ${favs.length ? `<ul class="liste-favoris">${favs.map((r) => `<li><span class="vignette-fav">${V(r, 40)}</span><button class="btn-lien" data-a="fiche-r" data-r="${r.id}">${esc(r.nom)}</button><span class="small muted num">${euros(E.coutPortion(r))} la part</span><span class="row" style="gap:6px;flex-wrap:nowrap">${S.plan ? `<button class="btn btn-petit" data-a="au-menu" data-r="${r.id}">Mettre au menu</button>` : ''}${etoileFav(r.id)}</span></li>`).join('')}</ul>`
        : '<p class="small muted" style="margin:0">Touchez l’étoile ☆ à côté d’un plat de la semaine ou dans sa fiche : vos favoris reviendront régulièrement dans vos menus, et vous les retrouverez ici.</p>'}</section>`;
    return `<div class="spread"><div><p class="eyebrow">Ma bibliothèque</p><h1>Mes recettes</h1></div><button class="btn btn-plein" data-a="ed-nouveau">+ Ajouter une recette</button></div>
      ${blocFavoris}
      <p class="muted">Vos recettes préférées : un lien Marmiton, 750g, un blog, ou une recette de famille sans lien. Budgétable vous propose les ingrédients à cocher, puis les glisse dans vos menus et votre liste de courses.</p>
      ${recs.length ? `<div class="jours">${recs.map((r) => {
        const src = S.bibliotheque.find((x) => x.id === r.id);
        const compat = E.recetteCompatible(r, S.profil);
        const sansPrix = r.ing.filter(([id]) => E.ING[id].perso).length;
        return `<article class="jour carte-recette"><div class="repas repas-illu"><div class="vignette">${V(r, 64)}</div><div class="repas-corps">
          <button class="titre-repas" data-a="fiche-r" data-r="${r.id}">${esc(r.nom)}</button>
          <div class="meta"><span>${pluriel(r.ing.length, 'ingrédient')}</span><span class="part num">${euros(E.coutPortion(r))} la part${sansPrix ? '*' : ''}</span>${nutriMini(r)}${r.lien ? `<a href="${esc(r.lien)}" target="_blank" rel="noopener noreferrer">${esc(domaine(r.lien))} ↗</a>` : '<span>recette de famille</span>'}</div>
          ${!compat.ok ? `<span class="small alerte-ing">Ne respecte pas votre profil (${esc(libAllergie(compat.raison))}) : jamais proposée automatiquement.</span>` : src.proposer === false ? '<span class="small muted">Pas proposée dans les menus automatiques</span>' : '<span class="pourquoi small">Proposée dans vos menus</span>'}
          <div class="row" style="gap:6px"><button class="btn btn-petit btn-plein" data-a="au-menu" data-r="${r.id}">Mettre au menu</button><button class="btn btn-petit" data-a="ed-modifier" data-r="${r.id}">Modifier</button><button class="btn-lien small" data-a="recette-suppr" data-r="${r.id}">Supprimer</button></div>
        </div></div></article>`;
      }).join('')}</div>
      ${recs.some((r) => r.ing.some(([id]) => E.ING[id].perso)) ? '<p class="small muted">* Sans les ingrédients hors catalogue, dont le prix n’est pas connu.</p>' : ''}`
      : `<div class="carte stack vide-recettes"><strong>Votre bibliothèque est vide</strong><p class="small">Exemples : « Lasagnes de mamie », « Wok de crevettes », « Gâteau au chocolat ». Collez le lien de la recette si vous en avez un, Budgétable s’occupe des ingrédients.</p>
          <div><button class="btn btn-plein" data-a="ed-nouveau">Ajouter ma première recette</button></div></div>`}
      ${blocSaison()}`;
  }
  function vueAuMenu() {
    if (!auMenu || !S.plan) return '';
    const r = E.REC[auMenu.id];
    if (!r) return '';
    return `<div class="voile" data-a="au-menu-fond"><div class="fiche fenetre-au-menu" role="dialog" aria-modal="true" aria-labelledby="au-menu-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Mettre au menu</span><h2 id="au-menu-titre">${esc(r.nom)}</h2></div>
        <button class="btn btn-petit" data-a="au-menu-fermer">Fermer</button></div>
      <p class="small muted">Choisissez le repas : le plat prévu est remplacé, la liste de courses suit.</p>
      <div class="grille-au-menu">${joursOrdonnes().map(([jp, j]) => `<div class="jour-au-menu"><strong>${jp.jour}</strong>${E.SLOTS.map((sl) => {
        const m = jp[sl];
        const ok = m && r.repas.includes(sl);
        return `<button class="btn btn-petit" data-a="au-menu-placer" data-j="${j}" data-s="${sl}" ${ok ? '' : 'disabled'} title="${m ? esc(E.REC[m.recette].nom) : 'Pris dehors'}">${sl === 'diner' ? 'Soir' : 'Midi'}</button>`;
      }).join('')}</div>`).join('')}</div>
    </div></div>`;
  }

  /* ---------- fenêtre « 3 idées pour ce repas » (et choix des enfants) ---------- */
  function ouvrirChoix(j, slot, enfants) {
    choix = { jour: j, slot, enfants: !!enfants, exclure: [], tour: 0, idees: [], filtre: '' };
    choix.idees = E.propositions(S.plan, j, slot, S.profil, { ...optsMoteur(), n: enfants ? 2 : 5 });
  }
  /** « Déplacer » : choisir le jour et le moment ; si un plat y est prévu, les deux plats s'échangent. */
  function vueDeplacer() {
    const d = S.deplacer;
    if (!d || !S.plan || !S.plan.jours[d.j] || !S.plan.jours[d.j][d.s]) return '';
    const m = S.plan.jours[d.j][d.s], r = E.REC[m.recette];
    const t = aujourdhui(), h = new Date().getHours();
    const passe = (j, sl) => posJour(j) < posJour(t) || (j === t && (sl === 'dejeuner' ? h >= 14 : h >= 21));
    const cases = ordreJours().map((j) => `<div class="dep-jour"><strong>${E.JOURS[j]} <span class="muted num">${new Date(dateDuJour(j) + 'T12:00:00').getDate()}</span></strong>${E.SLOTS.map((sl) => {
      const x = S.plan.jours[j][sl], k = j + '-' + sl;
      const ici = j === d.j && sl === d.s;
      const bloque = ici || passe(j, sl) || S.deduits[k] || (S.plan.jours[j].passes || []).includes(sl) || (x && (x.deRestes || x.aChoisir));
      const lib = sl === 'dejeuner' ? 'Midi' : 'Soir';
      const contenu = x && E.REC[x.recette] ? esc(E.REC[x.recette].nom) : (S.plan.jours[j].passes || []).includes(sl) ? 'passé' : 'rien de prévu';
      return `<button class="dep-case ${ici ? 'ici' : ''}" data-a="deplacer-vers" data-j="${j}" data-s="${sl}" ${bloque ? 'disabled' : ''}><span class="eyebrow">${lib}</span><span class="small">${ici ? 'ce plat' : contenu}</span>${!bloque && x ? '<span class="dep-echange">⇄ échanger</span>' : ''}</button>`;
    }).join('')}</div>`).join('');
    return `<div class="voile" data-a="deplacer-fond"><div class="fiche fenetre-deplacer" role="dialog" aria-modal="true" aria-labelledby="dep-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Déplacer un plat</span><h2 id="dep-titre">${esc(r.nom)}</h2><span class="small muted">Choisissez le jour et le moment. Si un plat y est déjà prévu, les deux plats sont échangés.</span></div>
        <button class="btn btn-petit" data-a="deplacer-fermer">Fermer</button></div>
      <div class="grille-deplacer">${cases}</div></div></div>`;
  }
  const FILTRES_CHOIX = [['', 'Toutes les idées'], ['saison', '🍂 De saison'], ['chaud', '🍲 Plat chaud'], ['rapide', '⏱ Rapide (20 min)'], ['pascher', '💶 Petit prix'], ['leger', '🥗 Léger'], ['vege', '🌱 Végétarien'], ['favoris', '⭐ Mes favoris']];
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
          <div class="meta"><span>${r.temps} min</span><span class="part num">${euros(E.coutPortion(r))} la part</span>${nutriMini(r)}</div>
          ${raisons.length ? `<ul class="raisons">${raisons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          <div class="row"><button class="btn ${actuel ? '' : 'btn-plein'}" data-a="choisir" data-r="${id}">${enf ? 'Celui-là !' : actuel ? 'Garder ce plat' : 'Je choisis ce plat'}</button>
          ${enf ? '' : `<button class="btn-lien small" data-a="fiche-r" data-r="${id}">La recette</button>`}</div>
        </div></article>`;
    }).join('');
    return `<div class="voile" data-a="fermer-choix-fond"><div class="fiche fenetre-choix" role="dialog" aria-modal="true" aria-labelledby="choix-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px">${th ? `<span class="eyebrow">${esc(th)}</span>` : ''}<h2 id="choix-titre">${titre}</h2></div>
        <button class="btn btn-petit" data-a="fermer-choix" aria-label="Fermer">Fermer</button></div>
      ${enf ? '' : `<div class="recherche-plat stack" style="gap:8px">
        <label class="champ"><span>Chercher un plat ou saisir le vôtre</span><input type="search" id="recherche-plat" data-a="recherche-plat" placeholder="Ex. lasagnes, poulet coco, soupe de potiron…" autocomplete="off" value="${esc(choix.recherche || '')}"></label>
        <div id="resultats-plat" aria-live="polite">${resultatsRecherche()}</div></div>`}
      ${enf ? '' : `<div class="row filtres-choix" role="group" aria-label="Filtrer les idées">${FILTRES_CHOIX.map(([k, v]) => `<button class="chip" data-a="choix-filtre" data-k="${k}" aria-pressed="${(choix.filtre || '') === k}">${v}</button>`).join('')}</div>`}
      ${!enf && !choix.idees.length ? '<p class="small muted">Aucun autre plat avec ce filtre pour ce repas : essayez-en un autre.</p>' : ''}
      <div class="grille-choix ${enf ? 'enfants' : ''}">${cartes}</div>
      ${enf ? '' : `<div class="row"><button class="btn" data-a="autres-idees">Encore d’autres idées</button><span class="small muted">Autant que vous voulez. Le budget et la liste de courses se mettent à jour tout seuls.</span></div>`}
    </div></div>`;
  }

  const CLOCHE = `<svg class="cloche" viewBox="0 0 120 90" aria-hidden="true"><ellipse cx="60" cy="78" rx="54" ry="8" fill="#fbfaf3" opacity=".9"/><path d="M14 74a46 46 0 0 1 92 0z" fill="#d9dcd6" stroke="#fbfaf3" stroke-width="3"/><path d="M30 52a32 32 0 0 1 22-20" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/><circle cx="60" cy="24" r="6" fill="#d9dcd6" stroke="#fbfaf3" stroke-width="3"/></svg>`;

  /* ---------- « J'ai ces aliments » : des recettes avec ce qu'on a sous la main ---------- */
  const RAPIDES_JAICA = ['oeufs', 'pates', 'riz', 'pomme_de_terre', 'tomates_concassees', 'courgette', 'carotte', 'oignon', 'emmental', 'creme', 'jambon', 'lardons', 'poulet_filet', 'thon', 'boeuf_hache', 'lentilles_corail', 'pois_chiches', 'epinards', 'champignon', 'poivron', 'saumon', 'lait'];
  function blocJaiCa() {
    const c = S.jaiCa || { ids: [], placard: false, ouvert: false };
    if (!c.ouvert) return `<section class="carte jai-ca-ferme spread" style="align-items:center"><div class="stack" style="gap:2px"><strong>🧺 J’ai ces aliments, qu’est-ce que je cuisine ?</strong><span class="small muted">Dites ce que vous avez sous la main : Budgétable trouve les recettes qui vont avec.</span></div><button class="btn btn-plein" data-a="jaica-ouvrir">Choisir mes aliments</button></section>`;
    const st = S.profil.stock || {};
    // seulement les plats faisables avec les aliments donnés (+ les basiques si coché) ; sinon on demande
    const BASIQUES = ['huile_olive', 'ail', 'curry', 'cumin', 'paprika', 'bouillon', 'sauce_soja', 'moutarde'];
    const dispo = new Set(c.ids.concat(c.basiques === false ? [] : BASIQUES).concat(c.placard ? Object.keys(st).filter((id) => st[id] > 0) : []));
    const non = new Set(c.non || []);
    let idees = [], questions = [];
    if (c.ids.length) {
      const analyse = E.recettesCompatibles(S.profil).filter((r) => (r.repas.includes('diner') || r.repas.includes('dejeuner')) && S.notes[r.id] !== 1).map((r) => {
        const ids = r.ing.map(([id]) => id).filter((id) => E.ING[id] && !E.ING[id].perso);
        return { recette: r.id, choisis: ids.filter((id) => c.ids.includes(id)), placard: ids.filter((id) => !c.ids.includes(id) && dispo.has(id) && !BASIQUES.includes(id)), manquants: ids.filter((id) => !dispo.has(id)), temps: r.temps, gout: E.scoreGout(r, S.profil.gouts) };
      }).filter((x) => x.choisis.length);
      const parGenre = {};
      idees = analyse.filter((x) => !x.manquants.length).sort((a, b) => b.choisis.length - a.choisis.length || b.gout - a.gout || a.temps - b.temps)
        .filter((x) => { const g = E.REC[x.recette].modele + ':' + E.REC[x.recette].nom.split(' ')[0]; parGenre[g] = (parGenre[g] || 0) + 1; return parGenre[g] <= 2; }).slice(0, 6);
      // ce qu'il faudrait en plus pour débloquer d'autres plats : on pose la question
      const proches = analyse.filter((x) => x.manquants.length >= 1 && x.manquants.length <= 3 && !x.manquants.some((id) => non.has(id)));
      const freq = {};
      proches.forEach((x) => x.manquants.forEach((id) => { freq[id] = (freq[id] || 0) + (4 - x.manquants.length) ** 2 * (1 + x.choisis.length); }));
      questions = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => !E.ingredientInterdit(E.ING[id], S.profil)).slice(0, idees.length >= 4 ? 3 : 5);
    }
    const nomIng = (id) => E.ING[id].nom.replace(/\s*\(.*\)$/, '');
    return `<section class="carte stack jai-ca" style="gap:12px" aria-label="J’ai ces aliments">
      <div class="spread"><h2>🧺 J’ai ces aliments</h2><button class="btn-lien small" data-a="jaica-fermer">Fermer</button></div>
      <div class="stack" style="gap:6px"><span class="small"><strong>Mes aliments</strong>${c.ids.length ? '' : ' <span class="muted">· touchez-en au moins un</span>'}</span>
        <div class="row" style="gap:6px">${c.ids.map((id) => `<button class="chip choisi" data-a="jaica-retirer" data-id="${id}" aria-label="Retirer ${esc(nomIng(id))}">${EMOJI[id] || '🥣'} ${esc(nomIng(id))} ✕</button>`).join('') || '<span class="small muted">Aucun pour l’instant.</span>'}</div></div>
      <label class="champ"><span class="sr">Ajouter un aliment</span><input type="search" id="jaica-cherche" data-a="jaica-cherche" placeholder="Tapez un aliment : courgette, œufs, saumon…" autocomplete="off"></label>
      <div id="jaica-propositions" class="row" style="gap:6px">${RAPIDES_JAICA.filter((id) => E.ING[id] && !c.ids.includes(id) && !E.ingredientInterdit(E.ING[id], S.profil)).slice(0, 12).map((id) => `<button class="chip puce-ajout" data-a="jaica-ajouter" data-id="${id}">+ ${EMOJI[id] || ''} ${esc(nomIng(id))}</button>`).join('')}</div>
      <label class="case small"><input type="checkbox" data-a="jaica-placard" ${c.placard ? 'checked' : ''}><span>Utiliser aussi ce qu’il y a dans mon placard${Object.keys(st).length ? ` (${pluriel(Object.keys(st).length, 'produit')})` : ''}</span></label>
      <label class="case small"><input type="checkbox" data-a="jaica-basiques" ${c.basiques === false ? '' : 'checked'}><span>J’ai les basiques : huile, ail, épices, bouillon, moutarde, sel et poivre</span></label>
      ${c.ids.length ? `${idees.length ? `<div class="stack" style="gap:8px"><h3>${pluriel(idees.length, 'recette', 'recettes')} avec seulement ce que vous avez</h3><div class="jours">${idees.map((x) => { const rec = E.REC[x.recette]; return `<article class="jour"><div class="repas repas-illu"><div class="vignette">${V(rec, 64)}</div><div class="repas-corps">
          <button class="titre-repas" data-a="fiche-r" data-r="${rec.id}">${esc(rec.nom)}</button>
          <div class="meta"><span>${rec.temps} min</span><span class="part num">${euros(E.coutPortion(rec))} la part</span>${nutriMini(rec)}</div>
          <span class="pourquoi small">✓ Rien à acheter : ${esc(x.choisis.concat(x.placard).map(nomIng).map((n) => n.toLowerCase()).join(', '))}${x.placard.length ? ' (dont placard)' : ''}</span>
          ${S.plan && S.plan.jours[aujourdhui()].diner ? `<div><button class="btn btn-petit btn-plein" data-a="placard-ce-soir" data-r="${rec.id}">Au menu ce soir</button></div>` : ''}</div></div></article>`; }).join('')}</div></div>`
        : '<p class="small" style="margin:0">Aucune recette ne se fait uniquement avec ces aliments.</p>'}
      ${questions.length ? `<div class="stack questions-jaica" style="gap:8px"><strong>${idees.length ? 'Pour plus d’idées : avez-vous aussi…' : 'Avez-vous aussi…'}</strong>
        <ul>${questions.map((id) => `<li><span>${EMOJI[id] || '🥣'} ${esc(nomIng(id))} ?</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-petit btn-plein" data-a="jaica-oui" data-id="${id}">Oui, j’en ai</button><button class="btn btn-petit" data-a="jaica-non" data-id="${id}">Non</button></span></li>`).join('')}</ul></div>` : (idees.length ? '' : '<p class="small">Ajoutez un ou deux aliments (un féculent comme des pâtes, du riz ou des pommes de terre aide beaucoup), ou cochez le placard.</p>')}
      ${(c.non || []).length ? `<p class="small muted" style="margin:0">Vous n’avez pas : ${esc(c.non.map(nomIng).map((n) => n.toLowerCase()).join(', '))}. <button class="btn-lien small" data-a="jaica-reset-non">Reposer les questions</button></p>` : ''}` : ''}
    </section>`;
  }
  function ongletSoir() {
    const r = E.ceSoir(S.plan, S.profil, aujourdhui(), optsMoteur());
    if (!S.ceSoirOuvert) {
      return `<section class="ce-soir ardoise">${CLOCHE}<h1>Qu’est-ce qu’on mange ce soir ?</h1><button class="btn" data-a="ce-soir">Soulever la cloche</button></section>
      ${blocJaiCa()}`;
    }
    const prevu = r.prevu ? E.REC[r.prevu.recette] : null;
    return `<section class="ce-soir ardoise"><p class="craie-petit">Ce soir, ${E.JOURS[aujourdhui()].toLowerCase()}</p>
        ${prevu ? `<div style="border-radius:50%;background:#fbfaf3;padding:8px">${V(prevu, 170)}</div><p class="reponse">${esc(prevu.nom)}</p><p>${prevu.temps} min · ${nb(r.prevu.portions)} portions · déjà dans votre liste</p>
          <button class="btn" data-a="fiche" data-j="${aujourdhui()}" data-s="diner">Voir la recette</button>` : '<p class="reponse">Rien de prévu ce soir</p>'}
      </section>
      ${blocJaiCa()}
      ${blocAvecPlacard(r.avecPlacard, 'Avec ce que vous avez à la maison')}
      <section class="stack"><h2>Pas envie ? Trois idées en 20 minutes</h2>
        <div class="jours">${r.idees.map((i) => { const rec = E.REC[i.recette]; return `<article class="jour"><div class="repas repas-illu"><div class="vignette">${V(rec, 64)}</div><div class="repas-corps"><div class="titre-fav"><button class="titre-repas" data-a="fiche-r" data-r="${rec.id}">${esc(rec.nom)}</button>${etoileFav(rec.id)}</div>
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

  /* ---------- promotions du moment (lues par le serveur Budgétable sur les pages publiques des enseignes) ---------- */
  const CLE_PROMOS = 'budgetable.promos';
  let promos = (() => { try { const x = JSON.parse(localStorage.getItem(CLE_PROMOS) || 'null'); return x && Date.now() - x.t < 6 * 3600000 ? { ...x.r, etat: 'ok' } : null; } catch (e) { return null; } })();
  const AUTRES_PROMOS = [['Lidl', 'https://www.lidl.fr/c/catalogues-en-ligne/s10017753'], ['Aldi', 'https://www.aldi.fr/catalogues.html'], ['Carrefour', 'https://www.carrefour.fr/catalogue'], ['Intermarché', 'https://www.intermarche.com/catalogues'], ['Netto', 'https://www.netto.fr/prospectus']];
  async function chargerPromos(forcer) {
    if (promos && promos.etat === 'charge') return;
    if (promos && promos.etat === 'ok' && !forcer) return;
    promos = { ...(promos || {}), etat: 'charge' };
    if (S.onglet === 'promos') rendre();
    try {
      const rep = await fetch(LECTEUR + '/promos', { signal: AbortSignal.timeout(90000) });
      const r = await rep.json();
      if (!rep.ok) throw new Error(r.erreur || 'erreur');
      promos = { ...r, etat: 'ok' };
      try { localStorage.setItem(CLE_PROMOS, JSON.stringify({ t: Date.now(), r })); } catch (e) { /* stockage plein */ }
      setTimeout(notifierAlertes, 300);
    } catch (e) { promos = { offres: (promos && promos.offres) || [], etat: 'erreur' }; }
    rendre();
  }
  // quel produit du catalogue correspond à une offre (« L'ÉTAL DU BOUCHER 4 crépinettes de porc » → porc)
  const ingPromo = new Map();
  const RAYON_COMPATIBLE = { 'Fruits et légumes': /fruit|légume|legume|salade|herbe/i, 'Viandes et poissons': /viande|volaille|poisson|charcut|boucher|traiteur|porc|boeuf|bœuf|mer/i, 'Crèmerie et frais': /laitier|lait|fromage|crème|creme|beurre|œuf|oeuf|frais|crèmerie|cremerie|yaourt|dessert|traiteur|pâte|pate/i,
    'Boulangerie': /pain|boulang|viennois|pâtisserie|patisserie/i, 'Épicerie': /épicerie|epicerie|conserve|pâtes|pates|riz|sauce|condiment|huile|petit-déj|céréale|cereale|apéritif|aperitif|café|cafe|monde|bio|féculent|feculent|légumineuse/i, 'Épicerie sucrée': /sucr|biscuit|chocolat|confiserie|petit-déj|céréale|cereale|gâteau|gateau|dessert/i, 'Surgelés': /surgel/i };
  const MAGASINS = { Lidl: '#0050aa', Aldi: '#00005f', Carrefour: '#1e5bc6', 'E.Leclerc': '#0066b3', Auchan: '#e2001a', Intermarché: '#d90f2a', U: '#e30613', Netto: '#e2001a' };
  const badgeMagasin = (n) => `<span class="badge-magasin" style="--m:${MAGASINS[n] || '#5b6b62'}">${esc(n)}</span>`;
  function ingredientDePromo(o) {
    if (ingPromo.has(o.id)) return ingPromo.get(o.id);
    let id = null;
    try { const a = window.Saisie.analyserLigne(o.nom.replace(/^[A-ZÀ-Ý0-9'’&.® -]{3,}(?= [A-Za-zà-ÿ])/, '').trim() || o.nom); id = a && a.id && E.ING[a.id] && !E.ING[a.id].perso ? a.id : null; } catch (e) { id = null; }
    // le rayon de l'offre doit aller avec celui du produit (des « boules crème » glacées ne sont pas de la crème fraîche)
    if (id && o.rayon && o.rayon !== 'Prospectus') { const rx = RAYON_COMPATIBLE[E.ING[id].rayon]; if (rx && !rx.test(o.rayon)) id = null; }
    // plats préparés et desserts : ce n'est pas l'ingrédient de la liste
    if (id && /dessert|danette|yaourt|skyr|enrob|cake|brioche|pain au|préparation|preparation|panés|panes|nugget|nems|feuilleté|feuillete|gratin de|paëlla|paella|parmentier|velouté|veloute|goulash|croque|flan|tripes|grignot|frites de/i.test(o.nom) && !/^(yaourt|yaourt_grec|frites|bechamel)$/.test(id)) id = null;
    if (id && /glace|bonbon|biscuit|gâteau|gateau|chips|confiserie|apéritif|aperitif|surprise/i.test(o.nom) && !/glace|biscuit|chips/.test(id)) id = null;
    ingPromo.set(o.id, id);
    return id;
  }
  function promosPour(id) { return promos && promos.offres ? promos.offres.filter((o) => ingredientDePromo(o) === id) : []; }
  const RAYONS_PROMO = [['viande', 'Viandes et poissons', /viande|volaille|poisson|boucher|charcut|porc|boeuf|bœuf|traiteur de la mer/i], ['fruits', 'Fruits et légumes', /fruit|légume|legume/i], ['cremerie', 'Crèmerie et fromages', /fromage|lait|yaourt|crèmerie|cremerie|beurre|oeuf|œuf/i], ['boulangerie', 'Pain et viennoiseries', /pain|boulang|viennois|pâtisserie|patisserie/i], ['surgeles', 'Surgelés', /surgel|glace/i], ['sucre', 'Sucré et petit-déjeuner', /sucr|biscuit|chocolat|confiserie|céréales|cereales|muesli|tartiner|café|cafe/i], ['boissons', 'Boissons', /boisson|vin|bière|biere|jus|eau|alcool|spiritueux/i], ['epicerie', 'Épicerie', /./]];
  const rayonPromo = (o) => (RAYONS_PROMO.find(([, , rx]) => rx.test(o.rayon + ' ' + o.nom)) || RAYONS_PROMO[RAYONS_PROMO.length - 1])[0];
  const finPromo = (o) => (o.quand ? o.quand.replace(/\s*\|.*$/, '') : o.fin ? 'jusqu’au ' + new Date(o.fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '');
  function lignePromo(o, avecIdee) {
    const id = ingredientDePromo(o);
    return `<li class="promo" style="--m:${MAGASINS[o.enseigne] || '#5b6b62'}"><div class="promo-img">${o.image ? `<img src="${esc(o.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '🏷️'}</div>
      <div class="stack" style="gap:3px;min-width:0">${badgeMagasin(o.enseigne)}<a href="${esc(o.lien)}" target="_blank" rel="noopener noreferrer" class="promo-nom">${esc(o.nom)} ↗</a>
        <span class="small muted">${[o.cond, o.prixKg ? o.prixKg + ' €' : '', finPromo(o), o.page ? 'prospectus p. ' + o.page : ''].filter(Boolean).map(esc).join(' · ')}</span>
        ${avecIdee && id ? `<span><button class="btn-lien small" data-a="promo-idee" data-id="${id}">Une idée de plat avec ${esc(E.ING[id].nom.toLowerCase())}</button></span>` : ''}</div>
      <div class="promo-prix"><strong class="num">${euros(o.prix)}</strong>${o.prixAvant ? `<s class="small muted num">${euros(o.prixAvant)}</s>` : ''}${o.remise ? `<span class="tag-promo">${esc(o.remise)}</span>` : ''}${o.lidlPlus ? '<span class="tag-promo lidl-plus">Lidl Plus</span>' : ''}</div></li>`;
  }
  function ongletPromos() {
    chargerPromos(false);
    const charge = !promos || promos.etat === 'charge';
    const offres = (promos && promos.offres) || [];
    const f = S.filtrePromo || 'tout', mag = S.magasinPromo || 'tout', tri = S.triPromo || 'remise';
    const q = E.norm(S.cherchePromo || '').trim();
    const remiseDe = (o) => (o.prixAvant ? (o.prixAvant - o.prix) / o.prixAvant : /(\d+)\s*%/.test(o.remise) ? +o.remise.match(/(\d+)\s*%/)[1] / 200 : 0);
    const garde = (o) => (mag === 'tout' || o.enseigne === mag) && (!q || q.split(' ').every((w) => E.norm(o.nom + ' ' + o.rayon + ' ' + o.enseigne).includes(w)));
    const trier = (l) => l.slice().sort(tri === 'prix' ? (a, b) => a.prix - b.prix : tri === 'fin' ? (a, b) => (a.fin || 9e15) - (b.fin || 9e15) : tri === 'magasin' ? (a, b) => a.enseigne.localeCompare(b.enseigne, 'fr') || remiseDe(b) - remiseDe(a) : (a, b) => remiseDe(b) - remiseDe(a));
    const liste = S.plan ? E.listeCourses(S.plan, S.profil).articles.filter((a) => !a.enStock && !a.couvertParPlacard) : [];
    const pourMoi = liste.map((a) => [a, trier(promosPour(a.id).filter(garde))]).filter(([a, l]) => l.length && (!q || l.length || E.norm(a.nom).includes(q)));
    const dispo = offres.filter(garde);
    const visibles = trier(dispo.filter((o) => f === 'tout' || rayonPromo(o) === f));
    const nbR = (k) => dispo.filter((o) => rayonPromo(o) === k).length;
    const magasins = Object.entries(offres.reduce((m, o) => ({ ...m, [o.enseigne]: (m[o.enseigne] || 0) + 1 }), {}));
    const maj = promos && promos.maj ? new Date(promos.maj) : null;
    const groupes = tri === 'magasin' ? magasins.map(([n]) => [n, visibles.filter((o) => o.enseigne === n)]).filter(([, l]) => l.length) : [[null, visibles]];
    return `<div class="spread"><div><p class="eyebrow">Bons plans</p><h1>Promos du moment</h1></div><button class="btn btn-petit" data-a="promos-maj" ${charge ? 'disabled' : ''}>${charge ? 'Recherche…' : '↻ Actualiser'}</button></div>
      <p class="muted" style="margin:0">Les promotions alimentaires de la semaine, comparées à votre liste de courses.${maj ? ` Mises à jour ${maj.toDateString() === new Date().toDateString() ? 'aujourd’hui' : 'le ' + maj.toLocaleDateString('fr-FR')} à ${maj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.` : ''}</p>
      ${blocAlertes()}
      ${blocProspectus()}
      ${offres.length ? `<section class="barre-promos" aria-label="Chercher et trier les promotions">
        <label class="recherche-promo"><span aria-hidden="true">🔍</span><span class="sr">Chercher une promotion</span><input type="text" enterkeyhint="search" id="promo-cherche" value="${esc(S.cherchePromo || '')}" placeholder="Chercher un produit : poulet, fromage, pâtes…" autocomplete="off">${q ? '<button class="btn-lien small" data-a="promo-effacer" aria-label="Effacer la recherche">✕</button>' : ''}</label>
        <div class="spread" style="gap:10px;align-items:center">
          <div class="row" role="group" aria-label="Magasin" style="gap:6px"><span class="small muted">Magasin :</span><button class="chip" data-a="promo-magasin" data-k="tout" aria-pressed="${mag === 'tout'}">Tous <span class="small muted">${offres.length}</span></button>${magasins.map(([n, c]) => `<button class="chip chip-magasin" style="--m:${MAGASINS[n] || '#5b6b62'}" data-a="promo-magasin" data-k="${esc(n)}" aria-pressed="${mag === n}"><i aria-hidden="true"></i>${esc(n)} <span class="small muted">${c}</span></button>`).join('')}</div>
          <label class="row small" style="gap:6px;align-items:center">Trier par <select id="promo-tri" data-a="promo-tri">${[['remise', 'Plus grosse remise'], ['prix', 'Prix le plus bas'], ['magasin', 'Magasin'], ['fin', 'Se termine bientôt']].map(([k, v]) => `<option value="${k}" ${tri === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        ${q || mag !== 'tout' ? `<p class="small" style="margin:0"><strong>${pluriel(dispo.length, 'promo trouvée', 'promos trouvées')}</strong>${q ? ` pour « ${esc(S.cherchePromo)} »` : ''}${mag !== 'tout' ? ` chez ${esc(mag)}` : ''} · <button class="btn-lien small" data-a="promo-effacer">tout afficher</button></p>` : ''}
      </section>` : ''}
      ${charge && !offres.length ? '<section class="carte stack" style="gap:8px"><strong>Recherche des promotions en cours…</strong><span class="small muted">Budgétable lit les pages d’offres des enseignes : cela peut prendre une minute la première fois.</span></section>' : ''}
      ${promos && promos.etat === 'erreur' && !offres.length ? '<section class="carte stack" style="gap:8px"><strong>Promotions indisponibles pour le moment</strong><span class="small">Le site de l’enseigne n’a pas répondu. Réessayez plus tard, ou consultez les catalogues ci-dessous.</span></section>' : ''}
      ${offres.length ? `<section class="carte stack promos-moi" style="gap:10px"><h2>Pour vos courses de la semaine</h2>
        ${pourMoi.length ? `<p class="small muted" style="margin:0">${pluriel(pourMoi.length, 'article de votre liste est', 'articles de votre liste sont')} en promotion${mag !== 'tout' ? ' chez ' + esc(mag) : ''}.</p>
          ${pourMoi.map(([a, l]) => `<div class="stack" style="gap:6px"><div class="spread"><strong>${esc(a.nom)}</strong><span class="small muted">il vous faut ${a.unite === 'pièce' ? nb(Math.max(1, Math.ceil(a.quantite - 0.05))) : quantite(a.quantite, a.unite)} · estimé ${euros(a.cout)}</span></div><ul class="liste-promos">${l.slice(0, 4).map((o) => lignePromo(o, false)).join('')}</ul></div>`).join('')}`
          : `<p class="small" style="margin:0">Aucun article de votre liste n’est en promotion${mag !== 'tout' ? ' chez ' + esc(mag) : ''} cette semaine. Regardez les promos ci-dessous : elles peuvent donner des idées de plats.</p>`}
      </section>
      <section class="stack" style="gap:10px"><h2>Toutes les promos alimentaires <span class="small muted">(${dispo.length})</span></h2>
        <div class="row" role="group" aria-label="Rayon" style="gap:6px"><button class="chip" data-a="promo-filtre" data-k="tout" aria-pressed="${f === 'tout'}">Tout <span class="small muted">${dispo.length}</span></button>${RAYONS_PROMO.filter(([k]) => nbR(k)).map(([k, v]) => `<button class="chip" data-a="promo-filtre" data-k="${k}" aria-pressed="${f === k}">${v} <span class="small muted">${nbR(k)}</span></button>`).join('')}</div>
        ${groupes.map(([n, l]) => `${n ? `<h3 class="titre-magasin">${badgeMagasin(n)} <span class="small muted">${pluriel(l.length, 'promo')}</span></h3>` : ''}<ul class="liste-promos">${l.slice(0, 120).map((o) => lignePromo(o, true)).join('')}</ul>`).join('') || '<p class="small muted">Aucune promo ne correspond. Essayez un autre mot ou un autre rayon.</p>'}
      </section>` : ''}
      <p class="small muted" style="margin:0">Prix et dates donnés par les enseignes, à vérifier en magasin ; offres valables dans les magasins participants et dans la limite des stocks.</p>`;
  }
  /* ---------- alertes promos : produits surveillés dans les offres et les prospectus ---------- */
  const motsAlerte = (t) => E.norm(t).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter((w) => w.length >= 2).map((w) => w.replace(/(s|x)$/, ''));
  function offresPourAlerte(mot) {
    const ms = motsAlerte(mot);
    if (!ms.length || !promos || !promos.offres) return [];
    return promos.offres.filter((o) => { const n = motsAlerte(o.nom); return ms.every((m) => n.some((w) => w.startsWith(m))); });
  }
  function alertesTrouvees() {
    return (S.alertesPromos || []).map((a) => [a, offresPourAlerte(a.mot)]).filter(([, l]) => l.length);
  }
  function nouvellesAlertes() {
    const vues = new Set(S.alertesVues || []);
    return alertesTrouvees().flatMap(([a, l]) => l.filter((o) => !vues.has(o.id)).map((o) => [a, o]));
  }
  function bandeauAlertes() {
    const n = nouvellesAlertes();
    if (!n.length) return '';
    const mots = [...new Set(n.map(([a]) => a.mot))];
    return `<button class="bandeau-alertes ecran-seul" data-a="alertes-voir"><span aria-hidden="true">🔔</span><span><strong>${pluriel(n.length, 'nouvelle promo', 'nouvelles promos')} sur ce que vous surveillez</strong> <span class="small">${esc(mots.slice(0, 4).join(', '))}${mots.length > 4 ? '…' : ''}</span></span><span aria-hidden="true">→</span></button>`;
  }
  function ajouterAlerte(mot) {
    const m = String(mot || '').trim().slice(0, 40);
    if (m.length < 2) return;
    S.alertesPromos = S.alertesPromos || [];
    if (S.alertesPromos.some((a) => E.norm(a.mot) === E.norm(m))) { toast('Déjà surveillé'); return; }
    S.alertesPromos.push({ mot: m, cree: Date.now() });
    const n = offresPourAlerte(m).length;
    toast(n ? `${pluriel(n, 'promo trouvée', 'promos trouvées')} pour « ${m} »` : `« ${m} » est surveillé : vous serez prévenu dès qu’il est en promo`);
  }
  function blocAlertes() {
    const liste = S.alertesPromos || [];
    const trouvees = alertesTrouvees();
    const vues = new Set(S.alertesVues || []);
    const notifDispo = typeof Notification !== 'undefined';
    return `<section class="carte stack alertes-promos" style="gap:10px" id="mes-alertes"><div class="spread"><h2>🔔 Mes alertes promos</h2>${liste.length ? `<span class="small muted">${pluriel(liste.length, 'produit surveillé', 'produits surveillés')}</span>` : ''}</div>
      <p class="small muted" style="margin:0">Indiquez les produits que vous guettez : Budgétable les cherche dans les promos et les prospectus à chaque mise à jour, et vous prévient.</p>
      <form class="row" data-form="alerte" style="gap:8px;flex-wrap:nowrap"><label class="champ" style="flex:1"><span class="sr">Produit à surveiller</span><input type="text" id="alerte-mot" maxlength="40" placeholder="Ex. café, saumon, Nutella, couches…" autocomplete="off"></label><button class="btn btn-plein" type="submit">Surveiller</button></form>
      ${liste.length ? `<div class="row" style="gap:6px">${liste.map((a, i) => { const n = offresPourAlerte(a.mot).length; return `<span class="chip chip-alerte ${n ? 'trouvee' : ''}">${n ? '🔔' : '🔕'} ${esc(a.mot)} ${n ? `<strong class="num">${n}</strong>` : '<span class="small muted">rien cette semaine</span>'}<button class="btn-lien small" data-a="alerte-suppr" data-i="${i}" aria-label="Ne plus surveiller ${esc(a.mot)}">✕</button></span>`; }).join('')}</div>` : `<div class="row" style="gap:6px"><span class="small muted">Idées :</span>${['café', 'saumon', 'lessive', 'chocolat', 'huile d’olive'].map((x) => `<button class="chip chip-petit" data-a="alerte-idee" data-k="${x}">+ ${x}</button>`).join('')}</div>`}
      ${trouvees.length ? `<div class="stack" style="gap:8px">${trouvees.map(([a, l]) => `<div class="stack" style="gap:6px"><strong>${esc(a.mot)} <span class="small muted">· ${pluriel(l.length, 'offre')}</span></strong><ul class="liste-promos">${l.slice(0, 5).map((o) => lignePromo(o, false).replace('<li class="promo"', `<li class="promo ${vues.has(o.id) ? '' : 'nouvelle'}"`)).join('')}</ul></div>`).join('')}
        <div class="row" style="gap:8px">${nouvellesAlertes().length ? '<button class="btn btn-petit" data-a="alertes-lues">✓ Marquer comme vues</button>' : ''}${notifDispo && liste.length ? (Notification.permission === 'granted' && S.alertesNotif ? '<span class="small pourquoi">Notifications activées à l’ouverture de Budgétable</span>' : '<button class="btn btn-petit" data-a="alertes-notif">🔔 Me prévenir par une notification</button>') : ''}</div></div>` : ''}
    </section>`;
  }
  function notifierAlertes() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !S.alertesNotif) return;
    const deja = new Set(S.alertesNotifiees || []);
    const n = nouvellesAlertes().filter(([, o]) => !deja.has(o.id));
    if (!n.length) return;
    const mots = [...new Set(n.map(([a]) => a.mot))];
    try { new Notification('Budgétable : promo sur ' + mots.slice(0, 3).join(', '), { body: n.slice(0, 3).map(([, o]) => `${o.enseigne} · ${o.nom} : ${o.prix.toFixed(2).replace('.', ',')} €`).join('\n'), icon: 'icon.svg', tag: 'budgetable-alertes' }); } catch (e) { /* notifications indisponibles */ }
    S.alertesNotifiees = [...deja, ...n.map(([, o]) => o.id)].slice(-500);
    sauver();
  }

  function blocProspectus() {
    const lus = (promos && promos.prospectus) || [];
    const cartes = lus.map((p) => `<article class="carte-prospectus" style="--m:${MAGASINS[p.enseigne] || '#5b6b62'}"><div class="couverture-prospectus" aria-hidden="true">📰</div><div class="stack" style="gap:4px;min-width:0">${badgeMagasin(p.enseigne)}<strong>${esc(p.titre)}</strong>${p.pages ? `<span class="small muted">${p.pages} pages</span>` : ''}
        <div class="row" style="gap:6px">${p.integrable ? `<button class="btn btn-petit btn-plein" data-a="prospectus-ouvrir" data-u="${esc(p.lien)}" data-k="${esc(p.enseigne)}" data-t="${esc(p.titre)}">Feuilleter</button>` : ''}<a class="btn btn-petit ${p.integrable ? '' : 'btn-plein'}" href="${esc(p.lien)}" target="_blank" rel="noopener">${p.integrable ? '↗' : 'Ouvrir le prospectus ↗'}</a></div></div></article>`).join('');
    const autres = AUTRES_PROMOS.filter(([n]) => !lus.some((p) => n.startsWith(p.enseigne))).map(([n, u]) => `<article class="carte-prospectus" style="--m:${MAGASINS[n.split(' ')[0]] || '#5b6b62'}"><div class="couverture-prospectus" aria-hidden="true">📰</div><div class="stack" style="gap:4px;min-width:0">${badgeMagasin(n.replace(/ \(.*\)/, ''))}<strong>Prospectus en cours</strong><span class="small muted">sur le site de l’enseigne</span><div><a class="btn btn-petit" href="${u}" target="_blank" rel="noopener">Ouvrir ↗</a></div></div></article>`).join('');
    return `<section class="stack" style="gap:10px"><div class="spread" style="align-items:baseline"><h2>📰 Prospectus de la semaine</h2><span class="small muted">à feuilleter avant les courses</span></div>
      <div class="prospectus-liste">${cartes}${autres}</div></section>`;
  }
  function vueProspectus() {
    if (!S.prospectusOuvert) return '';
    const p = S.prospectusOuvert;
    return `<div class="voile voile-prospectus" data-a="prospectus-fond"><div class="fenetre-prospectus" role="dialog" aria-modal="true" aria-label="Prospectus ${esc(p.enseigne)}">
      <div class="spread barre-prospectus" style="flex-wrap:nowrap;align-items:center"><div class="row" style="gap:8px;align-items:center;min-width:0">${badgeMagasin(p.enseigne)}<strong class="titre-prospectus">${esc(p.titre)}</strong></div>
        <div class="row" style="gap:6px;flex-wrap:nowrap"><a class="btn btn-petit" href="${esc(p.lien)}" target="_blank" rel="noopener">Plein écran ↗</a><button class="btn btn-petit btn-plein" data-a="prospectus-fermer">Fermer</button></div></div>
      <iframe src="${esc(p.lien)}" title="Prospectus ${esc(p.enseigne)}" loading="lazy" referrerpolicy="no-referrer" allow="fullscreen"></iframe>
    </div></div>`;
  }

  /* ---------- envoyer la liste ou le menu (mail, SMS, WhatsApp, partage, lien à ouvrir sur un autre téléphone) ---------- */
  function menuTexte() {
    if (!S.plan) return '';
    return joursOrdonnes().map(([jp, j]) => {
      const r = (m) => (m && E.REC[m.recette] ? (m.dehors ? 'dehors' : E.REC[m.recette].nom) : null);
      const g = jp.gamelles && jp.gamelles.n && E.REC[jp.gamelles.recette] ? `gamelle : ${E.REC[jp.gamelles.recette].nom}` : null;
      return `${jp.jour} ${new Date(dateDuJour(j) + 'T12:00:00').getDate()}\n` + [r(jp.dejeuner) ? `  Midi : ${r(jp.dejeuner)}` : g ? `  Midi : ${g}` : null, r(jp.diner) ? `  Soir : ${r(jp.diner)}` : null].filter(Boolean).join('\n');
    }).join('\n');
  }
  function texteEnvoi(quoi) {
    const liste = E.listeCourses(S.plan, S.profil);
    const d = new Date(dateDuJour(0) + 'T12:00:00');
    const titre = `Budgétable · semaine du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    const parts = [titre];
    if (quoi !== 'liste') parts.push('MENU DE LA SEMAINE\n' + menuTexte());
    if (quoi !== 'menu') parts.push('LISTE DE COURSES (' + euros(liste.total).replace(/ /g, ' ') + ' environ)\n\n' + listeTexte(liste));
    return parts.join('\n\n');
  }
  // lien qui ouvre la liste à cocher sur un autre appareil, sans compte : la liste voyage dans l'adresse
  function lienPartage() {
    const liste = E.listeCourses(S.plan, S.profil);
    const par = {};
    liste.articles.filter((a) => !a.enStock && !a.couvertParPlacard).forEach((a) => { (par[a.rayon] = par[a.rayon] || []).push([a.nom, a.libre ? (a.manuel > 1 ? `× ${a.manuel}` : '') : a.sansPrix ? '' : `${a.conditionnements} × ${a.condLabel}`]); });
    const json = JSON.stringify({ t: 'Liste de courses', d: dateDuJour(0), r: Object.entries(par) });
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname.replace(/[^/]*$/, '') + '#liste=' + b64;
  }
  function lireListePartagee() {
    const m = /#liste=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!m) return null;
    try { const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/')); return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))); } catch (e) { return null; }
  }
  function vueListePartagee(l) {
    const cle = 'budgetable.partage.' + (location.hash.length % 997) + '.' + l.d;
    let coches = {}; try { coches = JSON.parse(localStorage.getItem(cle) || '{}'); } catch (e) { /* */ }
    const n = l.r.reduce((t, [, as]) => t + as.length, 0), faits = Object.values(coches).filter(Boolean).length;
    return `<div class="wrap"><main class="stack partage" style="max-width:640px;margin:0 auto;padding:16px">
      <div class="entete"><div class="marque">${LOGO}Budgétable</div></div>
      <div><p class="eyebrow">Liste partagée</p><h1>${esc(l.t)}</h1><p class="muted">Semaine du ${esc(new Date(l.d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))} · ${faits} / ${n} dans le panier</p></div>
      ${l.r.map(([rayon, as]) => `<section class="stack" style="gap:6px"><h3>${esc(rayon)}</h3>${as.map(([nom, q], i) => { const k = rayon + '|' + i; return `<label class="case article-partage ${coches[k] ? 'coche' : ''}"><input type="checkbox" data-a="partage-cocher" data-k="${esc(k)}" data-cle="${esc(cle)}" ${coches[k] ? 'checked' : ''}><span><strong>${esc(nom)}</strong>${q ? ` <span class="small muted">· ${esc(q)}</span>` : ''}</span></label>`; }).join('')}</section>`).join('')}
      <p class="small muted">Les cases cochées restent sur ce téléphone. <a href="${location.pathname}">Découvrir Budgétable</a></p></main></div>`;
  }
  function vueEnvoi() {
    if (!S.envoiOuvert || !S.plan) return '';
    const quoi = S.envoiQuoi || 'liste';
    const texte = texteEnvoi(quoi);
    const sujet = quoi === 'menu' ? 'Le menu de la semaine' : quoi === 'tout' ? 'Menu et liste de courses de la semaine' : 'Liste de courses de la semaine';
    const corps = texte.length > 1800 ? texte.slice(0, 1780) + '\n…' : texte;
    const lien = quoi === 'menu' ? '' : lienPartage();
    const avecLien = (t) => (lien ? t + '\n\nÀ cocher sur votre téléphone : ' + lien : t);
    const partageDispo = typeof navigator.share === 'function';
    return `<div class="voile" data-a="envoi-fond"><div class="fiche fenetre-envoi" role="dialog" aria-modal="true" aria-labelledby="envoi-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Partager</span><h2 id="envoi-titre">Envoyer</h2></div><button class="btn btn-petit" data-a="envoi-fermer">Fermer</button></div>
      <div class="row" role="radiogroup" aria-label="Quoi envoyer" style="gap:6px">${[['liste', 'La liste de courses'], ['menu', 'Le menu de la semaine'], ['tout', 'Les deux']].map(([k, v]) => `<button class="chip" role="radio" data-a="envoi-quoi" data-k="${k}" aria-checked="${quoi === k}" aria-pressed="${quoi === k}">${v}</button>`).join('')}</div>
      <div class="grille-envoi">
        ${partageDispo ? '<button class="choix-envoi" data-a="envoi-partager"><span aria-hidden="true">📲</span><strong>Partager…</strong><span class="small muted">Messages, WhatsApp, Notes…</span></button>' : ''}
        <a class="choix-envoi" href="mailto:?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(avecLien(corps))}"><span aria-hidden="true">✉️</span><strong>Par e-mail</strong><span class="small muted">ouvre votre messagerie</span></a>
        <a class="choix-envoi" href="sms:?&body=${encodeURIComponent(avecLien(quoi === 'liste' ? 'Liste de courses' : corps.slice(0, 600)))}"><span aria-hidden="true">💬</span><strong>Par SMS</strong><span class="small muted">${quoi === 'liste' ? 'avec le lien à cocher' : 'le menu en texte'}</span></a>
        <a class="choix-envoi" href="https://wa.me/?text=${encodeURIComponent(avecLien(corps))}" target="_blank" rel="noopener"><span aria-hidden="true">🟢</span><strong>WhatsApp</strong><span class="small muted">à un proche ou un groupe</span></a>
        <button class="choix-envoi" data-a="envoi-copier"><span aria-hidden="true">📋</span><strong>Copier le texte</strong><span class="small muted">à coller où vous voulez</span></button>
        ${lien ? '<button class="choix-envoi" data-a="envoi-lien"><span aria-hidden="true">🔗</span><strong>Copier le lien</strong><span class="small muted">liste à cocher, sans compte</span></button>' : ''}
      </div>
      ${lien ? '<p class="small muted" style="margin:0">Le lien ouvre la liste sur n’importe quel téléphone, avec des cases à cocher en magasin. Rien n’est envoyé à Budgétable : la liste est dans le lien.</p>' : ''}
      <details><summary class="small"><strong>Aperçu du texte</strong></summary><pre class="apercu-envoi">${esc(texte)}</pre></details>
    </div></div>`;
  }

  function listeTexte(liste) {
    const par = {};
    liste.articles.filter((a) => !a.enStock).forEach((a) => { (par[a.rayon] = par[a.rayon] || []).push(a); });
    return Object.entries(par).map(([r, as]) => `${r.toUpperCase()}\n` + as.map((a) => a.libre ? `- ${a.nom}${a.manuel > 1 ? ' × ' + a.manuel : ''}` : `- ${a.nom} : ${quantite(a.quantite, a.unite)} (${a.conditionnements} × ${a.condLabel})`).join('\n')).join('\n\n');
  }

  // une ligne de la liste : ce qu'on met dans le panier en gros, le besoin réel en petit
  function ligneArticle(a) {
    const piece = a.unite === 'pièce';
    const besoin = piece ? `il en faut ${nb(Math.max(1, Math.ceil(a.quantite - 0.05)))}` : `il vous faut ${quantite(a.quantite, a.unite)}`;
    const pastille = a.libre ? `<span class="pastille-qte"><strong class="num">${a.manuel}</strong> × à prendre</span>`
      : a.couvertParPlacard ? '<span class="pastille-qte ok">✓ Déjà au placard</span>'
      : a.enStock ? '<span class="pastille-qte ok">En réserve</span>'
      : a.sansPrix ? '<span class="pastille-qte">Selon la recette</span>'
      : `<span class="pastille-qte"><strong class="num">${a.conditionnements}</strong> × ${esc(a.condLabel)}</span>`;
    const promo = !a.enStock && promosPour(a.id).length ? promosPour(a.id)[0] : null;
    return `<div class="article ${S.coches[a.id] ? 'coche' : ''} ${a.enStock || a.couvertParPlacard ? 'stock' : ''}">
      <input type="checkbox" id="c-${a.id}" data-a="cocher" data-id="${a.id}" ${S.coches[a.id] ? 'checked' : ''} ${a.enStock ? 'disabled' : ''} aria-label="Acheté : ${esc(a.nom)}">
      <label class="nom" for="c-${a.id}">${esc(a.nom)}</label>
      <span class="prix num">${a.couvertParPlacard || a.enStock ? '' : a.sansPrix || (E.ING[a.id] && E.ING[a.id].manuel && !E.ING[a.id].prixDemo) ? 'prix ?' : euros(a.cout)}</span>
      <div class="qte-achat">${pastille}${a.manuel ? `<span class="tag-main small">✍️ ${a.seulManuel ? 'ajouté à la main' : `dont ${a.manuel} ajouté${a.manuel > 1 ? 's' : ''} à la main`}</span>` : ''}${a.sansPrix || a.enStock || a.seulManuel ? '' : `<span class="small muted">${besoin}${a.auPlacard > 0 && !a.couvertParPlacard ? ` · ${quantite(a.auPlacard, a.unite)} déjà au placard` : ''}${a.couvertParPlacard ? ` · vous avez ${quantite(a.auPlacard, a.unite)}` : ''}</span>`}${promo ? `<button class="tag-promo ecran-seul" data-a="onglet" data-k="promos" title="Voir les promotions">🏷 ${esc(promo.enseigne)} ${euros(promo.prix)}${promo.remise ? ' · ' + esc(promo.remise) : ''}</button>` : ''}</div>
      <div class="actions-article ecran-seul">${a.manuel ? `<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn-mini" data-a="manuel-qte" data-id="${a.id}" data-d="-1" aria-label="Un de moins : ${esc(a.nom)}">−</button><button class="btn-mini" data-a="manuel-qte" data-id="${a.id}" data-d="1" aria-label="Un de plus : ${esc(a.nom)}">+</button><button class="btn-mini" data-a="manuel-suppr" data-id="${a.id}" aria-label="Retirer ${esc(a.nom)} de la liste">✕ Retirer</button></span>` : ''}${a.libre ? '' : `<button class="btn-mini" data-a="stock" data-id="${a.id}">${a.enStock || a.couvertParPlacard ? '↩ Je n’en ai plus' : '🏠 J’en ai déjà'}</button>`}${S.drives.enseigne && !a.enStock && !a.couvertParPlacard ? `<a class="btn-mini" href="${DRIVES[S.drives.enseigne].url(termeRecherche(a.nom))}" target="_blank" rel="noopener" aria-label="Chercher ${esc(a.nom)} chez ${esc(DRIVES[S.drives.enseigne].nom)} (nouvel onglet)">🔍 ${esc(DRIVES[S.drives.enseigne].nom)} ↗</a>` : ''}</div>
    </div>`;
  }
  /* ---------- tickets de caisse et récapitulatifs de drive : vrais prix par magasin, comparaison ---------- */
  const TK = window.Ticket;
  const ENSEIGNES_TICKET = TK ? TK.ENSEIGNES.map(([id, nom]) => [id, nom]) : [];
  const cleMagasin = (enseigne, type) => `${enseigne || 'autre'}-${type === 'drive' ? 'drive' : 'magasin'}`;
  const nomMagasin = (enseigne, type) => { const e = ENSEIGNES_TICKET.find(([k]) => k === enseigne); return `${e ? e[1] : 'Autre magasin'}${type === 'drive' ? ' Drive' : ''}`; };
  function appliquerPrixMagasin() {
    const m = S.magasinActif && (S.prixMagasins || {})[S.magasinActif];
    E.definirPrixMagasin(m ? Object.fromEntries(Object.entries(m.prix || {}).map(([id, x]) => [id, x.p])) : null, m ? { nom: m.nom, date: m.maj ? new Date(m.maj + 'T12:00:00').toLocaleDateString('fr-FR') : '' } : null);
  }
  const NON_ALIMENTAIRE_TICKET = /lessive|papier|essuie|mouchoir|shampo|gel douche|savon|dentifrice|brosse|sac\b|sacs\b|nettoy|eponge|javel|piles?\b|couche|lingette|deodorant|rasoir|litiere|croquette|patee|bougie|ampoule|serviette|coton|vaisselle|adoucissant|desodor|insecticide|journal|magazine|carte cadeau/;
  const MOTS_VAGUES = new Set(['liquide', 'entier', 'demi', 'ecreme', 'nature', 'bio', 'frais', 'fraiche', 'extra', 'maxi', 'mini', 'lot', 'sachet', 'boite', 'pack', 'classique', 'tranches', 'tranche', 'barquette', 'filet', 'filets', 'plein', 'air', 'gros', 'petit', 'petits', 'grand', 'format', 'familial', 'eco', 'premium', 'gourmand', 'origine', 'france', 'cat', 'calibre', 'piece', 'pieces', 'unite', 'promo', 'offre', 'marque', 'repere', 'pouce', 'bouteille', 'brique', 'pot', 'kg', 'les', 'des', 'aux', 'avec', 'sans', 'pour']);
  /** Rapproche un libellé de ticket d'un produit du catalogue (en retenant les corrections déjà faites). */
  function rapprocher(libelle) {
    const cle = TK.norm(libelle).replace(/\d+([,.]\d+)?\s*(kg|g|gr|l|cl|ml)\b/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    const appris = (S.correspondances || {})[cle];
    if (appris !== undefined) return { id: appris || null, cle, appris: true };
    if (NON_ALIMENTAIRE_TICKET.test(cle)) return { id: null, cle, nonAlim: true };
    const mots = cle.split(' ').filter((m) => m.length > 2 && !MOTS_VAGUES.has(m));
    const essais = [cle, mots.slice(0, 2).join(' '), mots[0]].filter((x) => x && x.length >= 3);
    for (const e of essais) { const l = window.Saisie.chercherIngredients(e, 1).filter((id) => E.ING[id] && !E.ING[id].perso); if (l.length) return { id: l[0], cle }; }
    return { id: null, cle };
  }
  const nbPaquets = (l, ing) => (l.poids && ((l.poids.unite === 'g' && ing.unite === 'g') || (l.poids.unite === 'ml' && ing.unite === 'ml')) ? (l.auKilo ? l.poids.q : l.poids.q * (l.qte || 1)) / ing.cond : (l.qte || 1));
  /** Produits prévus dans la liste de courses (pour repérer les achats imprévus). */
  function produitsPrevus() {
    if (!S.plan) return { ids: new Set(), noms: [] };
    const l = E.listeCourses(S.plan, S.profil).articles;
    return { ids: new Set(l.filter((a) => !a.libre).map((a) => a.id)), noms: l.filter((a) => a.libre).map((a) => TK.norm(a.nom)) };
  }
  const estImprevu = (l, prevus) => !(l.id && prevus.ids.has(l.id)) && !prevus.noms.some((n) => n && TK.norm(l.libelle).includes(n));
  function preparerLignes(r) {
    const t = S.ticket;
    t.prevus = produitsPrevus();
    t.lignes = (r.lignes || []).map((l) => { const ra = rapprocher(l.libelle); return { ...l, poids: l.poids || (l.poidsKg ? { q: l.poidsKg * 1000, unite: 'g' } : TK.poidsDe(l.libelle)), id: ra.id, cle: ra.cle, ignore: !!ra.nonAlim || (ra.appris && !ra.id) }; });
    if (r.enseigne && !t.enseigne) { const d = typeof r.enseigne === 'string' ? TK.detecterEnseigne(r.enseigne) : r.enseigne; if (d) t.enseigne = d.id; }
    if (r.date) t.date = r.date;
    if (r.total) t.total = r.total;
    t.etape = 'lignes';
  }
  let tesseractCharge = null;
  function chargerTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tesseractCharge) tesseractCharge = new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; sc.onload = () => ok(window.Tesseract); sc.onerror = () => { tesseractCharge = null; ko(new Error('chargement')); }; document.head.appendChild(sc); });
    return tesseractCharge;
  }
  /** Photo du ticket : redressée en niveaux de gris et contrastée, lue par l'assistant du site s'il est là, sinon sur l'appareil. */
  async function lirePhotoTicket(fichier) {
    const t = S.ticket; t.lecture = { etat: 'encours', pct: 0, texte: 'Préparation de la photo…' }; rendre();
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(fichier); });
      // un ticket est étroit et long : on vise ~1400 px de large pour que les caractères fassent 25 à 35 px de haut
      const k = Math.max(0.5, Math.min(2.5, 1400 / Math.min(img.width, img.height), 4000 / Math.max(img.width, img.height)));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
      // niveaux de gris, puis étirement du contraste entre les 2 % les plus sombres et les 10 % les plus clairs (papier)
      const hist = new Uint32Array(256);
      for (let i = 0; i < px.length; i += 4) { const v = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) | 0; px[i] = v; hist[v]++; }
      const n = px.length / 4; let acc = 0, bas = 0, haut = 255;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { bas = v; break; } }
      acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.10) { haut = v; break; } }
      const ech = 255 / Math.max(30, haut - bas);
      for (let i = 0; i < px.length; i += 4) { const w = Math.max(0, Math.min(255, (px[i] - bas) * ech)); px[i] = px[i + 1] = px[i + 2] = w; }
      g.putImageData(d, 0, 0);
      let r = null;
      // 1. l'assistant du site, plus fiable sur les tickets froissés (quand il est configuré)
      try {
        const etat = await fetch(`${LECTEUR}/ia/etat`, { signal: AbortSignal.timeout(8000) }).then((x) => x.json());
        if (etat && etat.vision) {
          t.lecture = { etat: 'encours', pct: 30, texte: 'L’assistant lit votre ticket…' }; rendre();
          const rep = await fetch(`${LECTEUR}/ticket`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ image: c.toDataURL('image/jpeg', 0.85) }), signal: AbortSignal.timeout(60000) });
          if (rep.ok) { const j = await rep.json(); if (j && j.lignes && j.lignes.length) r = j; }
        }
      } catch (e) { /* on lit sur l'appareil */ }
      // 2. lecture sur l'appareil (Tesseract, gratuit, la photo ne quitte pas le téléphone)
      if (!r) {
        t.lecture = { etat: 'encours', pct: 5, texte: 'Chargement du lecteur de texte (la première fois, quelques secondes)…' }; rendre();
        const T = await chargerTesseract();
        const worker = await T.createWorker('fra', 1, { logger: (m) => { if (m.status === 'recognizing text' && S.ticket) { S.ticket.lecture = { etat: 'encours', pct: Math.round(m.progress * 100), texte: 'Lecture du ticket…' }; const z = document.getElementById('ticket-progres'); if (z) z.textContent = `Lecture du ticket… ${Math.round(m.progress * 100)} %`; } } });
        await worker.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1', user_defined_dpi: '300' });
        const res = await worker.recognize(c);
        await worker.terminate();
        t.texte = res && res.data ? res.data.text : '';
        r = TK.analyser(t.texte);
      }
      t.lecture = null;
      if (!r.lignes.length) { t.erreur = 'Je n’ai pas réussi à lire d’article sur cette photo. Reprenez-la bien à plat, avec de la lumière, ou collez le texte, ou saisissez les articles.'; rendre(); return; }
      preparerLignes(r); rendre();
    } catch (e) {
      t.lecture = null; t.erreur = 'Lecture impossible (connexion ?). Vous pouvez coller le texte du ticket ou saisir les articles.'; rendre();
    }
  }
  function vueTicket() {
    const t = S.ticket;
    if (!t) return '';
    const tete = (titre, sous) => `<div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Ticket de caisse</span><h2 id="ticket-titre">${titre}</h2>${sous ? `<span class="small muted">${sous}</span>` : ''}</div><button class="btn btn-petit" data-a="ticket-fermer">Fermer</button></div>`;
    const choixMagasin = `<div class="stack" style="gap:6px"><strong>Où avez-vous fait vos courses ?</strong>
      <div class="row" role="radiogroup" style="gap:6px">${[['magasin', '🏬 En magasin'], ['drive', '🚗 En drive ou en livraison']].map(([k, v]) => `<button class="chip" role="radio" data-a="ticket-type" data-k="${k}" aria-checked="${t.type === k}" aria-pressed="${t.type === k}">${v}</button>`).join('')}</div>
      <div class="row" style="gap:6px">${ENSEIGNES_TICKET.map(([k, nom]) => `<button class="chip chip-petit" data-a="ticket-enseigne" data-k="${k}" aria-pressed="${t.enseigne === k}">${esc(nom)}</button>`).join('')}<button class="chip chip-petit" data-a="ticket-enseigne" data-k="autre" aria-pressed="${t.enseigne === 'autre'}">Autre</button></div></div>`;
    let corps = '';
    if (t.lecture) corps = `${tete('Lecture du ticket…')}<div class="stack" style="gap:8px;align-items:center;padding:20px"><div class="sablier" aria-hidden="true">🧾</div><strong id="ticket-progres">${esc(t.lecture.texte)}${t.lecture.pct ? ` ${t.lecture.pct} %` : ''}</strong><span class="small muted">La photo est lue sur votre téléphone.</span></div>`;
    else if (t.etape === 'source') corps = `${tete('Comparer mon ticket avec l’appli', 'Les vrais prix de votre magasin remplacent les prix de démonstration, et vous pourrez comparer les magasins et les drives.')}
      ${choixMagasin}
      ${t.erreur ? `<div class="bandeau bandeau-alerte small"><span>${esc(t.erreur)}</span></div>` : ''}
      <div class="sources-ticket">
        <label class="source-ticket"><span class="ico" aria-hidden="true">📷</span><strong>Prendre le ticket en photo</strong><span class="small muted">Ticket à plat, bien éclairé, en entier</span><input type="file" accept="image/*" capture="environment" data-a="ticket-photo" class="visuellement-cache"></label>
        <button class="source-ticket" data-a="ticket-coller"><span class="ico" aria-hidden="true">📋</span><strong>Coller le récapitulatif</strong><span class="small muted">E-mail ou page de commande du drive</span></button>
        <button class="source-ticket" data-a="ticket-saisir"><span class="ico" aria-hidden="true">✍️</span><strong>Saisir les articles</strong><span class="small muted">Libellé et prix, ligne par ligne</span></button>
      </div>
      ${t.coller ? `<label class="champ"><span>Texte du ticket ou de la commande</span><textarea id="ticket-texte" rows="8" placeholder="Collez ici le récapitulatif de votre commande ou le texte du ticket">${esc(t.texte || '')}</textarea></label><div><button class="btn btn-plein" data-a="ticket-analyser">Lire les articles</button></div>` : ''}`;
    else if (t.etape === 'lignes') {
      const lignes = t.lignes;
      const prises = lignes.filter((l) => l.id && !l.ignore);
      const totalLignes = Math.round(lignes.filter((l) => !l.ignore).reduce((s, l) => s + (l.prix || 0), 0) * 100) / 100;
      const estim = Math.round(prises.reduce((s, l) => s + E.prixReference(l.id) * nbPaquets(l, E.ING[l.id]), 0) * 100) / 100;
      const payeReconnu = Math.round(prises.reduce((s, l) => s + (l.prix || 0), 0) * 100) / 100;
      corps = `${tete(`${pluriel(lignes.length, 'article')} sur le ticket`, 'Vérifiez le produit associé à chaque ligne : touchez-le pour le changer. Les produits non alimentaires peuvent être ignorés.')}
      ${choixMagasin}
      <div class="table-ticket" role="table" aria-label="Articles du ticket">${lignes.map((l, i) => {
        const ing = l.id && E.ING[l.id];
        const pp = ing ? TK.prixPaquet(l, ing) : null, ref = ing ? E.prixReference(l.id) : 0;
        const doute = pp && !TK.plausible(pp, ref);
        return `<div class="ligne-ticket ${l.ignore ? 'ignoree' : ''}" role="row">
          <div class="stack" style="gap:2px;min-width:0"><input class="libelle-ticket" type="text" value="${esc(l.libelle)}" data-a="ticket-libelle" data-i="${i}" aria-label="Libellé"><span class="small muted">${l.qte > 1 ? `${l.qte} × ${euros(l.prixUnitaire || l.prix / l.qte)} · ` : ''}${l.poids ? quantite(l.auKilo ? l.poids.q : l.poids.q * (l.qte || 1), l.poids.unite) : ''}</span></div>
          <label class="prix-ticket"><input type="text" inputmode="decimal" value="${String(l.prix).replace('.', ',')}" data-a="ticket-prix" data-i="${i}" aria-label="Prix payé"> €</label>
          <div class="stack" style="gap:2px;min-width:0">${S.ticketCherche === i ? `<input type="search" id="ticket-cherche" data-a="ticket-cherche" data-i="${i}" placeholder="Chercher le produit…" autocomplete="off"><div id="ticket-propositions" class="row" style="gap:4px"></div>`
            : `<button class="produit-ticket ${ing ? '' : 'inconnu'}" data-a="ticket-produit" data-i="${i}">${ing ? esc(ing.nom.replace(/\s*\([^)]*\)\s*$/, '')) : 'Choisir le produit'}</button>`}
            ${pp && !l.ignore ? `<span class="small ${doute ? 'alerte-ing' : 'muted'}">${euros(pp)} le paquet (${esc(ing.condLabel)}) · appli ${euros(ref)}${doute ? ' · à vérifier' : ''}</span>` : ''}</div>
          <label class="case small"><input type="checkbox" data-a="ticket-ignorer" data-i="${i}" ${l.ignore ? 'checked' : ''}><span>Ignorer</span></label></div>`;
      }).join('')}</div>
      <div class="row" style="gap:8px"><button class="btn btn-petit" data-a="ticket-ajout-ligne">+ Ajouter une ligne</button></div>
      ${t.texte ? `<details class="texte-lu small" ${t.voirTexte ? 'open' : ''}><summary data-a="ticket-voir-texte">Voir et corriger le texte lu sur la photo</summary><p class="muted" style="margin:6px 0">Une ligne mal lue ? Corrigez le texte ci-dessous (un article par ligne, le prix à la fin), puis « Relire ».</p><textarea id="ticket-texte-lu" rows="10">${esc(t.texte)}</textarea><div><button class="btn btn-petit btn-plein" data-a="ticket-relire">Relire le texte</button></div></details>` : ''}
      <div class="resume-ticket"><div><span class="small muted">Total des lignes</span><strong class="num">${euros(totalLignes)}</strong>${t.total && Math.abs(t.total - totalLignes) > 0.05 ? `<span class="small muted">ticket : ${euros(t.total)}</span>` : ''}</div>
        <div><span class="small muted">${pluriel(prises.length, 'produit reconnu', 'produits reconnus')} : payé</span><strong class="num">${euros(payeReconnu)}</strong></div>
        <div><span class="small muted">Estimation de l’appli</span><strong class="num">${euros(estim)}</strong><span class="small ${payeReconnu > estim ? 'alerte-ing' : 'muted'}">${estim ? (payeReconnu > estim ? `+${euros(payeReconnu - estim)} plus cher` : `${euros(estim - payeReconnu)} moins cher`) : ''}</span></div></div>
      ${blocImprevus(t)}
      <label class="case small"><input type="checkbox" data-a="ticket-ranger" ${t.ranger ? 'checked' : ''}><span>Ranger dans mon placard les produits prévus dans ma liste</span></label>
      <label class="case small"><input type="checkbox" data-a="ticket-utiliser" ${t.utiliser ? 'checked' : ''}><span>Utiliser les prix de ce magasin pour mes menus et ma liste de courses</span></label>
      <button class="btn btn-plein btn-grand" data-a="ticket-enregistrer" ${prises.length && t.enseigne ? '' : 'disabled'}>${t.enseigne ? `Enregistrer les prix ${esc(nomMagasin(t.enseigne, t.type))}` : 'Choisissez le magasin'}</button>`;
    } else if (t.etape === 'fin') {
      const f = t.fin;
      corps = `${tete('C’est noté, merci !')}
      <div class="chiffres-calc"><div><span class="small muted">Prix enregistrés</span><strong class="num repere-final">${f.n}</strong><span class="small muted">chez ${esc(f.nom)}</span></div><div><span class="small muted">Payé (produits reconnus)</span><strong class="num">${euros(f.paye)}</strong></div><div><span class="small muted">Estimation de l’appli</span><strong class="num">${euros(f.estim)}</strong></div></div>
      <p style="margin:0">${f.paye > f.estim ? `Vos courses ont coûté <strong>${euros(f.paye - f.estim)} de plus</strong> que l’estimation : vos menus et votre liste utilisent maintenant les vrais prix de ${esc(f.nom)}.` : `Vos courses ont coûté <strong>${euros(f.estim - f.paye)} de moins</strong> que l’estimation : bien joué !`}${f.ranges ? ` ${pluriel(f.ranges, 'produit rangé', 'produits rangés')} dans votre placard.` : ''}</p>
      ${f.nImprevus ? `<p style="margin:0">🛒 <strong>${euros(f.imprevus)}</strong> d’achats imprévus (${pluriel(f.nImprevus, 'article')} hors de votre liste).</p>` : '<p style="margin:0">✓ Aucun achat imprévu : bravo, vous avez suivi votre liste.</p>'}
      <p class="small muted" style="margin:0">Scannez aussi les tickets d’autres magasins ou drives : la page Courses comparera le prix de votre liste partout.</p>
      <div class="row" style="gap:8px"><button class="btn btn-plein" data-a="ticket-fermer">Voir ma liste de courses</button><button class="btn" data-a="ticket-ouvrir">Scanner un autre ticket</button></div>`;
    }
    return `<div class="voile" data-a="ticket-fond"><div class="fiche fenetre-ticket" role="dialog" aria-modal="true" aria-labelledby="ticket-titre">${corps}</div></div>`;
  }
  /** Achats imprévus : ce qui n'était pas dans la liste de courses, avec le total, et la proposition de les ranger au placard. */
  function blocImprevus(t) {
    const prevus = t.prevus || { ids: new Set(), noms: [] };
    const imp = t.lignes.map((l, i) => ({ l, i })).filter(({ l }) => l.libelle && l.prix > 0 && estImprevu(l, prevus));
    if (!imp.length) return '<div class="bandeau bandeau-info small"><span>✓ Aucun achat imprévu : tout était dans votre liste de courses.</span></div>';
    const total = Math.round(imp.reduce((s, { l }) => s + l.prix, 0) * 100) / 100;
    const alim = imp.filter(({ l }) => l.id && !l.ignore);
    t.imprevusPlacard = t.imprevusPlacard || Object.fromEntries(alim.map(({ i }) => [i, true]));
    return `<section class="imprevus stack" style="gap:8px"><div class="spread" style="align-items:baseline"><strong>🛒 Produits imprévus <span class="small muted">· ${pluriel(imp.length, 'article')} pas dans votre liste</span></strong><strong class="num">${euros(total)}</strong></div>
      <ul class="liste-imprevus">${imp.map(({ l, i }) => { const ing = l.id && !l.ignore && E.ING[l.id]; return `<li><span>${esc(ing ? ing.nom.replace(/\s*\([^)]*\)\s*$/, '') : l.libelle)}${!ing ? ` <span class="small muted">· ${l.ignore ? 'non alimentaire' : 'produit non reconnu'}</span>` : ''}</span><span class="num">${euros(l.prix)}</span>${ing ? `<label class="case small"><input type="checkbox" data-a="ticket-imprevu-placard" data-i="${i}" ${t.imprevusPlacard[i] !== false ? 'checked' : ''}><span>Au placard</span></label>` : '<span></span>'}</li>`; }).join('')}</ul>
      ${alim.length ? `<span class="small muted">Les produits cochés « Au placard » y seront ajoutés : vos menus les utiliseront en premier.</span>` : ''}</section>`;
  }
  function enregistrerTicket() {
    const t = S.ticket, p = S.profil;
    const cle = cleMagasin(t.enseigne, t.type), nom = nomMagasin(t.enseigne, t.type);
    S.prixMagasins = S.prixMagasins || {};
    const mag = S.prixMagasins[cle] = S.prixMagasins[cle] || { nom, enseigne: t.enseigne, type: t.type, prix: {} };
    const date = t.date || ISO(new Date());
    const parId = {};
    S.correspondances = S.correspondances || {};
    for (const l of t.lignes) {
      if (l.cle) S.correspondances[l.cle] = l.ignore ? '' : (l.id || undefined);
      if (!l.id || l.ignore) continue;
      const ing = E.ING[l.id], pp = TK.prixPaquet(l, ing);
      if (pp && TK.plausible(pp, E.prixReference(l.id))) (parId[l.id] = parId[l.id] || []).push(pp);
    }
    for (const [id, l] of Object.entries(parId)) mag.prix[id] = { p: Math.round(l.reduce((s, x) => s + x, 0) / l.length * 100) / 100, d: date };
    mag.maj = date;
    const prises = t.lignes.filter((l) => l.id && !l.ignore);
    const paye = Math.round(prises.reduce((s, l) => s + (l.prix || 0), 0) * 100) / 100;
    const estim = Math.round(prises.reduce((s, l) => s + E.prixReference(l.id) * nbPaquets(l, E.ING[l.id]), 0) * 100) / 100;
    let ranges = 0;
    const prevus = t.prevus || { ids: new Set(), noms: [] };
    const imprevus = t.lignes.map((l, i) => ({ l, i })).filter(({ l }) => l.libelle && l.prix > 0 && estImprevu(l, prevus));
    const totalImprevus = Math.round(imprevus.reduce((s, { l }) => s + l.prix, 0) * 100) / 100;
    const aRanger = prises.filter((l) => {
      const i = t.lignes.indexOf(l);
      return estImprevu(l, prevus) ? (t.imprevusPlacard || {})[i] !== false : t.ranger;
    });
    if (aRanger.length) { const aj = aRanger.map((l) => [l.id, nbPaquets(l, E.ING[l.id]) * E.ING[l.id].cond]); p.stock = E.ajouterAuStock(p.stock, aj); ranges = aj.length; }
    S.tickets = [{ d: date, mag: cle, nom, total: t.total || paye, paye, estim, n: prises.length, imprevus: totalImprevus, nImprevus: imprevus.length, detailImprevus: imprevus.slice(0, 30).map(({ l }) => [l.id && !l.ignore && E.ING[l.id] ? E.ING[l.id].nom : l.libelle, l.prix]) }].concat(S.tickets || []).slice(0, 60);
    if (t.utiliser) S.magasinActif = cle;
    appliquerPrixMagasin();
    t.fin = { n: Object.keys(parId).length, nom, paye, estim, ranges, imprevus: totalImprevus, nImprevus: imprevus.length };
    t.etape = 'fin';
  }
  /** Les achats imprévus du mois : total et produits qui reviennent le plus. */
  function blocImprevusMois() {
    const mois = ISO(new Date()).slice(0, 7);
    const l = (S.tickets || []).filter((x) => (x.d || '').startsWith(mois) && x.imprevus > 0);
    if (!l.length) return '';
    const total = Math.round(l.reduce((s, x) => s + x.imprevus, 0) * 100) / 100;
    const compte = {};
    l.forEach((x) => (x.detailImprevus || []).forEach(([n, pr]) => { compte[n] = compte[n] || { n: 0, pr: 0 }; compte[n].n++; compte[n].pr += pr; }));
    const top = Object.entries(compte).sort((a, b) => b[1].pr - a[1].pr).slice(0, 5);
    return `<div class="imprevus-mois stack" style="gap:6px"><div class="spread"><strong>🛒 Achats imprévus ce mois-ci</strong><strong class="num">${euros(total)}</strong></div>
      ${top.length ? `<ul class="liste-imprevus">${top.map(([n, x]) => `<li><span>${esc(n)}${x.n > 1 ? ` <span class="small muted">· ${x.n} fois</span>` : ''}</span><span class="num">${euros(x.pr)}</span><span></span></li>`).join('')}</ul>` : ''}
      <span class="small muted">Un produit qui revient souvent ? Ajoutez-le à votre liste avec « Ajouter un produit », ou à vos provisions dans le placard.</span></div>`;
  }
  /** Sur la page Courses : scanner un ticket, choisir les prix utilisés, comparer la liste entre magasins. */
  function blocTickets(liste) {
    const mags = Object.entries(S.prixMagasins || {});
    const aPrendre = liste.articles.filter((a) => !a.enStock && !a.couvertParPlacard && !a.libre && E.ING[a.id] && !E.ING[a.id].perso);
    const compare = mags.map(([k, m]) => {
      let total = 0, connus = 0;
      for (const a of aPrendre) { const x = (m.prix || {})[a.id]; total += a.conditionnements * (x ? x.p : E.prixReference(a.id)); if (x) connus++; }
      return { k, m, total: Math.round(total * 100) / 100, couverture: aPrendre.length ? Math.round(connus / aPrendre.length * 100) : 0 };
    }).sort((a, b) => a.total - b.total);
    const demo = Math.round(aPrendre.reduce((s, a) => s + a.conditionnements * E.prixReference(a.id), 0) * 100) / 100;
    return `<section class="carte stack ecran-seul bloc-tickets" style="gap:10px"><div class="spread"><h2>🧾 Mes tickets et mes prix</h2><button class="btn btn-plein btn-petit" data-a="ticket-ouvrir">Scanner un ticket</button></div>
      <p class="small muted" style="margin:0">Après vos courses, scannez le ticket (ou collez le récapitulatif du drive) : l’appli apprend les vrais prix de chaque magasin et compare le prix de votre liste.</p>
      ${mags.length ? `<div class="stack" style="gap:6px"><strong class="small">Prix utilisés pour mes menus et ma liste</strong><div class="row" role="radiogroup" style="gap:6px"><button class="chip" role="radio" data-a="magasin-actif" data-k="" aria-checked="${!S.magasinActif}" aria-pressed="${!S.magasinActif}">Prix de démonstration</button>${mags.map(([k, m]) => `<button class="chip" role="radio" data-a="magasin-actif" data-k="${k}" aria-checked="${S.magasinActif === k}" aria-pressed="${S.magasinActif === k}">${esc(m.nom)} <span class="small muted">· ${Object.keys(m.prix || {}).length} prix</span></button>`).join('')}</div></div>
      <div class="stack" style="gap:6px"><strong class="small">Ma liste de la semaine selon le magasin</strong>${compare.every((c) => !c.couverture) ? '<span class="small muted">Aucun article de votre liste actuelle n’a encore de prix relevé : la comparaison se remplira avec vos prochains tickets.</span>' : ''}<ul class="comparatif-magasins">${compare.map((c, i) => `<li><span>${i === 0 && compare.length > 1 && c.couverture && c.total < compare[compare.length - 1].total - 0.01 ? '🏆 ' : ''}<strong>${esc(c.m.nom)}</strong></span><span class="barre-couv" title="${c.couverture} % des articles avec un vrai prix"><i style="width:${c.couverture}%"></i></span><span class="small muted">${c.couverture} % de vrais prix</span><strong class="num">${euros(c.total)}</strong></li>`).join('')}<li class="muted"><span>Prix de démonstration</span><span></span><span></span><span class="num">${euros(demo)}</span></li></ul>
      <span class="small muted">Pour les articles dont le prix n’a pas encore été relevé dans un magasin, le prix de démonstration est utilisé : plus vous scannez de tickets, plus la comparaison est juste.</span></div>` : ''}
      ${(S.tickets || []).length ? `<details class="small"><summary>Mes derniers tickets (${S.tickets.length})</summary><ul class="liste-tickets">${S.tickets.slice(0, 10).map((x) => `<li><span>${new Date(x.d + 'T12:00:00').toLocaleDateString('fr-FR')}</span><span>${esc(x.nom)}</span><span class="num">${euros(x.paye)}</span><span class="small ${x.paye > x.estim ? 'alerte-ing' : 'muted'}">${x.estim ? (x.paye > x.estim ? '+' : '−') + euros(Math.abs(x.paye - x.estim)) + ' / estimation' : ''}${x.imprevus ? ` · 🛒 ${euros(x.imprevus)} d’imprévus` : ''}</span></li>`).join('')}</ul></details>` : ''}
      ${blocImprevusMois()}
    </section>`;
  }

  function blocAjoutCourses() {
    return `<section class="carte stack ecran-seul ajout-courses" style="gap:8px"><h2>Ajouter un produit à la liste</h2>
      <form class="row" style="gap:8px;flex-wrap:nowrap" onsubmit="return false"><label class="champ" style="flex:1;min-width:0"><span class="sr">Produit à ajouter</span><input type="search" id="manuel-cherche" data-a="manuel-cherche" placeholder="Ex. café, papier toilette, pommes…" autocomplete="off" enterkeyhint="done"></label><button class="btn btn-plein" data-a="manuel-ajouter-texte" type="button">Ajouter</button></form>
      <div id="manuel-propositions" class="row" style="gap:6px"></div>
      <span class="small muted">Produits du quotidien, hygiène, envies du moment : ils s’ajoutent à la liste et partent avec elle (envoi, impression, drive).</span></section>`;
  }
  function propositionsManuelles(t) {
    if (t.length < 2) return '';
    const ids = window.Saisie.chercherIngredients(t, 8).filter((id) => E.ING[id] && !E.ING[id].perso);
    return ids.map((id) => `<button class="chip puce-ajout" data-a="manuel-ajouter" data-id="${id}">+ ${esc(E.ING[id].nom)} <span class="small muted">· ${esc(E.ING[id].condLabel)}</span></button>`).join('') + `<button class="chip" data-a="manuel-ajouter-texte">+ « ${esc(t.slice(0, 40))} » tel quel</button>`;
  }
  function ajouterManuel(x) {
    if (!S.plan) { toast('Créez d’abord votre semaine'); return; }
    const l = S.plan.manuels = S.plan.manuels || [];
    const ex = l.find((y) => (x.id && y.id === x.id) || (x.nom && y.nom && y.nom.toLowerCase() === x.nom.toLowerCase()));
    if (ex) ex.n = (ex.n || 1) + 1; else l.push({ ...x, n: 1 });
    toast(`${x.id ? E.ING[x.id].nom : x.nom} : ajouté à la liste`);
    const champ = document.getElementById('manuel-cherche'); if (champ) champ.value = '';
  }
  /** « J'en ai déjà » / « Je n'en ai plus » dans la liste : c'est le placard qui change, et la liste suit. */
  function basculerPlacardDepuisListe(id) {
    const p = S.profil, i = E.ING[id];
    const a = E.listeCourses(S.plan, p).articles.find((x) => x.id === id);
    if (a && (a.enStock || a.couvertParPlacard)) {
      const st = { ...(p.stock || {}) }; delete st[id]; p.stock = st;
      p.provisions = (p.provisions || []).filter((x) => x !== id);
      toast(`${i.nom} retiré du placard : remis dans la liste de courses`);
    } else {
      // on range de quoi couvrir la semaine (arrondi au paquet), sans réduire ce qui y est déjà
      const besoin = a ? a.quantite : i.cond;
      const q = Math.max(i.cond, Math.ceil((besoin - 1e-9) / i.cond) * i.cond);
      p.stock = E.ajouterAuStock(p.stock, [[id, Math.max(0, q - ((p.stock || {})[id] || 0))]]);
      delete S.coches[id];
      toast(`${i.nom} : ${quantite(q, i.unite)} au placard, retiré de la liste`);
    }
  }
  function ongletCourses() {
    const liste = E.listeCourses(S.plan, S.profil);
    const par = {};
    liste.articles.filter((a) => !a.enStock).forEach((a) => { (par[a.rayon] = par[a.rayon] || []).push(a); });
    const reserve = liste.articles.filter((a) => a.enStock);
    const imprimerDispo = !DANS_UN_CADRE && typeof window.print === 'function';
    return `<div class="spread"><div><p class="eyebrow">Liste de courses</p><h1>Pour la semaine</h1></div>
      <div class="row ecran-seul">
        <button class="btn btn-plein" data-a="envoi-ouvrir" data-k="liste">📤 Envoyer</button>
        <button class="btn" data-a="copier-liste">Copier la liste</button>
        <button class="btn" data-a="imprimable">${S.imprimable ? 'Quitter la version imprimable' : 'Version imprimable'}</button>
        ${imprimerDispo ? '<button class="btn btn-plein" data-a="imprimer">Imprimer ou PDF</button>' : ''}
      </div></div>
      ${S.imprimable && !imprimerDispo ? '<p class="bandeau bandeau-info small ecran-seul">Pour obtenir un PDF, ouvrez Budgétable installé sur votre appareil et utilisez « Imprimer ou PDF ». Ici, la version imprimable sert d’aperçu.</p>' : ''}
      ${bandeauAlertes()}
      <button class="bandeau-promos ecran-seul" data-a="onglet" data-k="promos"><span aria-hidden="true">🏷</span><span><strong>Promos du moment</strong> <span class="small">${promos && promos.offres ? (() => { const n = liste.articles.filter((a) => !a.enStock && promosPour(a.id).length).length; return n ? pluriel(n, 'article de votre liste en promo', 'articles de votre liste en promo') : 'voir les bons plans de la semaine'; })() : 'comparer votre liste aux promotions de la semaine'}</span></span><span aria-hidden="true">→</span></button>
      <section class="carte stack ecran-seul panier-drive" style="gap:12px"><h2>Faire mes courses sur mon drive</h2>
        <p class="small">Choisissez votre drive, puis laissez-vous guider : un article à la fois, un bouton qui ouvre sa recherche sur le site du drive, et « C’est dans mon panier ». Sur téléphone comme sur ordinateur, rien à installer.</p>
        <div class="choix" role="radiogroup" aria-label="Mon drive">${enseignesOrdonnees().map(([k, d, lieu]) => `<button class="chip" role="radio" data-a="enseigne" data-k="${k}" aria-pressed="${S.drives.enseigne === k}" aria-checked="${S.drives.enseigne === k}">${esc(d.nom)}${lieu ? ` <span class="small muted">· ${esc(lieu)}</span>` : ''}</button>`).join('')}</div>
        ${S.drives.enseigne && DRIVES[S.drives.enseigne].note ? `<p class="small muted">${esc(DRIVES[S.drives.enseigne].note)}</p>` : ''}
        ${S.drives.enseigne && !DRIVES[S.drives.enseigne].verifie ? '<p class="small muted">Lien de recherche pas encore vérifié pour ce site : s’il n’affiche pas le bon produit, dites-le-nous.</p>' : ''}
        ${S.drives.enseigne ? `<div class="row"><button class="btn btn-plein btn-grand" data-a="courses-go">${resteCourses(liste) < aAcheter(liste).length && resteCourses(liste) > 0 ? `Reprendre mes courses (${resteCourses(liste)} restants)` : 'Commencer mes courses'}</button>
          <a class="btn" href="${DRIVES[S.drives.enseigne].accueil}" target="_blank" rel="noopener">Ouvrir ${esc(DRIVES[S.drives.enseigne].nom)} ↗</a></div>` : '<p class="small"><strong>Choisissez votre drive ci-dessus pour commencer.</strong></p>'}
        <details class="small" ${S.envoiExt ? 'open' : ''}><summary>Sur ordinateur : l’extension Budgétable (facultatif)</summary>
          <p>Pour les habitués sur ordinateur, l’<a href="extension.html" target="_blank" rel="noopener">extension</a> affiche votre liste directement sur le site du drive. Elle n’est pas nécessaire.</p>
          <div class="row"><button class="btn btn-petit" data-a="export-extension">Envoyer vers l’extension</button></div>${etatEnvoiExtension()}</details>
      </section>
      ${blocAjoutCourses()}
      <div class="ticket"><div class="ticket-tete"><strong>Budgétable</strong><span class="small muted">Liste de la semaine · ${new Date().toLocaleDateString('fr-FR')}</span><span>${tagDemo}</span></div>
      ${(() => { const aPrendre = liste.articles.filter((a) => !a.enStock && !a.couvertParPlacard); const faits = aPrendre.filter((a) => S.coches[a.id]).length; return `<div class="avancement-courses ecran-seul"><div class="spread" style="align-items:center"><span><strong class="num">${faits}</strong> / ${aPrendre.length} dans le panier</span><span class="row" style="gap:6px"><label class="case small"><input type="checkbox" data-a="masquer-coches" ${S.masquerCoches ? 'checked' : ''}><span>Masquer ce qui est pris</span></label>${faits ? '<button class="btn-lien small" data-a="tout-decocher">Tout décocher</button>' : ''}</span></div><div class="piste-courses" aria-hidden="true"><i style="width:${aPrendre.length ? Math.round(faits / aPrendre.length * 100) : 0}%"></i></div></div>`; })()}
      <div class="colonnes">${Object.entries(par).map(([rayon, as]) => `<section class="rayon"><h3><span>${esc(rayon)}</span><span class="num small muted">${euros(as.filter((a) => !a.enStock).reduce((s, a) => s + a.cout, 0))}</span></h3>
        ${as.filter((a) => !(S.masquerCoches && S.coches[a.id] && !a.enStock)).map((a) => ligneArticle(a)).join('')}</section>`).join('')}</div>
      ${reserve.length ? `<details class="reserve-courses"><summary class="small"><strong>Déjà à la maison</strong> <span class="muted">· ${pluriel(reserve.length, 'produit')} déjà dans votre placard : rien à acheter</span></summary><div class="stack" style="gap:0;margin-top:6px">${reserve.map((a) => ligneArticle(a)).join('')}</div></details>` : ''}
      ${liste.economieStock > 0 ? `<p class="small" style="padding-top:12px">Grâce à vos réserves : <strong class="num">${euros(liste.economieStock)}</strong> économisés</p>` : ''}
      <div class="ticket-total"><span>Total estimé</span><span class="num">${euros(liste.total)}</span></div></div>
      ${blocCoursesFaites()}
      ${blocTickets(liste)}
      <details class="carte ecran-seul" id="mes-drives" ${S.drivesOuverts ? 'open' : ''}><summary data-a="drives-ouvrir"><strong>Mes drives près de chez moi</strong> <span class="small muted">· trouver les drives autour de chez vous, comparer</span></summary>
        <div class="stack" style="gap:16px;margin-top:12px">${ongletDrives()}</div></details>`;
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
      <section class="carte stack" style="gap:8px"><div class="spread"><h2>Coach alimentaire</h2>${S.profil.coach ? `<span class="tag tag-ok">${COACHS[S.profil.coach].emoji} ${esc(COACHS[S.profil.coach].court)}</span>` : ''}</div>
        <p class="small muted" style="margin:0">${S.profil.coach ? esc(COACHS[S.profil.coach].accroche) : 'Minceur, sportif, ou femme de 40 ans et plus : vos menus suivent votre objectif.'}</p>
        <div class="row" style="gap:8px"><button class="btn btn-petit ${S.profil.coach ? '' : 'btn-plein'}" data-a="coach-voir" data-k="${S.profil.coach || 'minceur'}">${S.profil.coach ? 'Changer de coach' : 'Choisir un coach'}</button><button class="btn btn-petit" data-a="onglet" data-k="minceur">🥗 ${S.profil.programme ? 'Mon programme minceur' : 'Programme minceur personnalisé'}</button><button class="btn btn-petit" data-a="onglet" data-k="sport">🏃 ${S.profil.sport ? 'Mon coach sportif' : 'Coach sportif'}</button></div></section>
      <section class="carte stack"><div class="spread"><h2>Vos goûts</h2><div class="row"><button class="btn btn-petit btn-plein" data-a="test-go" data-depuis="app">Faire le test de goût</button><button class="btn btn-petit" data-a="gouts-effacer">Effacer mes goûts</button></div></div>
        ${blocGouts()}<p class="small muted">Vos notes de recettes affinent aussi vos goûts.</p></section>
      <section class="carte stack"><div class="spread"><h2>Assistant goût</h2><span class="tag tag-ok">IA</span></div>${blocIA()}</section>
      ${window.Photos ? `<details class="carte"><summary><strong>Crédits photos</strong> <span class="small muted">· photos d’illustration sous licence libre, via Wikimedia Commons</span></summary>
        <ul class="credits">${window.Photos.credits().map((ph) => `<li><a href="${esc(ph.page)}" target="_blank" rel="noopener">${esc(decodeURIComponent(ph.page.split('File:')[1]).replace(/_/g, ' '))}</a> — ${esc(ph.auteur)} — ${ph.licenceUrl ? `<a href="${esc(ph.licenceUrl)}" target="_blank" rel="noopener">${esc(ph.licence)}</a>` : esc(ph.licence)}</li>`).join('')}</ul></details>` : ''}
      <section class="stack"><div class="spread"><h2>Formules</h2><span class="tag tag-simu">Aucun paiement</span></div>
        <div class="offres">
          <div class="offre ${S.premium ? '' : 'active'}"><span class="eyebrow">Découverte</span><span class="prix-offre">Gratuit</span>
            <ul><li>Menus de la semaine, changements illimités</li><li>Mes recettes : vos liens Marmiton et recettes de famille</li><li>Liste de courses, budget estimé, courses guidées sur le drive</li></ul></div>
          <div class="offre ${S.premium ? 'active' : ''}"><span class="eyebrow">Premium</span><span class="prix-offre num">4,99 €<span class="small muted" style="font:500 .9rem var(--f-texte)"> / mois (indicatif)</span></span>
            <ul><li>Plusieurs semaines à l’avance</li><li>Ajustement automatique au budget</li><li>Comparaison des drives, dès que les vrais prix seront disponibles</li></ul>
            <label class="case"><input type="checkbox" id="premium-test" data-a="premium" ${S.premium ? 'checked' : ''}><span>Activer Premium en mode test (aucun paiement : Stripe sera branché plus tard)</span></label></div>
        </div></section>
      ${blocCompte()}
      <section class="stack"><h2>L’application</h2>${estInstallee() ? '<p class="pourquoi">Budgétable est installé sur cet appareil.</p>' : `<p>Installez Budgétable sur votre écran d’accueil : une icône, plein écran, et vos menus même sans connexion.</p><div>${boutonInstaller('btn-plein')}</div>`}</section>
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
    const c = chef && chef.cle === cleFiche() ? chef : { tours: [], attente: false, message: '' };
    return `<div class="chat" aria-live="polite">${c.tours.length ? c.tours.map((t) => `<p class="bulle-chat ${t.role === 'user' ? 'moi' : ''}">${esc(t.content)}</p>`).join('') : `<p class="bulle-chat">Je suis là pendant que vous cuisinez ${esc(r.nom.charAt(0).toLowerCase() + r.nom.slice(1))} pour ${nb(portions)} portion${portions > 1 ? 's' : ''}. Une question ?</p>`}
        ${c.attente ? '<p class="bulle-chat"><span class="muted">Je regarde la recette…</span></p>' : ''}</div>
      ${c.message ? `<p class="small" style="color:var(--tomate)">${esc(c.message)}</p>` : ''}
      ${c.tours.length ? '' : `<div class="row" style="gap:6px">${QUESTIONS_CHEF.map((q) => `<button class="btn btn-petit" data-a="chef-question" data-q="${esc(q)}" ${c.attente ? 'disabled' : ''}>${esc(q)}</button>`).join('')}</div>`}
      <label class="champ"><span class="sr">Votre question au commis</span><input id="chef-texte" type="text" maxlength="500" placeholder="Ex. : je n’ai pas de crème, je mets quoi ?" autocomplete="off"></label>
      <div class="row"><button class="btn btn-plein btn-petit" data-a="chef-envoyer" ${c.attente ? 'disabled' : ''}>Demander</button><span class="small muted">${iaDispo ? 'Réponses générées par IA' : 'Réponses toutes prêtes du commis'} : en cas de doute sur une allergie, fiez-vous à l’étiquette des produits.</span></div>`;
  }

  /** Dans la fiche d'un repas : l'assiette de la personne au programme minceur et celle des enfants. */
  function blocAssietteMinceur(r, j, slot) {
    if (!E.programmeActif(S.profil) || !r || r.gourmand) return '';
    const a = E.assietteMinceur(r); if (!a) return '';
    const enf = j != null && slot ? E.enfantsPresents(S.profil, j, slot) : S.profil.foyer.enfants.length;
    const n = NUT(E.recetteAdaptee(r, a)), n0 = NUT(r);
    return `<section class="assiette-minceur stack" style="gap:6px"><strong>🥗 Votre assiette minceur</strong>
      <ul class="small">${a.conseils.map((c) => `<li>${esc(c.charAt(0).toUpperCase() + c.slice(1))}</li>`).join('')}</ul>
      ${n && n0 ? `<span class="small muted">≈ ${nb(Math.round(n.kcal / 10) * 10)} kcal au lieu de ${nb(Math.round(n0.kcal / 10) * 10)} pour une part normale.</span>` : ''}
      ${enf ? `<span class="small">👧 ${enf > 1 ? 'Les enfants gardent' : 'L’enfant garde'} l’assiette complète${a.feculent ? '' : ', avec du pain (déjà dans la liste de courses)'} : astuce, servez les féculents et le fromage à part, chacun se sert.</span>` : ''}
      <span class="small muted">Les quantités de la liste de courses en tiennent compte.</span></section>`;
  }
  function vueFiche() {
    if (!fiche) return '';
    const m = fiche.recette ? { recette: fiche.recette, portions: fiche.parts || (E.REC[fiche.recette].gourmand ? E.REC[fiche.recette].parts : E.portions(S.profil, aujourdhui(), 'diner')) } : S.plan.jours[fiche.jour][fiche.slot];
    const r = E.REC[m.recette];
    if (r.gourmand) return vueFicheGourmande(r, m.portions);
    const eq = E.equilibre(r);
    const note = S.notes[r.id] || 0;
    return `<div class="voile" data-a="fermer-fond"><div class="fiche" data-cle="${cleFiche()}" role="dialog" aria-modal="true" aria-labelledby="fiche-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:6px"><span class="eyebrow">${fiche.recette ? 'Idée' : esc(S.plan.jours[fiche.jour].jour) + ' · ' + (fiche.slot === 'dejeuner' ? 'déjeuner' : 'dîner')}</span><h2 id="fiche-titre">${esc(r.nom)}</h2></div>
        <button class="btn btn-petit" data-a="fermer" aria-label="Fermer">Fermer</button></div>
      <figure class="fiche-illu">${V(r, 220, 'rect')}<figcaption class="small muted">${creditPhoto(r)}</figcaption></figure>
      <div class="meta"><span>${r.temps} min</span><span>${['', 'Facile', 'Moyen', 'Avancé'][r.niveau]}</span><span>${nb(m.portions)} portion${m.portions > 1 ? 's' : ''} adulte${m.portions > 1 ? 's' : ''}</span><span class="num">≈ ${euros(E.coutPortion(r) * m.portions)}</span>${tagDemo}</div>
      ${nutriFiche(r, 'portion adulte')}
      <div class="equi"><span class="tag ${eq.legumes ? 'tag-ok' : 'tag-simu'}">Légumes ${eq.legumes ? '✓' : '—'}</span><span class="tag ${eq.feculent ? 'tag-ok' : 'tag-simu'}">Féculent ${eq.feculent ? '✓' : '—'}</span><span class="tag ${eq.proteine ? 'tag-ok' : 'tag-simu'}">Protéines ${eq.proteine ? '✓' : '—'}</span></div>
      ${!eq.legumes || !eq.feculent ? `<p class="small muted">Pour compléter : ${!eq.legumes ? 'une crudité ou un fruit' : ''}${!eq.legumes && !eq.feculent ? ' et ' : ''}${!eq.feculent ? 'du pain' : ''}.</p>` : ''}
      ${r.perso ? `<div class="bandeau bandeau-ok small"><div class="stack" style="gap:6px"><strong>Une recette de votre bibliothèque</strong>${r.lien ? `<a class="btn btn-petit btn-plein lien-recette" href="${esc(r.lien)}" target="_blank" rel="noopener noreferrer">Voir la recette sur ${esc(domaine(r.lien))} ↗</a>` : '<span>Recette de famille, sans lien.</span>'}<div><button class="btn btn-petit" data-a="ed-modifier" data-r="${r.id}">Modifier les ingrédients</button></div></div></div>` : ''}
      ${blocQuantites(m)}
      ${r.variante ? (() => { const d = E.differences(r); const lib = (l) => l.map((id) => E.ING[id].nom.toLowerCase()).join(', '); return `<div class="bandeau bandeau-ok small"><div class="stack" style="gap:4px"><strong>✏️ Ma version de ce plat${S.versionsPreferees && S.versionsPreferees[r.base] === r.id ? ' (à chaque fois)' : ''}</strong><span>${[d.ajouts.length ? 'ajouté : ' + lib(d.ajouts) : '', d.retraits.length ? 'retiré : ' + lib(d.retraits) : '', d.quantites.length ? 'quantités changées : ' + lib(d.quantites) : ''].filter(Boolean).join(' · ') || 'quantités ajustées'}</span>${!fiche.recette ? '<div><button class="btn-lien small" data-a="plat-origine">Revenir à la recette d’origine</button></div>' : ''}</div></div>`; })() : ''}
      ${!fiche.recette && !m.deRestes ? blocAmeliorer(m, r) : ''}
      <div class="stack" style="gap:8px"><h3>Ingrédients <span class="small muted">· pour ${pluriel(fiche.recette || m.deRestes ? m.portions : E.aCuisiner(m), 'portion')}</span></h3><ul>${r.ing.map(([id, q]) => `<li>${esc(E.ING[id].nom)} : <span class="num">${E.ING[id].perso ? 'selon la recette' : quantite(q * (fiche.recette || m.deRestes ? m.portions : E.aCuisiner(m)), E.ING[id].unite)}</span></li>`).join('')}</ul></div>
      ${blocAssietteMinceur(r, fiche.jour, fiche.slot)}
      <div class="stack" style="gap:8px"><h3>Préparation</h3><ol>${r.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol></div>
      ${r.perso ? '' : `<p class="small"><a class="lien-externe" href="https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(termeMarmiton(r.nom))}" target="_blank" rel="noopener">Voir des recettes similaires sur Marmiton ↗</a><br><span class="muted">Site extérieur, sans lien avec Budgétable. Les quantités et le prix affichés ici ne s'y appliquent pas.</span></p>`}
      <section class="commis stack" style="gap:8px"><div class="spread"><h3>Le commis de cuisine</h3><span class="tag tag-ok">${iaDispo ? 'IA' : 'Astuces'}</span></div>${blocChef(r, m.portions)}</section>
      ${!fiche.recette ? (S.deduits[fiche.jour + '-' + fiche.slot] === 'cuisine' ? '<p class="small pourquoi">Cuisiné : déduit de votre placard</p>' : `<div><button class="btn btn-petit" data-a="mange" data-j="${fiche.jour}" data-s="${fiche.slot}">✓ J’ai cuisiné ce plat (mettre à jour mon placard)</button></div>`) : ''}
      <div><button class="btn btn-petit ${S.classiques.includes(r.id) ? 'btn-plein' : ''}" data-a="classique" data-r="${r.id}" aria-pressed="${S.classiques.includes(r.id)}">${S.classiques.includes(r.id) ? '★ Dans mes favoris' : '☆ Ajouter à mes favoris'}</button></div>
      <div class="stack" style="gap:6px"><h3>Votre avis</h3><div class="etoiles" role="radiogroup" aria-label="Noter la recette">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= note ? 'on' : ''}" data-a="noter" data-r="${r.id}" data-n="${n}" role="radio" aria-checked="${n === note}" aria-label="${n} sur 5">★</button>`).join('')}</div>
        <p class="small muted">${note === 1 ? 'Cette recette ne sera plus proposée.' : note ? 'Merci : les recettes bien notées reviendront plus souvent.' : 'Une étoile : on ne la propose plus. Cinq : plus souvent.'}</p></div>
    </div></div>`;
  }

  /* ---------- améliorer un plat : ajouter, changer ou retirer des ingrédients (« ma version ») ---------- */
  let edPlat = null; // { j, sl, ing: [[id, q]], cherche, remplace, manuel, portee, resultats }
  const AMELIORATIONS = [
    ['creme', 'yaourt', 'plus léger'], ['creme', 'creme_soja', 'version végétale'], ['beurre', 'huile_olive', 'moins de graisses saturées'],
    ['lardons', 'des_jambon', 'moins gras'], ['lardons', 'lardons_volaille', 'moins gras'], ['pates', 'pates_completes', 'plus de fibres'],
    ['riz', 'riz_complet', 'plus de fibres'], ['boeuf_hache', 'dinde_hachee', 'plus léger'], ['emmental', 'parmesan', 'plus de goût, moins de fromage', 0.6],
    ['saucisse', 'poulet_filet', 'moins gras'], ['pain', 'pain_complet', 'plus de fibres', 80], ['sucre', 'sucre', 'moins sucré', 0.7], ['creme_liquide', 'yaourt', 'plus léger']
  ];
  const LEGUMES_AJOUT = ['epinards', 'courgette', 'carotte', 'champignon', 'poivron', 'brocoli', 'haricots_verts', 'tomate'];
  function suggestionsPlat(ing) {
    const ids = ing.map(([id]) => id);
    const ok = (id) => E.ING[id] && !E.ingredientInterdit(E.ING[id], S.profil);
    const out = [];
    for (const [de, vers, raison, f] of AMELIORATIONS) {
      if (!ids.includes(de) || !ok(vers)) continue;
      if (de === vers) out.push({ type: 'qte', id: de, f, texte: `${E.ING[de].nom} : un peu moins`, raison });
      else if (!ids.includes(vers)) out.push({ type: 'changer', de, vers, f, texte: `${E.ING[de].nom.toLowerCase()} → ${E.ING[vers].nom.toLowerCase()}`, raison });
    }
    const rec = { id: 'tmp', ing, modele: 'maison' };
    const eq = E.equilibre(rec);
    if (eq.grammesLegumes < 150) { const l = LEGUMES_AJOUT.find((x) => !ids.includes(x) && ok(x)); if (l) out.push({ type: 'ajouter', id: l, q: 100, texte: `+ ${E.ING[l].nom.toLowerCase()} (100 g)`, raison: 'plus de légumes' }); }
    if (!eq.proteine && ok('oeufs') && !ids.includes('oeufs')) out.push({ type: 'ajouter', id: 'oeufs', q: 1, texte: '+ un œuf', raison: 'plus de protéines' });
    if (!eq.feculent && ok('pain') && !ids.includes('pain')) out.push({ type: 'ajouter', id: 'pain', q: 0.2, texte: '+ du pain', raison: 'plus rassasiant' });
    return out.slice(0, 5);
  }
  const uniteIng = (id) => (E.ING[id].unite === 'pièce' ? (E.ING[id].condLabel || 'pièce').replace(/^\d+ ×? ?/, '').slice(0, 14) || 'pièce' : E.ING[id].unite);
  function blocAmeliorer(m, r) {
    if (!edPlat) return `<div class="row" style="gap:8px;align-items:center"><button class="btn btn-petit" data-a="plat-editer">✏️ Améliorer ce plat</button><span class="small muted">ajouter, changer ou retirer des ingrédients</span></div>`;
    const ing = edPlat.ing;
    const sugg = suggestionsPlat(ing);
    const q = (S.chercheIngPlat || '').trim();
    const res = q.length >= 2 ? window.Saisie.chercherIngredients(q, 10).filter((id) => E.ING[id] && !E.ING[id].perso && !ing.some(([x]) => x === id)) : [];
    const alerte = (id) => E.ingredientInterdit(E.ING[id], S.profil);
    const ligne = ([id, qte], i) => `<li class="ing-edit ${edPlat.remplace === i ? 'choisi' : ''}"><span class="stack" style="gap:0;min-width:0"><strong>${esc(E.ING[id].nom)}</strong>${alerte(id) ? `<span class="small alerte-ing">Attention : ${esc(libAllergie(alerte(id)))}</span>` : ''}</span>
      <span class="qte-saisie"><input type="text" inputmode="decimal" data-a="plat-qte" data-i="${i}" value="${nb(Math.round(qte * 100) / 100)}" aria-label="Quantité par personne : ${esc(E.ING[id].nom)}"><span class="small muted">${esc(uniteIng(id))}</span></span>
      <span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn-mini" data-a="plat-remplacer" data-i="${i}" aria-label="Changer ${esc(E.ING[id].nom)}">⇄</button><button class="btn-mini" data-a="plat-retirer" data-i="${i}" aria-label="Retirer ${esc(E.ING[id].nom)}">✕</button></span></li>`;
    const m2 = edPlat.manuel;
    const formManuel = m2 ? `<div class="manuel-ing stack" style="gap:8px"><strong>Nouvel ingrédient : ${esc(m2.nom)}</strong>
        <div class="row" style="gap:8px"><button class="btn btn-petit" data-a="plat-off" ${m2.charge ? 'disabled' : ''}>${m2.charge ? 'Recherche…' : '🔍 Chercher les calories en ligne'}</button><span class="small muted">base Open Food Facts</span></div>
        ${m2.resultats ? (m2.resultats.length ? `<ul class="resultats-off">${m2.resultats.map((p, k) => `<li><button class="btn-lien" data-a="plat-off-choisir" data-k="${k}">${esc(p.nom)}${p.marque ? ` <span class="small muted">· ${esc(p.marque)}</span>` : ''}</button><span class="small num">${Math.round(p.kcal)} kcal / 100 g</span></li>`).join('')}</ul>` : '<p class="small muted" style="margin:0">Rien trouvé en ligne : indiquez les calories à la main (elles sont sur l’emballage).</p>') : ''}
        <div class="grille-manuel">
          <label class="champ"><span>Par personne</span><span class="qte-saisie"><input type="text" inputmode="decimal" id="man-q" value="${esc(m2.q || '50')}"><span class="small muted">g</span></span></label>
          <label class="champ"><span>Calories / 100 g</span><input type="text" inputmode="decimal" id="man-kcal" value="${esc(m2.kcal != null ? String(m2.kcal) : '')}" placeholder="ex. 250"></label>
          <label class="champ"><span>Protéines / 100 g</span><input type="text" inputmode="decimal" id="man-prot" value="${esc(m2.prot != null ? String(m2.prot) : '')}" placeholder="facultatif"></label>
          <label class="champ"><span>Prix du paquet <span class="muted">(facultatif)</span></span><span class="qte-saisie"><input type="text" inputmode="decimal" id="man-prix" value="${esc(m2.prix || '')}" placeholder="2,50"><span class="small muted">€ les</span><input type="text" inputmode="decimal" id="man-paquet" value="${esc(m2.paquet || '')}" placeholder="250" style="max-width:70px"><span class="small muted">g</span></span></label>
        </div>
        <div class="row" style="gap:8px"><button class="btn btn-petit btn-plein" data-a="plat-manuel-ok">Ajouter au plat</button><button class="btn-lien small" data-a="plat-manuel-annuler">Annuler</button></div></div>` : '';
    return `<section class="edition-plat stack" style="gap:12px" aria-label="Améliorer ce plat"><div class="spread"><h3>✏️ Améliorer ce plat</h3><span class="small muted">quantités par personne</span></div>
      ${sugg.length ? `<div class="stack" style="gap:6px"><span class="small"><strong>Idées</strong></span><div class="row" style="gap:6px">${sugg.map((x, k) => `<button class="chip suggestion-plat" data-a="plat-suggestion" data-k="${k}" title="${esc(x.raison)}">${esc(x.texte)} <span class="small muted">· ${esc(x.raison)}</span></button>`).join('')}</div></div>` : ''}
      <ul class="liste-ing-edit">${ing.map(ligne).join('')}</ul>
      ${edPlat.remplace != null ? `<p class="small bandeau bandeau-info" style="margin:0">Choisissez ci-dessous ce qui remplace <strong>${esc(E.ING[ing[edPlat.remplace][0]].nom)}</strong>. <button class="btn-lien small" data-a="plat-remplacer-annuler">annuler</button></p>` : ''}
      <label class="champ"><span>${edPlat.remplace != null ? 'Remplacer par…' : 'Ajouter un ingrédient'}</span><input type="text" id="plat-cherche" value="${esc(S.chercheIngPlat || '')}" placeholder="Ex. épinards, parmesan, curry…" autocomplete="off"></label>
      ${q.length >= 2 ? `<div class="row" style="gap:6px">${res.map((id) => `<button class="chip puce-ajout" data-a="plat-ajouter" data-id="${id}">${edPlat.remplace != null ? '⇄' : '+'} ${esc(E.ING[id].nom)}${alerte(id) ? ' ⚠️' : ''}</button>`).join('')}${edPlat.remplace == null ? `<button class="chip" data-a="plat-manuel" data-k="${esc(q)}">✍️ Créer « ${esc(q)} »</button>` : ''}</div>` : ''}
      ${formManuel}
      <div class="stack" style="gap:6px"><span class="small"><strong>Pour qui ?</strong></span><div class="row" role="radiogroup" style="gap:6px"><button class="chip" role="radio" data-a="plat-portee" data-k="repas" aria-checked="${edPlat.portee !== 'toujours'}" aria-pressed="${edPlat.portee !== 'toujours'}">Seulement ce repas</button><button class="chip" role="radio" data-a="plat-portee" data-k="toujours" aria-checked="${edPlat.portee === 'toujours'}" aria-pressed="${edPlat.portee === 'toujours'}">Chaque fois que ce plat revient</button></div></div>
      <div class="row" style="gap:8px"><button class="btn btn-plein" data-a="plat-enregistrer">Enregistrer ma version</button><button class="btn" data-a="plat-annuler">Annuler</button></div>
    </section>`;
  }
  function lireChampsManuel() {
    if (!edPlat || !edPlat.manuel) return;
    const v = (id) => { const e = document.getElementById(id); return e ? e.value : undefined; };
    for (const [k, id] of [['q', 'man-q'], ['kcal', 'man-kcal'], ['prot', 'man-prot'], ['prix', 'man-prix'], ['paquet', 'man-paquet']]) { const x = v(id); if (x !== undefined) edPlat.manuel[k] = x; }
  }
  async function chercherCalories(nom) {
    try {
      const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(nom)}&search_simple=1&action=process&json=1&page_size=10&lc=fr&cc=fr&fields=code,product_name,product_name_fr,brands,nutriments`, { signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
      const j = await r.json();
      return (j.products || []).map((p) => ({ nom: String(p.product_name_fr || p.product_name || '').trim().slice(0, 50), marque: String(p.brands || '').split(',')[0].trim().slice(0, 25), kcal: parseFloat((p.nutriments || {})['energy-kcal_100g']), prot: parseFloat((p.nutriments || {}).proteins_100g) })).filter((p) => p.nom && Number.isFinite(p.kcal)).map((p) => ({ ...p, prot: Number.isFinite(p.prot) ? p.prot : null })).slice(0, 6);
    } catch (e) { return []; }
  }
  function recetteDeBase(id) { const r = E.REC[id]; return r && r.base && E.REC[r.base] ? E.REC[r.base] : r; }
  function enregistrerPlat() {
    const m = S.plan.jours[edPlat.j][edPlat.sl];
    const base = recetteDeBase(m.recette);
    const memeQueBase = edPlat.ing.length === base.ing.length && edPlat.ing.every(([id, q]) => base.ing.some(([b, qb]) => b === id && Math.abs(qb - q) < 1e-6));
    if (memeQueBase) { m.recette = base.id; m.original = true; if (edPlat.portee === 'toujours') delete S.versionsPreferees[base.id]; edPlat = null; toast('Recette d’origine'); return; }
    const id = 'v-' + base.id.slice(0, 40) + '-' + Date.now().toString(36);
    S.variantes = (S.variantes || []).concat({ id, base: base.id, ing: edPlat.ing.map(([x, q]) => [x, q]) });
    // on ne garde que les versions encore utilisées (et la préférée)
    const utilisees = new Set(S.plan.jours.flatMap((jp) => E.SLOTS.map((sl) => jp[sl] && jp[sl].recette)).concat(Object.values(S.versionsPreferees || {}), id, (S.journal || []).map((x) => x.r)));
    S.variantes = S.variantes.filter((v) => utilisees.has(v.id)).slice(-200);
    E.definirVariantes(S.variantes);
    m.recette = id; delete m.original;
    if (edPlat.portee === 'toujours') S.versionsPreferees = { ...(S.versionsPreferees || {}), [base.id]: id };
    edPlat = null;
    toast(S.versionsPreferees && S.versionsPreferees[base.id] === id ? 'Ma version enregistrée : elle reviendra à chaque fois' : 'Ma version enregistrée pour ce repas');
  }
  // un plat qui a une version préférée la reprend dans les nouveaux menus
  function appliquerVersions(plan) {
    const pref = S.versionsPreferees || {};
    if (!plan) return;
    plan.jours.forEach((jp) => E.SLOTS.forEach((sl) => { const m = jp[sl]; if (m && !m.original && pref[m.recette] && E.REC[pref[m.recette]]) m.recette = pref[m.recette]; }));
  }
  // ingrédients créés à la main (avec leurs calories) : ajoutés au catalogue de l'appareil
  function enregistrerManuels() {
    const l = (S.ingredientsManuels || []).filter((x) => x && x.id && x.nom);
    E.ajouterIngredients(l.map((x) => ({ id: x.id, nom: x.nom, rayon: 'Mes ingrédients', unite: 'g', cond: x.paquet > 0 ? x.paquet : 100, condLabel: x.paquet > 0 ? `paquet ${x.paquet} g` : 'selon besoin', prixDemo: x.prix > 0 ? x.prix : 0, groupe: x.groupe || 'A', tags: [], manuel: true })));
    if (window.Nutrition) l.forEach((x) => { window.Nutrition.TABLE[x.id] = [x.kcal || 0, 0, 0, 0, 0, x.prot || 0, 0]; });
  }

  function vueFicheGourmande(r, parts) {
    const c = E.recetteCompatible(r, S.profil);
    return `<div class="voile" data-a="fermer-fond"><div class="fiche" data-cle="${cleFiche()}" role="dialog" aria-modal="true" aria-labelledby="fiche-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:6px"><span class="eyebrow">Grignotages gourmands · ${r.type === 'dessert' ? 'Dessert' : 'Goûter'}</span><h2 id="fiche-titre">${esc(r.nom)}</h2></div>
        <button class="btn btn-petit" data-a="fermer" aria-label="Fermer">Fermer</button></div>
      <figure class="fiche-illu">${V(r, 200, 'rect')}${r.photo ? `<figcaption class="small muted">${creditPhoto(r)}</figcaption>` : ''}</figure>
      <div class="meta"><span>${r.temps} min</span><span>${pluriel(parts, 'part')}</span><span class="num">${euros(E.coutPortion(r))} la part${r.extras && r.extras.length ? '*' : ''}</span></div>
      ${nutriFiche(r, 'part')}
      ${!c.ok ? `<div class="bandeau bandeau-demo small">Attention : ${esc(libAllergie(c.raison))}.</div>` : ''}
      ${r.lien ? `<a class="btn btn-petit btn-plein lien-recette" href="${esc(r.lien)}" target="_blank" rel="noopener noreferrer">Voir la recette sur ${esc(domaine(r.lien))} ↗</a>` : ''}
      <div class="stack" style="gap:8px"><h3>Ingrédients</h3><ul>${r.ing.map(([id, q]) => `<li>${esc(E.ING[id].nom)} : <span class="num">${E.ING[id].perso ? 'selon la recette' : quantite(q * parts, E.ING[id].unite)}</span></li>`).join('')}</ul></div>
      <div class="stack" style="gap:8px"><h3>Préparation</h3><ol>${r.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol></div>
      <div class="row" style="gap:8px"><button class="btn btn-plein" data-a="gourmand-ajouter" data-r="${r.id}">Ajouter à ma semaine</button>${r.perso ? `<button class="btn" data-a="ed-modifier-g" data-r="${r.id}">Modifier</button>` : ''}</div>
      <section class="commis stack" style="gap:8px"><div class="spread"><h3>Le commis de cuisine</h3><span class="tag tag-ok">${iaDispo ? 'IA' : 'Astuces'}</span></div>${blocChef(r, parts)}</section>
    </div></div>`;
  }

  /* ---------- qui mange cette semaine ? ---------- */
  const profilSemaine = () => ({ ...S.profil, presences: (S.plan && S.plan.presences) || S.profil.presences || null });
  const presenceDe = (j, slot) => E.presence(profilSemaine(), j, slot);
  const nomEnfant = (k) => { const pr = (S.profil.prenomsEnfants || [])[k]; return pr ? pr : `Enfant ${k + 1}`; };
  function texteCellule(pr) {
    const enf = pr.e.filter(Boolean).length;
    if (!pr.a && !enf && !pr.invA && !pr.invE) return '<span class="dehors">Personne</span>';
    return `<span>👤${pr.a}</span>${S.profil.foyer.enfants.length ? `<span>🧒${enf}</span>` : ''}${pr.invA + pr.invE ? `<span class="invites">+${pr.invA + pr.invE}</span>` : ''}`;
  }
  function changerPresences(modif, message) {
    const pres = { ...((S.plan && S.plan.presences) || S.profil.presences || {}) };
    for (let j = 0; j < 7; j++) for (const sl of E.SLOTS) {
      const k = j + '-' + sl;
      const avant = presenceDe(j, sl);
      const apres = modif(j, sl, { ...avant, e: avant.e.slice() });
      if (apres) pres[k] = apres;
    }
    S.plan.presences = pres;
    S.plan = E.appliquerPresences(S.plan, { ...S.profil, presences: pres }, optsMoteur());
    if (S.presencesGarder) S.profil.presences = { ...pres };
    if (message) toast(message);
  }
  function blocPresences() {
    if (!S.plan) return '';
    const p = S.profil, enfants = p.foyer.enfants.length;
    let repas = 0, couverts = 0;
    for (let j = 0; j < 7; j++) for (const sl of E.SLOTS) { const pr = presenceDe(j, sl); const n = pr.a + pr.e.filter(Boolean).length + pr.invA + pr.invE; if (n) { repas++; couverts += n; } }
    const raccourcis = [['tous', 'Tout le monde, tous les repas']].concat(enfants ? [['cantine', 'Enfants à la cantine le midi']] : []).concat([['travail', 'Adultes au travail le midi'], ['invites', '+2 invités ce week-end']]).concat(enfants ? [['garde', 'Enfants absents cette semaine']] : []);
    return `<section class="carte stack presences" style="gap:10px">
      <div class="spread"><h2>Qui mange cette semaine ?</h2><span class="small muted">${pluriel(repas, 'repas', 'repas')} à la maison · ${pluriel(couverts, 'couvert')}</span></div>
      <div class="row raccourcis-presences" style="gap:6px">${raccourcis.map(([k, v]) => `<button class="chip" data-a="presences-raccourci" data-k="${k}">${esc(v)}</button>`).join('')}</div>
      <div class="grille-presences" role="table" aria-label="Personnes à chaque repas">
        <span role="columnheader"></span><span role="columnheader" class="small muted">Midi</span><span role="columnheader" class="small muted">Soir</span>
        ${ordreJours().map((j) => [E.JOURS[j], j]).map(([jn, j]) => `<span role="rowheader" class="small"><strong>${jn.slice(0, 3)}.</strong></span>${E.SLOTS.map((sl) => { const pr = presenceDe(j, sl); return `<button class="cellule-presence ${S.presenceEdit === j + '-' + sl ? 'sel' : ''}" data-a="presence-editer" data-k="${j}-${sl}" aria-label="${jn} ${sl === 'diner' ? 'soir' : 'midi'} : ${pr.a} adulte${pr.a > 1 ? 's' : ''}${enfants ? `, ${pr.e.filter(Boolean).length} enfant(s)` : ''}${pr.invA + pr.invE ? `, ${pr.invA + pr.invE} invité(s)` : ''}. Modifier">${texteCellule(pr)}</button>`; }).join('')}`).join('')}
      </div>
      <label class="case small"><input type="checkbox" data-a="presences-garder" ${S.presencesGarder ? 'checked' : ''}><span>Garder ces habitudes pour les semaines suivantes</span></label>
      <span class="small muted">Touchez un repas pour l’ajuster. Les portions, les menus et la liste de courses suivent tout seuls.</span>
    </section>`;
  }
  function vuePresence() {
    if (!S.presenceEdit || !S.plan) return '';
    const [j, sl] = [+S.presenceEdit.split('-')[0], S.presenceEdit.split('-')[1]];
    const pr = presenceDe(j, sl), p = S.profil;
    const stepper = (cle, val, label) => `<div class="spread ligne-presence"><span>${label}</span><div class="row" style="gap:6px;align-items:center;flex-wrap:nowrap"><button class="btn btn-petit" data-a="presence-pas" data-k="${cle}" data-d="-1" aria-label="${label} : un de moins" ${val <= 0 ? 'disabled' : ''}>−</button><strong class="num" style="min-width:1.5em;text-align:center">${val}</strong><button class="btn btn-petit" data-a="presence-pas" data-k="${cle}" data-d="1" aria-label="${label} : un de plus">+</button></div></div>`;
    return `<div class="voile" data-a="presence-fond"><div class="fiche fenetre-presence" role="dialog" aria-modal="true" aria-labelledby="pres-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Qui mange ?</span><h2 id="pres-titre">${E.JOURS[j]} ${sl === 'diner' ? 'soir' : 'midi'}</h2></div>
        <button class="btn btn-petit" data-a="presence-fermer">OK</button></div>
      ${stepper('a', pr.a, 'Adultes du foyer')}
      ${p.foyer.enfants.length ? `<div class="stack" style="gap:6px"><span>Enfants</span><div class="row" style="gap:6px">${p.foyer.enfants.map((age, k) => `<button class="chip" data-a="presence-enfant" data-k="${k}" aria-pressed="${pr.e[k]}">${pr.e[k] ? '✓ ' : ''}${esc(nomEnfant(k))} <span class="small muted">${esc((L.ages || {})[age] || age)}</span></button>`).join('')}</div></div>` : ''}
      ${stepper('invA', pr.invA, 'Invités adultes')}
      ${stepper('invE', pr.invE, 'Invités enfants')}
      <div class="row" style="gap:8px">
        <button class="btn btn-petit" data-a="presence-pareil">Pareil tous les ${sl === 'diner' ? 'soirs' : 'midis'} de la semaine (lun.–ven.)</button>
        <button class="btn btn-petit" data-a="presence-personne">Personne : repas dehors</button>
      </div>
      <p class="small muted" style="margin:0">${E.REC[(S.plan.jours[j][sl] || {}).recette] ? `Au menu : ${esc(E.REC[S.plan.jours[j][sl].recette].nom)} · ${nb(S.plan.jours[j][sl].portions)} portion(s)` : 'Pas de repas prévu à la maison.'}</p>
    </div></div>`;
  }

  /* ---------- « Mes apports » : suivi réel des repas mangés, avec graphiques ---------- */
  const ISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lundiDe = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
  // date réelle d'un jour du planning : la semaine commence le jour où elle a été créée (ou démarrée), pour 7 jours
  function dateDuJour(j) {
    const base = S.planDu ? new Date(S.planDu + 'T12:00:00') : new Date();
    base.setHours(12, 0, 0, 0);
    const d = new Date(base); d.setDate(base.getDate() + (j - debutSemaine() + 7) % 7); return ISO(d);
  }
  function noterJournal(j, slot, recette, ajouter) {
    S.journal = (S.journal || []).filter((x) => !(x.d === dateDuJour(j) && x.s === slot));
    if (ajouter) S.journal.push({ d: dateDuJour(j), s: slot, r: recette });
    if (S.journal.length > 1500) S.journal = S.journal.slice(-1500);
  }
  // valeurs d'une journée (portion adulte) à partir du journal
  function apportsParJour(du, au) {
    const jours = {};
    for (let d = new Date(du + 'T12:00:00'); ISO(d) <= au; d.setDate(d.getDate() + 1)) jours[ISO(d)] = { kcal: 0, prot: 0, fibres: 0, sucres: 0, sel: 0, ags: 0, legumes: 0, repas: [], ajouts: [] };
    (S.ajouts || []).forEach((x, i) => {
      const jr = jours[x.d]; if (!jr) return;
      const al = alimentDe(x); if (!al) return;
      for (const k of ['kcal', 'prot', 'fibres', 'sucres', 'sel', 'ags']) jr[k] += (al[k] || 0) * x.n;
      jr.legumes += (al.fl || 0) * x.n;
      jr.ajouts.push({ ...x, i });
    });
    for (const x of S.journal || []) {
      if (!jours[x.d] || !E.REC[x.r]) continue;
      const n = nutri(E.REC[x.r]); if (!n) continue;
      const jr = jours[x.d];
      for (const k of ['kcal', 'prot', 'fibres', 'sucres', 'sel', 'ags']) jr[k] += n.parPortion[k];
      jr.legumes += E.equilibre(E.REC[x.r]).grammesLegumes;
      jr.repas.push({ ...x, n });
    }
    return jours;
  }
  const OBJ = {};
  const LIB = { kcal: ['Énergie', 'kcal'], prot: ['Protéines', 'g'], fibres: ['Fibres', 'g'], legumes: ['Fruits et légumes', 'g'], sel: ['Sel', 'g'], sucres: ['Sucres', 'g'], ags: ['Graisses saturées', 'g'] };
  // graphique en barres (une seule série), ligne d'objectif, info-bulle au survol
  function barres(donnees, cle, opts = {}) {
    const W = 340, H = 150, g = 30, b = 22, t = 10;
    const vals = donnees.map((d) => d.v);
    const obj = OBJ[cle] ? (OBJ[cle][0] || OBJ[cle][1]) : null;
    const max = Math.max(1, ...vals, obj || 0) * 1.15;
    const pas = (W - g) / donnees.length, lb = Math.min(28, pas * 0.6);
    const y = (v) => H - b - (v / max) * (H - b - t);
    const graduations = [0, max / 2, max].map((v) => Math.round(v / (max > 50 ? 10 : 1)) * (max > 50 ? 10 : 1));
    return `<figure class="graphe" aria-label="${esc(opts.titre || '')}">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        ${graduations.map((v) => `<line x1="${g}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grille"/><text x="${g - 4}" y="${y(v) + 3}" class="axe" text-anchor="end">${nb(v)}</text>`).join('')}
        ${obj ? `<line x1="${g}" x2="${W}" y1="${y(obj)}" y2="${y(obj)}" class="objectif"/>` : ''}
        ${donnees.map((d, i) => { const x = g + i * pas + (pas - lb) / 2, h = Math.max(0, H - b - y(d.v)); return `<g class="barre ${d.vide ? 'vide' : ''}" data-tip="${esc(d.tip)}"><rect x="${g + i * pas}" y="${t}" width="${pas}" height="${H - b - t}" class="zone"/>${h > 0 ? `<path d="M${x},${H - b} v${-Math.max(0, h - 4)} q0,-4 4,-4 h${lb - 8} q4,0 4,4 v${Math.max(0, h - 4)} z" class="plein"/>` : ''}${donnees.length <= 10 || i % 5 === 0 || i === donnees.length - 1 ? `<text x="${x + lb / 2}" y="${H - 6}" class="axe" text-anchor="middle">${esc(d.lab)}</text>` : ''}</g>`; }).join('')}
      </svg>${obj ? `<figcaption class="legende-graphe small muted"><span class="trait-objectif" aria-hidden="true"></span> ${OBJ[cle][0] ? 'objectif' : 'maximum'} : ${nb(obj)} ${LIB[cle] ? LIB[cle][1] : ''}</figcaption>` : ''}</figure>`;
  }
  function barresHorizontales(lignes, unite) {
    const max = Math.max(1, ...lignes.map((l) => l.v));
    return `<ul class="hbarres">${lignes.map((l) => `<li><span class="small">${esc(l.lab)}</span><span class="piste"><i style="width:${(l.v / max) * 100}%;${l.couleur ? `background:${l.couleur}` : ''}"></i></span><span class="num small">${nb(Math.round(l.v))}${unite}</span></li>`).join('')}</ul>`;
  }
  /* ---------- carnet du jour : aliments ajoutés, limites et smileys ---------- */
  function objectifsJour() {
    const kcal = S.objectifKcal || 2000;
    return { kcal: [null, kcal], prot: [60, null], fibres: [30, null], legumes: [400, null], sel: [null, 5], sucres: [null, 100], ags: [null, 22] };
  }
  const SMILEY = { vert: ['😊', 'Très bien'], neutre: ['😐', 'À surveiller'], rouge: ['😟', 'Dépassé'] };
  // état d'un compteur : les limites (sel, sucres…) passent au rouge si dépassées ; les objectifs (protéines…) ne sont jamais « rouges » en cours de journée
  function etatCompteur(cle, v, journeeFinie) {
    const [mi, ma] = OBJ[cle];
    if (ma != null) {
      if (cle === 'kcal' && journeeFinie && v > 0 && v < ma * 0.5) return 'neutre';
      return v <= ma * 0.9 ? 'vert' : v <= ma ? 'neutre' : 'rouge';
    }
    return v >= mi ? 'vert' : 'neutre';   // un objectif non atteint n'est jamais « rouge » : souvent, tout n'a pas été noté
  }
  const alimentDe = (x) => (x.a ? (window.Aliments.ALIMENTS.find((y) => y.id === x.a) || null)
    : x.nut ? { nom: x.nom, portion: x.portion || 'portion', ...x.nut }
    : { nom: x.nom, portion: 'portion', kcal: x.kcal || 0, prot: 0, fibres: 0, sucres: 0, ags: 0, sel: 0, fl: 0 });
  // produit scanné : valeurs nutritionnelles d'Open Food Facts (pour 100 g ou 100 ml)
  async function scannerProduit(code) {
    S.scanCarnet = { etat: 'lecture', message: 'Recherche du produit…' }; rendre();
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_fr,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments,nutriscore_grade,image_front_small_url`, { signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
      const j = await r.json();
      if (j.status !== 1 || !j.product) { S.scanCarnet = { etat: 'erreur', message: `Produit ${code} inconnu d’Open Food Facts. Ajoutez-le avec « Autre aliment ».` }; rendre(); return; }
      const p = j.product, n = p.nutriments || {};
      const v = (k) => { const x = parseFloat(n[k + '_100g']); return Number.isFinite(x) ? x : 0; };
      const kcal = v('energy-kcal') || (v('energy') ? v('energy') / 4.184 : 0);
      if (!kcal && !v('proteins') && !v('sugars')) { S.scanCarnet = { etat: 'erreur', message: `« ${p.product_name_fr || p.product_name || code} » n’a pas de valeurs nutritionnelles sur Open Food Facts. Ajoutez-le avec « Autre aliment ».` }; rendre(); return; }
      const portion = parseFloat(p.serving_quantity) > 0 ? parseFloat(p.serving_quantity) : null;
      const paquet = parseFloat(p.product_quantity) > 0 ? parseFloat(p.product_quantity) : null;
      S.scanCarnet = {
        etat: 'trouve', code,
        produit: { nom: String(p.product_name_fr || p.product_name || 'Produit ' + code).slice(0, 60), marque: String(p.brands || '').split(',')[0].trim(), image: p.image_front_small_url || null, ns: String(p.nutriscore_grade || '').toUpperCase(), quantite: p.quantity || '', portion, portionTxt: p.serving_size || '', paquet,
          c100: { kcal, prot: v('proteins'), fibres: v('fiber'), sucres: v('sugars'), ags: v('saturated-fat'), sel: v('salt'), fl: v('fruits-vegetables-nuts-estimate-from-ingredients') || v('fruits-vegetables-nuts') } },
        grammes: portion || (paquet && paquet <= 250 ? paquet : 100)
      };
    } catch (e) { S.scanCarnet = { etat: 'erreur', message: 'Recherche impossible pour le moment (connexion ?).' }; }
    rendre();
  }
  async function scannerPhoto(fichier) {
    if (!fichier) return;
    S.scanCarnet = { etat: 'lecture', message: 'Lecture du code-barres…' }; rendre();
    let codes = [];
    try { codes = await window.CodeBarre.lirePhoto(fichier); } catch (e) { codes = []; }
    if (!codes.length) { S.scanCarnet = { etat: 'erreur', message: 'Code-barres illisible : prenez-le de près, bien net et éclairé, ou tapez les chiffres sous le code.' }; rendre(); return; }
    scannerProduit(codes[0]);
  }
  /* recherche d'un aliment : liste intégrée, ingrédients au poids, puis produits du commerce (Open Food Facts) */
  let minuterieOFF = null, derniereRechercheOFF = '';
  function boutonAliment(a) { return `<button class="chip puce-ajout" data-a="carnet-ajouter" data-id="${a.id}" title="${esc(a.portion)} · ${a.kcal} kcal">+ ${esc(a.nom)} <span class="small muted">${esc(a.portion)} · ${a.kcal} kcal</span></button>`; }
  function resultatsCarnet(t, produits) {
    if (t.length < 2) return window.Aliments.ALIMENTS.filter((a) => a.moment === (S.momentCarnet || 'petitdej')).map(boutonAliment).join('');
    const locaux = window.Aliments.chercher(t, 12);
    const q = E.norm(t).replace(/(s|x)$/, '');
    const ingredients = Object.keys(window.Nutrition.TABLE).filter((id) => E.ING[id] && E.norm(E.ING[id].nom).includes(q)).slice(0, 6);
    const html = [];
    if (locaux.length) html.push(locaux.map(boutonAliment).join(''));
    if (ingredients.length) html.push(`<span class="small muted titre-res">Au poids :</span>${ingredients.map((id) => `<button class="chip puce-ajout" data-a="carnet-ingredient" data-id="${id}">+ ${esc(E.ING[id].nom)} <span class="small muted">${Math.round(window.Nutrition.TABLE[id][0])} kcal / 100 g</span></button>`).join('')}`);
    if (produits === null && t.length >= 3) html.push('<span class="small muted titre-res"><span class="rond-attente" aria-hidden="true"></span> Recherche dans les produits du commerce…</span>');
    if (produits && produits.length) html.push(`<span class="small muted titre-res">Produits du commerce (Open Food Facts) :</span>${produits.map((p) => `<button class="chip puce-ajout" data-a="carnet-produit" data-code="${esc(p.code)}">+ ${esc(p.nom)}${p.marque ? ` <span class="small muted">${esc(p.marque)}</span>` : ''} <span class="small muted">${Math.round(p.kcal)} kcal / 100 g</span></button>`).join('')}`);
    if (produits && !produits.length && !locaux.length && !ingredients.length) html.push('<span class="small muted">Pas trouvé : essayez un autre mot, scannez le code-barres, ou utilisez « Autre aliment » ci-dessous.</span>');
    return html.join('');
  }
  async function chercherOFF(t) {
    derniereRechercheOFF = t;
    let produits = [];
    try {
      const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(t)}&search_simple=1&action=process&json=1&page_size=12&lc=fr&cc=fr&fields=code,product_name,product_name_fr,brands,nutriments`, { signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
      const j = await r.json();
      produits = (j.products || []).map((p) => ({ code: p.code, nom: String(p.product_name_fr || p.product_name || '').trim().slice(0, 50), marque: String(p.brands || '').split(',')[0].trim().slice(0, 25), kcal: parseFloat((p.nutriments || {})['energy-kcal_100g']) })).filter((p) => p.code && p.nom && Number.isFinite(p.kcal)).slice(0, 8);
    } catch (e) { produits = []; }
    const champ = document.getElementById('carnet-cherche');
    if (!champ || champ.value.trim() !== derniereRechercheOFF) return;
    const z = document.getElementById('carnet-resultats');
    if (z) z.innerHTML = resultatsCarnet(t, produits);
  }
  function blocScan() {
    const sc = S.scanCarnet;
    const barre = `<div class="row" style="gap:8px;align-items:flex-end">
        <label class="btn btn-petit btn-plein choisir-photo">📷 Scanner un code-barres<input type="file" accept="image/*" capture="environment" data-a="carnet-scan" class="visuellement-cache"></label>
        <label class="champ" style="max-width:170px"><span class="small">ou les chiffres</span><input type="text" inputmode="numeric" id="carnet-code" placeholder="3017620422003" maxlength="14"></label>
        <button class="btn btn-petit" data-a="carnet-code">OK</button></div>`;
    if (!sc) return barre;
    if (sc.etat === 'lecture') return barre + `<p class="lecture small" role="status"><span class="rond-attente" aria-hidden="true"></span> ${esc(sc.message)}</p>`;
    if (sc.etat === 'erreur') return barre + `<p class="lecture lecture-echec small" role="status">${esc(sc.message)}</p>`;
    const p = sc.produit, g = sc.grammes, f = g / 100;
    const choix = [[p.portion, `1 portion${p.portionTxt ? ` (${p.portionTxt})` : ` (${p.portion} g)`}`], [100, '100 g'], [p.paquet && p.paquet <= 2000 ? p.paquet : null, `tout le paquet (${p.quantite || p.paquet + ' g'})`]].filter(([v]) => v);
    return barre + `<div class="produit-scanne" role="status">
      <div class="row" style="gap:10px;align-items:center;flex-wrap:nowrap">${p.image ? `<img src="${esc(p.image)}" alt="" referrerpolicy="no-referrer">` : '<span class="emoji-scan" aria-hidden="true">🏷️</span>'}
        <div class="stack" style="gap:2px;min-width:0"><strong>${esc(p.nom)}</strong><span class="small muted">${esc([p.marque, p.quantite].filter(Boolean).join(' · '))}</span>
          <span class="small">${Math.round(p.c100.kcal)} kcal pour 100 g${p.ns && 'ABCDE'.includes(p.ns) ? ` · <span class="ns-lettre ns-${p.ns}" aria-label="Nutri-Score ${p.ns}">${p.ns}</span>` : ''}</span></div></div>
      <div class="row" style="gap:6px;align-items:center">${choix.map(([v, t]) => `<button class="chip" data-a="scan-qte" data-g="${v}" aria-pressed="${Math.abs(g - v) < 0.01}">${esc(t)}</button>`).join('')}
        <label class="champ" style="max-width:110px"><span class="sr">Quantité en grammes</span><span class="saisie-euros"><input type="text" inputmode="decimal" id="scan-g" value="${nb(g)}" data-a="scan-g"><span aria-hidden="true">g</span></span></label></div>
      <p class="small" style="margin:0" id="scan-resume">${resumeScan()}</p>
      <div class="row" style="gap:8px"><button class="btn btn-plein btn-petit" data-a="scan-ajouter">Ajouter au carnet</button><button class="btn-lien small" data-a="scan-annuler">Annuler</button></div>
    </div>`;
  }
  function resumeScan() {
    const sc = S.scanCarnet; if (!sc || !sc.produit) return '';
    const f = sc.grammes / 100, c = sc.produit.c100;
    return `Pour ${nb(sc.grammes)} g : <strong>${Math.round(c.kcal * f)} kcal</strong> · sucres ${nb(Math.round(c.sucres * f * 10) / 10)} g · sel ${nb(Math.round(c.sel * f * 10) / 10)} g · protéines ${nb(Math.round(c.prot * f * 10) / 10)} g`;
  }
  function blocCarnet() {
    const auj = ISO(new Date());
    const d = S.jourCarnet || auj;
    const jours = apportsParJour(d, d);
    const j = jours[d];
    const finie = d < auj || new Date().getHours() >= 21;
    const titre = d === auj ? 'Aujourd’hui' : new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const cles = ['kcal', 'sucres', 'sel', 'ags', 'prot', 'fibres', 'legumes'];
    const etats = cles.map((k) => [k, etatCompteur(k, j[k], finie)]);
    const rouges = etats.filter(([, e]) => e === 'rouge').map(([k]) => LIB[k][0].toLowerCase());
    const neutres = etats.filter(([, e]) => e === 'neutre');
    const rien = !j.repas.length && !j.ajouts.length;
    const humeur = rien ? ['🍽️', 'Rien de noté pour l’instant', 'Ajoutez votre petit-déjeuner, vos collations et vos boissons : les repas du planning s’ajoutent avec « C’est mangé ».']
      : rouges.length ? ['😟', `Attention : ${rouges.join(', ')}`, 'Pas de panique : une journée ne fait pas une semaine. Compensez tranquillement demain.']
      : neutres.length ? ['😐', 'Journée correcte', finie ? 'Quelques repères à surveiller, rien de grave.' : 'La journée n’est pas finie : les objectifs en cours se rempliront au fil des repas.']
      : ['😊', 'Belle journée !', 'Tous vos repères sont au vert.'];
    const compteur = ([k, e]) => {
      const [mi, ma] = OBJ[k], ref = ma != null ? ma : mi, v = j[k];
      const txt = k === 'sel' ? nb(Math.round(v * 10) / 10) : nb(Math.round(v));
      const reste = ma != null ? (v <= ma ? `reste ${nb(Math.round((ma - v) * (k === 'sel' ? 10 : 1)) / (k === 'sel' ? 10 : 1))} ${LIB[k][1]}` : `dépassé de ${nb(Math.round((v - ma) * (k === 'sel' ? 10 : 1)) / (k === 'sel' ? 10 : 1))} ${LIB[k][1]}`) : (v >= mi ? 'objectif atteint' : `encore ${nb(Math.round(mi - v))} ${LIB[k][1]}`);
      return `<li class="compteur c-${e}"><span class="smiley" role="img" aria-label="${SMILEY[e][1]}">${SMILEY[e][0]}</span>
        <span class="stack" style="gap:2px;min-width:0"><span class="spread" style="gap:6px"><strong class="small">${LIB[k][0]}</strong><span class="small num">${txt} / ${nb(ref)} ${LIB[k][1]}${ma != null ? ' max' : ''}</span></span>
        <span class="piste-c"><i style="width:${Math.min(100, (v / ref) * 100)}%"></i></span><span class="small muted">${reste}</span></span></li>`;
    };
    const m = S.momentCarnet || 'petitdej';
    const suggestions = window.Aliments.ALIMENTS.filter((a) => a.moment === m);
    const parMoment = {};
    j.ajouts.forEach((x) => { (parMoment[x.m] = parMoment[x.m] || []).push(x); });
    return `<section class="carte stack carnet" style="gap:12px" aria-label="Carnet du jour">
      <div class="spread" style="align-items:center;flex-wrap:nowrap"><button class="btn btn-petit" data-a="carnet-jour" data-n="-1" aria-label="Jour précédent">◀</button><h2 style="text-align:center;margin:0">${esc(titre.charAt(0).toUpperCase() + titre.slice(1))}</h2><button class="btn btn-petit" data-a="carnet-jour" data-n="1" aria-label="Jour suivant" ${d >= auj ? 'disabled' : ''}>▶</button></div>
      <div class="humeur-jour"><span class="gros-smiley" aria-hidden="true">${humeur[0]}</span><div class="stack" style="gap:2px"><strong>${esc(humeur[1])}</strong><span class="small">${esc(humeur[2])}</span></div></div>
      <ul class="compteurs">${etats.map(compteur).join('')}</ul>
      <div class="stack" style="gap:6px"><h3>Mangé ${d === auj ? 'aujourd’hui' : 'ce jour-là'}</h3>
        <ul class="liste-carnet">
          ${j.repas.map((x) => `<li><span>🍽️ ${x.s === 'diner' ? 'Dîner' : 'Déjeuner'} : ${esc(E.REC[x.r].nom)}</span><span class="small num">${x.n.kcal} kcal</span></li>`).join('')}
          ${Object.entries(parMoment).map(([mo, l]) => l.map((x) => { const al = alimentDe(x); return al ? `<li><span>${esc(al.nom)} <span class="small muted">· ${x.n > 1 ? x.n + ' × ' : ''}${esc(al.portion)}</span></span><span class="row" style="gap:4px;flex-wrap:nowrap;align-items:center"><span class="small num">${Math.round(al.kcal * x.n)} kcal</span><button class="btn btn-petit" data-a="carnet-qte" data-i="${x.i}" data-n="-1" aria-label="Une portion de moins">−</button><button class="btn btn-petit" data-a="carnet-qte" data-i="${x.i}" data-n="1" aria-label="Une portion de plus">+</button><button class="btn-lien small" data-a="carnet-suppr" data-i="${x.i}" aria-label="Retirer ${esc(al.nom)}">✕</button></span></li>` : ''; }).join('')).join('')}
          ${rien ? '<li class="small muted">Rien pour l’instant.</li>' : ''}
        </ul></div>
      <div class="stack ajout-carnet" style="gap:8px"><h3>Ajouter un aliment</h3>
        <div class="row" role="radiogroup" style="gap:6px">${Object.entries(window.Aliments.MOMENTS).map(([k, v]) => `<button class="chip" role="radio" data-a="carnet-moment" data-k="${k}" aria-checked="${m === k}" aria-pressed="${m === k}">${v}</button>`).join('')}</div>
        ${blocScan()}
        <label class="champ"><span class="sr">Chercher un aliment</span><input type="search" id="carnet-cherche" data-a="carnet-cherche" placeholder="Chercher : croissant, pomme, café au lait, pizza…" autocomplete="off"></label>
        <div id="carnet-resultats" class="row" style="gap:6px">${suggestions.map((a) => `<button class="chip puce-ajout" data-a="carnet-ajouter" data-id="${a.id}" title="${esc(a.portion)} · ${a.kcal} kcal">+ ${esc(a.nom)} <span class="small muted">${a.kcal} kcal</span></button>`).join('')}</div>
        <details><summary class="small"><strong>Autre aliment</strong> <span class="muted">· nom et calories à la main</span></summary>
          <div class="row" style="gap:8px;align-items:flex-end;margin-top:8px"><label class="champ" style="flex:1;min-width:140px"><span>Nom</span><input type="text" id="carnet-perso-nom" maxlength="50" placeholder="Ex. : crêpe au sucre"></label><label class="champ" style="max-width:110px"><span>Calories</span><input type="text" inputmode="numeric" id="carnet-perso-kcal" placeholder="250"></label><button class="btn btn-petit btn-plein" data-a="carnet-perso">Ajouter</button></div></details>
      </div>
      <div class="row" style="gap:6px;align-items:center"><span class="small">Mon repère de calories :</span>${[...new Set([1800, 2000, 2200, 2500].concat(S.objectifKcal ? [S.objectifKcal] : []))].sort((x, y) => x - y).map((k) => `<button class="chip" data-a="carnet-objectif" data-k="${k}" aria-pressed="${(S.objectifKcal || 2000) === k}">${nb(k)}</button>`).join('')}<button class="btn btn-petit btn-plein" data-a="kcal-ouvrir">🧮 Calculer mon repère</button></div>
      <p class="small muted" style="margin:0">Repères pour un adulte : environ 2 000 kcal (à ajuster selon l’âge, le sexe et l’activité), 60 g de protéines, 30 g de fibres, 400 g de fruits et légumes, moins de 100 g de sucres, 22 g de graisses saturées et 5 g de sel par jour. Ce sont des repères, pas des règles : inutile d’être parfait chaque jour.</p>
    </section>`;
  }

  /* ---------- calcul du repère de calories (formule de Mifflin-St Jeor × niveau d'activité) ---------- */
  const ACTIVITES = [['1.4', 'Sédentaire', 'travail assis, peu de marche'], ['1.6', 'Un peu actif', 'marche ou vélo au quotidien, 1 à 2 séances de sport'], ['1.75', 'Actif', 'métier debout ou 3 à 5 séances de sport'], ['1.9', 'Très actif', 'métier physique ou sport intense presque tous les jours']];
  function calculRepere() {
    const c = S.calcKcal || {};
    const age = parseFloat(c.age), taille = parseFloat(c.taille), poids = parseFloat(String(c.poids || '').replace(',', '.'));
    if (!(age >= 18 && age <= 100 && taille >= 130 && taille <= 230 && poids >= 35 && poids <= 250) || !c.sexe) return null;
    const base = 10 * poids + 6.25 * taille - 5 * age + (c.sexe === 'h' ? 5 : -161);
    const entretien = base * (parseFloat(c.activite) || 1.4);
    const plancher = Math.max(base, c.sexe === 'h' ? 1500 : 1200);
    let repere = entretien + (c.objectif === 'perdre' ? -400 : c.objectif === 'prendre' ? 300 : 0);
    const limite = c.objectif === 'perdre' && repere < plancher;
    repere = Math.max(repere, c.objectif === 'perdre' ? plancher : 0);
    const arr = (v) => Math.round(v / 50) * 50;
    return { base: arr(base), entretien: arr(entretien), repere: arr(repere), limite };
  }
  function vueCalcKcal() {
    if (!S.calcKcalOuvert) return '';
    const c = S.calcKcal || {};
    const r = calculRepere();
    const radio = (cle, k, v, sous) => `<button class="chip" role="radio" data-a="kcal-choix" data-cle="${cle}" data-k="${k}" aria-checked="${c[cle] === k}" aria-pressed="${c[cle] === k}">${esc(v)}${sous ? ` <span class="small muted">${esc(sous)}</span>` : ''}</button>`;
    return `<div class="voile" data-a="kcal-fond"><div class="fiche fenetre-kcal" role="dialog" aria-modal="true" aria-labelledby="kcal-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Carnet du jour</span><h2 id="kcal-titre">Calculer mon repère de calories</h2></div>
        <button class="btn btn-petit" data-a="kcal-fermer">Fermer</button></div>
      <div class="stack" style="gap:6px"><strong>Vous êtes</strong><div class="row" role="radiogroup" style="gap:6px">${radio('sexe', 'f', 'Une femme')}${radio('sexe', 'h', 'Un homme')}</div></div>
      <div class="row" style="gap:10px">
        <label class="champ" style="max-width:110px"><span>Âge</span><span class="saisie-euros"><input type="text" inputmode="numeric" data-a="kcal-champ" data-k="age" value="${esc(c.age || '')}" placeholder="40"><span>ans</span></span></label>
        <label class="champ" style="max-width:120px"><span>Taille</span><span class="saisie-euros"><input type="text" inputmode="numeric" data-a="kcal-champ" data-k="taille" value="${esc(c.taille || '')}" placeholder="165"><span>cm</span></span></label>
        <label class="champ" style="max-width:120px"><span>Poids</span><span class="saisie-euros"><input type="text" inputmode="decimal" data-a="kcal-champ" data-k="poids" value="${esc(c.poids || '')}" placeholder="65"><span>kg</span></span></label>
      </div>
      <div class="stack" style="gap:6px"><strong>Votre activité</strong><div class="stack" role="radiogroup" style="gap:6px">${ACTIVITES.map(([k, v, sous]) => radio('activite', k, v, sous)).join('')}</div></div>
      <div class="stack" style="gap:6px"><strong>Votre objectif</strong><div class="row" role="radiogroup" style="gap:6px">${radio('objectif', 'garder', 'Garder mon poids')}${radio('objectif', 'perdre', 'Perdre doucement')}${radio('objectif', 'prendre', 'Prendre du poids')}</div></div>
      <div id="kcal-resultat">${resultatKcal(r)}</div>
      <p class="small muted" style="margin:0">Calcul indicatif (formule de Mifflin-St Jeor), pour les adultes. Pas adapté pendant une grossesse ou l’allaitement, avant 18 ans, en cas de maladie ou de troubles du comportement alimentaire : demandez conseil à votre médecin ou à un diététicien. Ces informations restent sur votre appareil.</p>
    </div></div>`;
  }
  function resultatKcal(r) {
    if (!r) return '<p class="small muted" style="margin:0">Remplissez le sexe, l’âge, la taille, le poids et l’activité.</p>';
    return `<div class="resultat-kcal stack" style="gap:8px">
      <div class="chiffres-calc"><div><span class="small muted">Au repos</span><strong class="num">${nb(r.base)}</strong><span class="small muted">kcal / jour</span></div><div><span class="small muted">Pour garder votre poids</span><strong class="num">${nb(r.entretien)}</strong><span class="small muted">kcal / jour</span></div><div><span class="small muted">Votre repère</span><strong class="num repere-final">${nb(r.repere)}</strong><span class="small muted">kcal / jour</span></div></div>
      ${(S.calcKcal || {}).objectif === 'perdre' ? `<span class="small">Perte douce : environ 400 kcal de moins que vos besoins, soit 1,5 à 2 kg par mois.${r.limite ? ' Le repère est arrêté à ce niveau pour rester au-dessus de vos besoins de base : descendre plus bas n’est pas conseillé sans suivi médical.' : ''}</span>` : ''}
      <button class="btn btn-plein" data-a="kcal-appliquer" data-k="${r.repere}">Utiliser ${nb(r.repere)} kcal comme repère</button></div>`;
  }
  /* ---------- programme minceur : l'agent qui prépare et ajuste la semaine ---------- */
  const P = window.Programme;
  const NUT = (r) => (window.Nutrition && r ? window.Nutrition.de(r, E.ING) : null);
  const virgule = (x) => String(x).replace('.', ',');
  let coachMinceur = { tours: [], attente: false, message: '' };
  function progCalc() { const pr = S.profil.programme; return pr ? P.calculer({ ...pr, poidsActuel: pr.poidsActuel || pr.poidsDepart }, pr.stabilisation ? 0 : pr.ajustement || 0) : null; }
  function cibleProg() { const pr = S.profil.programme, c = progCalc(); return pr && pr.stabilisation ? c.entretien : c.cible; }
  /** Ce que l'utilisateur mange chaque jour de la semaine préparée, avec ses portions conseillées. */
  function journeesMinceur() {
    if (!S.plan) return [];
    const rep = P.repartition(cibleProg());
    return joursOrdonnes().map(([jp, j]) => {
      const pd = (jp.gourmand || []).find((g) => g.moment === 'petitdej' && E.REC[g.recette]);
      const ligne = (slot) => assietteRepas(jp[slot], j, slot, rep);
      const pdK = pd ? (NUT(E.REC[pd.recette]) || {}).kcal || 0 : 0;
      const dej = ligne('dejeuner'), din = ligne('diner');
      const total = pdK + (dej && !dej.dehors ? dej.kcal : 0) + (din && !din.dehors ? din.kcal : 0) + rep.collation;
      return { j, pd: pd ? { nom: E.REC[pd.recette].nom, recette: pd.recette, kcal: pdK } : null, dej, din, total };
    });
  }
  /** L'assiette de la personne au programme pour un repas : conseils, calories, enfants ; « repas libre » = part normale. */
  function assietteRepas(m, j, slot, rep) {
    if (!m || m.dehors || S.deduits[j + '-' + slot] === 'dehors' || !E.REC[m.recette]) return m && (m.dehors || S.deduits[j + '-' + slot] === 'dehors') ? { nom: 'Mangé dehors', dehors: true } : null;
    rep = rep || P.repartition(cibleProg());
    const r = E.REC[m.recette];
    const enf = E.enfantsPresents(S.profil, j, slot);
    if (m.libre) { const n0 = NUT(r); return { nom: r.nom, recette: m.recette, kcal: (n0 && n0.kcal) || 0, libre: true, court: 'repas libre, part normale', assiette: [], f: 1, enfants: enf ? 'assiette complète' : '' }; }
    const a = E.assietteMinceur(r);
    const n = NUT(E.recetteAdaptee(r, a));
    const po = P.portion(n && n.kcal, rep[slot]);
    return { nom: r.nom, recette: m.recette, kcal: po.kcal || (n && n.kcal) || 0, conseil: po.texte, f: po.f, plus: !!po.plus, assiette: a ? a.conseils : [], court: a ? a.court : '', enfants: enf ? (a && !a.feculent ? 'assiette complète, avec du pain' : 'assiette complète') : '' };
  }
  const minceurDansSemaine = () => !!(S.profil.programme && E.programmeActif(S.profil));
  /** Sous un plat de la semaine : « Vous : ½ pâtes · légumes ×1,5 · ≈ 420 kcal », et le bouton « repas libre ». */
  /** Les quantités concrètes de l'assiette minceur pour une personne : féculent, légumes, protéine, fromage ou crème. */
  const LEG_DISCRETS_APP = new Set(['oignon', 'ail', 'citron', 'citron_vert', 'persil', 'echalote', 'tomates_concassees', 'coulis_tomate', 'puree_tomate', 'concentre_tomate']);
  function detailAssiette(r, f0) {
    const a = E.assietteMinceur(r); if (!a) return [];
    const fact = (id) => ((a.aj.find(([k]) => k === id) || [0, 1])[1]);
    const nomC = (id) => E.ING[id].nom.replace(/\s*\([^)]*\)\s*$/, '');
    const lignes = [], vus = new Set();
    const libelle = (id, fx) => (a.integres.includes(id) ? (a.reduite ? '¾, dans le plat' : 'dans la sauce') : fx <= 0.5 ? 'moitié, servi à part' : fx > 1 ? 'plus' : fx < 1 ? '¾ de part' : 'pareil');
    const ajoute = (id, q, emoji, role) => { if (vus.has(id)) return; vus.add(id); const fx = fact(id) * f0; lignes.push({ emoji, nom: nomC(id), pour: quantite(q * fx, E.ING[id].unite), normal: quantite(q, E.ING[id].unite), role: a.integres.includes(id) ? 'integre' : role, label: libelle(id, fact(id)), fx }); };
    const ing = r.ing.filter(([id]) => E.ING[id] && !E.ING[id].perso);
    ing.filter(([id]) => E.ING[id].groupe === 'F' || ['farine', 'pate_feuilletee', 'pate_brisee', 'pate_sablee', 'pate_pizza', 'chapelure'].includes(id)).forEach(([id, q]) => ajoute(id, q, id === 'riz' ? '🍚' : id === 'pomme_de_terre' ? '🥔' : id.startsWith('pain') ? '🥖' : id === 'farine' ? '🌾' : id.startsWith('pate_') ? '🥧' : '🍝', 'feculent'));
    ing.filter(([id]) => E.ING[id].groupe === 'L' && !LEG_DISCRETS_APP.has(id)).slice(0, 3).forEach(([id, q]) => ajoute(id, q, '🥦', 'legume'));
    ing.filter(([id]) => id === r.prot || E.ING[id].groupe === 'P').slice(0, 2).forEach(([id, q]) => ajoute(id, q, id === 'oeufs' ? '🥚' : ['saumon', 'colin', 'thon', 'cabillaud', 'crevettes'].includes(id) ? '🐟' : ['lentilles_corail', 'lentilles_vertes', 'pois_chiches', 'haricots_rouges', 'haricots_blancs', 'tofu'].includes(id) ? '🫘' : '🍗', 'proteine'));
    ing.filter(([id]) => a.integres.includes(id) || a.grasReduits.includes(id)).forEach(([id, q]) => ajoute(id, q, ['creme', 'creme_liquide', 'lait_coco', 'creme_soja'].includes(id) ? '🥛' : '🧀', 'gras'));
    for (const [id, q] of a.ajout || []) if (E.ING[id]) lignes.push({ emoji: '🥗', nom: 'Salade verte, à côté', pour: quantite(q, E.ING[id].unite), normal: '—', role: 'legume', label: 'en plus', fx: 1 });
    return lignes;
  }

  /** Sous un plat de la semaine : ce que la personne au programme met dans son assiette, en clair. */
  function ligneMinceur(m, j, slot) {
    if (!minceurDansSemaine() || !m || m.aChoisir) return '';
    const x = assietteRepas(m, j, slot);
    if (!x || x.dehors) return '';
    const r = E.REC[m.recette];
    const n0 = NUT(r);
    const k0 = n0 ? Math.round(n0.kcal / 10) * 10 : 0, k = Math.round(x.kcal / 10) * 10;
    if (x.libre) return `<div class="assiette-semaine libre"><div class="assiette-resume"><span>🍽️ <strong>Repas libre</strong> : vous mangez comme tout le monde${k ? ` · ≈ ${nb(k)} kcal` : ''}</span><button class="btn-lien small" data-a="m-libre" data-j="${j}" data-s="${slot}">Remettre le coach</button></div></div>`;
    const a = E.assietteMinceur(r) || { aj: [] };
    const fec = a.aj.filter(([id, f]) => f < 1 && E.ING[id].groupe === 'F').map(([id]) => E.ING[id].nom.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase());
    const fecA = (a.fecReduits || []).map((id) => E.ING[id].nom.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase());
    const resume = a.reduite ? ['une part un peu plus petite', fecA.length ? `moitié moins de ${fecA.join(' et ')}` : '', 'une grande salade à côté'].filter(Boolean)
      : [fecA.length ? `moitié moins de ${fecA.join(' et ')}` : '', 'plus de légumes', (a.grasReduits || []).length ? 'fromage à part' : '', x.f < 1 ? `${x.f === 0.5 ? 'une demi' : 'trois quarts de'} part` : ''].filter(Boolean);
    const lignes = detailAssiette(r, x.f < 1 ? x.f : 1);
    const ROLE = { feculent: 'moitié', legume: 'plus', proteine: 'pareil', gras: 'moitié' };
    return `<details class="assiette-semaine"><summary><span class="assiette-resume"><span>🥗 <strong>Pour vous</strong> : ${esc(resume.join(', '))}</span><span class="kcal-pour-vous num">≈ ${nb(k)} kcal${k0 && k0 > k ? ` <s>${nb(k0)}</s>` : ''}</span></span><span class="voir-detail small">Voir mon assiette</span></summary>
      <div class="assiette-detail"><div class="mini-assiette" aria-hidden="true"><span class="q-leg">légumes</span><span class="q-prot">protéines</span><span class="q-fec">féculents</span></div>
        <div class="stack" style="gap:6px;min-width:0"><table class="table-assiette small"><thead><tr><th></th><th>Pour vous</th><th class="muted">part normale</th></tr></thead><tbody>${lignes.map((l) => `<tr class="role-${l.role}"><td><span aria-hidden="true">${l.emoji}</span> ${esc(l.nom)}</td><td><strong>${esc(l.pour)}</strong> <span class="badge-role">${esc(l.role === 'gras' && l.label.startsWith('moitié') ? 'à ajouter à la fin' : l.label)}</span></td><td class="muted">${esc(l.normal)}</td></tr>`).join('')}</tbody></table>
        ${a.reduite ? `<span class="small">ℹ️ ${esc((a.integres || []).map((id) => E.ING[id].nom.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase()).join(', '))} : cuit dans le plat, on ne peut pas l’enlever. Prenez une part un peu plus petite et complétez avec la salade.</span>` : ''}
        ${x.plus ? '<span class="small">🍎 Il vous reste de la marge : ajoutez un fruit ou un yaourt nature.</span>' : ''}
        ${x.enfants ? `<span class="small">👧 Les enfants : ${esc(x.enfants)}. Astuce : servez les féculents et le fromage à part, chacun se sert.</span>` : ''}
        <div><button class="btn-lien small" data-a="m-libre" data-j="${j}" data-s="${slot}">Ce repas, je mange comme tout le monde (repas libre)</button></div></div></div></details>`;
  }

  /** En haut de la semaine : le coach minceur, avec la possibilité de le retirer de la semaine. */
  function carteMinceurSemaine() {
    const pr = S.profil.programme;
    if (!pr) return '';
    if (pr.dansSemaine === false) return `<div class="bandeau bandeau-info small ecran-seul"><span>🥗 Le coach minceur n’est pas appliqué à vos plats de la semaine.</span><button class="btn btn-petit" data-a="m-semaine">L’ajouter à ma semaine</button></div>`;
    if (pr.stabilisation) return '';
    const cible = cibleProg();
    const msg = String(pr.message || '').split(/(?<=[.!?])\s/)[0];
    return `<section class="carte-minceur-semaine ecran-seul"><div class="spread" style="gap:8px;align-items:flex-start"><div class="stack" style="gap:2px;min-width:0"><strong>🥗 Coach minceur · semaine ${pr.semaine || 1}</strong><span class="small">${nb(cible)} kcal par jour pour vous${S.profil.foyer.enfants.length ? ', les enfants mangent normalement' : ''}. Un seul plat pour tout le monde : sous chaque plat, « Pour vous » dit comment remplir <strong>votre</strong> assiette (moitié moins de féculents, plus de légumes, la même viande ou le même poisson).</span>${msg ? `<span class="small muted">${esc(msg)}</span>` : ''}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-petit btn-plein" data-a="onglet" data-k="minceur">Faire le point</button><button class="btn btn-petit" data-a="m-semaine">Ne pas l’appliquer</button></div></div></section>`;
  }
  function preparerSemaineMinceur() {
    const p = S.profil, pr = p.programme;
    const cible = cibleProg(), rep = P.repartition(cible);
    pr.cible = cible; pr.cibleRepas = Math.round((rep.dejeuner + rep.diner) / 2);
    p.coach = 'minceur';
    if (!p.objectifs.includes('perte')) p.objectifs = p.objectifs.concat('perte');
    nouvellePlanification();
    S.plan.jours.forEach((jp) => { if (jp.gourmand) jp.gourmand = jp.gourmand.filter((g) => g.moment !== 'petitdej'); });
    const ids = P.choisirPetitsDej(E.gourmandises(), { cible: rep.petitdej, gouts: p.gouts, scoreGout: E.scoreGout, nutrition: NUT, compatible: (r) => E.recetteCompatible(r, p).ok, rassasiant: pr.rassasiant, simple: pr.simple });
    ids.forEach((id, j) => { const jp = S.plan.jours[j]; jp.gourmand = (jp.gourmand || []).concat([{ recette: id, portions: 1, moment: 'petitdej', programme: true }]); });
    S.plan.programme = true;
    const aimes = new Set(Object.entries((p.gouts || {}).ing || {}).filter(([, w]) => w >= 0.9).map(([id]) => id));
    const repas = S.plan.jours.flatMap((jp) => [jp.dejeuner, jp.diner]).filter((m) => m && E.REC[m.recette]);
    const platsAimes = repas.filter((m) => E.REC[m.recette].ing.some(([id]) => aimes.has(id))).length;
    const joursDessus = journeesMinceur().filter((d) => d.total > cible * 1.1).length;
    const noms = E.resumeGouts(p.gouts).details.aime.filter((x) => x.type === 'ing').map((x) => x.nom);
    pr.message = P.messageSemaine({ prog: pr, calc: { ...progCalc(), cible }, aime: noms, platsAimes, pdNoms: [...new Set(ids)].map((id) => E.REC[id].nom), joursDessus, enfants: p.foyer.enfants.length });
    pr.semainePrete = true;
    S.onglet = 'minceur';
  }
  function graphePoids(pr) {
    const pts = [{ kg: pr.poidsDepart }].concat(pr.pesees || []);
    if (pts.length < 2) return '<p class="small muted" style="margin:0">Votre courbe apparaîtra après la première pesée.</p>';
    const W = 320, H = 120, min = Math.min(pr.objectif, ...pts.map((x) => x.kg)) - 1, max = Math.max(...pts.map((x) => x.kg)) + 1;
    const x = (i) => 10 + i * ((W - 20) / Math.max(1, pts.length - 1)), y = (kg) => 10 + (max - kg) / (max - min) * (H - 20);
    return `<svg viewBox="0 0 ${W} ${H}" class="graphe-poids" role="img" aria-label="Évolution du poids : de ${virgule(pr.poidsDepart)} kg à ${virgule(pts[pts.length - 1].kg)} kg, objectif ${virgule(pr.objectif)} kg">
      <line x1="10" x2="${W - 10}" y1="${y(pr.objectif)}" y2="${y(pr.objectif)}" class="ligne-objectif"/><text x="${W - 12}" y="${y(pr.objectif) - 4}" text-anchor="end" class="txt-objectif">objectif ${virgule(pr.objectif)} kg</text>
      <polyline points="${pts.map((p, i) => `${x(i)},${y(p.kg)}`).join(' ')}" class="courbe"/>${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.kg)}" r="3.5" class="point"/>`).join('')}</svg>`;
  }
  const STOPS = {
    mineur: ['Pas de programme minceur avant 18 ans', 'À votre âge, le corps grandit encore : on ne fait pas de régime sans l’avis d’un médecin. Les menus de Budgétable restent équilibrés et bons pour toute la famille. Parlez-en à votre médecin traitant ou à l’infirmière scolaire si votre poids vous préoccupe.'],
    tca: ['Prenons soin de vous d’abord', 'Merci de l’avoir dit. Avec un trouble du comportement alimentaire, actuel ou passé, un programme de perte de poids risque de faire plus de mal que de bien : c’est pourquoi Budgétable ne vous en propose pas. Votre médecin peut vous accompagner, et la ligne Anorexie Boulimie Info Écoute (09 69 325 900, appel non surtaxé) écoute et oriente, en toute confidentialité. Les menus classiques de Budgétable, sans comptage, restent à votre disposition.'],
    grossesse: ['Pas de régime pendant la grossesse ou l’allaitement', 'Pendant cette période, le corps a besoin de toutes ses ressources : on ne cherche pas à perdre du poids. Votre sage-femme ou votre médecin peut vous conseiller. Vous pouvez reprendre ce programme plus tard, après l’allaitement.'],
    imc_bas: ['Votre poids est déjà bas pour votre taille', 'Votre IMC est sous 18,5 : perdre du poids n’est pas conseillé et pourrait nuire à votre santé. Si vous pensez quand même devoir en perdre, parlez-en à votre médecin.'],
    objectif: ['Le poids visé doit être plus bas que votre poids actuel', 'Vérifiez les deux poids indiqués.']
  };
  function vueBilanMinceur() {
    const f = S.progForm = S.progForm || (() => { const c = S.calcKcal || {}; const pr = S.profil.programme; return pr ? { sexe: pr.sexe, age: pr.age, taille: pr.taille, poids: pr.poidsActuel || pr.poidsDepart, objectif: pr.objectif, activite: pr.activite, rythme: pr.rythme, tca: 'non', grossesse: pr.sexe === 'f' ? 'non' : '', consent: true, personnes: String(pr.personnes || 1) } : { sexe: c.sexe || '', age: c.age || '', taille: c.taille || '', poids: c.poids || '', objectif: '', activite: c.activite || '1.4', rythme: 'douce', tca: '', grossesse: '', consent: !!S.profil.consentementSante, personnes: '1' }; })();
    const radio = (cle, k, v, sous) => `<button class="chip" role="radio" data-a="prog-choix" data-cle="${cle}" data-k="${k}" aria-checked="${f[cle] === k}" aria-pressed="${f[cle] === k}">${esc(v)}${sous ? ` <span class="small muted">${esc(sous)}</span>` : ''}</button>`;
    const champ = (k, lib, unite, ph, mode) => `<label class="champ" style="max-width:130px"><span>${lib}</span><span class="saisie-euros"><input type="text" inputmode="${mode || 'numeric'}" data-a="prog-champ" data-k="${k}" value="${esc(f[k] || '')}" placeholder="${ph}"><span>${unite}</span></span></label>`;
    return `<div class="ardoise-minceur"><span class="small">Votre coach personnel</span><h1>Programme minceur</h1><span class="small">perdre du poids en douceur, avec les plats que vous aimez</span></div>
      <section class="carte stack" style="gap:8px"><h2>Comment ça marche ?</h2>
        <ol class="etapes-prog small"><li><strong>Un bilan de 1 minute</strong> : je calcule vos besoins et une cible de calories prudente.</li><li><strong>Je prépare votre semaine</strong> : repas légers mais rassasiants, choisis selon vos goûts, petits-déjeuners compris, avec votre portion jour par jour. ${S.profil.foyer.enfants.length ? ' Les enfants mangent <strong>le même plat, en assiette complète</strong> : seule votre assiette change (moitié moins de féculents, plus de légumes).' : ' Le reste de la famille mange normalement.'}</li><li><strong>Chaque semaine, on fait le point</strong> : pesée et ressenti. J’ajuste tout seul (trop rapide, faim, palier…).</li></ol></section>
      <section class="carte stack" style="gap:14px"><h2>Votre bilan</h2>
        <div class="stack" style="gap:6px"><strong>Vous êtes</strong><div class="row" role="radiogroup" style="gap:6px">${radio('sexe', 'f', 'Une femme')}${radio('sexe', 'h', 'Un homme')}</div></div>
        <div class="row" style="gap:10px">${champ('age', 'Âge', 'ans', '40')}${champ('taille', 'Taille', 'cm', '165')}${champ('poids', 'Poids actuel', 'kg', '75', 'decimal')}${champ('objectif', 'Poids visé', 'kg', '68', 'decimal')}</div>
        <div class="stack" style="gap:6px"><strong>Votre activité</strong><div class="stack" role="radiogroup" style="gap:6px">${ACTIVITES.map(([k, v, sous]) => radio('activite', k, v, sous)).join('')}</div></div>
        ${S.profil.foyer.adultes > 1 ? `<div class="stack" style="gap:6px"><strong>Qui suit le programme ?</strong><div class="row" role="radiogroup" style="gap:6px">${radio('personnes', '1', 'Moi seul(e)')}${radio('personnes', '2', 'Deux adultes')}</div></div>` : ''}
        <div class="stack" style="gap:6px"><strong>Votre rythme</strong><div class="row" role="radiogroup" style="gap:6px">${Object.entries(P.RYTHMES).map(([k, r]) => radio('rythme', k, r.libelle, r.sous)).join('')}</div></div>
        <div class="stack" style="gap:6px"><strong>Avez-vous, ou avez-vous eu, un trouble du comportement alimentaire ?</strong><span class="small muted">Anorexie, boulimie, hyperphagie… Votre réponse reste sur cet appareil.</span><div class="row" role="radiogroup" style="gap:6px">${radio('tca', 'non', 'Non')}${radio('tca', 'oui', 'Oui')}</div></div>
        ${f.sexe === 'f' ? `<div class="stack" style="gap:6px"><strong>Êtes-vous enceinte ou allaitez-vous ?</strong><div class="row" role="radiogroup" style="gap:6px">${radio('grossesse', 'non', 'Non')}${radio('grossesse', 'oui', 'Oui')}</div></div>` : ''}
        <div id="prog-resultat">${resultatBilanMinceur()}</div>
      </section>
      <p class="small muted prudence-coach">Programme indicatif pour adultes en bonne santé, qui ne remplace pas l’avis d’un médecin ou d’un diététicien. En cas de maladie (diabète, problème cardiaque, rénal…) ou de traitement, demandez d’abord conseil à votre médecin.</p>`;
  }
  function resultatBilanMinceur() {
    const f = S.progForm || {};
    const v = P.verifier(f);
    if (v.stop && STOPS[v.stop]) return `<div class="bandeau-stop stack" style="gap:6px" role="status"><strong>${STOPS[v.stop][0]}</strong><span class="small">${STOPS[v.stop][1]}</span></div>`;
    if (v.erreurs.length) return `<p class="small muted" style="margin:0">${esc(v.erreurs[0])}</p>`;
    const c = P.calculer(f);
    const fin = new Date(Date.now() + (c.semaines || 0) * 6048e5);
    return `<div class="resultat-kcal stack" style="gap:10px">
      <div class="chiffres-calc"><div><span class="small muted">Pour garder votre poids</span><strong class="num">${nb(c.entretien)}</strong><span class="small muted">kcal / jour</span></div><div><span class="small muted">Votre cible</span><strong class="num repere-final">${nb(c.cible)}</strong><span class="small muted">kcal / jour</span></div><div><span class="small muted">Perte estimée</span><strong class="num">${virgule(c.kgSemaine)}</strong><span class="small muted">kg / semaine</span></div></div>
      <span class="small">${virgule(c.aPerdre)} kg à perdre : environ <strong>${c.semaines} semaines</strong>, vers ${fin.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}. Sans se priver : une perte lente tient mieux dans le temps.${c.limite ? ' Votre cible est arrêtée à vos besoins de base : descendre plus bas n’est pas conseillé sans suivi médical.' : ''}</span>
      <label class="case small"><input type="checkbox" data-a="prog-consent" ${f.consent ? 'checked' : ''}><span>J’accepte que mon poids et ces informations soient enregistrés <strong>sur cet appareil uniquement</strong> (et dans mon compte si je suis connecté). Je peux tout effacer en arrêtant le programme.</span></label>
      <button class="btn btn-plein btn-grand" data-a="prog-lancer" ${f.consent ? '' : 'disabled'}>${S.profil.programme ? 'Mettre à jour mon programme' : 'Lancer mon programme et préparer ma semaine'}</button></div>`;
  }
  function ongletMinceur() {
    const pr = S.profil.programme;
    if (!pr || S.progModifier) return vueBilanMinceur();
    const c = progCalc(), cible = cibleProg(), rep = P.repartition(cible);
    const actuel = pr.poidsActuel || pr.poidsDepart;
    const perdu = Math.max(0, Math.round((pr.poidsDepart - actuel) * 10) / 10);
    const pct = Math.max(0, Math.min(100, Math.round(perdu / Math.max(0.1, pr.poidsDepart - pr.objectif) * 100)));
    const jours = pr.semainePrete && S.plan && S.plan.programme ? journeesMinceur() : [];
    const pt = S.progPoint || {};
    const ressentis = [['bien', '🙂 Bien'], ['facile', '😎 Facile'], ['faim', '😋 J’ai eu faim'], ['difficile', '😓 Difficile à suivre']];
    const coll = P.collations(S.profil.gouts);
    return `<div class="ardoise-minceur"><span class="small">Semaine ${pr.semaine || 1}${pr.stabilisation ? ' · stabilisation' : ''}</span><h1>Mon programme minceur</h1><span class="small">${nb(cible)} kcal par jour · rythme ${P.RYTHMES[pr.rythme].libelle.toLowerCase()}</span></div>
      <section class="carte stack" style="gap:10px"><div class="spread"><h2>Mes progrès</h2><span class="small muted">${pr.pesees.length ? `dernière pesée le ${new Date(pr.pesees[pr.pesees.length - 1].d).toLocaleDateString('fr-FR')}` : 'pas encore de pesée'}</span></div>
        <div class="chiffres-calc"><div><span class="small muted">Départ</span><strong class="num">${virgule(pr.poidsDepart)}</strong><span class="small muted">kg</span></div><div><span class="small muted">Aujourd’hui</span><strong class="num repere-final">${virgule(actuel)}</strong><span class="small muted">kg</span></div><div><span class="small muted">Objectif</span><strong class="num">${virgule(pr.objectif)}</strong><span class="small muted">kg</span></div></div>
        <div class="piste-courses" aria-label="${pct} % de l’objectif"><i style="width:${pct}%"></i></div>
        <span class="small">${perdu ? `<strong>${virgule(perdu)} kg</strong> de moins depuis le début, ${pct} % du chemin.` : 'C’est parti : la première pesée est dans une semaine.'}</span>
        ${graphePoids(pr)}</section>
      <section class="carte stack message-coach" style="gap:8px"><div class="row" style="gap:10px;align-items:center;flex-wrap:nowrap"><span class="avatar-coach" aria-hidden="true">🥗</span><strong>Le mot de votre coach</strong></div>
        <p style="margin:0">${esc(pr.message || 'Je prépare votre semaine selon vos goûts : touchez le bouton ci-dessous.')}</p>
        ${pr.semainePrete && S.plan && S.plan.programme ? '' : '<div><button class="btn btn-plein" data-a="prog-semaine">Préparer ma semaine minceur</button></div>'}</section>
      <section class="carte stack" style="gap:10px"><h2>Ma journée type</h2>
        <div class="journee-type">${[['🥐', 'Petit-déjeuner', rep.petitdej], ['🍽', 'Déjeuner', rep.dejeuner], ['🍲', 'Dîner', rep.diner], ['🍎', 'Collation', rep.collation]].map(([e, t, k]) => `<div><span aria-hidden="true">${e}</span><strong>${t}</strong><span class="num">${nb(k)} kcal</span></div>`).join('')}</div>
        ${coll.length ? `<span class="small">Idées de collation selon vos goûts : ${coll.map(esc).join(' · ')}.</span>` : ''}
        <span class="small muted">Eau à volonté. Légumes à volonté. Une protéine à chaque repas pour tenir jusqu’au suivant.</span></section>
      ${jours.length ? `<section class="carte stack" style="gap:10px"><div class="spread"><h2>Ma semaine, portion par portion</h2><button class="btn-lien small" data-a="prog-semaine">Refaire la semaine</button></div>
        <div class="jours-minceur">${jours.map((d) => `<article class="jour-minceur"><div class="spread"><strong>${E.JOURS[d.j]}</strong><span class="small ${d.total > cible * 1.1 ? 'alerte-ing' : 'muted'} num">≈ ${nb(Math.round(d.total / 10) * 10)} kcal</span></div>
          <ul class="small">${d.pd ? `<li><span aria-hidden="true">🥐</span> <button class="btn-lien" data-a="fiche-g" data-r="${d.pd.recette}" data-n="1">${esc(d.pd.nom)}</button> <span class="muted num">${nb(d.pd.kcal)} kcal</span></li>` : ''}
          ${[['🍽', d.dej], ['🍲', d.din]].filter(([, x]) => x).map(([e, x]) => `<li><span aria-hidden="true">${e}</span> ${x.dehors ? '<span class="muted">Mangé dehors</span>' : `<span>${esc(x.nom)}</span> <span class="muted num">${nb(x.kcal)} kcal</span>${x.court ? `<br><span class="conseil-portion">→ Vous : ${esc(x.court)}${x.f < 1 ? ` · ${x.f === 0.5 ? '½' : '¾'} de part` : ''}</span>` : x.conseil && (x.f !== 1 || x.plus) ? `<br><span class="conseil-portion">→ ${esc(x.conseil)}</span>` : ''}${x.enfants ? `<br><span class="small muted">👧 Enfants : ${esc(x.enfants)}</span>` : ''}${x.recette ? ` <button class="btn-lien small" data-a="fiche-g" data-r="${x.recette}" data-n="1">détail</button>` : ''}`}</li>`).join('')}</ul></article>`).join('')}</div>
        <span class="small muted">Estimations pour votre part. Les plats sont dans « Semaine » et leurs ingrédients dans la liste de courses.</span></section>` : ''}
      <section class="carte stack point-semaine" style="gap:10px"><h2>Le point de la semaine</h2>
        <span class="small muted">Une fois par semaine, le même jour, le matin à jeun.</span>
        <label class="champ" style="max-width:170px"><span>Mon poids</span><span class="saisie-euros"><input type="text" inputmode="decimal" data-a="prog-pesee" value="${esc(pt.kg || '')}" placeholder="${virgule(actuel)}"><span>kg</span></span></label>
        <div class="stack" style="gap:6px"><strong>Comment s’est passée la semaine ?</strong><div class="row" role="radiogroup" style="gap:6px">${ressentis.map(([k, v]) => `<button class="chip" role="radio" data-a="prog-ressenti" data-k="${k}" aria-checked="${pt.ressenti === k}" aria-pressed="${pt.ressenti === k}">${v}</button>`).join('')}</div></div>
        <div><button class="btn btn-plein" data-a="prog-point">Faire le point avec mon coach</button></div>
        ${pr.dernierPoint ? `<div class="bandeau bandeau-info small" role="status"><span>${esc(pr.dernierPoint)}</span></div><div><button class="btn btn-plein" data-a="prog-semaine">Préparer ma semaine suivante</button></div>` : ''}</section>
      <section class="carte stack" style="gap:8px"><h2>Une question pour votre coach ?</h2>
        <div class="chat" aria-live="polite">${coachMinceur.tours.length ? coachMinceur.tours.map((t) => `<p class="bulle-chat ${t.role === 'user' ? 'moi' : ''}">${esc(t.content)}</p>`).join('') : '<p class="bulle-chat">Bonjour ! J’ai faim le soir, je mange au restaurant samedi, mon poids stagne… Posez-moi votre question.</p>'}${coachMinceur.attente ? '<p class="bulle-chat"><span class="muted">Je réfléchis…</span></p>' : ''}</div>
        ${coachMinceur.message ? `<p class="small" style="color:var(--tomate)">${esc(coachMinceur.message)}</p>` : ''}
        <div class="row" style="gap:6px">${['J’ai faim le soir', 'Je vais au restaurant', 'Mon poids stagne', 'Quel sport ?'].map((q) => `<button class="chip chip-petit" data-a="coach-m-q" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="row" style="gap:8px;flex-wrap:nowrap"><label class="champ" style="flex:1;min-width:0"><span class="sr">Votre question</span><input type="text" id="coach-m-texte" placeholder="Votre question…" autocomplete="off" enterkeyhint="send"></label><button class="btn btn-plein" data-a="coach-m-envoyer" ${coachMinceur.attente ? 'disabled' : ''}>Envoyer</button></div></section>
      <label class="case small"><input type="checkbox" data-a="m-semaine-case" ${pr.dansSemaine !== false ? 'checked' : ''}><span>Appliquer le coach à mes plats de la semaine (assiette indiquée sous chaque plat, courses ajustées)</span></label>
      <div class="row" style="gap:8px"><button class="btn" data-a="prog-modifier">Modifier mes informations</button><button class="btn ${S.progArret ? 'btn-plein' : ''}" data-a="prog-arreter">${S.progArret ? 'Confirmer : arrêter et effacer' : 'Arrêter le programme'}</button></div>
      <p class="small muted prudence-coach">Programme indicatif, qui ne remplace pas l’avis d’un médecin. Si vous perdez du poids sans le vouloir, si vous vous sentez faible, ou si la nourriture devient une source d’angoisse, arrêtez et parlez-en à votre médecin.</p>`;
  }
  function consignesCoachMinceur() {
    const p = S.profil, pr = p.programme, cible = cibleProg(), rep = P.repartition(cible);
    const g = E.resumeGouts(p.gouts);
    const semaine = S.plan ? S.plan.jours.map((jp, j) => `${E.JOURS[j]} : ${['dejeuner', 'diner'].map((s) => jp[s] && E.REC[jp[s].recette] ? E.REC[jp[s].recette].nom : '—').join(' / ')}`).join(' ; ') : '';
    return `Tu es le coach minceur de Budgétable, une application française de menus à petit budget. Tu accompagnes une personne adulte dans une perte de poids douce.
Son programme : cible ${cible} kcal par jour (petit-déjeuner ${rep.petitdej}, déjeuner ${rep.dejeuner}, dîner ${rep.diner}, collation ${rep.collation}), poids de départ ${pr.poidsDepart} kg, aujourd’hui ${pr.poidsActuel || pr.poidsDepart} kg, objectif ${pr.objectif} kg, semaine ${pr.semaine || 1}.
Elle aime : ${g.aime.join(', ') || 'non renseigné'}. Elle aime moins : ${g.evite.join(', ') || 'non renseigné'}. Régime : ${E.LIBELLES.regime[p.regime] || 'aucun'}. Allergies : ${(p.allergies || []).join(', ') || 'aucune'}.
Sa semaine : ${semaine}.
Règles :
- Réponds en français, en vouvoyant, avec bienveillance, en 4 phrases maximum.
- Conseils simples, peu chers, compatibles avec ses goûts, son régime et ses allergies.
- Jamais de régime extrême, de jeûne prolongé, de « brûle-graisses », de médicament ou de complément ; jamais moins de 1 200 kcal par jour.
- Aucun jugement sur le corps ou le poids. Si la personne parle de se faire vomir, de ne plus manger, de culpabilité intense ou de malaise, conseille avec douceur d’en parler à son médecin et cite Anorexie Boulimie Info Écoute (09 69 325 900).
- Pour une question médicale (maladie, traitement, grossesse), renvoie vers le médecin.
Réponds uniquement avec un objet JSON : {"reponse": "ton message"}`;
  }
  async function envoyerCoachMinceur(question) {
    const texte = String(question || '').trim().slice(0, 500);
    if (!texte || coachMinceur.attente || !S.profil.programme) return;
    const cible = cibleProg();
    const secours = P.repondreLocal(texte, { cible, repartition: P.repartition(cible), collations: P.collations(S.profil.gouts) });
    coachMinceur.tours.push({ role: 'user', content: texte });
    if (!iaDispo) { coachMinceur.tours.push({ role: 'assistant', content: secours }); rendre(); return; }
    coachMinceur.attente = true; coachMinceur.message = ''; rendre();
    try {
      const r = await iaDispo.json([{ role: 'user', content: consignesCoachMinceur() }, ...coachMinceur.tours.slice(-8)]);
      coachMinceur.tours.push({ role: 'assistant', content: (r && typeof r.reponse === 'string' && r.reponse.trim() ? r.reponse : secours).slice(0, 1500) });
    } catch (e) {
      if (e && e.code === 'rate_limited') coachMinceur.message = e.message || 'Le coach est très sollicité : voici une réponse rapide.';
      coachMinceur.tours.push({ role: 'assistant', content: secours });
    }
    coachMinceur.attente = false; rendre();
  }

  /* ---------- coach sportif : programme d'entraînement, séance guidée, progression ---------- */
  const SP = window.Sport;
  let coachSport = { tours: [], attente: false, message: '' };
  let minuterieSeance = null;
  const lundiIso = (d) => ISO(lundiDe(d));
  const jourSemaine = () => (new Date().getDay() + 6) % 7;
  function programmeSport() {
    const sp = S.profil.sport;
    if (!sp) return [];
    if (!sp.plan || sp.planSemaine !== sp.semaine || sp.planAjust !== (sp.ajust || 0)) { sp.plan = SP.genererSemaine({ ...sp, douceur: sp.douceur }, sp.semaine || 1, sp.ajust || 0); sp.planSemaine = sp.semaine || 1; sp.planAjust = sp.ajust || 0; }
    return sp.plan;
  }
  const faitesSemaine = () => { const sp = S.profil.sport; return (sp.historique || []).filter((h) => h.semaine === sp.semaine); };
  function vueBilanSport() {
    const f = S.sportForm = S.sportForm || (() => { const sp = S.profil.sport; const c = S.calcKcal || {}; return sp ? { ...sp, sante: { ...(sp.sante || {}) }, consent: true } : { age: c.age || '', objectif: S.profil.programme ? 'perte' : '', niveau: '', materiel: [], jours: [], duree: 30, limites: [], sante: {}, accordMedecin: false, consent: !!S.profil.consentementSante }; })();
    const radio = (cle, k, v, sous) => `<button class="chip" role="radio" data-a="sp-choix" data-cle="${cle}" data-k="${k}" aria-checked="${String(f[cle]) === String(k)}" aria-pressed="${String(f[cle]) === String(k)}">${v}${sous ? ` <span class="small muted">${esc(sous)}</span>` : ''}</button>`;
    const multi = (cle, k, v) => `<button class="chip" data-a="sp-multi" data-cle="${cle}" data-k="${k}" aria-pressed="${(f[cle] || []).map(String).includes(String(k))}">${v}</button>`;
    return `<div class="ardoise-sport"><span class="small">Votre coach personnel</span><h1>Coach sportif</h1><span class="small">des séances à votre niveau, chez vous ou en salle, qui progressent avec vous</span></div>
      <section class="carte stack" style="gap:14px"><h2>Faisons connaissance</h2>
        <div class="row" style="gap:10px"><label class="champ" style="max-width:120px"><span>Âge</span><span class="saisie-euros"><input type="text" inputmode="numeric" data-a="sp-champ" data-k="age" value="${esc(f.age || '')}" placeholder="35"><span>ans</span></span></label></div>
        <div class="stack" style="gap:6px"><strong>Votre objectif</strong><div class="row" role="radiogroup" style="gap:6px">${Object.entries(SP.OBJECTIFS).map(([k, o]) => radio('objectif', k, `${o.emoji} ${o.lib}`)).join('')}</div></div>
        <div class="stack" style="gap:6px"><strong>Votre niveau</strong><div class="row" role="radiogroup" style="gap:6px">${Object.entries(SP.NIVEAUX).map(([k, n]) => radio('niveau', k, n.lib, n.sous)).join('')}</div></div>
        <div class="stack" style="gap:6px"><strong>Votre matériel</strong><span class="small muted">Rien n’est obligatoire : sans matériel, tout se fait au poids du corps.</span><div class="row" style="gap:6px">${Object.entries(SP.MATERIEL).filter(([k]) => k !== 'aucun').map(([k, l]) => multi('materiel', k, l)).join('')}</div></div>
        <div class="stack" style="gap:6px"><strong>Vos jours d’entraînement</strong><span class="small muted">${(f.jours || []).length ? pluriel(f.jours.length, 'séance') + ' par semaine' : 'Conseil : 2 ou 3 jours pour commencer, avec un jour de repos entre deux.'}</span><div class="row" style="gap:6px">${E.JOURS.map((jn, j) => multi('jours', j, jn.slice(0, 3) + '.')).join('')}</div></div>
        <div class="stack" style="gap:6px"><strong>Durée des séances</strong><div class="row" role="radiogroup" style="gap:6px">${[20, 30, 45].map((d) => radio('duree', d, d + ' min')).join('')}</div></div>
        <div class="stack" style="gap:6px"><strong>Des points fragiles ?</strong><div class="row" style="gap:6px">${Object.entries(SP.LIMITES).map(([k, l]) => multi('limites', k, l)).join('')}</div></div>
        <div class="stack" style="gap:8px"><strong>Votre santé</strong><span class="small muted">Quatre questions pour faire du sport en sécurité. Vos réponses restent sur cet appareil.</span>
          ${SP.SANTE.map(([k, q]) => `<div class="stack" style="gap:4px"><span class="small">${esc(q)}</span><div class="row" role="radiogroup" style="gap:6px">${['non', 'oui'].map((r) => `<button class="chip chip-petit" role="radio" data-a="sp-sante" data-k="${k}" data-v="${r}" aria-checked="${(f.sante || {})[k] === r}" aria-pressed="${(f.sante || {})[k] === r}">${r === 'oui' ? 'Oui' : 'Non'}</button>`).join('')}</div></div>`).join('')}</div>
        <div id="sp-etat" class="stack" style="gap:10px">${etatBilanSport()}</div>
      </section>
      <p class="small muted prudence-coach">Programme indicatif, qui ne remplace pas un éducateur sportif ou l’avis d’un médecin. Arrêtez immédiatement en cas de douleur dans la poitrine, de malaise ou d’essoufflement anormal, et appelez le 15.</p>`;
  }
  function etatBilanSport() {
    const f = S.sportForm || {};
    const v = SP.verifier(f);
    const stop = v.stop === 'jeune' ? '<div class="bandeau-stop stack" style="gap:6px"><strong>Avant 16 ans, on s’entraîne encadré</strong><span class="small">Le sport, c’est excellent à votre âge ! Mais un programme d’entraînement doit être suivi par un adulte formé : club, professeur d’EPS, éducateur sportif. Parlez-en autour de vous.</span></div>'
      : v.stop === 'medecin' ? `<div class="bandeau-stop stack" style="gap:6px"><strong>Un avis médical d’abord</strong><span class="small">Vous avez répondu « oui » à une question de santé : avant de commencer, demandez l’accord de votre médecin. Avec son feu vert, je vous préparerai un programme doux, sans sauts.</span><label class="case small"><input type="checkbox" data-a="sp-accord" ${f.accordMedecin ? 'checked' : ''}><span>Mon médecin m’a donné son accord pour faire du sport</span></label></div>` : '';
    return `${stop}
        ${v.erreurs.length ? `<p class="small muted" style="margin:0">${esc(v.erreurs[0])}</p>` : ''}
        ${v.stop === 'jeune' ? '' : `<label class="case small"><input type="checkbox" data-a="sp-consent" ${f.consent ? 'checked' : ''}><span>J’accepte que ces informations soient enregistrées <strong>sur cet appareil uniquement</strong> (et dans mon compte si je suis connecté).</span></label>
        <button class="btn btn-plein btn-grand" data-a="sp-lancer" ${v.ok && f.consent ? '' : 'disabled'}>${S.profil.sport ? 'Mettre à jour mon programme' : 'Créer mon programme'}</button>`}`;
  }
  function carteSeance(s, faite) {
    const auj = s.j === jourSemaine();
    const ex = s.blocs.map((x) => `<li>${SP.EX[x.ex].emoji} ${esc(SP.EX[x.ex].nom)} <span class="muted num">${x.reps ? x.reps + ' répétitions' : x.secondes + ' s'}</span></li>`).join('');
    return `<article class="seance ${auj ? 'auj' : ''} ${faite ? 'faite' : ''}"><div class="spread"><span class="eyebrow">${E.JOURS[s.j]}${auj ? ' · aujourd’hui' : ''}</span>${faite ? `<span class="tag tag-ok">✓ Faite${faite.ressenti ? ' · ' + ({ facile: 'facile', bien: 'bien', dur: 'dure', douleur: 'douleur' })[faite.ressenti] : ''}</span>` : ''}</div>
      <strong>${esc(s.titre)}</strong><span class="small muted">≈ ${s.minutes} min · ${s.tours > 1 ? s.tours + ' tours · ' : ''}≈ ${s.kcal} kcal</span>
      <details class="small"><summary>${pluriel(s.blocs.length, 'exercice')}</summary><ul class="liste-ex">${ex}</ul></details>
      <div><button class="btn ${faite ? '' : 'btn-plein'} btn-petit" data-a="sp-go" data-j="${s.j}">${faite ? '↻ Refaire' : '▶ Commencer la séance'}</button></div></article>`;
  }
  function ongletSport() {
    const sp = S.profil.sport;
    if (!sp || S.sportModifier) return vueBilanSport();
    const plan = programmeSport();
    const faites = faitesSemaine();
    const minutes = (sp.historique || []).reduce((t, h) => t + (h.minutes || 0), 0);
    const total = (sp.historique || []).length;
    const ancienne = sp.semaineDu && sp.semaineDu < lundiIso(new Date());
    const o = SP.OBJECTIFS[sp.objectif];
    const coachMsg = sp.message || `Bienvenue ! J’ai préparé ${pluriel(plan.length, 'séance')} cette semaine pour « ${o.lib.toLowerCase()} », au niveau ${SP.NIVEAUX[sp.niveau].lib.toLowerCase()}. Après chaque séance, dites-moi comment c’était : j’ajuste la suite. ${SP.MOTIVATION[(sp.semaine || 1) % SP.MOTIVATION.length]}`;
    return `<div class="ardoise-sport"><span class="small">Semaine ${sp.semaine || 1} · ${o.emoji} ${esc(o.lib)}</span><h1>Mon coach sportif</h1><span class="small">${pluriel(plan.length, 'séance')} de ${sp.duree} min · niveau ${SP.NIVEAUX[sp.niveau].lib.toLowerCase()}${sp.douceur ? ' · version douce' : ''}</span></div>
      <div class="chiffres-calc stats-sport"><div><span class="small muted">Cette semaine</span><strong class="num repere-final">${faites.length}/${plan.length}</strong><span class="small muted">séances</span></div><div><span class="small muted">Depuis le début</span><strong class="num">${total}</strong><span class="small muted">séances</span></div><div><span class="small muted">Temps total</span><strong class="num">${minutes >= 60 ? Math.floor(minutes / 60) + ' h ' + String(minutes % 60).padStart(2, '0') : minutes + ' min'}</strong><span class="small muted">d’effort</span></div></div>
      <section class="carte stack message-coach" style="gap:8px"><div class="row" style="gap:10px;align-items:center;flex-wrap:nowrap"><span class="avatar-coach" aria-hidden="true">🏃</span><strong>Le mot de votre coach</strong></div><p style="margin:0">${esc(coachMsg)}</p></section>
      ${ancienne || faites.length >= plan.length ? `<section class="carte stack" style="gap:8px"><strong>${faites.length >= plan.length ? '💯 Toutes les séances sont faites !' : 'Une nouvelle semaine commence'}</strong><span class="small">Faisons le bilan : j’adapte l’intensité selon votre ressenti et je prépare les séances de la semaine suivante.</span><div><button class="btn btn-plein" data-a="sp-bilan">Faire le bilan et passer à la semaine ${(sp.semaine || 1) + 1}</button></div></section>` : ''}
      <section class="stack" style="gap:10px"><h2>Mes séances de la semaine</h2><div class="grille-seances">${plan.map((s) => carteSeance(s, faites.filter((h) => h.j === s.j).pop())).join('')}</div></section>
      <section class="carte stack" style="gap:8px"><h2>Bien manger pour bien s’entraîner</h2>
        <span class="small">Les jours de séance, un petit-déjeuner riche en protéines aide à récupérer.${sp.objectif === 'perte' ? ' Pour perdre du poids, le sport aide, mais l’assiette compte le plus.' : ''}</span>
        <div class="row" style="gap:8px">${S.plan ? '<button class="btn btn-petit btn-plein" data-a="sp-petitdej">🥐 Petits-déj sportifs les jours de séance</button>' : ''}${sp.objectif === 'perte' ? `<button class="btn btn-petit" data-a="onglet" data-k="minceur">🥗 ${S.profil.programme ? 'Mon programme minceur' : 'Programme minceur'}</button>` : '<button class="btn btn-petit" data-a="coach-voir" data-k="sportif">💪 Menus riches en protéines</button>'}</div></section>
      <section class="carte stack" style="gap:8px"><h2>Parlez à votre coach</h2>
        <div class="chat" aria-live="polite">${coachSport.tours.length ? coachSport.tours.map((t) => `<p class="bulle-chat ${t.role === 'user' ? 'moi' : ''}">${esc(t.content)}</p>`).join('') : '<p class="bulle-chat">Salut ! Des courbatures, un coup de mou, pas le temps, une question sur un exercice ? Je suis là.</p>'}${coachSport.attente ? '<p class="bulle-chat"><span class="muted">Je réfléchis…</span></p>' : ''}</div>
        ${coachSport.message ? `<p class="small" style="color:var(--tomate)">${esc(coachSport.message)}</p>` : ''}
        <div class="row" style="gap:6px">${['J’ai des courbatures', 'Pas motivé aujourd’hui', 'Quoi manger après ?', 'Perdre du ventre'].map((q) => `<button class="chip chip-petit" data-a="coach-s-q" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="row" style="gap:8px;flex-wrap:nowrap"><label class="champ" style="flex:1;min-width:0"><span class="sr">Votre question</span><input type="text" id="coach-s-texte" placeholder="Votre question…" autocomplete="off" enterkeyhint="send"></label><button class="btn btn-plein" data-a="coach-s-envoyer" ${coachSport.attente ? 'disabled' : ''}>Envoyer</button></div></section>
      <div class="row" style="gap:8px"><button class="btn" data-a="sp-modifier">Modifier mon programme</button><button class="btn ${S.sportArret ? 'btn-plein' : ''}" data-a="sp-arreter">${S.sportArret ? 'Confirmer : arrêter et effacer' : 'Arrêter le programme'}</button></div>
      <p class="small muted prudence-coach">Arrêtez immédiatement en cas de douleur dans la poitrine, de malaise ou d’essoufflement anormal, et appelez le 15. Une douleur articulaire qui persiste : consultez avant de reprendre.</p>`;
  }
  /* séance guidée : une étape à la fois, minuteur, récupération, fin avec ressenti */
  function bip(long) {
    try { if (navigator.vibrate) navigator.vibrate(long ? [200, 80, 200] : 120); } catch (e) { /* */ }
    try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; bip.ctx = bip.ctx || new C(); const o = bip.ctx.createOscillator(), g = bip.ctx.createGain(); o.frequency.value = long ? 660 : 880; g.gain.value = 0.08; o.connect(g); g.connect(bip.ctx.destination); o.start(); o.stop(bip.ctx.currentTime + (long ? 0.35 : 0.12)); } catch (e) { /* */ }
  }
  function lancerMinuterie() {
    clearInterval(minuterieSeance);
    minuterieSeance = setInterval(() => {
      const s = S.seance;
      if (!s || s.fin) { clearInterval(minuterieSeance); return; }
      if (s.pause) return;
      s.ecoule = (s.ecoule || 0) + 1;
      const et = s.etapes[s.i];
      if (!et.secondes) return;
      s.restant = Math.max(0, (s.restant == null ? et.secondes : s.restant) - 1);
      const z = document.getElementById('seance-chrono'); if (z) z.textContent = s.restant;
      const anneau = document.getElementById('seance-anneau'); if (anneau) anneau.style.setProperty('--p', 1 - s.restant / et.secondes);
      if (s.restant <= 3 && s.restant > 0) bip(false);
      if (s.restant === 0) { bip(true); etapeSuivante(); }
    }, 1000);
  }
  function etapeSuivante() {
    const s = S.seance; if (!s) return;
    s.i++; s.restant = null;
    if (s.i >= s.etapes.length) { s.fin = true; clearInterval(minuterieSeance); }
    rendre();
  }
  function vueSeance() {
    const s = S.seance;
    if (!s) return '';
    if (s.fin) {
      const min = Math.max(1, Math.round((s.ecoule || 0) / 60));
      return `<div class="voile voile-seance"><div class="fiche fenetre-seance stack" role="dialog" aria-modal="true" aria-labelledby="seance-titre" style="gap:14px;text-align:center">
        <div class="emoji-seance" aria-hidden="true">🏆</div><h2 id="seance-titre">Séance terminée, bravo !</h2>
        <p style="margin:0">${min} min d’effort · environ ${s.kcal} kcal</p>
        <strong>Comment c’était ?</strong>
        <div class="reponses reponses-4" role="group" aria-label="Votre ressenti">${[['facile', '😎 Trop facile'], ['bien', '🙂 Bien'], ['dur', '🥵 Dur'], ['douleur', '🤕 J’ai eu mal']].map(([k, v]) => `<button class="btn ${k === 'bien' ? 'btn-plein' : ''}" data-a="sp-fin" data-k="${k}">${v}</button>`).join('')}</div>
        <span class="small muted">Votre réponse règle l’intensité des prochaines séances.</span></div></div>`;
    }
    const et = s.etapes[s.i], ex = et.repos ? SP.EX[et.suivant] : SP.EX[et.ex];
    const suiv = s.etapes.slice(s.i + 1).find((x) => !x.repos);
    const pct = Math.round(s.i / s.etapes.length * 100);
    const restant = s.restant == null ? et.secondes : s.restant;
    return `<div class="voile voile-seance"><div class="fiche fenetre-seance stack ${et.repos ? 'repos' : ''}" role="dialog" aria-modal="true" aria-labelledby="seance-titre" style="gap:12px">
      <div class="spread"><span class="eyebrow">${esc(et.phase)}</span><button class="btn btn-petit" data-a="sp-stop">✕ Arrêter</button></div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avancement de la séance"><i style="width:${pct}%"></i></div>
      ${et.repos ? `<div class="stack" style="gap:6px;text-align:center"><div class="emoji-seance" aria-hidden="true">😮‍💨</div><h2 id="seance-titre">Récupérez</h2><span class="small muted">Ensuite : ${ex.emoji} ${esc(ex.nom)}</span></div>`
        : `<div class="stack" style="gap:6px;text-align:center"><div class="emoji-seance" aria-hidden="true">${ex.emoji}</div><h2 id="seance-titre">${esc(ex.nom)}</h2>${et.reps ? `<p class="gros-chiffre num" style="margin:0">${et.reps} <span class="small">répétitions</span></p>` : ''}</div>
        <ol class="consignes-ex small">${ex.consignes.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>${ex.facile ? `<p class="small muted" style="margin:0">Trop dur ? ${esc(ex.facile)}</p>` : ''}`}
      ${et.secondes ? `<div class="anneau" id="seance-anneau" style="--p:${1 - restant / et.secondes}"><span id="seance-chrono" class="num" aria-live="off">${restant}</span><span class="small muted">secondes</span></div>` : ''}
      <div class="row" style="gap:8px;justify-content:center">${et.secondes ? `<button class="btn" data-a="sp-pause">${s.pause ? '▶ Reprendre' : '⏸ Pause'}</button><button class="btn" data-a="sp-suivant">⏭ ${et.repos ? 'Passer le repos' : 'Suivant'}</button>` : '<button class="btn btn-plein btn-grand" data-a="sp-suivant">✓ C’est fait</button>'}</div>
      ${suiv && !et.repos ? `<span class="small muted" style="text-align:center">Ensuite : ${SP.EX[suiv.ex].emoji} ${esc(SP.EX[suiv.ex].nom)}</span>` : ''}
    </div></div>`;
  }
  function consignesCoachSport() {
    const sp = S.profil.sport, plan = programmeSport();
    const derniers = (sp.historique || []).slice(-5).map((h) => `${h.d} : ${h.titre || 'séance'} (${h.ressenti || '?'})`).join(' ; ');
    return `Tu es le coach sportif de Budgétable, une application française. Tu parles comme un vrai coach sportif : énergique, motivant, chaleureux, concret, mais toujours prudent.
La personne : ${sp.age} ans, objectif « ${SP.OBJECTIFS[sp.objectif].lib} », niveau ${SP.NIVEAUX[sp.niveau].lib}, matériel : ${(sp.materiel || []).map((m) => SP.MATERIEL[m]).join(', ') || 'aucun'}, points fragiles : ${(sp.limites || []).map((l) => SP.LIMITES[l]).join(', ') || 'aucun'}${sp.douceur ? ', programme doux (accord médical ou douleur signalée)' : ''}.
Semaine ${sp.semaine || 1} : ${plan.map((s) => `${E.JOURS[s.j]} ${s.titre} (${s.minutes} min : ${s.blocs.map((x) => SP.EX[x.ex].nom).join(', ')})`).join(' ; ')}.
Dernières séances : ${derniers || 'aucune pour l’instant'}.${S.profil.programme ? ` Elle suit aussi le programme minceur (cible ${S.profil.programme.cible || '?'} kcal par jour).` : ''}
Règles :
- Réponds en français, en vouvoyant, en 4 phrases maximum, avec de l’énergie (un emoji au plus).
- Explique les mouvements simplement (position, respiration, erreur à éviter) et propose une version plus facile si besoin.
- Douleur dans la poitrine, malaise, essoufflement anormal : arrêt immédiat et appeler le 15. Douleur articulaire qui dure : médecin avant de reprendre.
- Jamais de produits dopants, de compléments miracles, de régime extrême ni de culpabilisation.
Réponds uniquement avec un objet JSON : {"reponse": "ton message"}`;
  }
  async function envoyerCoachSport(question) {
    const texte = String(question || '').trim().slice(0, 500);
    if (!texte || coachSport.attente || !S.profil.sport) return;
    const secours = SP.repondreLocal(texte, { semaine: S.profil.sport.semaine, seances: programmeSport().length });
    coachSport.tours.push({ role: 'user', content: texte });
    if (!iaDispo) { coachSport.tours.push({ role: 'assistant', content: secours }); rendre(); return; }
    coachSport.attente = true; coachSport.message = ''; rendre();
    try {
      const r = await iaDispo.json([{ role: 'user', content: consignesCoachSport() }, ...coachSport.tours.slice(-8)]);
      coachSport.tours.push({ role: 'assistant', content: (r && typeof r.reponse === 'string' && r.reponse.trim() ? r.reponse : secours).slice(0, 1500) });
    } catch (e) {
      if (e && e.code === 'rate_limited') coachSport.message = e.message || 'Le coach est très sollicité : voici une réponse rapide.';
      coachSport.tours.push({ role: 'assistant', content: secours });
    }
    coachSport.attente = false; rendre();
  }
  /** Sur téléphone : les coachs toujours visibles en haut de la semaine. */
  function bandeauCoachs() {
    const c = COACHS[S.profil.coach], pr = S.profil.programme, sp = S.profil.sport;
    return `<nav class="bandeau-coachs" aria-label="Mes coachs">
      <button class="coach-puce ${pr ? 'actif' : ''}" data-a="onglet" data-k="minceur"><span aria-hidden="true">🥗</span><span><strong>Minceur</strong><small>${pr ? `semaine ${pr.semaine || 1}` : 'programme'}</small></span></button>
      <button class="coach-puce ${sp ? 'actif' : ''}" data-a="onglet" data-k="sport"><span aria-hidden="true">🏃</span><span><strong>Sport</strong><small>${sp ? `${faitesSemaine().length}/${programmeSport().length} séances` : 'séances guidées'}</small></span></button>
      <button class="coach-puce ${c ? 'actif' : ''}" data-a="coach-voir" data-k="${S.profil.coach || 'minceur'}"><span aria-hidden="true">${c ? c.emoji : '🎯'}</span><span><strong>Coach menus</strong><small>${c ? esc(c.court) : 'choisir'}</small></span></button></nav>`;
  }
  function blocMesCoachs() {
    return `<div class="stack" style="gap:8px"><button class="btn ${S.profil.sport ? 'btn-plein' : ''}" data-a="onglet" data-k="sport">🏃 ${S.profil.sport ? `Mon coach sportif · ${faitesSemaine().length}/${programmeSport().length} séances` : 'Coach sportif : séances guidées'}</button><button class="btn ${S.profil.programme ? 'btn-plein' : ''}" data-a="onglet" data-k="minceur">🥗 ${S.profil.programme ? `Mon programme minceur · semaine ${S.profil.programme.semaine || 1}` : 'Programme minceur personnalisé'}</button></div>`;
  }

  function ongletApports() {
    Object.assign(OBJ, objectifsJour());
    const periode = S.periodeApports || '7';
    const auj = new Date(); auj.setHours(12, 0, 0, 0);
    const debut = new Date(auj); debut.setDate(auj.getDate() - (+periode - 1));
    const jours = apportsParJour(ISO(debut), ISO(auj));
    const liste = Object.entries(jours);
    const avecRepas = liste.filter(([, v]) => v.repas.length || v.ajouts.length);
    const nbRepas = avecRepas.reduce((t, [, v]) => t + v.repas.length, 0);
    const moy = (k) => (avecRepas.length ? avecRepas.reduce((t, [, v]) => t + v[k], 0) / avecRepas.length : 0);
    const etat = (k, v) => { const [mi, ma] = OBJ[k]; return mi != null && v < mi ? 'bas' : ma != null && v > ma ? 'haut' : 'ok'; };
    const carnet = blocCarnet();
    const labJour = (d) => { const x = new Date(d + 'T12:00:00'); return periode === '7' ? E.JOURS[(x.getDay() + 6) % 7].slice(0, 3) : String(x.getDate()); };
    const serie = (k) => liste.map(([d, v]) => ({ v: Math.round(v[k]), lab: labJour(d), vide: !v.repas.length && !v.ajouts.length, tip: `${new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${v.repas.length || v.ajouts.length ? `${nb(Math.round(v[k]))} ${LIB[k][1]} (${pluriel(v.repas.length, 'repas', 'repas')}${v.ajouts.length ? `, ${pluriel(v.ajouts.length, 'ajout')}` : ''})` : 'rien de noté'}` }));
    // repas de la semaine à confirmer
    const t = aujourdhui(), h = new Date().getHours();
    const aConfirmer = S.plan ? S.plan.jours.flatMap((jp, j) => E.SLOTS.map((sl) => ({ j, sl, m: jp[sl] }))).filter(({ j, sl, m }) => m && !S.deduits[j + '-' + sl] && (posJour(j) < posJour(t) || (j === t && (sl === 'dejeuner' ? h >= 12 : h >= 19)))) : [];
    // sources de protéines et Nutri-Score des repas mangés
    const sources = { 'Viande rouge': 0, Volaille: 0, Poisson: 0, 'Charcuterie': 0, 'Œufs et laitages': 0, 'Légumineuses et soja': 0, 'Céréales et autres': 0 };
    const cat = (id) => (id === 'boeuf_hache' ? 'Viande rouge' : ['poulet_filet', 'cuisses_poulet'].includes(id) ? 'Volaille' : ['saumon', 'colin', 'thon'].includes(id) ? 'Poisson' : ['jambon', 'lardons', 'saucisse'].includes(id) ? 'Charcuterie' : ['oeufs', 'lait', 'yaourt', 'emmental', 'mozzarella', 'feta', 'creme'].includes(id) ? 'Œufs et laitages' : ['lentilles_corail', 'lentilles_vertes', 'pois_chiches', 'haricots_rouges', 'haricots_blancs', 'pois_casses', 'tofu'].includes(id) ? 'Légumineuses et soja' : 'Céréales et autres');
    const ns = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (const [, v] of avecRepas) for (const x of v.repas) {
      const rec = E.REC[x.r];
      for (const [id, q] of rec.ing) { const tb = window.Nutrition.TABLE[id]; if (!tb || !E.ING[id] || E.ING[id].perso) continue; const gr = E.ING[id].unite === 'pièce' ? q * (tb[7] || 100) : q; sources[cat(id)] += tb[5] * gr / 100; }
      if (x.n.lettre) ns[x.n.lettre]++;
    }
    // tendance sur 8 semaines
    const semaines = [];
    for (let k = 7; k >= 0; k--) {
      const l = lundiDe(auj); l.setDate(l.getDate() - 7 * k);
      const f = new Date(l); f.setDate(l.getDate() + 6);
      const js = Object.values(apportsParJour(ISO(l), ISO(f))).filter((v) => v.repas.length || v.ajouts.length);
      const m = (key) => (js.length ? js.reduce((tt, v) => tt + v[key], 0) / js.length : 0);
      semaines.push({ lab: `${l.getDate()}/${l.getMonth() + 1}`, jours: js.length, prot: m('prot'), fibres: m('fibres'), kcal: m('kcal') });
    }
    const tuile = (k) => { const v = moy(k), e = etat(k, v); return `<div class="tuile-apport rep-${avecRepas.length ? e : 'ok'}"><span class="small muted">${LIB[k][0]}</span><strong class="num">${avecRepas.length ? nb(Math.round(v * (k === 'sel' ? 10 : 1)) / (k === 'sel' ? 10 : 1)) : '–'} <span class="small">${LIB[k][1]}</span></strong><span class="small muted">par jour</span>${avecRepas.length && e !== 'ok' ? `<span class="small etat-${e}">${e === 'bas' ? '↓ pas assez' : '↑ trop'}</span>` : avecRepas.length && OBJ[k][0] != null ? '<span class="small etat-ok">✓ objectif</span>' : ''}</div>`; };
    return `<div><p class="eyebrow">Suivi</p><h1>Mes apports</h1></div>
      <button class="bandeau-promos" data-a="onglet" data-k="sport"><span aria-hidden="true">🏃</span><span><strong>${S.profil.sport ? 'Mon coach sportif' : 'Coach sportif'}</strong> <span class="small">${S.profil.sport ? `${faitesSemaine().length}/${programmeSport().length} séances cette semaine` : 'des séances guidées à votre niveau, chez vous ou en salle'}</span></span><span aria-hidden="true">→</span></button>
      <button class="bandeau-promos" data-a="onglet" data-k="minceur"><span aria-hidden="true">🥗</span><span><strong>${S.profil.programme ? 'Mon programme minceur' : 'Programme minceur personnalisé'}</strong> <span class="small">${S.profil.programme ? `semaine ${S.profil.programme.semaine || 1} : faire le point, voir ma semaine` : 'perdre du poids en douceur, avec les plats que vous aimez'}</span></span><span aria-hidden="true">→</span></button>
      <p class="muted">Ce que vous avez vraiment mangé : les repas du planning marqués « C’est mangé » et les aliments ajoutés au carnet (petit-déjeuner, collations, boissons, repas dehors). Pour un adulte. Estimations, pas un avis médical.</p>
      ${carnet}
      ${aConfirmer.length ? `<section class="carte stack a-faire" style="gap:8px"><strong>${pluriel(aConfirmer.length, 'repas', 'repas')} à confirmer</strong><span class="small muted">Touchez ceux que vous avez mangés : le suivi et le placard se mettent à jour.</span>
        <ul class="liste-confirmer">${aConfirmer.slice(0, 10).map(({ j, sl, m }) => `<li><span class="small">${E.JOURS[j]} ${sl === 'diner' ? 'soir' : 'midi'} · ${esc(E.REC[m.recette].nom)}</span><button class="btn btn-petit btn-mange" data-a="mange" data-j="${j}" data-s="${sl}">✓ Mangé</button></li>`).join('')}</ul></section>` : ''}
      <div class="row" role="radiogroup" aria-label="Période" style="gap:6px">${[['7', '7 derniers jours'], ['30', '30 derniers jours']].map(([k, v]) => `<button class="chip" role="radio" data-a="periode-apports" data-k="${k}" aria-checked="${periode === k}" aria-pressed="${periode === k}">${v}</button>`).join('')}</div>
      ${!nbRepas ? `<section class="carte stack" style="gap:8px"><strong>Pas encore de repas noté sur cette période</strong><span class="small">Dans la semaine, touchez « ✓ C’est mangé » sous chaque plat. Vos graphiques se rempliront au fil des jours.</span></section>` : ''}
      <section class="tuiles-apports">${['kcal', 'prot', 'fibres', 'legumes', 'sel', 'sucres'].map(tuile).join('')}</section>
      <h2>Sur la période</h2>
      <p class="small muted" style="margin:0">${pluriel(nbRepas, 'repas noté', 'repas notés')} sur ${pluriel(avecRepas.length, 'jour')}. Moyennes calculées sur les jours où quelque chose est noté.</p>
      <div class="grille-graphes">
        <section class="carte stack" style="gap:4px"><h2>Énergie par jour</h2><span class="small muted">kcal · repère ${nb(OBJ.kcal[1])} kcal</span>${barres(serie('kcal'), 'kcal', { titre: 'Énergie par jour' })}</section>
        <section class="carte stack" style="gap:4px"><h2>Protéines par jour</h2><span class="small muted">g · objectif 60 g et plus</span>${barres(serie('prot'), 'prot', { titre: 'Protéines par jour' })}</section>
        <section class="carte stack" style="gap:4px"><h2>Fibres par jour</h2><span class="small muted">g · objectif 30 g et plus</span>${barres(serie('fibres'), 'fibres', { titre: 'Fibres par jour' })}</section>
        <section class="carte stack" style="gap:4px"><h2>Fruits et légumes par jour</h2><span class="small muted">g · objectif 400 g et plus</span>${barres(serie('legumes'), 'legumes', { titre: 'Légumes par jour' })}</section>
        <section class="carte stack" style="gap:8px"><h2>D’où viennent vos protéines</h2><span class="small muted">grammes sur la période</span>${barresHorizontales(Object.entries(sources).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]).map(([lab, v]) => ({ lab, v })), ' g') || '<p class="small muted">Rien encore.</p>'}</section>
        <section class="carte stack" style="gap:8px"><h2>Nutri-Score des repas mangés</h2><span class="small muted">nombre de repas</span>${barresHorizontales(Object.entries(ns).map(([lab, v]) => ({ lab: 'Nutri-Score ' + lab, v, couleur: { A: '#038141', B: '#85bb2f', C: '#fecb02', D: '#ee8100', E: '#e63e11' }[lab] })), '')}</section>
        <section class="carte stack" style="gap:4px"><h2>Protéines, semaine après semaine</h2><span class="small muted">moyenne par jour, 8 dernières semaines</span>${barres(semaines.map((s) => ({ v: Math.round(s.prot), lab: s.lab, vide: !s.jours, tip: `Semaine du ${s.lab} : ${s.jours ? `${Math.round(s.prot)} g par jour (${pluriel(s.jours, 'jour')} suivis)` : 'pas de suivi'}` })), 'prot', { titre: 'Protéines par semaine' })}</section>
        <section class="carte stack" style="gap:4px"><h2>Fibres, semaine après semaine</h2><span class="small muted">moyenne par jour, 8 dernières semaines</span>${barres(semaines.map((s) => ({ v: Math.round(s.fibres), lab: s.lab, vide: !s.jours, tip: `Semaine du ${s.lab} : ${s.jours ? `${Math.round(s.fibres)} g par jour` : 'pas de suivi'}` })), 'fibres', { titre: 'Fibres par semaine' })}</section>
      </div>
      <section class="carte spread" style="align-items:center"><div class="stack" style="gap:2px"><strong>📖 Mon journal</strong><span class="small muted">Tout ce que vous avez noté, jour par jour, avec recherche, filtres et export.</span></div><button class="btn btn-plein" data-a="onglet" data-k="journal">Ouvrir le journal</button></section>`;
  }

  /* ---------- « Mon journal » : tout ce qui a été mangé, jour par jour ---------- */
  const MOMENTS_JOURNAL = [['petitdej', 'Petit-déjeuner', '☕'], ['dejeuner', 'Déjeuner', '🍽️'], ['collation', 'Collations et fruits', '🍎'], ['diner', 'Dîner', '🌙'], ['boisson', 'Boissons', '🥤'], ['dehors', 'Repas pris dehors', '🥡']];
  function humeurJour(j, finie) {
    const cles = ['kcal', 'sucres', 'sel', 'ags', 'prot', 'fibres', 'legumes'];
    const etats = cles.map((k) => etatCompteur(k, j[k], finie));
    return etats.includes('rouge') ? 'rouge' : etats.includes('neutre') ? 'neutre' : 'vert';
  }
  function lignesJournal(j) {
    const l = [];
    j.repas.forEach((x) => l.push({ moment: x.s, nom: E.REC[x.r].nom, detail: 'repas du planning', kcal: x.n.kcal, ns: x.n.lettre, suppr: `data-a="journal-suppr-repas" data-d="${x.d}" data-s="${x.s}"`, r: x.r }));
    j.ajouts.forEach((x) => { const al = alimentDe(x); if (al) l.push({ moment: x.m || 'collation', nom: al.nom, detail: `${x.n > 1 ? x.n + ' × ' : ''}${al.portion}`, kcal: Math.round(al.kcal * x.n), ns: null, suppr: `data-a="carnet-suppr" data-i="${x.i}"` }); });
    return l;
  }
  function csvJournal(jours) {
    const lignes = [['Date', 'Moment', 'Aliment ou plat', 'Portion', 'kcal']];
    for (const [d, j] of jours) for (const x of lignesJournal(j)) lignes.push([d, (MOMENTS_JOURNAL.find(([k]) => k === x.moment) || [, x.moment])[1], x.nom, x.detail, x.kcal]);
    return lignes.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  }
  function ongletJournal() {
    Object.assign(OBJ, objectifsJour());
    const per = S.periodeJournal || '30';
    const auj = new Date(); auj.setHours(12, 0, 0, 0);
    const toutes = [].concat((S.journal || []).map((x) => x.d), (S.ajouts || []).map((x) => x.d)).sort();
    const debut = per === 'tout' ? (toutes[0] || ISO(auj)) : ISO(new Date(auj.getTime() - (+per - 1) * 864e5));
    const filtre = S.filtreJournal || 'tout';
    const q = E.norm(S.rechercheJournal || '');
    const jours = Object.entries(apportsParJour(debut, ISO(auj))).filter(([, j]) => j.repas.length || j.ajouts.length).reverse();
    const humeur = S.humeurJournal || 'tout';
    const humeurDe = new Map(jours.map(([d, j]) => [d, humeurJour(j, d < ISO(auj))]));
    const toutesLignes = jours.flatMap(([d, j]) => lignesJournal(j).map((x) => ({ ...x, d })));
    const garde = (x) => (filtre === 'tout' || (filtre === 'repas' ? ['dejeuner', 'diner'].includes(x.moment) : x.moment === filtre)) && (!q || E.norm(x.nom).includes(q));
    const visibles = jours.filter(([d]) => humeur === 'tout' || humeurDe.get(d) === humeur).map(([d, j]) => [d, j, lignesJournal(j).filter(garde)]).filter(([, , l]) => l.length);
    const humeurs = [...humeurDe.values()];
    // propositions : seulement ce qui existe dans le journal, avec le nombre d'entrées
    const compte = (f) => toutesLignes.filter(f).length;
    const nomsFrequents = Object.entries(toutesLignes.reduce((m, x) => { m[x.nom] = (m[x.nom] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
    const moyKcal = jours.length ? Math.round(jours.reduce((t, [, j]) => t + j.kcal, 0) / jours.length / 10) * 10 : 0;
    const filtres = [['tout', 'Tout', () => true], ['repas', 'Repas du planning', (x) => ['dejeuner', 'diner'].includes(x.moment)], ['petitdej', '☕ Petit-déjeuner', (x) => x.moment === 'petitdej'], ['dejeuner', '🍽️ Déjeuner', (x) => x.moment === 'dejeuner'], ['collation', '🍎 Collations', (x) => x.moment === 'collation'], ['diner', '🌙 Dîner', (x) => x.moment === 'diner'], ['boisson', '🥤 Boissons', (x) => x.moment === 'boisson'], ['dehors', '🥡 Dehors', (x) => x.moment === 'dehors']]
      .map(([k, v, f]) => [k, v, compte(f)]).filter(([k, , n]) => n > 0 || k === 'tout' || k === filtre);
    const urlCsv = jours.length ? 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csvJournal(jours)) : null;
    return `<div class="spread"><div><p class="eyebrow">Suivi</p><h1>Mon journal</h1></div><div class="row ecran-seul" style="gap:6px">${urlCsv ? `<a class="btn btn-petit" href="${urlCsv}" download="budgetable-journal.csv">⬇ Télécharger (tableur)</a>` : ''}<button class="btn btn-petit" data-a="imprimer-journal">🖨 Imprimer</button></div></div>
      <p class="muted">Tout ce que vous avez noté, jour par jour : les repas du planning marqués « C’est mangé » et les aliments du carnet.</p>
      <section class="resume-journal">
        <div><span class="small muted">Jours notés</span><strong class="num">${jours.length}</strong></div>
        <div><span class="small muted">En moyenne</span><strong class="num">${nb(moyKcal)}</strong><span class="small muted">kcal / jour</span></div>
        <div><span class="small muted">Journées</span><strong class="num">😊 ${humeurs.filter((h) => h === 'vert').length} · 😐 ${humeurs.filter((h) => h === 'neutre').length} · 😟 ${humeurs.filter((h) => h === 'rouge').length}</strong></div>
      </section>
      <div class="stack ecran-seul" style="gap:8px">
        <div class="row" role="radiogroup" aria-label="Période" style="gap:6px">${[['7', '7 jours'], ['30', '30 jours'], ['tout', 'Tout']].map(([k, v]) => `<button class="chip" role="radio" data-a="journal-periode" data-k="${k}" aria-checked="${per === k}" aria-pressed="${per === k}">${v}</button>`).join('')}</div>
        <div class="row" role="group" aria-label="Moment" style="gap:6px">${filtres.map(([k, v, n]) => `<button class="chip" data-a="journal-filtre" data-k="${k}" aria-pressed="${filtre === k}">${v} <span class="compte-filtre">${n}</span></button>`).join('')}</div>
        ${jours.length ? `<div class="row" role="group" aria-label="Journées" style="gap:6px">${[['tout', 'Toutes les journées'], ['vert', '😊 Belles journées'], ['neutre', '😐 Correctes'], ['rouge', '😟 Avec dépassement']].map(([k, v]) => [k, v, k === 'tout' ? jours.length : humeurs.filter((h) => h === k).length]).filter(([k, , n]) => n > 0 || k === 'tout' || k === humeur).map(([k, v, n]) => `<button class="chip" data-a="journal-humeur" data-k="${k}" aria-pressed="${humeur === k}">${v} <span class="compte-filtre">${n}</span></button>`).join('')}</div>` : ''}
        <label class="champ"><span class="sr">Chercher dans le journal</span><input type="search" id="journal-cherche" data-a="journal-cherche" list="journal-noms" value="${esc(S.rechercheJournal || '')}" placeholder="Chercher un aliment ou un plat de votre journal…" autocomplete="off"></label>
        <datalist id="journal-noms">${nomsFrequents.map(([n]) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
        ${nomsFrequents.length ? `<div class="row suggestions-journal" style="gap:6px"><span class="small muted">Le plus souvent :</span>${nomsFrequents.slice(0, 8).map(([n, c]) => `<button class="chip chip-petit" data-a="journal-suggestion" data-k="${esc(n)}" aria-pressed="${E.norm(n) === q}" title="${esc(n)}">${esc(n.length > 28 ? n.slice(0, 26) + '…' : n)} <span class="compte-filtre">${c}</span></button>`).join('')}</div>` : ''}
        ${filtre !== 'tout' || humeur !== 'tout' || q ? '<div><button class="btn-lien small" data-a="journal-effacer">Effacer les filtres</button></div>' : ''}
      </div>
      <div id="journal-jours" class="stack" style="gap:12px">${journalJours(visibles, auj, filtre !== 'tout' || humeur !== 'tout' || q)}</div>`;
  }
 function journalJours(visibles, auj, filtreActif) {
    if (!visibles.length) return `<section class="carte stack" style="gap:8px"><strong>Rien à afficher</strong><span class="small">${(S.journal || []).length + (S.ajouts || []).length ? `Aucune entrée ne correspond${filtreActif ? ' à ces filtres. <button class="btn-lien" data-a="journal-effacer">Tout afficher</button>' : ' à cette période.'}` : 'Notez vos repas avec « ✓ C’est mangé » dans la semaine, et vos petits-déjeuners, collations et boissons dans le carnet de la page Apports.'}</span>${(S.journal || []).length + (S.ajouts || []).length ? '' : '<div><button class="btn btn-petit btn-plein" data-a="onglet" data-k="apports">Ouvrir le carnet du jour</button></div>'}</section>`;
    return visibles.map(([d, j, lignes]) => {
      const h = humeurJour(j, d < ISO(auj));
      const titre = new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: d.slice(0, 4) !== String(auj.getFullYear()) ? 'numeric' : undefined });
      const groupes = MOMENTS_JOURNAL.map(([k, v, ic]) => [v, ic, lignes.filter((x) => x.moment === k)]).filter(([, , l]) => l.length);
      return `<article class="carte jour-journal">
        <header class="spread" style="align-items:center"><div class="row" style="gap:8px;align-items:center"><span class="smiley-jour" role="img" aria-label="${SMILEY[h][1]}">${SMILEY[h][0]}</span><h2>${esc(titre.charAt(0).toUpperCase() + titre.slice(1))}</h2></div>
          <span class="small"><strong class="num">${nb(Math.round(j.kcal))} kcal</strong> <span class="muted">· prot. ${Math.round(j.prot)} g · sucres ${Math.round(j.sucres)} g · sel ${nb(Math.round(j.sel * 10) / 10)} g</span></span></header>
        ${groupes.map(([v, ic, l]) => `<div class="groupe-journal"><span class="eyebrow">${ic} ${esc(v)}</span><ul>${l.map((x) => `<li><span class="stack" style="gap:0;min-width:0"><span>${x.r ? `<button class="btn-lien" data-a="fiche-r" data-r="${x.r}">${esc(x.nom)}</button>` : esc(x.nom)}</span><span class="small muted">${esc(x.detail)}</span></span><span class="row" style="gap:6px;align-items:center;flex-wrap:nowrap">${x.ns ? `<span class="ns-lettre ns-${x.ns}" aria-label="Nutri-Score ${x.ns}">${x.ns}</span>` : ''}<span class="small num">${x.kcal} kcal</span><button class="btn-lien small ecran-seul" ${x.suppr} aria-label="Retirer ${esc(x.nom)} du journal">✕</button></span></li>`).join('')}</ul></div>`).join('')}
        <div class="ecran-seul"><button class="btn-lien small" data-a="journal-ajouter" data-d="${d}">+ Ajouter un aliment à ce jour</button></div>
      </article>`;
    }).join('');
  }

  /* ---------- bilan nutritionnel de la semaine ---------- */
  function blocNutritionSemaine() {
    if (!S.plan || !window.Nutrition) return '';
    const b = window.Nutrition.bilanSemaine(S.plan, E.REC, E.ING);
    if (!b) return '';
    const icone = (r) => (r.etat === 'ok' ? '<span class="et-ok" aria-label="Repère atteint">✓</span>' : r.etat === 'bas' ? '<span class="et-bas" aria-label="Pas assez">↓</span>' : '<span class="et-haut" aria-label="Trop">↑</span>');
    const ligne = (r) => `<li class="rep-${r.etat}">${icone(r)}<span class="stack" style="gap:0;min-width:0;flex:1"><span><strong>${esc(r.nom)}</strong> <span class="num">${typeof r.valeur === 'number' ? nb(r.valeur) : r.valeur} ${esc(r.unite)}</span>${r.cle === 'poisson' ? ` <span class="small muted">(dont ${b.poissonGras} gras)</span>` : ''}</span><span class="small muted">Repère : ${esc(r.repere)}</span>${r.conseil ? `<span class="small conseil-nutri">${esc(r.conseil)}</span>` : ''}</span></li>`;
    const aRevoir = b.reperes.filter((r) => r.etat !== 'ok');
    const part = b.atteints / b.reperes.length;
    return `<section class="carte stack bilan-nutri" style="gap:10px" aria-label="Bilan nutritionnel de la semaine">
      <div class="spread" style="align-items:center"><h2>Bilan nutritionnel</h2><span class="score-reperes ${part >= 0.8 ? 'bon' : part >= 0.6 ? 'moyen' : 'faible'}"><strong class="num">${b.atteints}/${b.reperes.length}</strong> repères</span></div>
      <div class="chiffres-nutri"><div><span class="small muted">Énergie</span><strong class="num">${b.kcal} kcal</strong><span class="small muted">par jour</span></div>${b.reperes.filter((r) => ['prot', 'fibres', 'legumes'].includes(r.cle)).map((r) => `<div class="rep-${r.etat}"><span class="small muted">${esc(r.nom)}</span><strong class="num">${nb(r.valeur)} ${r.cle === 'legumes' ? 'g' : 'g'}</strong><span class="small muted">par jour</span></div>`).join('')}</div>
      ${aRevoir.length ? `<div class="stack" style="gap:6px"><span class="eyebrow">À améliorer</span><ul class="liste-reperes">${aRevoir.map(ligne).join('')}</ul><div><button class="btn btn-plein" data-a="ameliorer">✨ Améliorer ma semaine</button> <span class="small muted">Le coach propose de changer quelques plats.</span></div></div>` : '<p class="small" style="margin:0">✓ Tous les repères sont atteints cette semaine. Bravo !</p>'}
      <div><button class="btn btn-petit" data-a="onglet" data-k="apports">📈 Mon suivi des apports (graphiques)</button></div>
      <details><summary class="small"><strong>Voir tout le détail</strong></summary><ul class="liste-reperes" style="margin-top:8px">${b.reperes.map(ligne).join('')}</ul></details>
      <p class="small muted" style="margin:0">Pour un adulte, sur les déjeuners et dîners de la semaine${b.gourmand ? ' et les desserts ou goûters prévus' : ''}, hors petit-déjeuner. Estimation d’après les ingrédients et les repères de santé publique (PNNS), pas un avis médical.</p>
    </section>`;
  }

  // le bilan en bandeau, à gauche de l'écran sur ordinateur (sous la navigation)
  function bandeauNutri() {
    if (!S.plan || !window.Nutrition) return '';
    const b = window.Nutrition.bilanSemaine(S.plan, E.REC, E.ING);
    if (!b) return '';
    const part = b.atteints / b.reperes.length;
    const fl = (r) => (r.etat === 'ok' ? '✓' : r.etat === 'bas' ? '↓' : '↑');
    const cles = ['prot', 'fibres', 'legumes'];
    return `<section class="bandeau-nutri" aria-label="Bilan nutritionnel de la semaine">
      <div class="spread" style="align-items:center"><strong>Bilan nutritionnel</strong><span class="score-reperes ${part >= 0.8 ? 'bon' : part >= 0.6 ? 'moyen' : 'faible'}"><strong class="num">${b.atteints}/${b.reperes.length}</strong></span></div>
      <div class="mini-chiffres"><div><span>Énergie</span><strong class="num">${b.kcal}</strong><span>kcal/j</span></div>${b.reperes.filter((r) => cles.includes(r.cle)).map((r) => `<div class="rep-${r.etat}"><span>${esc(r.nom)}</span><strong class="num">${nb(r.valeur)}</strong><span>g/j</span></div>`).join('')}</div>
      ${b.reperes.some((r) => r.etat !== 'ok') ? `<ul class="mini-reperes">${b.reperes.filter((r) => r.etat !== 'ok').map((r) => `<li class="rep-${r.etat}" title="${esc(r.conseil)}"><span class="fleche">${fl(r)}</span><span>${esc(r.nom)}</span><span class="num">${typeof r.valeur === 'number' ? nb(r.valeur) : r.valeur}</span></li>`).join('')}</ul>` : '<p class="small" style="margin:0">✓ Tous les repères sont atteints.</p>'}
      ${b.atteints < b.reperes.length ? '<button class="btn btn-petit btn-plein" data-a="ameliorer">✨ Améliorer ma semaine</button>' : ''}
      <button class="btn btn-petit" data-a="bilan-ouvrir">Détails et conseils</button>
      <button class="btn btn-petit" data-a="onglet" data-k="apports">📈 Mon suivi des apports</button>
      <button class="btn btn-petit" data-a="onglet" data-k="journal">📖 Mon journal</button>
      <span class="small muted">Par adulte, déjeuners et dîners. Estimation.</span>
    </section>`;
  }
  /* coach nutrition : propositions de changements de plats */
  function lancerAmeliorations() {
    S.ameliorations = E.ameliorerSemaine(S.plan, profilSemaine(), { notes: S.notes, classiques: S.classiques, max: 4 });
    S.ameliorations.refusees = [];
  }
  function vueAmeliorer() {
    const a = S.ameliorations;
    if (!a) return '';
    const restantes = a.propositions.filter((x) => !x.fait && !x.refuse);
    const faites = a.propositions.filter((x) => x.fait).length;
    const jourTxt = (x) => `${E.JOURS[x.jour]} ${x.slot === 'diner' ? 'soir' : 'midi'}`;
    const carte = (x, k) => {
      if (x.fait || x.refuse) return '';
      const av = E.REC[x.avant], ap = E.REC[x.apres];
      return `<article class="proposition-coach">
        <span class="eyebrow">${jourTxt(x)}</span>
        <div class="echange"><div class="plat-echange avant">${V(av, 48)}<span class="small">${esc(av.nom)}</span></div><span class="fleche-echange" aria-hidden="true">→</span>
          <div class="plat-echange apres">${V(ap, 48)}<button class="titre-repas small" data-a="fiche-r" data-r="${ap.id}">${esc(ap.nom)}</button>${nutriMini(ap)}</div></div>
        <div class="row" style="gap:6px">${x.gains.map((g) => `<span class="tag tag-ok">${esc(g)}</span>`).join('')}<span class="small muted">${x.cout > 0.05 ? `+ ${euros(x.cout)}` : x.cout < -0.05 ? `− ${euros(-x.cout)} d’économie` : 'même prix'}</span></div>
        <div class="row" style="gap:8px"><button class="btn btn-petit btn-plein" data-a="ameliorer-accepter" data-k="${k}">Changer ce plat</button><button class="btn btn-petit" data-a="ameliorer-refuser" data-k="${k}">Non merci</button></div>
      </article>`;
    };
    const b = window.Nutrition.bilanSemaine(S.plan, E.REC, E.ING);
    return `<div class="voile" data-a="ameliorer-fond"><div class="fiche fenetre-ameliorer" role="dialog" aria-modal="true" aria-labelledby="am-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Coach nutrition</span><h2 id="am-titre">Améliorer ma semaine</h2></div>
        <button class="btn btn-petit" data-a="ameliorer-fermer">Fermer</button></div>
      <div class="avant-apres"><div><span class="small muted">Aujourd’hui</span><strong class="num">${b.atteints}/${b.reperes.length}</strong></div>${restantes.length ? `<span aria-hidden="true">→</span><div><span class="small muted">Avec tous les changements</span><strong class="num">${a.apres.atteints}/${a.apres.reperes.length}</strong></div>` : ''}<span class="small muted">repères atteints</span></div>
      ${a.propositions.length ? (restantes.length ? `<p class="small" style="margin:0">Je vous propose de changer ${pluriel(restantes.length, 'plat')}. Vos allergies, votre régime et vos goûts sont respectés.</p>${a.propositions.map(carte).join('')}
        <div class="row" style="gap:8px"><button class="btn btn-plein" data-a="ameliorer-tout">Tout accepter</button><button class="btn" data-a="ameliorer-encore">D’autres idées</button></div>`
        : `<p style="margin:0">${faites ? `✓ ${pluriel(faites, 'plat changé', 'plats changés')}. Votre liste de courses est à jour.` : 'C’est noté, rien n’a été changé.'}</p><div><button class="btn" data-a="ameliorer-encore">Chercher encore</button></div>`)
        : `<p style="margin:0">${b.atteints === b.reperes.length ? '✓ Votre semaine est déjà équilibrée : tous les repères sont atteints.' : 'Je n’ai pas trouvé de changement simple qui améliore la semaine sans en dégrader une autre partie. Essayez « Nouvelle semaine » ou un coach.'}</p>`}
    </div></div>`;
  }
  function vueBilan() {
    if (!S.bilanOuvert) return '';
    return `<div class="voile" data-a="bilan-fond"><div class="fiche fenetre-bilan" role="dialog" aria-modal="true" aria-label="Bilan nutritionnel">
      <div class="spread"><span class="eyebrow">Cette semaine</span><button class="btn btn-petit" data-a="bilan-fermer">Fermer</button></div>
      ${blocNutritionSemaine().replace('<details>', '<details open>')}</div></div>`;
  }

  /* ---------- coachs alimentaires ---------- */
  const COACHS = {
    minceur: {
      nom: 'Coach minceur', emoji: '🥗', court: 'Minceur',
      accroche: 'Une semaine de repas légers mais rassasiants, pour perdre du poids en douceur.',
      pour: 'Repas autour de 450 à 600 kcal, beaucoup de légumes, des protéines à chaque repas, peu de graisses saturées.',
      prudence: 'Perte de poids douce, sans régime restrictif. Pas pour les femmes enceintes ou qui allaitent, les moins de 18 ans, ni en cas de troubles du comportement alimentaire : parlez-en d’abord à votre médecin.',
      astuces: ['Remplissez la moitié de l’assiette de légumes, un quart de féculents, un quart de protéines.', 'Servez-vous une fois, puis attendez 10 minutes avant de vous resservir.', 'Buvez de l’eau à volonté ; gardez les sodas et jus pour les grandes occasions.', 'Un fruit ou un yaourt nature en collation plutôt que des biscuits.', 'Les féculents restent dans l’assiette : ils calent et évitent les fringales.', 'Préférez la cuisson vapeur, au four ou à la poêle avec une cuillère d’huile seulement.'],
      objectifs: (b) => [[`${b.kcal} kcal en moyenne par repas`, b.kcal >= 420 && b.kcal <= 600, 'objectif : 450 à 600'], [`${b.legumes} g de légumes par repas`, b.legumes >= 200, 'objectif : 200 g et plus'], [`${b.prot} g de protéines par repas`, b.prot >= 20, 'pour être rassasié']]
    },
    sportif: {
      nom: 'Coach sportif', emoji: '💪', court: 'Sportif',
      accroche: 'Des repas riches en protéines pour récupérer et construire du muscle.',
      pour: 'Environ 30 g de protéines et plus par repas, des féculents pour l’énergie, des légumes pour le reste.',
      prudence: 'Les besoins varient selon le sport, l’intensité et le poids (souvent 1,2 à 2 g de protéines par kilo et par jour pour les sportifs réguliers). Pour un objectif précis, demandez conseil à un diététicien du sport.',
      astuces: ['Un repas avec protéines et féculents dans les 2 heures après l’entraînement.', 'Hydratez-vous avant, pendant et après l’effort.', 'Collations faciles : yaourt nature, œufs durs, poignée d’amandes, banane.', 'Variez les protéines : volaille, poisson, œufs, légumineuses, tofu.', 'Les jours sans entraînement, gardez les protéines et réduisez un peu les féculents.', 'Le sommeil compte autant que l’assiette pour récupérer.'],
      objectifs: (b) => [[`${b.prot} g de protéines par repas`, b.prot >= 30, 'objectif : 30 g et plus'], [`${b.kcal} kcal en moyenne par repas`, b.kcal >= 550, 'assez d’énergie'], [`${b.poisson} repas de poisson`, b.poisson >= 1, 'au moins 1 par semaine']]
    },
    famille: {
      nom: 'Coach famille', emoji: '👨‍👩‍👧', court: 'Famille',
      accroche: 'Des plats qui plaisent aux enfants, et aux parents : fini les assiettes boudées.',
      pour: 'Les grands classiques des enfants (pâtes, gratins, poulet, omelettes, wraps…), des épices douces, des légumes glissés dans les plats, des recettes rapides.',
      prudence: 'Pour les tout-petits (moins de 3 ans), coupez finement, évitez les morceaux durs et le sel en plus, et suivez les conseils de votre pédiatre.',
      astuces: ['Faites goûter un nouveau légume plusieurs fois : il faut souvent 8 à 10 essais avant de l’aimer.', 'Laissez les enfants participer : laver, mélanger, saupoudrer le fromage, dresser.', 'Servez la sauce et les épices à part, chacun se sert.', 'Cachez les légumes dans les sauces, les gratins et les galettes.', 'Pas de plat spécial pour un seul enfant : une petite portion de tout, sans forcer.', 'Le repas en famille, sans écran, compte autant que ce qu’il y a dans l’assiette.'],
      objectifs: (b) => [[`${b.enfants} plats préférés des enfants`, b.enfants >= 6, 'objectif : 6 et plus'], [`${b.doux} repas aux épices douces`, b.doux >= 12, 'sur 14'], [`${b.legumes} g de légumes par repas`, b.legumes >= 150, 'glissés dans les plats'], [`${b.temps} min de préparation en moyenne`, b.temps <= 35, 'rapide en semaine']]
    },
    femme40: {
      nom: 'Coach femme 40 ans et +', emoji: '🌸', court: 'Femme 40 +',
      accroche: 'Une alimentation pensée pour la quarantaine et la ménopause : os, muscles, cœur et énergie.',
      pour: 'Du calcium (laitages, fromage, tofu), des protéines pour garder ses muscles, du poisson gras, des légumineuses et des fibres, moins de sel et de sucres.',
      prudence: 'Ces conseils généraux ne remplacent pas l’avis de votre médecin, en particulier en cas d’ostéoporose, de traitement hormonal, de maladie ou de bouffées de chaleur gênantes.',
      astuces: ['Visez 2 à 3 produits laitiers par jour pour le calcium (yaourt, fromage, lait).', 'Un poisson gras par semaine (saumon, sardines, maquereau) pour le cœur et la vitamine D.', 'Des légumineuses 2 à 3 fois par semaine : fibres, protéines et soja pour les bouffées de chaleur.', 'Des protéines à chaque repas pour garder vos muscles, avec 30 minutes de marche par jour.', 'Limitez le sel (pas de salière à table) et les sucres ajoutés.', 'Prenez l’air chaque jour : la lumière aide à fabriquer la vitamine D.'],
      objectifs: (b) => [[`${b.laitages} repas avec laitages ou tofu`, b.laitages >= 5, 'pour le calcium'], [`${b.poissonGras} repas de poisson gras`, b.poissonGras >= 1, 'au moins 1 par semaine'], [`${b.legumineuses} repas avec légumineuses`, b.legumineuses >= 3, 'objectif : 3 et plus'], [`${b.fibres} g de fibres par repas`, b.fibres >= 8, 'objectif : 8 g et plus']]
    }
  };
  function blocCoach() {
    const c = COACHS[S.profil.coach];
    const lienProg = S.profil.programme ? `<button class="btn btn-petit btn-plein" data-a="onglet" data-k="minceur">🥗 Mon programme minceur · semaine ${S.profil.programme.semaine || 1} →</button>` : '<button class="btn btn-petit" data-a="onglet" data-k="minceur">🥗 Programme minceur personnalisé →</button>';
    if (!c) {
      return `<section class="carte stack invite-coach" style="gap:8px"><strong>🎯 Un coach pour vos menus ?</strong><div>${lienProg}</div>
        <span class="small muted">Budgétable prépare votre semaine selon votre objectif.</span>
        <div class="row" style="gap:6px">${Object.entries(COACHS).map(([k, x]) => `<button class="chip" data-a="coach-voir" data-k="${k}">${x.emoji} ${esc(x.court)}</button>`).join('')}</div></section>`;
    }
    const b = E.bilanCoach(S.plan, S.profil);
    const semaine = Math.floor(Date.now() / 6048e5);
    const astuces = [0, 1].map((k) => c.astuces[(semaine * 2 + k) % c.astuces.length]);
    return `<section class="carte stack coach-actif" style="gap:10px">
      <div class="spread"><strong>${c.emoji} ${esc(c.nom)}</strong><button class="btn-lien small" data-a="coach-voir" data-k="${S.profil.coach}">Changer</button></div>
      ${S.profil.coach === 'minceur' ? `<div>${lienProg}</div>` : ''}
      ${b ? `<ul class="objectifs-coach">${c.objectifs(b).map(([txt, ok, cible]) => `<li class="${ok ? 'ok' : 'a-voir'}"><span aria-hidden="true">${ok ? '✓' : '•'}</span><span><strong>${esc(txt)}</strong> <span class="small muted">${esc(cible)}</span></span></li>`).join('')}</ul>` : ''}
      <div class="stack" style="gap:4px"><span class="eyebrow">Les conseils de la semaine</span>${astuces.map((a) => `<span class="small">💡 ${esc(a)}</span>`).join('')}</div>
      <span class="small muted">Estimations par portion adulte, déjeuners et dîners.${S.profil.foyer.enfants.length ? ' Les menus restent bons pour toute la famille : adaptez seulement vos portions.' : ''}</span>
    </section>`;
  }
  function vueCoach() {
    if (!S.coachVoir) return '';
    const k = S.coachVoir, c = COACHS[k];
    const actif = S.profil.coach === k;
    return `<div class="voile" data-a="coach-fond"><div class="fiche fenetre-coach" role="dialog" aria-modal="true" aria-labelledby="coach-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Coach alimentaire</span><h2 id="coach-titre">Choisir un coach</h2></div>
        <button class="btn btn-petit" data-a="coach-fermer">Fermer</button></div>
      <div class="row" role="tablist" style="gap:6px">${Object.entries(COACHS).map(([kk, x]) => `<button class="chip" role="tab" data-a="coach-voir" data-k="${kk}" aria-selected="${kk === k}" aria-pressed="${kk === k}">${x.emoji} ${esc(x.court)}</button>`).join('')}</div>
      <div class="stack coach-detail" style="gap:10px">
        <h3>${c.emoji} ${esc(c.nom)}</h3>
        <p style="margin:0">${esc(c.accroche)}</p>
        <p class="small" style="margin:0"><strong>Dans vos menus :</strong> ${esc(c.pour)}</p>
        <ul class="small astuces-coach">${c.astuces.slice(0, 4).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        <p class="small prudence-coach">${esc(c.prudence)}</p>
      </div>
      ${actif ? `<div class="row" style="gap:8px"><button class="btn btn-plein" data-a="coach-semaine" data-k="${k}">Refaire une semaine ${esc(c.court.toLowerCase())}</button><button class="btn" data-a="coach-arreter">Arrêter le coach</button></div>`
        : `<button class="btn btn-plein btn-grand" data-a="coach-semaine" data-k="${k}">Préparer ma semaine avec le ${esc(c.nom.toLowerCase())}</button>`}
    </div></div>`;
  }

  /* ---------- grignotages gourmands ---------- */
  function definirGourmand() {
    if (!window.Gourmand) return;
    E.definirGourmand(window.Gourmand.INGREDIENTS, window.Gourmand.RECETTES.concat(window.PetitDej ? window.PetitDej.RECETTES : [], (S.gourmandPerso || []).map((x) => ({ ...x, perso: true }))));
    if (window.Saison && E.definirSaison) {
      if (window.Nutrition) for (const [k, v] of Object.entries(window.Saison.NUTRITION)) if (!window.Nutrition.TABLE[k]) window.Nutrition.TABLE[k] = v;
      E.definirSaison(window.Saison.INGREDIENTS, window.Saison.RECETTES);
      E.saisonActives(S.saisonGardees);
    }
  }
  const nbFoyer = () => Math.max(1, (S.profil.foyer.adultes || 1) + (S.profil.foyer.enfants || []).length);
  function carteGourmande(r) {
    const c = E.recetteCompatible(r, S.profil);
    const dejaN = S.plan ? S.plan.jours.reduce((n, jp) => n + (jp.gourmand || []).filter((g) => g.recette === r.id).length, 0) : 0;
    return `<article class="carte-gourmande ${c.ok ? '' : 'incompatible'}">
      <button class="vignette-g" data-a="fiche-g" data-r="${r.id}" aria-label="Voir la recette : ${esc(r.nom)}">${V(r, 72)}</button>
      <div class="stack" style="gap:3px;min-width:0;flex:1">
        <button class="titre-repas" data-a="fiche-g" data-r="${r.id}">${esc(r.nom)}</button>
        <span class="small muted">${r.type === 'petitdej' ? (r.tags || []).filter((t) => TAGS_PD[t]).map((t) => TAGS_PD[t]).slice(0, 2).join(' · ') || 'Petit-déjeuner' : r.type === 'dessert' ? 'Dessert' : 'Goûter'} · ${r.temps} min · <span class="num">${euros(E.coutPortion(r))}</span> la part${r.perso ? ' · <span class="tag tag-ok">à moi</span>' : ''}</span>
        <span>${nutriMini(r)}</span>
        ${c.ok ? '' : `<span class="small alerte-ing">${esc(libAllergie(c.raison))}</span>`}
        <div class="row" style="gap:6px;margin-top:4px"><button class="btn btn-petit ${c.ok ? 'btn-plein' : ''}" data-a="gourmand-ajouter" data-r="${r.id}">${dejaN ? `✓ Ajouté (${dejaN}) · encore` : '+ Ajouter à ma semaine'}</button></div>
      </div></article>`;
  }
  function vueAjoutGourmand() {
    const a = S.gourmandAjout;
    if (!a || !E.REC[a.id]) return '';
    const r = E.REC[a.id];
    return `<div class="voile" data-a="gourmand-fond"><div class="fiche fenetre-gourmand" role="dialog" aria-modal="true" aria-labelledby="g-titre">
      <div class="spread" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px"><span class="eyebrow">Ajouter à ma semaine</span><h2 id="g-titre">${r.emoji} ${esc(r.nom)}</h2></div>
        <button class="btn btn-petit" data-a="gourmand-fermer">Fermer</button></div>
      <div class="stack" style="gap:8px"><strong>Quels jours ?</strong>
        <div class="row" style="gap:6px">${ordreJours().map((j) => `<button class="chip" data-a="gourmand-jour" data-j="${j}" aria-pressed="${a.jours.includes(j)}">${E.JOURS[j].slice(0, 3)}.</button>`).join('')}</div>
        <div class="row" style="gap:6px"><button class="btn-lien small" data-a="gourmand-jours" data-k="semaine">Du lundi au vendredi</button><button class="btn-lien small" data-a="gourmand-jours" data-k="weekend">Le week-end</button><button class="btn-lien small" data-a="gourmand-jours" data-k="tous">Tous les jours</button></div></div>
      ${r.type === 'petitdej' ? '' : `<div class="stack" style="gap:8px"><strong>Pour</strong>
        <div class="row" style="gap:6px" role="radiogroup">${[['gouter', 'Le goûter'], ['dessert', 'Le dessert']].map(([k, v]) => `<button class="chip" role="radio" data-a="gourmand-moment" data-k="${k}" aria-checked="${a.moment === k}" aria-pressed="${a.moment === k}">${v}</button>`).join('')}</div></div>`}
      <div class="row" style="gap:8px;align-items:center"><strong>${r.type === 'petitdej' ? 'Pour combien de personnes ?' : 'Combien de parts ?'}</strong>
        <button class="btn btn-petit" data-a="gourmand-parts" data-d="-1" aria-label="Une part de moins" ${a.parts <= 1 ? 'disabled' : ''}>−</button><strong class="num" id="g-parts">${a.parts}</strong><button class="btn btn-petit" data-a="gourmand-parts" data-d="1" aria-label="Une part de plus">+</button>
        <span class="small muted">${r.type === 'petitdej' ? '' : a.parts === r.parts ? 'la recette entière' : `recette prévue pour ${r.parts}`}</span></div>
      <p class="small">${a.jours.length ? `${pluriel(a.jours.length, 'fois')} · environ <strong class="num">${euros(E.coutPortion(r) * a.parts * a.jours.length)}</strong> ajoutés à vos courses` : 'Choisissez au moins un jour.'}</p>
      <button class="btn btn-plein btn-grand" data-a="gourmand-valider" ${a.jours.length ? '' : 'disabled'}>Ajouter à ma semaine et à mes courses</button>
    </div></div>`;
  }
  const lignesGourmandes = (jp, matin) => (jp.gourmand || []).filter((g) => E.REC[g.recette] && (g.moment === 'petitdej') === matin).map((g) => `<button class="ligne-gourmande" data-a="fiche-g" data-r="${g.recette}" data-n="${g.portions}"><span aria-hidden="true">${E.REC[g.recette].emoji}</span> ${momentLib(g.moment)} : ${esc(E.REC[g.recette].nom)}</button>`).join('');
  const TAGS_PD = { equilibre: 'Équilibré', sportif: 'Sportif', gourmand: 'Gourmand', sale: 'Salé', express: 'Express', enfants: 'Enfants' };
  const momentLib = (m) => (m === 'petitdej' ? 'Petit-déj' : m === 'gouter' ? 'Goûter' : 'Dessert');
  const basculeGourmand = (k) => `<div class="bascule-g" role="group" aria-label="Page"><button class="chip" data-a="onglet" data-k="petitdej" aria-pressed="${k === 'petitdej'}">🥐 Petits-déjeuners</button><button class="chip" data-a="onglet" data-k="gourmand" aria-pressed="${k === 'gourmand'}">🍰 Desserts et goûters</button></div>`;
  function ongletPetitDej() {
    const toutes = E.gourmandises().filter((r) => r.type === 'petitdej');
    const f = S.filtrePD || 'tout';
    const liste = toutes.filter((r) => f === 'tout' || (r.tags || []).includes(f)).sort((a, b) => (E.recetteCompatible(b, S.profil).ok - E.recetteCompatible(a, S.profil).ok) || (E.scoreGout(b, S.profil.gouts) - E.scoreGout(a, S.profil.gouts)) || a.nom.localeCompare(b.nom, 'fr'));
    const semaine = S.plan ? S.plan.jours.flatMap((jp, j) => (jp.gourmand || []).map((g, k) => ({ ...g, j, k }))).filter((g) => E.REC[g.recette] && g.moment === 'petitdej') : [];
    const cout = semaine.reduce((t, g) => t + E.coutPortion(E.REC[g.recette]) * g.portions, 0);
    const filtres = [['tout', 'Tout'], ['equilibre', 'Équilibrés'], ['sportif', 'Sportifs'], ['gourmand', 'Gourmands'], ['sale', 'Salés'], ['express', 'Express (5 min)'], ['enfants', 'Pour les enfants']];
    const conseils = { equilibre: 'Un petit-déjeuner équilibré : un produit céréalier (pain complet, flocons), un laitage, un fruit, et une boisson.', sportif: 'Les jours de sport : des protéines (œufs, skyr, fromage blanc) et des glucides lents (avoine, pain complet), 1 h 30 à 2 h avant la séance.', gourmand: 'Le plaisir compte aussi : gardez les plus gourmands pour le week-end, avec un fruit à côté.', sale: 'Le salé tient bien jusqu’à midi : œufs, fromage, jambon, avec du pain complet.', express: 'Moins de 5 minutes, ou préparé la veille (overnight oats, pudding de chia).', enfants: 'Pour les enfants : un laitage, un fruit et du pain ou des céréales peu sucrées.' };
    return `${basculeGourmand('petitdej')}
      <div class="ardoise-matin"><span class="small">Bien commencer la journée</span><h1>Petits-déjeuners</h1><span class="small">équilibrés, sportifs, gourmands ou salés, à petit prix</span></div>
      <p class="muted">Choisissez vos petits-déjeuners de la semaine : leurs ingrédients rejoignent la liste de courses, comme les repas.</p>
      <section class="carte stack" style="gap:8px"><div class="spread"><h2>Cette semaine</h2>${semaine.length ? `<span class="small muted">environ <strong class="num">${euros(cout)}</strong></span>` : ''}</div>
        ${semaine.length ? `<ul class="liste-gourmande">${Object.values(semaine.reduce((acc, g) => { (acc[g.recette] = acc[g.recette] || []).push(g); return acc; }, {})).map((gs) => { const g = gs[0], jours = gs.map((x) => x.j); const lib = jours.length === 7 ? 'Tous les jours' : jours.join() === '0,1,2,3,4' ? 'Du lundi au vendredi' : jours.join() === '5,6' ? 'Le week-end' : jours.map((j) => E.JOURS[j].slice(0, 3) + '.').join(' '); return `<li><span aria-hidden="true">${E.REC[g.recette].emoji}</span><button class="btn-lien" data-a="fiche-g" data-r="${g.recette}" data-n="${g.portions}">${esc(E.REC[g.recette].nom)}</button><span class="small muted">${lib} · ${pluriel(g.portions, 'personne')}</span><button class="btn-lien small" data-a="pd-retirer" data-r="${g.recette}" aria-label="Retirer ${esc(E.REC[g.recette].nom)} de la semaine">Retirer</button></li>`; }).join('')}</ul>`
          : '<p class="small muted" style="margin:0">Rien de prévu pour l’instant. Un bol fromage blanc et fruits rouges en semaine, des pancakes le dimanche ?</p>'}
      </section>
      <div class="row filtres-g" role="group" aria-label="Filtrer">${filtres.map(([k, v]) => `<button class="chip" data-a="pd-filtre" data-k="${k}" aria-pressed="${f === k}">${v}</button>`).join('')}</div>
      ${conseils[f] ? `<p class="small bandeau bandeau-info" style="margin:0"><span>💡 ${conseils[f]}</span></p>` : ''}
      <div class="grille-gourmande">${liste.map(carteGourmande).join('') || '<p class="small muted">Aucun petit-déjeuner dans ce filtre.</p>'}</div>`;
  }
  function ongletGourmand() {
    const toutes = E.gourmandises().filter((r) => r.type !== 'petitdej');
    const f = S.filtreGourmand || 'tout';
    const garde = (r) => f === 'tout' || (f === 'express' ? r.temps <= 15 : f === 'enfants' ? (r.tags || []).includes('enfants') : f === 'miennes' ? r.perso : r.type === f);
    const liste = toutes.filter(garde).sort((a, b) => (b.perso - a.perso) || (E.recetteCompatible(b, S.profil).ok - E.recetteCompatible(a, S.profil).ok) || a.nom.localeCompare(b.nom, 'fr'));
    const semaine = S.plan ? S.plan.jours.flatMap((jp, j) => (jp.gourmand || []).map((g, k) => ({ ...g, j, k }))).filter((g) => E.REC[g.recette] && g.moment !== 'petitdej') : [];
    const cout = semaine.reduce((t, g) => t + E.coutPortion(E.REC[g.recette]) * g.portions, 0);
    const filtres = [['tout', 'Tout'], ['gouter', 'Goûters'], ['dessert', 'Desserts'], ['express', 'Express'], ['enfants', 'Pour les enfants']].concat(S.gourmandPerso.length ? [['miennes', 'Les miennes']] : []);
    return `${basculeGourmand('gourmand')}<div class="ardoise ardoise-titre"><span class="craie-petit">Fait maison, petit prix</span><h1 class="craie">Grignotages gourmands</h1><span class="craie-ligne">desserts et goûters de la semaine</span></div>
      <p class="muted">Ajoutez des desserts et des goûters à votre semaine : leurs ingrédients rejoignent la liste de courses, comme les repas.</p>
      <section class="carte stack" style="gap:8px"><div class="spread"><h2>Cette semaine</h2>${semaine.length ? `<span class="small muted">environ <strong class="num">${euros(cout)}</strong></span>` : ''}</div>
        ${semaine.length ? `<ul class="liste-gourmande">${semaine.map((g) => `<li><span aria-hidden="true">${E.REC[g.recette].emoji}</span><button class="btn-lien" data-a="fiche-g" data-r="${g.recette}" data-n="${g.portions}">${esc(E.REC[g.recette].nom)}</button><span class="small muted">${E.JOURS[g.j]} · ${momentLib(g.moment).toLowerCase()} · ${pluriel(g.portions, 'part')}</span><button class="btn-lien small" data-a="gourmand-retirer" data-j="${g.j}" data-k="${g.k}" aria-label="Retirer ${esc(E.REC[g.recette].nom)} du ${E.JOURS[g.j].toLowerCase()}">Retirer</button></li>`).join('')}</ul>`
          : '<p class="small muted" style="margin:0">Rien de prévu pour l’instant. Un gâteau au yaourt pour le goûter de mercredi ?</p>'}
      </section>
      <div class="row filtres-g" role="group" aria-label="Filtrer">${filtres.map(([k, v]) => `<button class="chip" data-a="gourmand-filtre" data-k="${k}" aria-pressed="${f === k}">${v}</button>`).join('')}</div>
      <div class="grille-gourmande">${liste.map(carteGourmande).join('') || '<p class="small muted">Aucune gourmandise dans ce filtre.</p>'}</div>
      <section class="carte stack" style="gap:8px"><h2>Votre recette à vous</h2>
        <p class="small muted" style="margin:0">Le gâteau de mamie, les cookies d’un blog… Collez un lien ou écrivez le nom : les ingrédients se mettent tout seuls.</p>
        <div><button class="btn btn-plein" data-a="ed-nouveau-g">+ Ajouter un dessert ou un goûter</button></div></section>`;
  }

  /* ---------- rendu ---------- */
  function rendre() {
    const partagee = lireListePartagee();
    if (partagee) { document.getElementById('app').innerHTML = vueListePartagee(partagee); return; }
    document.documentElement.classList.toggle('imprimable', S.imprimable && S.vue === 'app' && S.onglet === 'courses');
    const app = document.getElementById('app');
    if (S.vue === 'test' && !S.test) S.vue = S.plan ? 'app' : 'profil';
    if (S.plan) { S.plan.debut = debutSemaine(); appliquerVersions(S.plan); E.organiserRestes(S.plan, S.profil); }
    const html = { accueil: vueAccueil, questionnaire: vueQuestionnaire, profil: vueProfilValidation, app: vueApp, test: vueTest }[S.vue]();
    const avantEd = document.querySelector('.fenetre-edition');
    const hautEd = avantEd ? avantEd.scrollTop : 0;
    const avant = document.querySelector('.fiche');
    const haut = avant ? avant.scrollTop : 0;
    const memeFiche = avant && avant.dataset.cle === cleFiche();
    app.innerHTML = html + vueChoix() + vueCourses() + vueAuMenu() + vueFiche() + vueEdition() + vueAjoutGourmand() + vueCoach() + vueBudget() + vuePresence() + vueBilan() + vueAmeliorer() + vueCalcKcal() + vueAffiche() + vueGamelles() + vueEnvoi() + vueCompte() + vueProspectus() + vueAideInstall() + vueSeance() + vueDeplacer() + vueTicket();
    if (document.getElementById('scene-cuisine')) monter3D();
    const modeAffiche = !!(S.afficheOuverte && S.plan && S.vue === 'app');
    document.documentElement.classList.toggle('mode-affiche', modeAffiche);
    // format de page réservé à l'affiche (la liste de courses et le journal gardent le format portrait)
    let pageAff = document.getElementById('page-affiche');
    if (modeAffiche && !pageAff) { pageAff = document.createElement('style'); pageAff.id = 'page-affiche'; pageAff.textContent = '@page { size: A4 landscape; margin: 0; }'; document.head.appendChild(pageAff); }
    if (!modeAffiche && pageAff) pageAff.remove();
    ajusterAffiche();
    const apres = document.querySelector('.fiche');
    if (apres && memeFiche) apres.scrollTop = haut;
    const apresEd = document.querySelector('.fenetre-edition');
    if (apresEd && avantEd) apresEd.scrollTop = hautEd;
    const fil = document.querySelector('.fiche .chat');
    if (fil) fil.scrollTop = fil.scrollHeight;
    sauver();
  }

  function nouvellePlanification() {
    if (S.plan) S.tourEnfant++;
    const gardees = S.plan ? S.plan.jours.map((jp) => jp.gourmand || []) : null;
    const manuelsGardes = S.plan && S.plan.manuels ? S.plan.manuels : null;
    S.plan = E.genererSemaine(S.profil, { seed: Math.floor(Math.random() * 1e9), notes: S.notes, classiques: S.classiques });
    if (gardees) S.plan.jours.forEach((jp, j) => { if (gardees[j] && gardees[j].length) jp.gourmand = gardees[j].filter((g) => E.REC[g.recette]); });
    if (manuelsGardes && manuelsGardes.length) S.plan.manuels = manuelsGardes;
    S.coches = {};
    S.ranges = {};
    S.planDu = ISO(new Date());
    retirerRepasPasses();
    S.planAvantRefaire = null;
    S.deduits = {};
    S.modeCourses = null;
    S.ceSoirOuvert = false;
  }

  /**
   * Refaire les plats de la semaine : de nouveaux plats sur les mêmes jours, en gardant ce qui est déjà mangé ou pris dehors,
   * les repas choisis à la main (ou par les enfants), les repas passés, les desserts, petits-déjeuners et produits ajoutés.
   */
  function refairePlats() {
    if (!S.plan) return 0;
    const avant = JSON.parse(JSON.stringify(S.plan));
    const neuf = E.genererSemaine(S.profil, { seed: Math.floor(Math.random() * 1e9), notes: S.notes, classiques: S.classiques });
    const t = aujourdhui(), h = new Date().getHours();
    const garde = [];
    let n = 0;
    const jours = S.plan.jours.map((jp, j) => {
      const x = { ...jp };
      for (const sl of E.SLOTS) {
        const k = j + '-' + sl, m = jp[sl];
        const passe = posJour(j) < posJour(t) || (j === t && (sl === 'dejeuner' ? h >= 14 : h >= 21));
        if ((jp.passes || []).includes(sl) || !m) continue;
        if (S.deduits[k] || m.choisi || m.choisiPar || m.dehors || passe) { garde.push(k); continue; }
        const nm = neuf.jours[j][sl];
        if (nm && E.REC[nm.recette]) { x[sl] = { ...nm, portions: m.portions }; n++; }
      }
      delete x.gamelleRecette;
      return x;
    });
    let plan = { ...S.plan, jours, seed: neuf.seed, remplacements: (S.plan.remplacements || 0) + 1 };
    plan = E.dedoublonner(plan, S.profil, { verrous: garde, notes: S.notes, classiques: S.classiques }).plan;
    S.plan = plan;
    S.planAvantRefaire = avant;
    S.ceSoirOuvert = false;
    return n;
  }
  function allerQuestion(id) {
    const qs = questionsActives(S.profil);
    S.etape = Math.max(0, qs.findIndex((q) => q.id === id));
    S.edition = true;
    S.vue = 'questionnaire';
  }

  /** Provisions déclarées au questionnaire → rangées dans le placard (une seule fois chacune, avec un paquet). */
  function rangerProvisions(p) {
    const voulus = [...new Set([...(p.provisions || []), ...(p.placardBase ? E.PLACARD_BASE : [])])].filter((id) => E.ING[id] && !E.ING[id].perso);
    const deja = new Set(p.provisionsRangees || []);
    const st = p.stock || {};
    const ajouts = voulus.filter((id) => !deja.has(id) && !(st[id] > 0)).map((id) => [id, E.ING[id].cond]);
    if (ajouts.length) p.stock = E.ajouterAuStock(p.stock, ajouts);
    p.provisionsRangees = [...new Set([...deja, ...voulus])];
    return ajouts.length;
  }
  function suivant() {
    const qs = questionsActives(S.profil);
    const q = qs[S.etape];
    if (q.id === 'provisions') { const n = rangerProvisions(S.profil); if (n) toast(`${pluriel(n, 'produit rangé', 'produits rangés')} dans votre placard`); }
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
    if ((a === 'fermer-fond' || a === 'fermer-choix-fond' || a === 'courses-fond' || a === 'edition-fond' || a === 'au-menu-fond' || a === 'gourmand-fond' || a === 'coach-fond' || a === 'budget-fond' || a === 'presence-fond' || a === 'bilan-fond' || a === 'ameliorer-fond' || a === 'kcal-fond' || a === 'deplacer-fond' || a === 'ticket-fond') && ev.target !== el) return;
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
      case 'onglet': S.onglet = el.dataset.k; S.imprimable = false; S.afficheOuverte = false; window.scrollTo(0, 0); break;
      case 'm-libre': { const m = S.plan.jours[+el.dataset.j][el.dataset.s]; if (!m) return; m.libre = !m.libre; toast(m.libre ? 'Repas libre : part normale pour vous, sans le coach' : 'Le coach minceur s’applique à nouveau à ce repas'); break; }
      case 'm-semaine-case': if (p.programme) { p.programme.dansSemaine = el.checked; toast(el.checked ? 'Coach appliqué à vos plats de la semaine' : 'Coach retiré de vos plats de la semaine'); } break;
      case 'm-semaine': { const pr = p.programme; if (!pr) return; pr.dansSemaine = pr.dansSemaine === false; toast(pr.dansSemaine ? '🥗 Coach minceur ajouté à vos plats de la semaine' : 'Coach minceur retiré de la semaine : vos plats et vos courses redeviennent normaux'); break; }
      case 'demarrer-auj': {
        // les jours déjà passés deviennent les derniers de la nouvelle semaine : on les remet à zéro (mangé, placard)
        const pt = posJour(aujourdhui());
        const repasses = ordreJours().slice(0, pt);
        repasses.forEach((j) => E.SLOTS.forEach((sl) => { delete S.deduits[j + '-' + sl]; const m = S.plan.jours[j][sl]; if (m) { delete m.mange; } }));
        S.planDu = ISO(new Date());
        retirerRepasPasses();
        toast(`Votre semaine commence aujourd’hui, ${E.JOURS[aujourdhui()].toLowerCase()}`);
        break;
      }
      case 'ticket-ouvrir': S.ticket = { etape: 'source', type: 'magasin', enseigne: '', lignes: [], ranger: true, utiliser: true, coller: false, texte: '', prevus: produitsPrevus() }; S.ticketCherche = null; break;
      case 'ticket-fermer': case 'ticket-fond': if (S.ticket && S.ticket.lecture) return; S.ticket = null; S.ticketCherche = null; break;
      case 'ticket-type': S.ticket.type = el.dataset.k; break;
      case 'ticket-enseigne': S.ticket.enseigne = el.dataset.k; break;
      case 'ticket-coller': S.ticket.coller = true; S.ticket.erreur = ''; break;
      case 'ticket-saisir': S.ticket.lignes = [{ libelle: '', prix: 0, qte: 1, id: null }]; S.ticket.etape = 'lignes'; break;
      case 'ticket-analyser': { const z = document.getElementById('ticket-texte'); const txt = z ? z.value : ''; S.ticket.texte = txt; const r = TK.analyser(txt); if (!r.lignes.length) { S.ticket.erreur = 'Aucun article trouvé dans ce texte : vérifiez qu’il contient les libellés et les prix.'; break; } if (r.enseigne) S.ticket.enseigne = r.enseigne.id; if (/drive|commande|livraison|retrait/i.test(txt)) S.ticket.type = 'drive'; preparerLignes(r); break; }
      case 'ticket-produit': S.ticketCherche = +el.dataset.i; setTimeout(() => { const c = document.getElementById('ticket-cherche'); if (c) { c.value = (S.ticket.lignes[+el.dataset.i].libelle || '').toLowerCase().replace(/[^a-zà-ÿ ]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' '); c.dispatchEvent(new Event('input', { bubbles: true })); c.focus(); } }, 30); break;
      case 'ticket-choisir': { const i = +el.dataset.i; S.ticket.lignes[i].id = el.dataset.id || null; S.ticket.lignes[i].ignore = false; S.ticketCherche = null; break; }
      case 'ticket-ignorer': S.ticket.lignes[+el.dataset.i].ignore = el.checked; break;
      case 'ticket-imprevu-placard': S.ticket.imprevusPlacard = { ...(S.ticket.imprevusPlacard || {}), [el.dataset.i]: el.checked }; return;
      case 'ticket-voir-texte': S.ticket.voirTexte = !el.parentElement.open; return;
      case 'ticket-relire': { const z = document.getElementById('ticket-texte-lu'); if (!z) return; S.ticket.texte = z.value; const r = TK.analyser(z.value); if (!r.lignes.length) { toast('Aucun article trouvé dans ce texte'); return; } preparerLignes(r); S.ticket.voirTexte = true; toast(`${pluriel(r.lignes.length, 'article lu', 'articles lus')}`); break; }
      case 'ticket-ajout-ligne': S.ticket.lignes.push({ libelle: '', prix: 0, qte: 1, id: null }); break;
      case 'ticket-ranger': S.ticket.ranger = el.checked; return;
      case 'ticket-utiliser': S.ticket.utiliser = el.checked; return;
      case 'ticket-enregistrer': enregistrerTicket(); toast('Prix enregistrés'); break;
      case 'magasin-actif': S.magasinActif = el.dataset.k; appliquerPrixMagasin(); toast(el.dataset.k ? `Vos menus et votre liste utilisent les prix de ${S.prixMagasins[el.dataset.k].nom}` : 'Retour aux prix de démonstration'); break;
      case 'deplacer': S.deplacer = { j: +el.dataset.j, s: el.dataset.s }; S.menuRepas = null; break;
      case 'deplacer-fermer': case 'deplacer-fond': S.deplacer = null; break;
      case 'deplacer-vers': {
        const d = S.deplacer; if (!d) return;
        const j2 = +el.dataset.j, s2 = el.dataset.s;
        const a = S.plan.jours[d.j][d.s], b = S.plan.jours[j2][s2];
        if (!a) { S.deplacer = null; break; }
        // chaque créneau garde son nombre de convives ; le plat déplacé n'est plus « des restes »
        const pa = a.portions, pb = b ? b.portions : E.portions(S.profil, j2, s2) || pa;
        const nettoie = (m, portions) => { const x = { ...m, portions }; delete x.deRestes; delete x.recetteAvant; delete x.plus; delete x.extra; delete x.theme; x.choisi = true; return x; };
        S.plan.jours[j2][s2] = nettoie(a, pb);
        S.plan.jours[d.j][d.s] = b ? nettoie(b, pa) : null;
        S.deplacer = null;
        toast(b ? `${E.REC[a.recette].nom} et ${E.REC[b.recette].nom} échangés` : `${E.REC[a.recette].nom} déplacé au ${E.JOURS[j2].toLowerCase()} ${s2 === 'diner' ? 'soir' : 'midi'}`);
        break;
      }
      case 'refaire-plats': {
        if (S.sensibleNonEnregistre) { allerQuestion('allergies'); break; }
        const n = refairePlats();
        toast(n ? `${pluriel(n, 'plat refait', 'plats refaits')} ; la liste de courses suit` : 'Tous les repas de la semaine sont déjà mangés ou choisis');
        break;
      }
      case 'refaire-annuler': if (S.planAvantRefaire) { S.plan = S.planAvantRefaire; S.planAvantRefaire = null; toast('Plats d’avant remis'); } break;
      case 'refaire-ok': S.planAvantRefaire = null; break;
      case 'nouvelle':
        if (S.sensibleNonEnregistre) { allerQuestion('allergies'); break; }
        nouvellePlanification(); toast('Nouvelle semaine créée'); break;
      case 'changer': {
        if (S.sensibleNonEnregistre) { allerQuestion('allergies'); break; }
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
      case 'fermer': case 'fermer-fond': fiche = null; edPlat = null; break;
      case 'mange': {
        const k = el.dataset.j + '-' + el.dataset.s;
        const m = S.plan.jours[+el.dataset.j][el.dataset.s];
        if (!m) return;
        const avant = { ...(p.stock || {}) };
        p.stock = E.retirerDuStock(p.stock, E.consommationRepas(m));
        S.retraits = S.retraits || {};
        S.retraits[k] = Object.keys(avant).map((id) => [id, avant[id] - ((p.stock || {})[id] || 0)]).filter(([, q]) => q > 0);
        S.deduits[k] = 'cuisine';
        noterJournal(+el.dataset.j, el.dataset.s, m.recette, true);
        toast('Bon appétit ! Placard et suivi mis à jour. Dites-nous si vous avez aimé');
        break;
      }
      case 'dehors': {
        const j = +el.dataset.j, sl = el.dataset.s, k = j + '-' + sl;
        const m = S.plan.jours[j][sl];
        if (!m) return;
        m.dehors = true; S.deduits[k] = 'dehors';
        noterJournal(j, sl, null, false);
        toast('Noté : ce plat ne compte pas (placard, courses et suivi)');
        break;
      }
      case 'dehors-annuler': {
        const j = +el.dataset.j, sl = el.dataset.s;
        const m = S.plan.jours[j][sl];
        if (m) delete m.dehors;
        delete S.deduits[j + '-' + sl];
        toast('Annulé : le plat compte de nouveau');
        break;
      }
      case 'dehors-noter': S.onglet = 'apports'; S.jourCarnet = dateDuJour(+el.dataset.j); S.momentCarnet = 'dehors'; window.scrollTo(0, 0); setTimeout(() => { const c = document.querySelector('.ajout-carnet'); if (c) c.scrollIntoView({ block: 'center' }); }, 60); break;
      case 'mange-annuler': {
        const k = el.dataset.j + '-' + el.dataset.s;
        const m = S.plan.jours[+el.dataset.j][el.dataset.s];
        if (m && S.deduits[k] === 'cuisine' && S.retraits && S.retraits[k]) p.stock = E.ajouterAuStock(p.stock, S.retraits[k]);
        if (S.retraits) delete S.retraits[k];
        delete S.deduits[k];
        noterJournal(+el.dataset.j, el.dataset.s, null, false);
        toast('Annulé : le placard est revenu comme avant');
        break;
      }
      case 'avis': {
        const n = +el.dataset.n, id = el.dataset.r;
        const avant = S.notes[id];
        S.notes[id] = n;
        if (avant !== n) p.gouts = E.apprendre(p.gouts, id, n >= 5 ? 'adore' : n === 4 ? 'pourquoi' : n <= 2 ? 'non' : '');
        if (n === 5 && !S.classiques.includes(id)) S.classiques.push(id);
        if (n <= 2) S.classiques = S.classiques.filter((x) => x !== id);
        toast(n >= 5 ? 'Noté ! Ce plat et ses saveurs reviendront plus souvent ♥' : n === 4 ? 'Noté : on garde ce genre de plat' : n === 3 ? 'Noté' : 'Noté : ce plat ne sera plus proposé, et on évite ce style');
        break;
      }
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
        if (S.classiques.includes(id)) { S.classiques = S.classiques.filter((x) => x !== id); toast('Retiré de vos favoris'); }
        else { S.classiques.push(id); toast('⭐ Ajouté à vos favoris : il reviendra régulièrement dans vos menus'); }
        break;
      }
      case 'choix': ouvrirChoix(+el.dataset.j, el.dataset.s, el.dataset.enfants === '1'); break;
      case 'saisir-plat': ouvrirEdition({ nom: choix.recherche || '', slot: choix.slot, placer: { jour: choix.jour, slot: choix.slot } }); break;
      case 'ed-nouveau': ouvrirEdition({}); break;
      case 'ed-modifier': ouvrirEdition({ id: el.dataset.r }); fiche = null; break;
      case 'ed-lire': lireLien(); return;
      case 'ed-photo-retirer': edition.photo = null; edition.photoSource = ''; break;
      case 'ed-photo': return;
      case 'ed-pers': edition.personnes = Math.max(1, Math.min(30, (edition.personnes || 4) + +el.dataset.d)); break;
      case 'ed-deviner':
        if (edition.etape === 'nom' && lienValide(edition.lien) && !(edition.lecture && edition.lecture.lien === edition.lien.trim())) { lireLien(); return; }
        if (edition.nom.trim().length < 2 && lienValide(edition.lien)) edition.nom = window.Saisie.nomDepuisLien(edition.lien);
        if (edition.nom.trim().length < 2) { toast('Écrivez d’abord le nom du plat'); return; }
        devinerEdition(); break;
      case 'ed-enregistrer': if (!enregistrerEdition()) return; break;
      case 'edition-fermer': case 'edition-fond': edition = null; break;
      case 'recette-suppr': {
        const r = S.bibliotheque.find((x) => x.id === el.dataset.r);
        if (!r) return;
        if (S.plan && S.plan.jours.some((jp) => E.SLOTS.some((sl) => jp[sl] && jp[sl].recette === r.id))) { toast('Ce plat est au menu cette semaine : changez-le d’abord, puis supprimez-le'); return; }
        if (S.confirmerSupprRecette !== r.id) { S.confirmerSupprRecette = r.id; toast(`Touchez encore « Supprimer » pour effacer « ${r.nom} »`); return; }
        S.bibliotheque = S.bibliotheque.filter((x) => x.id !== r.id); S.confirmerSupprRecette = null;
        S.classiques = S.classiques.filter((x) => x !== r.id);
        E.definirPerso(S.bibliotheque); toast('Recette supprimée'); break;
      }
      case 'au-menu': auMenu = { id: el.dataset.r }; break;
      case 'au-menu-fermer': case 'au-menu-fond': auMenu = null; break;
      case 'au-menu-placer': S.plan = E.placerRecette(S.plan, +el.dataset.j, el.dataset.s, auMenu.id); toast(`Au menu : ${E.JOURS[+el.dataset.j]} ${el.dataset.s === 'diner' ? 'soir' : 'midi'}`); auMenu = null; break;
      case 'ed-ajouter': {
        const liste = el.dataset.type === 'extra' ? edition.extras : edition.ing;
        const x = liste[+el.dataset.i];
        if (x) { x.coche = true; if (x.alerte) toast('Attention : ' + libAllergie(x.alerte)); }
        break;
      }
      case 'ajout-ing-choisir': {
        const id = el.dataset.id;
        const x = edition.ing.find((y) => y.id === id);
        if (x) x.coche = true; else edition.ing.push({ id, q: window.Saisie.QTE[id] || 120, coche: true, manuel: true });
        break;
      }
      case 'ajout-ing-libre': {
        const nom = el.dataset.nom.trim().toLowerCase();
        if (!edition.extras.some((y) => y.nom === nom)) {
          const tags = window.Saisie.tagsExtra(nom) || [];
          const raison = E.ingredientInterdit({ tags }, S.profil);
          edition.extras.push({ nom, tags, coche: !raison, alerte: raison || null, manuel: true });
        }
        break;
      }
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
      case 'choix-filtre': {
        choix.filtre = el.dataset.k; choix.exclure = []; choix.tour = 0;
        choix.idees = E.propositions(S.plan, choix.jour, choix.slot, p, { ...optsMoteur(), n: 5, filtre: choix.filtre || undefined });
        break;
      }
      case 'autres-idees': {
        choix.exclure.push(...choix.idees);
        choix.tour++;
        const idees = E.propositions(S.plan, choix.jour, choix.slot, p, { ...optsMoteur(), exclure: choix.exclure, tour: choix.tour, n: choix.enfants ? 2 : 5, filtre: choix.filtre || undefined });
        if (!idees.length) { toast('Pas d’autre plat compatible pour ce repas'); return; }
        choix.idees = idees;
        S.plan = { ...S.plan, remplacements: S.plan.remplacements + 1 };
        break;
      }
      case 'rituels-oui': p.rituels = E.rituelsSuggeres(p); S.rituelsVus = true; nouvellePlanification(); toast('Rituels en place : la semaine a été refaite avec eux'); break;
      case 'rituels-non': S.rituelsVus = true; break;
      case 'rituels-ouvrir': S.rituelsOuverts = !el.parentElement.open; return;
      case 'rituels-appliquer': S.rituelsModifies = false; nouvellePlanification(); toast('Nouvelle semaine avec vos rituels'); break;
      case 'test-go': {
        // le test commence par les aliments, pré-remplis avec les goûts déjà connus
        const avant = {};
        for (const [, tuiles] of TUILES_GOUT) for (const [k, , , ids] of tuiles) { const l = tuileIds(ids); if (l.length) { const v = avisDepuisGouts(l, p.gouts); if (v) avant[k] = v; } }
        const g = p.gouts || {};
        const depuis = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, w]) => [k, w >= 1.5 ? 'adore' : w <= -1.5 ? 'non' : '']).filter(([, v]) => v));
        S.test = { etape: 'aliments', aliments: { ...avant }, avant, cuisines: depuis(g.cuisine), modeles: depuis(g.modele), epice: g.epice != null ? String(g.epice) : '', ids: [], i: 0, depuis: el.dataset.depuis };
        S.vue = 'test'; window.scrollTo(0, 0); break;
      }
      case 'gout-tuile': { const a = S.test.aliments; a[el.dataset.k] = a[el.dataset.k] === el.dataset.v ? '' : el.dataset.v; break; }
      case 'gout-style': { const o = S.test[el.dataset.cle]; o[el.dataset.k] = o[el.dataset.k] === el.dataset.v ? '' : el.dataset.v; break; }
      case 'gout-epice': S.test.epice = el.dataset.v; break;
      case 'test-etape': {
        const k = el.dataset.k;
        if (k === 'plats') { appliquerTestGout(); S.test.ids = selectionAdaptative(10); S.test.i = 0; }
        S.test.etape = k === 'plats' ? null : k;
        window.scrollTo(0, 0); break;
      }
      case 'test-quitter': if (Object.values(S.test.aliments).some(Boolean)) { appliquerTestGout(); toast('Vos goûts sont notés'); } S.test = null; S.vue = S.plan ? 'app' : 'profil'; if (S.plan) S.onglet = 'profil'; break;
      case 'test-rep':
        if (el.dataset.k === 'non') { S.test.pourquoi = true; S.test.raisons = []; setTimeout(() => { const z = document.querySelector('.pourquoi-non'); if (z) z.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30); break; }
        if (el.dataset.k !== 'passer') p.gouts = E.apprendre(p.gouts, S.test.ids[S.test.i], el.dataset.k);
        S.test.i++; break;
      case 'test-raison': { const k = el.dataset.k, r = S.test.raisons || []; S.test.raisons = r.includes(k) ? r.filter((x) => x !== k) : [...r, k]; break; }
      case 'test-raisons-ok': case 'test-raisons-rien':
        p.gouts = E.apprendre(p.gouts, S.test.ids[S.test.i], 'non', a === 'test-raisons-ok' ? S.test.raisons : null);
        S.test.pourquoi = false; S.test.raisons = []; S.test.i++; break;
      case 'test-raisons-retour': S.test.pourquoi = false; S.test.raisons = []; break;
      case 'gout-regler': {
        const { t, c, v } = el.dataset;
        p.gouts = E.reglerGout(p.gouts, t, c, v);
        const nom = t === 'ing' && E.ING[c] ? nomCourt(c) : (t === 'cuisine' ? 'Cuisine ' + (L.cuisines[c] || c).toLowerCase() : c);
        toast(v === 'aime' ? `Noté : vous aimez ${nom.toLowerCase()}` : v === 'non' ? `Noté : ${nom.toLowerCase()}, moins pour vous` : `${nom} retiré de vos goûts`);
        const champ = document.getElementById('gout-cherche'); if (champ) champ.value = '';
        break;
      }
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
      case 'tout-decocher': S.coches = {}; break;
      case 'masquer-coches': S.masquerCoches = el.checked; break;
      case 'stock': {
        const id = el.dataset.id;
        if (E.ING[id] && !E.ING[id].perso && Array.isArray(p.provisionsRangees)) { basculerPlacardDepuisListe(id); break; }
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
      case 'affiche-ouvrir': S.afficheOuverte = true; break;
      case 'installer': installer(); return;
      case 'installer-plus-tard': S.installIgnore = true; break;
      case 'aide-install-fermer': S.aideInstall = false; break;
      case 'aide-install-fond': if (ev.target === el) S.aideInstall = false; else return; break;
      case 'alertes-voir': S.onglet = 'promos'; window.scrollTo(0, 0); setTimeout(() => { const c = document.getElementById('mes-alertes'); if (c) c.scrollIntoView({ block: 'start' }); }, 80); break;
      case 'alerte-idee': ajouterAlerte(el.dataset.k); break;
      case 'alerte-suppr': S.alertesPromos.splice(+el.dataset.i, 1); break;
      case 'alertes-lues': S.alertesVues = [...new Set([...(S.alertesVues || []), ...nouvellesAlertes().map(([, o]) => o.id)])]; break;
      case 'alertes-notif': try { const r = await Notification.requestPermission(); S.alertesNotif = r === 'granted'; toast(r === 'granted' ? 'Vous serez prévenu à l’ouverture de Budgétable' : 'Notifications refusées par le navigateur'); } catch (e) { toast('Notifications indisponibles sur cet appareil'); } break;
      case 'plat-editer': { const m = S.plan.jours[fiche.jour][fiche.slot]; const base = recetteDeBase(m.recette); edPlat = { j: fiche.jour, sl: fiche.slot, ing: E.REC[m.recette].ing.map(([id, q]) => [id, q]), portee: S.versionsPreferees && S.versionsPreferees[base.id] === m.recette ? 'toujours' : 'repas', remplace: null, manuel: null }; S.chercheIngPlat = ''; break; }
      case 'plat-annuler': edPlat = null; break;
      case 'plat-retirer': edPlat.ing.splice(+el.dataset.i, 1); edPlat.remplace = null; break;
      case 'plat-remplacer': edPlat.remplace = edPlat.remplace === +el.dataset.i ? null : +el.dataset.i; S.chercheIngPlat = ''; setTimeout(() => { const c = document.getElementById('plat-cherche'); if (c) c.focus(); }, 30); break;
      case 'plat-remplacer-annuler': edPlat.remplace = null; break;
      case 'plat-ajouter': {
        const id = el.dataset.id, qDef = window.Saisie.QTE[id] || (E.ING[id].unite === 'pièce' ? 0.25 : 80);
        if (edPlat.remplace != null) { const [ancien, q] = edPlat.ing[edPlat.remplace]; edPlat.ing[edPlat.remplace] = [id, E.ING[ancien].unite === E.ING[id].unite ? q : qDef]; edPlat.remplace = null; }
        else edPlat.ing.push([id, qDef]);
        S.chercheIngPlat = ''; break;
      }
      case 'plat-suggestion': {
        const x = suggestionsPlat(edPlat.ing)[+el.dataset.k]; if (!x) return;
        if (x.type === 'ajouter') edPlat.ing.push([x.id, x.q]);
        else if (x.type === 'qte') edPlat.ing = edPlat.ing.map(([id, q]) => [id, id === x.id ? q * x.f : q]);
        else edPlat.ing = edPlat.ing.map(([id, q]) => (id === x.de ? [x.vers, E.ING[x.de].unite === E.ING[x.vers].unite ? q * (x.f || 1) : (window.Saisie.QTE[x.vers] || q)] : [id, q]));
        break;
      }
      case 'plat-manuel': edPlat.manuel = { nom: el.dataset.k.charAt(0).toUpperCase() + el.dataset.k.slice(1) }; S.chercheIngPlat = ''; break;
      case 'plat-manuel-annuler': edPlat.manuel = null; break;
      case 'plat-off': { lireChampsManuel(); edPlat.manuel.charge = true; rendre(); const r = await chercherCalories(edPlat.manuel.nom); if (edPlat && edPlat.manuel) { edPlat.manuel.resultats = r; edPlat.manuel.charge = false; } break; }
      case 'plat-off-choisir': { lireChampsManuel(); const p0 = edPlat.manuel.resultats[+el.dataset.k]; edPlat.manuel.kcal = Math.round(p0.kcal); if (p0.prot != null) edPlat.manuel.prot = Math.round(p0.prot * 10) / 10; toast(`${Math.round(p0.kcal)} kcal pour 100 g`); break; }
      case 'plat-manuel-ok': {
        lireChampsManuel(); const x = edPlat.manuel; const num = (v) => parseFloat(String(v || '').replace(',', '.'));
        const q = num(x.q), kcal = num(x.kcal);
        if (!(q > 0)) { toast('Indiquez la quantité par personne'); return; }
        if (!(kcal >= 0)) { toast('Indiquez les calories pour 100 g, ou cherchez-les en ligne'); return; }
        const id = 'u-' + E.norm(x.nom).replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Date.now().toString(36);
        S.ingredientsManuels = (S.ingredientsManuels || []).concat({ id, nom: x.nom.slice(0, 40), kcal, prot: num(x.prot) >= 0 ? num(x.prot) : 0, prix: num(x.prix) > 0 ? num(x.prix) : 0, paquet: num(x.paquet) > 0 ? num(x.paquet) : 0 });
        enregistrerManuels();
        edPlat.ing.push([id, q]); edPlat.manuel = null; toast(`${x.nom} ajouté (${Math.round(kcal * q / 100)} kcal par personne)`); break;
      }
      case 'plat-portee': edPlat.portee = el.dataset.k; break;
      case 'plat-enregistrer': enregistrerPlat(); break;
      case 'plat-origine': { const m = S.plan.jours[fiche.jour][fiche.slot]; m.recette = recetteDeBase(m.recette).id; m.original = true; toast('Recette d’origine pour ce repas'); break; }
      case 'jour-mobile': S.jourMobile = +el.dataset.j; S.menuRepas = null; break;
      case 'semaine-liste': S.semaineEnListe = !S.semaineEnListe; break;
      case 'outil-mobile': S.outilMobile = S.outilMobile === el.dataset.k ? '' : el.dataset.k; break;
      case 'repas-plus': S.menuRepas = el.dataset.k; break;
      case 'compte-ouvrir': ouvrirCompte(el.dataset.k || 'connexion'); break;
      case 'accueil': S.vue = 'accueil'; window.scrollTo(0, 0); break;
      case 'compte-vue': compte = { ...compte, vue: el.dataset.k, msg: '', erreur: '' }; break;
      case 'compte-voir': compte.voir = !compte.voir; rendreCompte(); return;
      case 'compte-fermer': compte.vue = null; break;
      case 'compte-fond': if (ev.target === el) compte.vue = null; else return; break;
      case 'compte-sans': compte.vue = null; if (S.vue === 'accueil') { S.vue = 'questionnaire'; S.etape = 0; } break;
      case 'compte-lien': lienConnexion(); return;
      case 'compte-reprendre': S.vue = S.plan ? 'app' : 'questionnaire'; if (!S.plan) S.etape = 0; break;
      case 'compte-sync': compte.sync = null; rendre(); synchroniserConnexion(); return;
      case 'compte-vue-mdp': compte = { ...compte, vue: 'nouveau-mdp', msg: '', erreur: '' }; break;
      case 'compte-deconnecter': await envoyerSync(); await C.deconnecter(); toast('Déconnecté : vos données restent sur cet appareil'); break;
      case 'compte-supprimer': S.confirmerSupprCompte = true; break;
      case 'compte-supprimer-non': S.confirmerSupprCompte = false; break;
      case 'compte-supprimer-ok': try { await C.supprimerCompte(); S.confirmerSupprCompte = false; toast('Compte supprimé'); } catch (e) { toast(e.message); } break;
      case 'envoi-ouvrir': S.envoiOuvert = true; S.envoiQuoi = el.dataset.k || 'liste'; break;
      case 'envoi-fermer': S.envoiOuvert = false; break;
      case 'envoi-fond': if (ev.target === el) S.envoiOuvert = false; else return; break;
      case 'envoi-quoi': S.envoiQuoi = el.dataset.k; break;
      case 'envoi-copier': copier(texteEnvoi(S.envoiQuoi || 'liste'), null); return;
      case 'envoi-lien': copier(lienPartage(), null); return;
      case 'envoi-partager': { const q = S.envoiQuoi || 'liste'; const d = { title: 'Budgétable', text: texteEnvoi(q) }; if (q !== 'menu') d.url = lienPartage(); navigator.share(d).catch(() => {}); return; }
      case 'promos-maj': chargerPromos(true); return;
      case 'prospectus-ouvrir': if (!/^https:\/\/catalogues\.aldi\.fr\//.test(el.dataset.u)) return; S.prospectusOuvert = { lien: el.dataset.u, enseigne: el.dataset.k, titre: el.dataset.t }; break;
      case 'prospectus-fermer': S.prospectusOuvert = null; break;
      case 'prospectus-fond': if (ev.target === el) S.prospectusOuvert = null; else return; break;
      case 'promo-filtre': S.filtrePromo = el.dataset.k; break;
      case 'promo-magasin': S.magasinPromo = el.dataset.k; break;
      case 'promo-effacer': S.cherchePromo = ''; S.magasinPromo = 'tout'; S.filtrePromo = 'tout'; break;
      case 'promo-idee': S.onglet = 'soir'; S.jaiCa = { ids: [el.dataset.id], placard: true, ouvert: true, basiques: true }; window.scrollTo(0, 0); break;
      case 'saison-filtre': S.filtreSaison = el.dataset.k; break;
      case 'saison-garder': { const id = el.dataset.r, l = S.saisonGardees || []; S.saisonGardees = l.includes(id) ? l.filter((x) => x !== id) : l.concat(id); E.saisonActives(S.saisonGardees); toast(S.saisonGardees.includes(id) ? 'Gardée : elle sera proposée dans vos menus' : 'Retirée de vos idées gardées'); break; }
      case 'gamelles-ouvrir': if (!S.profil.gamelles || !S.profil.gamelles.n) { S.profil.gamelles = { n: 1, jours: [0, 1, 2, 3, 4], mode: 'restes' }; majGamelles(); } S.gamellesOuvert = true; fiche = null; break;
      case 'gamelles-fermer': S.gamellesOuvert = false; break;
      case 'gamelles-fond': if (ev.target === el) S.gamellesOuvert = false; else return; break;
      case 'gamelles-n': { const g = { n: 1, jours: [0, 1, 2, 3, 4], mode: 'restes', ...(p.gamelles || {}) }; g.n = Math.max(0, Math.min(10, g.n + +el.dataset.d)); p.gamelles = g; majGamelles(); break; }
      case 'gamelles-jour': { const g = { n: 1, jours: [], mode: 'restes', ...(p.gamelles || {}) }; const j = +el.dataset.j; g.jours = g.jours.includes(j) ? g.jours.filter((x) => x !== j) : g.jours.concat(j).sort(); p.gamelles = g; majGamelles(); break; }
      case 'gamelles-mode': p.gamelles = { ...(p.gamelles || { n: 1, jours: [0, 1, 2, 3, 4] }), mode: el.dataset.k }; S.plan.jours.forEach((jp) => { delete jp.gamelleMode; }); majGamelles(); break;
      case 'gamelle-jour-mode': { const jp = S.plan.jours[+el.dataset.j]; if (el.dataset.k === ((p.gamelles && p.gamelles.mode) || 'restes')) delete jp.gamelleMode; else jp.gamelleMode = el.dataset.k; majGamelles(); break; }
      case 'gamelle-changer': { const j = +el.dataset.j, jp = S.plan.jours[j]; const autres = S.plan.jours.map((x) => x.gamelleRecette).filter(Boolean); const l = E.platsGamelle(p, autres.concat(jp.gamelleRecette || [])); if (l.length) { const i = Math.floor(Math.random() * Math.min(6, l.length)); jp.gamelleRecette = l[i].id; } majGamelles(); break; }
      case 'gamelle-fiche': { const g = S.plan.jours[+el.dataset.j].gamelles; if (!g || !E.REC[g.recette]) return; if (g.mode === 'restes') fiche = { jour: g.source, slot: 'diner' }; else fiche = { recette: g.recette, parts: g.portions }; S.gamellesOuvert = false; break; }
      case 'fiche-portions': { if (!fiche) return; const d = +el.dataset.d; if (fiche.recette) { const r0 = E.REC[fiche.recette]; const cur = fiche.parts || (r0.gourmand ? r0.parts : E.portions(p, aujourdhui(), 'diner')); fiche.parts = Math.max(1, Math.round(cur + d)); break; } const m = S.plan.jours[fiche.jour][fiche.slot]; m.portions = Math.max(0.5, Math.round((m.portions + d) * 2) / 2); m.manuel = true; break; }
      case 'fiche-portions-auto': { const m = S.plan.jours[fiche.jour][fiche.slot]; delete m.manuel; majGamelles(); break; }
      case 'fiche-restes': { const m = S.plan.jours[fiche.jour][fiche.slot]; if (el.dataset.k === 'non') delete m.restes; else m.restes = { vers: el.dataset.k, n: (m.restes && m.restes.n) || 2 }; break; }
      case 'fiche-congel': { const m = S.plan.jours[fiche.jour][fiche.slot]; m.restes = { vers: 'congel', n: Math.max(1, Math.min(20, ((m.restes && m.restes.n) || 2) + +el.dataset.d)) }; break; }
      case 'affiche-fermer': S.afficheOuverte = false; break;
      case 'affiche-style': S.afficheOpts = { ...optsAffiche(), style: el.dataset.k }; break;
      case 'affiche-imprimer': window.print(); return;
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
      case 'courses-go': {
        const articles = aAcheter(E.listeCourses(S.plan, p));
        const m = S.modeCourses && S.modeCourses.absents ? S.modeCourses : { absents: {}, prix: {} };
        let i = articles.findIndex((x) => !S.coches[x.id] && !m.absents[x.id]);
        if (i < 0) i = articles.length;
        S.modeCourses = { ...m, ouvert: true, i };
        break;
      }
      case 'photo-effacer': S.photoEtat = null; break;
      case 'photo-produit': case 'photo-placard': case 'ticket-photo': return;
      case 'ameliorer': S.bilanOuvert = false; lancerAmeliorations(); break;
      case 'ameliorer-encore': {
        const refus = (S.ameliorations ? S.ameliorations.propositions.filter((x) => x.refuse).map((x) => x.apres) : []);
        const notes = { ...S.notes }; refus.forEach((id) => { notes[id] = 1; });
        S.ameliorations = E.ameliorerSemaine(S.plan, profilSemaine(), { notes, classiques: S.classiques, max: 4 });
        break;
      }
      case 'ameliorer-fermer': case 'ameliorer-fond': S.ameliorations = null; break;
      case 'ameliorer-accepter': case 'ameliorer-refuser': case 'ameliorer-tout': {
        const liste = S.ameliorations.propositions;
        const appliquer = (x) => { if (x.fait || x.refuse) return; if (S.plan.jours[x.jour][x.slot] && S.plan.jours[x.jour][x.slot].recette === x.avant) { S.plan = E.placerRecette(S.plan, x.jour, x.slot, x.apres); x.fait = true; } };
        if (a === 'ameliorer-tout') liste.forEach(appliquer);
        else if (a === 'ameliorer-accepter') appliquer(liste[+el.dataset.k]);
        else liste[+el.dataset.k].refuse = true;
        if (a !== 'ameliorer-refuser') toast('Plat changé : menus et courses mis à jour');
        break;
      }
      case 'carnet-jour': { const x = new Date((S.jourCarnet || ISO(new Date())) + 'T12:00:00'); x.setDate(x.getDate() + +el.dataset.n); const v = ISO(x); S.jourCarnet = v > ISO(new Date()) ? ISO(new Date()) : v; break; }
      case 'carnet-moment': S.momentCarnet = el.dataset.k; break;
      case 'carnet-ajouter': {
        const d = S.jourCarnet || ISO(new Date()), al = window.Aliments.ALIMENTS.find((y) => y.id === el.dataset.id);
        if (!al) return;
        S.ajouts = S.ajouts || [];
        const ex = S.ajouts.find((x) => x.d === d && x.a === al.id);
        if (ex) ex.n++; else S.ajouts.push({ d, a: al.id, n: 1, m: al.moment });
        toast(`${al.nom} ajouté (${al.kcal} kcal)`);
        break;
      }
      case 'carnet-qte': { const x = S.ajouts[+el.dataset.i]; if (!x) return; x.n = Math.max(0, x.n + +el.dataset.n); if (!x.n) S.ajouts.splice(+el.dataset.i, 1); break; }
      case 'carnet-suppr': S.ajouts.splice(+el.dataset.i, 1); break;
      case 'carnet-perso': {
        const nom = (document.getElementById('carnet-perso-nom') || {}).value || '';
        const kcal = parseInt((document.getElementById('carnet-perso-kcal') || {}).value, 10);
        if (nom.trim().length < 2 || !(kcal >= 0 && kcal < 5000)) { toast('Indiquez un nom et des calories'); return; }
        S.ajouts = S.ajouts || [];
        S.ajouts.push({ d: S.jourCarnet || ISO(new Date()), nom: nom.trim().slice(0, 50), kcal, n: 1, m: S.momentCarnet || 'collation' });
        toast(`${nom.trim()} ajouté`);
        break;
      }
      case 'carnet-scan': return;
      case 'carnet-produit': scannerProduit(el.dataset.code); return;
      case 'carnet-ingredient': {
        const id = el.dataset.id, tb = window.Nutrition.TABLE[id];
        S.scanCarnet = { etat: 'trouve', code: null, grammes: E.ING[id].unite === 'pièce' && tb[7] ? tb[7] : 100,
          produit: { nom: E.ING[id].nom, marque: '', image: null, ns: '', quantite: '', portion: E.ING[id].unite === 'pièce' && tb[7] ? tb[7] : null, portionTxt: E.ING[id].unite === 'pièce' && tb[7] ? `1 pièce, ${tb[7]} g` : '', paquet: null,
            c100: { kcal: tb[0], ags: tb[1], sucres: tb[2], sel: tb[3], fibres: tb[4], prot: tb[5], fl: tb[6] ? 100 : 0 } } };
        break;
      }
      case 'carnet-code': { const z = document.getElementById('carnet-code'); const c = (z ? z.value : '').replace(/\D/g, ''); if (c.length < 8) { toast('Tapez les 8 ou 13 chiffres du code-barres'); return; } scannerProduit(c); return; }
      case 'scan-qte': S.scanCarnet.grammes = +el.dataset.g; break;
      case 'scan-annuler': S.scanCarnet = null; break;
      case 'scan-ajouter': {
        const sc = S.scanCarnet; if (!sc || !sc.produit) return;
        const f = sc.grammes / 100, c = sc.produit.c100, r1 = (v) => Math.round(v * f * 100) / 100;
        S.ajouts = S.ajouts || [];
        S.ajouts.push({ d: S.jourCarnet || ISO(new Date()), nom: sc.produit.nom + (sc.produit.marque ? ' (' + sc.produit.marque + ')' : ''), portion: nb(sc.grammes) + ' g', code: sc.code, n: 1, m: S.momentCarnet || 'collation', nut: { kcal: Math.round(c.kcal * f), prot: r1(c.prot), fibres: r1(c.fibres), sucres: r1(c.sucres), ags: r1(c.ags), sel: r1(c.sel), fl: r1(c.fl) } });
        toast(`${sc.produit.nom} ajouté (${Math.round(c.kcal * f)} kcal)`);
        S.scanCarnet = null;
        break;
      }
      case 'kcal-ouvrir': S.calcKcalOuvert = true; S.calcKcal = S.calcKcal || { activite: '1.4', objectif: 'garder' }; break;
      case 'kcal-fermer': case 'kcal-fond': S.calcKcalOuvert = false; break;
      case 'kcal-choix': S.calcKcal[el.dataset.cle] = el.dataset.k; break;
      case 'kcal-appliquer': S.objectifKcal = +el.dataset.k; S.calcKcalOuvert = false; toast(`Repère : ${nb(+el.dataset.k)} kcal par jour`); break;
      case 'carnet-objectif': S.objectifKcal = +el.dataset.k; break;
      case 'journal-periode': S.periodeJournal = el.dataset.k; break;
      case 'journal-filtre': S.filtreJournal = el.dataset.k; break;
      case 'journal-humeur': S.humeurJournal = el.dataset.k; break;
      case 'journal-suggestion': S.rechercheJournal = E.norm(el.dataset.k) === E.norm(S.rechercheJournal || '') ? '' : el.dataset.k; break;
      case 'journal-effacer': S.filtreJournal = 'tout'; S.humeurJournal = 'tout'; S.rechercheJournal = ''; break;
      case 'journal-ajouter': S.jourCarnet = el.dataset.d; S.onglet = 'apports'; window.scrollTo(0, 0); break;
      case 'journal-suppr-repas': S.journal = (S.journal || []).filter((x) => !(x.d === el.dataset.d && x.s === el.dataset.s)); toast('Retiré du journal'); break;
      case 'imprimer-journal': window.print(); return;
      case 'jaica-ouvrir': S.jaiCa = { ids: [], placard: false, ...(S.jaiCa || {}), ouvert: true }; break;
      case 'jaica-fermer': S.jaiCa.ouvert = false; break;
      case 'jaica-ajouter': if (!S.jaiCa.ids.includes(el.dataset.id)) S.jaiCa.ids.push(el.dataset.id); break;
      case 'jaica-oui': if (!S.jaiCa.ids.includes(el.dataset.id)) S.jaiCa.ids.push(el.dataset.id); break;
      case 'jaica-non': S.jaiCa.non = (S.jaiCa.non || []).concat(el.dataset.id); break;
      case 'jaica-reset-non': S.jaiCa.non = []; break;
      case 'jaica-retirer': S.jaiCa.ids = S.jaiCa.ids.filter((x) => x !== el.dataset.id); break;
      case 'periode-apports': S.periodeApports = el.dataset.k; break;
      case 'bilan-ouvrir': S.bilanOuvert = true; break;
      case 'bilan-fermer': case 'bilan-fond': S.bilanOuvert = false; break;
      case 'presence-editer': S.presenceEdit = el.dataset.k; break;
      case 'presence-fermer': case 'presence-fond': S.presenceEdit = null; break;
      case 'presence-pas': case 'presence-enfant': case 'presence-personne': case 'presence-pareil': {
        const [j0, sl0] = [+S.presenceEdit.split('-')[0], S.presenceEdit.split('-')[1]];
        const cur = presenceDe(j0, sl0);
        if (a === 'presence-pas') cur[el.dataset.k] = Math.max(0, Math.min(20, cur[el.dataset.k] + +el.dataset.d));
        if (a === 'presence-enfant') cur.e[+el.dataset.k] = !cur.e[+el.dataset.k];
        if (a === 'presence-personne') { cur.a = 0; cur.e = cur.e.map(() => false); cur.invA = 0; cur.invE = 0; }
        const cible = a === 'presence-pareil' ? (j, sl) => j < 5 && sl === sl0 : (j, sl) => j === j0 && sl === sl0;
        changerPresences((j, sl, x) => (cible(j, sl) ? { ...cur, e: cur.e.slice() } : null), a === 'presence-pareil' ? 'Appliqué à tous les jours de semaine' : null);
        break;
      }
      case 'presences-raccourci': {
        const k = el.dataset.k, f = p.foyer;
        const msg = { tous: 'Tout le monde à tous les repas', cantine: 'Enfants à la cantine les midis (sauf mercredi)', travail: 'Adultes absents les midis de semaine', invites: '+2 invités samedi soir et dimanche midi', garde: 'Enfants absents cette semaine' }[k];
        changerPresences((j, sl, x) => {
          if (k === 'tous') return { a: f.adultes, e: f.enfants.map(() => true), invA: 0, invE: 0 };
          if (k === 'cantine') return j < 5 && j !== 2 && sl === 'dejeuner' ? { ...x, e: x.e.map(() => false) } : null;
          if (k === 'travail') return j < 5 && sl === 'dejeuner' ? { ...x, a: 0 } : null;
          if (k === 'invites') return (j === 5 && sl === 'diner') || (j === 6 && sl === 'dejeuner') ? { ...x, invA: x.invA + 2 } : null;
          if (k === 'garde') return { ...x, e: x.e.map(() => false) };
          return null;
        }, msg + ' : menus et courses mis à jour');
        break;
      }
      case 'budget-ouvrir': S.budgetOuvert = true; S.budgetSaisi = null; S.budgetCalc = S.budgetCalc || { charges: {} }; break;
      case 'budget-fermer': case 'budget-fond': S.budgetOuvert = false; break;
      case 'budget-periode': {
        const z = document.getElementById('budget-libre'); const v = z ? nombre(z.value) : 0;
        const avant = S.budgetPeriode || 'semaine'; S.budgetPeriode = el.dataset.k;
        if (v && avant !== S.budgetPeriode) S.budgetSaisi = S.budgetPeriode === 'mois' ? v * SEMAINES_PAR_MOIS : v / SEMAINES_PAR_MOIS;
        break;
      }
      case 'budget-valider': {
        const z = document.getElementById('budget-libre'); const v = z ? nombre(z.value) : 0;
        const semaine = Math.round(S.budgetPeriode === 'mois' ? v / SEMAINES_PAR_MOIS : v);
        if (semaine < 5 || semaine > 2000) { toast('Indiquez un montant entre 5 € et 2 000 € par semaine'); return; }
        p.budget = semaine; S.budgetOuvert = false; S.budgetSaisi = null;
        toast(`Budget : ${euros(semaine)} par semaine`);
        break;
      }
      case 'calc-niveau': S.budgetCalc.niveau = el.dataset.k; { const z = document.getElementById('calc-resultat'); if (z) z.innerHTML = resultatCalcul(); } sauver(); return;
      case 'calc-appliquer': {
        const r = calculBudget(); const x = r.propositions.find((y) => y.k === (S.budgetCalc.niveau || 'equilibre'));
        if (!x || x.semaine < 5) return;
        p.budget = x.semaine; S.budgetOuvert = false;
        toast(`Budget : ${euros(x.semaine)} par semaine`);
        break;
      }
      case 'coach-voir': S.coachVoir = el.dataset.k; break;
      case 'coach-fermer': case 'coach-fond': S.coachVoir = null; break;
      case 'coach-semaine': {
        p.coach = el.dataset.k;
        S.coachVoir = null;
        nouvellePlanification();
        S.onglet = 'semaine';
        window.scrollTo(0, 0);
        toast(`${COACHS[p.coach].emoji} Votre semaine avec le ${COACHS[p.coach].nom.toLowerCase()} est prête`);
        break;
      }
      case 'coach-arreter': p.coach = null; S.coachVoir = null; toast('Coach arrêté : vos prochaines semaines redeviennent classiques'); break;
      case 'fiche-g': fiche = { recette: el.dataset.r, parts: el.dataset.n ? +el.dataset.n : null }; break;
      case 'gourmand-filtre': S.filtreGourmand = el.dataset.k; break;
      case 'manuel-ajouter': ajouterManuel({ id: el.dataset.id }); break;
      case 'manuel-ajouter-texte': {
        const champ = document.getElementById('manuel-cherche');
        const t = champ ? champ.value.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
        if (!t) { toast('Écrivez d’abord le produit à ajouter'); if (champ) champ.focus(); return; }
        // un produit connu du catalogue (même orthographe) garde son rayon et son prix
        const connu = window.Saisie.chercherIngredients(t, 1).find((id) => E.ING[id] && !E.ING[id].perso && E.norm(E.ING[id].nom) === E.norm(t));
        ajouterManuel(connu ? { id: connu } : { nom: t.charAt(0).toUpperCase() + t.slice(1) });
        break;
      }
      case 'manuel-qte': case 'manuel-suppr': {
        const l = (S.plan && S.plan.manuels) || [];
        const id = el.dataset.id;
        const i = l.findIndex((y) => y.id === id || (y.nom && 'm-' + E.slug(y.nom) === id));
        if (i < 0) return;
        if (a === 'manuel-suppr') { l.splice(i, 1); delete S.coches[id]; toast('Retiré de la liste'); break; }
        l[i].n = (l[i].n || 1) + +el.dataset.d;
        if (l[i].n <= 0) { l.splice(i, 1); delete S.coches[id]; }
        break;
      }
      case 'pd-filtre': S.filtrePD = el.dataset.k; break;
      case 'prog-choix': S.progForm[el.dataset.cle] = el.dataset.k; break;
      case 'sp-choix': S.sportForm[el.dataset.cle] = el.dataset.cle === 'duree' ? +el.dataset.k : el.dataset.k; break;
      case 'sp-multi': { const c = el.dataset.cle, k = c === 'jours' ? +el.dataset.k : el.dataset.k, l = S.sportForm[c] || []; S.sportForm[c] = l.includes(k) ? l.filter((x) => x !== k) : l.concat(k); break; }
      case 'sp-sante': S.sportForm.sante = { ...(S.sportForm.sante || {}), [el.dataset.k]: el.dataset.v }; break;
      case 'sp-accord': S.sportForm.accordMedecin = el.checked; { const z = document.getElementById('sp-etat'); if (z) z.innerHTML = etatBilanSport(); } return;
      case 'sp-consent': S.sportForm.consent = el.checked; { const z = document.getElementById('sp-etat'); if (z) z.innerHTML = etatBilanSport(); } return;
      case 'sp-lancer': {
        const f = S.sportForm; if (!SP.verifier(f).ok || !f.consent) return;
        p.consentementSante = true; S.sensibleNonEnregistre = false;
        const ancien = p.sport;
        p.sport = { age: +f.age, objectif: f.objectif, niveau: f.niveau, materiel: f.materiel || [], jours: (f.jours || []).slice().sort((x, y) => x - y), duree: +f.duree, limites: f.limites || [], sante: f.sante, accordMedecin: !!f.accordMedecin, douceur: !!f.accordMedecin || !!(ancien && ancien.douceur), semaine: ancien ? ancien.semaine : 1, ajust: ancien ? ancien.ajust || 0 : 0, historique: ancien ? ancien.historique || [] : [], debut: ancien ? ancien.debut : ISO(new Date()), semaineDu: ancien ? ancien.semaineDu : lundiIso(new Date()), message: ancien ? ancien.message : '' };
        S.sportModifier = false; S.sportForm = null;
        toast(ancien ? 'Programme mis à jour' : '🏃 Votre programme sportif est prêt');
        break;
      }
      case 'sp-modifier': S.sportModifier = true; S.sportForm = null; break;
      case 'sp-arreter': if (!S.sportArret) { S.sportArret = true; break; } S.sportArret = false; p.sport = null; coachSport = { tours: [], attente: false, message: '' }; toast('Programme sportif arrêté et effacé'); break;
      case 'sp-go': {
        const s = programmeSport().find((x) => x.j === +el.dataset.j); if (!s) return;
        S.seance = { j: s.j, titre: s.titre, kcal: s.kcal, etapes: SP.etapes(s), i: 0, restant: null, ecoule: 0, pause: false };
        lancerMinuterie(); bip(false); break;
      }
      case 'sp-pause': S.seance.pause = !S.seance.pause; break;
      case 'sp-suivant': etapeSuivante(); return;
      case 'sp-stop': clearInterval(minuterieSeance); if ((S.seance.ecoule || 0) > 120) { S.seance.fin = true; } else { S.seance = null; toast('Séance arrêtée'); } break;
      case 'sp-fin': {
        const s = S.seance; const sp = p.sport;
        sp.historique = (sp.historique || []).concat([{ d: ISO(new Date()), semaine: sp.semaine || 1, j: s.j, titre: s.titre, ressenti: el.dataset.k, minutes: Math.max(1, Math.round((s.ecoule || 0) / 60)) }]).slice(-300);
        S.seance = null;
        if (el.dataset.k === 'douleur') { sp.douceur = true; sp.ajust = Math.min(sp.ajust || 0, 0) - 1; sp.message = 'Vous avez eu mal : j’ai allégé vos prochaines séances et retiré les sauts. Reposez la zone douloureuse ; si la douleur est vive ou dure plus de quelques jours, consultez un médecin avant de reprendre.'; }
        else sp.message = ({ facile: 'Trop facile ? Noté : si ça se confirme, je monte d’un cran au bilan de la semaine. 💪', bien: 'Parfait, c’est exactement le bon niveau. On continue comme ça !', dur: 'C’était dur, et vous l’avez fait : bravo. Si ça reste dur, j’allège au bilan de la semaine.' })[el.dataset.k];
        toast('Séance enregistrée, bravo !');
        break;
      }
      case 'sp-bilan': {
        const sp = p.sport, b = SP.bilanSemaine(sp, sp.historique);
        sp.ajust = b.ajust; sp.semaine = (sp.semaine || 1) + 1; sp.semaineDu = lundiIso(new Date()); sp.message = b.message + ' Vos séances de la semaine ' + sp.semaine + ' sont prêtes.';
        toast(`Semaine ${sp.semaine} : vos nouvelles séances sont prêtes`); break;
      }
      case 'sp-petitdej': {
        if (!S.plan) return;
        const sp = p.sport;
        const sportifs = E.gourmandises().filter((r) => r.type === 'petitdej' && (r.tags || []).includes('sportif') && E.recetteCompatible(r, p).ok).sort((a, b) => E.scoreGout(b, p.gouts) - E.scoreGout(a, p.gouts));
        if (!sportifs.length) return;
        sp.jours.forEach((j, k) => { const jp = S.plan.jours[j]; jp.gourmand = (jp.gourmand || []).filter((g) => g.moment !== 'petitdej').concat([{ recette: sportifs[k % Math.min(3, sportifs.length)].id, portions: 1, moment: 'petitdej' }]); });
        toast(`Petits-déj sportifs ajoutés ${pluriel(sp.jours.length, 'jour')}, et à vos courses`); break;
      }
      case 'coach-s-q': envoyerCoachSport(el.dataset.q); return;
      case 'coach-s-envoyer': { const c = document.getElementById('coach-s-texte'); if (c && c.value.trim()) envoyerCoachSport(c.value); return; }
      case 'prog-consent': S.progForm.consent = el.checked; { const z = document.getElementById('prog-resultat'); if (z) z.innerHTML = resultatBilanMinceur(); } return;
      case 'prog-lancer': {
        const f = S.progForm, v = P.verifier(f);
        if (!v.ok || !f.consent) return;
        p.consentementSante = true; S.sensibleNonEnregistre = false;
        const ancien = p.programme;
        const kg = +String(f.poids).replace(',', '.');
        p.programme = { debut: ancien ? ancien.debut : ISO(new Date()), sexe: f.sexe, age: +f.age, taille: +f.taille, poidsDepart: ancien ? ancien.poidsDepart : kg, poidsActuel: kg, objectif: +String(f.objectif).replace(',', '.'), activite: f.activite, rythme: f.rythme, personnes: Math.min(2, +f.personnes || 1), ajustement: ancien ? ancien.ajustement || 0 : 0, pesees: ancien ? ancien.pesees : [], bilans: ancien ? ancien.bilans || [] : [], semaine: ancien ? ancien.semaine : 1, rassasiant: ancien ? ancien.rassasiant : false, simple: ancien ? ancien.simple : false };
        S.progModifier = false; S.progForm = null;
        preparerSemaineMinceur();
        toast(ancien ? 'Programme mis à jour et semaine préparée' : '🥗 Votre programme minceur est lancé : votre semaine est prête');
        break;
      }
      case 'prog-semaine': if (!p.programme) return; preparerSemaineMinceur(); p.programme.dernierPoint = null; toast('Votre semaine minceur est prête, selon vos goûts'); break;
      case 'prog-modifier': S.progModifier = true; S.progForm = null; break;
      case 'prog-arreter':
        if (!S.progArret) { S.progArret = true; break; }
        S.progArret = false; p.programme = null; if (p.coach === 'minceur') p.coach = null; coachMinceur = { tours: [], attente: false, message: '' }; toast('Programme arrêté : vos données de poids sont effacées'); break;
      case 'prog-ressenti': S.progPoint = { ...(S.progPoint || {}), ressenti: el.dataset.k }; break;
      case 'prog-point': {
        const pt = S.progPoint || {};
        if (!pt.kg && !pt.ressenti) { toast('Indiquez votre poids ou votre ressenti'); return; }
        const r = P.adapter(p.programme, pt.kg, pt.ressenti);
        p.programme = { ...r.prog, dernierPoint: r.message, message: r.message, semainePrete: false };
        S.progPoint = null;
        toast('Point fait : votre coach a ajusté le programme');
        break;
      }
      case 'coach-m-q': envoyerCoachMinceur(el.dataset.q); return;
      case 'coach-m-envoyer': { const c = document.getElementById('coach-m-texte'); if (c && c.value.trim()) envoyerCoachMinceur(c.value); return; }
      case 'pd-retirer': S.plan.jours.forEach((jp) => { if (jp.gourmand) jp.gourmand = jp.gourmand.filter((g) => !(g.recette === el.dataset.r && g.moment === 'petitdej')); }); toast('Retiré de la semaine'); break;
      case 'gourmand-jours': if (S.gourmandAjout) S.gourmandAjout.jours = { semaine: [0, 1, 2, 3, 4], weekend: [5, 6], tous: [0, 1, 2, 3, 4, 5, 6] }[el.dataset.k]; break;
      case 'gourmand-ajouter': {
        if (!S.plan) { toast('Créez d’abord votre semaine'); return; }
        const r = E.REC[el.dataset.r];
        const c = E.recetteCompatible(r, p);
        if (!c.ok) toast(`Attention : ${libAllergie(c.raison)}`);
        S.gourmandAjout = { id: r.id, jours: [], moment: r.type, parts: r.parts === 1 ? nbFoyer() : r.parts };
        fiche = null;
        break;
      }
      case 'gourmand-jour': { const a = S.gourmandAjout, j = +el.dataset.j; a.jours = a.jours.includes(j) ? a.jours.filter((x) => x !== j) : a.jours.concat(j).sort(); break; }
      case 'gourmand-moment': S.gourmandAjout.moment = el.dataset.k; break;
      case 'gourmand-parts': S.gourmandAjout.parts = Math.max(1, Math.min(40, S.gourmandAjout.parts + +el.dataset.d)); break;
      case 'gourmand-fermer': case 'gourmand-fond': S.gourmandAjout = null; break;
      case 'gourmand-valider': {
        const a = S.gourmandAjout;
        if (!a || !a.jours.length) return;
        for (const j of a.jours) { const jp = S.plan.jours[j]; jp.gourmand = (jp.gourmand || []).concat([{ recette: a.id, portions: a.parts, moment: a.moment }]); }
        toast(`${E.REC[a.id].nom} : ajouté ${pluriel(a.jours.length, 'fois')}, et à vos courses`);
        S.gourmandAjout = null;
        break;
      }
      case 'gourmand-retirer': { const jp = S.plan.jours[+el.dataset.j]; jp.gourmand = (jp.gourmand || []).filter((x, k) => k !== +el.dataset.k); toast('Retiré de la semaine'); break; }
      case 'ed-nouveau-g': ouvrirEdition({ gourmand: true }); break;
      case 'ed-modifier-g': ouvrirEdition({ id: el.dataset.r, gourmand: true }); fiche = null; break;
      case 'gourmand-suppr': {
        S.gourmandPerso = S.gourmandPerso.filter((x) => x.id !== el.dataset.r);
        if (S.plan) S.plan.jours.forEach((jp) => { if (jp.gourmand) jp.gourmand = jp.gourmand.filter((g) => g.recette !== el.dataset.r); });
        definirGourmand(); edition = null; toast('Recette supprimée'); break;
      }
      case 'cuisine-vue': S.vue3d = el.dataset.v === '3d'; break;
      case 'cuisine-ouvrir': S.cuisine = S.cuisine === el.dataset.z ? null : el.dataset.z; S.stockSel = null; break;
      case 'stock-sel': S.stockSel = S.stockSel === el.dataset.id ? null : el.dataset.id; break;
      case 'liste-stock-ouvrir': S.listeStockOuverte = !el.parentElement.open; return;
      case 'drives-ouvrir': S.drivesOuverts = !el.parentElement.open; return;
      case 'stock-ajouter': {
        const id = el.dataset.id;
        p.stock = E.ajouterAuStock(p.stock, [[id, E.ING[id].cond]]);
        toast(`${E.ING[id].nom} : ${quantite(E.ING[id].cond, E.ING[id].unite)} au placard`);
        const z = document.getElementById('stock-propositions'); if (z) z.innerHTML = '';
        break;
      }
      case 'stock-plus': p.stock = E.ajouterAuStock(p.stock, [[el.dataset.id, pasStock(el.dataset.id)]]); break;
      case 'stock-moins': p.stock = E.retirerDuStock(p.stock, [[el.dataset.id, pasStock(el.dataset.id)]]); break;
      case 'stock-fini': if (S.stockSel === el.dataset.id) S.stockSel = null; S.supprStock = [el.dataset.id, (p.stock || {})[el.dataset.id] || 0]; p.stock = E.retirerDuStock(p.stock, [[el.dataset.id, Infinity]]); break;
      case 'stock-suppr-annuler': if (S.supprStock) p.stock = E.ajouterAuStock(p.stock || {}, [[S.supprStock[0], S.supprStock[1]]]); S.supprStock = null; break;
      case 'stock-suppr-ok': S.supprStock = null; break;
      case 'vers-soir': S.onglet = 'soir'; S.ceSoirOuvert = true; S.imprimable = false; S.supprStock = null; S.jaiCa = { ids: [], ...(S.jaiCa || {}), placard: true, ouvert: true }; window.scrollTo(0, 0); setTimeout(() => { const c = document.querySelector(el.dataset.r ? `.avec-placard [data-r="${el.dataset.r}"]` : '.avec-placard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80); break;
      case 'ranger-achats': {
        const achats = achatsARanger();
        if (!achats.length) { toast('Rien à ranger : cochez d’abord vos articles achetés'); if (S.modeCourses) S.modeCourses.ouvert = false; break; }
        rangerArticles(achats);
        break;
      }
      case 'courses-faites': {
        const restants = articlesARangerTous();
        const coches = restants.filter((a) => S.coches[a.id]);
        if (coches.length && coches.length < restants.length) { S.choixRanger = true; break; }
        if (restants.length) rangerArticles(restants);
        break;
      }
      case 'ranger-tout': { const r = articlesARangerTous(); if (r.length) rangerArticles(r); break; }
      case 'ranger-annuler-choix': S.choixRanger = false; break;
      case 'rangement-annuler': {
        const d = S.dernierRangement;
        if (!d) break;
        p.stock = E.retirerDuStock(p.stock, d.ajouts);
        d.ajouts.forEach(([id]) => { delete S.ranges[id]; });
        S.dernierRangement = null;
        toast('Rangement annulé : le placard est revenu comme avant');
        break;
      }
      case 'rangement-ok': S.dernierRangement = null; break;
      case 'cuisine': {
        const k = el.dataset.j + '-' + el.dataset.s;
        const m = S.plan.jours[+el.dataset.j][el.dataset.s];
        p.stock = E.retirerDuStock(p.stock, E.consommationRepas(m));
        S.deduits[k] = 'cuisine';
        toast('Bon appétit ! Votre placard est à jour');
        break;
      }
      case 'deduire-repas': {
        let n = 0;
        repasATraiter().forEach(({ j, sl, m }) => {
          const k = j + '-' + sl;
          if (S.repasDecoches && S.repasDecoches[k]) { S.deduits[k] = 'ignore'; return; }
          p.stock = E.retirerDuStock(p.stock, E.consommationRepas(m));
          S.deduits[k] = 'cuisine'; n++;
        });
        S.repasDecoches = {};
        toast(n ? `${pluriel(n, 'repas déduit')} du placard` : 'Placard inchangé');
        break;
      }
      case 'placard-ce-soir': {
        const t = aujourdhui();
        S.plan = E.placerRecette(S.plan, t, 'diner', el.dataset.r);
        toast(`Ce soir : ${E.REC[el.dataset.r].nom}`);
        break;
      }
      case 'courses-panier': S.coches[el.dataset.id] = true; delete S.modeCourses.absents[el.dataset.id]; coursesSuivant(); break;
      case 'courses-absent': S.modeCourses.absents[el.dataset.id] = true; S.coches[el.dataset.id] = false; coursesSuivant(); break;
      case 'courses-stock': { const id = el.dataset.id; if (E.ING[id] && !E.ING[id].perso && Array.isArray(p.provisionsRangees)) { const a = E.listeCourses(S.plan, p).articles.find((x) => x.id === id); if (!(a && (a.enStock || a.couvertParPlacard))) basculerPlacardDepuisListe(id); } else if (!p.provisions.includes(id)) { p.provisions = [...p.provisions, id]; toast('Noté : vous en avez déjà'); } break; }
      case 'courses-suiv': coursesSuivant(); break;
      case 'courses-prec': S.modeCourses.i = Math.max(0, S.modeCourses.i - 1); break;
      case 'courses-aller': {
        const articles = aAcheter(E.listeCourses(S.plan, p));
        delete S.modeCourses.absents[el.dataset.id];
        S.modeCourses.i = Math.max(0, articles.findIndex((x) => x.id === el.dataset.id));
        break;
      }
      case 'courses-fermer': case 'courses-fond': S.modeCourses.ouvert = false; break;
      case 'courses-zero': aAcheter(E.listeCourses(S.plan, p)).forEach((x) => { S.coches[x.id] = false; }); S.modeCourses = { absents: {}, prix: {}, ouvert: true, i: 0 }; break;
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

  window.addEventListener('resize', () => ajusterAffiche());
  window.addEventListener('hashchange', () => { traiterRetourCompte(); rendre(); });
  document.addEventListener('submit', (ev) => { const f = ev.target.closest('[data-form]'); if (!f) return; ev.preventDefault(); if (f.dataset.form === 'alerte') { const c = document.getElementById('alerte-mot'); ajouterAlerte(c ? c.value : ''); rendre(); const c2 = document.getElementById('alerte-mot'); if (c2) c2.focus(); return; } soumettreCompte(f); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && minuterieSync) envoyerSync(); });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'plat-cherche') { S.chercheIngPlat = ev.target.value; const pos = ev.target.selectionStart; rendre(); const c = document.getElementById('plat-cherche'); if (c) { c.focus(); try { c.setSelectionRange(pos, pos); } catch (e) { /* */ } } return; }
    if (ev.target.dataset && ev.target.dataset.a === 'plat-qte' && edPlat) { const v = parseFloat(ev.target.value.replace(',', '.')); if (v > 0) edPlat.ing[+ev.target.dataset.i][1] = v; return; }
    if (ev.target.id === 'promo-cherche') { S.cherchePromo = ev.target.value; const pos = ev.target.selectionStart; rendre(); const c = document.getElementById('promo-cherche'); if (c) { c.focus(); try { c.setSelectionRange(pos, pos); } catch (e) { /* */ } } return; }
    if (ev.target.id === 'affiche-titre') { S.afficheOpts = { ...optsAffiche(), titre: ev.target.value.slice(0, 48) }; const t = document.querySelector('.aff-titre'); if (t) t.textContent = S.afficheOpts.titre || 'Au menu cette semaine'; sauver(); return; }
    const el = ev.target;
    if (el.dataset.a === 'kcal-champ') {
      S.calcKcal = S.calcKcal || {};
      S.calcKcal[el.dataset.k] = el.value;
      const z = document.getElementById('kcal-resultat'); if (z) z.innerHTML = resultatKcal(calculRepere());
      sauver(); return;
    }
    if (el.dataset.a === 'scan-g' && S.scanCarnet) {
      const g = parseFloat(String(el.value).replace(',', '.'));
      if (g > 0 && g < 5000) { S.scanCarnet.grammes = g; const z = document.getElementById('scan-resume'); if (z) z.innerHTML = resumeScan(); document.querySelectorAll('[data-a=scan-qte]').forEach((b) => b.setAttribute('aria-pressed', String(Math.abs(+b.dataset.g - g) < 0.01))); }
      return;
    }
    if (el.dataset.a === 'jaica-cherche') {
      const t = el.value.trim();
      const z = document.getElementById('jaica-propositions');
      const ids = t.length < 2 ? [] : window.Saisie.chercherIngredients(t, 10).filter((id) => E.ING[id] && !E.ING[id].perso && !S.jaiCa.ids.includes(id));
      if (z && t.length >= 2) z.innerHTML = ids.map((id) => `<button class="chip puce-ajout" data-a="jaica-ajouter" data-id="${id}">+ ${EMOJI[id] || ''} ${esc(E.ING[id].nom)}${E.ingredientInterdit(E.ING[id], S.profil) ? ' <span class="small alerte-ing">(profil)</span>' : ''}</button>`).join('') || '<span class="small muted">Aliment inconnu de Budgétable.</span>';
      return;
    }
    if (el.dataset.a === 'journal-cherche') {
      S.rechercheJournal = el.value;
      // on redessine seulement la liste des jours pour garder le curseur dans le champ
      const html = ongletJournal();
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      const z = document.getElementById('journal-jours'), n = tmp.querySelector('#journal-jours');
      if (z && n) z.innerHTML = n.innerHTML;
      return;
    }
    if (el.dataset.a === 'carnet-cherche') {
      const z = document.getElementById('carnet-resultats');
      const t = el.value.trim();
      clearTimeout(minuterieOFF);
      if (z) z.innerHTML = resultatsCarnet(t, null);
      if (t.length >= 3) minuterieOFF = setTimeout(() => chercherOFF(t), 600);
      return;
    }
    if (el.dataset.a === 'ticket-libelle') { const l = S.ticket.lignes[+el.dataset.i]; l.libelle = el.value; l.poids = TK.poidsDe(el.value); return; }
    if (el.dataset.a === 'ticket-prix') { const v = Number(el.value.replace(',', '.')); if (v >= 0) { const l = S.ticket.lignes[+el.dataset.i]; l.prix = v; l.prixUnitaire = Math.round(v / (l.qte || 1) * 100) / 100; } return; }
    if (el.dataset.a === 'ticket-cherche') {
      const z = document.getElementById('ticket-propositions'), i = el.dataset.i, t = el.value.trim();
      if (z) z.innerHTML = (t.length < 2 ? [] : window.Saisie.chercherIngredients(t, 8).filter((id) => E.ING[id] && !E.ING[id].perso)).map((id) => `<button class="chip chip-petit" data-a="ticket-choisir" data-i="${i}" data-id="${id}">${esc(E.ING[id].nom)}</button>`).join('') + `<button class="chip chip-petit" data-a="ticket-choisir" data-i="${i}" data-id="">Pas dans la liste</button>`;
      return;
    }
    if (el.dataset.a === 'prog-champ') {
      S.progForm[el.dataset.k] = el.value.trim();
      const z = document.getElementById('prog-resultat'); if (z) z.innerHTML = resultatBilanMinceur();
      return;
    }
    if (el.dataset.a === 'sp-champ') { S.sportForm[el.dataset.k] = el.value.trim(); const z = document.getElementById('sp-etat'); if (z) z.innerHTML = etatBilanSport(); return; }
    if (el.dataset.a === 'prog-pesee') { S.progPoint = { ...(S.progPoint || {}), kg: el.value.trim() }; return; }
    if (el.dataset.a === 'manuel-cherche') {
      const z = document.getElementById('manuel-propositions');
      if (z) z.innerHTML = propositionsManuelles(el.value.trim());
      return;
    }
    if (el.dataset.a === 'gout-cherche') {
      const z = document.getElementById('gout-propositions');
      if (z) z.innerHTML = propositionsGout(el.value.trim());
      return;
    }
    if (el.dataset.a === 'stock-cherche') {
      const t = el.value.trim();
      const z = document.getElementById('stock-propositions');
      if (z) z.innerHTML = t.length < 2 ? '' : (window.Saisie.chercherIngredients(t, 14).map((id) => `<button class="chip puce-ajout" data-a="stock-ajouter" data-id="${id}">+ ${esc(E.ING[id].nom)}</button>`).join('') || '<span class="small muted">Produit inconnu de Budgétable : il ne peut pas être suivi.</span>');
      return;
    }
    if (el.dataset.a === 'recherche-plat' && choix) {
      choix.recherche = el.value;
      const zone = document.getElementById('resultats-plat');
      if (zone) zone.innerHTML = resultatsRecherche();
      return;
    }
    if (el.dataset.a === 'ed-champ' && edition) {
      edition[el.dataset.k] = el.value;
      if (el.dataset.k === 'nom') { const z = document.getElementById('liens-recherche'); if (z) z.innerHTML = liensRecherche(el.value); }
      if (el.dataset.k === 'lien') {
        clearTimeout(minuterieLien);
        // lien collé : on lit la recette tout de suite (petit délai si la personne tape)
        if (lienValide(el.value) && !(edition.lecture && edition.lecture.lien === el.value.trim())) minuterieLien = setTimeout(lireLien, ev.inputType === 'insertFromPaste' ? 50 : 900);
      }
      return;
    }
    if (el.dataset.a === 'ed-qte' && edition) {
      const v = parseFloat(String(el.value).replace(',', '.'));
      if (v > 0) edition.ing[+el.dataset.i].q = v / (edition.personnes || 1);
      return;
    }
    if (el.dataset.a === 'ajout-ing' && edition) {
      const t = el.value.trim();
      const zone = document.getElementById('propositions-ing');
      if (zone) {
        const ids = window.Saisie.chercherIngredients(t, 16).filter((id) => !edition.ing.some((y) => y.id === id && y.coche));
        zone.innerHTML = t.length < 2 ? '' : ids.map((id) => `<button class="chip" data-a="ajout-ing-choisir" data-id="${id}">+ ${esc(E.ING[id].nom)}</button>`).join('')
          + `<button class="chip" data-a="ajout-ing-libre" data-nom="${esc(t)}">+ « ${esc(t)} » tel quel</button>`;
      }
      return;
    }
    if (el.dataset.a === 'courses-prix') {
      const v = parseFloat(String(el.value).replace(',', '.'));
      if (v > 0 && v < 1000) S.modeCourses.prix[el.dataset.id] = Math.round(v * 100) / 100; else delete S.modeCourses.prix[el.dataset.id];
      sauver();
      return;
    }
    if (el.dataset.a === 'prenom') {
      const n = [...(S.profil.prenomsEnfants || [])];
      n[+el.dataset.i] = el.value.slice(0, 20);
      S.profil.prenomsEnfants = n;
      sauver();
      return;
    }
    if (el.dataset.a === 'calc-champ') {
      const c = S.budgetCalc = S.budgetCalc || { charges: {} };
      const k = el.dataset.k;
      if (k.startsWith('c:')) { c.charges = c.charges || {}; c.charges[k.slice(2)] = el.value; } else c[k] = el.value;
      const z = document.getElementById('calc-resultat'); if (z) z.innerHTML = resultatCalcul();
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
  // info-bulle des graphiques (survol ou toucher)
  function bulle(ev) {
    const g = ev.target.closest && ev.target.closest('[data-tip]');
    let b = document.getElementById('bulle-graphe');
    if (!g) { if (b) b.hidden = true; return; }
    if (!b) { b = document.createElement('div'); b.id = 'bulle-graphe'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.textContent = g.dataset.tip; b.hidden = false;
    const r = g.getBoundingClientRect();
    b.style.left = Math.min(window.innerWidth - b.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - b.offsetWidth / 2)) + 'px';
    b.style.top = Math.max(8, r.top - b.offsetHeight - 6) + 'px';
  }
  document.addEventListener('pointerover', bulle);
  document.addEventListener('pointerdown', bulle);
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.a === 'drive-champ' && el.type === 'number') rendre();
    if (el.dataset.a === 'repas-fait') { S.repasDecoches = S.repasDecoches || {}; S.repasDecoches[el.dataset.k] = !el.checked; return; }
    if (el.dataset.a === 'jaica-placard') { S.jaiCa.placard = el.checked; rendre(); return; }
    if (el.dataset.a === 'partage-cocher') { let c = {}; try { c = JSON.parse(localStorage.getItem(el.dataset.cle) || '{}'); } catch (e) { /* */ } c[el.dataset.k] = el.checked; try { localStorage.setItem(el.dataset.cle, JSON.stringify(c)); } catch (e) { /* */ } rendre(); return; }
    if (el.dataset.a === 'promo-tri') { S.triPromo = el.value; rendre(); return; }
    if (el.dataset.a === 'affiche-opt') { S.afficheOpts = { ...optsAffiche(), [el.dataset.k]: el.checked }; rendre(); return; }
    if (el.dataset.a === 'jaica-basiques') { S.jaiCa.basiques = el.checked; rendre(); return; }
    if (el.dataset.a === 'presences-garder') {
      S.presencesGarder = el.checked;
      S.profil.presences = el.checked && S.plan && S.plan.presences ? { ...S.plan.presences } : (el.checked ? S.profil.presences : null);
      toast(el.checked ? 'Ces habitudes serviront pour les prochaines semaines' : 'Les prochaines semaines repartiront de votre profil');
      sauver(); return;
    }
    if (el.dataset.a === 'carnet-scan') { scannerPhoto(el.files && el.files[0]); el.value = ''; return; }
    if (el.dataset.a === 'photo-produit') { photoProduit(el.files && el.files[0]); el.value = ''; return; }
    if (el.dataset.a === 'photo-placard') { photoPlacard(el.files && el.files[0]); el.value = ''; return; }
    if (el.dataset.a === 'ticket-photo') { const fi = el.files && el.files[0]; el.value = ''; if (fi && S.ticket) { S.ticket.erreur = ''; lirePhotoTicket(fi); } return; }
    if (el.dataset.a === 'ed-photo' && edition) { photoPerso(el.files && el.files[0]); return; }
    if (el.dataset.a === 'ed-ing' && edition) { edition.ing[+el.dataset.i].coche = el.checked; rendre(); return; }
    if (el.dataset.a === 'ed-extra' && edition) { edition.extras[+el.dataset.i].coche = el.checked; rendre(); return; }
    if (el.dataset.a === 'ed-proposer' && edition) { edition.proposer = el.checked; return; }
    if (el.dataset.a === 'ed-champ' && edition && el.tagName === 'SELECT') { edition[el.dataset.k] = el.value; return; }
    if (el.dataset.a === 'rituel') {
      const r = { ...(S.profil.rituels || {}) };
      if (el.value) r[el.dataset.j] = el.value; else delete r[el.dataset.j];
      S.profil.rituels = r; S.rituelsVus = true; S.rituelsModifies = true; S.rituelsOuverts = true;
      rendre();
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.id === 'coach-s-texte') { ev.preventDefault(); envoyerCoachSport(ev.target.value); return; }
    if (ev.key === 'Escape' && S.seance && !S.seance.fin) { S.seance.pause = true; rendre(); return; }
    if (ev.key === 'Enter' && ev.target.id === 'coach-m-texte') { ev.preventDefault(); envoyerCoachMinceur(ev.target.value); return; }
    if (ev.key === 'Enter' && ev.target.id === 'manuel-cherche') { ev.preventDefault(); const b = document.querySelector('[data-a="manuel-ajouter-texte"]'); if (b) b.click(); return; }
    if (ev.key === 'Enter' && ev.target.id === 'ed-nom' && edition) { ev.preventDefault(); edition.nom = ev.target.value; if (edition.nom.trim().length >= 2) { devinerEdition(); rendre(); } return; }
    if (ev.key === 'Escape' && S.deplacer) { S.deplacer = null; rendre(); return; }
    if (ev.key === 'Escape' && S.aideInstall) { S.aideInstall = false; rendre(); return; }
    if (ev.key === 'Escape' && S.prospectusOuvert) { S.prospectusOuvert = null; rendre(); return; }
    if (ev.key === 'Escape' && compte.vue) { compte.vue = null; rendre(); return; }
    if (ev.key === 'Escape' && S.envoiOuvert) { S.envoiOuvert = false; rendre(); return; }
    if (ev.key === 'Escape' && S.gamellesOuvert) { S.gamellesOuvert = false; rendre(); return; }
    if (ev.key === 'Escape' && S.afficheOuverte) { S.afficheOuverte = false; rendre(); return; }
    if (ev.key === 'Escape' && edition) { edition = null; rendre(); return; }
    if (ev.key === 'Escape' && auMenu) { auMenu = null; rendre(); return; }
    if (ev.key === 'Escape' && fiche) { fiche = null; rendre(); } else if (ev.key === 'Escape' && choix) { choix = null; rendre(); } else if (ev.key === 'Escape' && S.modeCourses && S.modeCourses.ouvert) { S.modeCourses.ouvert = false; rendre(); }
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
      else if (code === 'rate_limited') S.ia.message = e.message || 'L’assistant est très sollicité : réessayez dans quelques minutes.';
      else if (code === 'reseau') S.ia.message = 'Pas de connexion : réessayez.';
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
    if (!texte || !fiche) return;
    if (!chef || chef.cle !== cleFiche()) chef = { cle: cleFiche(), tours: [], attente: false, message: '' };
    const repLocale = () => {
      const m = fiche.recette ? { recette: fiche.recette, portions: fiche.parts || (E.REC[fiche.recette].gourmand ? E.REC[fiche.recette].parts : E.portions(S.profil, aujourdhui(), 'diner')) } : S.plan.jours[fiche.jour][fiche.slot];
      return window.Commis.repondre(texte, E.REC[m.recette], m.portions, S.profil, E);
    };
    const secours = repLocale();
    if (!iaDispo) {
      if (chef.attente) return;
      chef.tours.push({ role: 'user', content: texte.slice(0, 500) }, { role: 'assistant', content: secours });
      rendre();
      return;
    }
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
      if (code !== 'cancelled') { moi.tours.push({ role: 'assistant', content: secours }); moi.attente = false; if (chef === moi) rendre(); return; }
      else if (code === 'rate_limited') moi.message = e.message || 'Le commis est très sollicité : réessayez dans quelques minutes.';
      else if (code === 'reseau') moi.message = 'Pas de connexion : réessayez.';
      else if (code !== 'cancelled') moi.message = 'Le commis n’a pas pu répondre. Réessayez.';
      moi.tours.pop();
    }
    moi.attente = false;
    if (chef === moi) rendre();
  }

  // l'assistant IA est celui du site (lecteur Budgétable sur Render) : aucun compte à créer pour les visiteurs
  const assistantSite = {
    async json(messages) {
      let rep;
      try {
        rep = await fetch(`${LECTEUR}/ia`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ messages }), signal: AbortSignal.timeout ? AbortSignal.timeout(70000) : undefined });
      } catch (e) { throw Object.assign(new Error('reseau'), { code: 'reseau' }); }
      const j = await rep.json().catch(() => ({}));
      if (rep.status === 503) throw Object.assign(new Error('non configuré'), { code: 'not_granted' });
      if (rep.status === 429) throw Object.assign(new Error(j.erreur || ''), { code: 'rate_limited', message: j.erreur });
      if (!rep.ok) throw Object.assign(new Error(j.erreur || ''), { code: 'erreur' });
      return j;
    }
  };
  async function detecterIA() {
    try {
      const r = await fetch(`${LECTEUR}/ia/etat`, { signal: AbortSignal.timeout ? AbortSignal.timeout(70000) : undefined });
      const j = await r.json();
      iaDispo = j && j.disponible ? assistantSite : false;
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
  // raccourcis de l'appli installée (appui long sur l'icône) : ?onglet=courses…
  try {
    const q = new URLSearchParams(location.search);
    const o = q.get('onglet');
    if (o && ['semaine', 'soir', 'courses', 'promos', 'recettes', 'placard', 'profil'].includes(o) && S.plan) { S.vue = 'app'; S.onglet = o; }
    if (q.has('onglet') || q.has('source')) history.replaceState(null, '', location.pathname + location.hash);
  } catch (e) { /* */ }
  // retour depuis un lien reçu par e-mail (confirmation, connexion, nouveau mot de passe)
  function traiterRetourCompte() {
    const r = C.lireRetour ? C.lireRetour() : null;
    if (r && r.erreur) compte = { ...compte, vue: 'connexion', erreur: r.erreur };
    else if (r) {
      if (r.type === 'recovery') compte = { ...compte, vue: 'nouveau-mdp', msg: 'Choisissez votre nouveau mot de passe.' };
      else setTimeout(() => toast(r.type === 'signup' ? 'Adresse confirmée : bienvenue sur Budgétable !' : 'Connecté'), 600);
      synchroniserConnexion();
    }
    return !!r;
  }
  if (!traiterRetourCompte() && C.connecte()) synchroniserConnexion();
  // alertes promos : on vérifie les offres de la semaine en arrière-plan
  if ((S.alertesPromos || []).length) { if (promos && promos.etat === 'ok') setTimeout(notifierAlertes, 800); else setTimeout(() => chargerPromos(false), 1500); }
  // une semaine déjà enregistrée peut contenir deux fois le même plat : on remplace le second
  if (S.plan && E.dedoublonner) {
    try {
      const d = E.dedoublonner(S.plan, S.profil, { ...optsMoteur(), verrous: Object.keys(S.deduits || {}) });
      if (d.changes.length) { S.plan = d.plan; setTimeout(() => toast(d.changes.length > 1 ? `${d.changes.length} plats en double remplacés dans votre semaine` : `Plat en double remplacé : ${E.REC[d.changes[0].apres].nom}`), 600); }
    } catch (e) { /* on garde la semaine telle quelle */ }
  }
  detecterIA();
  if (S.vue === 'app' && !S.plan) S.vue = 'accueil';
  rendre();
  if ('serviceWorker' in navigator && !DANS_UN_CADRE && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible */ });
  }
})();
