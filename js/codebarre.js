/* Budgétable — lecture des codes-barres EAN-13 / UPC-A dans une photo, sans service extérieur.
 * Le navigateur sait parfois le faire (BarcodeDetector) ; sinon ce petit lecteur balaie l'image
 * ligne par ligne (et en colonnes, pour un code posé de travers), et ne garde que les codes
 * dont la clé de contrôle est juste.
 */
(function (root) {
  'use strict';
  // largeurs (en modules) des chiffres : code L (espace, barre, espace, barre) ; G = L à l'envers ; R = L
  const L = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'].map((s) => s.split('').map(Number));
  const G = L.map((p) => p.slice().reverse());
  const PREMIER = { LLLLLL: 0, LLGLGG: 1, LLGGLG: 2, LLGGGL: 3, LGLLGG: 4, LGGLLG: 5, LGGGLL: 6, LGLGLG: 7, LGLGGL: 8, LGGLGL: 9 };

  function cleOk(code) {
    if (!/^\d{13}$/.test(code)) return false;
    let s = 0;
    for (let i = 0; i < 12; i++) s += (+code[i]) * (i % 2 ? 3 : 1);
    return (10 - (s % 10)) % 10 === +code[12];
  }
  // un chiffre à partir de 4 largeurs : le motif le plus proche, s'il est assez proche
  // distances bord à bord (barre + espace voisins) : insensibles au flou et à l'encre qui bave ;
  // les largeurs brutes départagent 1/7 et 2/8, qui ont les mêmes distances
  function chiffre(runs, motifs) {
    const tot = runs[0] + runs[1] + runs[2] + runs[3];
    const n = runs.map((x) => x * 7 / tot);
    let meilleur = -1, ecart = Infinity;
    for (let d = 0; d < 10; d++) {
      const m = motifs[d];
      let e = Math.abs(n[0] + n[1] - m[0] - m[1]) + Math.abs(n[1] + n[2] - m[1] - m[2]) + Math.abs(n[2] + n[3] - m[2] - m[3]);
      for (let k = 0; k < 4; k++) e += 0.35 * Math.abs(n[k] - m[k]);
      if (e < ecart) { ecart = e; meilleur = d; }
    }
    return { d: meilleur, e: ecart };
  }
  function chiffreGauche(runs) {
    const a = chiffre(runs, L), b = chiffre(runs, G);
    return a.e <= b.e ? { ...a, p: 'L' } : { ...b, p: 'G' };
  }
  // décode à partir des longueurs de plages (alternance clair/sombre), la 1re plage étant sombre à l'indice i
  function essayer(r, i) {
    if (i + 59 > r.length) return null;
    const w = (r[i] + r[i + 1] + r[i + 2]) / 3;
    if (w < 0.8) return null;
    for (let k = 0; k < 3; k++) if (Math.abs(r[i + k] - w) > w * 0.7 + 0.6) return null;
    if (i > 0 && r[i - 1] < w * 3) return null;          // marge claire avant le code
    // l'encre « bave » (flou, seuil) : les barres paraissent plus larges que les espaces ; on corrige
    const bave = ((r[i] + r[i + 2]) / 2 - r[i + 1]) / 2;
    const corr = (q, barresImpaires) => q.map((x, k) => Math.max(0.3, (k % 2 === (barresImpaires ? 1 : 0)) ? x - bave : x + bave));
    let pos = i + 3, parite = '', chiffres = [], erreur = 0;
    for (let n = 0; n < 6; n++) {
      const c = chiffreGauche(corr(r.slice(pos, pos + 4), true)); if (c.e > 1.6) return null;
      parite += c.p; chiffres.push(c.d); erreur += c.e; pos += 4;
    }
    const tm = r.slice(pos, pos + 5); const wm = tm.reduce((a, b) => a + b, 0) / 5;
    if (tm.some((x) => Math.abs(x - wm) > wm * 0.8 + 0.6)) return null;
    pos += 5;
    for (let n = 0; n < 6; n++) {
      const c = chiffre(corr(r.slice(pos, pos + 4), false), L); if (c.e > 1.6) return null;
      chiffres.push(c.d); erreur += c.e; pos += 4;
    }
    const premier = PREMIER[parite];
    if (premier == null) return null;
    const code = premier + chiffres.join('');
    return cleOk(code) ? { code, erreur } : null;
  }
  function plages(ligne) {
    // seuil local : moyenne glissante (gère l'éclairage inégal)
    const n = ligne.length, f = Math.max(8, Math.round(n / 24));
    const cum = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) cum[k + 1] = cum[k] + ligne[k];
    let mn = 255, mx = 0; for (let k = 0; k < n; k++) { if (ligne[k] < mn) mn = ligne[k]; if (ligne[k] > mx) mx = ligne[k]; }
    if (mx - mn < 40) return null;
    const runs = []; const sombres = [];
    let cur = null, len = 0;
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - f), b = Math.min(n, k + f);
      const seuil = Math.min((cum[b] - cum[a]) / (b - a), (mn + mx) / 2 + (mx - mn) * 0.15);
      const s = ligne[k] < seuil;
      if (s === cur) len++; else { if (cur !== null) { runs.push(len); sombres.push(cur); } cur = s; len = 1; }
    }
    runs.push(len); sombres.push(cur);
    return { runs, sombres };
  }
  function lireLigne(ligne, trouves) {
    for (const sens of [1, -1]) {
      const l = sens === 1 ? ligne : ligne.slice().reverse();
      const p = plages(l); if (!p) continue;
      for (let i = 0; i < p.runs.length - 58; i++) {
        if (!p.sombres[i]) continue;
        const r = essayer(p.runs, i);
        if (r) { trouves.set(r.code, (trouves.get(r.code) || 0) + 1); i += 58; }
      }
    }
  }
  /** imageData (RGBA) → liste des codes EAN-13 lus (les plus sûrs d'abord) */
  function lireCodes(img) {
    const { width: W, height: H, data } = img;
    const gris = new Uint8ClampedArray(W * H);
    for (let k = 0, j = 0; k < gris.length; k++, j += 4) gris[k] = (data[j] * 0.3 + data[j + 1] * 0.59 + data[j + 2] * 0.11);
    const trouves = new Map();
    const pas = Math.max(2, Math.round(H / 90));
    for (let y = Math.round(pas / 2); y < H; y += pas) lireLigne(gris.subarray(y * W, (y + 1) * W), trouves);
    const pasX = Math.max(2, Math.round(W / 90));
    const col = new Uint8ClampedArray(H);
    for (let x = Math.round(pasX / 2); x < W; x += pasX) { for (let y = 0; y < H; y++) col[y] = gris[y * W + x]; lireLigne(col, trouves); }
    return [...trouves.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }
  /** Blob ou fichier image → codes lus (BarcodeDetector du navigateur si présent, sinon notre lecteur) */
  async function lirePhoto(fichier) {
    const bmp = await createImageBitmap(fichier);
    const codes = new Set();
    if ('BarcodeDetector' in root) {
      try {
        const det = new root.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'ean_8'] });
        for (const b of await det.detect(bmp)) {
          let v = String(b.rawValue || '');
          if (/^\d{12}$/.test(v)) v = '0' + v;
          if (cleOk(v) || /^\d{8}$/.test(v)) codes.add(v);
        }
      } catch (e) { /* lecteur maison ci-dessous */ }
    }
    if (!codes.size) {
      for (const larg of [1200, 800, 1700]) {
        const k = Math.min(1, larg / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, c.width, c.height);
        lireCodes(g.getImageData(0, 0, c.width, c.height)).forEach((x) => codes.add(x));
        if (codes.size) break;
      }
    }
    return [...codes];
  }
  const api = { lireCodes, lirePhoto, cleOk };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CodeBarre = api;
})(typeof window !== 'undefined' ? window : globalThis);
