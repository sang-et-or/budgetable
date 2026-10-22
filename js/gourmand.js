/* Budgétable — grignotages gourmands : desserts et goûters faits maison.
 * Quantités pour UNE part (la liste de courses les multiplie par le nombre de parts).
 * Les produits sucrés s'ajoutent au catalogue avec un prix de démonstration, comme le reste.
 */
(function (root) {
  'use strict';
  const INGREDIENTS = [
    { id: 'sucre', nom: 'Sucre en poudre', rayon: 'Épicerie sucrée', unite: 'g', cond: 1000, condLabel: 'paquet 1 kg', prixDemo: 1.15, groupe: 'A', tags: [] },
    { id: 'chocolat', nom: 'Chocolat noir pâtissier', rayon: 'Épicerie sucrée', unite: 'g', cond: 200, condLabel: 'tablette 200 g', prixDemo: 1.95, groupe: 'A', tags: ['lait', 'soja'] },
    { id: 'cacao', nom: 'Cacao en poudre', rayon: 'Épicerie sucrée', unite: 'g', cond: 250, condLabel: 'boîte 250 g', prixDemo: 2.6, groupe: 'A', tags: [] },
    { id: 'levure', nom: 'Levure chimique', rayon: 'Épicerie sucrée', unite: 'pièce', cond: 6, condLabel: 'lot de 6 sachets', prixDemo: 0.95, groupe: 'A', tags: [] },
    { id: 'sucre_vanille', nom: 'Sucre vanillé', rayon: 'Épicerie sucrée', unite: 'pièce', cond: 10, condLabel: 'boîte de 10 sachets', prixDemo: 0.9, groupe: 'A', tags: [] },
    { id: 'confiture', nom: 'Confiture de fraises', rayon: 'Épicerie sucrée', unite: 'g', cond: 370, condLabel: 'pot 370 g', prixDemo: 1.95, groupe: 'A', tags: [] },
    { id: 'miel', nom: 'Miel', rayon: 'Épicerie sucrée', unite: 'g', cond: 500, condLabel: 'pot 500 g', prixDemo: 4.2, groupe: 'A', tags: ['animal'] },
    { id: 'flocons_avoine', nom: 'Flocons d’avoine', rayon: 'Épicerie sucrée', unite: 'g', cond: 500, condLabel: 'paquet 500 g', prixDemo: 1.3, groupe: 'A', tags: ['gluten'] },
    { id: 'compote', nom: 'Compote de pommes (gourdes)', rayon: 'Épicerie sucrée', unite: 'pièce', cond: 4, condLabel: 'lot de 4 gourdes', prixDemo: 1.65, groupe: 'A', tags: [] },
    { id: 'pate_brisee', nom: 'Pâte brisée', rayon: 'Crèmerie et frais', unite: 'pièce', cond: 1, condLabel: 'rouleau', prixDemo: 1.1, groupe: 'A', tags: ['gluten', 'lait', 'animal'] },
    { id: 'pomme', nom: 'Pommes', rayon: 'Fruits et légumes', unite: 'g', cond: 1500, condLabel: 'sachet 1,5 kg', prixDemo: 2.6, groupe: 'L', tags: [] },
    { id: 'banane', nom: 'Bananes', rayon: 'Fruits et légumes', unite: 'g', cond: 1000, condLabel: '1 kg', prixDemo: 1.9, groupe: 'L', tags: [] },
    { id: 'fraises', nom: 'Fraises', rayon: 'Fruits et légumes', unite: 'g', cond: 250, condLabel: 'barquette 250 g', prixDemo: 2.9, groupe: 'L', tags: [] }
  ];
  const D = 'dessert', G = 'gouter';
  const R = (id, nom, type, emoji, temps, ing, etapes, extra = {}) => ({ id: 'g-' + id, nom, type, emoji, temps, ing, etapes, ...extra });
  const RECETTES = [
    R('yaourt', 'Gâteau au yaourt', G, '🍰', 45, [['yaourt', 16], ['sucre', 25], ['farine', 26], ['oeufs', 0.375], ['huile_olive', 6], ['levure', 0.125]],
      ['Préchauffez le four à 180 °C et beurrez un moule.', 'Videz le yaourt dans un saladier ; le pot sert de mesure : 2 pots de sucre, 3 œufs, 3 pots de farine, ½ pot d’huile et la levure.', 'Mélangez jusqu’à obtenir une pâte lisse, versez dans le moule.', 'Faites cuire 30 à 35 min : la lame d’un couteau doit ressortir sèche.'], { parts: 8 }),
    R('crepes', 'Crêpes', G, '🥞', 30, [['farine', 31], ['oeufs', 0.5], ['lait', 62], ['beurre', 6], ['sucre', 6]],
      ['Mélangez la farine et le sucre, creusez un puits, ajoutez les œufs.', 'Versez le lait petit à petit en fouettant, puis le beurre fondu.', 'Laissez reposer 30 min si vous avez le temps.', 'Faites cuire dans une poêle chaude légèrement beurrée, 1 min de chaque côté.'], { parts: 8, tags: ['enfants'] }),
    R('fondant', 'Fondant au chocolat', D, '🍫', 35, [['chocolat', 25], ['beurre', 19], ['sucre', 19], ['oeufs', 0.5], ['farine', 6]],
      ['Préchauffez le four à 180 °C.', 'Faites fondre le chocolat et le beurre (micro-ondes, 30 s à la fois).', 'Ajoutez le sucre, puis les œufs un à un, puis la farine.', 'Versez dans un moule beurré, cuisez 20 à 22 min : le cœur reste fondant.'], { parts: 8 }),
    R('mousse', 'Mousse au chocolat', D, '🍫', 20, [['chocolat', 33], ['oeufs', 1], ['sucre', 5]],
      ['Faites fondre le chocolat, laissez tiédir.', 'Séparez les blancs des jaunes ; mélangez les jaunes au chocolat.', 'Montez les blancs en neige ferme avec le sucre.', 'Incorporez-les délicatement, puis 3 h au frais minimum.', 'Œufs crus : à éviter pour les femmes enceintes et les tout-petits.'], { parts: 6 }),
    R('crumble', 'Crumble aux pommes', D, '🍎', 45, [['pomme', 200], ['farine', 25], ['beurre', 20], ['sucre', 20]],
      ['Préchauffez le four à 180 °C.', 'Épluchez et coupez les pommes en dés, mettez-les dans un plat.', 'Sablez du bout des doigts farine, sucre et beurre froid.', 'Parsemez sur les pommes, cuisez 30 min jusqu’à ce que ce soit doré.'], { parts: 6 }),
    R('compote', 'Compote maison', G, '🍏', 25, [['pomme', 180], ['sucre', 6], ['citron', 0.05]],
      ['Épluchez et coupez les pommes.', 'Faites-les cuire à feu doux 15 à 20 min avec un fond d’eau, le sucre et un filet de citron.', 'Écrasez à la fourchette ou mixez. Se garde 4 jours au frais.'], { parts: 6, tags: ['enfants'] }),
    R('riz-lait', 'Riz au lait', D, '🍚', 45, [['riz', 25], ['lait', 125], ['sucre', 15], ['sucre_vanille', 0.17]],
      ['Portez le lait à ébullition avec le sucre vanillé.', 'Ajoutez le riz, baissez le feu et laissez cuire 35 min en remuant souvent.', 'Ajoutez le sucre en fin de cuisson. Servez tiède ou froid.'], { parts: 6 }),
    R('clafoutis', 'Clafoutis aux fraises', D, '🍓', 45, [['fraises', 80], ['oeufs', 0.5], ['lait', 60], ['farine', 15], ['sucre', 15]],
      ['Préchauffez le four à 180 °C, beurrez un plat et disposez les fraises.', 'Fouettez œufs et sucre, ajoutez la farine puis le lait.', 'Versez sur les fruits, cuisez 35 min.'], { parts: 6 }),
    R('pain-perdu', 'Pain perdu', G, '🍞', 15, [['pain', 0.2], ['oeufs', 0.5], ['lait', 60], ['sucre', 8], ['beurre', 5]],
      ['Battez œufs, lait et sucre dans une assiette creuse.', 'Trempez les tranches de pain rassis des deux côtés.', 'Dorez-les à la poêle dans le beurre, 2 min de chaque côté.'], { parts: 4, tags: ['enfants'] }),
    R('cookies', 'Cookies aux pépites de chocolat', G, '🍪', 25, [['farine', 25], ['beurre', 15], ['sucre', 15], ['chocolat', 15], ['oeufs', 0.17], ['levure', 0.05]],
      ['Préchauffez le four à 180 °C.', 'Mélangez le beurre mou et le sucre, ajoutez l’œuf, puis la farine et la levure.', 'Ajoutez le chocolat concassé.', 'Formez des boules sur une plaque, cuisez 10 à 12 min : ils durcissent en refroidissant.'], { parts: 12, tags: ['enfants'] }),
    R('banana-bread', 'Banana bread', G, '🍌', 60, [['banane', 60], ['farine', 25], ['sucre', 12], ['oeufs', 0.25], ['beurre', 10], ['levure', 0.12]],
      ['Préchauffez le four à 175 °C.', 'Écrasez les bananes bien mûres, ajoutez le beurre fondu, le sucre et les œufs.', 'Ajoutez la farine et la levure, versez dans un moule à cake.', 'Cuisez 45 à 50 min.'], { parts: 8 }),
    R('muffins', 'Muffins au chocolat', G, '🧁', 35, [['farine', 30], ['sucre', 15], ['oeufs', 0.33], ['lait', 25], ['beurre', 12], ['chocolat', 10], ['levure', 0.1]],
      ['Préchauffez le four à 180 °C.', 'Mélangez les ingrédients secs d’un côté, les liquides de l’autre.', 'Réunissez sans trop mélanger, ajoutez le chocolat en morceaux.', 'Remplissez les moules aux ¾, cuisez 20 min.'], { parts: 9, tags: ['enfants'] }),
    R('yaourt-miel', 'Yaourt, miel et banane', G, '🍯', 3, [['yaourt', 125], ['miel', 10], ['banane', 60]],
      ['Versez le yaourt dans un bol, ajoutez la banane en rondelles et un filet de miel.', 'Pas de miel avant 1 an.'], { parts: 1 }),
    R('tartines', 'Tartines beurre-confiture', G, '🍓', 3, [['pain', 0.25], ['beurre', 8], ['confiture', 25]],
      ['Coupez la baguette, beurrez, ajoutez la confiture. Le goûter de toujours.'], { parts: 1, tags: ['enfants'] }),
    R('pain-chocolat', 'Pain et carré de chocolat', G, '🍫', 2, [['pain', 0.25], ['chocolat', 20]],
      ['Un morceau de baguette et deux carrés de chocolat : le goûter à la française.'], { parts: 1, tags: ['enfants'] }),
    R('salade-fruits', 'Salade de fruits', D, '🍓', 15, [['pomme', 80], ['banane', 60], ['fraises', 50], ['citron', 0.05], ['sucre', 5]],
      ['Coupez les fruits en morceaux.', 'Arrosez de jus de citron (les fruits ne noircissent pas), sucrez légèrement.', 'Gardez au frais jusqu’au service.'], { parts: 4 }),
    R('smoothie', 'Smoothie banane-fraise', G, '🥤', 5, [['banane', 60], ['fraises', 60], ['yaourt', 60], ['lait', 80]],
      ['Mixez tout jusqu’à ce que ce soit lisse. À boire tout de suite.'], { parts: 2, tags: ['enfants'] }),
    R('tarte-pommes', 'Tarte aux pommes', D, '🥧', 50, [['pate_brisee', 0.17], ['pomme', 130], ['sucre', 10], ['beurre', 5]],
      ['Préchauffez le four à 200 °C, déroulez la pâte dans un moule.', 'Disposez les pommes en fines lamelles en rosace.', 'Saupoudrez de sucre, parsemez de noisettes de beurre.', 'Cuisez 35 min.'], { parts: 6 }),
    R('flan', 'Flan pâtissier', D, '🍮', 60, [['lait', 125], ['oeufs', 0.5], ['sucre', 20], ['farine', 12], ['pate_brisee', 0.125], ['sucre_vanille', 0.125]],
      ['Préchauffez le four à 180 °C, foncez le moule avec la pâte.', 'Faites chauffer le lait avec le sucre vanillé.', 'Fouettez œufs, sucre et farine, versez le lait chaud dessus, remettez à épaissir sur le feu en remuant.', 'Versez sur la pâte, cuisez 40 min. Laissez refroidir avant de couper.'], { parts: 8 }),
    R('gaufres', 'Gaufres', G, '🧇', 30, [['farine', 30], ['lait', 50], ['oeufs', 0.33], ['beurre', 10], ['sucre', 8], ['levure', 0.1]],
      ['Mélangez farine, levure et sucre, ajoutez les œufs, puis le lait et le beurre fondu.', 'Laissez reposer 15 min.', 'Cuisez dans le gaufrier bien chaud, 3 à 4 min.'], { parts: 8, equip: ['gaufrier'], tags: ['enfants'] }),
    R('granola', 'Granola maison', G, '🥣', 30, [['flocons_avoine', 40], ['miel', 10], ['huile_olive', 5]],
      ['Préchauffez le four à 160 °C.', 'Mélangez les flocons avec le miel et un peu d’huile.', 'Étalez sur une plaque, cuisez 20 min en remuant à mi-cuisson.', 'Se garde 2 semaines dans un bocal. À manger avec un yaourt.'], { parts: 8 }),
    R('pommes-four', 'Pommes au four', D, '🍎', 35, [['pomme', 200], ['beurre', 5], ['sucre', 5]],
      ['Préchauffez le four à 180 °C.', 'Videz le cœur des pommes, mettez une noisette de beurre et un peu de sucre dedans.', 'Cuisez 25 à 30 min.'], { parts: 4 }),
    R('madeleines', 'Madeleines', G, '🐚', 30, [['farine', 20], ['beurre', 18], ['sucre', 18], ['oeufs', 0.33], ['levure', 0.05], ['citron', 0.05]],
      ['Fouettez œufs et sucre, ajoutez farine, levure, zeste de citron et beurre fondu.', 'Si possible, 1 h au frais : c’est le secret de la bosse.', 'Remplissez les moules, cuisez 10 min à 200 °C.'], { parts: 12, equip: ['moule à madeleines'] }),
    R('fraises-creme', 'Fraises à la crème', D, '🍓', 5, [['fraises', 125], ['creme', 20], ['sucre', 5]],
      ['Lavez et équeutez les fraises, coupez-les en deux.', 'Servez avec une cuillère de crème et un peu de sucre.'], { parts: 4 }),
    R('gourde', 'Compote en gourde', G, '🍏', 1, [['compote', 1]], ['Toute prête : pratique pour le cartable ou le parc.'], { parts: 1, tags: ['enfants'] }),
    R('pancakes', 'Pancakes', G, '🥞', 25, [['farine', 30], ['lait', 40], ['oeufs', 0.25], ['sucre', 6], ['levure', 0.1], ['beurre', 4]],
      ['Mélangez farine, sucre et levure ; ajoutez l’œuf, le lait et le beurre fondu.', 'Versez de petites louches dans une poêle chaude.', 'Retournez quand des bulles apparaissent.'], { parts: 8, tags: ['enfants'] })
  ];
  root.Gourmand = { INGREDIENTS, RECETTES };
})(typeof window !== 'undefined' ? window : globalThis);
