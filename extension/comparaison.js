/* Budgétable – répartition de la liste entre drives, à partir des prix RELEVÉS par l'utilisateur.
 * Pour chaque article, on prend le drive où il est le moins cher : cela donne un panier par drive.
 * On compare aussi avec « tout dans un seul drive » pour montrer l'économie. */
(function (root) {
  const r2 = (n) => Math.round(n * 100) / 100;
  /**
   * liste    : { articles: [{ id, nom, conditionnements }] }
   * releves  : { driveId: { articleId: { prix, titre, date, magasin } } }
   * fraisParDrive (optionnel) : { driveId: euros } frais de retrait
   */
  function repartir(liste, releves, fraisParDrive = {}) {
    const drives = Object.keys(releves).filter((d) => Object.keys(releves[d] || {}).length);
    const paniers = Object.fromEntries(drives.map((d) => [d, { articles: [], total: 0 }]));
    const sansPrix = [];
    for (const a of liste.articles) {
      let meilleur = null;
      for (const d of drives) {
        const r = releves[d][a.id];
        if (!r || r.prix == null) continue;
        const cout = r2(r.prix * (a.conditionnements || 1));
        if (!meilleur || cout < meilleur.cout) meilleur = { d, cout, r };
      }
      if (!meilleur) { sansPrix.push(a.nom); continue; }
      paniers[meilleur.d].articles.push({ id: a.id, nom: a.nom, produit: meilleur.r.titre, cout: meilleur.cout, date: meilleur.r.date });
      paniers[meilleur.d].total = r2(paniers[meilleur.d].total + meilleur.cout);
    }
    const utilises = drives.filter((d) => paniers[d].articles.length);
    const frais = r2(utilises.reduce((s, d) => s + (fraisParDrive[d] || 0), 0));
    const totalReparti = r2(utilises.reduce((s, d) => s + paniers[d].total, 0) + frais);
    // comparaison : tout acheter dans un seul drive (seulement les articles relevés partout)
    const communs = liste.articles.filter((a) => drives.every((d) => releves[d][a.id] && releves[d][a.id].prix != null));
    const unSeul = drives.map((d) => ({
      d, total: r2(communs.reduce((s, a) => s + releves[d][a.id].prix * (a.conditionnements || 1), 0) + (fraisParDrive[d] || 0))
    })).sort((x, y) => x.total - y.total);
    const repartiCommuns = r2(communs.reduce((s, a) => s + Math.min(...drives.map((d) => releves[d][a.id].prix * (a.conditionnements || 1))), 0) + frais);
    return {
      paniers: Object.fromEntries(utilises.map((d) => [d, paniers[d]])), frais, totalReparti, sansPrix,
      comparaison: communs.length ? { nbArticles: communs.length, meilleurSeul: unSeul[0], reparti: repartiCommuns, economie: r2(unSeul[0].total - repartiCommuns) } : null
    };
  }
  const api = { repartir };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetableComparaison = api;
})(typeof window !== 'undefined' ? window : globalThis);
