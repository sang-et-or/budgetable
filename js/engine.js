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
  const MODELES = Object.fromEntries(MOD.modeles.map((m) => [m.id, { libelle: m.libelle, forme: m.forme }]).concat([['maison', { libelle: 'Recettes maison', forme: 'assiette' }], ['perso', { libelle: 'Mes recettes', forme: 'assiette' }]]));

  /* ---------- recettes personnelles (bibliothèque de l'utilisateur) ----------
   * Une recette perso : { id: 'p-…', nom, lien?, repas[], temps?, ing: [[id, qté par portion adulte]], extras: [nom] }
   * « extras » = ingrédients hors catalogue (texte libre) : ajoutés à la liste de courses, sans prix connu. */
  let PERSO = [];
  let versionPerso = 0;
  const slug = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  function idExtra(nom) { return 'x-' + slug(nom); }
  /* ---------- grignotages gourmands : desserts et goûters (hors menus des repas) ---------- */
  let GOURMAND = [];
  /** ingredients : nouveaux produits du catalogue (sucre, chocolat, fruits…) ; recettes : desserts et goûters */
  function definirGourmand(ingredients, recettes) {
    for (const i of ingredients || []) if (i && i.id && !ING[i.id]) { ING[i.id] = { ...i }; DATA.ingredients.push(ING[i.id]); }
    for (const r of GOURMAND) delete REC[r.id];
    GOURMAND = (recettes || []).filter((r) => r && r.id && r.nom).map((r) => {
      const extras = (r.extras || []).map((x) => (typeof x === 'string' ? { nom: x, tags: [] } : x)).map((x) => ({ nom: String(x.nom || '').trim().slice(0, 40), tags: Array.isArray(x.tags) ? x.tags.map(String) : [] })).filter((x) => x.nom).slice(0, 30);
      for (const x of extras) {
        const id = idExtra(x.nom);
        if (!ING[id] || ING[id].perso) ING[id] = { id, nom: x.nom.charAt(0).toUpperCase() + x.nom.slice(1), rayon: 'Autres', unite: 'pièce', cond: 1, condLabel: 'selon la recette', prixDemo: 0, groupe: 'A', tags: [...new Set([...(ING[id] ? ING[id].tags : []), ...x.tags])], perso: true };
      }
      const rec = {
        id: r.id, nom: String(r.nom).slice(0, 90), repas: [], temps: r.temps > 0 ? r.temps : 20, niveau: r.niveau || 1, equip: r.equip || [], cuisine: 'francaise', tags: r.tags || [],
        ing: (r.ing || []).filter(([id, q]) => ING[id] && q > 0).concat(extras.map((x) => [idExtra(x.nom), 1])),
        etapes: r.etapes && r.etapes.length ? r.etapes.slice(0, 12) : (r.lien ? ['Suivez la recette sur le site d’origine (lien ci-dessus).'] : ['Votre recette : préparez-la comme d’habitude.']),
        modele: 'gourmand', gourmand: true, type: ['dessert', 'petitdej', 'entree'].includes(r.type) ? r.type : 'gouter', emoji: r.emoji || '🍰', parts: r.parts || 6, mois: Array.isArray(r.mois) ? r.mois : null,
        perso: !!r.perso, lien: r.lien || null, extras, proposer: false, photo: r.photo || null, photoSource: r.photoSource || ''
      };
      rec.sig = rec.id;
      return rec;
    });
    for (const r of GOURMAND) { REC[r.id] = r; cacheCout.delete(r.id); }
    return GOURMAND;
  }
  const gourmandises = () => GOURMAND.slice();
  /* ---------- « ma version » d'un plat : mêmes étapes, ingrédients ajoutés, changés ou retirés ---------- */
  let VARIANTES = [];
  /** liste : [{ id: 'v-…', base: id de la recette d'origine, ing: [[id, qté par portion]] }] */
  function definirVariantes(liste) {
    for (const r of VARIANTES) delete REC[r.id];
    VARIANTES = (liste || []).filter((v) => v && v.id && REC[v.base] && Array.isArray(v.ing)).map((v) => {
      const b = REC[v.base];
      const ing = v.ing.filter(([id, q]) => ING[id] && q > 0).map(([id, q]) => [id, Math.round(q * 100) / 100]);
      const rec = { ...b, id: v.id, ing, base: b.id, variante: true, sig: b.sig || b.id, nomBase: b.nom };
      rec.prot = (ing.find(([id]) => ING[id].groupe === 'P') || [])[0] || b.prot;
      return rec;
    });
    for (const r of VARIANTES) { REC[r.id] = r; cacheCout.delete(r.id); }
    return VARIANTES;
  }
  /** Différences entre une version et sa recette d'origine (pour l'afficher). */
  function differences(rec) {
    if (!rec || !rec.variante || !REC[rec.base]) return { ajouts: [], retraits: [], quantites: [] };
    const avant = new Map(REC[rec.base].ing), apres = new Map(rec.ing);
    return {
      ajouts: [...apres.keys()].filter((id) => !avant.has(id)),
      retraits: [...avant.keys()].filter((id) => !apres.has(id)),
      quantites: [...apres.keys()].filter((id) => avant.has(id) && Math.abs(avant.get(id) - apres.get(id)) > 1e-6)
    };
  }
  /** Ajoute des produits au catalogue (catalogue élargi, produits des desserts et de saison). */
  function ajouterIngredients(liste) {
    let n = 0;
    for (const i of liste || []) if (i && i.id && (!ING[i.id] || ING[i.id].perso)) { if (ING[i.id]) { const k = DATA.ingredients.indexOf(ING[i.id]); if (k >= 0) DATA.ingredients.splice(k, 1); } ING[i.id] = { ...i, tags: (i.tags || []).slice() }; DATA.ingredients.push(ING[i.id]); n++; }
    if (n) { cacheCompat.clear(); }
    return n;
  }
  /* ---------- idées de saison : recettes du catalogue, proposées dans les menus quand on les garde ---------- */
  let SAISON = [], SAISON_ACTIF = [];
  function definirSaison(ingredients, recettes) {
    for (const i of ingredients || []) if (i && i.id && !ING[i.id]) { ING[i.id] = { ...i }; DATA.ingredients.push(ING[i.id]); }
    for (const r of SAISON) delete REC[r.id];
    SAISON = (recettes || []).filter((r) => r && r.id && r.nom && r.ing.every(([id]) => ING[id])).map((r) => {
      const rec = { ...r, tags: (r.tags || []).slice(), equip: r.equip || [], niveau: r.niveau || 1, saison: true, sig: r.sig || r.id };
      rec.prot = (rec.ing.find(([id]) => ING[id].groupe === 'P') || rec.ing.find(([id]) => ['oeufs', 'pois_chiches', 'lentilles_corail', 'lentilles_vertes', 'tofu'].includes(id)) || [])[0];
      return rec;
    });
    for (const r of SAISON) { REC[r.id] = r; cacheCout.delete(r.id); }
    SAISON_ACTIF = SAISON.filter((r) => SAISON_ACTIF.some((x) => x.id === r.id));
    versionPerso++; cacheCompat.clear();
    return SAISON;
  }
  /* ---------- calendrier des fruits et légumes frais (France métropolitaine, mois de pleine saison) ---------- */
  const M = (...l) => new Set(l);
  const ETE = M(6, 7, 8, 9), HIVER = M(11, 12, 1, 2, 3);
  const CALENDRIER = {
    tomate: ETE, tomate_cerise: ETE, courgette: M(6, 7, 8, 9), aubergine: M(7, 8, 9), poivron: M(7, 8, 9, 10), concombre: M(5, 6, 7, 8, 9),
    haricots_verts: M(6, 7, 8, 9), salade: M(4, 5, 6, 7, 8, 9, 10), laitue: M(4, 5, 6, 7, 8, 9, 10), radis: M(4, 5, 6), asperges: M(4, 5, 6), artichaut: M(5, 6, 7, 8, 9),
    brocoli: M(6, 7, 8, 9, 10, 11), chou: M(10, 11, 12, 1, 2, 3), chou_fleur: M(9, 10, 11, 12, 1, 2, 3), poireau: M(9, 10, 11, 12, 1, 2, 3, 4), courge: M(9, 10, 11, 12, 1, 2),
    potiron: M(9, 10, 11, 12, 1), patate_douce: M(9, 10, 11, 12, 1, 2, 3), endives: M(10, 11, 12, 1, 2, 3, 4), betterave: M(9, 10, 11, 12, 1, 2, 3), navet: M(10, 11, 12, 1, 2, 3),
    celeri: M(9, 10, 11, 12, 1, 2, 3), panais: M(10, 11, 12, 1, 2, 3), epinards_frais: M(3, 4, 5, 9, 10, 11), blettes: M(6, 7, 8, 9, 10, 11), fenouil: M(6, 7, 8, 9, 10),
    fraises: M(5, 6, 7), framboises: M(6, 7, 8, 9), cerises: M(6, 7), peche: ETE, melon: M(6, 7, 8, 9), pasteque: M(7, 8), abricot: M(6, 7, 8), raisin: M(8, 9, 10),
    pomme: M(9, 10, 11, 12, 1, 2, 3, 4), poire: M(8, 9, 10, 11, 12, 1), kiwi: M(11, 12, 1, 2, 3, 4), orange: M(12, 1, 2, 3, 4), clementine: M(11, 12, 1, 2), citron: M(12, 1, 2, 3, 4),
    figue: M(8, 9, 10), prune: M(7, 8, 9), champignon: null, carotte: null, oignon: null, pomme_de_terre: null, ail: null, banane: null
  };
  let MOIS_FORCE = null;
  /** Mois courant (1-12) ; modifiable pour les essais. */
  const moisCourant = () => MOIS_FORCE || (new Date().getMonth() + 1);
  function definirMois(m) { MOIS_FORCE = m >= 1 && m <= 12 ? m : null; cacheCompat.clear(); }
  /** Légumes et fruits frais d'une recette : de saison, ou hors saison (serres, avion, plus chers et moins bons). */
  function saisonRecette(rec, mois = moisCourant()) {
    const dans = [], hors = [];
    for (const [id] of rec.ing || []) {
      const cal = CALENDRIER[id];
      if (!cal || !ING[id] || ING[id].rayon !== 'Fruits et légumes') continue;
      (cal.has(mois) ? dans : hors).push(id);
    }
    return { dans: [...new Set(dans)], hors: [...new Set(hors)] };
  }
  /* plats de saison : chauds et réconfortants quand il fait froid, frais et légers l'été */
  const NOM_CHAUD = /soupe|velout|potee|potée|mijot|gratin|hachis|parmentier|raclette|tartiflette|pot-au-feu|pot au feu|blanquette|chili|ragout|ragoût|daube|lasagne|bourguignon|choucroute|cassoulet|bouillon|tajine|dahl|curry|risotto|croziflette|gratine|four/;
  const NOM_FROID = /^salade|^tabou|gaspacho|carpaccio|tartare|^bowl .*cru|poke|froid/;
  function styleRecette(rec) {
    const n = norm(rec.nom || '');
    if (rec.modele === 'salade' || NOM_FROID.test(n)) return 'frais';
    if (['veloute', 'mijote', 'gratin', 'curry'].includes(rec.modele) || NOM_CHAUD.test(n)) return 'chaud';
    return '';
  }
  /** Saison de cuisine du mois : 'froide' (octobre à mars), 'chaude' (juin à août), sinon 'douce'. */
  const saisonCuisine = (mois = moisCourant()) => ([10, 11, 12, 1, 2, 3].includes(mois) ? 'froide' : [6, 7, 8].includes(mois) ? 'chaude' : 'douce');
  function bonusStyleSaison(rec) {
    const st = styleRecette(rec), sc = saisonCuisine();
    if (sc === 'froide') return st === 'chaud' ? 2.2 : st === 'frais' ? -3 : 0;
    if (sc === 'chaude') return st === 'frais' ? 2.2 : st === 'chaud' ? (rec.modele === 'veloute' || /soupe|potee|mijot|pot-au-feu|choucroute|cassoulet|raclette|tartiflette/.test(norm(rec.nom)) ? -3 : -1) : 0;
    return 0;
  }
  const bonusSaison = (rec) => { const s = saisonRecette(rec); return Math.min(1.6, s.dans.length * 0.8) - s.hors.length * 1.6; };
  /** Les idées de saison gardées par l'utilisateur entrent dans les menus proposés. */
  function saisonActives(ids) {
    const set = new Set(ids || []);
    SAISON_ACTIF = SAISON.filter((r) => set.has(r.id));
    versionPerso++; cacheCompat.clear();
  }
  /** Idées de saison pour un mois (1-12), compatibles ou non avec le profil. */
  function ideesSaison(mois) { return SAISON.filter((r) => !mois || r.mois.includes(mois)); }
  function definirPerso(liste) {
    for (const r of PERSO) delete REC[r.id];
    PERSO = (liste || []).filter((r) => r && r.id && r.nom).map((r) => {
      // extras : texte libre ou { nom, tags } (tags = allergènes et régimes connus, pour la sécurité)
      const extras = (r.extras || []).map((x) => (typeof x === 'string' ? { nom: x, tags: [] } : x)).map((x) => ({ nom: String(x.nom || '').trim().slice(0, 40), tags: Array.isArray(x.tags) ? x.tags.map(String) : [] })).filter((x) => x.nom).slice(0, 30);
      for (const x of extras) {
        const id = idExtra(x.nom);
        if (!ING[id] || ING[id].perso) ING[id] = { id, nom: x.nom.charAt(0).toUpperCase() + x.nom.slice(1), rayon: 'Autres', unite: 'pièce', cond: 1, condLabel: 'selon la recette', prixDemo: 0, groupe: 'A', tags: [...new Set([...(ING[id] ? ING[id].tags : []), ...x.tags])], perso: true };
      }
      const ing = (r.ing || []).filter(([id, q]) => ING[id] && q > 0).concat(extras.map((x) => [idExtra(x.nom), 1]));
      const rec = {
        id: r.id, nom: String(r.nom).slice(0, 90), repas: r.repas && r.repas.length ? r.repas : ['dejeuner', 'diner'],
        temps: r.temps > 0 ? r.temps : 30, niveau: 1, equip: [], cuisine: 'francaise', tags: r.enfants ? ['enfants'] : [],
        ing, etapes: r.lien ? ['Suivez la recette sur le site d’origine (lien ci-dessus).'] : ['Votre recette : préparez-la comme d’habitude.'],
        modele: 'perso', perso: true, lien: r.lien || null, extras, proposer: r.proposer !== false,
        photo: typeof r.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(r.photo) && r.photo.length < 300000 ? r.photo : null, photoSource: r.photo ? String(r.photoSource || '').slice(0, 60) : ''
      };
      rec.prot = (rec.ing.find(([id]) => ING[id].groupe === 'P') || [])[0];
      rec.sig = rec.id;
      return rec;
    });
    for (const r of PERSO) REC[r.id] = r;
    versionPerso++;
    cacheCompat.clear();
    for (const r of PERSO) cacheCout.delete(r.id);
    return PERSO;
  }

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
      stock: {},            // placard : { ingrédient: quantité restante (g, ml ou pièces) }
      gouts: { ing: {}, cuisine: {}, modele: {} }
    };
  }

  function facteurAdulte(p) {
    if (p.programme) return 1;   // programme minceur : la portion de la personne est ajustée dans son assiette (assietteMinceur)
    if (p.objectifs.includes('muscle')) return 1.2;
    if (p.objectifs.includes('perte')) return 0.9;
    return 1;
  }

  /** Nombre de portions « adulte » pour un repas donné. */
  /** Qui mange à ce repas d'après le profil : { a: adultes, e: [enfant présent ?], invA, invE } */
  function presenceParDefaut(p, jour, slot) {
    let a = p.foyer.adultes, e = p.foyer.enfants.map(() => true);
    if (slot === 'dejeuner' && jour < 5 && p.dejeuners && p.dejeuners.mode === 'dehors') {
      a = Math.min(p.dejeuners.adultesMaison, p.foyer.adultes);
      const em = p.dejeuners.enfantsMaison;
      if (!(em === 'oui' || (em === 'mercredi' && jour === 2))) e = e.map(() => false);
    }
    return { a, e, invA: 0, invE: 0 };
  }
  function presence(p, jour, slot) {
    const pr = p.presences && p.presences[jour + '-' + slot];
    const r = pr ? { a: Math.max(0, Math.min(20, pr.a | 0)), e: p.foyer.enfants.map((_, k) => !pr.e || pr.e[k] !== false), invA: Math.max(0, pr.invA | 0), invE: Math.max(0, pr.invE | 0) } : presenceParDefaut(p, jour, slot);
    // ceux qui emportent une gamelle ne déjeunent pas à la maison
    if (slot === 'dejeuner') { const g = nbGamelles(p, jour); if (g) r.a = Math.max(0, r.a - Math.max(0, g - Math.max(0, p.foyer.adultes - r.a))); }
    return r;
  }
  function portions(p, jour, slot) {
    const fa = facteurAdulte(p);
    let adultes = p.foyer.adultes;
    let enfants = p.foyer.enfants;
    if (p.presences && p.presences[jour + '-' + slot]) {
      const pr = presence(p, jour, slot);
      const t = (pr.a + pr.invA) * fa + p.foyer.enfants.reduce((s, a, k) => s + (pr.e[k] ? (AGE_FACTEUR[a] || 0.7) : 0), 0) + pr.invE * 0.7;
      return Math.round(t * 10) / 10;
    }
    if (slot === 'dejeuner' && jour < 5 && p.dejeuners && p.dejeuners.mode === 'dehors') {
      adultes = Math.min(p.dejeuners.adultesMaison, p.foyer.adultes);
      const em = p.dejeuners.enfantsMaison;
      const presents = em === 'oui' || (em === 'mercredi' && jour === 2);
      if (!presents) enfants = [];
    }
    if (slot === 'dejeuner') adultes = Math.max(0, adultes - Math.max(0, nbGamelles(p, jour) - (p.foyer.adultes - adultes)));
    const total = adultes * fa + enfants.reduce((s, a) => s + (AGE_FACTEUR[a] || 0.7), 0);
    return Math.round(total * 10) / 10;
  }
  /* ---------- assiette à deux vitesses : même plat pour toute la famille, servi différemment ---------- */
  // La personne qui suit le programme minceur prend moitié moins de féculents et de matières grasses ou fromage,
  // et une fois et demie plus de légumes ; les enfants (et le reste de la famille) gardent l'assiette complète.
  // fromages et crème : ajoutés au moment de servir, donc faciles à réduire dans une seule assiette (l'huile de cuisson, elle, est partagée)
  const GRAS = new Set(['creme', 'creme_liquide', 'creme_soja', 'emmental', 'mozzarella', 'parmesan', 'comte', 'cheddar', 'feta', 'fromage_frais', 'mascarpone', 'roquefort', 'camembert', 'chevre', 'munster']);
  const nomCourt = (id) => ING[id].nom.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase();
  const listeNoms = (ids) => { const n = [...new Set(ids.map(nomCourt))]; return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' et ' + n[n.length - 1]; };
  // Ce qui fait partie du plat ne s'enlève pas une fois le plat cuit (farine, pâte, chapelure, crème de la sauce, fromage gratiné,
  // pommes de terre d'un gratin ou d'une soupe…) : on prend alors une plus petite part du plat, avec une salade à côté.
  // Ce qui se sert à part (riz, pâtes, semoule, pain, fromage râpé à table…) se réduit dans l'assiette.
  const BASE_PLAT = new Set(['farine', 'pate_feuilletee', 'pate_brisee', 'pate_sablee', 'pate_pizza', 'chapelure', 'maizena', 'levure', 'lasagnes', 'raviolis', 'puree_flocons', 'creme', 'creme_liquide', 'creme_soja', 'lait_coco', 'sauce_pates']);
  const MODELES_MELANGES = new Set(['gratin', 'quiche', 'pizza', 'salade', 'omelette', 'veloute']);
  const NOM_MELANGE = /gratin|quiche|tarte|pizza|lasagne|hachis|parmentier|cr[eê]pe|galette|cake|taboul|salade de|soupe|velout[eé]|potage|omelette|tortilla espagnole|risotto|paella|riz saut[eé]|croque|feuillet|clafoutis|flan|tartiflette|gnocchi|crumble|pain perdu|mijot[eé] .* avec|frittata/;
  const PART_REDUITE = 0.75;
  function assietteMinceur(rec) {
    if (!rec || rec.gourmand || !rec.ing) return null;
    const nom = norm(rec.nom || '');
    const melange = MODELES_MELANGES.has(rec.modele) || (rec.modele === 'maison' && NOM_MELANGE.test(nom)) || (rec.modele === 'perso' && NOM_MELANGE.test(nom));
    // un féculent ou un fromage servi à côté : pain des tartines, féculent « avec du riz / des pâtes… » d'un plat qui n'est pas mélangé
    const ACCOMPAGNEMENTS = ['riz', 'riz_complet', 'pates', 'semoule', 'quinoa', 'boulgour', 'pain', 'pain_complet', 'tortillas', 'nouilles', 'sarrasin', 'polenta'];
    const mot = (id) => norm(ING[id].nom).split(/[\s(]/)[0].replace(/s$/, '');
    // servi à côté : un accompagnement (riz, pâtes, pain…), ou un féculent cité après « avec » dans le nom (« … avec des pommes de terre »)
    const aCote = (id) => (melange ? (id.startsWith('pain') && !/pain perdu|croque|bruschetta|pain de mie farci/.test(nom)) : (ACCOMPAGNEMENTS.includes(id) || new RegExp('avec (du |de la |des |de l.)?' + mot(id)).test(nom)));
    const aj = [], fec = [], gras = [], leg = [], integres = [];
    for (const [id] of rec.ing) {
      const i = ING[id]; if (!i || i.perso) continue;
      const estFec = i.groupe === 'F', estGras = GRAS.has(id) || BASE_PLAT.has(id);
      if (!estFec && !estGras) continue;
      const integre = BASE_PLAT.has(id) || (estFec && !aCote(id)) || (estGras && melange) || rec.modele === 'pizza';
      if (integre) integres.push(id);
      else if (estFec) fec.push(id);
      else gras.push(id);
    }
    const legumes = rec.ing.map(([id]) => id).filter((id) => ING[id] && ING[id].groupe === 'L' && !['citron', 'citron_vert', 'ail', 'persil'].includes(id));
    const legVisibles = (ids) => ids.filter((id) => !LEG_DISCRETS.has(id));
    // petite part seulement si le plat est mélangé, ou si un féculent ou une pâte est cuit dedans (la crème d'une sauce de curry ne suffit pas)
    const PATES_BASE = ['farine', 'pate_feuilletee', 'pate_brisee', 'pate_sablee', 'pate_pizza', 'chapelure', 'lasagnes', 'raviolis', 'puree_flocons'];
    const reduite = integres.length > 0 && (melange || integres.some((id) => ING[id].groupe === 'F' || PATES_BASE.includes(id)));
    for (const [id] of rec.ing) {
      const i = ING[id]; if (!i || i.perso) continue;
      if (fec.includes(id) || gras.includes(id)) aj.push([id, 0.5]);
      else if (reduite) { if (!legumes.includes(id)) aj.push([id, PART_REDUITE]); }        // petite part ; les légumes du plat restent entiers
      else if (legumes.includes(id)) { aj.push([id, 1.5]); leg.push(id); }
    }
    const ajout = reduite && ING.salade ? [['salade', 0.25]] : [];
    const conseils = [];
    const pluriel = integres.length > 1 || (integres[0] ? /^\S+[sx]\b/.test(nomCourt(integres[0])) : false);
    if (reduite) conseils.push(`une part un peu plus petite (les trois quarts) : ${listeNoms(integres)} ${pluriel ? 'font' : 'fait'} partie du plat, on ne peut pas ${pluriel ? 'les ' : 'l’'}enlever une fois cuit`);
    else if (integres.length) conseils.push(`${listeNoms(integres)} : dans la sauce, on n’y touche pas`);
    if (fec.length) conseils.push(fec.every((id) => id === 'tortillas') ? 'une tortilla de moins, et plus de garniture de légumes' : `moitié moins de ${listeNoms(fec)}, servi${fec.length > 1 ? 's' : ''} à part`);
    if (reduite) conseils.push('une grande salade verte ou des légumes à côté');
    else if (legVisibles(leg).length) { const l = listeNoms(legVisibles(leg)); conseils.push(`plus ${/^[aeéèiouyh]/i.test(l) ? 'd’' : 'de '}${l} (une fois et demie)`); }
    else conseils.push('une grande salade ou des légumes en plus');
    if (gras.length) conseils.push(`${listeNoms(gras)} : une petite cuillère pour vous, ajouté${gras.length > 1 ? 's' : ''} dans les assiettes des autres au moment de servir`);
    const court = [reduite ? '¾ de part + grande salade' : '', fec.length ? `½ ${listeNoms(fec)}` : '', !reduite ? (leg.length ? 'légumes ×1,5' : '+ salade') : '', gras.length ? `${gras.length > 1 ? 'fromage et crème' : nomCourt(gras[0])} à part` : ''].filter(Boolean).join(' · ');
    return { aj, ajout, feculent: rec.ing.some(([id]) => ING[id] && ING[id].groupe === 'F'), conseils, court, reduite, integres, fecReduits: fec, grasReduits: gras };
  }
  const recetteAdaptee = (rec, a) => (a ? { ...rec, ing: rec.ing.map(([id, q]) => { const x = a.aj.find(([k]) => k === id); return [id, x ? q * x[1] : q]; }).concat(a.ajout || []) } : rec);
  /** Complément pour les enfants quand le plat n'a pas de féculent : du pain (¼ de baguette par enfant). */
  const COMPLEMENT_ENFANT = ['pain', 0.25];
  function enfantsPresents(p, jour, slot) {
    if (!p.foyer.enfants.length) return 0;
    if (p.presences && p.presences[jour + '-' + slot]) return presence(p, jour, slot).e.filter(Boolean).length;
    if (slot === 'dejeuner' && jour < 5 && p.dejeuners && p.dejeuners.mode === 'dehors') { const em = p.dejeuners.enfantsMaison; return em === 'oui' || (em === 'mercredi' && jour === 2) ? p.foyer.enfants.length : 0; }
    return p.foyer.enfants.length;
  }
  // le coach minceur s'applique aux plats de la semaine, sauf si on l'a retiré de la semaine (dansSemaine: false)
  const programmeActif = (p) => !!(p.programme && !p.programme.stabilisation && p.programme.dansSemaine !== false);
  /* ---------- gamelles du midi et restes ---------- */
  // p.gamelles = { n: gamelles par jour, jours: [0..6], mode: 'restes' | 'plat' }
  function nbGamelles(p, jour) {
    const g = p.gamelles;
    return g && g.n > 0 && (g.jours || []).includes(jour) ? Math.min(10, g.n | 0) : 0;
  }
  const MODELES_GAMELLE = { salade: 3, bowl: 3, wraps: 3, pates: 2, quiche: 2, curry: 1, mijote: 1, poelee: 1 };
  /** Plats faciles à emporter (froids ou qui se réchauffent bien), pour une gamelle préparée à part. */
  function platsGamelle(p, exclure = []) {
    return recettesCompatibles(p).filter((r) => MODELES_GAMELLE[r.modele] && r.repas.includes('dejeuner') && !r.gourmand && !exclure.includes(r.id) && r.temps <= 40)
      .map((r) => ({ r, s: MODELES_GAMELLE[r.modele] * 2 + scoreGout(r, p.gouts || {}) - coutPortion(r) - r.temps / 30 }))
      .sort((a, b) => b.s - a.s).map((x) => x.r);
  }
  /** Portions à cuisiner pour un repas : à table + restes prévus (gamelles, lendemain, congélateur). Un repas « restes » ne se cuisine pas. */
  function aCuisiner(m) { return !m || m.deRestes || m.dehors ? 0 : m.portions + (m.plus || 0); }
  /**
   * Organise gamelles et restes de la semaine (à rappeler après chaque changement du planning).
   * Remplit, sans rien perdre de ce que l'utilisateur a choisi :
   *  - jp.gamelles = { n, mode: 'restes' | 'plat', source: jour du dîner, recette, portions }
   *  - m.plus et m.extra = { gamelles, demain, congel } sur les plats cuisinés en plus grande quantité
   *  - le déjeuner du lendemain marqué deRestes quand le dîner est prévu « avec des restes pour demain midi »
   */
  function organiserRestes(plan, p) {
    if (!plan || !plan.jours) return plan;
    const fa = facteurAdulte(p);
    const J = plan.jours;
    // la semaine commence le jour de sa création (plan.debut, 0 = lundi) : la veille du premier jour n'en fait pas partie
    const debut = plan.debut >= 0 && plan.debut <= 6 ? plan.debut : 0;
    const veille = (j) => (j === debut ? null : (j + 6) % 7);
    const lendemain = (j) => ((j + 1) % 7 === debut ? null : (j + 1) % 7);
    J.forEach((jp) => SLOTS.forEach((sl) => { const m = jp[sl]; if (m) { delete m.plus; delete m.extra; } }));
    // restes du dîner pour le déjeuner du lendemain (et retour au plat d'origine si on annule)
    J.forEach((jp, j) => {
      const l = jp.dejeuner;
      if (!l) return;
      const src = veille(j) != null ? J[veille(j)].diner : null;
      const veut = src && REC[src.recette] && !src.dehors && src.restes && src.restes.vers === 'dejeuner';
      if (veut) {
        if (!l.deRestes) l.recetteAvant = l.recette;
        l.deRestes = { jour: veille(j), slot: 'diner' };
        l.recette = src.recette;
      } else if (l.deRestes) {
        if (l.recetteAvant && REC[l.recetteAvant]) l.recette = l.recetteAvant;
        delete l.deRestes; delete l.recetteAvant;
      }
    });
    const pris = [];
    J.forEach((jp, j) => {
      const n = nbGamelles(p, j);
      if (!n || (jp.passes || []).includes('dejeuner')) { delete jp.gamelles; return; }
      const voulu = jp.gamelleMode || (p.gamelles.mode === 'plat' ? 'plat' : 'restes');
      if (voulu === 'non') { jp.gamelles = { n: 0, mode: 'non' }; return; }
      const src = veille(j) != null ? J[veille(j)].diner : null;
      if (voulu === 'restes' && src && REC[src.recette] && !src.deRestes && !src.dehors) {
        jp.gamelles = { n, mode: 'restes', source: veille(j), recette: src.recette, portions: Math.round(n * fa * 10) / 10 };
        return;
      }
      // plat préparé à part (lundi, ou pas de dîner la veille, ou choisi)
      let rec = jp.gamelleRecette && REC[jp.gamelleRecette] ? jp.gamelleRecette : null;
      if (!rec) { const sigs = new Set(J.flatMap((x) => SLOTS.map((sl) => x[sl] && REC[x[sl].recette] && (REC[x[sl].recette].sig || x[sl].recette))).filter(Boolean)); const l = platsGamelle(p, pris).filter((x) => !sigs.has(x.sig || x.id)); rec = l.length ? l[0].id : null; if (rec) jp.gamelleRecette = rec; }
      if (rec) pris.push(rec);
      jp.gamelles = rec ? { n, mode: 'plat', recette: rec, portions: Math.round(n * fa * 10) / 10, force: voulu === 'restes' } : { n: 0, mode: 'non' };
    });
    // quantités en plus sur les dîners qui servent de restes
    J.forEach((jp, j) => {
      const m = jp.diner;
      if (!m || !REC[m.recette] || m.deRestes || m.dehors) return;
      const ex = { gamelles: 0, demain: 0, congel: 0 };
      const suiv = lendemain(j) != null ? J[lendemain(j)] : null;
      if (suiv && suiv.gamelles && suiv.gamelles.mode === 'restes' && suiv.gamelles.source === j) ex.gamelles = suiv.gamelles.portions;
      if (suiv && suiv.dejeuner && suiv.dejeuner.deRestes) ex.demain = suiv.dejeuner.portions;
      if (m.restes && m.restes.vers === 'congel') ex.congel = Math.max(0, Math.min(20, +m.restes.n || 0));
      const plus = Math.round((ex.gamelles + ex.demain + ex.congel) * 10) / 10;
      if (plus > 0) { m.plus = plus; m.extra = ex; }
    });
    // restes au congélateur prévus sur un déjeuner
    J.forEach((jp) => { const m = jp.dejeuner; if (m && !m.deRestes && m.restes && m.restes.vers === 'congel' && m.restes.n > 0) { m.plus = Math.min(20, +m.restes.n); m.extra = { gamelles: 0, demain: 0, congel: m.plus }; } });
    return plan;
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
    const cle = JSON.stringify([p.allergies, p.regime, p.refus, p.equipement, p.niveau, versionPerso, moisCourant()]);
    if (!cacheCompat.has(cle)) {
      if (cacheCompat.size > 50) cacheCompat.clear();
      const duMois = SAISON.filter((r) => !SAISON_ACTIF.includes(r) && (r.mois || []).includes(moisCourant()));
      cacheCompat.set(cle, PERSO.concat(SAISON_ACTIF, duMois, RECETTES).filter((r) => recetteCompatible(r, p).ok));
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
  /* ---------- coachs alimentaires : minceur, sportif, femme de plus de 40 ans ---------- */
  const NUTRI = () => (NODE ? require('./nutrition.js') : root.Nutrition);
  const LAITAGES = new Set(['lait', 'yaourt', 'emmental', 'mozzarella', 'feta', 'tofu']);
  const POISSONS = new Set(['saumon', 'colin', 'thon']);
  const EPICES_FORTES = new Set(['curry', 'cumin', 'paprika']);
  const BOUDES = new Set(['chou', 'champignon', 'aubergine', 'poireau', 'epinards', 'brocoli']);
  const DOUDOUS = new Set(['pates', 'riz', 'pomme_de_terre', 'emmental', 'mozzarella', 'jambon', 'poulet_filet', 'oeufs', 'tortillas', 'pain_mie']);
  const LEGUMINEUSES = new Set(['lentilles_corail', 'lentilles_vertes', 'pois_chiches', 'haricots_rouges', 'haricots_blancs', 'pois_casses', 'tofu']);
  function bonusCoach(rec, p) {
    if (!p.coach) return 0;
    const N = NUTRI();
    const n = N && N.de(rec, ING);
    if (!n) return 0;
    const pp = n.parPortion, ids = rec.ing.map(([id]) => id);
    if (p.coach === 'minceur') {
      const pr = p.programme && p.programme.cibleRepas ? p.programme : null;
      const cr = pr ? pr.cibleRepas : 550;
      const famille = pr && p.foyer.enfants.length > 0;
      // avec des enfants : on juge le plat sur l'assiette adaptée de l'adulte, et on garde des plats familiaux
      const kcal = famille ? ((N.de(recetteAdaptee(rec, assietteMinceur(rec)), ING) || n).kcal) : n.kcal;
      let s = kcal <= cr ? 3 : kcal <= cr * 1.13 ? 1 : -(kcal - cr * 1.13) / 40;
      if (famille) { if (rec.tags.includes('enfants')) s += 1.5; if (ids.some((id) => ING[id].groupe === 'F')) s += 1; }
      if (pr && pr.rassasiant) { if (pp.prot >= 25) s += 1; if (pp.fibres >= 7) s += 1; }
      if (pr && pr.simple) s -= Math.max(0, rec.temps - 30) / 15;
      s += equilibre(rec).grammesLegumes / 100;
      s -= Math.max(0, pp.ags - 6) * 0.5;
      if (n.lettre === 'A') s += 1;
      if (pp.prot >= 25) s += 0.5;                    // les protéines rassasient
      return s;
    }
    if (p.coach === 'sportif') {
      let s = pp.prot >= 35 ? 4 : pp.prot >= 28 ? 2.5 : pp.prot >= 22 ? 0.5 : -2;
      if (n.kcal < 450) s -= 1;
      if (ids.some((id) => ING[id].groupe === 'F')) s += 0.5;   // féculents pour l'énergie
      return s;
    }
    if (p.coach === 'famille') {
      let s = rec.tags.includes('enfants') ? 4 : 0;                // plats que les enfants aiment
      const epices = ids.filter((id) => EPICES_FORTES.has(id)).length;
      s -= epices * 1.5;
      s -= ids.filter((id) => BOUDES.has(id)).length * 0.8;      // légumes souvent boudés
      if (ids.some((id) => DOUDOUS.has(id))) s += 1;             // pâtes, riz, pommes de terre, fromage…
      if (rec.temps <= 35) s += 0.5;
      if (equilibre(rec).grammesLegumes >= 100) s += 0.5;         // des légumes quand même
      return s;
    }
    if (p.coach === 'femme40') {
      let s = 0;
      if (ids.some((id) => LAITAGES.has(id))) s += 1.5;          // calcium
      if (ids.includes('saumon')) s += 3; else if (ids.some((id) => POISSONS.has(id))) s += 1;
      if (ids.some((id) => LEGUMINEUSES.has(id))) s += 1.5;      // fibres, protéines végétales
      if (pp.fibres >= 8) s += 1;
      if (pp.prot >= 25) s += 1;                                 // garder ses muscles
      if (pp.sel > 3) s -= 1;
      if (pp.ags > 8) s -= 1;
      if (n.kcal > 700) s -= 1.5;
      return s;
    }
    return 0;
  }
  /** Bilan de la semaine pour le coach : moyennes par repas d'adulte. */
  function bilanCoach(plan, p) {
    const N = NUTRI();
    if (!plan || !N) return null;
    const repas = plan.jours.flatMap((jp) => SLOTS.map((sl) => jp[sl]).filter(Boolean)).map((m) => REC[m.recette]).filter(Boolean);
    const ns = repas.map((r) => N.de(r, ING)).filter(Boolean);
    if (!ns.length) return null;
    const moy = (f) => ns.reduce((t, n) => t + f(n), 0) / ns.length;
    const ids = (r) => r.ing.map(([id]) => id);
    return {
      repas: ns.length,
      kcal: Math.round(moy((n) => n.kcal) / 10) * 10,
      prot: Math.round(moy((n) => n.parPortion.prot)),
      fibres: Math.round(moy((n) => n.parPortion.fibres)),
      sel: Math.round(moy((n) => n.parPortion.sel) * 10) / 10,
      nutriA: ns.filter((n) => n.lettre === 'A' || n.lettre === 'B').length,
      poisson: repas.filter((r) => ids(r).some((id) => POISSONS.has(id))).length,
      poissonGras: repas.filter((r) => ids(r).includes('saumon')).length,
      laitages: repas.filter((r) => ids(r).some((id) => LAITAGES.has(id))).length,
      legumineuses: repas.filter((r) => ids(r).some((id) => LEGUMINEUSES.has(id))).length,
      legumes: Math.round(repas.reduce((t, r) => t + equilibre(r).grammesLegumes, 0) / repas.length),
      enfants: repas.filter((r) => r.tags.includes('enfants')).length,
      doux: repas.filter((r) => !ids(r).some((id) => EPICES_FORTES.has(id))).length,
      temps: Math.round(repas.reduce((t, r) => t + r.temps, 0) / repas.length)
    };
  }
  function score(rec, p, ctx, r) {
    let s = r() * 3;
    s += bonusCoach(rec, p) * 1.6;
    s += bonusSaison(rec) + bonusStyleSaison(rec);
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
    s += Math.min(reprises, 1) * (p.objectifs.includes('economies') ? 1.5 : 0.6);
    if (ctx.sigs[rec.sig || rec.id]) s -= 8; // même plat avec une autre épice ou un autre féculent
    s -= (ctx.utilisations[rec.id] || 0) * 6;
    // variété de la semaine : familles de plats, protéines, légumes, féculents et cuisines qui tournent
    s -= (ctx.modeles[rec.modele] || 0) * (rec.modele === 'maison' || rec.modele === 'perso' ? 0.6 : 3);
    s -= (ctx.prots[rec.prot] || 0) * 1.2 + Math.max(0, (ctx.prots[rec.prot] || 0) - 1) * 2;
    for (const id of legumesPrincipaux(rec)) { const n = ctx.legs[id] || 0; s -= n * 0.9 + Math.max(0, n - 1) * 1.6; }
    const fec = feculentDe(rec); if (fec) { const n = ctx.fecs[fec] || 0; s -= Math.max(0, n - 1) * 1.8 + Math.max(0, n - 2) * 2; }
    s -= Math.max(0, (ctx.cuisines[rec.cuisine] || 0) - (rec.cuisine === 'francaise' ? 4 : 2)) * 1.2;
    if (ctx.hier && ctx.hier.includes(rec.id)) s -= 3;
    s += scoreGout(rec, p.gouts) * 1.6;
    // placard : on utilise d'abord ce qu'il y a à la maison (surtout le frais), sans compter ce que la semaine a déjà pris
    const st = p.stock || {};
    let duPlacard = 0;
    for (const [id, q] of rec.ing) {
      const dispo = (st[id] || 0) - (ctx.quantites[id] || 0);
      if (dispo >= q * 0.5 && ING[id].groupe !== 'A') duPlacard += PERISSABLES.has(ING[id].rayon) ? 1.5 : 1;
    }
    s += Math.min(duPlacard, 4) * 1.2;
    if (rec.perso) s += 3; // recettes de la bibliothèque : l'utilisateur les a choisies
    // « nos classiques » : 2 par semaine environ (valeurs sûres), sans les répéter
    if (ctx.classiques.includes(rec.id) && !ctx.utilisations[rec.id] && ctx.nbClassiques < ctx.cibleClassiques) s += 6;
    return s;
  }

  function candidats(p, jour, slot, ctx, exclure = []) {
    let base = recettesCompatibles(p).filter((r) => r.repas.includes(slot) && !exclure.includes(r.id) && ctx.notes[r.id] !== 1 && r.proposer !== false);
    const sansDeteste = base.filter((r) => !contientDeteste(r, p.gouts));
    if (sansDeteste.length >= 8) base = sansDeteste;
    // fruits et légumes frais hors saison : écartés tant qu'il reste assez de plats de saison
    const deSaison = base.filter((r) => !saisonRecette(r).hors.length);
    if (deSaison.length >= 12) base = deSaison;
    const flexi = p.regime === 'flexitarien' && ctx.repasViande >= 3;
    let liste = base.filter((r) => r.temps <= tempsMax(p, jour) && !(flexi && contientViande(r)));
    if (!liste.length) liste = base.filter((r) => r.temps <= tempsMax(p, jour) + 15 && !(flexi && contientViande(r)));
    if (!liste.length) liste = base;
    // jamais deux fois le même plat dans la semaine (même avec un autre féculent ou une autre épice)
    const neufs = liste.filter((r) => !ctx.sigs[r.sig || r.id] && !ctx.utilisations[r.id]);
    return neufs.length >= 3 ? neufs : liste;
  }
  /** Même plat (identique, ou seulement le féculent ou l'épice qui change). */
  const memePlat = (a, b) => !!(a && b && (a.id === b.id || (a.sig || a.id) === (b.sig || b.id)));
  /**
   * Remplace les plats en double dans la semaine (le premier reste, les suivants changent).
   * verrous : clés « jour-slot » à ne pas toucher (déjà mangés, choisis à la main…). → { plan, changes: [{ jour, slot, avant, apres }] }
   */
  function dedoublonner(plan, p, opts = {}) {
    if (!plan || !plan.jours) return { plan, changes: [] };
    const verrous = new Set(opts.verrous || []);
    const r = rng((plan.seed || 1) * 31 + 7);
    const vus = [];
    const changes = [];
    const jours = plan.jours.map((jp) => ({ ...jp }));
    // d'abord les repas verrouillés ou choisis : ils gardent leur plat
    const ordre = [];
    jours.forEach((jp, j) => SLOTS.forEach((sl) => { const m = jp[sl]; if (m && REC[m.recette] && !m.deRestes) ordre.push([j, sl, verrous.has(j + '-' + sl) || m.choisi || m.aChoisir ? 0 : 1]); }));
    ordre.sort((a, b) => a[2] - b[2] || a[0] - b[0]);
    for (const [j, sl, libre] of ordre) {
      const m = jours[j][sl];
      const rec = REC[m.recette];
      if (!vus.some((x) => memePlat(x, rec)) || !libre) { vus.push(rec); continue; }
      const ctx = contexteDepuisPlan({ ...plan, jours }, opts.notes, { jour: j, slot: sl }, opts.classiques);
      const autre = SLOTS.map((s2) => s2 !== sl && jours[j][s2] && jours[j][s2].recette).filter(Boolean);
      const liste = filtreTheme(candidats(p, j, sl, ctx, [m.recette, ...autre]), m.theme, ctx).filter((x) => !vus.some((v) => memePlat(v, x)));
      if (!liste.length) { vus.push(rec); continue; }
      let best = null, bestS = -Infinity;
      for (const x of liste) { const sc = score(x, p, ctx, r); if (sc > bestS) { bestS = sc; best = x; } }
      jours[j][sl] = { ...m, recette: best.id };
      delete jours[j][sl].recetteAvant;
      changes.push({ jour: j, slot: sl, avant: rec.id, apres: best.id });
      vus.push(best);
    }
    return { plan: changes.length ? { ...plan, jours } : plan, changes };
  }

  function ajouterAuContexte(ctx, rec, nb) {
    ctx.utilisations[rec.id] = (ctx.utilisations[rec.id] || 0) + 1;
    ctx.modeles[rec.modele] = (ctx.modeles[rec.modele] || 0) + 1;
    ctx.sigs[rec.sig || rec.id] = true;
    if (rec.prot) ctx.prots[rec.prot] = (ctx.prots[rec.prot] || 0) + 1;
    if (contientViande(rec)) ctx.repasViande++;
    if (ctx.classiques && ctx.classiques.includes(rec.id)) ctx.nbClassiques++;
    for (const [id, q] of rec.ing) ctx.quantites[id] = (ctx.quantites[id] || 0) + q * nb;
    for (const id of legumesPrincipaux(rec)) ctx.legs[id] = (ctx.legs[id] || 0) + 1;
    const f = feculentDe(rec); if (f) ctx.fecs[f] = (ctx.fecs[f] || 0) + 1;
    ctx.cuisines[rec.cuisine] = (ctx.cuisines[rec.cuisine] || 0) + 1;
  }
  // légumes qui donnent son caractère au plat (pas l'oignon ni l'ail), et féculent principal : pour varier la semaine
  const LEG_DISCRETS = new Set(['oignon', 'ail', 'citron', 'citron_vert', 'persil', 'echalote', 'tomates_concassees', 'coulis_tomate', 'puree_tomate', 'concentre_tomate']);
  const legumesPrincipaux = (rec) => [...new Set(rec.ing.map(([id]) => id).filter((id) => ING[id] && ING[id].groupe === 'L' && !LEG_DISCRETS.has(id)))];
  const feculentDe = (rec) => (rec.ing.find(([id]) => ING[id] && ING[id].groupe === 'F') || [])[0] || null;

  function nouveauContexte(notes, classiques) {
    const cl = classiques || [];
    return { utilisations: {}, modeles: {}, prots: {}, sigs: {}, quantites: {}, legs: {}, fecs: {}, cuisines: {}, repasViande: 0, notes: notes || {}, hier: null,
      classiques: cl, nbClassiques: 0, cibleClassiques: Math.min(3, cl.length) };
  }

  /* ---------- rituels de la semaine (thème d'un dîner) ---------- */
  const aIng = (r, f) => r.ing.some(([id]) => f(ING[id], id));
  const avecFeculent = (r, f) => r.id.split('-').includes(f) || (r.modele === 'maison' && aIng(r, (i, id) => id === f));
  const THEMES = {
    pates: { libelle: 'Soirée pâtes', ok: (r) => r.modele === 'pates' || (r.modele === 'gratin' && avecFeculent(r, 'pates')) || (r.modele === 'maison' && aIng(r, (i, id) => id === 'pates') && !/salade/i.test(r.nom)) },
    pizza: { libelle: 'Pizza maison', ok: (r) => r.modele === 'pizza' || /pizza/i.test(r.nom) },
    mijote: { libelle: 'Petit plat mijoté', ok: (r) => ['mijote', 'curry'].includes(r.modele) || /mijot|chili|dahl|couscous|potée|curry|parmentier|hachis|haricots blancs à la tomate|lentilles vertes mijotées|saucisses/i.test(r.nom) },
    soupe: { libelle: 'Soupe et tartines', ok: (r) => r.modele === 'veloute' || /soupe|velouté/i.test(r.nom) },
    monde: { libelle: 'Tour du monde', ok: (r) => r.cuisine !== 'francaise' },
    vege: { libelle: 'Soirée veggie', ok: (r) => !aIng(r, (i) => i.tags.includes('viande') || i.tags.includes('poisson')) },
    poisson: { libelle: 'Soirée poisson', ok: (r) => aIng(r, (i) => i.tags.includes('poisson')) },
    rapide: { libelle: 'Soirée express (20 min)', ok: (r) => r.temps <= 20 },
    oeufs: { libelle: 'Omelettes et quiches', ok: (r) => ['omelette', 'quiche'].includes(r.modele) || /omelette|quiche|tortilla espagnole|shakshuka|œufs cocotte|crêpes/i.test(r.nom) },
    enfants: { libelle: 'Le choix des enfants', ok: (r) => r.tags.includes('enfants') },
    classique: { libelle: 'Un de vos favoris', ok: (r, ctx) => ((ctx && ctx.classiques) || []).includes(r.id) }
  };
  // rituels proposés pour démarrer (lundi pâtes, mercredi choix des enfants, vendredi pizza, dimanche mijoté)
  function rituelsSuggeres(p) {
    const r = { 0: 'pates', 4: 'pizza', 6: 'mijote' };
    r[2] = p.foyer.enfants.length ? 'enfants' : 'monde';
    return r;
  }
  function themeDuSlot(p, jour, slot) {
    if (slot !== 'diner' || !p.rituels) return null;
    const t = p.rituels[jour];
    if (!t || !THEMES[t]) return null;
    if (t === 'enfants' && !p.foyer.enfants.length) return null;
    return t;
  }
  function filtreTheme(liste, theme, ctx) {
    if (!theme || !THEMES[theme]) return liste;
    const f = liste.filter((r) => THEMES[theme].ok(r, ctx));
    return f.length ? f : liste;
  }

  /** Génère 7 déjeuners + 7 dîners. */
  function genererSemaine(p, opts = {}) {
    const seed = opts.seed != null ? opts.seed : 1;
    const r = rng(seed);
    const ctx = nouveauContexte(opts.notes, opts.classiques);
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
        const theme = themeDuSlot(p, j, slot);
        const liste = filtreTheme(candidats(p, j, slot, ctx, aujourdHui), theme, ctx);
        if (!liste.length) { jourPlan[slot] = null; alertes.push(`Aucune recette compatible pour ${JOURS[j]} (${slot}).`); continue; }
        let best = null, bestS = -Infinity;
        for (const rec of liste) { const s = score(rec, p, ctx, r); if (s > bestS) { bestS = s; best = rec; } }
        ajouterAuContexte(ctx, best, nb);
        aujourdHui.push(best.id);
        jourPlan[slot] = { recette: best.id, portions: nb };
        if (theme) jourPlan[slot].theme = theme;
        if (theme === 'enfants') jourPlan[slot].aChoisir = true;
      }
      ctx.hier = aujourdHui;
      jours.push(jourPlan);
    }
    return { seed, jours, alertes, remplacements: 0 };
  }

  function contexteDepuisPlan(plan, notes, sauf, classiques) {
    const ctx = nouveauContexte(notes, classiques);
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
    const ctx = contexteDepuisPlan(plan, opts.notes, { jour, slot }, opts.classiques);
    const autreSlot = slot === 'dejeuner' ? 'diner' : 'dejeuner';
    const memeJour = plan.jours[jour][autreSlot] ? [plan.jours[jour][autreSlot].recette] : [];
    const r = rng((plan.seed * 31 + jour * 7 + (slot === 'diner' ? 3 : 1) + (plan.remplacements + 1) * 101) >>> 0);
    let liste = filtreTheme(candidats(p, jour, slot, ctx, [actuel.recette, ...memeJour, ...(opts.exclure || [])]), actuel.theme, ctx);
    if (!liste.length) return plan;
    let best = null, bestS = -Infinity;
    for (const rec of liste) { const s = score(rec, p, ctx, r); if (s > bestS) { bestS = s; best = rec; } }
    const jours = plan.jours.map((jp, i) => (i === jour ? { ...jp, [slot]: { ...actuel, recette: best.id } } : jp));
    return { ...plan, jours, remplacements: plan.remplacements + 1 };
  }

  /**
   * Propose d'autres plats pour un repas (par défaut 2, en plus du plat actuel), variés entre eux :
   * familles de plats différentes quand c'est possible, même thème que le rituel du jour.
   * opts : { notes, classiques, n, exclure, tour }  (tour : pour « encore d'autres idées »)
   */
  function propositions(plan, jour, slot, p, opts = {}) {
    const actuel = plan.jours[jour][slot];
    if (!actuel) return [];
    const n = opts.n || 2;
    const ctx = contexteDepuisPlan(plan, opts.notes, { jour, slot }, opts.classiques);
    const FILTRES = {
      saison: (x) => { const z = saisonRecette(x); return !z.hors.length && (z.dans.length > 0 || bonusStyleSaison(x) > 0); },
      rapide: (x) => x.temps <= 20,
      pascher: (x) => coutPortion(x) <= 1.2,
      leger: (x) => { const N = NUTRI(); const v = N && N.de(x, ING); return v ? v.kcal <= 520 : (x.tags || []).includes('leger'); },
      vege: (x) => !contientViande(x) && !x.ing.some(([id]) => (ING[id].tags || []).includes('poisson')),
      favoris: (x) => (opts.classiques || []).includes(x.id),
      chaud: (x) => styleRecette(x) === 'chaud'
    };
    const filtre = FILTRES[opts.filtre];
    const autreSlot = slot === 'dejeuner' ? 'diner' : 'dejeuner';
    const memeJour = plan.jours[jour][autreSlot] ? [plan.jours[jour][autreSlot].recette] : [];
    // « encore d'autres idées » : on écarte les plats déjà montrés, leurs variantes (même plat, autre féculent),
    // et on change de famille de plat et d'ingrédient principal à chaque série
    const deja = (opts.exclure || []).map((id) => REC[id]).filter(Boolean);
    const sigsDeja = new Set(deja.map((x) => x.sig || x.id));
    const compte = (f) => deja.reduce((o, x) => { const k = f(x); if (k) o[k] = (o[k] || 0) + 1; return o; }, {});
    const modelesDeja = compte((x) => (x.modele !== 'maison' ? x.modele : null)), protDeja = compte((x) => x.prot);
    const legDeja = compte((x) => (x.ing.find(([id]) => ING[id] && ING[id].groupe === 'L' && !['oignon', 'ail', 'citron', 'persil'].includes(id)) || [])[0]);
    let liste = filtreTheme(candidats(p, jour, slot, ctx, [actuel.recette, ...memeJour, ...(opts.exclure || [])]), actuel.theme, ctx);
    if (filtre) {
      // un filtre (rapide, petit prix, végétarien…) cherche dans tous les plats compatibles, pas seulement les mieux classés
      liste = recettesCompatibles(p).filter((x) => x.repas.includes(slot) && x.id !== actuel.recette && !memeJour.includes(x.id) && !(opts.exclure || []).includes(x.id) && !contientDeteste(x, p.gouts) && filtre(x));
      const deSaison = liste.filter((x) => !saisonRecette(x).hors.length);
      if (deSaison.length >= n) liste = deSaison;
    }
    const neuves = liste.filter((x) => !sigsDeja.has(x.sig || x.id));
    if (neuves.length >= n) liste = neuves;
    const r = rng((plan.seed * 17 + jour * 13 + (slot === 'diner' ? 5 : 2) + (opts.tour || 0) * 977) >>> 0);
    const varie = (x) => (modelesDeja[x.modele] || 0) * 3 + (protDeja[x.prot] || 0) * 1.5 + (legDeja[(x.ing.find(([id]) => ING[id] && ING[id].groupe === 'L' && !['oignon', 'ail', 'citron', 'persil'].includes(id)) || [])[0]] || 0) * 1.2;
    const classes = liste.map((rec) => [rec, score(rec, p, ctx, r) - varie(rec)]).sort((a, b) => b[1] - a[1]).map(([rec]) => rec);
    const choix = [];
    const familles = new Set([REC[actuel.recette].modele]);
    const sigs = new Set([REC[actuel.recette].sig || actuel.recette]);
    for (const rec of classes) {
      if (choix.length >= n) break;
      if (sigs.has(rec.sig || rec.id) || (familles.has(rec.modele) && rec.modele !== 'maison')) continue;
      choix.push(rec); familles.add(rec.modele); sigs.add(rec.sig || rec.id);
    }
    for (const rec of classes) {
      if (choix.length >= n) break;
      if (!choix.includes(rec) && !sigs.has(rec.sig || rec.id)) { choix.push(rec); sigs.add(rec.sig || rec.id); }
    }
    return choix.map((rec) => rec.id);
  }

  const norm = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe');
  const motsDe = (t) => norm(t).split(/[^a-z0-9]+/).filter((m) => m.length > 1 && !['de', 'du', 'des', 'la', 'le', 'les', 'au', 'aux', 'et', 'a', 'en', 'un', 'une', 'avec', 'sauce'].includes(m)).map((m) => m.replace(/(s|x)$/, ''));
  /**
   * Cherche des plats par leur nom parmi les recettes compatibles avec le profil (allergies, régime…).
   * Renvoie { resultats: [ids], masques: nombre de plats correspondants écartés par le profil }.
   */
  function rechercherPlats(p, texte, opts = {}) {
    const mots = motsDe(texte);
    if (!mots.length) return { resultats: [], masques: 0 };
    const correspond = (r) => { const n = motsDe(r.nom); return mots.every((m) => n.some((x) => x.startsWith(m))); };
    const compat = recettesCompatibles(p).concat(SAISON.filter((r) => !SAISON_ACTIF.includes(r) && recetteCompatible(r, p).ok)).filter((r) => (!opts.slot || r.repas.includes(opts.slot)) && correspond(r));
    const rang = (r) => (r.perso ? 0 : r.saison ? 0.5 : r.modele === 'maison' ? 1 : 2) + r.nom.length / 1000;
    const resultats = compat.sort((a, b) => rang(a) - rang(b));
    // un seul exemple par plat généré « même plat, autre épice »
    const vus = new Set();
    const uniques = resultats.filter((r) => { const k = r.sig || r.id; if (vus.has(k)) return false; vus.add(k); return true; });
    const tous = PERSO.concat(SAISON, RECETTES).filter(correspond).length;
    return { resultats: uniques.slice(0, opts.n || 8).map((r) => r.id), masques: Math.max(0, tous - compat.length) };
  }
  /** Met une recette quelconque (recherche, bibliothèque) à la place du plat prévu. */
  /**
   * Recalcule les portions de la semaine selon qui mange (p.presences) : un repas sans personne est mis de côté
   * (« pris dehors »), un repas qui revient retrouve son plat, ou reçoit un plat choisi comme pour une semaine neuve.
   */
  function appliquerPresences(plan, p, opts = {}) {
    const ctx = nouveauContexte(opts.notes, opts.classiques);
    plan.jours.forEach((jp) => SLOTS.forEach((sl) => { if (jp[sl] && REC[jp[sl].recette]) ajouterAuContexte(ctx, REC[jp[sl].recette], jp[sl].portions); }));
    const r = rng(opts.seed || 97);
    const jours = plan.jours.map((jp, j) => {
      const n = { ...jp };
      const aujourdHui = SLOTS.map((sl) => jp[sl] && jp[sl].recette).filter(Boolean);
      for (const slot of SLOTS) {
        if ((jp.passes || []).includes(slot)) { n[slot] = null; continue; }   // repas déjà passé à la création de la semaine
        const nb = portions(p, j, slot);
        const mis = '_' + slot;
        if (nb <= 0) { if (n[slot]) n[mis] = n[slot]; n[slot] = null; continue; }
        if (n[slot]) { n[slot] = { ...n[slot], portions: n[slot].manuel ? n[slot].portions : nb }; continue; }
        if (n[mis] && REC[n[mis].recette]) { n[slot] = { ...n[mis], portions: nb }; delete n[mis]; continue; }
        const liste = candidats(p, j, slot, ctx, aujourdHui);
        if (!liste.length) continue;
        let best = null, bestS = -Infinity;
        for (const rec of liste) { const sc = score(rec, p, ctx, r); if (sc > bestS) { bestS = sc; best = rec; } }
        ajouterAuContexte(ctx, best, nb);
        n[slot] = { recette: best.id, portions: nb };
      }
      return n;
    });
    return { ...plan, jours };
  }
  /* ---------- coach nutrition : améliorer la semaine en changeant quelques plats ---------- */
  // écart d'un repère à son objectif (0 si atteint), et note globale d'une semaine
  const ecartRepere = (r) => (r.etat === 'bas' ? (r.mini - r.valeur) / r.mini : r.etat === 'haut' ? (r.valeur - r.maxi) / r.maxi : 0);
  const noteBilan = (b) => b.atteints * 10 - b.reperes.reduce((t, r) => t + Math.min(3, ecartRepere(r)) * 4, 0);
  // ce qui aide chaque repère, pour présélectionner des plats
  const AIDE = {
    prot: (n) => n.parPortion.prot, fibres: (n) => n.parPortion.fibres, legumes: (n, r) => equilibre(r).grammesLegumes,
    sel: (n) => -n.parPortion.sel, ags: (n) => -n.parPortion.ags, sucres: (n) => -n.parPortion.sucres,
    rouge: (n, r) => (r.ing.some(([id]) => id === 'boeuf_hache') ? -1 : 1), charcuterie: (n, r) => (r.ing.some(([id]) => ['jambon', 'lardons', 'saucisse'].includes(id)) ? -1 : 1),
    poisson: (n, r) => (r.ing.some(([id]) => ['saumon', 'colin', 'thon'].includes(id)) ? (r.ing.some(([id]) => id === 'saumon') ? 2 : 1) : 0),
    legumineuses: (n, r) => (r.ing.some(([id]) => ['lentilles_corail', 'lentilles_vertes', 'pois_chiches', 'haricots_rouges', 'haricots_blancs', 'pois_casses'].includes(id)) ? 1 : 0),
    laitages: (n, r) => (r.ing.some(([id]) => ['lait', 'yaourt', 'emmental', 'mozzarella', 'feta'].includes(id)) ? 1 : 0)
  };
  /**
   * Propose jusqu'à « max » changements de plats qui améliorent le bilan nutritionnel de la semaine,
   * sans faire baisser les autres repères, en respectant le profil (allergies, régime, goûts, notes).
   * → [{ jour, slot, avant, apres, gains: [libellés], cout: écart de coût sur la semaine }]
   */
  function ameliorerSemaine(plan, p, opts = {}) {
    const N = NUTRI();
    if (!plan || !N) return { propositions: [], avant: null, apres: null };
    const notes = opts.notes || {};
    const compat = recettesCompatibles(p).filter((r) => notes[r.id] !== 1 && r.proposer !== false);
    const avant = N.bilanSemaine(plan, REC, ING);
    let courant = plan, bilan = avant;
    const propositions = [], touches = new Set();
    for (let tour = 0; tour < (opts.max || 4); tour++) {
      const manques = bilan.reperes.filter((r) => r.etat !== 'ok').sort((a, b) => ecartRepere(b) - ecartRepere(a));
      if (!manques.length) break;
      const dansSemaine = new Set(courant.jours.flatMap((jp) => SLOTS.map((sl) => jp[sl] && jp[sl].recette)).filter(Boolean));
      let meilleur = null;
      for (const cible of manques.slice(0, 2)) {
        const f = AIDE[cible.cle] || (() => 0);
        const sigsSemaine = new Set([...dansSemaine].map((id) => REC[id] && (REC[id].sig || id)));
        const pool = compat.filter((r) => !dansSemaine.has(r.id) && !sigsSemaine.has(r.sig || r.id)).map((r) => ({ r, v: f(N.de(r, ING), r) + scoreGout(r, p.gouts) * 0.3 })).sort((a, b) => b.v - a.v).slice(0, 50).map((x) => x.r);
        courant.jours.forEach((jp, j) => SLOTS.forEach((slot) => {
          const m = jp[slot];
          if (!m || m.aChoisir || touches.has(j + '-' + slot) || (opts.classiques || []).includes(m.recette)) return;
          for (const r of pool) {
            if (!r.repas.includes(slot) || r.temps > tempsMax(p, j) + 10) continue;
            const essai = choisirRepas(courant, j, slot, r.id);
            const b = N.bilanSemaine(essai, REC, ING);
            if (b.atteints < bilan.atteints) continue;
            const gain = noteBilan(b) - noteBilan(bilan) + scoreGout(r, p.gouts) * 0.2 + (bonusCoach(r, p) - bonusCoach(REC[m.recette], p)) * 0.6 - Math.max(0, coutPortion(r) - coutPortion(REC[m.recette])) * 0.5;
            if (gain > 0.5 && (!meilleur || gain > meilleur.gain)) meilleur = { gain, j, slot, r, essai, b };
          }
        }));
        if (meilleur) break;
      }
      if (!meilleur) break;
      const m = courant.jours[meilleur.j][meilleur.slot];
      const gains = [];
      for (const r2 of meilleur.b.reperes) {
        const r1 = bilan.reperes.find((x) => x.cle === r2.cle);
        if (r1.etat !== 'ok' && r2.etat === 'ok') gains.push(`${r2.nom} : repère atteint`);
        else if (ecartRepere(r2) < ecartRepere(r1) - 0.02) gains.push(`${r2.nom} : ${r2.valeur > r1.valeur ? '+' : ''}${Math.round((r2.valeur - r1.valeur) * 10) / 10} ${r2.unite.split(' ')[0]}`);
      }
      propositions.push({ jour: meilleur.j, slot: meilleur.slot, avant: m.recette, apres: meilleur.r.id, gains: gains.slice(0, 3), cout: round2((coutPortion(meilleur.r) - coutPortion(REC[m.recette])) * m.portions) });
      touches.add(meilleur.j + '-' + meilleur.slot);
      courant = meilleur.essai; bilan = meilleur.b;
    }
    return { propositions, avant, apres: bilan };
  }
  function placerRecette(plan, jour, slot, recetteId) { return choisirRepas(plan, jour, slot, recetteId); }

  /** Met le plat choisi à la place du plat prévu (choix parmi les propositions : ne compte pas comme un remplacement). */
  function choisirRepas(plan, jour, slot, recetteId) {
    const actuel = plan.jours[jour][slot];
    if (!actuel || !REC[recetteId]) return plan;
    const jours = plan.jours.map((jp, i) => (i === jour ? { ...jp, [slot]: { ...actuel, recette: recetteId, aChoisir: false, choisi: true } } : jp));
    return { ...plan, jours };
  }

  const virgule = (n) => n.toFixed(2).replace('.', ',') + ' €';
  const deOu = (mot) => (/^[aeiouyéèêhœ]/i.test(mot) ? 'd’' : 'de ') + mot;
  /** Jusqu'à 3 raisons courtes de proposer ce plat pour ce repas (« Pourquoi ce plat ? »). */
  function pourquoi(recetteId, plan, jour, slot, p, opts = {}) {
    const rec = REC[recetteId];
    if (!rec) return [];
    const raisons = [];
    const classiques = opts.classiques || [];
    const m = plan.jours[jour] && plan.jours[jour][slot];
    const th = m && m.theme && THEMES[m.theme];
    if (th && m.theme !== 'enfants' && th.ok(rec, { classiques })) raisons.push(`${th.libelle} du ${JOURS[jour].toLowerCase()}`);
    if (rec.perso) raisons.push('Dans votre bibliothèque');
    if (classiques.includes(rec.id)) raisons.push('⭐ Un de vos favoris');
    const sa = saisonRecette(rec);
    const sCuis = saisonCuisine(), sStyle = styleRecette(rec);
    if (sCuis === 'froide' && sStyle === 'chaud') raisons.push('Un plat chaud de saison');
    else if (sCuis === 'chaude' && sStyle === 'frais') raisons.push('Frais, pour l’été');
    if (sa.dans.length && !sa.hors.length) raisons.push(`De saison : ${sa.dans.slice(0, 2).map((id) => ING[id].nom.replace(/\s*\([^)]*\)$/, '').toLowerCase()).join(', ')}`);
    const note = (opts.notes || {})[rec.id];
    if (note >= 4) raisons.push(`Vous l’avez noté ${note} ★`);
    const g = p.gouts || goutsVides();
    const aime = rec.ing.map(([id]) => id).filter((id) => (g.ing[id] || 0) >= 1 && ['P', 'L', 'F', 'D'].includes(ING[id].groupe)).sort((a, b) => g.ing[b] - g.ing[a])[0];
    if (aime) raisons.push(`Vous aimez : ${ING[aime].nom.toLowerCase()}`);
    else if ((g.cuisine[rec.cuisine] || 0) >= 1 || p.cuisines.includes(rec.cuisine)) raisons.push(`Vous aimez la cuisine ${(LIBELLES.cuisines[rec.cuisine] || rec.cuisine).toLowerCase()}`);
    const autres = [];
    plan.jours.forEach((jp, i) => SLOTS.forEach((s2) => { if (jp[s2] && !(i === jour && s2 === slot)) autres.push([i, REC[jp[s2].recette]]); }));
    const st = p.stock || {};
    const duPlacard = rec.ing.map(([id]) => id).filter((id) => (st[id] || 0) > 0 && ING[id].groupe !== 'A' && !['oignon', 'ail'].includes(id));
    if (duPlacard.length) raisons.push(`Utilise votre placard : ${duPlacard.slice(0, 2).map((id) => ING[id].nom.toLowerCase()).join(', ')}`);
    const BANALS = ['oignon', 'ail', 'citron', 'persil', 'salade', 'beurre'];
    const partage = rec.ing.map(([id]) => id).find((id) => PERISSABLES.has(ING[id].rayon) && ING[id].groupe !== 'A' && !BANALS.includes(id) && !duPlacard.includes(id) && autres.some(([, r2]) => r2.ing.some(([x]) => x === id)));
    if (partage) {
      const [i] = autres.find(([, r2]) => r2.ing.some(([x]) => x === partage));
      raisons.push(`Finit le paquet ${deOu(ING[partage].nom.toLowerCase())} ${i === jour ? 'du même jour' : 'de ' + JOURS[i].toLowerCase()}`);
    }
    const c = coutPortion(rec);
    if (c <= 1.1) raisons.push(`Seulement ${virgule(c)} la part`);
    if (rec.temps <= 20) raisons.push(`Prêt en ${rec.temps} min`);
    if (p.foyer.enfants.length && rec.tags.includes('enfants')) raisons.push('Plaît souvent aux enfants');
    return raisons.slice(0, 3);
  }

  /* ---------- prix d'un magasin (relevés sur les tickets de caisse) ---------- */
  let SOURCE_MAGASIN = null;
  /** prix : { ingrédient: prix d'un paquet } relevés dans un magasin ; null pour revenir aux prix de démonstration. */
  function definirPrixMagasin(prix, infos) {
    for (const i of Object.values(ING)) if (i.prixBase != null) { i.prixDemo = i.prixBase; delete i.prixBase; }
    let n = 0;
    if (prix) for (const [id, p] of Object.entries(prix)) if (ING[id] && !ING[id].perso && p > 0) { ING[id].prixBase = ING[id].prixDemo; ING[id].prixDemo = p; n++; }
    cacheCout.clear();
    SOURCE_MAGASIN = prix && n ? { type: 'magasin', libelle: infos && infos.libelle ? infos.libelle : `Prix ${infos && infos.nom ? 'de ' + infos.nom : 'de votre magasin'}`, detail: infos && infos.detail ? infos.detail : `${n} prix relevés sur vos tickets${infos && infos.nom ? ' chez ' + infos.nom : ''}${infos && infos.date ? ' (dernier le ' + infos.date + ')' : ''} ; les autres produits gardent un prix moyen estimé.`, date: infos && infos.date } : null;
    return n;
  }
  /** Prix habituel d'un produit (sans les prix de magasin). */
  const prixReference = (id) => (ING[id] ? (ING[id].prixBase != null ? ING[id].prixBase : ING[id].prixDemo) : 0);
  const sourcePrix = () => SOURCE_MAGASIN || DATA.PRIX_SOURCE;
  /* ---------- liste de courses et budget ---------- */
  const PLACARD_BASE = ['huile_olive', 'curry', 'cumin', 'paprika', 'bouillon', 'moutarde'];
  function stockIds(p) {
    // depuis que les provisions sont rangées dans le placard, c'est le placard (avec ses quantités) qui fait foi :
    // seuls les ingrédients hors catalogue (sans quantité suivie) restent notés « j'en ai déjà » à part
    if (Array.isArray(p.provisionsRangees)) return new Set((p.provisions || []).filter((id) => ING[id] && ING[id].perso));
    const s = new Set(p.provisions);
    if (p.placardBase) PLACARD_BASE.forEach((id) => s.add(id));
    return s;
  }

  function listeCourses(plan, p) {
    const besoins = {};
    plan.jours.forEach((jp) => {
      SLOTS.forEach((slot) => {
        const m = jp[slot];
        if (!m || !REC[m.recette]) return;
        const n = aCuisiner(m);
        if (n > 0) for (const [id, q] of REC[m.recette].ing) besoins[id] = (besoins[id] || 0) + q * n;
      });
      // gamelles préparées à part
      if (jp.gamelles && jp.gamelles.mode === 'plat' && REC[jp.gamelles.recette]) for (const [id, q] of REC[jp.gamelles.recette].ing) besoins[id] = (besoins[id] || 0) + q * jp.gamelles.portions;
      // desserts et goûters ajoutés à la semaine
      for (const g of jp.gourmand || []) if (REC[g.recette]) for (const [id, q] of REC[g.recette].ing) besoins[id] = (besoins[id] || 0) + q * g.portions;
    });
    // programme minceur : l'assiette de la personne (moins de féculents, plus de légumes) et le pain des enfants si le plat n'a pas de féculent
    if (programmeActif(p)) plan.jours.forEach((jp, j) => SLOTS.forEach((slot) => {
      const m = jp[slot];
      if (!m || !REC[m.recette] || m.dehors || m.deRestes || m.libre || aCuisiner(m) <= 0) return;
      const a = assietteMinceur(REC[m.recette]); if (!a) return;
      const pr = presence(p, j, slot);
      const pers = Math.min(Math.max(1, p.programme.personnes || 1), pr.a);
      if (pers > 0) for (const [id, f] of a.aj) { const q = (REC[m.recette].ing.find(([k]) => k === id) || [0, 0])[1]; besoins[id] = Math.max(0, (besoins[id] || 0) + q * (f - 1) * pers); }
      if (pers > 0) for (const [id, q] of a.ajout || []) besoins[id] = (besoins[id] || 0) + q * pers;
      const e = enfantsPresents(p, j, slot);
      if (!a.feculent && e > 0 && ING[COMPLEMENT_ENFANT[0]]) besoins[COMPLEMENT_ENFANT[0]] = (besoins[COMPLEMENT_ENFANT[0]] || 0) + COMPLEMENT_ENFANT[1] * e;
    }));
    for (const id of Object.keys(besoins)) if (besoins[id] <= 1e-9) delete besoins[id];
    const stock = stockIds(p);
    const placard = p.stock || {};
    const articles = Object.entries(besoins).map(([id, q]) => {
      const ing = ING[id];
      const auPlacard = ing.perso ? 0 : Math.max(0, placard[id] || 0);
      if (auPlacard >= q - 1e-9 && !ing.perso) {
        return { id, nom: ing.nom, rayon: ing.rayon, unite: ing.unite, quantite: q, conditionnements: Math.ceil(q / ing.cond - 1e-9), condLabel: ing.condLabel, cout: round2(Math.ceil(q / ing.cond - 1e-9) * ing.prixDemo), enStock: true, auPlacard, reste: auPlacard - q, couvertParPlacard: true };
      }
      if (ing.perso) { // ingrédient hors catalogue : quantité selon la recette, prix inconnu
        return { id, nom: ing.nom, rayon: ing.rayon, unite: ing.unite, quantite: 0, conditionnements: 1, condLabel: ing.condLabel, cout: 0, enStock: stock.has(id), reste: 0, sansPrix: true };
      }
      const aAcheter = q - auPlacard;
      const conditionnements = Math.ceil(aAcheter / ing.cond - 1e-9);
      const cout = round2(conditionnements * ing.prixDemo);
      return {
        id, nom: ing.nom, rayon: ing.rayon, unite: ing.unite, quantite: q,
        conditionnements, condLabel: ing.condLabel, cout,
        enStock: stock.has(id), auPlacard, reste: conditionnements * ing.cond - aAcheter
      };
    });
    // produits ajoutés à la main : [{ id: ingrédient du catalogue, n: paquets }] ou [{ nom: texte libre, n }]
    for (const x of plan.manuels || []) {
      const n = Math.max(1, Math.round(+x.n || 1));
      const ing = x.id && ING[x.id] && !ING[x.id].perso ? ING[x.id] : null;
      if (ing) {
        const i = articles.findIndex((a) => a.id === x.id);
        const ex = i >= 0 ? articles[i] : null;
        if (ex && !ex.enStock && !ex.couvertParPlacard && !ex.sansPrix) {
          ex.conditionnements += n; ex.cout = round2(ex.conditionnements * ing.prixDemo); ex.reste += n * ing.cond; ex.manuel = n;
        } else {
          if (ex) articles.splice(i, 1);
          articles.push({ id: x.id, nom: ing.nom, rayon: ing.rayon, unite: ing.unite, quantite: n * ing.cond, conditionnements: n, condLabel: ing.condLabel, cout: round2(n * ing.prixDemo), enStock: false, auPlacard: 0, reste: 0, manuel: n, seulManuel: true });
        }
      } else if (x.nom) {
        const id = 'm-' + slug(x.nom);
        if (!ING[id]) ING[id] = { id, nom: String(x.nom).slice(0, 60), rayon: 'Divers', unite: 'pièce', cond: 1, condLabel: '', prixDemo: 0, groupe: 'A', tags: [], perso: true, libre: true };
        const ex = articles.find((a) => a.id === id);
        if (ex) ex.manuel += n;
        else articles.push({ id, nom: ING[id].nom, rayon: 'Divers', unite: 'pièce', quantite: 0, conditionnements: n, condLabel: '', cout: 0, enStock: false, reste: 0, sansPrix: true, manuel: n, seulManuel: true, libre: true });
      }
    }
    articles.sort((a, b) => a.rayon.localeCompare(b.rayon, 'fr') || a.nom.localeCompare(b.nom, 'fr'));
    const total = round2(articles.filter((a) => !a.enStock).reduce((s, a) => s + a.cout, 0));
    const economieStock = round2(articles.filter((a) => a.enStock).reduce((s, a) => s + a.cout, 0));
    // coût de ce qui est réellement mangé cette semaine (le reste des paquets sert ensuite)
    const consomme = round2(articles.filter((a) => !a.enStock && !a.libre).reduce((s, a) => s + (a.quantite - (a.auPlacard || 0)) * ING[a.id].prixDemo / ING[a.id].cond, 0));
    return { articles, total, consomme, economieStock, source: sourcePrix() };
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
    return { estimation: liste.total, consomme: liste.consomme, budget: p.budget, ecart, ok: ecart <= 0, conseils, source: sourcePrix() };
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
    for (const [id, q] of Object.entries(p.stock || {})) if (q > 0) stock.add(id);
    const rapides = recettesCompatibles(p)
      .filter((r) => r.repas.includes('diner') && r.temps <= 20 && (!prevu || r.id !== prevu.recette) && opts.notes?.[r.id] !== 1)
      .map((r) => ({ r, manquants: r.ing.filter(([id]) => !dejaAchete.has(id) && !stock.has(id)).length }))
      .sort((a, b) => a.manquants - b.manquants || scoreGout(b.r, p.gouts) - scoreGout(a.r, p.gouts) || a.r.temps - b.r.temps)
      .slice(0, 3)
      .map(({ r, manquants }) => ({ recette: r.id, manquants }));
    // à manquants égaux, on préfère ce que la personne aime
    return { prevu, idees: rapides, avecPlacard: recettesAvecStock(p, { slot: 'diner', jour, n: 3, notes: opts.notes, exclure: prevu ? [prevu.recette] : [] }) };
  }

  /* ---------- placard : ce qui reste à la maison ---------- */
  const QUASI_RIEN = 1e-6;
  function nettoyerStock(st) {
    const r = {};
    for (const [id, q] of Object.entries(st || {})) if (ING[id] && !ING[id].perso && q > QUASI_RIEN && q > ING[id].cond * 0.005) r[id] = Math.round(q * 100) / 100;
    return r;
  }
  /** Ajoute des quantités au placard : [[ingrédient, quantité]] (achats, ou « ce que j'ai déjà »). */
  function ajouterAuStock(st, ajouts) {
    const r = { ...(st || {}) };
    for (const [id, q] of ajouts) if (ING[id] && !ING[id].perso && q > 0) r[id] = (r[id] || 0) + q;
    return nettoyerStock(r);
  }
  /** Retire des quantités (jamais en dessous de zéro). */
  function retirerDuStock(st, retraits) {
    const r = { ...(st || {}) };
    for (const [id, q] of retraits) if (r[id] != null) r[id] = Math.max(0, r[id] - q);
    return nettoyerStock(r);
  }
  /** Ce qu'un repas consomme : recette × portions (ingrédients du catalogue). */
  function consommationRepas(m) {
    if (!m || !REC[m.recette]) return [];
    const n = m.deRestes || m.dehors ? 0 : m.portions + (m.plus || 0);
    if (!n) return [];
    return REC[m.recette].ing.filter(([id]) => !ING[id].perso).map(([id, q]) => [id, q * n]);
  }
  /** Ce qu'un article acheté ajoute au placard : nombre de paquets × taille du paquet. */
  function achatArticle(a) { return ING[a.id] && !ING[a.id].perso ? [a.id, a.conditionnements * ING[a.id].cond] : null; }

  /**
   * Recettes faisables avec le placard : celles qui utilisent le plus ce qu'il y a, avec le moins d'achats.
   * opts : { slot, jour, n, notes, exclure, portions } → [{ recette, utilise: [ids], manquants: [ids] }]
   */
  function recettesAvecStock(p, opts = {}) {
    const st = p.stock || {};
    const base = stockIds(p);
    const portionsRepas = opts.portions || portions(p, opts.jour != null ? opts.jour : 0, opts.slot || 'diner') || 1;
    if (!Object.keys(st).length) return [];
    const res = [];
    for (const r of recettesCompatibles(p)) {
      if (opts.slot && !r.repas.includes(opts.slot)) continue;
      if ((opts.exclure || []).includes(r.id) || (opts.notes || {})[r.id] === 1) continue;
      const principaux = r.ing.filter(([id]) => ING[id].groupe !== 'A' && !ING[id].perso);
      if (!principaux.length) continue;
      const utilise = [], manquants = [];
      for (const [id, q] of principaux) {
        if ((st[id] || 0) >= q * portionsRepas * 0.8) utilise.push(id);
        else if (!base.has(id)) manquants.push(id);
      }
      if (!utilise.length) continue;
      const frais = utilise.filter((id) => PERISSABLES.has(ING[id].rayon)).length;
      res.push({ r, utilise, manquants, cle: manquants.length * 10 - utilise.length * 2 - frais - scoreGout(r, p.gouts) * 0.5 });
    }
    res.sort((a, b) => a.cle - b.cle);
    const vus = new Set();
    return res.filter((x) => { const k = x.r.sig || x.r.id; if (vus.has(k)) return false; vus.add(k); return true; })
      .slice(0, opts.n || 6).map((x) => ({ recette: x.r.id, utilise: x.utilise, manquants: x.manquants }));
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
  function goutsVides() { return { ing: {}, cuisine: {}, modele: {}, plat: {} }; }
  /** Un aliment clairement refusé (test de goût, correction « Pas pour moi ») : le plat n'est pas proposé. */
  function contientDeteste(rec, g) {
    if (!g || !g.ing) return false;
    return rec.ing.some(([id]) => (g.ing[id] || 0) <= -2.4 && ING[id] && ING[id].groupe !== 'A' && !['oignon', 'ail'].includes(id)) || ((g.plat || {})[rec.id] || 0) <= -3;
  }
  const EPICES_PLAT = new Set(['curry', 'cumin', 'paprika', 'piment', 'pate_curry', 'gingembre', 'epices']);
  function scoreGout(rec, g) {
    if (!g) return 0;
    let s = 0;
    for (const [id] of rec.ing) { const w = (g.ing || {})[id]; if (w) s += w * (POIDS_GROUPE[ING[id].groupe] || 0.2); }
    s += ((g.cuisine || {})[rec.cuisine] || 0) * 0.8 + ((g.modele || {})[rec.modele] || 0) * 0.8 + ((g.plat || {})[rec.id] || 0);
    if (g.epice && rec.ing.some(([id]) => EPICES_PLAT.has(id))) s += g.epice * 0.9;
    return s;
  }
  const REPONSES = { adore: 1.2, pourquoi: 0.25, non: -1.5 };
  /** Ingrédients qui font un plat (protéine, légumes, féculent, laitages) : ceux qu'on peut aimer ou pas. */
  function ingredientsMarquants(rec) {
    if (!rec) return [];
    const ids = rec.ing.map(([id]) => id).filter((id) => ING[id] && !ING[id].perso && ['P', 'L', 'F', 'D'].includes(ING[id].groupe));
    return [...new Set([rec.prot, ...ids].filter((id) => id && ids.includes(id)))].slice(0, 7);
  }
  /**
   * Met à jour les goûts après une réponse au test (« adore », « pourquoi », « non »).
   * Pour « non », `raisons` dit ce qui ne plaît pas : ['ing:feta', 'cuisine:orientale'…].
   * Sans raison, seul ce plat est écarté et ses ingrédients ne prennent qu'une petite pénalité :
   * un seul « non » ne suffit pas à décider que vous n'aimez pas un ingrédient.
   */
  function apprendre(gouts, recetteId, reponse, raisons) {
    const g = { ...goutsVides(), ...JSON.parse(JSON.stringify(gouts || goutsVides())) };
    g.plat = g.plat || {};
    const rec = REC[recetteId], a = REPONSES[reponse];
    if (!rec || a == null) return g;
    if (reponse === 'non') {
      g.plat[rec.id] = -3;
      const r = Array.isArray(raisons) ? raisons : null;
      if (r && r.length) {
        for (const x of r) {
          const [t, k] = String(x).split(':');
          if (t === 'ing' && ING[k]) g.ing[k] = borne(Math.min(g.ing[k] || 0, 0) - 2.5);
          if (t === 'cuisine' && LIBELLES.cuisines[k]) g.cuisine[k] = borne((g.cuisine[k] || 0) - 1.5);
        }
        return g;
      }
      // pas de raison donnée : légère pénalité, jamais assez pour classer un ingrédient « pas aimé » seul
      for (const id of ingredientsMarquants(rec)) g.ing[id] = borne((g.ing[id] || 0) - 0.3);
      return g;
    }
    if (g.plat[rec.id] < 0) delete g.plat[rec.id];
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
  /** Correction directe d'un goût : valeur 'aime' | 'non' | 'neutre'. Type : 'ing' | 'cuisine' | 'modele'. */
  function reglerGout(gouts, type, cle, valeur) {
    const g = { ...goutsVides(), ...JSON.parse(JSON.stringify(gouts || goutsVides())) };
    if (!g[type]) return g;
    if (valeur === 'neutre') delete g[type][cle];
    else g[type][cle] = valeur === 'aime' ? 2.5 : -2.5;
    // en aimant un ingrédient, on rouvre les plats écartés qui le contiennent
    if (type === 'ing' && valeur === 'aime') for (const id of Object.keys(g.plat || {})) if (REC[id] && REC[id].ing.some(([x]) => x === cle)) delete g.plat[id];
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
  /** Résumé lisible des goûts : ce qui est aimé, ce qui l'est moins (avec `details` pour corriger). */
  function resumeGouts(g) {
    if (!g) return { aime: [], evite: [], details: { aime: [], evite: [] } };
    const nomIng = (id) => ING[id].nom.replace(/\s*\([^)]*\)\s*$/, '');
    const items = [
      ...Object.entries(g.ing || {}).filter(([id]) => ING[id] && ['P', 'L', 'F', 'D'].includes(ING[id].groupe)).map(([id, w]) => ({ type: 'ing', cle: id, nom: nomIng(id), w })),
      ...Object.entries(g.cuisine || {}).map(([k, w]) => ({ type: 'cuisine', cle: k, nom: 'Cuisine ' + (LIBELLES.cuisines[k] || k).toLowerCase(), w })),
      ...Object.entries(g.modele || {}).filter(([k]) => k !== 'maison').map(([k, w]) => ({ type: 'modele', cle: k, nom: MODELES[k] ? MODELES[k].libelle : k, w }))
    ];
    const aime = items.filter((x) => x.w >= 0.9).sort((a, b) => b.w - a.w).slice(0, 12);
    const evite = items.filter((x) => x.w <= -0.9).sort((a, b) => a.w - b.w).slice(0, 12);
    return { aime: aime.map((x) => x.nom), evite: evite.map((x) => x.nom), details: { aime, evite } };
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
    JOURS, SLOTS, LIBELLES, ING, REC, DATA, REFUS, PLACARD_BASE, reglerGout, ingredientsMarquants, RECETTES, MODELES,
    goutsVides, scoreGout, contientDeteste, apprendre, fusionnerGouts, selectionTest, resumeGouts,
    THEMES, rituelsSuggeres, propositions, choisirRepas, pourquoi,
    definirPerso, definirGourmand, gourmandises, rechercherPlats, placerRecette, idExtra, motsDe, norm, slug,
    ajouterAuStock, retirerDuStock, consommationRepas, achatArticle, recettesAvecStock, nettoyerStock,
    definirPrixMagasin, prixReference, sourcePrix, saisonRecette, saisonCuisine, styleRecette, moisCourant, definirMois, CALENDRIER, assietteMinceur, recetteAdaptee, enfantsPresents, programmeActif, profilParDefaut, ameliorerSemaine, dedoublonner, definirVariantes, differences, memePlat, portions, organiserRestes, ajouterIngredients, definirSaison, saisonActives, ideesSaison, aCuisiner, nbGamelles, platsGamelle, presence, presenceParDefaut, appliquerPresences, ingredientInterdit, recetteCompatible, recettesCompatibles,
    coutPortion, equilibre, genererSemaine, remplacerRepas, listeCourses, analyseBudget,
    ajusterAuBudget, ceSoir, bonusCoach, bilanCoach, optimiserDrives, magasinsDemo, contientViande, coutRepas
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
