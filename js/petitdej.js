/* Budgétable — petits-déjeuners : équilibrés, sportifs, gourmands, salés, express, pour les enfants.
 * Quantités pour UNE personne (parts : 1), sauf mention contraire ; la liste de courses multiplie par le nombre de parts.
 * Les produits manquants au catalogue s'ajoutent ici, avec leur nutrition pour 100 g (même format que catalogue.js) :
 * [kcal, AG saturés, sucres, sel, fibres, protéines, fruit ou légume (1/0)].
 */
(function (root) {
  'use strict';
  const INGREDIENTS = [
    { id: 'graines_chia', nom: 'Graines de chia', rayon: 'Épicerie', unite: 'g', cond: 150, condLabel: 'sachet 150 g', prixDemo: 2.9, groupe: 'A', tags: [] },
    { id: 'muesli', nom: 'Muesli', rayon: 'Épicerie sucrée', unite: 'g', cond: 500, condLabel: 'paquet 500 g', prixDemo: 2.4, groupe: 'F', tags: ['gluten', 'fruits_coque'] },
    { id: 'proteine_poudre', nom: 'Protéine en poudre (whey)', rayon: 'Épicerie', unite: 'g', cond: 500, condLabel: 'pot 500 g', prixDemo: 14.9, groupe: 'A', tags: ['lait', 'animal'] }
  ];
  const NUTRITION = {
    graines_chia: [490, 3.3, 0, 0.02, 34, 17, 0],
    muesli: [370, 1.5, 15, 0.1, 8, 9, 0],
    proteine_poudre: [380, 2, 5, 0.5, 0, 75, 0]
  };
  const MOTS = [[['chia', 'graines de chia'], 'graines_chia'], [['muesli', 'muesli croustillant'], 'muesli'], [['whey', 'proteine en poudre', 'proteines en poudre', 'poudre de proteine'], 'proteine_poudre']];
  const R = (id, nom, emoji, temps, ing, etapes, extra = {}) => ({ id: 'pd-' + id, nom, type: 'petitdej', emoji, temps, ing, etapes, parts: 1, ...extra });
  const RECETTES = [
    // ——— équilibrés ———
    R('bol-fromage-blanc', 'Bol fromage blanc, avoine et fruits rouges', '🥣', 5, [['fromage_blanc', 150], ['flocons_avoine', 30], ['fruits_rouges', 60], ['miel', 8]],
      ['Versez le fromage blanc dans un bol.', 'Ajoutez les flocons d’avoine et les fruits rouges (décongelés la veille au frigo, ou tels quels).', 'Un filet de miel, et c’est prêt.'], { tags: ['equilibre', 'express'] }),
    R('porridge-pomme', 'Porridge pomme-cannelle', '🍎', 10, [['flocons_avoine', 45], ['lait', 200], ['pomme', 100], ['epices', 0.5], ['miel', 5]],
      ['Faites chauffer le lait avec les flocons à feu doux, 5 min en remuant.', 'Ajoutez la pomme en petits dés et une pincée de cannelle.', 'Sucrez d’un peu de miel. Se fait aussi au micro-ondes : 2 min, on remue, 1 min.'], { tags: ['equilibre'] }),
    R('overnight-oats', 'Overnight oats aux fruits rouges', '🫙', 5, [['flocons_avoine', 40], ['yaourt', 100], ['lait', 80], ['graines_chia', 10], ['fruits_rouges', 50]],
      ['La veille : mélangez flocons, yaourt, lait et graines de chia dans un bocal.', 'Fermez et laissez une nuit au frigo.', 'Le matin, ajoutez les fruits rouges. À emporter facilement.'], { tags: ['equilibre', 'express'] }),
    R('tartines-completes', 'Tartines de pain complet, kiwi et lait', '🥝', 5, [['pain_complet', 60], ['beurre', 8], ['confiture', 15], ['kiwi', 1], ['lait', 200]],
      ['Faites griller le pain complet si vous aimez.', 'Beurrez finement, ajoutez un peu de confiture.', 'Un kiwi et un bol de lait (ou un café au lait) pour compléter.'], { tags: ['equilibre', 'express', 'enfants'] }),
    R('yaourt-poire-noix', 'Yaourt, poire et noix', '🍐', 5, [['yaourt', 125], ['poire', 120], ['noix', 10], ['flocons_avoine', 20], ['miel', 5]],
      ['Coupez la poire en morceaux.', 'Dans un bol : yaourt, poire, flocons et noix concassées.', 'Un filet de miel par-dessus.'], { tags: ['equilibre', 'express'] }),
    R('muesli-banane', 'Muesli, lait et banane', '🍌', 3, [['muesli', 50], ['lait', 200], ['banane', 80]],
      ['Versez le muesli dans un bol, ajoutez le lait froid ou chaud.', 'Coupez la banane en rondelles par-dessus.'], { tags: ['equilibre', 'express', 'enfants'] }),
    R('pudding-chia', 'Pudding de chia à la mangue', '🥭', 5, [['graines_chia', 25], ['lait_vegetal', 150], ['mangue', 0.25], ['sirop_erable', 5]],
      ['La veille : mélangez les graines de chia, le lait végétal et le sirop dans un pot.', 'Remuez à nouveau après 10 min (pour éviter les grumeaux), puis une nuit au frigo.', 'Le matin, ajoutez la mangue en dés.'], { tags: ['equilibre'] }),
    R('smoothie-bowl', 'Smoothie bowl banane et fruits rouges', '🍓', 10, [['banane', 100], ['fruits_rouges', 80], ['yaourt', 100], ['flocons_avoine', 20], ['coco_rapee', 5]],
      ['Mixez la banane, les fruits rouges et le yaourt : la texture doit être épaisse.', 'Versez dans un bol.', 'Parsemez de flocons d’avoine et de noix de coco râpée.'], { tags: ['equilibre'] }),
    R('tartine-avocat', 'Tartine avocat et œuf', '🥑', 10, [['pain_complet', 60], ['avocat', 0.5], ['oeufs', 1], ['citron', 0.1]],
      ['Faites cuire l’œuf 6 min dans l’eau bouillante (mollet) ou au plat.', 'Écrasez l’avocat avec un filet de citron, sel et poivre.', 'Tartinez le pain grillé, posez l’œuf dessus.'], { tags: ['equilibre', 'sale', 'sportif'] }),
    R('cereales-lait', 'Céréales, lait et fruit', '🥣', 2, [['flocons_mais', 35], ['lait', 200], ['pomme', 120]],
      ['Céréales et lait dans un bol, un fruit à croquer à côté.', 'Préférez des céréales peu sucrées : regardez le Nutri-Score sur la boîte.'], { tags: ['express', 'enfants'] }),
    // ——— sportifs ———
    R('omelette-epinards', 'Omelette protéinée aux épinards', '🍳', 10, [['oeufs', 3], ['epinards', 60], ['emmental', 15], ['pain_complet', 50]],
      ['Faites revenir les épinards 2 min dans une poêle.', 'Battez les œufs, salez, poivrez, versez sur les épinards.', 'Parsemez de fromage, pliez l’omelette quand elle est prise.', 'Avec une tranche de pain complet.'], { tags: ['sportif', 'sale'] }),
    R('pancakes-proteines', 'Pancakes protéinés avoine-banane', '🥞', 15, [['flocons_avoine', 50], ['oeufs', 1], ['fromage_blanc', 100], ['banane', 60], ['levure', 0.05]],
      ['Mixez les flocons, l’œuf, le fromage blanc, la banane et une pincée de levure.', 'Versez de petites louches dans une poêle chaude légèrement huilée.', 'Retournez quand des bulles apparaissent, 1 à 2 min par face.'], { tags: ['sportif'] }),
    R('shaker-banane', 'Shake banane, avoine et cacahuète', '🥤', 5, [['lait', 250], ['banane', 100], ['flocons_avoine', 30], ['cacahuetes', 15]],
      ['Mixez tout jusqu’à ce que ce soit bien lisse.', 'À boire tout de suite, idéal avant ou après une séance. Avec du beurre de cacahuète, c’est encore plus onctueux.'], { tags: ['sportif', 'express'] }),
    R('bol-skyr', 'Bol skyr, amandes et fruits rouges', '💪', 5, [['fromage_blanc', 200], ['flocons_avoine', 40], ['amandes', 15], ['fruits_rouges', 60], ['miel', 5]],
      ['Versez le skyr (ou du fromage blanc 0 %) dans un bol.', 'Ajoutez les flocons, les fruits rouges et les amandes concassées.', 'Environ 30 g de protéines, sans poudre.'], { tags: ['sportif', 'express'] }),
    R('oeufs-saumon', 'Œufs brouillés au saumon fumé', '🐟', 10, [['oeufs', 3], ['saumon_fume', 40], ['pain_complet', 60], ['beurre', 5]],
      ['Battez les œufs avec sel et poivre.', 'Faites-les cuire à feu doux dans le beurre en remuant sans cesse : ils doivent rester crémeux.', 'Hors du feu, ajoutez le saumon en lanières. Avec du pain complet grillé.'], { tags: ['sportif', 'sale'] }),
    R('porridge-proteine', 'Porridge protéiné', '🏋️', 10, [['flocons_avoine', 60], ['lait', 250], ['proteine_poudre', 25], ['banane', 60], ['cacahuetes', 10]],
      ['Faites cuire les flocons dans le lait 5 min à feu doux.', 'Hors du feu, ajoutez la protéine en poudre en remuant bien.', 'Garnissez de banane et de cacahuètes concassées.'], { tags: ['sportif'] }),
    R('tofu-brouille', 'Tofu brouillé aux tomates cerises', '🌱', 10, [['tofu', 120], ['tomate_cerise', 60], ['epices', 0.5], ['pain_complet', 60], ['huile_olive', 5]],
      ['Émiettez le tofu à la fourchette.', 'Faites-le revenir 5 min dans l’huile avec une pincée de curcuma, sel et poivre.', 'Ajoutez les tomates cerises coupées en deux. Avec du pain grillé : 100 % végétal.'], { tags: ['sportif', 'sale'] }),
    // ——— gourmands ———
    R('pancakes-erable', 'Pancakes au sirop d’érable', '🥞', 20, [['farine', 40], ['lait', 60], ['oeufs', 0.5], ['sucre', 6], ['levure', 0.1], ['beurre', 5], ['sirop_erable', 15]],
      ['Mélangez farine, sucre et levure ; ajoutez l’œuf, le lait et le beurre fondu.', 'Versez de petites louches dans une poêle chaude.', 'Retournez quand des bulles apparaissent. Servez avec du sirop d’érable.'], { tags: ['gourmand', 'enfants'] }),
    R('pain-perdu-brioche', 'Pain perdu brioché aux fruits rouges', '🍞', 15, [['brioche', 80], ['oeufs', 0.5], ['lait', 60], ['sucre', 8], ['beurre', 5], ['fruits_rouges', 40]],
      ['Battez l’œuf, le lait et le sucre dans une assiette creuse.', 'Trempez les tranches de brioche des deux côtés.', 'Dorez-les au beurre, 2 min par face. Servez avec les fruits rouges.'], { tags: ['gourmand'] }),
    R('crepes-tartiner', 'Crêpes à la pâte à tartiner', '🥞', 25, [['farine', 30], ['oeufs', 0.5], ['lait', 60], ['beurre', 5], ['pate_tartiner', 20]],
      ['Mélangez la farine et les œufs, ajoutez le lait petit à petit, puis le beurre fondu.', 'Faites cuire les crêpes dans une poêle chaude, 1 min par face.', 'Tartinez et roulez. Un dimanche matin, ça se mérite !'], { tags: ['gourmand', 'enfants'] }),
    R('gaufres-fraises', 'Gaufres aux fraises', '🧇', 25, [['farine', 30], ['lait', 50], ['oeufs', 0.33], ['beurre', 10], ['sucre', 8], ['levure', 0.1], ['fraises', 60]],
      ['Mélangez farine, levure et sucre, ajoutez les œufs, le lait puis le beurre fondu.', 'Cuisez dans le gaufrier bien chaud, 3 à 4 min.', 'Servez avec les fraises coupées.'], { tags: ['gourmand'], equip: ['gaufrier'] }),
    R('brioche-chocolat', 'Brioche et chocolat chaud', '☕', 5, [['brioche', 60], ['beurre', 8], ['confiture', 15], ['lait', 250], ['chocolat_poudre', 15]],
      ['Faites chauffer le lait, ajoutez le chocolat en poudre en fouettant.', 'Tranches de brioche beurrées ou à la confiture à côté.'], { tags: ['gourmand', 'enfants', 'express'] }),
    R('bowl-cake', 'Bowl cake banane-chocolat', '🧁', 5, [['flocons_avoine', 40], ['oeufs', 1], ['banane', 60], ['lait', 40], ['chocolat', 10], ['levure', 0.05]],
      ['Écrasez la banane dans un grand bol, ajoutez l’œuf, le lait, les flocons et la levure.', 'Enfoncez deux carrés de chocolat au milieu.', 'Micro-ondes 2 min à 2 min 30 : il gonfle comme un gâteau.'], { tags: ['gourmand', 'express'], equip: ['micro'] }),
    R('petit-dej-francais', 'Tartines beurre-confiture et chocolat chaud', '🥖', 5, [['pain', 0.25], ['beurre', 10], ['confiture', 20], ['lait', 250], ['chocolat_poudre', 15]],
      ['Coupez la baguette en deux dans la longueur, beurrez, ajoutez la confiture.', 'Un bol de chocolat chaud pour tremper : le classique.'], { tags: ['gourmand', 'enfants', 'express'] }),
    // ——— salés ———
    R('oeufs-coque', 'Œufs à la coque et mouillettes', '🥚', 8, [['oeufs', 2], ['pain', 0.25], ['beurre', 8]],
      ['Plongez les œufs dans l’eau bouillante, 3 min tout pile.', 'Coupez le pain beurré en mouillettes.', 'Décalottez et trempez !'], { tags: ['sale', 'enfants', 'express'] }),
    R('croque-matin', 'Croque-monsieur du matin', '🥪', 10, [['pain_mie', 60], ['jambon', 40], ['emmental', 20], ['beurre', 5]],
      ['Beurrez deux tranches de pain de mie à l’extérieur.', 'Garnissez de jambon et de fromage.', 'Dorez à la poêle 3 min par face, ou 5 min au four.'], { tags: ['sale', 'enfants'] }),
    R('tartine-saumon', 'Tartines fromage frais et saumon fumé', '🐟', 5, [['pain_complet', 60], ['fromage_frais', 25], ['saumon_fume', 30], ['citron', 0.1]],
      ['Tartinez le pain complet de fromage frais.', 'Posez le saumon fumé, un filet de citron et du poivre.'], { tags: ['sale', 'express', 'sportif'] }),
    R('assiette-salee', 'Assiette salée : fromage, jambon et tomates', '🧀', 5, [['pain_complet', 50], ['comte', 30], ['jambon', 40], ['tomate_cerise', 60]],
      ['Disposez sur une assiette le pain, le fromage en lamelles, le jambon et les tomates cerises.', 'Le petit-déjeuner « à la nordique », qui tient jusqu’à midi.'], { tags: ['sale', 'express'] })
  ];
  root.PetitDej = { INGREDIENTS, NUTRITION, MOTS, RECETTES };
})(typeof window !== 'undefined' ? window : globalThis);
