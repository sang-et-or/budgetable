/* Budgétable — recettes à l'air fryer (friteuse à air).
 * Quantités pour UNE portion adulte, comme le reste du catalogue. Proposées seulement si la personne a coché
 * « Friteuse à air » dans son équipement (equip: ['airfryer']).
 * Temps et températures indicatifs : ils varient selon le modèle et la quantité dans le panier.
 */
(function (root) {
  'use strict';
  const DD = ['dejeuner', 'diner'];
  const A = ['airfryer'];
  // R(id, nom, minutes, cuisine, tags, ingrédients, étapes, extra)
  const R = (id, nom, temps, cuisine, tags, ing, etapes, extra = {}) =>
    ({ id: 'af-' + id, nom, repas: DD, temps, niveau: 1, equip: A, cuisine, tags, modele: extra.modele || 'maison', forme: extra.forme || 'assiette', ing, etapes, airfryer: true, accroche: extra.accroche || '', sig: extra.sig });
  const RECETTES = [
    R('poulet-frites', 'Cuisses de poulet croustillantes et frites à l’air fryer', 35, 'francaise', ['enfants', 'proteines'],
      [['cuisses_poulet', 250], ['pomme_de_terre', 250], ['huile_olive', 8], ['paprika', 1], ['ail', 3], ['salade', 0.2]],
      ['Frottez les cuisses de poulet avec la moitié de l’huile, le paprika, l’ail écrasé, du sel et du poivre.', 'Coupez les pommes de terre en frites, mélangez-les avec le reste de l’huile.', 'Cuisez le poulet 12 min à 200 °C, ajoutez les frites autour et poursuivez 18 à 20 min en secouant le panier à mi-cuisson.', 'Vérifiez que le jus du poulet est clair, servez avec la salade.'],
      { sig: 'poulet_roti', accroche: 'Le poulet-frites du dimanche, sans four' }),
    R('nuggets', 'Nuggets de poulet maison et frites à l’air fryer', 30, 'francaise', ['enfants', 'proteines'],
      [['poulet_filet', 120], ['farine', 10], ['oeufs', 0.5], ['chapelure', 25], ['pomme_de_terre', 200], ['huile_olive', 6], ['ketchup', 15]],
      ['Coupez le poulet en morceaux, passez-les dans la farine, l’œuf battu puis la chapelure.', 'Coupez les pommes de terre en frites et mélangez-les avec l’huile.', 'Cuisez les frites 10 min à 200 °C, ajoutez les nuggets et poursuivez 10 à 12 min en secouant à mi-cuisson.', 'Servez avec le ketchup.'],
      { accroche: 'Bien moins cher que les surgelés' }),
    R('saucisses-pdt', 'Saucisses, pommes de terre et oignons à l’air fryer', 30, 'francaise', ['enfants'],
      [['saucisse', 120], ['pomme_de_terre', 250], ['oignon', 60], ['huile_olive', 5], ['moutarde', 10], ['salade', 0.2]],
      ['Coupez les pommes de terre en cubes et l’oignon en quartiers, mélangez-les avec l’huile, salez, poivrez.', 'Cuisez-les 10 min à 200 °C.', 'Ajoutez les saucisses piquées à la fourchette, poursuivez 15 min en secouant à mi-cuisson.', 'Servez avec la moutarde et la salade.'],
      { accroche: 'Tout dans le même panier' }),
    R('croquettes-thon', 'Croquettes de thon et pommes de terre à l’air fryer', 35, 'francaise', ['proteines', 'enfants'],
      [['pomme_de_terre', 200], ['thon', 70], ['oeufs', 0.5], ['chapelure', 20], ['persil', 0.1], ['yaourt', 40], ['salade', 0.25]],
      ['Cuisez les pommes de terre 20 min à l’eau (ou utilisez un reste de purée), écrasez-les.', 'Mélangez avec le thon émietté, l’œuf et le persil haché, salez, poivrez.', 'Formez des croquettes, roulez-les dans la chapelure, cuisez 12 min à 190 °C en les retournant à mi-cuisson.', 'Servez avec le yaourt citronné et la salade.'],
      { accroche: 'Le reste de purée devient un vrai repas' }),
    R('falafels', 'Falafels maison, semoule et sauce yaourt à l’air fryer', 30, 'orientale', ['leger'],
      [['pois_chiches', 150], ['oignon', 30], ['ail', 3], ['cumin', 1], ['coriandre', 0.1], ['farine', 15], ['huile_olive', 6], ['semoule', 60], ['yaourt', 40], ['salade', 0.2]],
      ['Mixez les pois chiches égouttés avec l’oignon, l’ail, le cumin, la coriandre et la farine.', 'Formez des petites boulettes, badigeonnez-les d’huile.', 'Cuisez 12 min à 190 °C en secouant à mi-cuisson.', 'Préparez la semoule, servez avec les falafels, le yaourt et la salade.'],
      { forme: 'bol', accroche: 'Végétarien et presque gratuit' }),
    R('pdt-farcies', 'Pommes de terre farcies au fromage à l’air fryer', 45, 'francaise', ['enfants'],
      [['pomme_de_terre', 250], ['lardons', 40], ['creme', 25], ['emmental', 25], ['salade', 0.2]],
      ['Piquez les pommes de terre, cuisez-les 30 min à 200 °C.', 'Faites dorer les lardons à la poêle.', 'Coupez un chapeau, creusez les pommes de terre, écrasez la chair avec la crème et les lardons, remplissez, parsemez de fromage.', 'Remettez 6 min à 190 °C pour gratiner. Servez avec la salade.'],
      { sig: 's-pommes-terre-farcies' }),
    R('legumes-rotis', 'Légumes d’hiver rôtis, pois chiches et semoule à l’air fryer', 30, 'orientale', ['leger'],
      [['courge', 150], ['carotte', 80], ['panais', 80], ['oignon', 40], ['pois_chiches', 80], ['huile_olive', 8], ['cumin', 1], ['semoule', 60], ['yaourt', 40]],
      ['Coupez les légumes en morceaux de même taille, mélangez-les avec l’huile, le cumin, du sel et du poivre.', 'Cuisez 12 min à 190 °C, ajoutez les pois chiches égouttés et poursuivez 8 min en secouant.', 'Préparez la semoule.', 'Servez les légumes sur la semoule avec le yaourt.'],
      { forme: 'bol', accroche: 'Les légumes de saison, bien dorés' }),
    R('chou-fleur-pane', 'Chou-fleur pané au curry et riz à l’air fryer', 30, 'indienne', ['leger'],
      [['chou_fleur', 250], ['farine', 10], ['oeufs', 0.5], ['chapelure', 15], ['curry', 2], ['huile_olive', 5], ['riz', 70], ['yaourt', 40]],
      ['Détaillez le chou-fleur en bouquets.', 'Passez-les dans la farine, l’œuf battu puis la chapelure mélangée au curry, arrosez d’un filet d’huile.', 'Cuisez 15 min à 190 °C en secouant à mi-cuisson. Pendant ce temps, cuisez le riz.', 'Servez avec le riz et le yaourt.'],
      { accroche: 'Croustillant dehors, fondant dedans' }),
    R('patate-douce-haricots', 'Frites de patate douce et haricots rouges épicés', 30, 'mexicaine', ['leger'],
      [['patate_douce', 250], ['huile_olive', 6], ['paprika', 1], ['haricots_rouges', 100], ['tomates_concassees', 80], ['oignon', 30], ['cumin', 1], ['yaourt', 30]],
      ['Coupez les patates douces en frites, mélangez-les avec l’huile et le paprika.', 'Cuisez 15 à 18 min à 200 °C en secouant deux fois.', 'Pendant ce temps, faites revenir l’oignon, ajoutez les haricots égouttés, les tomates et le cumin, laissez mijoter 10 min.', 'Servez les frites avec les haricots et le yaourt.'],
      { accroche: 'Sucré, épicé, végétarien' }),
    R('colin-pane', 'Colin pané et frites à l’air fryer', 30, 'francaise', ['proteines', 'enfants'],
      [['colin', 130], ['farine', 10], ['oeufs', 0.5], ['chapelure', 20], ['pomme_de_terre', 220], ['huile_olive', 6], ['citron', 0.25], ['salade', 0.2]],
      ['Coupez les pommes de terre en frites, mélangez-les avec l’huile, cuisez 10 min à 200 °C.', 'Passez le colin dans la farine, l’œuf battu puis la chapelure.', 'Ajoutez le poisson dans le panier, poursuivez 10 à 12 min à 200 °C en secouant les frites à mi-cuisson.', 'Servez avec le citron et la salade.'],
      { accroche: 'Le fish and chips maison' }),
    R('boulettes', 'Boulettes de bœuf et pommes de terre rôties à l’air fryer', 35, 'francaise', ['enfants', 'proteines'],
      [['boeuf_hache', 110], ['chapelure', 10], ['oeufs', 0.25], ['oignon', 30], ['pomme_de_terre', 200], ['carotte', 100], ['huile_olive', 6]],
      ['Mélangez la viande avec la chapelure, l’œuf et la moitié de l’oignon haché, formez des boulettes.', 'Coupez pommes de terre et carottes en cubes, mélangez-les avec l’huile et le reste de l’oignon.', 'Cuisez les légumes 12 min à 200 °C, ajoutez les boulettes et poursuivez 10 min en secouant.', 'Salez, poivrez et servez.']),
    R('salade-pois-chiches', 'Salade tiède de pois chiches croustillants et feta', 20, 'orientale', ['leger'],
      [['pois_chiches', 150], ['paprika', 1], ['huile_olive', 10], ['salade', 0.3], ['carotte', 80], ['feta', 30], ['citron', 0.25], ['pain', 0.25]],
      ['Égouttez et séchez bien les pois chiches, mélangez-les avec la moitié de l’huile et le paprika.', 'Cuisez 15 min à 200 °C en secouant deux fois : ils deviennent croustillants.', 'Râpez la carotte, mélangez avec la salade, la feta émiettée, le citron et le reste de l’huile.', 'Ajoutez les pois chiches tièdes, servez avec du pain.'],
      { modele: 'salade', forme: 'saladier', accroche: 'Prête en 20 minutes' })
  ];
  root.AirFryer = { INGREDIENTS: [], RECETTES };
})(typeof window !== 'undefined' ? window : globalThis);
