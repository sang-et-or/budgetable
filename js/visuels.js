/* Budgétable — illustrations des plats (V0.3)
 * Chaque plat reçoit un dessin vu de dessus, calculé à partir de ses
 * ingrédients et de sa forme (assiette, bol, gratin, pizza…). Ce ne sont pas
 * des photos : de vraies photos pourront remplacer ces dessins plus tard,
 * avec des images dont les droits sont acquis.
 */
(function (root) {
  const C = {
    poulet_filet: '#e9c08a', cuisses_poulet: '#c98a4b', boeuf_hache: '#7b3a2a', saumon: '#f08a5d', colin: '#f4efe4', thon: '#c8a07a',
    oeufs: '#f6c945', tofu: '#efe6c9', pois_chiches: '#d8b06a', lentilles_corail: '#e6833a', lentilles_vertes: '#6f6a3a',
    haricots_rouges: '#8c2d2d', jambon: '#f2a5a0', lardons: '#c8675a', saucisse: '#9b4f2c', feta: '#fbfaf3', mozzarella: '#fffdf6', emmental: '#f5d76e',
    courgette: '#4f8a3c', carotte: '#f08c2b', poivron: '#d7372f', poireau: '#a5c96d', champignon: '#cdb79c', brocoli: '#2f7d32', epinards: '#2e5e2a',
    haricots_verts: '#4c8a3f', petits_pois: '#79b342', aubergine: '#5b2a5e', courge: '#f4a340', tomate: '#e04b3a', mais: '#f6d34a', salade: '#8cc152',
    oignon: '#e9d8c4', concombre: '#7fb069', citron: '#f7e05e', persil: '#3e8e41',
    chataignes: '#8a5a33', poire: '#d9d36c', navet: '#efe6f0', panais: '#eedfb9', celeri_rave: '#e9dfc2', chou_fleur: '#f3eedb', endives: '#eef0c4', betterave: '#8e1f3f', reblochon: '#f3e2b0', boeuf_braiser: '#6e2c22', choucroute: '#e9e1a8', raclette: '#f2d98a', patate_douce: '#e8853f', chou: '#c9d99a',
    riz: '#fbf7ec', pates: '#f2cf72', semoule: '#efd59c', quinoa: '#e7d8b8', pomme_de_terre: '#e8c167', tortillas: '#e9cf9f', pain: '#d39b52', pain_mie: '#f1dcb0', farine: '#f5ecd8'
  };
  const SAUCE = { curry: '#e2a03f', mijote: '#c4512f', veloute: null, pates: '#d9573f', wok: '#8a5a2b' };

  function graine(txt) { let h = 2166136261; for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function alea(seed) { let a = seed; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const f1 = (n) => Math.round(n * 10) / 10;

  // morceaux répartis dans un disque de rayon R autour de (cx, cy)
  function morceaux(r, couleur, n, cx, cy, R, forme) {
    let h = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
      const x = f1(cx + Math.cos(a) * d), y = f1(cy + Math.sin(a) * d), rot = Math.round(r() * 180);
      if (forme === 'baton') h += `<rect x="${x - 5}" y="${y - 1.6}" width="10" height="3.2" rx="1.6" fill="${couleur}" transform="rotate(${rot} ${x} ${y})"/>`;
      else if (forme === 'bloc') h += `<rect x="${x - 4}" y="${y - 3}" width="8" height="6" rx="1.6" fill="${couleur}" stroke="rgb(0 0 0 / .12)" stroke-width=".6" transform="rotate(${rot} ${x} ${y})"/>`;
      else if (forme === 'grain') h += `<circle cx="${x}" cy="${y}" r="1.5" fill="${couleur}"/>`;
      else h += `<circle cx="${x}" cy="${y}" r="${f1(2.2 + r() * 1.6)}" fill="${couleur}" stroke="rgb(0 0 0 / .1)" stroke-width=".5"/>`;
    }
    return h;
  }

  function dessin(rec, E) {
    const r = alea(graine(rec.id));
    const ing = rec.ing.map(([id]) => ({ id, i: E.ING[id] }));
    const fec = ing.find((x) => x.i.groupe === 'F');
    const prots = ing.filter((x) => x.i.groupe === 'P' || (x.i.groupe === 'D' && x.id !== 'lait' && x.id !== 'creme' && x.id !== 'yaourt'));
    const legs = ing.filter((x) => x.i.groupe === 'L' && x.id !== 'oignon' && x.id !== 'ail' && x.id !== 'tomates_concassees');
    const forme = rec.forme || (rec.modele === 'maison' ? 'assiette' : 'assiette');
    const col = (x) => C[x.id] || '#cfc7b4';
    const garniture = (cx, cy, R) => {
      let h = '';
      prots.slice(0, 2).forEach((p) => { h += morceaux(r, col(p), p.id === 'thon' || p.id.startsWith('lentilles') ? 10 : 5, cx, cy, R, ['pois_chiches', 'haricots_rouges', 'lentilles_corail', 'lentilles_vertes', 'oeufs'].includes(p.id) ? 'rond' : 'bloc'); });
      legs.slice(0, 3).forEach((l) => { h += morceaux(r, col(l), l.id === 'mais' || l.id === 'petits_pois' ? 12 : 6, cx, cy, R, ['haricots_verts', 'poireau', 'carotte', 'courgette'].includes(l.id) && r() > 0.4 ? 'baton' : 'rond'); });
      return h;
    };
    let corps = '';
    if (forme === 'bol' || forme === 'soupe' || forme === 'saladier') {
      const fond = forme === 'soupe' ? (legs[0] ? col(legs[0]) : '#e9a24b') : forme === 'saladier' ? '#8cc152' : SAUCE[rec.modele] || (fec ? col(fec) : '#e8d3a8');
      corps += `<circle cx="50" cy="50" r="40" fill="#f7f3ea" stroke="#d9cfbd" stroke-width="2"/><circle cx="50" cy="50" r="33" fill="${fond}"/>`;
      if (forme === 'soupe') {
        corps += `<path d="M38 46 q12 -8 24 0 q-12 8 -24 0" fill="#fffaf0" opacity=".75"/>`;
        if (prots.some((p) => p.id === 'oeufs')) corps += `<ellipse cx="62" cy="58" rx="9" ry="7" fill="#fff"/><circle cx="62" cy="58" r="4" fill="#f6b93b"/>`;
        else corps += morceaux(r, prots[0] ? col(prots[0]) : '#d39b52', 6, 50, 52, 20, prots[0] && prots[0].id === 'emmental' ? 'bloc' : 'rond');
      } else {
        if (fec && forme === 'bol' && SAUCE[rec.modele]) corps += `<path d="M24 52 a26 26 0 0 0 26 22 a26 26 0 0 0 0 -44 a26 26 0 0 0 -26 22z" fill="${col(fec)}" opacity=".95"/>`;
        else if (fec) corps += `<ellipse cx="44" cy="54" rx="16" ry="13" fill="${col(fec)}"/>`;
        corps += garniture(56, 46, 22);
      }
    } else if (forme === 'plat') {
      corps += `<rect x="10" y="20" width="80" height="60" rx="14" fill="#a95d33"/><rect x="16" y="26" width="68" height="48" rx="10" fill="#e6b24d"/>`;
      for (let i = 0; i < 14; i++) corps += `<circle cx="${f1(22 + r() * 56)}" cy="${f1(30 + r() * 40)}" r="${f1(1.5 + r() * 2.5)}" fill="#b9762c" opacity=".55"/>`;
      legs.slice(0, 2).forEach((l) => { corps += morceaux(r, col(l), 4, 50, 50, 22, 'rond'); });
    } else if (forme === 'tarte' || forme === 'pizza') {
      const pizza = forme === 'pizza';
      corps += `<circle cx="50" cy="50" r="40" fill="${pizza ? '#e2b56b' : '#d39b52'}"/><circle cx="50" cy="50" r="33" fill="${pizza ? '#d9452f' : '#f3d27a'}"/>`;
      if (pizza) corps += morceaux(r, '#fffdf6', 7, 50, 50, 24, 'rond').replace(/r="[\d.]+"/g, 'r="5"');
      corps += garniture(50, 50, 24);
    } else if (forme === 'wrap') {
      corps += `<circle cx="50" cy="50" r="40" fill="#f7f3ea" stroke="#d9cfbd" stroke-width="2"/>`;
      [[34, -18], [62, 14]].forEach(([x, rot]) => {
        corps += `<g transform="rotate(${rot} ${x} 50)"><rect x="${x - 12}" y="24" width="24" height="52" rx="12" fill="#e9cf9f" stroke="#c9a66b" stroke-width="1.2"/><ellipse cx="${x}" cy="27" rx="10" ry="5" fill="#8cc152"/>${prots[0] ? `<circle cx="${x - 4}" cy="27" r="2.4" fill="${col(prots[0])}"/>` : ''}${legs[0] ? `<circle cx="${x + 4}" cy="28" r="2.2" fill="${col(legs[0])}"/>` : ''}</g>`;
      });
    } else {
      corps += `<circle cx="50" cy="50" r="40" fill="#f7f3ea" stroke="#d9cfbd" stroke-width="2"/><circle cx="50" cy="50" r="33" fill="#fffdf8"/>`;
      if (rec.modele === 'omelette' || (rec.modele === 'maison' && prots.some((p) => p.id === 'oeufs') && !fec)) corps += `<path d="M24 50 a26 20 0 0 1 52 0 z" fill="#f6c945"/>`;
      if (fec) corps += fec.id === 'pain' ? `<rect x="58" y="62" width="20" height="9" rx="4.5" fill="#d39b52" transform="rotate(-20 68 66)"/>` : `<ellipse cx="38" cy="56" rx="15" ry="12" fill="${col(fec)}"/>${fec.id === 'pates' ? morceaux(r, '#e3b54f', 8, 38, 56, 10, 'baton') : fec.id === 'riz' || fec.id === 'semoule' || fec.id === 'quinoa' ? morceaux(r, '#e2d6bd', 14, 38, 56, 11, 'grain') : ''}`;
      if (rec.modele === 'pates' || (rec.modele === 'maison' && rec.id.includes('pates'))) corps += `<circle cx="56" cy="44" r="12" fill="${rec.id.includes('cre') ? '#f5ead0' : '#d9573f'}" opacity=".85"/>`;
      corps += garniture(58, 46, 18);
    }
    return corps;
  }

  /** Renvoie le dessin SVG d'un plat (taille en pixels). */
  function illustration(rec, E, taille) {
    return `<svg class="illu" viewBox="0 0 100 100" width="${taille}" height="${taille}" aria-hidden="true" focusable="false">${dessin(rec, E)}</svg>`;
  }

  root.Visuels = { illustration };
})(typeof window !== 'undefined' ? window : globalThis);
