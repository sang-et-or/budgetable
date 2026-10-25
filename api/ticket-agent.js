/* Budgétable — agent de lecture des tickets de caisse et récapitulatifs de drive.
 *
 * 1. Lecture brute : OCR dédié aux documents (Mistral OCR) sur la photo ou le PDF, quand il est disponible.
 * 2. Extraction : un modèle (avec la photo sous les yeux ET le texte de l'OCR) recopie chaque article, décode
 *    les abréviations de caisse et rattache l'article au catalogue de Budgétable.
 * 3. Contrôle : la somme des lignes (moins les remises) doit retomber sur le total du ticket. Sinon l'agent
 *    renvoie le modèle relire le ticket avec l'écart chiffré, jusqu'à 2 fois, et garde la meilleure lecture.
 *
 * Les appels au modèle sont injectés (ocr, chat) : le module se teste sans réseau.
 */
'use strict';

const arrondi = (x) => Math.round((Number(x) || 0) * 100) / 100;
const extraireJSON = (texte) => { const m = /\{[\s\S]*\}/.exec(texte || ''); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { return null; } };

function consigne(catalogue, { texteOCR, texteColle, avecImage }) {
  const liste = catalogue.map((i) => `${i.id}=${i.nom}`).join(' ; ');
  return `Tu es un expert des tickets de caisse français (Leclerc, Carrefour, Auchan, Intermarché, Super U, Lidl, Aldi, Casino, Monoprix, Franprix, Netto, Grand Frais, Picard, drives…).
${avecImage ? 'Voici la photo du ticket (ou du récapitulatif de commande).' : 'Voici le texte d’un ticket ou d’un récapitulatif de commande.'}${texteOCR ? ' Un OCR l’a déjà lu (texte ci-dessous) : sers-t’en pour les caractères, et la photo pour l’alignement des prix avec les libellés.' : ''}

Ta mission : recopier CHAQUE article acheté, ligne par ligne, sans en oublier ni en inventer.
Règles :
- Un article = un libellé + le montant payé pour cette ligne (colonne de droite). Lis le ticket de haut en bas.
- Quantité : « 2 x 1,25 » ou « 2 X 1.25 € » sous ou avant un article → qte 2, prixUnitaire 1.25, prix 2.50 (le montant de la ligne).
- Au poids : « 0,512 kg x 3,99 €/kg » → auKilo true, poidsKg 0.512, prixUnitaire 3.99, prix = montant imprimé.
- Remise sur un article (« REMISE », « REM. IMMEDIATE », « PROMO », « -0,50 », « LOT ») → champ remise (nombre positif) de l’article concerné, pas une ligne à part.
- Remises globales (bon d’achat, cagnotte ou fidélité utilisée, coupon) → remisesGlobales (total positif).
- NE SONT PAS des articles : sous-total, total, TVA, nombre d’articles, rendu, espèces, CB, carte, paiement, fidélité gagnée, points, adresse, horaires, SIRET, numéros, codes-barres, messages.
- Consigne de bouteille ou sac payant : ce sont des articles (categorie "autre").
- libelle : le texte EXACT du ticket. nom : ce que c’est en clair, abréviations décodées (« COQUIL 500G » → « Coquillettes 500 g », « LT 1/2 ECR » → « Lait demi-écrémé », « EMMENT RAP » → « Emmental râpé », « PDT » → « Pommes de terre »).
- id : l’identifiant du catalogue ci-dessous si c’est le même aliment (sinon null). Ne force pas : un produit ménager ou d’hygiène n’a jamais d’id.
- categorie : "alimentaire", "boisson", "hygiene", "maison" ou "autre".
- total : le TOTAL À PAYER imprimé (avant paiement), avec les centimes. enseigne et date (AAAA-MM-JJ) si lisibles.
- Si un chiffre est douteux, mets ta meilleure lecture et doute:true sur la ligne.

Réponds UNIQUEMENT en JSON :
{"enseigne":"…|null","date":"AAAA-MM-JJ|null","total":<nombre|null>,"remisesGlobales":<nombre>,"lignes":[{"libelle":"…","nom":"…","id":"…|null","categorie":"…","qte":<nombre>,"prixUnitaire":<nombre|null>,"prix":<montant de la ligne>,"remise":<nombre>,"auKilo":<bool>,"poidsKg":<nombre|null>,"doute":<bool>}]}

Catalogue (id=nom) : ${liste}${texteOCR ? `\n\nTexte lu par l’OCR :\n"""\n${texteOCR.slice(0, 15000)}\n"""` : ''}${texteColle ? `\n\nTexte du ticket :\n"""\n${texteColle.slice(0, 15000)}\n"""` : ''}`;
}

