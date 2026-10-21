/* Budgétable – pont entre le site Budgétable et l'extension.
 * Sur le site Budgétable uniquement : le bouton « Envoyer vers l'extension » transmet la liste de courses
 * directement à l'extension (plus de copier-coller). La liste reste sur cet ordinateur. */
(function () {
  if (window.__budgetablePont) return;
  window.__budgetablePont = true;
  const S = window.BudgetableStockage;
  // signale au site que l'extension est installée (sa version)
  const version = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : 'test';
  const signaler = () => { if (document.documentElement) { document.documentElement.dataset.budgetableExtension = version; return true; } return false; };
  if (!signaler()) document.addEventListener('readystatechange', signaler, { once: true });
  window.addEventListener('message', async (ev) => {
    if (ev.source !== window || ev.origin !== location.origin || !ev.data || ev.data.type !== 'budgetable:liste') return;
    try {
      const liste = S.lireExport(ev.data.texte);
      await S.ecrire('liste', liste);
      await S.ecrire('courant', 0);
      window.postMessage({ type: 'budgetable:liste-recue', n: liste.articles.length }, location.origin);
    } catch (e) {
      window.postMessage({ type: 'budgetable:liste-erreur', message: e.message || 'Liste illisible.' }, location.origin);
    }
  });
})();
