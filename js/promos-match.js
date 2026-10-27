/* Budgétable — rapprochement des promotions avec les produits de la liste de courses, et dates des offres.
 *
 * Règle principale : le produit en promotion doit ÊTRE l'ingrédient (son nom commence par lui, après la marque),
 * et non un plat qui le contient. « Tarte aux pommes pur beurre » n'est pas du beurre, « Cheetos goût fromage »
 * n'est pas de l'emmental râpé, « Salade de concombres » n'est pas une laitue.
 *   - correspondance exacte : le même produit (« MILBONA Emmental râpé » pour l'emmental râpé) ;
 *   - alternative à vérifier : un produit qui peut le remplacer dans les recettes (« Comté râpé », « Mâche »).
 * Sans correspondance utilisable : null (l'appli dit « pas de promo adaptée » plutôt que d'en inventer une).
 *
 * Dates : chaque offre reçoit un état « en cours », « à venir » ou « terminée », calculé au moment de l'affichage
 * (une offre lue il y a quelques heures peut s'être terminée depuis).
 */
(function (root) {
  'use strict';
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[’'`]/g, ' ').replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();
  // pluriels simples, mot par mot (« carottes » = « carotte », « choux » = « chou »)
  const sing = (w) => (w.length > 3 && /[sx]$/.test(w) && !/(ss|is|us|as)$/.test(w) ? w.slice(0, -1) : w);
  const mots = (t) => norm(t).split(' ').filter(Boolean).map(sing);

  /* ---------- produits exacts et alternatives (ingrédients de base du catalogue) ---------- */
  const TABLE = {
    oignon: { exact: ['oignon', 'oignon jaune', 'oignon rouge', 'oignon blanc'], alt: ['echalote', 'oignon nouveau', 'cebette'] },
    ail: { exact: ['ail', 'tete d ail', 'ail blanc', 'ail violet', 'ail rose'] },
    carotte: { exact: ['carotte', 'carotte des sables', 'carotte fane'] },
    courgette: { exact: ['courgette'] },
    tomate: { exact: ['tomate', 'tomate ronde', 'tomate grappe', 'tomate allongee'], alt: ['tomate cerise', 'tomate cocktail'] },
    poivron: { exact: ['poivron', 'poivron rouge', 'poivron vert', 'poivron jaune', 'poivron tricolore'] },
    pomme_de_terre: { exact: ['pomme de terre', 'pomme de terre de consommation', 'pomme de terre grenaille', 'grenaille', 'patate'] },
    poireau: { exact: ['poireau'] },
    champignon: { exact: ['champignon de paris', 'champignon', 'champignon blanc', 'champignon brun'] },
    brocoli: { exact: ['brocoli'] },
    salade: { exact: ['laitue', 'salade verte', 'batavia', 'feuille de chene', 'romaine', 'iceberg', 'sucrine', 'frisee', 'scarole', 'salade'], alt: ['mache', 'roquette', 'mesclun', 'jeune pousse', 'melange de salade'] },
    concombre: { exact: ['concombre'] },
    aubergine: { exact: ['aubergine'] },
    courge: { exact: ['courge butternut', 'butternut', 'courge'], alt: ['potiron', 'potimarron', 'citrouille', 'courge musquee'] },
    citron: { exact: ['citron', 'citron jaune'], alt: ['citron vert'] },
    persil: { exact: ['persil', 'persil plat', 'persil frise'] },
    poulet_filet: { exact: ['filet de poulet', 'blanc de poulet', 'escalope de poulet', 'aiguillette de poulet', 'emince de poulet'], alt: ['filet de dinde', 'escalope de dinde', 'emince de dinde', 'aiguillette de dinde'] },
    cuisses_poulet: { exact: ['cuisse de poulet', 'haut de cuisse de poulet', 'pilon de poulet', 'haut de cuisse', 'pilon'], alt: ['poulet entier', 'poulet fermier'] },
    boeuf_hache: { exact: ['steak hache', 'viande hachee', 'boeuf hache', 'hache de boeuf', 'viande hachee de boeuf'], alt: ['hache de veau', 'hache porc boeuf', 'boulette de boeuf'] },
    jambon: { exact: ['jambon blanc', 'jambon cuit', 'jambon superieur', 'jambon de paris', 'jambon'], alt: ['blanc de dinde', 'jambon de dinde', 'jambon de poulet'] },
    lardons: { exact: ['lardon', 'lardon fume', 'lardon nature', 'allumette', 'allumette de bacon'], alt: ['bacon', 'poitrine fumee'] },
    saucisse: { exact: ['saucisse de toulouse', 'saucisse'], alt: ['chipolata', 'saucisse de volaille', 'merguez'] },
    saumon: { exact: ['pave de saumon', 'filet de saumon', 'saumon', 'saumon atlantique'], alt: ['truite', 'pave de truite', 'filet de truite'] },
    oeufs: { exact: ['oeuf', 'oeuf frais', 'oeuf plein air', 'oeuf de poule'] },
    lait: { exact: ['lait demi ecreme', 'lait'], alt: ['lait entier', 'lait ecreme'] },
    beurre: { exact: ['beurre', 'beurre doux', 'beurre demi sel', 'beurre gastronomique', 'beurre moule', 'beurre de baratte', 'beurre tendre', 'beurre extra fin'], alt: ['margarine', 'beurre allege'] },
    creme: { exact: ['creme fraiche', 'creme fraiche epaisse', 'creme epaisse', 'creme fraiche legere'], alt: ['creme semi epaisse'] },
    emmental: { exact: ['emmental rape', 'emmental', 'emmental francais rape'], alt: ['fromage rape', 'gruyere rape', 'comte rape', 'mozzarella rapee', 'parmesan rape', 'melange de fromage rape', 'trio de fromage rape', 'gruyere', 'comte'] },
    mozzarella: { exact: ['mozzarella', 'mozzarella di bufala'] },
    feta: { exact: ['feta'], alt: ['fromage de brebis', 'salakis'] },
    yaourt: { exact: ['yaourt nature', 'yaourt', 'yaourt brasse nature'], alt: ['fromage blanc', 'skyr nature', 'yaourt grec nature'] },
    tofu: { exact: ['tofu', 'tofu nature', 'tofu ferme'] },
    pates: { exact: ['pate', 'spaghetti', 'tagliatelle', 'penne', 'macaroni', 'coquillette', 'fusilli', 'farfalle', 'torsade', 'rigatoni', 'linguine', 'coquille', 'pate seche', 'pate alimentaire'] },
    riz: { exact: ['riz', 'riz long', 'riz basmati', 'riz thai', 'riz long grain'], alt: ['riz complet', 'riz rond'] },
    semoule: { exact: ['semoule', 'semoule de ble', 'semoule de ble dur', 'couscous', 'graine de couscous'] },
    quinoa: { exact: ['quinoa'] },
    farine: { exact: ['farine', 'farine de ble', 'farine de ble t45', 'farine t45', 'farine t55', 'farine de ble t55'] },
    lentilles_corail: { exact: ['lentille corail'] },
    lentilles_vertes: { exact: ['lentille verte', 'lentille'], alt: ['lentille blonde', 'lentille beluga'] },
    pois_chiches: { exact: ['pois chiche'] },
    haricots_rouges: { exact: ['haricot rouge'] },
    haricots_blancs: { exact: ['haricot blanc', 'lingot'], alt: ['flageolet', 'mogette'] },
    mais: { exact: ['mais', 'mais doux', 'grain de mais'] },
    tomates_concassees: { exact: ['tomate concassee', 'tomate pelee', 'pulpe de tomate', 'tomate en de', 'passata', 'coulis de tomate'], alt: ['sauce tomate', 'puree de tomate'] },
    lait_coco: { exact: ['lait de coco'], alt: ['creme de coco'] },
    thon: { exact: ['thon', 'thon au naturel', 'miette de thon', 'thon entier', 'thon albacore'], alt: ['thon a l huile'] },
    curry: { exact: ['curry', 'curry en poudre'] },
    cumin: { exact: ['cumin'] },
    paprika: { exact: ['paprika'] },
    bouillon: { exact: ['bouillon de legume', 'bouillon', 'bouillon cube'], alt: ['bouillon de volaille', 'bouillon de boeuf'] },
    sauce_soja: { exact: ['sauce soja'] },
    moutarde: { exact: ['moutarde', 'moutarde de dijon', 'moutarde forte'] },
    tortillas: { exact: ['tortilla', 'tortilla de ble', 'wrap'] },
    pois_casses: { exact: ['pois casse'] },
    patate_douce: { exact: ['patate douce'] },
    chou: { exact: ['chou blanc', 'chou pointu', 'chou'], alt: ['chou vert', 'chou rouge', 'chou frise'] },
    colin: { exact: ['filet de colin', 'colin', 'colin d alaska', 'filet de colin d alaska'], alt: ['cabillaud', 'filet de cabillaud', 'merlu', 'filet de merlu', 'lieu', 'filet de lieu', 'filet de poisson blanc'] },
    epinards: { exact: ['epinard', 'epinard hache', 'epinard en branche'], alt: ['pousse d epinard'] },
    haricots_verts: { exact: ['haricot vert', 'haricot vert extra fin', 'haricot vert tres fin'], alt: ['haricot beurre'] },
    petits_pois: { exact: ['petit pois', 'petit pois extra fin'], alt: ['petit pois carotte'] },
    pain: { exact: ['baguette', 'baguette tradition'], alt: ['pain', 'pain de campagne'] },
    pain_mie: { exact: ['pain de mie'] }
  };
  // ce qui transforme le produit en un autre (plat, gâteau, biscuit, boisson…) : sauf si c'est le produit lui-même
  const TRANSFORMES = new Set(['tarte', 'tartelette', 'quiche', 'pizza', 'cake', 'gateau', 'biscuit', 'chip', 'cheeto', 'roule', 'feuillete', 'nugget', 'pane',
    'cordon', 'croque', 'sandwich', 'soupe', 'veloute', 'gratin', 'lasagne', 'parmentier', 'bonbon', 'glace', 'dessert', 'aperitif', 'tartinable', 'taboule', 'salade composee',
    'crepe', 'galette', 'beignet', 'croquette', 'preparation', 'kit', 'boisson', 'smoothie', 'jus', 'cookie', 'brioche', 'viennoiserie', 'croissant',
    'friand', 'bouchee', 'samoussa', 'nem', 'burger', 'hamburger', 'tortellini', 'ravioli', 'cannelloni', 'risotto', 'paella', 'couscous royal', 'gout',
    'saveur', 'arome', 'parfum', 'facon', 'souffle', 'mousse', 'flan', 'creme dessert', 'liegeois', 'muffin', 'madeleine', 'gaufre', 'barre', 'cereale',
    'snack', 'tapenade', 'houmous', 'rillette', 'terrine', 'stick', 'tourte', 'empanada', 'plat', 'cuisine', 'royal', 'garni', 'farci', 'crousti', 'pizzetta', 'tortilla chip']);
  const TRANSFORMES_R = new Set([...TRANSFORMES].map((w) => (w.length > 4 ? w.replace(/(es|s|x)$/, '').replace(/(ee|e)$/, (m) => (m === 'ee' ? 'e' : '')) : w)));
  // mots qui, avant le produit, en font le complément d'autre chose (« roulés AU fromage », « tarte AUX pommes »)
  const PREPOSITIONS = new Set(['de', 'd', 'du', 'des', 'au', 'aux', 'a', 'en', 'avec', 'sans', 'sur', 'pour', 'et', 'ou']);
  // autres aliments courants (pour reconnaître « yaourt AUX FRAISES », « tarte AUX POMMES »…)
  const AUTRES_ALIMENTS = ['fraise', 'pomme', 'poire', 'abricot', 'peche', 'framboise', 'cerise', 'myrtille', 'fruit', 'vanille', 'chocolat', 'caramel', 'coco',
    'noix', 'noisette', 'amande', 'miel', 'fromage', 'legume', 'olive', 'basilic', 'herbe', 'epice', 'cereale', 'mangue', 'banane', 'ananas', 'orange', 'framboise',
    'porc', 'veau', 'agneau', 'canard', 'dinde', 'volaille', 'crevette', 'poisson', 'creme', 'beurre', 'lait', 'oeuf', 'jambon', 'poulet', 'boeuf', 'thon', 'saumon',
    'concombre', 'carotte', 'tomate', 'champignon', 'oignon', 'ail', 'pate', 'riz', 'lentille', 'chevre', 'emmental', 'mozzarella', 'comte', 'raisin', 'marron', 'chataigne'];
  // après le produit, ces mots en font une autre façon de l'utiliser : alternative à vérifier plutôt que produit exact
  // un produit de remplacement végétal ou un autre produit qui porte le même mot (« beurre de cacahuète », « chou-fleur »)
  const AUTRE_PRODUIT = new Set(['vegetal', 'vegetale', 'vegan', 'veggie', 'soja', 'avoine', 'amande', 'riz', 'cacahuete', 'tartiner', 'fleur', 'karite', 'coco']);
  const NUANCES = new Set(['cru', 'fume', 'rape', 'cuit', 'roti', 'marine', 'assaisonne', 'aromatise', 'allege', 'grille', 'frit', 'confit', 'seche', 'sale', 'sucre']);
  // « panées » → « pane », « garnis » → « garni » : on compare les racines
  const racine = (w) => (w.length > 4 ? w.replace(/(es|s|x)$/, '').replace(/(ee|e)$/, (m) => (m === 'ee' ? 'e' : '')) : w);
  const MOTS_LIBRES = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'lot', 'x', 'bio', 'gros', 'petit', 'grand', 'extra', 'frais', 'fraiche', 'nouveau', 'nouvelle', 'origine', 'france', 'francais', 'filiere', 'qualite', 'premium', 'selection', 'classique', 'tradition', 'barquette', 'sachet', 'boite', 'filet', 'pack', 'format', 'familial', 'eco', 'maxi', 'ecopack']);

  let INDEX = null, INDEX_ING = null;
  /** Expressions connues : [mots, id, niveau]. Construit une fois pour le catalogue courant. */
  function indexer(ING) {
    if (INDEX && INDEX_ING === ING && INDEX.n === Object.keys(ING).length) return INDEX;
    const liste = [];
    const ajouter = (txt, id, niveau) => { const m = mots(txt); if (m.length) liste.push({ m, id, niveau, txt: m.join(' ') }); };
    for (const i of Object.values(ING)) {
      if (!i || i.perso || i.libre) continue;
      const t = TABLE[i.id];
      if (t) { t.exact.forEach((x) => ajouter(x, i.id, 'exact')); (t.alt || []).forEach((x) => ajouter(x, i.id, 'alternative')); continue; }
      // autres produits : leur nom (« Chips ou biscuits apéritif » → « chips », « biscuits apéritif »)
      const nom = String(i.nom).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      nom.split(/\s+ou\s+|,\s*/i).forEach((x) => { if (norm(x).length >= 3) ajouter(x, i.id, 'exact'); });
    }
    liste.sort((a, b) => b.m.length - a.m.length || b.txt.length - a.txt.length);   // la plus longue expression d'abord
    const aliments = new Set(liste.map((x) => x.m[0]).concat(AUTRES_ALIMENTS).filter((w) => w.length >= 3 && !MOTS_LIBRES.has(w)).map(racine));
    INDEX = { liste, aliments, n: Object.keys(ING).length };
    INDEX_ING = ING;
    return INDEX;
  }
  /** Nom utile d'une offre : sans la marque en capitales, la quantité ni le complément du prospectus. */
  function nomProduit(nom) {
    let n = String(nom || '').split(/\s[—–]\s/)[0];
    n = n.replace(/^(?:[A-ZÀ-Ý0-9'’&.®!-]{2,}\s+)+(?=[A-Za-zÀ-ÿ])/, '').trim() || n;   // « MILBONA Emmental râpé »
    return norm(n).replace(/^(?:(?:lot de|le lot de|x|pack de)?\s*\d+[.,]?\d*\s*(?:x|×)?\s*(?:kg|g|cl|ml|l)?\s+)+/, '').trim();
  }
  const egal = (a, b, k) => a.every((w, i) => b[k + i] === w);
  /**
   * offre { nom, rayon? } → { id, niveau: 'exact' | 'alternative', expression } ou null.
   * La première expression connue du nom doit arriver en tête (après la marque ou un qualificatif),
   * sans préposition avant elle, et sans être suivie d'un autre aliment (« salade de concombres »).
   */
  function analyser(offre, ING) {
    if (!offre || !ING) return null;
    const { liste, aliments } = indexer(ING);
    const n = nomProduit(offre.nom);
    const w = n.split(' ').filter(Boolean).map(sing);
    if (!w.length) return null;
    let trouve = null;
    for (let k = 0; k < Math.min(w.length, 5) && !trouve; k++) {
      for (const x of liste) if (k + x.m.length <= w.length && egal(x.m, w, k)) { trouve = { ...x, pos: k }; break; }
    }
    if (!trouve) return null;
    const avant = w.slice(0, trouve.pos), apres = w.slice(trouve.pos + trouve.m.length);
    // ce qui précède : une marque ou un qualificatif, jamais une préposition, un aliment ou un plat
    const transforme = (m) => TRANSFORMES.has(m) || TRANSFORMES_R.has(racine(m));
    if (avant.some((m) => PREPOSITIONS.has(m) || transforme(m) || (aliments.has(racine(m)) && !MOTS_LIBRES.has(m)))) return null;
    // ce qui suit : « de concombres », « aux pommes »… c'est un autre plat
    for (let i = 0; i < apres.length - 1; i++) {
      if (['de', 'd', 'au', 'aux', 'a', 'facon'].includes(apres[i]) && (aliments.has(racine(apres[i + 1])) || transforme(apres[i + 1]))) {
        if (!(apres[i] === 'de' && ['ble', 'baratte', 'savoie', 'paris', 'france', 'bretagne', 'normandie', 'consommation', 'conservation', 'plein', 'poule', 'alaska'].includes(apres[i + 1]))) return null;
      }
      if (apres[i] === 'a' && ['la', 'l'].includes(apres[i + 1]) && apres[i + 2] && aliments.has(racine(apres[i + 2])) && !trouve.m.includes('huile')) return null;
    }
    // un mot de plat préparé, de gâteau ou de boisson, hors du nom du produit lui-même
    const reste = avant.concat(apres);
    if (reste.some(transforme) && !trouve.m.some(transforme)) return null;
    if (apres.some((m) => AUTRE_PRODUIT.has(m) || AUTRE_PRODUIT.has(racine(m))) && !trouve.m.some((m) => AUTRE_PRODUIT.has(m))) return null;
    const nuance = trouve.niveau === 'exact' && apres.some((m) => NUANCES.has(racine(m)) && !trouve.m.map(racine).includes(racine(m)));
    return { id: trouve.id, niveau: nuance ? 'alternative' : trouve.niveau, expression: trouve.txt };
  }

  /* ---------- dates des offres ---------- */
  const JOUR = 86400000;
  const debutJour = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  // « 29/10 » ou « 29.10. » sans année : l'année qui place la date au plus près d'aujourd'hui
  function dateSansAnnee(j, m, an, maintenant) {
    if (an) return new Date(an < 100 ? 2000 + an : an, m - 1, j).getTime();
    const y = new Date(maintenant).getFullYear();
    const c = [y - 1, y, y + 1].map((a) => new Date(a, m - 1, j).getTime());
    return c.sort((a, b) => Math.abs(a - maintenant) - Math.abs(b - maintenant))[0];
  }
  const DATE = '(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?\\.?';
  /** Dates lues dans le texte de l'offre (« 22.10. - 28.10. », « à partir du 29/10 », « le 15/10 », « jusqu'au 02/11 »). */
  function datesTexte(texte, maintenant) {
    const t = norm(String(texte || '').replace(/(\d)\.(\d)/g, '$1/$2')).replace(/(\d) (\d{1,2}) (\d{2,4})\b/g, '$1/$2/$3');
    const brut = String(texte || '');
    const d = (m, i) => dateSansAnnee(+m[i], +m[i + 1], m[i + 2] ? +m[i + 2] : null, maintenant);
    const JS = '(?:[a-zé]{3,9}\\.?\\s+)?';
    let m = new RegExp(JS + DATE + '\\s*(?:-|–|au|a)\\s*' + JS + DATE, 'i').exec(brut.replace(/\s+/g, ' '));
    if (m) return { debut: d(m, 1), fin: d(m, 4) };
    m = new RegExp("(?:jusqu.au|au|fin le|termine le)\\s+(?:[a-zé]{3,9}\\.?\\s+)?" + DATE, 'i').exec(brut);
    if (m) return { debut: null, fin: d(m, 1) };
    m = new RegExp('(?:a partir du|a partir de|des le|des|du|le|en magasin le|disponible le|en vente le)\\s+(?:[a-z]{3,9}\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?').exec(t);
    if (m) return { debut: d(m, 1), fin: null, seulDebut: true };
    m = new RegExp(DATE).exec(brut);
    if (m) return { debut: d(m, 1), fin: null, seulDebut: true };
    return { debut: null, fin: null };
  }
  const court = (t) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  /**
   * État d'une offre au moment présent :
   *   en_cours · a_venir · terminee · inconnu (pas de date : à vérifier en magasin)
   * Une offre qui n'a qu'une date de début (« le 15/10 ») est considérée terminée au bout de 7 jours
   * (les offres de la semaine durent une semaine, et les arrivages partent vite).
   */
  function statut(o, maintenant = Date.now()) {
    let debut = o && o.debut ? +o.debut : null, fin = o && o.fin ? +o.fin : null, seulDebut = false;
    if (!debut && !fin && o) { const x = datesTexte(o.quand, maintenant); debut = x.debut; fin = x.fin; seulDebut = !!x.seulDebut; }
    else if (debut && !fin) { const x = o.quand ? datesTexte(o.quand, maintenant) : {}; if (x.fin) fin = x.fin; else seulDebut = true; }
    const auj = debutJour(maintenant);
    if (fin) fin = debutJour(fin) + JOUR - 1;          // valable jusqu'au soir
    let etat;
    if (fin && fin < maintenant) etat = 'terminee';
    else if (debut && debutJour(debut) > auj) etat = 'a_venir';
    else if (debut && !fin && seulDebut && auj - debutJour(debut) > 7 * JOUR) etat = 'terminee';
    else if (debut || fin) etat = 'en_cours';
    else etat = 'inconnu';
    const texte = etat === 'a_venir' ? `à partir du ${court(debut)}${fin ? ` jusqu’au ${court(fin)}` : ''}`
      : etat === 'terminee' ? (fin ? `terminée le ${court(fin)}` : `offre du ${court(debut)}, terminée`)
      : debut && fin ? `du ${court(debut)} au ${court(fin)}`
      : fin ? `jusqu’au ${court(fin)}`
      : debut ? `depuis le ${court(debut)}`
      : 'dates non précisées';
    return { etat, debut, fin, texte };
  }

  /* ---------- allergènes probables d'un produit, d'après son nom (avertissement, pas une garantie) ---------- */
  const ALLERGENES = {
    lait: /\b(lait|laitier|fromage|beurre|creme|yaourt|emmental|mozzarella|feta|parmesan|comte|gruyere|chevre|ricotta|mascarpone|raclette|reblochon|camembert|brie|bechamel|skyr|petit suisse|cheddar|roquefort|lactose|babybel|kiri|boursin|ch?antilly|glace|chocolat au lait|tartiflette|quiche|gratin|pizza|pesto)/,
    lactose: /\b(lait|fromage blanc|beurre|creme|yaourt|lactose|glace|chantilly|bechamel)/,
    gluten: /\b(ble\b|farine|pate|pain|semoule|boulgour|tortilla|wrap|chapelure|biscuit|brioche|couscous|spaghett|tagliatel|lasagne|nouille|orge|seigle|epeautre|croissant|gaufre|crepe|gnocchi|ravioli|cake|naan|biscotte|cereale|muesli|pizza|quiche|tarte|feuillete|pane|nugget|cordon|croque|burger|chips|cookie|madeleine|gateau|viennoiserie|biere)/,
    oeuf: /\b(oeuf|omelette|mayonnaise|brioche|meringue|crepe|gaufre|madeleine|quiche|pate fraiche|pates fraiches|cake|gateau)/,
    poisson: /\b(poisson|saumon|thon|colin|cabillaud|merlu|lieu\b|sardine|maquereau|truite|hareng|anchois|surimi|sole\b|dorade|bar\b|tarama|nuoc)/,
    crustaces: /\b(crevette|crabe|homard|langoust|ecrevisse|surimi|gambas|fruits de mer)/,
    fruits_coque: /\b(noix|noisette|amande|cajou|pistache|pecan|macadamia|praline|frangipane|nougat|pesto)/,
    arachide: /\b(arachide|cacahuete|beurre de cacahuete|m ?& ?m)/,
    soja: /\b(soja|tofu|tempeh|edamame|miso)/,
    sesame: /\b(sesame|tahin|houmous|hummus)/,
    moutarde: /\b(moutarde|mayonnaise|vinaigrette)/,
    celeri: /\b(celeri|bouillon)/
  };
  /** Allergènes que le nom du produit laisse supposer (« Pâtes aux œufs » → gluten, œuf). */
  function allergenesProbables(nom) {
    const t = norm(nom);
    return Object.keys(ALLERGENES).filter((a) => ALLERGENES[a].test(t) && !((a === 'lait' || a === 'lactose') && /lait de coco|creme de coco|lait d amande|lait de soja|lait d avoine|sans lactose|vegetal/.test(t) && !/fromage|beurre|yaourt|creme(?! de coco)/.test(t)));
  }

  const api = { analyser, statut, nomProduit, datesTexte, norm, TABLE, allergenesProbables };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PromoMatch = api;
})(typeof window !== 'undefined' ? window : globalThis);
