/* Budgétable — entrées et desserts du quotidien, à ajouter à un repas de la semaine (avec la page Gourmand).
 * Quantités pour UNE part. mois : saison (1 = janvier) ; sans « mois », de toute l'année.
 */
(function (root) {
  'use strict';
  const E = 'entree', D = 'dessert';
  const HIVER = [11, 12, 1, 2, 3], AUTOMNE = [9, 10, 11, 12], ETE = [6, 7, 8, 9], PRINTEMPS = [3, 4, 5, 6];
  const R = (id, nom, type, emoji, temps, ing, etapes, extra = {}) => ({ id: 'e-' + id, nom, type, emoji, temps, ing, etapes, parts: 1, ...extra });
  const RECETTES = [
    // ----- entrées froides -----
    R('carottes-rapees', 'Carottes râpées au citron', E, '🥕', 10, [['carotte', 100], ['citron', 0.15], ['huile_olive', 5], ['persil', 0.05]],
      ['Épluchez et râpez les carottes.', 'Assaisonnez avec le jus de citron, l’huile, sel et poivre.', 'Parsemez de persil ciselé.'], { tags: ['vege', 'enfants', 'express'] }),
    R('betteraves', 'Betteraves vinaigrette', E, '🟣', 10, [['betterave', 100], ['vinaigre', 5], ['huile_olive', 5], ['moutarde', 3], ['echalote', 10]],
      ['Coupez les betteraves cuites en dés.', 'Mélangez moutarde, vinaigre, huile et échalote hachée.', 'Arrosez les betteraves, laissez reposer 5 min.'], { mois: AUTOMNE.concat(HIVER), tags: ['vege', 'express'] }),
    R('celeri-remoulade', 'Céleri rémoulade', E, '🥗', 15, [['celeri_rave', 100], ['moutarde', 5], ['fromage_blanc', 25], ['citron', 0.1]],
      ['Épluchez et râpez finement le céleri, arrosez de citron.', 'Mélangez la moutarde au fromage blanc (version légère de la mayonnaise).', 'Enrobez le céleri, salez, poivrez.'], { mois: AUTOMNE.concat(HIVER), tags: ['vege'] }),
    R('oeuf-mayo', 'Œufs durs mayonnaise', E, '🥚', 15, [['oeufs', 1], ['moutarde', 3], ['huile_tournesol', 10], ['salade', 0.1]],
      ['Faites cuire les œufs 10 min dans l’eau bouillante, refroidissez-les.', 'Montez une mayonnaise : moutarde, un jaune, l’huile en filet en fouettant.', 'Écalez les œufs, coupez-les en deux, nappez de mayonnaise sur un lit de salade.'], { tags: ['vege', 'enfants'] }),
    R('poireaux-vinaigrette', 'Poireaux vinaigrette', E, '🥬', 25, [['poireau', 120], ['vinaigre', 5], ['huile_olive', 8], ['moutarde', 3]],
      ['Coupez les poireaux en tronçons, faites-les cuire 15 min à l’eau salée ou à la vapeur.', 'Égouttez bien et laissez tiédir.', 'Nappez d’une vinaigrette moutardée.'], { mois: AUTOMNE.concat(HIVER), tags: ['vege'] }),
    R('salade-endives', 'Salade d’endives aux noix', E, '🥗', 10, [['endives', 100], ['noix', 10], ['pomme', 40], ['vinaigre', 4], ['huile_olive', 6]],
      ['Émincez les endives, coupez la pomme en petits dés.', 'Ajoutez les noix concassées.', 'Assaisonnez d’une vinaigrette.'], { mois: [10, 11, 12, 1, 2, 3], tags: ['vege', 'express'] }),
    R('chou-rouge', 'Salade de chou rouge', E, '🟣', 15, [['chou_rouge', 80], ['pomme', 30], ['vinaigre', 5], ['huile_olive', 6]],
      ['Émincez très finement le chou rouge, salez-le et laissez-le 10 min.', 'Ajoutez la pomme en bâtonnets.', 'Assaisonnez de vinaigre et d’huile.'], { mois: AUTOMNE.concat(HIVER), tags: ['vege'] }),
    R('tomates-mozza', 'Tomates mozzarella', E, '🍅', 10, [['tomate', 150], ['mozzarella', 40], ['basilic', 0.1], ['huile_olive', 6]],
      ['Coupez tomates et mozzarella en rondelles, alternez-les.', 'Ajoutez le basilic, l’huile, sel et poivre.'], { mois: ETE, tags: ['vege', 'express'] }),
    R('concombre-yaourt', 'Concombre au yaourt et à la menthe', E, '🥒', 10, [['concombre', 0.4], ['yaourt', 50], ['menthe', 0.05], ['citron', 0.05]],
      ['Coupez le concombre en fines rondelles.', 'Mélangez le yaourt, la menthe ciselée, un filet de citron, sel et poivre.', 'Enrobez le concombre, servez frais.'], { mois: [5, 6, 7, 8, 9], tags: ['vege', 'express'] }),
    R('taboule', 'Taboulé', E, '🥙', 20, [['semoule', 30], ['tomate', 60], ['concombre', 0.2], ['menthe', 0.1], ['citron', 0.2], ['huile_olive', 8]],
      ['Versez la semoule dans un saladier, couvrez d’eau bouillante salée à hauteur, laissez gonfler 5 min.', 'Égrainez, ajoutez tomate et concombre en petits dés, menthe ciselée.', 'Assaisonnez de citron et d’huile, 1 h au frais si possible.'], { mois: [5, 6, 7, 8, 9], tags: ['vege'] }),
    R('radis-beurre', 'Radis beurre', E, '🌱', 5, [['radis', 0.3], ['beurre', 10], ['pain', 0.15]],
      ['Lavez les radis, coupez les fanes.', 'Servez avec du beurre, du sel et une tranche de pain.'], { mois: PRINTEMPS, tags: ['vege', 'express', 'enfants'] }),
    R('melon', 'Melon', E, '🍈', 5, [['melon', 0.25]],
      ['Coupez le melon en quartiers, retirez les graines.', 'Servez bien frais (avec une tranche de jambon cru pour les gourmands).'], { mois: [6, 7, 8, 9], tags: ['vege', 'express', 'enfants'] }),
    R('avocat', 'Avocat vinaigrette', E, '🥑', 5, [['avocat', 0.5], ['vinaigre', 3], ['huile_olive', 5], ['moutarde', 2]],
      ['Coupez l’avocat en deux, retirez le noyau.', 'Remplissez le creux d’une vinaigrette moutardée.'], { tags: ['vege', 'express'] }),
    R('salade-verte', 'Salade verte et croûtons', E, '🥬', 5, [['salade', 0.2], ['croutons', 10], ['vinaigre', 3], ['huile_olive', 6], ['moutarde', 2]],
      ['Lavez et essorez la salade.', 'Assaisonnez d’une vinaigrette moutardée, parsemez de croûtons au dernier moment.'], { tags: ['vege', 'express', 'enfants'] }),
    R('lentilles-salade', 'Salade de lentilles', E, '🫘', 25, [['lentilles_vertes', 40], ['echalote', 10], ['vinaigre', 5], ['huile_olive', 6], ['persil', 0.05]],
      ['Faites cuire les lentilles 20 min dans l’eau non salée, égouttez.', 'Ajoutez l’échalote hachée et le persil.', 'Assaisonnez tiède avec la vinaigrette : elles prennent mieux le goût.'], { mois: AUTOMNE.concat(HIVER), tags: ['vege'] }),
    R('asperges', 'Asperges sauce mousseline', E, '🌿', 20, [['asperges', 150], ['fromage_blanc', 30], ['citron', 0.1], ['moutarde', 2]],
      ['Épluchez les asperges, faites-les cuire 10 à 15 min à l’eau salée.', 'Mélangez fromage blanc, citron et moutarde.', 'Servez les asperges tièdes avec la sauce.'], { mois: [4, 5, 6], tags: ['vege'] }),
    // ----- entrées chaudes -----
    R('veloute-potiron', 'Velouté de potiron', E, '🎃', 30, [['potiron', 200], ['oignon', 30], ['creme', 15], ['bouillon', 0.25]],
      ['Faites revenir l’oignon émincé, ajoutez le potiron en cubes.', 'Couvrez d’eau avec le bouillon, cuisez 20 min.', 'Mixez avec la crème, salez, poivrez.'], { mois: [9, 10, 11, 12], tags: ['vege', 'chaud'] }),
    R('soupe-poireaux', 'Soupe poireaux pommes de terre', E, '🥣', 30, [['poireau', 100], ['pomme_de_terre', 80], ['bouillon', 0.25], ['creme', 10]],
      ['Émincez les poireaux, coupez les pommes de terre en dés.', 'Couvrez d’eau avec le bouillon, cuisez 20 min.', 'Mixez, ajoutez la crème.'], { mois: AUTOMNE.concat(HIVER), tags: ['vege', 'chaud', 'enfants'] }),
    R('soupe-oignon', 'Soupe à l’oignon gratinée', E, '🧅', 40, [['oignon', 120], ['beurre', 8], ['bouillon', 0.3], ['pain', 0.15], ['emmental', 20]],
      ['Faites fondre les oignons émincés au beurre 20 min jusqu’à ce qu’ils soient bien dorés.', 'Ajoutez 30 cl d’eau et le bouillon, cuisez 10 min.', 'Versez dans un bol, posez une tranche de pain et le fromage, gratinez 5 min.'], { mois: [11, 12, 1, 2], tags: ['vege', 'chaud'] }),
    R('veloute-carottes', 'Velouté de carottes au cumin', E, '🥕', 30, [['carotte', 150], ['oignon', 25], ['cumin', 1], ['bouillon', 0.25]],
      ['Faites revenir l’oignon, ajoutez les carottes en rondelles et le cumin.', 'Couvrez d’eau avec le bouillon, cuisez 20 min.', 'Mixez finement.'], { tags: ['vege', 'chaud', 'enfants'] }),
    R('gaspacho', 'Gaspacho', E, '🍅', 15, [['tomate', 180], ['concombre', 0.15], ['poivron', 30], ['ail', 2], ['huile_olive', 8], ['vinaigre', 3]],
      ['Coupez tous les légumes en morceaux.', 'Mixez avec l’huile, le vinaigre, sel et poivre.', 'Servez très frais.'], { mois: [6, 7, 8, 9], tags: ['vege'] }),
    R('quiche-mini', 'Part de quiche aux poireaux', E, '🥧', 45, [['pate_brisee', 0.125], ['poireau', 50], ['oeufs', 0.375], ['creme', 25], ['emmental', 10]],
      ['Préchauffez le four à 180 °C, étalez la pâte dans un moule.', 'Faites fondre les poireaux émincés 10 min à la poêle.', 'Battez œufs et crème, ajoutez poireaux et fromage, versez sur la pâte.', 'Cuisez 30 min. Une quiche fait 8 parts d’entrée.'], { tags: ['vege', 'chaud'] }),
    // ----- desserts du quotidien -----
    R('fruit-saison', 'Fruit de saison', D, '🍎', 1, [['pomme', 150]],
      ['Un fruit frais : pomme, poire, clémentine, pêche… selon la saison et le marché.'], { tags: ['express', 'enfants', 'leger'] }),
    R('yaourt-miel', 'Yaourt nature et miel', D, '🍯', 2, [['yaourt', 125], ['miel', 10]],
      ['Versez un filet de miel sur le yaourt (ou de la confiture).'], { tags: ['express', 'enfants', 'leger'] }),
    R('salade-fruits', 'Salade de fruits', D, '🍓', 15, [['pomme', 60], ['banane', 50], ['orange', 80], ['citron', 0.05]],
      ['Coupez les fruits en morceaux.', 'Arrosez de jus de citron et du jus de l’orange, servez frais.'], { tags: ['enfants', 'leger'] }),
    R('pommes-four', 'Pommes au four', D, '🍏', 35, [['pomme', 180], ['beurre', 5], ['sucre', 8], ['sucre_vanille', 0.2]],
      ['Préchauffez le four à 180 °C, évidez les pommes.', 'Garnissez de beurre et de sucre vanillé.', 'Cuisez 30 min, servez tiède.'], { mois: AUTOMNE.concat(HIVER), tags: ['enfants'] }),
    R('fromage-blanc-fruits', 'Fromage blanc aux fruits rouges', D, '🫐', 3, [['fromage_blanc', 100], ['fruits_rouges', 40], ['sucre', 5]],
      ['Ajoutez les fruits rouges (surgelés, décongelés) au fromage blanc, sucrez à votre goût.'], { tags: ['express', 'leger'] }),
    R('poire-chocolat', 'Poire au chocolat', D, '🍐', 20, [['poire', 150], ['chocolat', 15]],
      ['Pochez les poires épluchées 10 min dans l’eau frémissante (ou prenez des poires au sirop).', 'Nappez de chocolat fondu.'], { mois: [9, 10, 11, 12, 1], tags: ['enfants'] }),
    R('fromage', 'Assiette de fromage', D, '🧀', 2, [['comte', 30], ['pain', 0.15]],
      ['Une part de fromage et une tranche de pain : à la française, avant ou à la place du dessert.'], { tags: ['express'] })
  ];
  root.Entrees = { RECETTES };
})(typeof window !== 'undefined' ? window : globalThis);
