/* Budgétable — familles de plats combinables (V0.3)
 *
 * Chaque modèle décrit un type de plat (poêlée, curry, gratin…) et les
 * ingrédients qui peuvent s'y combiner. Le moteur fabrique toutes les
 * combinaisons : plus de 12 000 recettes, toutes construites à partir des
 * ingrédients étiquetés de data.js, donc filtrées par les mêmes règles
 * d'allergies et de régimes que les recettes écrites à la main.
 */
(function (root) {
  // Formes grammaticales : de = « de poulet », a = « au poulet », n = « poulet »
  const LEX = {
    poulet_filet: { de: 'de poulet', a: 'au poulet', n: 'poulet', cuit: 'le poulet en lanières' },
    boeuf_hache: { de: 'de bœuf', a: 'au bœuf', n: 'bœuf', cuit: 'le bœuf haché' },
    saumon: { de: 'de saumon', a: 'au saumon', n: 'saumon', cuit: 'le saumon en cubes' },
    colin: { de: 'de colin', a: 'au colin', n: 'colin', cuit: 'le colin en morceaux' },
    thon: { de: 'de thon', a: 'au thon', n: 'thon', cuit: 'le thon émietté' },
    oeufs: { de: 'd’œufs', a: 'aux œufs', n: 'œufs', cuit: 'les œufs battus' },
    tofu: { de: 'de tofu', a: 'au tofu', n: 'tofu', cuit: 'le tofu en cubes' },
    pois_chiches: { de: 'de pois chiches', a: 'aux pois chiches', n: 'pois chiches', cuit: 'les pois chiches égouttés' },
    lentilles_corail: { de: 'de lentilles corail', a: 'aux lentilles corail', n: 'lentilles corail', cuit: 'les lentilles corail rincées' },
    lentilles_vertes: { de: 'de lentilles vertes', a: 'aux lentilles vertes', n: 'lentilles vertes', cuit: 'les lentilles vertes (cuites 20 min avant)' },
    haricots_rouges: { de: 'de haricots rouges', a: 'aux haricots rouges', n: 'haricots rouges', cuit: 'les haricots rouges égouttés' },
    jambon: { de: 'de jambon', a: 'au jambon', n: 'jambon', cuit: 'le jambon en dés' },
    lardons: { de: 'de lardons', a: 'aux lardons', n: 'lardons', cuit: 'les lardons' },
    saucisse: { de: 'de saucisses', a: 'à la saucisse', n: 'saucisses', cuit: 'les saucisses en rondelles' },
    feta: { de: 'de feta', a: 'à la feta', n: 'feta', cuit: 'la feta émiettée' },
    mozzarella: { de: 'de mozzarella', a: 'à la mozzarella', n: 'mozzarella', cuit: 'la mozzarella' },
    emmental: { de: 'de fromage', a: 'au fromage', n: 'fromage', cuit: 'le fromage râpé' },

    courgette: { de: 'de courgettes', a: 'aux courgettes', n: 'courgettes' },
    carotte: { de: 'de carottes', a: 'aux carottes', n: 'carottes' },
    poivron: { de: 'de poivrons', a: 'aux poivrons', n: 'poivrons' },
    poireau: { de: 'de poireaux', a: 'aux poireaux', n: 'poireaux' },
    champignon: { de: 'de champignons', a: 'aux champignons', n: 'champignons' },
    brocoli: { de: 'de brocoli', a: 'au brocoli', n: 'brocoli' },
    epinards: { de: 'd’épinards', a: 'aux épinards', n: 'épinards' },
    haricots_verts: { de: 'de haricots verts', a: 'aux haricots verts', n: 'haricots verts' },
    petits_pois: { de: 'de petits pois', a: 'aux petits pois', n: 'petits pois' },
    aubergine: { de: 'd’aubergines', a: 'aux aubergines', n: 'aubergines' },
    courge: { de: 'de courge', a: 'à la courge', n: 'courge' },
    tomate: { de: 'de tomates', a: 'à la tomate', n: 'tomates' },
    mais: { de: 'de maïs', a: 'au maïs', n: 'maïs' },

    riz: { de: 'de riz', avec: 'du riz', cuire: 'Cuire le riz 12 min à l’eau bouillante salée.' },
    pates: { de: 'de pâtes', avec: 'des pâtes', cuire: 'Cuire les pâtes à l’eau bouillante salée.' },
    semoule: { de: 'de semoule', avec: 'de la semoule', cuire: 'Verser autant d’eau bouillante salée que de semoule, couvrir 5 min, égrener.' },
    quinoa: { de: 'de quinoa', avec: 'du quinoa', cuire: 'Cuire le quinoa rincé 12 min à l’eau bouillante.' },
    pomme_de_terre: { de: 'de pommes de terre', avec: 'des pommes de terre', cuire: 'Cuire les pommes de terre en cubes 20 min à l’eau salée.' },
    pain: { de: 'de pain', avec: 'du pain', cuire: 'Couper le pain.' }
  };
  // article défini correct pour les étapes (« le brocoli », « la courge », « les poireaux »)
  const ARTICLE = { brocoli: "le brocoli", courge: "la courge", mais: "le maïs" };
  Object.entries(LEX).forEach(([k, v]) => { if (v.n && !v.cuire) v.les = ARTICLE[k] || "les " + v.n; });

  // Quantité par portion adulte
  const Q = {
    poulet_filet: 120, boeuf_hache: 90, saumon: 120, colin: 130, thon: 70, oeufs: 2, tofu: 120,
    pois_chiches: 130, lentilles_corail: 70, lentilles_vertes: 70, haricots_rouges: 130,
    jambon: 50, lardons: 50, saucisse: 110, feta: 50, mozzarella: 60, emmental: 30,
    riz: 75, pates: 90, semoule: 75, quinoa: 70, pomme_de_terre: 220, pain: 0.25,
    legume1: 150, legume2: 90
  };
  const LEGERS = ['saumon', 'colin', 'thon', 'tofu', 'pois_chiches', 'lentilles_corail', 'lentilles_vertes', 'haricots_rouges', 'oeufs'];

  const modeles = [
    {
      id: 'poelee', libelle: 'Poêlées', cuisine: 'francaise', temps: 25, niveau: 1, equip: ['plaque'], repas: ['dejeuner', 'diner'], forme: 'assiette',
      prots: ['poulet_filet', 'boeuf_hache', 'saumon', 'colin', 'tofu', 'pois_chiches', 'haricots_rouges', 'lardons', 'saucisse'],
      legs: ['courgette', 'carotte', 'poivron', 'poireau', 'champignon', 'brocoli', 'epinards', 'haricots_verts', 'petits_pois', 'aubergine', 'courge', 'tomate', 'mais'], nLegs: 2,
      fecs: ['riz', 'pates', 'semoule', 'quinoa', 'pomme_de_terre'],
      variantes: [
        { id: 'prov', nom: 'à la provençale', ing: [], etape: 'avec une pincée d’herbes de Provence' },
        { id: 'pap', nom: 'au paprika', ing: [['paprika', 2]], etape: 'avec le paprika' },
        { id: 'cum', nom: 'au cumin', ing: [['cumin', 2]], etape: 'avec le cumin' }
      ],
      base: [['oignon', 30], ['ail', 2], ['huile_olive', 8]],
      nom: (c) => `Poêlée ${c.p.de}, ${c.l1.n} et ${c.l2.n} ${c.v.nom}, avec ${c.f.avec}`,
      etapes: (c) => [c.f.cuire, `Faire dorer ${c.p.cuit} dans l’huile avec l’oignon et l’ail émincés.`, `Ajouter ${c.l1.les} et ${c.l2.les} en morceaux ${c.v.etape}, cuire 12 min à feu moyen.`, `Servir avec ${c.f.avec}.`]
    },
    {
      id: 'curry', libelle: 'Currys', cuisine: 'indienne', temps: 30, niveau: 1, equip: ['plaque'], repas: ['dejeuner', 'diner'], forme: 'bol', tags: ['epice'],
      prots: ['poulet_filet', 'saumon', 'colin', 'tofu', 'pois_chiches', 'lentilles_corail'],
      legs: ['courgette', 'carotte', 'poivron', 'brocoli', 'epinards', 'haricots_verts', 'petits_pois', 'aubergine', 'courge'], nLegs: 2,
      fecs: ['riz', 'quinoa'],
      base: [['lait_coco', 70], ['curry', 3], ['tomates_concassees', 60], ['oignon', 30], ['huile_olive', 5]],
      nom: (c) => `Curry ${c.p.de} ${c.l1.a} et ${c.l2.a}, avec ${c.f.avec}`,
      etapes: (c) => [c.f.cuire, 'Faire revenir l’oignon émincé avec le curry.', `Ajouter ${c.p.cuit}, ${c.l1.les} et ${c.l2.les}, puis les tomates et le lait de coco.`, 'Laisser mijoter 15 min à feu doux.', `Servir avec ${c.f.avec}.`]
    },
    {
      id: 'wok', libelle: 'Woks', cuisine: 'asiatique', temps: 20, niveau: 1, equip: ['plaque'], repas: ['dejeuner', 'diner'], forme: 'bol',
      prots: ['poulet_filet', 'boeuf_hache', 'tofu', 'saumon'],
      legs: ['carotte', 'poivron', 'brocoli', 'champignon', 'courgette', 'petits_pois', 'haricots_verts', 'poireau'], nLegs: 2,
      fecs: ['riz', 'pates'],
      base: [['sauce_soja', 12], ['ail', 3], ['huile_olive', 6]],
      nom: (c) => `Wok ${c.p.de} ${c.l1.a} et ${c.l2.a}, avec ${c.f.avec}`,
      etapes: (c) => [c.f.cuire, `Saisir ${c.p.cuit} à feu vif dans l’huile très chaude.`, `Ajouter l’ail, ${c.l1.les} et ${c.l2.les} en fines lamelles, sauter 6 min.`, `Mélanger avec ${c.f.avec} et la sauce soja.`]
    },
    {
      id: 'gratin', libelle: 'Gratins', cuisine: 'francaise', temps: 40, niveau: 1, equip: ['four', 'plaque'], repas: ['dejeuner', 'diner'], forme: 'plat', tags: ['enfants'], fecDansNom: true,
      prots: ['jambon', 'lardons', 'thon', 'poulet_filet', 'saumon', 'boeuf_hache'],
      legs: ['courgette', 'brocoli', 'poireau', 'champignon', 'epinards', 'courge', 'aubergine'], nLegs: 1,
      fecs: ['pates', 'pomme_de_terre'],
      base: [['creme', 40], ['lait', 60], ['emmental', 30]],
      nom: (c) => `Gratin ${c.f.de} ${c.l1.a} et ${c.p.a}`,
      etapes: (c) => [c.f.cuire, `Faire revenir ${c.l1.les} 8 min avec ${c.p.cuit}.`, 'Mélanger le tout avec la crème et le lait dans un plat, couvrir de fromage.', 'Gratiner 20 min à 200 °C.']
    },
    {
      id: 'pates', libelle: 'Pâtes', cuisine: 'italienne', temps: 20, niveau: 1, equip: ['plaque'], repas: ['dejeuner', 'diner'], forme: 'assiette', tags: ['enfants'],
      prots: ['thon', 'jambon', 'lardons', 'poulet_filet', 'boeuf_hache', 'saumon', 'pois_chiches', 'feta', 'mozzarella'],
      legs: ['courgette', 'champignon', 'poivron', 'brocoli', 'epinards', 'petits_pois', 'aubergine', 'tomate', 'poireau', 'courge'], nLegs: 1,
      fecs: ['pates'],
      variantes: [
        { id: 'tom', nom: 'sauce tomate', ing: [['tomates_concassees', 120]], etape: 'les tomates concassées' },
        { id: 'cre', nom: 'sauce crème', ing: [['creme', 50]], etape: 'la crème' }
      ],
      base: [['oignon', 30], ['huile_olive', 5]],
      nom: (c) => `Pâtes ${c.p.a} et ${c.l1.a}, ${c.v.nom}`,
      etapes: (c) => [c.f.cuire, `Faire revenir l’oignon, puis ${c.l1.les} 8 min.`, `Ajouter ${c.p.cuit} et ${c.v.etape}, laisser mijoter 5 min.`, 'Mélanger avec les pâtes égouttées.']
    },
    {
      id: 'salade', libelle: 'Salades composées', cuisine: 'francaise', temps: 15, niveau: 1, equip: ['plaque'], repas: ['dejeuner', 'diner'], forme: 'saladier', tags: ['leger'], fecDansNom: true,
      prots: ['thon', 'oeufs', 'feta', 'poulet_filet', 'pois_chiches', 'mozzarella', 'jambon'],
      legs: ['tomate', 'carotte', 'mais', 'poivron', 'haricots_verts'], nLegs: 2,
      fecs: ['riz', 'pates', 'quinoa', 'semoule', 'pomme_de_terre'],
      base: [['huile_olive', 10], ['moutarde', 4], ['citron', 0.2]],
      nom: (c) => `Salade ${c.f.de} ${c.p.a}, ${c.l1.n} et ${c.l2.n}`,
      etapes: (c) => [c.f.cuire + ' Laisser refroidir.', `Couper ${c.l1.les} et ${c.l2.les} en petits morceaux.`, 'Vinaigrette : moutarde, huile, jus de citron, sel, poivre.', `Mélanger avec ${c.p.cuit}.`]
    },
    {
      id: 'bowl', libelle: 'Bowls', cuisine: 'asiatique', temps: 20, niveau: 1, equip: ['plaque'], repas: ['dejeuner', 'diner'], forme: 'bol', tags: ['leger'], fecDansNom: true,
      prots: ['tofu', 'saumon', 'poulet_filet', 'oeufs', 'pois_chiches'],
      legs: ['carotte', 'mais', 'brocoli', 'petits_pois', 'poivron', 'courge'], nLegs: 2,
      fecs: ['riz', 'quinoa'],
      base: [['sauce_soja', 10], ['huile_olive', 5]],
      nom: (c) => `Bowl ${c.f.de} ${c.p.a}, ${c.l1.n} et ${c.l2.n}`,
      etapes: (c) => [c.f.cuire, `Dorer ${c.p.cuit} avec un peu de sauce soja.`, `Cuire ${c.l1.les} et ${c.l2.les} 8 min à la vapeur ou à la poêle.`, 'Disposer le tout dans les bols, arroser du reste de sauce soja.']
    },
    {
      id: 'mijote', libelle: 'Mijotés', cuisine: 'orientale', temps: 40, niveau: 1, equip: ['plaque'], repas: ['dejeuner', 'diner'], forme: 'bol',
      prots: ['poulet_filet', 'saucisse', 'pois_chiches', 'lentilles_vertes', 'haricots_rouges'],
      legs: ['carotte', 'courgette', 'poivron', 'epinards', 'aubergine', 'courge', 'champignon', 'poireau'], nLegs: 1,
      fecs: ['semoule', 'riz', 'pomme_de_terre'],
      variantes: [
        { id: 'pap', nom: ', façon paprika', ing: [['paprika', 2]], etape: 'le paprika' },
        { id: 'epi', nom: ', aux épices douces', ing: [['cumin', 2]], etape: 'le cumin' }
      ],
      base: [['tomates_concassees', 120], ['oignon', 40], ['huile_olive', 5], ['bouillon', 0.3]],
      nom: (c) => `Mijoté ${c.p.de} ${c.l1.a}${c.v.nom}, avec ${c.f.avec}`,
      etapes: (c) => [`Faire revenir l’oignon avec ${c.v.etape}, puis ${c.p.cuit}.`, `Ajouter ${c.l1.les}, les tomates, le bouillon et un verre d’eau.`, 'Laisser mijoter 25 min à couvert.', c.f.cuire, `Servir avec ${c.f.avec}.`]
    },
    {
      id: 'quiche', libelle: 'Quiches', cuisine: 'francaise', temps: 50, niveau: 2, equip: ['four', 'plaque'], repas: ['dejeuner', 'diner'], forme: 'tarte',
      prots: ['lardons', 'jambon', 'thon', 'saumon', 'feta', 'mozzarella'],
      legs: ['poireau', 'courgette', 'champignon', 'brocoli', 'epinards', 'poivron', 'tomate'], nLegs: 1,
      fecs: [],
      base: [['farine', 60], ['beurre', 30], ['oeufs', 1], ['creme', 50], ['lait', 50], ['emmental', 20], ['salade', 0.25]],
      nom: (c) => `Quiche ${c.l1.a} et ${c.p.a}, salade verte`,
      etapes: (c) => ['Pâte : mélanger farine, beurre en morceaux, une pincée de sel et un peu d’eau. Étaler dans un moule.', `Faire fondre ${c.l1.les} 10 min à la poêle.`, `Battre œufs, crème et lait, ajouter ${c.l1.les}, ${c.p.cuit} et le fromage.`, 'Verser sur la pâte, cuire 35 min à 190 °C. Servir avec la salade.']
    },
    {
      id: 'omelette', libelle: 'Omelettes', cuisine: 'francaise', temps: 15, niveau: 1, equip: ['plaque'], repas: ['dejeuner', 'diner'], forme: 'assiette', tags: ['enfants', 'leger'], protFixe: 'oeufs',
      prots: ['jambon', 'lardons', 'feta', 'emmental', 'thon'],
      legs: ['courgette', 'champignon', 'poivron', 'epinards', 'poireau', 'tomate', 'petits_pois'], nLegs: 1,
      fecs: ['pain', 'pomme_de_terre'],
      base: [['oeufs', 2], ['huile_olive', 5], ['salade', 0.2]],
      nom: (c) => `Omelette ${c.l1.a} et ${c.p.a}, avec ${c.f.avec}`,
      etapes: (c) => [c.f.cuire, `Poêler ${c.l1.les} 6 min.`, `Verser les œufs battus, ajouter ${c.p.cuit}, cuire 3 min.`, `Servir avec la salade et ${c.f.avec}.`]
    },
    {
      id: 'veloute', libelle: 'Soupes et veloutés', cuisine: 'francaise', temps: 35, niveau: 1, equip: ['plaque'], repas: ['diner'], forme: 'soupe', tags: ['leger'],
      prots: ['lentilles_corail', 'pois_chiches', 'oeufs', 'emmental'],
      legs: ['carotte', 'poireau', 'courgette', 'courge', 'brocoli', 'epinards', 'tomate', 'petits_pois'], nLegs: 2,
      fecs: ['pain'], qProt: { oeufs: 1 },
      base: [['pomme_de_terre', 80], ['oignon', 30], ['bouillon', 0.5]],
      nom: (c) => `Velouté ${c.l1.de} et ${c.l2.de}${c.pid === 'oeufs' ? ', œuf mollet' : c.pid === 'emmental' ? ', tartines au fromage' : ' ' + c.p.a}`,
      etapes: (c) => [`Couper ${c.l1.les}, ${c.l2.les}, la pomme de terre et l’oignon.`, `Couvrir d’eau avec le bouillon${['lentilles_corail', 'pois_chiches'].includes(c.pid) ? ' et ' + c.p.cuit : ''}, cuire 25 min puis mixer.`, c.pid === 'oeufs' ? 'Cuire l’œuf 6 min, écaler, servir dans le velouté avec le pain.' : c.pid === 'emmental' ? 'Gratiner les tranches de pain au fromage 5 min au four ou à la poêle.' : 'Servir avec le pain.']
    },
    {
      id: 'wraps', libelle: 'Wraps', cuisine: 'mexicaine', temps: 15, niveau: 1, equip: ['plaque'], repas: ['dejeuner', 'diner'], forme: 'wrap', tags: ['enfants'],
      prots: ['poulet_filet', 'thon', 'haricots_rouges', 'feta', 'jambon'],
      legs: ['tomate', 'mais', 'carotte', 'poivron'], nLegs: 2,
      fecs: [],
      base: [['tortillas', 2], ['yaourt', 30], ['salade', 0.2]],
      nom: (c) => `Wraps ${c.p.a}, ${c.l1.n} et ${c.l2.n}`,
      etapes: (c) => [`Préparer ${c.p.cuit} (poêler 6 min si besoin).`, 'Mélanger le yaourt avec sel, poivre et un filet de citron si vous en avez.', `Garnir les tortillas de salade, de ${c.l1.n}, de ${c.l2.n}, de la garniture et de sauce, puis rouler.`]
    },
    {
      id: 'pizza', libelle: 'Pizzas express', cuisine: 'italienne', temps: 20, niveau: 1, equip: ['four'], repas: ['dejeuner', 'diner'], forme: 'pizza', tags: ['enfants'],
      prots: ['jambon', 'thon', 'lardons', 'poulet_filet', 'feta'],
      legs: ['champignon', 'poivron', 'courgette', 'aubergine', 'tomate', 'epinards'], nLegs: 1,
      fecs: [],
      base: [['tortillas', 2], ['tomates_concassees', 60], ['mozzarella', 50], ['salade', 0.2]],
      nom: (c) => `Pizza express ${c.l1.a} et ${c.p.a}`,
      etapes: (c) => ['Étaler la tomate sur les tortillas.', `Garnir de ${c.l1.n} en fines tranches, de ${c.p.cuit} et de mozzarella.`, 'Cuire 10 min à 220 °C. Servir avec la salade.']
    }
  ];

  const data = { LEX, Q, LEGERS, modeles };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.MENU_MODELES = data;
})(typeof window !== 'undefined' ? window : globalThis);
