/* Budgétable — saisie d'un plat à la main : à partir de son nom, on propose les ingrédients à cocher.
 *
 * 1. Plats courants de la cuisine familiale française (dictionnaire ci-dessous) ;
 * 2. mots du nom qui désignent un ingrédient (« poulet aux champignons ») ;
 * 3. plat le plus proche parmi les 12 000 recettes de Budgétable.
 * Les quantités sont pour une portion adulte ; la personne coche, décoche et complète.
 * Rien n'est envoyé ailleurs : tout se calcule dans le navigateur.
 */
(function (root) {
  const E = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.Engine;

  // Quantité par portion adulte quand le plat ne la donne pas
  const QTE = {
    poulet_filet: 120, cuisses_poulet: 200, boeuf_hache: 100, jambon: 50, lardons: 50, saucisse: 110, saumon: 120, colin: 130, thon: 60,
    oeufs: 2, lait: 100, beurre: 10, creme: 30, emmental: 30, mozzarella: 60, feta: 40, yaourt: 60, tofu: 120,
    pates: 90, riz: 75, semoule: 75, quinoa: 70, farine: 30, lentilles_corail: 70, lentilles_vertes: 70, pois_chiches: 120,
    haricots_rouges: 120, haricots_blancs: 120, pois_casses: 70, mais: 50, tomates_concassees: 120, lait_coco: 60,
    huile_olive: 10, curry: 2, cumin: 2, paprika: 2, bouillon: 0.25, sauce_soja: 10, moutarde: 10, tortillas: 2,
    pomme_de_terre: 220, patate_douce: 200, pain: 0.25, pain_mie: 60, salade: 0.25, concombre: 0.25, citron: 0.25, persil: 0.1,
    oignon: 40, ail: 3, chou: 150, epinards: 120, haricots_verts: 120, petits_pois: 100, courge: 150, aubergine: 150
  };
  const qte = (id) => QTE[id] || 120;

  // Mots du nom d'un plat → ingrédient du catalogue
  const MOTS = [
    [['poulet', 'volaille', 'blanc de poulet', 'aiguillette'], 'poulet_filet'], [['cuisse', 'pilon'], 'cuisses_poulet'],
    [['boeuf', 'bœuf', 'steak', 'hache', 'haché', 'boulette', 'viande hachee', 'burger'], 'boeuf_hache'],
    [['jambon'], 'jambon'], [['lardon', 'bacon'], 'lardons'], [['saucisse', 'chipolata', 'merguez', 'knack'], 'saucisse'],
    [['saumon'], 'saumon'], [['thon'], 'thon'], [['colin', 'cabillaud', 'merlu', 'poisson blanc', 'lieu', 'poisson pane', 'poisson'], 'colin'],
    [['oeuf', 'œuf', 'omelette'], 'oeufs'], [['tofu'], 'tofu'],
    [['pate', 'pâtes', 'spaghetti', 'tagliatelle', 'penne', 'macaroni', 'coquillette', 'fusilli', 'lasagne', 'nouille', 'linguine'], 'pates'],
    [['riz', 'risotto'], 'riz'], [['semoule', 'couscous', 'taboule', 'taboulé'], 'semoule'], [['quinoa'], 'quinoa'],
    [['pomme de terre', 'pommes de terre', 'patate', 'frite', 'puree', 'purée', 'gratin dauphinois'], 'pomme_de_terre'], [['patate douce'], 'patate_douce'],
    [['lentille corail', 'lentilles corail'], 'lentilles_corail'], [['lentille', 'lentilles'], 'lentilles_vertes'], [['pois chiche', 'houmous', 'falafel'], 'pois_chiches'],
    [['haricot rouge', 'haricots rouges', 'chili'], 'haricots_rouges'], [['haricot blanc', 'haricots blancs', 'cassoulet'], 'haricots_blancs'], [['pois casse', 'pois cassés'], 'pois_casses'],
    [['haricot vert', 'haricots verts'], 'haricots_verts'], [['petit pois', 'petits pois'], 'petits_pois'],
    [['courgette'], 'courgette'], [['carotte'], 'carotte'], [['tomate'], 'tomates_concassees'], [['poivron'], 'poivron'], [['aubergine'], 'aubergine'],
    [['champignon'], 'champignon'], [['brocoli'], 'brocoli'], [['epinard', 'épinard'], 'epinards'], [['poireau'], 'poireau'], [['chou'], 'chou'],
    [['courge', 'potiron', 'butternut', 'potimarron', 'citrouille'], 'courge'], [['mais', 'maïs'], 'mais'], [['oignon'], 'oignon'],
    [['salade', 'laitue'], 'salade'], [['concombre'], 'concombre'], [['citron'], 'citron'],
    [['fromage', 'gruyere', 'gruyère', 'emmental', 'comte', 'comté', 'raclette', 'gratine', 'gratiné'], 'emmental'], [['mozzarella', 'mozza'], 'mozzarella'], [['feta'], 'feta'],
    [['creme', 'crème', 'carbonara', 'creme fraiche'], 'creme'], [['lait de coco', 'coco'], 'lait_coco'], [['curry'], 'curry'],
    [['tortilla', 'wrap', 'fajita', 'burrito', 'taco', 'quesadilla'], 'tortillas'], [['croque', 'pain de mie'], 'pain_mie'], [['tartine', 'bruschetta', 'pain perdu'], 'pain'],
    [['crepe', 'crêpe', 'galette', 'pancake', 'beignet', 'tarte', 'quiche', 'bechamel', 'béchamel'], 'farine'], [['yaourt', 'tzatziki'], 'yaourt'], [['moutarde'], 'moutarde']
  ];

  // Aliments hors catalogue de Budgétable : ajoutés en « autres ingrédients », avec leurs allergènes connus.
  // viande / poisson : remplace la protéine par défaut du plat (un wok aux crevettes n'a pas de poulet).
  const HORS = [
    [['crevette', 'gambas', 'langoustine'], 'crevettes', ['crustaces', 'animal'], 'proteine'], [['moule'], 'moules', ['mollusques', 'animal'], 'proteine'],
    [['calamar', 'encornet', 'seiche'], 'calamars', ['mollusques', 'animal'], 'proteine'],
    [['dinde'], 'dinde', ['viande', 'animal'], 'proteine'], [['porc', 'echine', 'filet mignon', 'cote de porc'], 'porc', ['viande', 'porc', 'animal'], 'proteine'],
    [['chorizo'], 'chorizo', ['viande', 'porc', 'animal'], 'proteine'], [['veau'], 'veau', ['viande', 'animal'], 'proteine'],
    [['agneau', 'gigot'], 'agneau', ['viande', 'animal'], 'proteine'], [['canard', 'magret'], 'canard', ['viande', 'animal'], 'proteine'],
    [['lapin'], 'lapin', ['viande', 'animal'], 'proteine'], [['sardine'], 'sardines', ['poisson', 'animal'], 'proteine'],
    [['chocolat', 'cacao'], 'chocolat', ['lait'], ''], [['sucre'], 'sucre', [], ''], [['miel'], 'miel', ['animal'], ''],
    [['parmesan'], 'parmesan', ['lait', 'animal'], ''], [['chevre', 'chèvre'], 'fromage de chèvre', ['lait', 'animal'], ''],
    [['ricotta', 'mascarpone'], 'ricotta', ['lait', 'lactose', 'animal'], ''], [['roquefort', 'bleu'], 'fromage bleu', ['lait', 'animal'], ''],
    [['pesto'], 'pesto', ['lait', 'fruits_coque'], ''], [['basilic'], 'basilic', [], ''], [['coriandre'], 'coriandre', [], ''],
    [['gingembre'], 'gingembre', [], ''], [['olive'], 'olives', [], ''], [['avocat', 'guacamole'], 'avocat', [], ''],
    [['noix', 'amande', 'noisette', 'pecan', 'cajou', 'pistache'], 'fruits à coque', ['fruits_coque'], ''], [['cacahuete', 'arachide', 'satay'], 'cacahuètes', ['arachide'], ''],
    [['sesame', 'sésame'], 'sésame', ['sesame'], ''], [['chou fleur', 'chou-fleur'], 'chou-fleur', [], 'legume'], [['endive'], 'endives', [], 'legume'],
    [['navet'], 'navets', [], 'legume'], [['betterave'], 'betterave', [], 'legume'], [['celeri', 'céleri'], 'céleri', ['celeri'], 'legume'],
    [['fenouil'], 'fenouil', [], 'legume'], [['asperge'], 'asperges', [], 'legume'], [['pomme'], 'pommes', [], ''], [['banane'], 'bananes', [], ''],
    [['ananas'], 'ananas', [], ''], [['fraise'], 'fraises', [], ''], [['vin'], 'vin', [], ''], [['biere', 'bière'], 'bière', ['gluten'], ''],
    [['levure'], 'levure', [], ''], [['nem'], 'nems', ['gluten', 'crustaces'], 'proteine']
  ];
  const tagsExtra = (nom) => { const t = norm(nom); const h = HORS.find(([mots, n]) => norm(n) === t || mots.some((m) => contientMot(t, m))); return h ? h[2] : null; };

  // Plats courants : ingrédients habituels (portion adulte)
  const PLATS = [
    [['lasagne'], [['pates', 100], ['boeuf_hache', 90], ['tomates_concassees', 130], ['oignon', 30], ['carotte', 30], ['lait', 100], ['beurre', 10], ['farine', 10], ['emmental', 30]]],
    [['bolognaise', 'bolo'], [['pates', 100], ['boeuf_hache', 90], ['tomates_concassees', 150], ['oignon', 40], ['carotte', 40], ['ail', 3], ['huile_olive', 5]]],
    [['carbonara'], [['pates', 100], ['lardons', 60], ['oeufs', 1], ['creme', 30], ['emmental', 20]]],
    [['hachis parmentier', 'parmentier'], [['pomme_de_terre', 250], ['boeuf_hache', 100], ['oignon', 40], ['lait', 60], ['beurre', 10], ['emmental', 20]]],
    [['gratin dauphinois'], [['pomme_de_terre', 250], ['lait', 100], ['creme', 40], ['ail', 2]]],
    [['tartiflette'], [['pomme_de_terre', 250], ['lardons', 60], ['oignon', 40], ['creme', 30], ['emmental', 50]]],
    [['raclette'], [['pomme_de_terre', 250], ['emmental', 100], ['jambon', 60], ['salade', 0.25]]],
    [['quiche lorraine', 'quiche'], [['farine', 50], ['beurre', 25], ['oeufs', 1.5], ['creme', 50], ['lait', 50], ['lardons', 50], ['emmental', 20], ['salade', 0.25]]],
    [['croque monsieur', 'croque-monsieur', 'croque'], [['pain_mie', 80], ['jambon', 40], ['emmental', 30], ['beurre', 8], ['salade', 0.25]]],
    [['crepe', 'crêpe', 'galette complete', 'galette'], [['farine', 60], ['oeufs', 1], ['lait', 120], ['beurre', 8], ['jambon', 40], ['emmental', 25]]],
    [['omelette'], [['oeufs', 3], ['beurre', 8], ['salade', 0.25], ['pain', 0.2]]],
    [['pizza'], [['farine', 90], ['tomates_concassees', 80], ['mozzarella', 60], ['jambon', 40], ['champignon', 50], ['huile_olive', 8]]],
    [['croque'], [['pain_mie', 80], ['jambon', 40], ['emmental', 30]]],
    [['poulet roti', 'poulet rôti'], [['cuisses_poulet', 250], ['pomme_de_terre', 200], ['huile_olive', 10], ['ail', 3]]],
    [['poulet basquaise', 'basquaise'], [['cuisses_poulet', 220], ['poivron', 120], ['tomates_concassees', 100], ['oignon', 40], ['riz', 70]]],
    [['poulet curry', 'curry de poulet', 'poulet coco'], [['poulet_filet', 130], ['lait_coco', 80], ['curry', 3], ['oignon', 40], ['riz', 75]]],
    [['blanquette'], [['poulet_filet', 140], ['carotte', 80], ['champignon', 60], ['creme', 40], ['farine', 10], ['beurre', 10], ['riz', 75]]],
    [['pot au feu', 'pot-au-feu', 'potee', 'potée'], [['boeuf_hache', 130], ['carotte', 120], ['poireau', 100], ['pomme_de_terre', 200], ['chou', 100], ['bouillon', 0.5]]],
    [['boeuf bourguignon', 'bourguignon', 'daube'], [['boeuf_hache', 150], ['carotte', 100], ['champignon', 60], ['lardons', 30], ['oignon', 40], ['pomme_de_terre', 200]]],
    [['chili con carne', 'chili'], [['boeuf_hache', 90], ['haricots_rouges', 120], ['tomates_concassees', 120], ['oignon', 40], ['poivron', 60], ['cumin', 2], ['riz', 70]]],
    [['couscous'], [['semoule', 80], ['pois_chiches', 80], ['courgette', 100], ['carotte', 80], ['saucisse', 80], ['tomates_concassees', 80], ['cumin', 2]]],
    [['tajine'], [['cuisses_poulet', 200], ['carotte', 100], ['courgette', 100], ['oignon', 40], ['citron', 0.25], ['cumin', 2], ['semoule', 70]]],
    [['paella'], [['riz', 80], ['poulet_filet', 80], ['colin', 60], ['poivron', 60], ['petits_pois', 50], ['tomates_concassees', 60], ['paprika', 2]]],
    [['risotto'], [['riz', 85], ['champignon', 80], ['oignon', 30], ['bouillon', 0.5], ['emmental', 25], ['beurre', 10]]],
    [['riz cantonais'], [['riz', 80], ['oeufs', 1], ['jambon', 40], ['petits_pois', 50], ['sauce_soja', 10]]],
    [['nouilles sautees', 'nouilles sautées', 'wok', 'pad thai', 'pad thaï'], [['pates', 90], ['poulet_filet', 100], ['carotte', 60], ['poivron', 60], ['oeufs', 1], ['sauce_soja', 15]]],
    [['dahl', 'dal'], [['lentilles_corail', 70], ['lait_coco', 60], ['tomates_concassees', 100], ['oignon', 40], ['curry', 3], ['riz', 60]]],
    [['ratatouille'], [['courgette', 120], ['aubergine', 100], ['poivron', 80], ['tomates_concassees', 120], ['oignon', 40], ['huile_olive', 10], ['riz', 60]]],
    [['soupe', 'veloute', 'velouté', 'potage'], [['carotte', 120], ['pomme_de_terre', 100], ['poireau', 80], ['oignon', 30], ['bouillon', 0.5], ['pain', 0.25]]],
    [['salade nicoise', 'salade niçoise', 'nicoise'], [['salade', 0.3], ['thon', 60], ['oeufs', 1], ['tomate', 100], ['haricots_verts', 60], ['pomme_de_terre', 100], ['huile_olive', 10]]],
    [['salade de pates', 'salade de pâtes'], [['pates', 80], ['thon', 50], ['mais', 40], ['tomate', 80], ['huile_olive', 10]]],
    [['taboule', 'taboulé'], [['semoule', 70], ['tomate', 80], ['concombre', 0.25], ['persil', 0.2], ['citron', 0.25], ['huile_olive', 10]]],
    [['burger', 'hamburger'], [['pain', 0.4], ['boeuf_hache', 120], ['emmental', 20], ['salade', 0.15], ['tomate', 40], ['pomme_de_terre', 200]]],
    [['steak frites', 'steak hache frites', 'steak'], [['boeuf_hache', 125], ['pomme_de_terre', 250], ['huile_olive', 15], ['salade', 0.2]]],
    [['saucisse puree', 'saucisses puree', 'saucisse purée'], [['saucisse', 120], ['pomme_de_terre', 250], ['lait', 60], ['beurre', 10]]],
    [['fajitas', 'fajita', 'burrito', 'tacos'], [['tortillas', 2], ['poulet_filet', 110], ['poivron', 80], ['oignon', 30], ['haricots_rouges', 60], ['emmental', 20], ['paprika', 2]]],
    [['wrap'], [['tortillas', 2], ['poulet_filet', 90], ['salade', 0.2], ['tomate', 50], ['yaourt', 30]]],
    [['moussaka'], [['aubergine', 200], ['boeuf_hache', 90], ['tomates_concassees', 100], ['oignon', 30], ['lait', 80], ['farine', 10], ['beurre', 10]]],
    [['cassoulet'], [['haricots_blancs', 150], ['saucisse', 110], ['tomates_concassees', 80], ['oignon', 30], ['carotte', 40]]],
    [['endives au jambon', 'endive'], [['jambon', 60], ['lait', 100], ['farine', 10], ['beurre', 10], ['emmental', 30]]],
    [['gnocchi'], [['pomme_de_terre', 200], ['farine', 40], ['tomates_concassees', 100], ['mozzarella', 40]]],
    [['poisson pane', 'poisson pané', 'fish and chips', 'fish & chips'], [['colin', 130], ['farine', 15], ['oeufs', 0.5], ['pain', 0.15], ['pomme_de_terre', 220], ['huile_olive', 15]]],
    [['papillote'], [['colin', 140], ['courgette', 100], ['carotte', 60], ['citron', 0.25], ['riz', 70]]],
    [['falafel'], [['pois_chiches', 130], ['oignon', 20], ['persil', 0.2], ['cumin', 2], ['farine', 10], ['tortillas', 1], ['yaourt', 40]]],
    [['shakshuka', 'chakchouka'], [['oeufs', 2], ['tomates_concassees', 150], ['poivron', 80], ['oignon', 30], ['cumin', 1], ['pain', 0.25]]],
    [['hachis', 'gratin'], [['pomme_de_terre', 200], ['emmental', 30], ['lait', 60], ['beurre', 8]]],
    [['pates au saumon', 'pâtes au saumon'], [['pates', 100], ['saumon', 90], ['creme', 40], ['citron', 0.15]]],
    [['pates au thon', 'pâtes au thon'], [['pates', 100], ['thon', 60], ['tomates_concassees', 100], ['oignon', 20]]],
    [['gratin de pates', 'gratin de pâtes', 'macaroni'], [['pates', 100], ['jambon', 40], ['creme', 40], ['lait', 60], ['emmental', 35]]],
    [['buddha bowl', 'bowl', 'poke'], [['riz', 70], ['saumon', 80], ['concombre', 0.25], ['carotte', 50], ['mais', 40], ['sauce_soja', 10]]],
    [['pain perdu'], [['pain', 0.35], ['oeufs', 1], ['lait', 80], ['beurre', 10]]],
    [['gateau', 'gâteau', 'cake', 'fondant', 'brownie', 'moelleux'], [['farine', 40], ['oeufs', 1], ['beurre', 30]], ['sucre']],
    [['crumble'], [['farine', 40], ['beurre', 25]], ['sucre', 'pommes']],
    [['tarte'], [['farine', 50], ['beurre', 25], ['oeufs', 1]]],
    [['clafoutis', 'flan'], [['oeufs', 1.5], ['lait', 120], ['farine', 20]], ['sucre']],
    [['riz au lait'], [['riz', 40], ['lait', 200]], ['sucre']],
    [['compote'], [], ['pommes', 'sucre']]
  ];
  const VEGE = /\b(vegetarien|vegetarienne|veggie|vege|sin carne|sans viande|vegan|vegetalien|vegetale?)\b/;
  const VEGAN = /\b(vegan|vegetalien|vegetalienne|vegetale?)\b/;
  const SOUPE = /\b(soupe|veloute|potage)\b/;

  const norm = (t) => E.norm(t).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const contient = (texte, mot) => (' ' + texte + ' ').includes(' ' + norm(mot)) || texte.includes(norm(mot) + 's');
  // mot entier (avec pluriel) : « pomme » ne doit pas trouver « pomme de terre », « vin » pas « vinaigrette »
  const contientMot = (texte, mot) => new RegExp('(^| )' + norm(mot).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|x)?( |$)').test(texte);

  /**
   * Propose les ingrédients d'un plat à partir de son nom.
   * Renvoie { coches: [[id, qté]], suggestions: [[id, qté]], extras: [{nom, tags, coche}], retires: [noms], source }
   * « coches » : très probables ; « suggestions » : souvent présents, non cochés ; « extras » : hors catalogue ;
   * « retires » : écartés à cause du profil (allergies, régime) ou du nom (« végétarien »).
   */
  function devinerIngredients(nom, p) {
    const t = norm(nom);
    const profil = p || E.profilParDefaut();
    const coches = new Map();
    const sugg = new Map();
    const extras = new Map();
    const retires = [];
    let source = '';
    if (!t) return { coches: [], suggestions: [], extras: [], retires, source };
    // 0. aliments hors catalogue cités (crevettes, chocolat, pesto…)
    let proteineHors = false, legumeHors = false;
    for (const [mots, n, tags, role] of HORS) {
      if (mots.some((m) => contientMot(t, m)) && !(n === 'pommes' && /pomme de terre|pommes de terre/.test(t))) {
        extras.set(n, { nom: n, tags, coche: true });
        if (role === 'proteine') proteineHors = true;
        if (role === 'legume') legumeHors = true;
      }
    }
    // 1. plat courant (le nom le plus long qui correspond l'emporte : « gratin dauphinois » avant « gratin »)
    const plats = PLATS.map(([noms, ing, ext]) => [noms.filter((n) => contient(t, n)).sort((a, b) => b.length - a.length)[0], ing, ext]).filter(([n]) => n).sort((a, b) => b[0].length - a[0].length);
    const plat = plats[0] || null;
    if (plat) {
      plat[1].forEach(([id, q]) => coches.set(id, q));
      (plat[2] || []).forEach((n) => { if (!extras.has(n)) extras.set(n, { nom: n, tags: tagsExtra(n) || [], coche: true }); });
      source = `plat courant « ${plat[0]} »`;
    }
    // 2. ingrédients du catalogue cités dans le nom
    const cites = new Set();
    for (const [mots, id] of MOTS) {
      if (mots.some((m) => contient(t, m))) { cites.add(id); if (!coches.has(id)) coches.set(id, qte(id)); }
    }
    if (cites.has('tomates_concassees') && coches.has('tomate')) coches.delete('tomates_concassees');
    if (coches.has('lentilles_corail') && !/lentilles? vertes?|lentilles? du puy/.test(t)) coches.delete('lentilles_vertes');
    if (coches.has('patate_douce') && !/pomme de terre|frite|puree/.test(t)) coches.delete('pomme_de_terre');
    // une protéine nommée remplace celle du plat par défaut (wok aux crevettes, lasagnes au saumon…)
    const protCitees = [...cites].filter((id) => E.ING[id].groupe === 'P' && !['oeufs', 'lentilles_corail', 'lentilles_vertes', 'pois_chiches', 'haricots_rouges', 'haricots_blancs', 'pois_casses'].includes(id));
    if (plat && (proteineHors || protCitees.length)) {
      for (const [id] of plat[1]) if (E.ING[id].groupe === 'P' && !cites.has(id) && ['viande', 'poisson'].some((x) => E.ING[id].tags.includes(x))) coches.delete(id);
    }
    // soupe de potiron : les légumes cités remplacent les légumes par défaut
    if (plat && SOUPE.test(t) && ([...cites].some((id) => E.ING[id].groupe === 'L' && !['oignon', 'ail'].includes(id)) || legumeHors)) {
      for (const id of ['carotte', 'poireau']) if (!cites.has(id)) coches.delete(id);
    }
    // 3. plat le plus proche du catalogue, seulement si on n'a rien reconnu
    if (!plat && coches.size + extras.size < 2) {
      const r = E.rechercherPlats(profil, nom, { n: 1 });
      let proche = r.resultats[0] ? E.REC[r.resultats[0]] : null;
      if (!proche) {
        const mots = E.motsDe(nom);
        let best = 0;
        for (const rec of E.RECETTES) {
          const n = E.motsDe(rec.nom);
          const sc = mots.filter((m) => n.some((x) => x.startsWith(m))).length;
          if (sc > best) { best = sc; proche = rec; }
        }
        if (best === 0) proche = null;
      }
      if (proche) {
        for (const [id, q] of proche.ing) if (!coches.has(id) && !E.ING[id].perso) coches.set(id, q);
        source = `recette proche « ${proche.nom} »`;
      }
    }
    // végétarien / végétalien demandé dans le nom
    if (VEGE.test(t)) {
      for (const id of [...coches.keys()]) {
        const tg = E.ING[id].tags;
        if (tg.includes('viande') || tg.includes('poisson') || (VEGAN.test(t) && tg.includes('animal'))) { coches.delete(id); retires.push(E.ING[id].nom + ' (plat ' + (VEGAN.test(t) ? 'végétalien' : 'végétarien') + ')'); }
      }
      for (const [n, x] of extras) if (x.tags.includes('viande') || x.tags.includes('poisson') || x.tags.includes('crustaces')) { extras.delete(n); }
    }
    // profil : on n'ajoute jamais d'office un ingrédient interdit (allergie, régime, refus)
    for (const id of [...coches.keys()]) {
      const raison = E.ingredientInterdit(E.ING[id], profil);
      if (raison) { coches.delete(id); retires.push(`${E.ING[id].nom} (${raison})`); }
    }
    for (const [n, x] of extras) {
      const faux = { tags: x.tags };
      const raison = E.ingredientInterdit(faux, profil);
      if (raison) { x.coche = false; x.alerte = raison; }
    }
    // suggestions : les classiques du placard (pas pour un dessert)
    const dessert = /gateau|cake|fondant|brownie|moelleux|crumble|clafoutis|flan|riz au lait|compote|cookie|muffin/.test(t) || ['sucre', 'chocolat', 'pommes', 'bananes', 'fraises', 'ananas', 'miel'].some((n) => extras.has(n));
    const feculent = [...coches.keys()].some((id) => E.ING[id].groupe === 'F');
    if (!dessert && !feculent && !SOUPE.test(t) && !/salade/.test(t)) for (const id of ['riz', 'pomme_de_terre', 'pates']) if (!E.ingredientInterdit(E.ING[id], profil)) sugg.set(id, qte(id));
    if (!dessert) for (const id of ['oignon', 'ail', 'huile_olive']) if (!coches.has(id) && !E.ingredientInterdit(E.ING[id], profil)) sugg.set(id, qte(id));
    if (!source && (coches.size || extras.size)) source = 'ingrédients cités dans le nom';
    return { coches: [...coches.entries()], suggestions: [...sugg.entries()], extras: [...extras.values()], retires, source, dessert };
  }

  /** Ingrédients du catalogue dont le nom commence par / contient le texte (pour « ajouter un ingrédient »). */
  function chercherIngredients(texte, n = 6) {
    const t = norm(texte);
    if (t.length < 2) return [];
    const viaMots = MOTS.filter(([mots]) => mots.some((m) => norm(m).startsWith(t) || t.startsWith(norm(m)))).map(([, id]) => id);
    const viaNoms = E.DATA.ingredients.filter((i) => norm(i.nom).includes(t)).map((i) => i.id);
    return [...new Set(viaNoms.concat(viaMots))].slice(0, n);
  }

  const api = { devinerIngredients, chercherIngredients, tagsExtra, QTE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Saisie = api;
})(typeof window !== 'undefined' ? window : globalThis);
