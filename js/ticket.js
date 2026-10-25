/* Budgétable — tickets de caisse et récapitulatifs de drive : lecture du texte, lignes d'articles, rapprochement avec le catalogue,
 * et prix par paquet pour le magasin. Le texte vient d'une photo (lecture sur l'appareil, ou par l'assistant IA du site),
 * d'un récapitulatif de drive collé, ou d'une saisie à la main.
 */
(function (root) {
  'use strict';
  const ENSEIGNES = [
    ['lidl', 'Lidl', /\blidl\b/], ['aldi', 'Aldi', /\baldi\b/], ['carrefour', 'Carrefour', /carrefour/], ['leclerc', 'E.Leclerc', /leclerc/],
    ['intermarche', 'Intermarché', /intermarch/], ['auchan', 'Auchan', /auchan/], ['superu', 'Super U', /(super|hyper|marche) ?u\b|\bu express\b|magasins u\b|coop[eé]rative u/],
    ['casino', 'Casino', /casino|geant/], ['monoprix', 'Monoprix', /monoprix|monop/], ['franprix', 'Franprix', /franprix/], ['netto', 'Netto', /\bnetto\b/],
    ['leaderprice', 'Leader Price', /leader ?price/], ['grandfrais', 'Grand Frais', /grand ?frais/], ['picard', 'Picard', /picard/], ['cora', 'Cora', /\bcora\b/],
    ['match', 'Supermarchés Match', /\bmatch\b/], ['spar', 'Spar', /\bspar\b/], ['colruyt', 'Colruyt', /colruyt/], ['biocoop', 'Biocoop', /biocoop/]
  ];
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const prixNum = (s) => Number(String(s).replace(/\s/g, '').replace(',', '.'));
  // lignes qui ne sont pas des articles
  const HORS = /total|tva|\bht\b|\bttc\b|carte|\bcb\b|esp[eè]ces|rendu|monnaie|fid[eé]lit|avantage|nb ?art|nombre d|articles?\b|merci|ticket|caisse|siret|t[eé]l[eé]?ph|\btel\b|www|http|bon d.?achat|paiement|montant|a payer|net a|cagnotte|points?\b|vendeur|h[oô]te|transaction|terminal|contactless|sans contact|debit|cr[eé]dit|date|heure|magasin|code|n° ?\d|facture|livraison|frais de|consigne|sac (cabas|plastique)/;
  const RE_PRIX = /(-?\d{1,4}[,.]\d{2})\s*(?:€|eur|euros?)?\s*(?:[a-d]|\*|[0-9])?\s*$/i;
  const RE_QTE = /^\s*(\d{1,3})\s*[x×*]\s*(\d{1,4}[,.]\d{2})/i;
  const RE_POIDS_PRIX = /(\d+[,.]\d{1,3})\s*kg\s*[x×*]\s*(\d+[,.]\d{2})/i;
  const RE_POIDS = /(\d+(?:[,.]\d+)?)\s*(kg|g|gr|l|cl|ml)\b/i;

  function detecterEnseigne(texte) {
    const t = norm(texte).slice(0, 600);
    const e = ENSEIGNES.find(([, , re]) => re.test(t));
    return e ? { id: e[0], nom: e[1] } : null;
  }
  function detecterDate(texte) {
    const m = /(\d{2})[/.-](\d{2})[/.-](\d{2,4})/.exec(texte);
    if (!m) return null;
    const a = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null;
    return `${a}-${m[2]}-${m[1]}`;
  }
  /** Poids ou volume dans un libellé, converti en g ou ml. */
  function poidsDe(libelle) {
    const m = RE_POIDS.exec(libelle || '');
    if (!m) return null;
    const v = prixNum(m[1]), u = m[2].toLowerCase();
    if (!(v > 0)) return null;
    if (u === 'kg') return { q: v * 1000, unite: 'g' };
    if (u === 'g' || u === 'gr') return { q: v, unite: 'g' };
    if (u === 'l') return { q: v * 1000, unite: 'ml' };
    if (u === 'cl') return { q: v * 10, unite: 'ml' };
    return { q: v, unite: 'ml' };
  }
  const nettoyerLibelle = (l) => String(l).replace(RE_PRIX, '').replace(/\s+[A-D]\s*$/, '').replace(/\s{2,}/g, ' ').replace(/^[\s*#.\-]+|[\s*#.\-]+$/g, '').trim();

  /** Texte d'un ticket (ou d'un récapitulatif de drive) → { enseigne, date, total, lignes: [{ libelle, prix, qte, prixUnitaire, poids }] } */
  function analyser(texte) {
    const lignesBrutes = String(texte || '').split(/\r?\n/).map((l) => l.replace(/\t/g, ' ').trim()).filter(Boolean);
    const lignes = [];
    let total = null;
    let attente = null; // « 2 x 1,15 » sur la ligne suivant le libellé (ou le précédant)
    for (let k = 0; k < lignesBrutes.length; k++) {
      const brut = lignesBrutes[k], n = norm(brut);
      if (/total|net a payer|a payer|montant du/.test(n)) { const m = RE_PRIX.exec(brut); if (m && !/sous.?total|tva/.test(n)) total = prixNum(m[1]); continue; }
      const pp = RE_POIDS_PRIX.exec(brut);
      const q = RE_QTE.exec(brut);
      const m = RE_PRIX.exec(brut);
      if (/remise|reduction|r[eé]duc|promo|coupon|bon de r/.test(n) && m && lignes.length) { const v = Math.abs(prixNum(m[1])); const der = lignes[lignes.length - 1]; der.prix = Math.max(0, Math.round((der.prix - v) * 100) / 100); der.remise = (der.remise || 0) + v; continue; }
      if (HORS.test(n)) continue;
      // ligne « 2 x 1,15     2,30 » sans libellé : elle complète le dernier article (ou le prochain)
      const libelleSeul = nettoyerLibelle(brut.replace(RE_QTE, '').replace(RE_POIDS_PRIX, '').replace(/eur\/kg|€\/kg/i, ''));
      if ((q || pp) && libelleSeul.replace(/[^a-z]/gi, '').length < 3) {
        const info = pp ? { qte: 1, poids: { q: prixNum(pp[1]) * 1000, unite: 'g' }, prixUnitaire: prixNum(pp[2]), auKilo: true } : { qte: +q[1], prixUnitaire: prixNum(q[2]) };
        const prix = m ? prixNum(m[1]) : Math.round(info.qte * info.prixUnitaire * 100) / 100;
        // le détail (« 2 x 0,95 » ou « 1,234 kg x 1,49 €/kg ») se rapporte à l'article juste au-dessus
        const der = lignes[lignes.length - 1];
        if (der) { Object.assign(der, info, { prix: der.attendQte || !der.prix ? prix : der.prix }); der.attendQte = false; } else attente = { ...info, prix };
        continue;
      }
      if (!m) {
        // libellé sans prix : le prix est sur la ligne suivante (« 2 x 1,15  2,30 » ou le prix seul)
        if (libelleSeul.replace(/[^a-z]/gi, '').length >= 3) lignes.push({ libelle: libelleSeul, prix: 0, qte: 1, attendQte: true, poids: poidsDe(libelleSeul) });
        continue;
      }
      let prix = prixNum(m[1]);
      let libelle = libelleSeul;
      if (!libelle || libelle.replace(/[^a-z]/gi, '').length < 3) {
        const der = lignes[lignes.length - 1];
        if (der && der.attendQte) { der.prix = prix; der.attendQte = false; }
        continue;
      }
      if (prix <= 0 || prix > 500) continue;
      const art = { libelle, prix, qte: 1, poids: poidsDe(libelle) };
      if (q) { art.qte = +q[1]; art.prixUnitaire = prixNum(q[2]); }
      if (pp) { art.poids = { q: prixNum(pp[1]) * 1000, unite: 'g' }; art.prixUnitaire = prixNum(pp[2]); art.auKilo = true; }
      if (attente) { Object.assign(art, attente, { prix: art.prix || attente.prix }); attente = null; }
      lignes.push(art);
    }
    const ok = lignes.filter((l) => l.prix > 0).map(({ attendQte, ...l }) => ({ ...l, prixUnitaire: l.prixUnitaire || Math.round(l.prix / (l.qte || 1) * 100) / 100 }));
    return { enseigne: detecterEnseigne(texte), date: detecterDate(texte), total, lignes: ok };
  }

  /**
   * Prix d'un paquet du catalogue d'après une ligne du ticket :
   * avec un poids ou un volume, on ramène au paquet du catalogue (prix au kilo × paquet) ; sinon, le prix d'une unité = un paquet.
   */
  function prixPaquet(ligne, ing) {
    if (!ing) return null;
    const unitaire = ligne.prixUnitaire || ligne.prix / (ligne.qte || 1);
    const p = ligne.poids;
    if (p && ((p.unite === 'g' && ing.unite === 'g') || (p.unite === 'ml' && ing.unite === 'ml'))) {
      // vendu au poids (« 1,234 kg x 1,49 €/kg ») : prix payé ÷ poids ; sinon prix d'une unité ÷ poids de l'unité
      const parUnite = ligne.auKilo ? ligne.prix / p.q : unitaire / p.q;
      const v = Math.round(parUnite * ing.cond * 100) / 100;
      return v > 0 ? v : null;
    }
    return unitaire > 0 ? Math.round(unitaire * 100) / 100 : null;
  }
  /** Le prix trouvé est-il plausible par rapport au prix habituel (dans un rapport de 1 à 4) ? */
  const plausible = (prix, ref) => !(ref > 0) || (prix >= ref / 4 && prix <= ref * 4);

  const api = { ENSEIGNES, analyser, prixPaquet, plausible, detecterEnseigne, detecterDate, poidsDe, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Ticket = api;
})(typeof window !== 'undefined' ? window : globalThis);
