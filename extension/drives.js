/* Budgétable – drives reconnus par l'extension.
 * recherche : adresse de la recherche publique du site (null si elle dépend du magasin).
 * verifie   : adresse testée. Les autres sont à confirmer sur place. */
(function (root) {
  const DRIVES = [
    // Essais du 20/10/2026 sur les vrais sites (sans magasin choisi) :
    { id: 'carrefour', nom: 'Carrefour', hotes: ['www.carrefour.fr'], recherche: (q) => `https://www.carrefour.fr/s?q=${encodeURIComponent(q)}`, verifie: true, lectureVerifiee: true,
      note: 'Choisissez votre magasin sur le site : sans lui, Carrefour affiche des prix par défaut.' },
    { id: 'auchan', nom: 'Auchan', hotes: ['www.auchan.fr'], recherche: (q) => `https://www.auchan.fr/recherche?text=${encodeURIComponent(q)}`, verifie: true, lectureVerifiee: true,
      note: 'Choisissez votre drive avec « Choisir vos courses » en haut du site : les prix s’affichent ensuite.' },
    { id: 'leclerc', nom: 'E.Leclerc', hotes: ['www.e.leclerc'], suffixes: ['.leclercdrive.fr'], recherche: null, verifie: true, lectureVerifiee: true,
      // la recherche dépend du magasin : …/magasin-046201-046201-Loison/recherche.aspx?TexteRecherche=…
      rechercheDepuis: (loc, q) => { const m = loc.pathname.match(/\/(magasin-\d+-\d+-[^/.]+)/i); return m ? `${loc.origin}/${m[1]}/recherche.aspx?TexteRecherche=${encodeURIComponent(q)}` : null; },
      note: 'Choisissez votre drive sur leclercdrive.fr : la recherche se fait ensuite dans votre magasin.' },
    { id: 'intermarche', nom: 'Intermarché', hotes: ['www.intermarche.com'], recherche: (q) => `https://www.intermarche.com/recherche/${encodeURIComponent(q)}`, verifie: true, lectureVerifiee: true,
      note: 'Choisissez votre magasin sur le site (adresse ou ville) : les résultats s’affichent ensuite.' },
    { id: 'coursesu', nom: 'Courses U', hotes: ['www.coursesu.com'], recherche: (q) => `https://www.coursesu.com/recherche?q=${encodeURIComponent(q)}`, verifie: true },
    { id: 'chronodrive', nom: 'Chronodrive', hotes: ['www.chronodrive.com'], recherche: null, verifie: false }
  ];
  function driveDeLHote(hote) {
    return DRIVES.find((d) => d.hotes.includes(hote) || (d.suffixes || []).some((s) => hote.endsWith(s))) || null;
  }
  const api = { DRIVES, driveDeLHote };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetableDrives = api;
})(typeof window !== 'undefined' ? window : globalThis);
