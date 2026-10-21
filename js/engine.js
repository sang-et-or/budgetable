/* Budgétable — moteur (V0.1)
 * Fonctions pures, sans accès à l'écran ni au stockage : le même fichier
 * tournera côté serveur à la V0.3. Testé par tests/engine.test.js.
 */
(function (root) {
  const NODE = typeof module !== 'undefined' && module.exports;
  const DATA = NODE ? require('./data.js') : root.MENU_DATA;
  const MOD = NODE ? require('./modeles.js') : root.MENU_MODELES;

  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const SLOTS = ['dejeuner', 'diner'];
  const AGE_FACTEUR = { '0-2': 0.3, '3-5': 0.5, '6-10': 0.7, '11-14': 0.9, '15-17': 1.1 };
  const PERISSABLES = new Set(['Fruits et légumes', 'Viandes et poissons', 'Crèmerie et frais']);

  // Aliments refusés → ingrédients concernés
  const REFUS = {
    poisson: (i) => i.tags.includes('poisson'),
    champignons: (i) => i.id === 'champignon',
    epinards: (i) => i.id === 'epinards',
    poivrons: (i) => i.id === 'poivron',
    aubergine: (i) => i.id === 'aubergine',
    lentilles: (i) => i.id.startsWith('lentilles'),
    tofu: (i) => i.id === 'tofu',
    porc: (i) => i.tags.includes('porc'),
    fromage: (i) => ['emmental', 'mozzarella', 'feta'].includes(i.id),
    courge: (i) => i.id === 'courge'
  };

  /* ---------- outils ---------- */
  function rng(seed) { // mulberry32 : tirage reproductible
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const round2 = (n) => Math.round(n * 100) / 100;
  const idx = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  const ING = idx(DATA.ingredients);

  /* ---------- génération des recettes à partir des familles de plats ---------- */
  function majuscule(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function genererRecettes() {
    const out = [];
    const { LEX, Q, LEGERS, modeles } = MOD;
    for (const m of modeles) {
      const legsCombos = [];
      if (m.nLegs === 2) { for (let i = 0; i < m.legs.length; i++) for (let j = i + 1; j < m.legs.length; j++) legsCombos.push([m.legs[i], m.legs[j]]); }
      else for (const l of m.legs) legsCombos.push([l]);
      const fecs = m.fecs.length ? m.fecs : [null];
      const variantes = m.variantes || [{ id: '', nom: '', ing: [], etape: '' }];
      for (const pid of m.prots) for (const legs of legsCombos) for (const fid of fecs) for (const v of variantes) {
        const c = { pid, p: LEX[pid], l1: LEX[legs[0]], l2: legs[1] ? LEX[legs[1]] : null, f: fid ? LEX[fid] : null, v };
        const qp = (m.qProt && m.qProt[pid]) || Q[pid] * (m.protFixe ? 0.5 : 1);
        const ing = [...m.base, [pid, qp]];
        legs.forEach((l) => ing.push([l, legs.length === 2 ? Q.legume2 : Q.legume1]));
        if (fid) ing.push([fid, Q[fid]]);
        v.ing.forEach((x) => ing.push(x));
        const fusion = {};
        for (const [id, q] of ing) fusion[id] = (fusion[id] || 0) + q;
        const tags = [...(m.tags || [])];
        if (LEGERS.includes(pid) && !tags.includes('leger') && m.id !== 'gratin' && m.id !== 'quiche') tags.push('leger');
        if (['poulet_filet', 'boeuf_hache', 'saumon', 'colin', 'thon', 'tofu', 'pois_chiches', 'lentilles_corail', 'lentilles_vertes', 'haricots_rouges', 'saucisse'].includes(pid)) tags.push('proteines');
        out.push({
          id: ['g', m.id, pid, ...legs, fid || '', v.id].filter(Boolean).join('-'),
          nom: majuscule(m.nom(c).replace(/\s+/g, ' ').replace(' ,', ',').trim()),
          repas: m.repas, temps: m.temps + (fid === 'pomme_de_terre' ? 10 : 0), niveau: m.niveau, equip: m.equip,
          cuisine: m.cuisine, tags, modele: m.id, forme: m.forme, prot: pid, sig: [m.id, pid, ...legs].join('-'),
          ing: Object.entries(fusion), etapes: m.etapes(c).filter(Boolean)
        });
      }
    }
    return out;
  }
  DATA.recettes.forEach((r) => { r.modele = r.modele || 'maison'; r.prot = r.prot || (r.ing.find(([id]) => ING[id].groupe === 'P') || [])[0]; });
  const RECETTES = DATA.recettes.concat(genererRecettes());
  const REC = idx(RECETTES);
  const MODELES = Object.fromEntries(MOD.modeles.map((m) => [m.id, { libelle: m.libelle, forme: m.forme }]).concat([['maison', { libelle: 'Recettes maison', forme: 'assiette' }]]));

  /* ---------- profil ---------- */
  function profilParDefaut() {
    return {
      foyer: { adultes: 1, enfants: [] },
      objectifs: ['equilibre'],
      seancesSport: 0,
      regime: 'aucun',
      allergies: [],
      allergiesNonRenseignees: false,
      consentementSante: false,
      temps: { semaine: 30, weekend: 60 },
      niveau: 'alaise',
      equipement: ['plaque', 'four', 'micro'],
      cuisines: [],
      refus: [],
      enfantsMode: 'pareil',
      dejeuners: { mode: 'maison', adultesMaison: 1, enfantsMaison: 'oui' },
      budget: 60,
      placardBase: true,
      provisions: [],
      gouts: { ing: {}, cuisine: {}, modele: {} }
    };
  }

  function facteurAdulte(p) {
    if (p.objectifs.includes('muscle')) return 1.2;
    if (p.objectifs.includes('perte')) return 0.9;
    return 1;
  }

  /** Nombre de portions « adulte » pour un repas donné. */
  function portions(p, jour, slot) {
    const fa = facteurAdulte(p);
    let adultes = p.foyer.adultes;
    let enfants = p.foyer.enfants;
    if (slot === 'dejeuner' && jour < 5 && p.dejeuners && p.dejeuners.mode === 'dehors') {
      adultes = Math.min(p.dejeuners.adultesMaison, p.foyer.adultes);
      const em = p.dejeuners.enfantsMaison;
      const presents = em === 'oui' || (em === 'mercredi' && jour === 2);
      if (!presents) enfants = [];
    }
    const total = adultes * fa + enfants.reduce((s, a) => s + (AGE_FACTEUR[a] || 0.7), 0);
    return Math.round(total * 10) / 10;
  }

  /* ---------- filtres de sécurité et de goûts ---------- */
  function ingredientInterdit(ing, p) {
    for (const a of p.allergies) if (ing.tags.includes(a)) return 'allergie : ' + a;
    if (p.regime === 'vegetarien' && (ing.tags.includes('viande') || ing.tags.includes('poisson'))) return 'végétarien';
    if (p.regime === 'vegetalien' && ing.tags.includes('animal')) return 'végétalien';
    if ((p.regime === 'sans_porc' || p.regime === 'halal') && ing.tags.includes('porc')) return 'sans porc';
    for (const r of p.refus) if (REFUS[r] && REFUS[r](ing)) return 'n’aime pas : ' + r;
    return null;
  }

  /** Une recette est-elle compatible avec le profil (hors contrainte de temps) ? */
  function recetteCompatible(rec, p) {
    for (const [id] of rec.ing) {
      const raison = ingredientInterdit(ING[id], p);
      if (raison) return { ok: false, raison };
    }
    for (const e of rec.equip) if (!p.equipement.includes(e)) return { ok: false, raison: 'équipement : ' + e };
    if (p.niveau === 'debutant' && rec.niveau >= 3) return { ok: false, raison: 'niveau' };
    if (p.refus.includes('epice') && rec.tags.includes('epice')) return { ok: false, raison: 'épicé' };
    return { ok: true };
  }

  const cacheCompat = new Map();
  function recettesCompatibles(p) {
    const cle = JSON.stringify([p.allergies, p.regime, p.refus, p.equipement, p.niveau]);
    if (!cacheCompat.has(cle)) {
      if (cacheCompat.size > 50) cacheCompat.clear();
      cacheCompat.set(cle, RECETTES.filter((r) => recetteCompatible(r, p).ok));
    }
    return cacheCompat.get(cle);
  }
  const contientViande = (rec) => rec.ing.some(([id]) => ING[id].tags.includes('viande'));
  const cacheCout = new Map();
  function coutPortion(rec) {
    if (!cacheCout.has(rec.id)) cacheCout.set(rec.id, rec.ing.reduce((s, [id, q]) => s + q * ING[id].prixDemo / ING[id].cond, 0));
    return cacheCout.get(rec.id);
  }
  const tempsMax = (p, jour) => (jour < 5 ? p.temps.semaine : p.temps.weekend);

  /* ---------- équilibre (qualitatif en V0.1 ; apports Ciqual en V0.2) ---------- */
  function equilibre(rec) {
    const g = new Set(rec.ing.map(([id]) => ING[id].groupe));
    const legumes = rec.ing.filter(([id]) => ING[id].groupe === 'L' && ING[id].unite === 'g').reduce((s, [, q]) => s + q, 0)
      + rec.ing.filter(([id]) => ING[id].groupe === 'L' && ING[id].unite === 'pièce').length * 60;
    return { legumes: g.has('L'), feculent: g.has('F'), proteine: g.has('P'), grammesLegumes: Math.round(legumes) };
  }

  /* ---------- génération ---------- */
  function score(rec, p, ctx, r) {
    let s = r() * 3;
    if (p.cuisines.includes(rec.cuisine)) s += 1.5;
    if (p.foyer.enfants.length && p.enfantsMode === 'simple' && rec.tags.includes('enfants')) s += 2;
    if ((p.objectifs.includes('muscle') || p.seancesSport >= 2) && rec.tags.includes('proteines')) s += 2;
    if (p.objectifs.includes('perte') && rec.tags.includes('leger')) s += 2;
    if (p.objectifs.includes('legumes')) s += equilibre(rec).grammesLegumes / 100;
    if (p.objectifs.includes('rapide')) s -= rec.temps / 30;
    s -= coutPortion(rec) * (p.objectifs.includes('economies') ? 1.5 : 0.5);
    const note = ctx.notes[rec.id];
    if (note) s += (note - 3) * 1.5;
    // anti-gaspillage : bonus si on réutilise un produit frais déjà entamé
    let reprises = 0;
    for (const [id, q] of rec.ing) {
      const ing = ING[id];
      if (!PERISSABLES.has(ing.rayon) || !ctx.quantites[id]) continue;
      const reste = Math.ceil(ctx.quantites[id] / ing.cond) * ing.cond - ctx.quantites[id];
      if (reste >= q * 0.5) reprises++;
    }
    s += Math.min(reprises, 2) * (p.objectifs.includes('economies') ? 1.5 : 0.8);
    if (ctx.sigs[rec.sig || rec.id]) s -= 8; // même plat avec une autre épice ou un autre féculent
    s -= (ctx.utilisations[rec.id] || 0) * 6;
    s -= (ctx.modeles[rec.modele] || 0) * (rec.modele === 'maison' ? 0.3 : 1.8);
    s -= Math.max(0, (ctx.prots[rec.prot] || 0) - 1) * 1.2;
    if (ctx.hier && ctx.hier.includes(rec.id)) s -= 3;
    s += scoreGout(rec, p.gouts);
    return s;
  }

  function candidats(p, jour, slot, ctx, exclure = []) {
    const base = recettesCompatibles(p).filter((r) => r.repas.includes(slot) && !exclure.includes(r.id) && ctx.notes[r.id] !== 1);
    const flexi = p.regime === 'flexitarien' && ctx.repasViande >= 3;
    let liste = base.filter((r) => r.temps <= tempsMax(p, jour) && !(flexi && contientViande(r)));
    if (!liste.length) liste = base.filter((r) => r.temps <= tempsMax(p, jour) + 15 && !(flexi && contientViande(r)));
    if (!liste.length) liste = base;
    return liste;
  }

  function ajouterAuContexte(ctx, rec, nb) {
    ctx.utilisations[rec.id] = (ctx.utilisations[rec.id] || 0) + 1;
    ctx.modeles[rec.modele] = (ctx.modeles[rec.modele] || 0) + 1;
    ctx.sigs[rec.sig || rec.id] = true;
    if (rec.prot) ctx.prots[rec.prot] = (ctx.prots[rec.prot] || 0) + 1;
    if (contientViande(rec)) ctx.repasViande++;
    for (const [id, q] of rec.ing) ctx.quantites[id] = (ctx.quantites[id] || 0) + q * nb;
  }

  function nouveauContexte(notes) {
    return { utilisations: {}, modeles: {}, prots: {}, sigs: {}, quantites: {}, repasViande: 0, notes: notes || {}, hier: null };
  }

  /** Génère 7 déjeuners + 7 dîners. */
  function genererSemaine(p, opts = {}) {
    const seed = opts.seed != null ? opts.seed : 1;
    const r = rng(seed);
    const ctx = nouveauContexte(opts.notes);
    const jours = [];
    const alertes = [];
    if (recettesCompatibles(p).length < 14) {
      alertes.push('Peu de recettes correspondent à vos critères : certaines reviendront plusieurs fois dans la semaine.');
    }
    for (let j = 0; j < 7; j++) {
      const jourPlan = { jour: JOURS[j] };
      const aujourdHui = [];
      for (const slot of SLOTS) {
        const nb = portions(p, j, slot);
        if (nb <= 0) { jourPlan[slot] = null; continue; }
        const liste = candidats(p, j, slot, ctx, aujourdHui);
        if (!liste.length) { jourPlan[slot] = null; alertes.push(`Aucune recette compatible pour ${JOURS[j]} (${slot}).`); continue; }
        let best = null, bestS = -Infinity;
        for (const rec of liste) { const s = score(rec, p, ctx, r); if (s > bestS) { bestS = s; best = rec; } }
        ajouterAuContexte(ctx, best, nb);
        aujourdHui.push(best.id);
        jourPlan[slot] = { recette: best.id, portions: nb };
      }
      ctx.hier = aujourdHui;
      jours.push(jourPlan);
    }
    return { seed, jours, alertes, remplacements: 0 };
  }

  function contexteDepuisPlan(plan, notes, sauf) {
    const ctx = nouveauContexte(notes);
    plan.jours.forEach((jp, j) => SLOTS.forEach((slot) => {
      if (!jp[slot] || (sauf && sauf.jour === j && sauf.slot === slot)) return;
      ajouterAuContexte(ctx, REC[jp[slot].recette], jp[slot].portions);
    }));
    return ctx;
  }

  /** Remplace un repas par la meilleure alternative (différente de l'actuelle). */
  function remplacerRepas(plan, jour, slot, p, opts = {}) {
    const actuel = plan.jours[jour][slot];
    if (!actuel) return plan;
    const ctx = contexteDepuisPlan(plan, opts.notes, { jour, slot });
    const autreSlot = slot === 'dejeuner' ? 'diner' : 'dejeuner';
    const memeJour = plan.jours[jour][autreSlot] ? [plan.jours[jour][autreSlot].recette] : [];
    const r = rng((plan.seed * 31 + jour * 7 + (slot === 'diner' ? 3 : 1) + (plan.remplacements + 1) * 101) >>> 0);
    let liste = candidats(p, jour, slot, ctx, [actuel.recette, ...memeJour, ...(opts.exclure || [])]);
    if (!liste.length) return plan;
    let best = null, bestS = -Infinity;
    for (const rec of liste) { const s = score(rec, p, ctx, r); if (s > bestS) { bestS = s; best = rec; } }
    const jours = plan.jours.map((jp, i) => (i === jour ? { ...jp, [slot]: { ...actuel, recette: best.id } } : jp));
    return { ...plan, jours, remplacements: plan.remplacements + 1 };
  }

  /* ---------- liste de courses et budget ---------- */
  const PLACARD_BASE = ['huile_olive', 'curry', 'cumin', 'paprika', 'bouillon', 'moutarde'];
  function stockIds(p) {
    const s = new Set(p.provisions);
    if (p.placardBase) PLACARD_BASE.forEach((id) => s.add(id));
    return s;
  }

  function listeCourses(plan, p) {
    const besoins = {};
    plan.jours.forEach((jp) => SLOTS.forEach((slot) => {
      const m = jp[slot];
      if (!m) return;
      for (const [id, q] of REC[m.recette].ing) besoins[id] = (besoins[id] || 0) + q * m.portions;
    }));
    const stock = stockIds(p);
    const articles = Object.entries(besoins).map(([id, q]) => {
      const ing = ING[id];
      const conditionnements = Math.ceil(q / ing.cond - 1e-9);
      const cout = round2(conditionnements * ing.prixDemo);
      return {
        id, nom: ing.nom, rayon: ing.rayon, unite: ing.unite, quantite: q,
        conditionnements, condLabel: ing.condLabel, cout,
        enStock: stock.has(id), reste: conditionnements * ing.cond - q
      };
    }).sort((a, b) => a.rayon.localeCompare(b.rayon, 'fr') || a.nom.localeCompare(b.nom, 'fr'));
    const total = round2(articles.filter((a) => !a.enStock).reduce((s, a) => s + a.cout, 0));
    const economieStock = round2(articles.filter((a) => a.enStock).reduce((s, a) => s + a.cout, 0));
    // coût de ce qui est réellement mangé cette semaine (le reste des paquets sert ensuite)
    const consomme = round2(articles.filter((a) => !a.enStock).reduce((s, a) => s + a.quantite * ING[a.id].prixDemo / ING[a.id].cond, 0));
    return { articles, total, consomme, economieStock, source: DATA.PRIX_SOURCE };
  }

  function coutRepas(m) { return round2(coutPortion(REC[m.recette]) * m.portions); }

  function analyseBudget(plan, p) {
    const liste = listeCourses(plan, p);
    const ecart = round2(liste.total - p.budget);
    const conseils = [];
    if (ecart > 0) {
      conseils.push('Remplacer les repas les plus chers par des plats à base de légumineuses ou d’œufs (bouton « Ajuster au budget »).');
      if (p.regime !== 'vegetarien' && p.regime !== 'vegetalien') conseils.push('Passer 2 ou 3 repas avec viande en version végétarienne.');
      conseils.push('Indiquer vos provisions déjà présentes : elles sont retirées du total.');
      if (p.dejeuners.mode === 'maison') conseils.push('Si certains déjeunent dehors en semaine, le préciser dans le profil.');
    }
    return { estimation: liste.total, consomme: liste.consomme, budget: p.budget, ecart, ok: ecart <= 0, conseils, source: DATA.PRIX_SOURCE };
  }

  function moinsCheres(liste, n) {
    const tri = [];
    for (const r of liste) {
      const c = coutPortion(r);
      if (tri.length < n) { tri.push([c, r]); tri.sort((a, b) => a[0] - b[0]); }
      else if (c < tri[n - 1][0]) { tri[n - 1] = [c, r]; tri.sort((a, b) => a[0] - b[0]); }
    }
    return tri.map((x) => x[1]);
  }

  /** Remplace les repas les plus chers jusqu'à tenir le budget (ou ne plus progresser). */
  function ajusterAuBudget(plan, p, opts = {}) {
    let courant = plan;
    const changements = [];
    for (let iter = 0; iter < 14; iter++) {
      const total = listeCourses(courant, p).total;
      if (total <= p.budget) break;
      const repas = [];
      courant.jours.forEach((jp, j) => SLOTS.forEach((slot) => { if (jp[slot]) repas.push({ j, slot, cout: coutRepas(jp[slot]) }); }));
      repas.sort((a, b) => b.cout - a.cout);
      let progres = false;
      for (const { j, slot } of repas) {
        const actuel = courant.jours[j][slot];
        const ctx = contexteDepuisPlan(courant, opts.notes, { jour: j, slot });
        const autre = courant.jours[j][slot === 'dejeuner' ? 'diner' : 'dejeuner'];
        const liste = moinsCheres(candidats(p, j, slot, ctx, [actuel.recette, ...(autre ? [autre.recette] : [])])
          .filter((rec) => (ctx.utilisations[rec.id] || 0) < 2 && (ctx.modeles[rec.modele] || 0) < 3), 12);
        const options = liste.map((rec) => {
          const essai = { ...courant, jours: courant.jours.map((jp, i) => (i === j ? { ...jp, [slot]: { ...actuel, recette: rec.id } } : jp)) };
          return { rec, essai, total: listeCourses(essai, p).total };
        }).sort((a, b) => a.total - b.total);
        if (options.length && options[0].total < total - 0.01) {
          changements.push({ jour: JOURS[j], slot, avant: REC[actuel.recette].nom, apres: options[0].rec.nom, gain: round2(total - options[0].total) });
          courant = options[0].essai;
          progres = true;
          break;
        }
      }
      if (!progres) break;
    }
    const estimation = listeCourses(courant, p).total;
    return { plan: courant, estimation, atteint: estimation <= p.budget, changements };
  }

  /* ---------- « Qu'est-ce qu'on mange ce soir ? » ---------- */
  function ceSoir(plan, p, jour, opts = {}) {
    const prevu = plan && plan.jours[jour] ? plan.jours[jour].diner : null;
    const dejaAchete = new Set(plan ? listeCourses(plan, p).articles.map((a) => a.id) : []);
    const stock = stockIds(p);
    const rapides = recettesCompatibles(p)
      .filter((r) => r.repas.includes('diner') && r.temps <= 20 && (!prevu || r.id !== prevu.recette) && opts.notes?.[r.id] !== 1)
      .map((r) => ({ r, manquants: r.ing.filter(([id]) => !dejaAchete.has(id) && !stock.has(id)).length }))
      .sort((a, b) => a.manquants - b.manquants || scoreGout(b.r, p.gouts) - scoreGout(a.r, p.gouts) || a.r.temps - b.r.temps)
      .slice(0, 3)
      .map(({ r, manquants }) => ({ recette: r.id, manquants }));
    // à manquants égaux, on préfère ce que la personne aime
    return { prevu, idees: rapides };
  }

  /* ---------- comparateur de drives (moteur prêt, données de démonstration) ---------- */
  /**
   * magasins : [{ id, nom, distanceKm, frais, prix: { [ingredientId]: prix € par conditionnement } }]
   * mode : 'minimum' (coût total le plus bas) ou 'compromis' (pénalité par magasin en plus)
   * Retourne la meilleure combinaison de magasins et une liste par magasin.
   */
  function optimiserDrives(articles, magasins, opts = {}) {
    const conso = opts.consoL100 ?? 6.5, carburant = opts.prixCarburant ?? 1.8;
    const penalite = opts.mode === 'compromis' ? (opts.penaliteMagasin ?? 5) : 0;
    const aAcheter = articles.filter((a) => !a.enStock);
    const n = magasins.length;
    let meilleur = null;
    for (let mask = 1; mask < (1 << n); mask++) {
      const choisis = magasins.filter((_, i) => mask & (1 << i));
      const listes = Object.fromEntries(choisis.map((m) => [m.id, []]));
      let produits = 0, manquant = [];
      for (const a of aAcheter) {
        let best = null;
        for (const m of choisis) {
          const pu = m.prix[a.id];
          if (pu == null) continue;
          if (!best || pu < best.pu) best = { m, pu };
        }
        if (!best) { manquant.push(a.nom); continue; }
        const c = round2(best.pu * a.conditionnements);
        listes[best.m.id].push({ ...a, cout: c });
        produits += c;
      }
      const utilises = choisis.filter((m) => listes[m.id].length);
      if (utilises.length !== choisis.length) continue; // un magasin inutile ne compte pas
      const frais = utilises.reduce((s, m) => s + m.frais, 0);
      const trajet = utilises.reduce((s, m) => s + (m.distanceKm * 2 * conso / 100) * carburant, 0);
      const total = round2(produits + frais + trajet);
      const scoreTotal = total + penalite * (utilises.length - 1) + manquant.length * 100;
      if (!meilleur || scoreTotal < meilleur.score) {
        meilleur = {
          score: scoreTotal, total, produits: round2(produits), frais: round2(frais), trajet: round2(trajet),
          manquant, magasins: utilises.map((m) => ({ id: m.id, nom: m.nom, articles: listes[m.id], sousTotal: round2(listes[m.id].reduce((s, x) => s + x.cout, 0)) }))
        };
      }
    }
    return meilleur;
  }

  /** Magasins FICTIFS pour démontrer le comparateur. Aucun lien avec une enseigne réelle. */
  function magasinsDemo() {
    const def = [
      { id: 'demo-a', nom: 'Drive démo A', distanceKm: 3, frais: 0, facteurs: { 'Fruits et légumes': 1.08, 'Viandes et poissons': 0.94, 'Épicerie': 0.97 } },
      { id: 'demo-b', nom: 'Drive démo B', distanceKm: 6, frais: 0, facteurs: { 'Fruits et légumes': 0.9, 'Crèmerie et frais': 1.05, 'Épicerie': 1.04 } },
      { id: 'demo-c', nom: 'Drive démo C', distanceKm: 11, frais: 2, facteurs: { 'Fruits et légumes': 0.95, 'Viandes et poissons': 0.88, 'Crèmerie et frais': 0.92, 'Épicerie': 0.9, 'Surgelés': 0.9 } }
    ];
    return def.map((d) => ({
      id: d.id, nom: d.nom, distanceKm: d.distanceKm, frais: d.frais,
      prix: Object.fromEntries(DATA.ingredients
        .filter((i) => !(d.id === 'demo-a' && i.id === 'quinoa')) // simule une rupture
        .map((i) => [i.id, round2(i.prixDemo * (d.facteurs[i.rayon] || 1))]))
    }));
  }

  /* ---------- goûts : préférences apprises (test de goût, notes, assistant IA) ---------- */
  const POIDS_GROUPE = { P: 1, L: 0.6, F: 0.4, D: 0.4, A: 0.15 };
  const borne = (x) => Math.max(-4, Math.min(4, x));
  function goutsVides() { return { ing: {}, cuisine: {}, modele: {} }; }
  function scoreGout(rec, g) {
    if (!g) return 0;
    let s = 0;
    for (const [id] of rec.ing) { const w = g.ing[id]; if (w) s += w * (POIDS_GROUPE[ING[id].groupe] || 0.2); }
    s += (g.cuisine[rec.cuisine] || 0) * 0.8 + (g.modele[rec.modele] || 0) * 0.8;
    return s;
  }
  const REPONSES = { adore: 1.2, pourquoi: 0.25, non: -1.5 };
  /** Met à jour les goûts après une réponse au test (« adore », « pourquoi », « non »). */
  function apprendre(gouts, recetteId, reponse) {
    const g = JSON.parse(JSON.stringify(gouts || goutsVides()));
    const rec = REC[recetteId], a = REPONSES[reponse];
    if (!rec || a == null) return g;
    for (const [id] of rec.ing) {
      const grp = ING[id].groupe;
      if (grp === 'A') continue;
      const f = id === rec.prot ? 1 : (POIDS_GROUPE[grp] || 0.2);
      g.ing[id] = borne((g.ing[id] || 0) + a * f);
    }
    g.cuisine[rec.cuisine] = borne((g.cuisine[rec.cuisine] || 0) + a * 0.8);
    g.modele[rec.modele] = borne((g.modele[rec.modele] || 0) + a * 0.8);
    return g;
  }
  /** Ajoute des préférences venues de l'assistant IA (valeurs de -3 à 3, clés vérifiées). */
  function fusionnerGouts(gouts, apport) {
    const g = JSON.parse(JSON.stringify(gouts || goutsVides()));
    const ok = { ing: (k) => ING[k], cuisine: (k) => LIBELLES.cuisines[k], modele: (k) => MODELES[k] };
    const src = { ing: apport.ingredients, cuisine: apport.cuisines, modele: apport.modeles };
    for (const t of ['ing', 'cuisine', 'modele']) {
      for (const [k, v] of Object.entries(src[t] || {})) {
        const n = Number(v);
        if (!ok[t](k) || !Number.isFinite(n)) continue;
        g[t][k] = borne((g[t][k] || 0) + Math.max(-3, Math.min(3, n)));
      }
    }
    return g;
  }
  /** Choisit n plats variés (familles, protéines, cuisines différentes) pour le test de goût. */
  // `garder` (facultatif) : ne retenir que certains plats, par exemple ceux qui ont une vraie photo.
  // S'il en reste trop peu pour ce profil, on reprend tous les plats compatibles.
  function selectionTest(p, n = 12, seed = 1, garder) {
    const r = rng(seed);
    const tous = recettesCompatibles(p);
    const choisis = garder ? tous.filter(garder) : [];
    const pool = choisis.length >= Math.min(n, 8) ? choisis : tous.filter((x) => x.repas.includes('diner'));
    const vus = { modele: {}, prot: {}, cuisine: {} };
    const choix = [];
    for (let essai = 0; essai < 4000 && choix.length < n && pool.length; essai++) {
      const rec = pool[Math.floor(r() * pool.length)];
      if (choix.includes(rec)) continue;
      const strict = essai < 2500;
      if (strict && ((rec.modele !== 'maison' && (vus.modele[rec.modele] || 0) >= 1) || (vus.prot[rec.prot] || 0) >= 1 || (vus.cuisine[rec.cuisine] || 0) >= 3)) continue;
      choix.push(rec);
      vus.modele[rec.modele] = (vus.modele[rec.modele] || 0) + 1;
      vus.prot[rec.prot] = (vus.prot[rec.prot] || 0) + 1;
      vus.cuisine[rec.cuisine] = (vus.cuisine[rec.cuisine] || 0) + 1;
    }
    return choix.map((x) => x.id);
  }
  /** Résumé lisible des goûts : ce qui est aimé, ce qui l'est moins. */
  function resumeGouts(g) {
    if (!g) return { aime: [], evite: [] };
    const items = [
      ...Object.entries(g.ing).filter(([id]) => ['P', 'L', 'F', 'D'].includes(ING[id].groupe)).map(([id, w]) => [ING[id].nom, w]),
      ...Object.entries(g.cuisine).map(([k, w]) => ['Cuisine ' + (LIBELLES.cuisines[k] || k).toLowerCase(), w]),
      ...Object.entries(g.modele).filter(([k]) => k !== 'maison').map(([k, w]) => [MODELES[k] ? MODELES[k].libelle : k, w])
    ];
    return {
      aime: items.filter(([, w]) => w >= 0.9).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t),
      evite: items.filter(([, w]) => w <= -0.9).sort((a, b) => a[1] - b[1]).slice(0, 6).map(([t]) => t)
    };
  }

  /* ---------- résumé lisible du profil ---------- */
  const LIBELLES = {
    objectifs: { economies: 'Faire des économies', equilibre: 'Manger équilibré', muscle: 'Prise de muscle', perte: 'Perte de poids', legumes: 'Plus de légumes', rapide: 'Gagner du temps' },
    regime: { aucun: 'Aucun', flexitarien: 'Flexitarien (3 repas avec viande max.)', vegetarien: 'Végétarien', vegetalien: 'Végétalien', sans_porc: 'Sans porc', halal: 'Halal (sans porc ; viande certifiée à choisir en magasin)' },
    allergies: { gluten: 'Gluten', lait: 'Protéines de lait', lactose: 'Lactose', oeuf: 'Œuf', arachide: 'Arachide', fruits_coque: 'Fruits à coque', poisson: 'Poisson', crustaces: 'Crustacés', soja: 'Soja', sesame: 'Sésame', celeri: 'Céleri', moutarde: 'Moutarde' },
    niveau: { debutant: 'Débutant', alaise: 'À l’aise', passionne: 'Passionné' },
    equipement: { plaque: 'Plaques de cuisson', four: 'Four', micro: 'Micro-ondes', robot: 'Robot cuiseur', airfryer: 'Friteuse à air', autocuiseur: 'Autocuiseur' },
    cuisines: { francaise: 'Française', italienne: 'Italienne', asiatique: 'Asiatique', indienne: 'Indienne', orientale: 'Orientale', mexicaine: 'Mexicaine', espagnole: 'Espagnole' },
    refus: { poisson: 'Poisson', champignons: 'Champignons', epinards: 'Épinards', poivrons: 'Poivrons', aubergine: 'Aubergine', lentilles: 'Lentilles', tofu: 'Tofu', fromage: 'Fromage', courge: 'Courge', epice: 'Plats épicés' },
    ages: { '0-2': 'moins de 3 ans', '3-5': '3–5 ans', '6-10': '6–10 ans', '11-14': '11–14 ans', '15-17': '15–17 ans' }
  };

  const api = {
    JOURS, SLOTS, LIBELLES, ING, REC, DATA, REFUS, PLACARD_BASE, RECETTES, MODELES,
    goutsVides, scoreGout, apprendre, fusionnerGouts, selectionTest, resumeGouts,
    profilParDefaut, portions, ingredientInterdit, recetteCompatible, recettesCompatibles,
    coutPortion, equilibre, genererSemaine, remplacerRepas, listeCourses, analyseBudget,
    ajusterAuBudget, ceSoir, optimiserDrives, magasinsDemo, contientViande, coutRepas
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
