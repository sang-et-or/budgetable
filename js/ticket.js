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
  const norm = (t) => String(t || '').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const prixNum = (s) => Number(String(s).replace(/\s/g, '').replace(',', '.'));
  // lignes qui ne sont pas des articles
  const HORS = /\*{3,}|x{4,}|\b\d{1,2}[:h]\d{2}\b|n[°o]\s?\d|visa|mastercard|maestro|\baid\b|a0000|autoris|\bref\b|\bpan\b|emv|lot \d|\bqte\b|\bpu\b|prix unit|eur\/kg$|total|tva|\bht\b|\bttc\b|carte|\bcb\b|esp[eè]ces|rendu|monnaie|fid[eé]lit|avantage|nb ?art|nombre d|articles?\b|merci|ticket|caisse|siret|t[eé]l[eé]?ph|\btel\b|www|http|bon d.?achat|paiement|montant|a payer|net a|cagnotte|points?\b|vendeur|h[oô]te|transaction|terminal|contactless|sans contact|debit|cr[eé]dit|date|heure|magasin|code|n° ?\d|facture|livraison|frais de|consigne|sac (cabas|plastique)/;
  const RE_PRIX = /(-?\d{1,4}\s?[,.]\s?\d{2})\s*(?:€|eur|euros?|e|c)?\s*(?:[a-d]|\*|[0-9]{1,2}|t\d)?\s*$/i;
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
    let v = prixNum(m[1]); const u = m[2].toLowerCase();
    if (!(v > 0)) return null;
    // lots : « 6X1L », « 4 x 125 g », « 2*500G » → contenance totale
    const lot = new RegExp('(\\d{1,2})\\s*[x×*]\\s*' + m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*' + m[2], 'i').exec(libelle);
    if (lot && +lot[1] > 1) v *= +lot[1];
    if (u === 'kg') return { q: v * 1000, unite: 'g' };
    if (u === 'g' || u === 'gr') return { q: v, unite: 'g' };
    if (u === 'l') return { q: v * 1000, unite: 'ml' };
    if (u === 'cl') return { q: v * 10, unite: 'ml' };
    return { q: v, unite: 'ml' };
  }
  const nettoyerLibelle = (l) => String(l).replace(RE_PRIX, '')
    .replace(/\b\d{8,14}\b/g, ' ')                       // code-barres en début de ligne
    .replace(/^\s*(?:\d{1,2}\s*[x×*]|[x×*]\s*\d{1,2})\s+/i, ' ')  // « 2 x » ou « x2 » devant le libellé
    .replace(/[|_~«»"]+/g, ' ').replace(/\s+[A-D]\s*$/, '').replace(/\s{2,}/g, ' ').replace(/^[\s*#.\-]+|[\s*#.\-]+$/g, '').trim();

  /** Corrige les confusions de lecture les plus courantes dans les prix et les poids (O, e, @ pour 0 ; S pour 5 ; l, I pour 1). */
  const CHIFFRE = { O: '0', o: '0', Q: '0', D: '0', e: '0', '@': '0', S: '5', s: '5', l: '1', I: '1', i: '1', B: '8', Z: '2', z: '2' };
  const enChiffres = (t) => t.replace(/[OoQDe@SslIiBZz]/g, (c) => CHIFFRE[c]);
  function corrigerLecture(texte) {
    return String(texte || '').split(/\r?\n/).map((l) => l
      // code TVA en fin de ligne lu avec un accent (« À », « Â ») ou en minuscule
      .replace(/\s[àáâä](\s*)$/i, ' A$1').replace(/\s[éèê](\s*)$/i, ' B$1')
      // « 5006 » pour « 500G » : un G lu comme un 6 après un poids rond
      .replace(/\b([1-9]\d?0)6\b(?!\s*[x×*])/g, '$1G')
      // prix en fin de ligne : « e,89 » → « 0,89 », « 1,S9 » → « 1,59 »
      .replace(/(^|\s)([0-9OoQDe@SslIiBZz]{1,4})\s?[,.]\s?([0-9OoQDe@SslIiBZz]{2})(\s*(?:€|eur|[A-D*])?\s*)$/i, (m, a, e, d, f) => (/\d/.test(e + d) ? `${a}${enChiffres(e)},${enChiffres(d)}${f}` : m))
      // poids et volumes : « 5O0G » → « 500G »
      .replace(/(^|\s)([0-9OoQ@SslI]{1,4})\s?(KG|G|GR|L|CL|ML)\b/gi, (m, a, n, u) => (/\d/.test(n) ? `${a}${enChiffres(n)}${u}` : m))
      // quantités : « 2 x O,95 »
      .replace(/(\d)\s*[x×*]\s*([0-9OoQDe@Ss]{1,3})[,.]([0-9OoQDe@Ss]{2})/gi, (m, q, e, d) => `${q} x ${enChiffres(e)},${enChiffres(d)}`)).join('\n');
  }
  /**
   * Lignes d'un ticket reconstruites à partir de la position des mots lus sur la photo :
   * les mots d'une même hauteur forment une ligne, de gauche à droite ; dans la colonne de droite,
   * un nombre de 3 ou 4 chiffres sans virgule est un prix (« 149 » → « 1,49 »).
   * mots : [{ text, confidence, bbox: { x0, y0, x1, y1 } }]
   */
  function reconstruire(mots, largeur) {
    const l0 = (mots || []).filter((w) => w && w.text && w.text.trim() && (w.confidence == null || w.confidence > 20) && w.bbox);
    if (!l0.length) return '';
    const hs = l0.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b), hm = hs[Math.floor(hs.length / 2)] || 20;
    const lignes = [];
    for (const w of l0.slice().sort((a, b) => (a.bbox.y0 + a.bbox.y1) - (b.bbox.y0 + b.bbox.y1))) {
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;
      const l = lignes.find((x) => Math.abs(x.cy - cy) < hm * 0.55);
      if (l) { l.mots.push(w); l.cy = (l.cy * (l.mots.length - 1) + cy) / l.mots.length; } else lignes.push({ cy, mots: [w] });
    }
    const droite = largeur * 0.62;
    return lignes.sort((a, b) => a.cy - b.cy).map((l) => l.mots.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((w) => {
      let t = w.text.trim();
      if (w.bbox.x0 > droite && /^-?\d{3,4}$/.test(t)) t = t.slice(0, -2) + ',' + t.slice(-2);
      if (w.bbox.x0 > droite && /^-?\d{1,3}\.\d{2}$/.test(t)) t = t.replace('.', ',');
      return t;
    }).join('   ')).join('\n');
  }
  /** Parmi plusieurs lectures d'une même photo, la plus crédible : celle dont la somme colle au total, avec le plus d'articles. */
  function meilleureLecture(textes) {
    const notes = textes.filter(Boolean).map((t) => {
      const a = analyser(t), somme = Math.round(a.lignes.filter((l) => !l.suspect).reduce((s, l) => s + l.prix, 0) * 100) / 100;
      const ecart = a.total ? Math.abs(somme - a.total) : null;
 return { texte: t, a, note: a.lignes.filter((l) => !l.suspect).length * 2 - a.lignes.filter((l) => l.suspect).length * 3 + (ecart == null ? 0 : ecart < 0.05 ? 40 : ecart < 1 ? 15 - ecart * 5 : -Math.min(20, ecart)) };
    }).sort((x, y) => y.note - x.note);
    return notes[0] || null;
  }
  /** Texte d'un ticket (ou d'un récapitulatif de drive) → { enseigne, date, total, lignes: [{ libelle, prix, qte, prixUnitaire, poids }] } */
  function analyser(texte) {
    texte = corrigerLecture(texte);
    const lignesBrutes = String(texte || '').split(/\r?\n/).map((l) => l.replace(/\t/g, ' ').trim()).filter(Boolean);
    const lignes = [];
    let total = null;
    let attente = null; // « 2 x 1,15 » sur la ligne suivant le libellé (ou le précédant)
    for (let k = 0; k < lignesBrutes.length; k++) {
      const brut = lignesBrutes[k], n = norm(brut).replace(/\s+/g, ' ');
      if (/t[o0][t7y][a@4]l|net a payer|a payer|montant du|a regler/.test(n)) { const m = RE_PRIX.exec(brut); if (m && !/sous.?total|tva/.test(n)) total = prixNum(m[1]); continue; }
      const pp = RE_POIDS_PRIX.exec(brut);
      const q = RE_QTE.exec(brut) || /\s(\d{1,3})\s*[x×*]\s*(\d{1,4}[,.]\d{2})(?!\d)/i.exec(brut);
      const m = RE_PRIX.exec(brut);
      if (/remise|reduction|r[eé]duc|promo|coupon|bon de r/.test(n) && m && lignes.length) { const v = Math.abs(prixNum(m[1])); const der = lignes[lignes.length - 1]; der.prix = Math.max(0, Math.round((der.prix - v) * 100) / 100); der.remise = (der.remise || 0) + v; continue; }
      if (HORS.test(n)) continue;
      // ligne « 2 x 1,15     2,30 » sans libellé : elle complète le dernier article (ou le prochain)
      const libelleSeul = nettoyerLibelle(brut.replace(RE_QTE, '').replace(/\s\d{1,3}\s*[x×*]\s*\d{1,4}[,.]\d{2}(?!\d)/i, ' ').replace(RE_POIDS_PRIX, '').replace(/eur\/kg|€\/kg/i, ''));
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
      const devant = /^\s*(?:(\d{1,2})\s*[x×*]|[x×*]\s*(\d{1,2}))\s+\D/i.exec(brut);
      if (devant && !q) { art.qte = +(devant[1] || devant[2]); art.prixUnitaire = Math.round(prix / art.qte * 100) / 100; }
      if (q) { art.qte = +q[1]; art.prixUnitaire = prixNum(q[2]); }
      if (pp) { art.poids = { q: prixNum(pp[1]) * 1000, unite: 'g' }; art.prixUnitaire = prixNum(pp[2]); art.auKilo = true; }
      if (attente) { Object.assign(art, attente, { prix: art.prix || attente.prix }); attente = null; }
      lignes.push(art);
    }
    // un libellé lisible : des lettres en majorité, au moins un vrai mot (sinon c'est du bruit de lecture)
    const lisible = (t) => { const lettres = (t.match(/[a-zà-ÿ]/gi) || []).length; return lettres >= 3 && lettres / Math.max(1, t.replace(/\s/g, '').length) >= 0.5 && /[a-zà-ÿ]{3,}/i.test(t); };
    let ok = lignes.filter((l) => l.prix > 0 && l.prix <= 80 && lisible(l.libelle)).map(({ attendQte, ...l }) => ({ ...l, prixUnitaire: l.prixUnitaire || Math.round(l.prix / (l.qte || 1) * 100) / 100 }));
    // le total relu sur une autre ligne (paiement, rendu…) n'est pas un article
    if (total) ok = ok.filter((l) => !(ok.length > 2 && Math.abs(l.prix - total) < 0.011));
    // contrôle avec le total : si la somme dépasse nettement, les prix les plus improbables sont mis de côté (à vérifier)
    if (ok.length) {
      const tri = ok.map((l) => l.prix).sort((a, b) => a - b), med = tri[Math.floor(tri.length / 2)];
      ok.forEach((l) => { if (l.prix > Math.max(25, med * 10)) l.suspect = true; });
      if (total) {
        const somme = () => ok.filter((l) => !l.suspect).reduce((x, l) => x + l.prix, 0);
        let garde = 0;
        while (somme() > total * 1.08 && garde++ < ok.length * 0.4) {
          const pire = ok.filter((l) => !l.suspect).sort((a, b) => b.prix - a.prix)[0];
          if (!pire) break; pire.suspect = true;
        }
      }
    }
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

  /* ---------- reconnaître le produit d'un libellé de caisse par ses mots-clés ---------- */
  // abréviations courantes des tickets de caisse
  const ABREV = { pdt: 'pomme de terre', pdte: 'pomme de terre', pom: 'pomme', yaou: 'yaourt', yao: 'yaourt', yt: 'yaourt', yrt: 'yaourt', emment: 'emmental', emm: 'emmental', jamb: 'jambon', jbn: 'jambon', champ: 'champignon', champi: 'champignon', courg: 'courgette', poiv: 'poivron', concom: 'concombre', conc: 'concassee', tom: 'tomate', from: 'fromage', fro: 'fromage', fr: 'frais', bl: 'blanc', crem: 'creme', cr: 'creme', beur: 'beurre', bre: 'beurre', huil: 'huile', farin: 'farine', far: 'farine', suc: 'sucre', choc: 'chocolat', past: 'pasta', spag: 'spaghetti', spagh: 'spaghetti', tagl: 'tagliatelle', coquil: 'pates', coq: 'pates', coquillette: 'pates', penne: 'pates', fusilli: 'pates', torsade: 'pates', farfalle: 'pates', macaroni: 'pates', tagliatelle: 'pates', linguine: 'pates', conchiglie: 'pates', rigatoni: 'pates', vermicelle: 'pates', spaghetti: 'pates', nouille: 'pates', mozz: 'mozzarella', moz: 'mozzarella', parm: 'parmesan', lard: 'lardon', saucis: 'saucisse', sauc: 'saucisse', pout: 'poulet', poul: 'poulet', escal: 'escalope', ste: 'steak', sth: 'steak hache', hach: 'hache', sau: 'saumon', saum: 'saumon', cab: 'cabillaud', lent: 'lentille', pchic: 'pois chiche', haric: 'haricot', hv: 'haricot vert', epin: 'epinard', carot: 'carotte', poir: 'poireau', oign: 'oignon', ognon: 'oignon', banan: 'banane', clem: 'clementine', mandar: 'mandarine', compot: 'compote', confit: 'confiture', cereal: 'cereale', biscot: 'biscotte', baguet: 'baguette', bag: 'baguette', pain: 'pain', ble: 'semoule', semoul: 'semoule', quin: 'quinoa', boul: 'boulgour', lt: 'lait', ecr: 'ecreme', ufs: 'oeufs', oeuf: 'oeufs', oeu: 'oeufs' };
  const VAGUES = new Set(['liquide', 'nature', 'bio', 'frais', 'fraiche', 'extra', 'maxi', 'mini', 'lot', 'sachet', 'boite', 'pack', 'classique', 'tranches', 'tranche', 'barquette', 'plein', 'air', 'gros', 'grosse', 'petit', 'petits', 'grand', 'format', 'familial', 'eco', 'premium', 'origine', 'france', 'cat', 'calibre', 'piece', 'pieces', 'unite', 'promo', 'offre', 'marque', 'repere', 'pouce', 'bouteille', 'brique', 'pot', 'les', 'des', 'aux', 'avec', 'sans', 'pour', 'the', 'and', 'cuit', 'cuite', 'cru', 'crue', 'sec', 'secs', 'fin', 'fine', 'fins', 'label', 'rouge', 'blanc', 'blanche', 'vert', 'verte', 'jaune', 'noir', 'noire']);
  const motsCles = (t) => norm(t).replace(/[^a-z ]/g, ' ').split(/\s+/).filter((m) => m.length >= 3).map((m) => m.replace(/(es|s|x)$/, (x) => (m.length > 4 ? '' : x)));
  /** Index du catalogue : [{ id, mots: [mots-clés], expressions: [expressions de plusieurs mots] }] (nom et synonymes). */
  function indexCatalogue(produits) {
    return produits.map(({ id, nom, synonymes }) => {
      const n = norm(String(nom).replace(/\([^)]*\)/g, ' '));
      const syn = (synonymes || []).map((x) => norm(String(x)));
      const nomMots = [...new Set(motsCles(n).filter((m) => !VAGUES.has(m) && !['ou', 'de', 'du', 'la', 'le'].includes(m)))];
      const synMots = [...new Set(syn.flatMap(motsCles).filter((m) => !VAGUES.has(m) && !nomMots.includes(m)))];
      return { id, nomMots, synMots, expressions: [n].concat(syn).filter((x) => x.trim().includes(' ')).map((x) => x.replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()) };
    });
  }
  const accord = (j, k) => (j === k ? 3 + k.length / 3 : j.length >= 4 && k.startsWith(j) ? 2 + j.length / 3 : k.length >= 4 && j.startsWith(k) ? 2 + k.length / 3 : 0);
  /** Meilleur produit pour un libellé de caisse, avec un score (0 si rien de vraiment ressemblant). */
  function reconnaitreProduit(libelle, index) {
    let txt = norm(libelle).replace(/\d+([,.]\d+)?\s*(kg|g|gr|l|cl|ml)\b/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    txt = txt.split(' ').map((m) => ABREV[m] || ABREV[m.replace(/(s|x)$/, '')] || ABREV[m.replace(/es$/, '')] || m).join(' ');
    const jetons = motsCles(txt).filter((m) => !VAGUES.has(m));
    if (!jetons.length) return { id: null, score: 0 };
    let best = { id: null, score: 0, n: 99 };
    for (const p of index) {
      let sc = 0;
      const nomTrouves = new Set();
      for (const e of p.expressions) if (e.length >= 6 && (' ' + txt + ' ').includes(' ' + e + ' ')) sc += 5 + e.length / 5;
      for (const j of jetons) {
        let m = 0;
        for (const k of p.nomMots) { const a = accord(j, k); if (a) nomTrouves.add(k); m = Math.max(m, a); }
        for (const k of p.synMots) m = Math.max(m, accord(j, k) * 0.75);   // un synonyme compte un peu moins que le nom
        sc += m;
      }
      if (sc <= 0) continue;
      // le nom du produit contient d'autres mots absents du ticket (« œufs DE POISSON ») : moins probable
      sc -= (p.nomMots.length - nomTrouves.size) * 0.9;
      if (sc > best.score + 0.01 || (Math.abs(sc - best.score) <= 0.01 && p.nomMots.length < best.n)) best = { id: p.id, score: Math.round(sc * 10) / 10, n: p.nomMots.length };
    }
    return best.score >= 3.2 ? { id: best.id, score: best.score } : { id: null, score: Math.max(0, best.score) };
  }
  const api = { indexCatalogue, reconnaitreProduit, ENSEIGNES, analyser, corrigerLecture, reconstruire, meilleureLecture, prixPaquet, plausible, detecterEnseigne, detecterDate, poidsDe, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Ticket = api;
})(typeof window !== 'undefined' ? window : globalThis);
