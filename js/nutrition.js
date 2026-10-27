/* Budgétable — calories et Nutri-Score estimés d'une recette, calculés à partir de ses ingrédients.
 *
 * Valeurs nutritionnelles moyennes pour 100 g (ou 100 ml) d'aliment cru, arrondies d'après les tables
 * de composition françaises (Ciqual) : kcal, acides gras saturés, sucres, sel, fibres, protéines, et
 * part de fruits, légumes et légumineuses (fl). Pour les produits comptés à la pièce, « poids » donne
 * le poids d'une pièce. Le Nutri-Score suit l'algorithme de 2017 (aliments solides), appliqué au plat
 * cuit pour 100 g : c'est une ESTIMATION, pas un étiquetage officiel.
 */
(function (root) {
  'use strict';
  //            kcal  ags   sucres sel   fibres prot  fl  [poids d'une pièce]
  const T = {
    oignon: [40, 0, 4.2, 0.01, 1.7, 1.1, 1], ail: [140, 0.1, 1, 0.04, 4.5, 6.4, 1], carotte: [36, 0, 6.5, 0.1, 2.7, 0.8, 1],
    courgette: [16, 0, 1.6, 0, 1.1, 1.2, 1], tomate: [18, 0, 2.5, 0.01, 1.2, 0.9, 1], poivron: [25, 0, 4, 0, 1.9, 0.9, 1],
    pomme_de_terre: [80, 0, 0.8, 0, 1.8, 2, 0], poireau: [30, 0, 2.8, 0.05, 2.5, 1.3, 1], champignon: [22, 0, 0.5, 0.02, 2, 2.9, 1],
    brocoli: [34, 0.1, 1.5, 0.08, 2.6, 2.8, 1], salade: [15, 0, 1, 0.02, 1.3, 1.2, 1, 300], concombre: [14, 0, 1.7, 0, 0.7, 0.6, 1, 300],
    aubergine: [24, 0, 2.9, 0, 2.5, 1, 1], courge: [40, 0, 4, 0, 2, 1, 1], citron: [30, 0, 2.5, 0, 1.5, 0.8, 1, 60],
    persil: [40, 0, 1, 0.1, 4, 3, 1, 50], patate_douce: [86, 0, 4.2, 0.1, 3, 1.6, 1], chou: [25, 0, 3, 0.05, 2.5, 1.3, 1],
    poulet_filet: [110, 0.5, 0, 0.15, 0, 23, 0], cuisses_poulet: [180, 3, 0, 0.2, 0, 18, 0], boeuf_hache: [125, 2.2, 0, 0.18, 0, 21, 0],
    jambon: [110, 1, 0.8, 1.9, 0, 20, 0], lardons: [250, 7.5, 0.5, 2.2, 0, 16, 0], saucisse: [280, 9, 0.5, 1.6, 0, 14, 0],
    saumon: [200, 2.5, 0, 0.12, 0, 20, 0], colin: [80, 0.1, 0, 0.2, 0, 18, 0], thon: [110, 0.3, 0, 0.9, 0, 25, 0],
    oeufs: [140, 3, 0.3, 0.35, 0, 12.5, 0, 55], lait: [46, 1, 4.8, 0.1, 0, 3.3, 0], beurre: [745, 54, 0.6, 0.03, 0, 0.7, 0],
    creme: [300, 20, 2.5, 0.08, 0, 2.2, 0], emmental: [380, 18, 0, 0.5, 0, 29, 0], mozzarella: [250, 12, 1, 0.5, 0, 18, 0],
    feta: [270, 15, 0.5, 2.8, 0, 15, 0], yaourt: [55, 1, 4.5, 0.1, 0, 4, 0], tofu: [120, 1, 0.5, 0.02, 0.5, 13, 0],
    pates: [355, 0.3, 3, 0.01, 3, 12.5, 0], riz: [350, 0.2, 0.3, 0, 1.3, 7.5, 0], semoule: [355, 0.2, 1, 0, 3.5, 12, 0],
    quinoa: [370, 0.7, 3, 0, 7, 14, 0], farine: [345, 0.2, 1.5, 0, 3, 10, 0], lentilles_corail: [340, 0.1, 2, 0, 11, 24, 1],
    lentilles_vertes: [330, 0.1, 1.5, 0, 11, 24, 1], pois_chiches: [120, 0.3, 0.5, 0.5, 5, 7, 1], haricots_rouges: [110, 0.1, 0.5, 0.5, 6, 7.5, 1],
    haricots_blancs: [100, 0.1, 0.5, 0.5, 6, 7, 1], mais: [90, 0.2, 4, 0.3, 2.5, 3, 1], tomates_concassees: [25, 0, 4, 0.1, 1.2, 1.2, 1],
    lait_coco: [180, 16, 2, 0.05, 0, 1.6, 0], huile_olive: [900, 14, 0, 0, 0, 0, 0], curry: [325, 2, 3, 0.05, 33, 13, 0],
    cumin: [375, 1.5, 2, 0.4, 10, 18, 0], paprika: [280, 2, 10, 0.1, 35, 14, 0], bouillon: [250, 5, 2, 50, 0, 10, 0, 10],
    sauce_soja: [60, 0, 1, 14.5, 0.5, 8, 0], moutarde: [150, 0.6, 1.5, 6, 3, 7, 0], tortillas: [300, 2.5, 2, 1.2, 2.5, 8, 0, 40],
    pois_casses: [330, 0.1, 2, 0, 15, 23, 1], haricots_verts: [30, 0, 2, 0, 3, 1.8, 1], petits_pois: [80, 0.1, 4, 0, 5, 5.5, 1],
    epinards: [25, 0, 0.5, 0.15, 2.5, 3, 1], pain: [270, 0.3, 2, 1.3, 3, 9, 0, 250], pain_mie: [280, 1.5, 5, 1.1, 3, 8.5, 0],
    sucre: [400, 0, 100, 0, 0, 0, 0], chocolat: [540, 21, 30, 0.02, 10, 7, 0], cacao: [360, 13, 1, 0.1, 30, 20, 0],
    levure: [120, 0, 0, 25, 0, 0, 0, 11], sucre_vanille: [400, 0, 100, 0, 0, 0, 0, 7.5], confiture: [245, 0, 60, 0.02, 1, 0.4, 0.5],
    miel: [320, 0, 80, 0.01, 0, 0.4, 0], flocons_avoine: [370, 1.2, 1, 0, 10, 13, 0], compote: [75, 0, 15, 0, 1.5, 0.3, 1, 90],
    pate_brisee: [420, 12, 2, 1.2, 2, 6, 0, 230], pomme: [54, 0, 11, 0, 1.4, 0.3, 1], banane: [90, 0.1, 15, 0, 2, 1.1, 1], fraises: [33, 0, 6, 0, 2, 0.7, 1]
  };
  // les féculents secs gonflent à la cuisson : le plat pèse plus lourd que ses ingrédients crus
  const CUISSON = { pates: 2.2, riz: 2.5, semoule: 2.2, quinoa: 2.7, lentilles_corail: 2.5, lentilles_vertes: 2.5, pois_casses: 2.5, flocons_avoine: 1 };

  const paliers = (v, seuils) => seuils.filter((s) => v > s).length;
  /** Nutri-Score 2017 (aliments solides), valeurs pour 100 g → { points, lettre } */
  function nutriscore(c) {
    const kj = c.kcal * 4.184;
    const n = paliers(kj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350])
      + paliers(c.sucres, [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45])
      + paliers(c.ags, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      + paliers(c.sel * 400, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);   // sodium (mg) = sel × 400
    const fl = c.fl > 80 ? 5 : c.fl > 60 ? 2 : c.fl > 40 ? 1 : 0;
    const fib = paliers(c.fibres, [0.9, 1.9, 2.8, 3.7, 4.7]);
    const prot = paliers(c.prot, [1.6, 3.2, 4.8, 6.4, 8.0]);
    const points = n >= 11 && fl < 5 ? n - fib - fl : n - fib - fl - prot;
    const lettre = points <= -1 ? 'A' : points <= 2 ? 'B' : points <= 10 ? 'C' : points <= 18 ? 'D' : 'E';
    return { points, lettre };
  }

  const cache = new Map();
  /**
   * rec : { id, ing: [[id, quantité par portion]], gourmand? } ; ING : catalogue (unités)
   * → { kcal (par portion), lettre, points, pour100: {...}, couverture (part du poids connue) } ou null
   */
  function de(rec, ING) {
    if (!rec || !rec.ing) return null;
    const cle = rec.id + '|' + JSON.stringify(rec.ing);
    if (cache.has(cle)) return cache.get(cle);
    let poids = 0, poidsConnu = 0, poidsCuit = 0;
    const s = { kcal: 0, ags: 0, sucres: 0, sel: 0, fibres: 0, prot: 0, fl: 0 };
    for (const [id, q] of rec.ing) {
      const i = ING[id];
      if (!i || i.perso) { poids += 30; continue; }       // ingrédient inconnu : compté dans le poids, pas dans les valeurs
      const t = T[id];
      const g = i.unite === 'pièce' ? q * ((t && t[7]) || 100) : q;
      poids += g;
      poidsCuit += g * (CUISSON[id] || 1);
      if (!t) continue;
      poidsConnu += g;
      const k = g / 100;
      s.kcal += t[0] * k; s.ags += t[1] * k; s.sucres += t[2] * k; s.sel += t[3] * k; s.fibres += t[4] * k; s.prot += t[5] * k; s.fl += t[6] * g;
    }
    if (!poids) return null;
    if (!rec.gourmand) { s.sel += 0.6; }                  // sel de cuisson d'un plat salé (environ 0,6 g par part)
    const total = Math.max(poidsCuit, 1);
    const pour100 = { kcal: s.kcal / total * 100, ags: s.ags / total * 100, sucres: s.sucres / total * 100, sel: s.sel / total * 100, fibres: s.fibres / total * 100, prot: s.prot / total * 100, fl: s.fl / total * 100 };
    const couverture = poidsConnu / poids;
    const ns = couverture >= 0.7 ? nutriscore(pour100) : null;
    const r = { kcal: Math.round(s.kcal / 10) * 10, lettre: ns ? ns.lettre : null, points: ns ? ns.points : null, pour100, couverture, parPortion: s, poids, poidsConnu };
    cache.set(cle, r);
    return r;
  }
  /* ---------- bilan de la semaine, pour un adulte (déjeuners, dîners, desserts et goûters prévus) ---------- */
  const ROUGE = new Set(['boeuf_hache']);
  const CHARCUTERIE = new Set(['jambon', 'lardons', 'saucisse']);
  const VOLAILLE = new Set(['poulet_filet', 'cuisses_poulet']);
  const POISSON = new Set(['saumon', 'colin', 'thon']);
  const GRAS = new Set(['saumon']);
  const LEGUMINEUSES = new Set(['lentilles_corail', 'lentilles_vertes', 'pois_chiches', 'haricots_rouges', 'haricots_blancs', 'pois_casses']);
  const LAITAGES = new Set(['lait', 'yaourt', 'emmental', 'mozzarella', 'feta']);
  /**
   * plan (semaine Budgétable), REC, ING → totaux par jour et repères pour un adulte.
   * Repères : PNNS / ANSES (adulte), ramenés aux deux repas principaux quand c'est pertinent.
   */
  function bilanSemaine(plan, REC, ING) {
    if (!plan) return null;
    const t = { kcal: 0, prot: 0, fibres: 0, sucres: 0, ags: 0, sel: 0 };
    const g = { rouge: 0, charcuterie: 0, volaille: 0, poisson: 0, legumes: 0 };
    const n = { poisson: 0, gras: 0, legumineuses: 0, laitages: 0, repas: 0, gourmand: 0 };
    let sucresGourmand = 0, poids = 0, poidsConnu = 0, dehors = 0;
    const jours = plan.jours.filter((jp) => jp.dejeuner || jp.diner || (jp.gourmand || []).length).length || 7;
    const ajouter = (rec, gourmand) => {
      const r = de(rec, ING);
      if (!r) return;
      for (const k of Object.keys(t)) t[k] += r.parPortion[k] || 0;
      poids += r.poids || 0; poidsConnu += r.poidsConnu || 0;
      if (gourmand) { sucresGourmand += r.parPortion.sucres; n.gourmand++; return; }
      n.repas++;
      const ids = rec.ing.map(([id]) => id);
      for (const [id, q] of rec.ing) {
        const i = ING[id]; if (!i || i.perso) continue;
        if (ROUGE.has(id)) g.rouge += q; if (CHARCUTERIE.has(id)) g.charcuterie += q; if (VOLAILLE.has(id)) g.volaille += q; if (POISSON.has(id)) g.poisson += q;
        if (i.groupe === 'L' && i.unite !== 'pièce') g.legumes += q;
        if (i.groupe === 'L' && i.unite === 'pièce') g.legumes += q * ((T[id] && T[id][7]) || 100);
      }
      if (ids.some((id) => POISSON.has(id))) n.poisson++;
      if (ids.some((id) => GRAS.has(id))) n.gras++;
      if (ids.some((id) => LEGUMINEUSES.has(id))) n.legumineuses++;
      if (ids.some((id) => LAITAGES.has(id))) n.laitages++;
    };
    for (const jp of plan.jours) {
      for (const sl of ['dejeuner', 'diner']) { if (jp[sl] && !jp[sl].dehors && REC[jp[sl].recette]) ajouter(REC[jp[sl].recette], false); else dehors++; }
      for (const x of jp.gourmand || []) if (REC[x.recette]) ajouter(REC[x.recette], true);
    }
    if (!n.repas) return null;
    // ramené à une journée de deux repas (déjeuner + dîner) : un repas pris dehors ou déjà passé ne fait pas baisser la moyenne
    const parJour = (v) => v / Math.max(1, n.repas / 2);
    const r1 = (v) => Math.round(v * 10) / 10;
    // [clé, libellé, valeur, unité, mini, maxi, repère affiché, conseil si pas assez, conseil si trop]
    const reperes = [
      ['prot', 'Protéines', Math.round(parJour(t.prot)), 'g / jour', 40, null, '40 g et plus sur les 2 repas', 'Ajoutez des œufs, du poisson, des légumineuses ou un laitage aux repas.', ''],
      ['fibres', 'Fibres', Math.round(parJour(t.fibres)), 'g / jour', 20, null, '20 g et plus (30 g sur la journée)', 'Plus de légumes, de légumineuses et de pain ou pâtes complets.', ''],
      ['legumes', 'Légumes', Math.round(parJour(g.legumes)), 'g / jour', 300, null, '300 g et plus (en plus des fruits)', 'Un légume en plus à chaque repas : crudités, soupe, poêlée.', ''],
      ['sel', 'Sel', r1(parJour(t.sel)), 'g / jour', null, 4, 'moins de 4 g (5 g sur la journée)', '', 'Moins de charcuterie, de fromage et de bouillon ; goûtez avant de saler.'],
      ['ags', 'Graisses saturées', Math.round(parJour(t.ags)), 'g / jour', null, 16, 'moins de 16 g sur les 2 repas', '', 'Moins de beurre, de crème, de charcuterie et de fromage.'],
      ['sucres', 'Sucres', Math.round(parJour(t.sucres)), 'g / jour', null, 50, 'moins de 50 g (desserts compris)', '', 'Moins de desserts sucrés : fruits et yaourts nature.'],
      ['rouge', 'Viande rouge', Math.round(g.rouge), 'g / semaine', null, 500, 'moins de 500 g par semaine', '', 'Remplacez une viande rouge par de la volaille, du poisson ou des légumineuses.'],
      ['charcuterie', 'Charcuterie', Math.round(g.charcuterie), 'g / semaine', null, 150, 'moins de 150 g par semaine', '', 'Gardez lardons et jambon pour une ou deux recettes.'],
      ['poisson', 'Poisson', n.poisson, 'repas / semaine', 2, null, '2 par semaine, dont 1 gras', 'Ajoutez un repas de poisson, par exemple du saumon.', ''],
      ['legumineuses', 'Légumineuses', n.legumineuses, 'repas / semaine', 2, null, '2 par semaine et plus', 'Lentilles, pois chiches ou haricots : économiques et riches en fibres.', ''],
      ['laitages', 'Laitages dans les repas', n.laitages, 'repas / semaine', 5, null, 'environ 1 repas sur 2 (2 laitages par jour au total)', 'Un yaourt ou un morceau de fromage en fin de repas.', '']
    ].map(([cle, nom, valeur, unite, mini, maxi, repere, conseilBas, conseilHaut]) => {
      const etat = mini != null && valeur < mini ? 'bas' : maxi != null && valeur > maxi ? 'haut' : 'ok';
      return { cle, nom, valeur, unite, repere, etat, mini, maxi, conseil: etat === 'bas' ? conseilBas : etat === 'haut' ? conseilHaut : '' };
    });
    // couverture : part du poids des ingrédients dont les valeurs nutritionnelles sont connues (le reste compte pour 0 kcal)
    return { kcal: Math.round(parJour(t.kcal) / 10) * 10, kcalRepas: Math.round(t.kcal / n.repas / 10) * 10, couverture: poids ? poidsConnu / poids : 1, repasHorsMaison: dehors, jours, repas: n.repas, gourmand: n.gourmand, poissonGras: n.gras, volaille: Math.round(g.volaille), reperes, atteints: reperes.filter((r) => r.etat === 'ok').length };
  }
  const api = { de, nutriscore, bilanSemaine, TABLE: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Nutrition = api;
})(typeof window !== 'undefined' ? window : globalThis);