/** Remet la réponse du modèle au propre et calcule l'écart avec le total. */
function nettoyer(o, catalogue) {
  if (!o || typeof o !== 'object') return null;
  const ids = new Set(catalogue.map((i) => i.id));
  const lignes = (Array.isArray(o.lignes) ? o.lignes : []).map((l) => {
    l = l || {};
    const qte = Math.max(1, Math.min(99, Math.round(Number(l.qte) || 1)));
    let prix = arrondi(l.prix);
    const pu = Number(l.prixUnitaire) > 0 ? arrondi(l.prixUnitaire) : null;
    if (!(prix > 0) && pu) prix = arrondi(pu * qte);
    const remise = Math.max(0, Math.min(prix, Math.abs(arrondi(l.remise))));
    const cat = ['alimentaire', 'boisson', 'hygiene', 'maison', 'autre'].includes(l.categorie) ? l.categorie : 'alimentaire';
    const id = l.id && ids.has(String(l.id)) && (cat === 'alimentaire' || cat === 'boisson') ? String(l.id) : null;
    return {
      libelle: String(l.libelle || l.nom || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      nom: String(l.nom || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null,
      id, categorie: cat, qte, prixUnitaire: pu,
      prixBrut: prix, remise, prix: arrondi(prix - remise),
      auKilo: !!l.auKilo, poidsKg: Number(l.poidsKg) > 0 && Number(l.poidsKg) < 30 ? Math.round(Number(l.poidsKg) * 1000) / 1000 : null,
      doute: !!l.doute,
    };
  }).filter((l) => l.libelle && l.prixBrut > 0 && l.prixBrut < 1000).slice(0, 200);
  const total = Number(o.total) > 0 ? arrondi(o.total) : null;
  const remisesGlobales = Math.max(0, Math.abs(arrondi(o.remisesGlobales)));
  const somme = arrondi(lignes.reduce((s, l) => s + l.prix, 0) - remisesGlobales);
  return {
    enseigne: o.enseigne && o.enseigne !== 'null' ? String(o.enseigne).slice(0, 40) : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') ? o.date : null,
    total, remisesGlobales, lignes, somme,
    ecart: total == null ? null : arrondi(somme - total),
  };
}

const note = (r) => (!r ? -1e9 : (r.lignes.length ? 0 : -1e6) - (r.ecart == null ? 5 : Math.abs(r.ecart) * 10));

/**
 * @param {{image?:string, pdf?:string, texte?:string, suite?:boolean}} entree  base64 sans préfixe pour image (JPEG) / pdf
 * @param {{ocr?:Function, chat:Function, catalogue:Array}} outils
 *   ocr(document) → texte ; chat(messages, {image}) → texte de la réponse
 */
async function lireTicketAgent(entree, { ocr, chat, catalogue = [], essaisMax = 3 } = {}) {
  let texteOCR = null;
  if (ocr && (entree.image || entree.pdf)) {
    const doc = entree.pdf ? { type: 'document_url', document_url: 'data:application/pdf;base64,' + entree.pdf } : { type: 'image_url', image_url: 'data:image/jpeg;base64,' + entree.image };
    try { texteOCR = String(await ocr(doc) || '').trim() || null; } catch (e) { texteOCR = null; }
  }
  if (entree.pdf && !texteOCR) throw Object.assign(new Error('PDF illisible'), { code: 422 });
  const image = entree.image || null;
  const messages = [{ role: 'user', content: consigne(catalogue, { texteOCR, texteColle: entree.texte || null, avecImage: !!image }) }];
  let meilleur = null, essais = 0;
  while (essais < essaisMax) {
    essais++;
    const brut = await chat(messages, { image });
    const r = nettoyer(extraireJSON(brut), catalogue);
    if (r && note(r) > note(meilleur)) meilleur = r;
    // ticket juste (ou partie de ticket sans total, quand on photographie un long ticket en plusieurs fois) : terminé
    if (r && r.lignes.length && (r.ecart === null ? (entree.suite || essais >= 2) : Math.abs(r.ecart) < 0.02)) break;
    if (essais >= essaisMax) break;
    messages.push({ role: 'assistant', content: brut || '{}' });
    let relance;
    if (!r) relance = 'Ta réponse n’était pas un JSON valide. Renvoie uniquement le JSON demandé.';
    else if (!r.lignes.length) relance = 'Tu n’as trouvé aucun article. Relis le ticket ligne par ligne : chaque libellé suivi d’un prix est un article. Renvoie le JSON complet.';
    else if (r.ecart === null) relance = 'Je ne trouve pas le total à payer. Cherche « TOTAL », « A PAYER », « NET A PAYER », « MONTANT » en bas du ticket et renvoie le JSON complet avec le total.';
    else relance = `Contrôle : la somme de tes lignes (moins les remises) fait ${r.somme.toFixed(2)} €, mais le total du ticket est ${r.total.toFixed(2)} € (écart ${r.ecart > 0 ? '+' : ''}${r.ecart.toFixed(2)} €).
Relis le ticket ligne par ligne et corrige : ${r.ecart > 0 ? 'une ligne comptée deux fois, un sous-total ou une ligne de paiement prise pour un article, une remise oubliée, un prix unitaire pris pour le montant de la ligne' : 'un article oublié, une quantité (2 x …) mal comptée, un prix mal lu (virgule, 1 ↔ 7, 5 ↔ 6, 0 ↔ 8), une remise comptée en trop'}. Vérifie aussi le total lui-même.
Renvoie le JSON complet corrigé.`;
    messages.push({ role: 'user', content: relance });
  }
  if (!meilleur) return { lignes: [], total: null, verifie: false, essais, texte: texteOCR };
  return { ...meilleur, verifie: meilleur.ecart !== null && Math.abs(meilleur.ecart) < 0.02, essais, texte: texteOCR };
}

module.exports = { lireTicketAgent, nettoyer, consigne };
