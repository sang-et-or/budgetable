/* Budgétable — le commis de cuisine intégré : des réponses toutes prêtes, sans IA ni connexion.
 * Il comprend les questions courantes (ingrédient manquant, cuisson, version enfants, restes,
 * quantités pour un autre nombre de personnes) à partir de mots-clés, et répond avec la recette
 * en cours. Il ne propose jamais un remplacement contraire aux allergies ou au régime du foyer.
 */
(function (root) {
  'use strict';
  // remplacements : [id du catalogue ou null, texte, allergènes / régimes du texte libre]
  const R = (id, texte, tags) => ({ id, texte, tags: tags || [] });
  const REMPLACER = {
    creme: [R('lait', 'du lait avec une noisette de beurre (sauce un peu plus légère)'), R('yaourt', 'du yaourt nature, ajouté hors du feu pour qu’il ne tranche pas'), R('lait_coco', 'du lait de coco, pour un goût plus doux et exotique'), R(null, 'du fromage frais ou de la ricotta', ['lait', 'lactose', 'animal'])],
    lait: [R('creme', 'de la crème allongée d’eau (moitié-moitié)'), R(null, 'une boisson végétale (avoine, soja, amande)', ['gluten', 'soja', 'fruits_coque']), R(null, 'de l’eau avec une noisette de beurre, pour une purée', ['lait', 'animal'])],
    beurre: [R('huile_olive', 'de l’huile (un peu moins : environ 80 % de la quantité)'), R('creme', 'de la crème, pour une sauce')],
    oeufs: [R(null, 'pour lier une farce ou une sauce : 1 cuillère à soupe de fécule de maïs et 3 d’eau par œuf'), R('banane', 'dans un gâteau : ½ banane bien mûre écrasée par œuf'), R('yaourt', 'dans un gâteau : 3 cuillères à soupe de yaourt par œuf')],
    emmental: [R('mozzarella', 'de la mozzarella'), R('feta', 'de la feta émiettée'), R(null, 'de la chapelure avec un filet d’huile, pour gratiner', ['gluten'])],
    mozzarella: [R('emmental', 'de l’emmental râpé'), R('feta', 'de la feta')],
    feta: [R(null, 'du fromage de chèvre', ['lait', 'animal']), R('mozzarella', 'de la mozzarella avec une pincée de sel')],
    farine: [R(null, 'de la fécule de maïs, deux fois moins, pour épaissir une sauce')],
    pates: [R('riz', 'du riz'), R('semoule', 'de la semoule'), R('pomme_de_terre', 'des pommes de terre en dés')],
    riz: [R('semoule', 'de la semoule (prête en 5 minutes)'), R('quinoa', 'du quinoa'), R('pates', 'des petites pâtes')],
    semoule: [R('riz', 'du riz'), R('quinoa', 'du quinoa')],
    quinoa: [R('semoule', 'de la semoule'), R('riz', 'du riz')],
    pomme_de_terre: [R('patate_douce', 'de la patate douce'), R('pates', 'des pâtes'), R('riz', 'du riz')],
    tomates_concassees: [R('tomate', 'des tomates fraîches en morceaux, avec une pincée de sucre et 15 min de cuisson en plus'), R(null, 'du concentré de tomate allongé d’eau')],
    tomate: [R('tomates_concassees', 'des tomates en boîte')],
    oignon: [R('poireau', 'du poireau émincé'), R(null, 'de l’échalote'), R(null, 'une pincée d’oignon en poudre')],
    ail: [R(null, 'de l’ail en poudre : un quart de cuillère à café par gousse'), R('oignon', 'un peu plus d’oignon')],
    bouillon: [R(null, 'de l’eau salée avec du thym et du laurier'), R('sauce_soja', 'une cuillère à soupe de sauce soja dans l’eau')],
    citron: [R(null, 'un trait de vinaigre (deux fois moins)'), R(null, 'du citron vert')],
    persil: [R(null, 'de la ciboulette, de la coriandre ou du basilic'), R(null, 'des herbes séchées (une cuillère à café)')],
    poulet_filet: [R('cuisses_poulet', 'des cuisses de poulet désossées'), R(null, 'de la dinde', ['viande', 'animal']), R('pois_chiches', 'des pois chiches, pour une version végétarienne'), R('tofu', 'du tofu')],
    cuisses_poulet: [R('poulet_filet', 'des filets de poulet (cuisson plus courte)')],
    boeuf_hache: [R('saucisse', 'de la chair à saucisse'), R('lentilles_vertes', 'des lentilles cuites, pour une version végétarienne')],
    lardons: [R('jambon', 'du jambon en dés'), R(null, 'du bacon', ['viande', 'porc', 'animal']), R('saucisse', 'de la saucisse en rondelles')],
    jambon: [R('lardons', 'des lardons'), R('poulet_filet', 'un reste de poulet')],
    saucisse: [R('lardons', 'des lardons'), R('boeuf_hache', 'du bœuf haché bien assaisonné')],
    saumon: [R('colin', 'un filet de poisson blanc'), R('thon', 'du thon en boîte')],
    colin: [R('saumon', 'du saumon'), R(null, 'du cabillaud, du merlu ou du lieu', ['poisson', 'animal'])],
    thon: [R('saumon', 'du saumon cuit émietté'), R(null, 'des sardines en boîte', ['poisson', 'animal']), R('oeufs', 'des œufs durs')],
    lait_coco: [R('creme', 'de la crème'), R('yaourt', 'du yaourt nature, hors du feu')],
    curry: [R('cumin', 'du cumin avec un peu de paprika')],
    cumin: [R('curry', 'du curry'), R('paprika', 'du paprika')],
    paprika: [R(null, 'du piment doux'), R('cumin', 'du cumin')],
    moutarde: [R(null, 'un filet de vinaigre et une pincée de sel')],
    sauce_soja: [R(null, 'une pincée de sel et un peu de bouillon')],
    huile_olive: [R(null, 'de l’huile de tournesol ou de colza'), R('beurre', 'du beurre (à feu moyen)')],
    pois_chiches: [R('haricots_blancs', 'des haricots blancs'), R('haricots_rouges', 'des haricots rouges')],
    haricots_rouges: [R('haricots_blancs', 'des haricots blancs'), R('pois_chiches', 'des pois chiches')],
    haricots_blancs: [R('pois_chiches', 'des pois chiches'), R('haricots_rouges', 'des haricots rouges')],
    lentilles_corail: [R('lentilles_vertes', 'des lentilles vertes (10 min de cuisson en plus)'), R('pois_casses', 'des pois cassés')],
    lentilles_vertes: [R('lentilles_corail', 'des lentilles corail (cuisent plus vite, plus fondantes)')],
    mais: [R('petits_pois', 'des petits pois')],
    petits_pois: [R('haricots_verts', 'des haricots verts'), R('mais', 'du maïs')],
    tortillas: [R('pain_mie', 'du pain de mie aplati au rouleau')],
    pain: [R('pain_mie', 'du pain de mie grillé')],
    pain_mie: [R('pain', 'de la baguette')],
    sucre: [R('miel', 'du miel (un peu moins)'), R(null, 'de la cassonade')],
    chocolat: [R('cacao', 'du cacao en poudre avec un peu de beurre')],
    levure: [R(null, 'un demi-sachet de bicarbonate avec un filet de citron'), R('oeufs', 'des blancs d’œufs montés en neige')],
    pate_brisee: [R(null, 'une pâte maison : 200 g de farine, 100 g de beurre froid, un peu d’eau', ['gluten', 'lait', 'animal'])]
  };
  const LEGUMES = ['courgette', 'carotte', 'poivron', 'brocoli', 'champignon', 'epinards', 'haricots_verts', 'poireau', 'aubergine', 'chou', 'courge'];
  const CUIT = {
    poulet_filet: 'Le poulet est cuit quand il n’est plus rose au centre et que le jus est clair (74 °C à cœur). Coupez le plus gros morceau pour vérifier.',
    cuisses_poulet: 'Les cuisses sont cuites quand le jus qui coule en piquant près de l’os est clair, sans trace rosée (environ 40 min au four à 200 °C).',
    boeuf_hache: 'La viande hachée doit être cuite à cœur : plus de rose au centre, surtout pour les enfants.',
    saucisse: 'Les saucisses sont cuites quand elles sont dorées et que l’intérieur n’est plus rose (environ 15 min à feu moyen).',
    saumon: 'Le saumon est cuit quand sa chair devient opaque et se détache en lamelles à la fourchette.',
    colin: 'Le poisson blanc est cuit quand il devient blanc nacré et s’effeuille facilement : 8 à 12 min suffisent, il sèche vite.',
    oeufs: 'Œuf mollet : 6 min dans l’eau bouillante, œuf dur : 10 min. En omelette, retirez du feu quand le dessus est encore un peu baveux.',
    pates: 'Les pâtes : goûtez-en une 1 min avant le temps indiqué sur le paquet. Elles doivent rester un peu fermes sous la dent.',
    riz: 'Le riz est prêt quand les grains sont tendres et que l’eau est absorbée (12 à 15 min) ; laissez-le reposer 5 min à couvert.',
    semoule: 'La semoule : versez le même volume d’eau bouillante, couvrez 5 min, puis égrainez à la fourchette.',
    quinoa: 'Le quinoa est cuit quand un petit germe blanc se détache des grains (12 à 15 min).',
    pomme_de_terre: 'Les pommes de terre sont cuites quand la pointe d’un couteau s’enfonce sans résistance.',
    lentilles_corail: 'Les lentilles corail sont prêtes quand elles se défont en purée (15 min environ).',
    lentilles_vertes: 'Les lentilles vertes sont cuites quand elles sont tendres mais gardent leur forme (25 min environ).',
    farine: 'Une pâte ou un gâteau est cuit quand la lame d’un couteau planté au centre ressort sèche.'
  };
  const PERISSABLE = ['poulet_filet', 'cuisses_poulet', 'saumon', 'colin', 'boeuf_hache'];
  const RESTES = [
    [['pates'], 'un gratin de pâtes (fromage râpé, 15 min au four) ou une omelette aux pâtes'],
    [['riz'], 'un riz sauté façon cantonais (œuf, petits pois, jambon), avec du riz bien froid'],
    [['pomme_de_terre'], 'des galettes de pommes de terre écrasées, ou une omelette'],
    [['poulet_filet', 'cuisses_poulet'], 'des wraps, une salade composée ou un gratin de pâtes au poulet'],
    [['boeuf_hache'], 'un hachis parmentier ou des pâtes à la bolognaise'],
    [['saumon', 'colin', 'thon'], 'des rillettes (poisson écrasé avec du fromage frais et du citron) ou des croquettes'],
    [['lentilles_corail', 'lentilles_vertes', 'pois_chiches', 'haricots_rouges'], 'une soupe mixée ou une salade le lendemain']
  ];
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const intention = (q) => {
    const t = norm(q);
    if (/\b(manque|pas de|plus de|remplac|sans|a la place|au lieu|substitu|j ai pas|n ai pas|n ai plus)/.test(t)) return 'remplacer';
    if (/\b(enfant|petit|bebe|gamin|fils|fille|epice|piquant)/.test(t)) return 'enfants';
    if (/\b(reste|lendemain|conserv|congel|garder|frigo)/.test(t)) return 'restes';
    if (/\b(cuit|cuisson|temps|four|degre|temperature|combien de temps|rose|cru)/.test(t)) return 'cuisson';
    if (/\b(personnes?|portions?|parts?|doubler|moitie|quantite|combien)/.test(t)) return 'quantites';
    return null;
  };

  /**
   * question (texte), rec (recette Budgétable), portions, profil, E (moteur) → réponse (texte)
   */
  function repondre(question, rec, portions, profil, E) {
    const t = norm(question);
    const interdit = (r) => (r.id ? !E.ING[r.id] || E.ingredientInterdit(E.ING[r.id], profil) : E.ingredientInterdit({ tags: r.tags }, profil));
    const ids = rec.ing.map(([id]) => id).filter((id) => E.ING[id] && !E.ING[id].perso);
    // ingrédient cité dans la question (de la recette d'abord)
    const nomsDe = (id) => [E.ING[id].nom, ...(({ creme: ['creme', 'crème fraîche'], oeufs: ['oeuf', 'oeufs'], pates: ['pate', 'pates', 'spaghetti', 'tagliatelle'], boeuf_hache: ['viande hachee', 'boeuf', 'steak hache'], tomates_concassees: ['tomates concassees', 'coulis', 'sauce tomate', 'tomate en boite'], poulet_filet: ['poulet'], emmental: ['fromage', 'gruyere', 'emmental'], huile_olive: ['huile'], lait_coco: ['lait de coco', 'coco'], pomme_de_terre: ['pomme de terre', 'pommes de terre', 'patate'] })[id] || [])].map(norm);
    const cite = (liste) => liste.map((id) => ({ id, pos: Math.min(...nomsDe(id).map((n) => { const k = t.indexOf(n.replace(/s$/, '')); return k < 0 ? Infinity : k; })) })).filter((x) => x.pos < Infinity).sort((a, b) => a.pos - b.pos)[0];
    const trouve = cite(ids) || cite(Object.keys(REMPLACER).filter((id) => E.ING[id]));
    let i = intention(question);
    if (!i && trouve) i = 'remplacer';

    if (i === 'remplacer') {
      const propose = (id) => {
        const l = (REMPLACER[id] || []).filter((r) => !interdit(r));
        if (LEGUMES.includes(id)) l.push({ texte: 'un autre légume : ' + LEGUMES.filter((x) => x !== id && E.ING[x]).slice(0, 4).map((x) => E.ING[x].nom.toLowerCase()).join(', ') + ' (les surgelés marchent très bien)' });
        return l;
      };
      if (trouve) {
        const l = propose(trouve.id);
        const nom = E.ING[trouve.id].nom.toLowerCase();
        if (!l.length) return `Pour remplacer ${nom}, je n’ai pas d’idée sûre qui respecte les contraintes de votre foyer. Le plat se fait souvent sans : goûtez et ajustez l’assaisonnement.`;
        return `Pas ${/^[aeiouyhœéè]/i.test(nom) ? 'd’' : 'de '}${nom} ? Vous pouvez mettre :\n${l.slice(0, 3).map((r) => '• ' + r.texte).join('\n')}${(profil.allergies || []).length ? '\nVérifiez toujours l’étiquette à cause des allergies du foyer.' : ''}`;
      }
      const lignes = ids.filter((id) => propose(id).length).slice(0, 5).map((id) => `• ${E.ING[id].nom} → ${propose(id)[0].texte}`);
      return lignes.length ? `Dites-moi quel ingrédient vous manque (par exemple « je n’ai pas de crème »). Pour cette recette :\n${lignes.join('\n')}` : 'Dites-moi quel ingrédient vous manque, par exemple « je n’ai pas de crème ».';
    }
    if (i === 'cuisson') {
      const l = ids.filter((id) => CUIT[id]).map((id) => '• ' + CUIT[id]);
      const leg = ids.some((id) => LEGUMES.includes(id)) ? ['• Les légumes sont prêts quand ils sont tendres sous la fourchette mais encore colorés.'] : [];
      return `Pour ${rec.nom.charAt(0).toLowerCase() + rec.nom.slice(1)} (environ ${rec.temps} min en tout) :\n${l.concat(leg).slice(0, 4).join('\n') || '• Suivez les temps de la recette et goûtez avant de servir.'}`;
    }
    if (i === 'enfants') {
      const l = [];
      if (ids.some((id) => ['curry', 'cumin', 'paprika'].includes(id))) l.push('Mettez la moitié des épices, ou servez-les à part pour les grands.');
      if (ids.some((id) => LEGUMES.includes(id))) l.push('Coupez les légumes tout petits, ou mixez-les dans la sauce : ils passent incognito.');
      if (ids.some((id) => ['saumon', 'colin'].includes(id))) l.push('Pour le poisson : en petits morceaux panés (farine, œuf, chapelure), c’est souvent un succès.');
      if (ids.includes('emmental') || !interdit({ id: 'emmental' })) l.push('Un peu de fromage râpé sur le dessus rassure les plus difficiles.');
      l.push('Servez la sauce à part et laissez-les participer : mélanger, saupoudrer le fromage, dresser.');
      return `Version enfants :\n${l.slice(0, 4).map((x) => '• ' + x).join('\n')}`;
    }
    if (i === 'restes') {
      const fragile = ids.some((id) => PERISSABLE.includes(id));
      const idees = RESTES.filter(([liste]) => liste.some((id) => ids.includes(id))).map(([, txt]) => txt);
      return `Pour les restes :\n• Au frigo dans une boîte fermée, moins de 2 h après le repas : à manger sous ${fragile ? '1 à 2 jours (volaille, poisson, viande hachée)' : '2 à 3 jours'}.\n• Réchauffez bien jusqu’à ce que ce soit très chaud, une seule fois.\n• La plupart des plats mijotés se congèlent 3 mois (pas les crudités ni les pommes de terre en morceaux).${idees.length ? '\n• Idée pour le lendemain : ' + idees.slice(0, 2).join(' ; ') + '.' : ''}`;
    }
    if (i === 'quantites') {
      const m = /(\d+)/.exec(t);
      const n = /doubl/.test(t) ? portions * 2 : /moitie/.test(t) ? Math.max(1, portions / 2) : m ? Math.min(30, +m[1]) : null;
      if (!n) return `La recette est prévue pour ${portions} portion${portions > 1 ? 's' : ''}. Dites-moi pour combien de personnes vous cuisinez, par exemple « pour 6 personnes ».`;
      const q = rec.ing.filter(([id]) => E.ING[id] && !E.ING[id].perso).map(([id, x]) => `• ${E.ING[id].nom} : ${E.ING[id].unite === 'pièce' ? Math.round(x * n * 4) / 4 : Math.round(x * n / 5) * 5 + ' ' + E.ING[id].unite}`);
      return `Pour ${n} personne${n > 1 ? 's' : ''} :\n${q.join('\n')}`;
    }
    return 'Je suis le commis de Budgétable. Je peux vous aider pour un ingrédient manquant (« je n’ai pas de crème »), la cuisson, une version pour les enfants, les restes, ou les quantités pour un autre nombre de personnes (« pour 6 personnes »).';
  }
  const api = { repondre, intention, REMPLACER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Commis = api;
})(typeof window !== 'undefined' ? window : globalThis);
