/* Budgétable – stockage local de l'extension (sur l'ordinateur de l'utilisateur, jamais envoyé ailleurs). */
(function (root) {
  const aChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  async function lire(cle, defaut) {
    try {
      if (aChrome) { const r = await chrome.storage.local.get(cle); return r[cle] ?? defaut; }
      const v = localStorage.getItem('budgetable-ext:' + cle);
      return v ? JSON.parse(v) : defaut;
    } catch (e) { return defaut; }
  }
  async function ecrire(cle, valeur) {
    try {
      if (aChrome) await chrome.storage.local.set({ [cle]: valeur });
      else localStorage.setItem('budgetable-ext:' + cle, JSON.stringify(valeur));
    } catch (e) { /* stockage indisponible */ }
  }
  /** Lit une liste exportée par Budgétable (texte commençant par BUDGETABLE1:). */
  function lireExport(texte) {
    const t = String(texte || '').trim();
    if (!t.startsWith('BUDGETABLE1:')) throw new Error('Ce texte ne vient pas du bouton « Envoyer vers l’extension » de Budgétable.');
    const d = JSON.parse(t.slice('BUDGETABLE1:'.length));
    if (!Array.isArray(d.articles) || !d.articles.length) throw new Error('La liste est vide.');
    d.articles = d.articles.filter((a) => a && a.id && a.nom && a.recherche).map((a) => ({
      id: String(a.id), nom: String(a.nom).slice(0, 80), recherche: String(a.recherche).slice(0, 80),
      besoin: String(a.besoin || '').slice(0, 40), unite: ['g', 'ml', 'pièce'].includes(a.unite) ? a.unite : null, conditionnements: Math.max(1, Number(a.conditionnements) || 1), condLabel: String(a.condLabel || '').slice(0, 40)
    }));
    return d;
  }
  const api = { lire, ecrire, lireExport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetableStockage = api;
})(typeof window !== 'undefined' ? window : globalThis);
