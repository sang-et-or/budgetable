/* Budgétable — idées de recettes de saison (automne et hiver).
 * Quantités pour UNE portion adulte, comme le reste du catalogue.
 * mois : les mois où les légumes de la recette sont de saison en France (1 = janvier).
 * Nouveaux produits : prix de démonstration et valeurs nutritionnelles moyennes (type Ciqual), comme le reste.
 */
(function (root) {
  'use strict';
  const FL = 'Fruits et légumes', CR = 'Crèmerie et frais', VP = 'Viandes et poissons', EP = 'Épicerie salée';
  const I = (id, nom, rayon, unite, cond, condLabel, prixDemo, groupe, tags = []) => ({ id, nom, rayon, unite, cond, condLabel, prixDemo, groupe, tags });
  const INGREDIENTS = [
    I('chataignes', 'Châtaignes cuites', EP, 'g', 400, 'bocal 400 g', 3.6, 'F'),
    I('poire', 'Poires', FL, 'g', 1000, '1 kg', 2.9, 'L'),
    I('navet', 'Navets', FL, 'g', 1000, 'botte 1 kg', 2.2, 'L'),
    I('panais', 'Panais', FL, 'g', 500, 'sachet 500 g', 1.9, 'L'),
    I('celeri_rave', 'Céleri-rave', FL, 'g', 800, '1 pièce (800 g)', 1.9, 'L', ['celeri']),
    I('chou_fleur', 'Chou-fleur', FL, 'g', 900, '1 pièce (900 g)', 2.3, 'L'),
    I('endives', 'Endives', FL, 'g', 1000, 'sachet 1 kg', 2.6, 'L'),
    I('betterave', 'Betteraves cuites', FL, 'g', 500, 'sachet 500 g', 1.6, 'L'),
    I('noix', 'Cerneaux de noix', EP, 'g', 125, 'sachet 125 g', 2.7, 'A', ['fruits_coque']),
    I('reblochon', 'Reblochon', CR, 'g', 450, '1 fromage (450 g)', 6.5, 'D', ['lait', 'animal']),
    I('boeuf_braiser', 'Bœuf à braiser', VP, 'g', 500, 'barquette 500 g', 7.9, 'P', ['viande', 'animal'])
  ];
  // [kcal, AG saturés, sucres, sel, fibres, protéines, fruits et légumes (1/0), poids d'une pièce] pour 100 g
  const NUTRITION = {
    chataignes: [180, 0.4, 10, 0.01, 5.5, 2.5, 0], poire: [55, 0, 10, 0, 3, 0.4, 1], navet: [22, 0, 3, 0.05, 2, 0.8, 1],
    panais: [70, 0, 4.8, 0.02, 4.5, 1.2, 1], celeri_rave: [25, 0, 2, 0.2, 3.5, 1.2, 1], chou_fleur: [25, 0, 2.5, 0.03, 2.2, 2, 1],
    endives: [17, 0, 1, 0.02, 1.1, 0.9, 1], betterave: [44, 0, 8, 0.2, 2.5, 1.6, 1], noix: [690, 6, 2.6, 0, 6.5, 15, 0],
    reblochon: [330, 18, 0, 1.2, 0, 20, 0], boeuf_braiser: [150, 3, 0, 0.15, 0, 21, 0]
  };
  const AUT = [9, 10, 11, 12, 1, 2], HIV = [10, 11, 12, 1, 2, 3];
  const DD = ['dejeuner', 'diner'];
  const R = (id, nom, mois, temps, niveau, equip, modele, forme, tags, ing, etapes, extra = {}) =>
    ({ id: 's-' + id, nom, mois, repas: extra.repas || DD, temps, niveau, equip, cuisine: extra.cuisine || 'francaise', tags, modele, forme, ing, etapes, accroche: extra.accroche || '' });
  const RECETTES = [
    R('veloute-potiron-chataignes', 'Velouté de courge et châtaignes', AUT, 35, 1, ['plaque'], 'veloute', 'soupe', ['leger'],
      [['courge', 250], ['chataignes', 40], ['oignon', 40], ['creme', 15], ['bouillon', 0.3], ['pain', 0.25]],
      ['Épluchez la courge et coupez-la en cubes, émincez l’oignon.', 'Faites revenir l’oignon 3 min, ajoutez la courge et les châtaignes (gardez-en quelques-unes).', 'Couvrez d’eau avec le bouillon, cuisez 25 min.', 'Mixez avec la crème, servez avec les châtaignes émiettées et du pain.'], { accroche: 'Doux et réconfortant' }),
    R('gratin-butternut', 'Gratin de butternut à la crème', AUT, 50, 1, ['four'], 'gratin', 'plat', ['enfants'],
      [['courge', 280], ['creme', 30], ['emmental', 25], ['ail', 3], ['pain', 0.2]],
      ['Préchauffez le four à 190 °C.', 'Épluchez la courge, coupez-la en fines tranches.', 'Disposez-la dans un plat frotté à l’ail, versez la crème, salez, poivrez.', 'Parsemez de fromage, enfournez 40 min jusqu’à ce que ce soit fondant et doré.']),
    R('tartiflette', 'Tartiflette', [11, 12, 1, 2, 3], 60, 2, ['four', 'plaque'], 'gratin', 'plat', [],
      [['pomme_de_terre', 250], ['reblochon', 70], ['lardons', 50], ['oignon', 40], ['creme', 20]],
      ['Cuisez les pommes de terre 20 min à l’eau, épluchez-les et coupez-les en rondelles.', 'Faites dorer oignon et lardons.', 'Alternez pommes de terre, lardons et crème dans un plat, posez le reblochon coupé en deux dessus.', 'Enfournez 25 min à 200 °C. Servez avec une salade verte.'], { accroche: 'Le plat des soirées froides' }),
    R('poelee-champignons', 'Poêlée de champignons et pommes de terre persillées', [9, 10, 11], 30, 1, ['plaque'], 'poelee', 'assiette', [],
      [['champignon', 150], ['pomme_de_terre', 220], ['ail', 4], ['persil', 0.1], ['huile_olive', 10], ['oeufs', 1]],
      ['Coupez les pommes de terre en dés, faites-les dorer 15 min dans l’huile.', 'Ajoutez les champignons émincés, cuisez 8 min à feu vif.', 'Ajoutez l’ail et le persil hachés en fin de cuisson.', 'Servez avec un œuf au plat.']),
    R('risotto-champignons', 'Risotto crémeux aux champignons', [9, 10, 11, 12], 35, 2, ['plaque'], 'maison', 'assiette', [],
      [['riz', 80], ['champignon', 150], ['oignon', 30], ['bouillon', 0.4], ['emmental', 20], ['creme', 15], ['huile_olive', 5]],
      ['Faites revenir l’oignon, ajoutez le riz et remuez 1 min.', 'Versez le bouillon chaud louche par louche en remuant, pendant 18 min.', 'Pendant ce temps, faites sauter les champignons.', 'Hors du feu, ajoutez les champignons, la crème et le fromage.'], { cuisine: 'italienne' }),
    R('parmentier-patate-douce', 'Hachis parmentier à la patate douce', HIV, 50, 1, ['four', 'plaque'], 'gratin', 'plat', ['enfants', 'proteines'],
      [['boeuf_hache', 100], ['patate_douce', 150], ['pomme_de_terre', 100], ['lait', 40], ['beurre', 8], ['emmental', 15], ['oignon', 40]],
      ['Cuisez patates douces et pommes de terre 20 min à l’eau, écrasez-les avec le lait et le beurre.', 'Faites revenir l’oignon et la viande, salez, poivrez.', 'Viande au fond du plat, purée dessus, fromage.', 'Gratinez 20 min à 200 °C.']),
    R('potee-chou', 'Potée au chou et saucisses', [10, 11, 12, 1, 2, 3], 60, 1, ['plaque'], 'mijote', 'bol', ['proteines'],
      [['chou', 200], ['saucisse', 120], ['pomme_de_terre', 150], ['carotte', 80], ['navet', 60], ['bouillon', 0.4]],
      ['Coupez le chou en quartiers et blanchissez-le 5 min à l’eau bouillante.', 'Mettez tous les légumes et les saucisses dans une grande cocotte, couvrez d’eau avec le bouillon.', 'Laissez mijoter 45 min à couvert.', 'Servez bien chaud avec un peu de moutarde.']),
    R('boeuf-carottes', 'Bœuf aux carottes', HIV, 150, 2, ['plaque'], 'mijote', 'bol', ['proteines'],
      [['boeuf_braiser', 150], ['carotte', 200], ['oignon', 50], ['bouillon', 0.4], ['farine', 5], ['huile_olive', 5], ['pomme_de_terre', 150]],
      ['Faites dorer la viande en morceaux dans l’huile, ajoutez l’oignon, saupoudrez de farine.', 'Couvrez d’eau avec le bouillon, laissez mijoter 1 h à couvert.', 'Ajoutez les carottes en rondelles et les pommes de terre, encore 1 h à feu doux.', 'Encore meilleur réchauffé le lendemain : idéal pour les gamelles.'], { accroche: 'Se prépare la veille' }),
    R('endives-jambon', 'Endives au jambon', HIV, 50, 1, ['four', 'plaque'], 'gratin', 'plat', ['enfants'],
      [['endives', 200], ['jambon', 50], ['lait', 100], ['farine', 10], ['beurre', 10], ['emmental', 20], ['pain', 0.2]],
      ['Faites cuire les endives 15 min à l’eau, égouttez-les bien.', 'Préparez une béchamel : beurre fondu, farine, puis le lait en fouettant.', 'Roulez chaque endive dans une tranche de jambon, mettez dans un plat.', 'Nappez de béchamel, parsemez de fromage, gratinez 20 min à 200 °C.']),
    R('saumon-poireaux', 'Saumon à la fondue de poireaux', HIV, 30, 1, ['plaque'], 'maison', 'assiette', ['proteines'],
      [['saumon', 120], ['poireau', 180], ['creme', 30], ['riz', 70], ['beurre', 5]],
      ['Émincez les poireaux, faites-les fondre 15 min au beurre à couvert.', 'Ajoutez la crème, salez, poivrez.', 'Cuisez le pavé de saumon 4 min de chaque côté.', 'Servez sur la fondue de poireaux avec du riz.']),
    R('quiche-poireaux', 'Quiche poireaux et lardons', HIV, 50, 1, ['four', 'plaque'], 'quiche', 'tarte', [],
      [['pate_brisee', 0.17], ['poireau', 150], ['lardons', 40], ['oeufs', 0.5], ['creme', 30], ['emmental', 15]],
      ['Préchauffez le four à 190 °C, foncez le moule avec la pâte.', 'Faites fondre les poireaux émincés avec les lardons 10 min.', 'Battez œufs et crème, ajoutez poireaux, lardons et fromage.', 'Versez sur la pâte, cuisez 35 min. Bonne froide dans une gamelle.']),
    R('curry-patate-douce', 'Curry de patate douce, lentilles et épinards', HIV, 35, 1, ['plaque'], 'curry', 'bol', ['epice', 'proteines'],
      [['patate_douce', 150], ['lentilles_corail', 50], ['lait_coco', 80], ['epinards', 50], ['curry', 3], ['oignon', 40], ['riz', 60]],
      ['Faites revenir l’oignon avec le curry 2 min.', 'Ajoutez la patate douce en dés, les lentilles, le lait de coco et un verre d’eau.', 'Laissez mijoter 20 min, ajoutez les épinards les 3 dernières minutes.', 'Servez avec du riz.'], { cuisine: 'indienne' }),
    R('chou-fleur-roti', 'Chou-fleur rôti, pois chiches et sauce au yaourt', [9, 10, 11, 12, 1, 2, 3], 40, 1, ['four'], 'bowl', 'bol', ['leger', 'proteines'],
      [['chou_fleur', 250], ['pois_chiches', 80], ['yaourt', 50], ['cumin', 2], ['huile_olive', 10], ['semoule', 60], ['citron', 0.1]],
      ['Préchauffez le four à 210 °C.', 'Détaillez le chou-fleur en bouquets, mélangez avec les pois chiches, l’huile et le cumin.', 'Rôtissez 25 min sur une plaque.', 'Servez sur la semoule avec le yaourt citronné.'], { cuisine: 'orientale' }),
    R('salade-endives-poire', 'Salade d’endives, poire, noix et feta', [10, 11, 12, 1, 2, 3], 15, 1, [], 'salade', 'saladier', ['leger'],
      [['endives', 150], ['poire', 80], ['noix', 15], ['feta', 40], ['betterave', 60], ['moutarde', 3], ['huile_olive', 10], ['pain', 0.2]],
      ['Émincez les endives, coupez la poire et la betterave en dés.', 'Préparez une vinaigrette : moutarde, huile, un peu de vinaigre, sel et poivre.', 'Mélangez, ajoutez la feta émiettée et les noix concassées.', 'Servez avec du pain.']),
    R('poulet-panais', 'Cuisses de poulet rôties, panais et carottes', HIV, 55, 1, ['four'], 'maison', 'assiette', ['enfants', 'proteines'],
      [['cuisses_poulet', 200], ['pomme_de_terre', 150], ['panais', 120], ['carotte', 80], ['huile_olive', 10], ['ail', 4]],
      ['Préchauffez le four à 200 °C.', 'Coupez les légumes en gros morceaux, mélangez-les à l’huile, à l’ail, au sel et au poivre.', 'Posez les cuisses de poulet dessus.', 'Rôtissez 45 min en arrosant à mi-cuisson.']),
    R('puree-celeri', 'Purée de céleri et saucisses', HIV, 40, 1, ['plaque'], 'maison', 'assiette', ['enfants'],
      [['celeri_rave', 200], ['pomme_de_terre', 100], ['lait', 40], ['beurre', 8], ['saucisse', 120]],
      ['Épluchez céleri et pommes de terre, coupez-les en cubes.', 'Cuisez 25 min à l’eau salée.', 'Écrasez avec le lait chaud et le beurre.', 'Faites dorer les saucisses à la poêle 15 min et servez.']),
    R('lentilles-saucisses', 'Lentilles aux saucisses et carottes', HIV, 45, 1, ['plaque'], 'mijote', 'bol', ['proteines'],
      [['lentilles_vertes', 70], ['saucisse', 100], ['carotte', 60], ['oignon', 40], ['bouillon', 0.3]],
      ['Faites revenir l’oignon et les carottes en rondelles.', 'Ajoutez les lentilles rincées, couvrez de 3 fois leur volume d’eau avec le bouillon.', 'Ajoutez les saucisses, laissez mijoter 30 min.', 'Se garde 3 jours au frais : parfait en gamelle.']),
    R('soupe-oignon', 'Soupe à l’oignon gratinée', [10, 11, 12, 1, 2], 50, 1, ['four', 'plaque'], 'veloute', 'soupe', [],
      [['oignon', 200], ['bouillon', 0.4], ['pain', 0.25], ['emmental', 30], ['beurre', 10], ['farine', 5]],
      ['Émincez finement les oignons, faites-les dorer 20 min au beurre en remuant.', 'Saupoudrez de farine, mouillez avec 30 cl d’eau et le bouillon, cuisez 15 min.', 'Versez dans des bols, posez des tranches de pain grillé et le fromage.', 'Gratinez 5 min sous le gril du four.']),
    R('pates-courge-lardons', 'Pâtes crémeuses à la courge et aux lardons', AUT, 30, 1, ['plaque'], 'pates', 'assiette', ['enfants'],
      [['pates', 100], ['courge', 150], ['creme', 25], ['lardons', 40], ['emmental', 10]],
      ['Cuisez la courge en petits dés 12 min dans une casserole d’eau, puis mixez-la avec la crème.', 'Faites dorer les lardons.', 'Cuisez les pâtes, mélangez-les à la crème de courge et aux lardons.', 'Servez avec un peu de fromage.']),
    R('gratin-chou-fleur', 'Gratin de chou-fleur au jambon', [9, 10, 11, 12, 1, 2, 3], 45, 1, ['four', 'plaque'], 'gratin', 'plat', ['enfants'],
      [['chou_fleur', 250], ['jambon', 40], ['lait', 100], ['farine', 10], ['beurre', 10], ['emmental', 25], ['pomme_de_terre', 100]],
      ['Cuisez le chou-fleur en bouquets et les pommes de terre 12 min à l’eau.', 'Préparez une béchamel : beurre fondu, farine, puis le lait en fouettant.', 'Mettez légumes et jambon en morceaux dans un plat, nappez de béchamel.', 'Parsemez de fromage, gratinez 20 min à 200 °C.']),
    R('veloute-panais', 'Velouté de panais et carottes', HIV, 35, 1, ['plaque'], 'veloute', 'soupe', ['leger'],
      [['panais', 150], ['carotte', 100], ['pomme_de_terre', 60], ['oignon', 30], ['creme', 15], ['bouillon', 0.3], ['pain', 0.25]],
      ['Épluchez et coupez les légumes en morceaux.', 'Faites revenir l’oignon, ajoutez les légumes, couvrez d’eau avec le bouillon.', 'Cuisez 25 min puis mixez avec la crème.', 'Servez avec du pain grillé.'])
  ];
  root.Saison = { INGREDIENTS, NUTRITION, RECETTES };
})(typeof window !== 'undefined' ? window : globalThis);
