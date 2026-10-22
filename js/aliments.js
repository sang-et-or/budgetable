/* Budgétable — aliments du quotidien à ajouter au carnet du jour (en plus des repas du planning).
 * Valeurs moyennes PAR PORTION, arrondies d'après les tables de composition françaises (Ciqual) :
 * [id, nom, portion, moment, kcal, protéines g, fibres g, sucres g, graisses saturées g, sel g, fruits et légumes g]
 */
(function (root) {
  'use strict';
  const L = [
    // boissons
    ['cafe', 'Café noir', '1 tasse', 'boisson', 2, 0.3, 0, 0, 0, 0, 0],
    ['cafe_lait', 'Café au lait', '1 bol (250 ml)', 'boisson', 115, 7, 0, 11, 2.5, 0.25, 0],
    ['the', 'Thé ou infusion', '1 tasse', 'boisson', 2, 0, 0, 0, 0, 0, 0],
    ['sucre_morceau', 'Sucre dans le café ou le thé', '1 morceau', 'boisson', 20, 0, 0, 5, 0, 0, 0],
    ['jus_orange', 'Jus d’orange', '1 verre (200 ml)', 'boisson', 90, 1.4, 0.4, 18, 0, 0, 0],
    ['soda', 'Soda', '1 canette (33 cl)', 'boisson', 140, 0, 0, 35, 0, 0.05, 0],
    ['soda_zero', 'Soda zéro', '1 canette (33 cl)', 'boisson', 2, 0, 0, 0, 0, 0.05, 0],
    ['sirop', 'Sirop à l’eau', '1 verre', 'boisson', 60, 0, 0, 15, 0, 0, 0],
    ['lait_verre', 'Lait demi-écrémé', '1 verre (200 ml)', 'boisson', 92, 6.6, 0, 9.6, 2, 0.2, 0],
    ['chocolat_chaud', 'Chocolat chaud', '1 bol', 'boisson', 190, 8, 1.5, 25, 4, 0.3, 0],
    ['smoothie', 'Smoothie aux fruits', '1 verre (250 ml)', 'boisson', 130, 1.5, 2, 25, 0, 0, 150],
    ['biere', 'Bière', '1 demi (25 cl)', 'boisson', 105, 0.8, 0, 2, 0, 0.02, 0],
    ['vin', 'Vin', '1 verre (12,5 cl)', 'boisson', 85, 0, 0, 0.8, 0, 0, 0],
    // petit-déjeuner
    ['pain', 'Pain blanc', '¼ de baguette (60 g)', 'petitdej', 160, 5.4, 1.8, 1.2, 0.2, 0.8, 0],
    ['pain_complet', 'Pain complet', '2 tranches (60 g)', 'petitdej', 150, 6, 4, 2, 0.3, 0.7, 0],
    ['biscottes', 'Biscottes', '3 biscottes', 'petitdej', 115, 3.4, 1.4, 1.5, 0.3, 0.4, 0],
    ['beurre', 'Beurre', '1 noisette (10 g)', 'petitdej', 75, 0.1, 0, 0, 5.4, 0, 0],
    ['confiture', 'Confiture', '1 cuillère à soupe', 'petitdej', 50, 0, 0.2, 12, 0, 0, 0],
    ['miel', 'Miel', '1 cuillère à café', 'petitdej', 30, 0, 0, 8, 0, 0, 0],
    ['pate_tartiner', 'Pâte à tartiner', '1 cuillère à soupe', 'petitdej', 108, 1.2, 0.7, 11, 2, 0.02, 0],
    ['cereales', 'Céréales', '1 bol (40 g)', 'petitdej', 150, 3, 2, 10, 0.3, 0.3, 0],
    ['cereales_choc', 'Céréales chocolatées', '1 bol (40 g)', 'petitdej', 160, 3, 2, 14, 1, 0.2, 0],
    ['muesli', 'Muesli', '1 bol (50 g)', 'petitdej', 185, 5, 4, 10, 0.8, 0.05, 0],
    ['flocons', 'Flocons d’avoine', '40 g', 'petitdej', 150, 5, 4, 0.4, 0.5, 0, 0],
    ['croissant', 'Croissant', '1', 'petitdej', 230, 4.5, 1, 6, 8, 0.6, 0],
    ['pain_choc', 'Pain au chocolat', '1', 'petitdej', 300, 5, 2, 10, 9, 0.6, 0],
    ['brioche', 'Brioche', '2 tranches', 'petitdej', 180, 4.5, 1, 7, 3, 0.4, 0],
    ['oeuf', 'Œuf (coque, dur ou au plat)', '1 œuf', 'petitdej', 80, 6.5, 0, 0.2, 1.6, 0.18, 0],
    ['yaourt_nature', 'Yaourt nature', '1 pot', 'petitdej', 60, 4.5, 0, 5.5, 1.2, 0.1, 0],
    ['yaourt_fruits', 'Yaourt aux fruits', '1 pot', 'petitdej', 120, 4, 0, 16, 1.5, 0.1, 0],
    ['fromage_blanc', 'Fromage blanc', '100 g', 'petitdej', 75, 7.5, 0, 4, 2, 0.1, 0],
    ['fromage', 'Fromage', '1 portion (30 g)', 'petitdej', 110, 7, 0, 0, 5.5, 0.5, 0],
    ['jambon', 'Jambon blanc', '1 tranche', 'petitdej', 45, 8, 0, 0.3, 0.4, 0.8, 0],
    // fruits
    ['pomme', 'Pomme', '1 fruit', 'collation', 80, 0.4, 2.4, 16, 0, 0, 150],
    ['banane', 'Banane', '1 fruit', 'collation', 105, 1.2, 2.5, 18, 0.1, 0, 120],
    ['orange', 'Orange', '1 fruit', 'collation', 70, 1.3, 3, 13, 0, 0, 150],
    ['poire', 'Poire', '1 fruit', 'collation', 85, 0.5, 4, 15, 0, 0, 150],
    ['clementines', 'Clémentines', '2 fruits', 'collation', 70, 1, 2.5, 14, 0, 0, 140],
    ['raisin', 'Raisin', '1 bol (125 g)', 'collation', 85, 0.8, 1.1, 20, 0, 0, 125],
    ['fraises', 'Fraises', '1 bol (150 g)', 'collation', 50, 1, 3, 9, 0, 0, 150],
    ['compote', 'Compote', '1 gourde ou pot', 'collation', 70, 0.2, 1.4, 14, 0, 0, 90],
    ['fruits_secs', 'Fruits secs', '1 poignée (30 g)', 'collation', 80, 1, 2, 18, 0, 0, 0],
    ['amandes', 'Amandes ou noix', '1 poignée (30 g)', 'collation', 175, 6, 3.7, 1.3, 1, 0, 0],
    // collations et douceurs
    ['biscuits', 'Biscuits secs', '3 biscuits', 'collation', 140, 2, 0.8, 7, 2.5, 0.2, 0],
    ['biscuits_choc', 'Biscuits au chocolat', '3 biscuits', 'collation', 200, 2.5, 1.5, 12, 4.5, 0.2, 0],
    ['chocolat_noir', 'Chocolat noir', '2 carrés (20 g)', 'collation', 110, 1.5, 2, 6, 4, 0, 0],
    ['chocolat_lait', 'Chocolat au lait', '2 carrés (20 g)', 'collation', 110, 1.5, 0.5, 11, 3.6, 0.04, 0],
    ['barre_choc', 'Barre chocolatée', '1 barre', 'collation', 230, 2.5, 1, 25, 6, 0.2, 0],
    ['bonbons', 'Bonbons', '1 poignée (30 g)', 'collation', 100, 1.5, 0, 17, 0, 0, 0],
    ['madeleine', 'Madeleine', '1', 'collation', 110, 1.5, 0.3, 7, 3, 0.1, 0],
    ['gateau', 'Part de gâteau', '1 part', 'collation', 300, 4, 1, 25, 7, 0.3, 0],
    ['glace', 'Glace', '2 boules', 'collation', 180, 3, 0.5, 20, 6, 0.1, 0],
    ['chips', 'Chips', '1 petit paquet (30 g)', 'collation', 160, 2, 1.3, 0.2, 1.5, 0.4, 0],
    ['aperitif', 'Biscuits apéritif', '1 poignée', 'collation', 140, 2.5, 0.8, 1, 2, 0.6, 0],
    ['cacahuetes', 'Cacahuètes', '1 poignée (30 g)', 'collation', 180, 7.5, 2.3, 1.2, 2.5, 0.3, 0],
    // repas pris dehors
    ['sandwich_jb', 'Sandwich jambon-beurre', '1 sandwich', 'dehors', 430, 20, 2.5, 3, 8, 2.5, 0],
    ['sandwich_poulet', 'Sandwich poulet crudités', '1 sandwich', 'dehors', 450, 22, 3, 4, 3, 2, 40],
    ['burger', 'Burger', '1 burger', 'dehors', 500, 26, 2, 7, 10, 2.2, 20],
    ['frites', 'Frites', '1 portion moyenne', 'dehors', 340, 4, 4, 0.3, 2, 0.5, 0],
    ['pizza', 'Pizza', '2 parts', 'dehors', 540, 22, 3, 5, 9, 2.6, 40],
    ['kebab', 'Kebab et frites', '1 menu', 'dehors', 850, 35, 5, 6, 12, 4, 40],
    ['salade_composee', 'Salade composée', '1 grande assiette', 'dehors', 350, 15, 5, 5, 4, 1.5, 200],
    ['sushis', 'Sushis', '8 pièces', 'dehors', 350, 14, 2, 8, 1, 2, 0],
    ['quiche', 'Part de quiche', '1 part', 'dehors', 330, 10, 1, 2, 10, 1, 0],
    ['croque', 'Croque-monsieur', '1', 'dehors', 350, 18, 2, 4, 9, 2, 0],
    ['plat_prepare', 'Plat préparé', '1 barquette (300 g)', 'dehors', 400, 18, 4, 6, 6, 2.5, 80],
    ['soupe', 'Soupe de légumes', '1 bol', 'dehors', 90, 2, 3, 5, 0.5, 1.2, 200],
    ['cantine', 'Repas à la cantine ou au self', '1 plateau', 'dehors', 700, 30, 6, 15, 8, 3, 200]
  ];
  const ALIMENTS = L.map(([id, nom, portion, moment, kcal, prot, fibres, sucres, ags, sel, fl]) => ({ id, nom, portion, moment, kcal, prot, fibres, sucres, ags, sel, fl }));
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();
  function chercher(texte, n = 8) {
    const t = norm(texte);
    if (t.length < 2) return [];
    const mots = t.split(' ');
    return ALIMENTS.filter((a) => { const x = norm(a.nom + ' ' + a.portion); return mots.every((m) => x.includes(m)); }).slice(0, n);
  }
  const api = { ALIMENTS, chercher, MOMENTS: { petitdej: 'Petit-déjeuner', collation: 'Collations et fruits', boisson: 'Boissons', dehors: 'Repas pris dehors' } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Aliments = api;
})(typeof window !== 'undefined' ? window : globalThis);
