/* Budgétable – lecture des produits AFFICHÉS sur la page que l'utilisateur consulte.
 *
 * Aucune requête n'est envoyée : on lit seulement ce qui est déjà à l'écran,
 * pour la personne qui le regarde. Comme chaque site a sa propre mise en page,
 * la lecture est générique : une « fiche produit » est un bloc qui contient un
 * prix en euros et un bouton d'ajout au panier.
 */
(function (root) {
  // « 1,89 € » (le plus courant) ou « 2 € ,49 » (E.Leclerc : centimes après le symbole)
  const PRIX = /(\d{1,4})\s?(?:[,.]\s?(\d{2})\s?€|€\s?[,.]\s?(\d{2}))/;
  const PRIX_UNITE = /(\d{1,4}[,.]\d{2})\s?€\s?(?:\/|le|la|par)\s?(kg|kilo|l|litre|pièce|unité|u)\b/i;
  const AJOUT = /ajouter|au panier|add to cart|\+\s*panier/i;

  const nombre = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  function sansAccents(t) { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  // texte d'un bloc, un espace entre chaque élément (évite « le kgAjouter »)
  function texteDe(el) {
    const morceaux = [];
    const w = (el.ownerDocument || document).createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
    while (w.nextNode()) { const t = w.currentNode.nodeValue.trim(); if (t) morceaux.push(t); }
    return morceaux.join(' ').replace(/\s+/g, ' ').trim();
  }

  const PAS_PANIER = /liste|favori|supprimer|retirer|comparer|alerte/i;
  function estBoutonAjout(el) {
    const t = [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-testid'), el.textContent].join(' ');
    return AJOUT.test(t) && !PAS_PANIER.test(t) && !el.disabled;
  }

  function titreDe(carte, bouton) {
    // premier libellé qui ressemble à un nom de produit (pas « Voir le rayon », « Ajouter… »)
    const GENERIQUE = /^(voir|ajouter|découvrir|decouvrir|en savoir|plus de|acheter|choisir)\b/i;
    const cands = [...carte.querySelectorAll('h2, h3, h4, [class*="title" i], [class*="name" i], [class*="libelle" i], a[title]')];
    const cand = cands.map((c) => (c.getAttribute('title') || texteDe(c)).trim()).find((x) => x.length >= 6 && !GENERIQUE.test(x) && !PRIX.test(x));
    let t = cand || '';
    if (!t) t = texteDe(carte).split(PRIX)[0];
    t = t.replace(texteDe(bouton), '').replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*\d+\s*\+\s*$/, '').trim();
    return t.slice(0, 140);
  }

  /** Renvoie les produits visibles : [{ titre, prix, prixUnite, unite, bouton }] */
  function lireProduits(racine) {
    const doc = racine || document;
    const boutons = [...doc.querySelectorAll('button, a, [role="button"]')].filter(estBoutonAjout);
    // fiche produit = le plus grand bloc autour du bouton qui ne contient qu'UN bouton d'ajout et un prix
    const cartes = new Map();
    for (const b of boutons) {
      let el = b, carte = null;
      for (let i = 0; i < 12 && el.parentElement; i++) {
        el = el.parentElement;
        if (boutons.filter((x) => el.contains(x)).length > 1) break;
        const t = texteDe(el);
        if (t.length > 900) break;
        if (PRIX.test(t)) carte = el;
      }
      if (carte && !cartes.has(carte)) cartes.set(carte, b);
    }
    const liste = [...cartes.keys()].filter((c) => ![...cartes.keys()].some((o) => o !== c && c.contains(o)));
    return liste.map((c) => {
      const t = texteDe(c);
      const sansUnite = t.replace(PRIX_UNITE, ' ');
      const m = sansUnite.match(PRIX);
      const mu = t.match(PRIX_UNITE);
      return {
        titre: titreDe(c, cartes.get(c)),
        prix: m ? nombre(m[1] + '.' + (m[2] || m[3])) : null,
        prixUnite: mu ? nombre(mu[1]) : null,
        unite: mu ? mu[2].toLowerCase().replace('kilo', 'kg').replace('litre', 'l') : null,
        bouton: cartes.get(c),
        carte: c
      };
    }).filter((p) => p.prix != null && p.titre);
  }

  // un ingrédient brut ne se remplace pas par un plat préparé (sauf si la recherche le demande)
  const PREPARES = ['veloute', 'soupe', 'bol', 'repas', 'bebe', 'puree', 'tranche', 'plat cuisine', 'salade', 'chips', 'biscuit', 'allumette', 'galette', 'mois', 'facile', 'express', 'cuisine', 'pret a', 'dahl'];
  const UNITE = { g: 'kg', kg: 'kg', ml: 'l', l: 'l', 'pièce': 'pièce', piece: 'pièce', 'unité': 'pièce', u: 'pièce' };

  /**
   * Garde les produits dont le nom contient les mots importants de la recherche,
   * de même unité que l'article (kilo pour un article en grammes, litre pour un article en ml),
   * sans plats préparés, du moins cher au plus cher (au kilo / litre quand le site l'affiche).
   */
  function meilleursPour(produits, terme, uniteArticle) {
    const t0 = sansAccents(terme);
    const mots = t0.split(/[^a-z0-9]+/).filter((m) => m.length > 2 && !['des', 'les', 'aux', 'avec', 'nature'].includes(m));
    const attendue = uniteArticle ? UNITE[uniteArticle] : null;
    const pertinents = produits.filter((p) => {
      const t = sansAccents(p.titre);
      if (!mots.every((m) => t.includes(m.replace(/s$/, '')))) return false;
      if (PREPARES.some((w) => t.includes(w) && !t0.includes(w))) return false;
      if (attendue && p.unite && UNITE[p.unite] && UNITE[p.unite] !== attendue) return false;
      return true;
    });
    const cle = (p) => (p.prixUnite != null ? p.prixUnite : p.prix);
    return pertinents.sort((a, b) => cle(a) - cle(b));
  }

  // bouton « + » (augmenter la quantité) dans un bloc
  const PLUS = /augmenter|ajouter (un|une|1)\b|quantit[ée] \+|^\s*\+\s*$|^\s*\+\s*1\s*$/i;
  const MOINS = /retirer|diminuer|moins|supprimer|enlever|réduire|reduire/i;
  function boutonPlus(bloc) {
    const cands = [...bloc.querySelectorAll('button, [role="button"]')].filter((b) => {
      const t = [b.getAttribute('aria-label'), b.getAttribute('title'), b.getAttribute('data-testid'), b.textContent].join(' ');
      return PLUS.test(t) && !MOINS.test(t) && !b.disabled;
    });
    return cands.length === 1 ? cands[0] : null;
  }
  /** Retrouve le bouton « + » du produit (le bouton « Ajouter » du site est souvent remplacé par un compteur). */
  function plusDuProduit(produit, doc) {
    if (produit.carte && produit.carte.isConnected) { const b = boutonPlus(produit.carte); if (b) return b; }
    const cle = produit.titre.slice(0, 28);
    const noeuds = [...(doc || document).querySelectorAll('h2, h3, h4, a, span, p')].filter((e) => (e.getAttribute('title') || e.textContent || '').includes(cle));
    for (const n of noeuds) {
      let el = n;
      for (let i = 0; i < 8 && el.parentElement; i++) {
        el = el.parentElement;
        const b = boutonPlus(el);
        if (b) return b;
      }
    }
    return null;
  }

  const api = { lireProduits, meilleursPour, sansAccents, plusDuProduit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgetableLecture = api;
})(typeof window !== 'undefined' ? window : globalThis);
