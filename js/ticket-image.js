/* Budgétable — préparation de la photo d'un ticket avant la lecture sur l'appareil (fonctions pures sur des niveaux de gris).
 *
 * 1. Repère le ticket (papier clair) sur la table et le remet à plat en corrigeant la perspective.
 * 2. Corrige l'inclinaison restante (profil des lignes de texte).
 * 3. Aplanit le papier gondolé : chaque bande verticale est recalée sur sa voisine pour que les prix restent
 *    alignés avec leurs libellés.
 * 4. Corrige l'éclairage (ombres, dégradés) et met le texte à la bonne taille pour la lecture.
 *
 * pretraiter(gris, largeur, hauteur) → { gris, largeur, hauteur, infos }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TicketImage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const img = (w, h, d) => ({ w, h, d: d || new Uint8ClampedArray(w * h) });

  function redim(s, k) {
    const w = Math.max(1, Math.round(s.w * k)), h = Math.max(1, Math.round(s.h * k)), o = img(w, h);
    if (k < 1) { // réduction : moyenne des pixels couverts (pas d'aliasing)
      const sum = new Float64Array(w * h), cnt = new Float64Array(w * h);
      for (let y = 0; y < s.h; y++) { const oy = Math.min(h - 1, Math.floor(y * k)); for (let x = 0; x < s.w; x++) { const j = oy * w + Math.min(w - 1, Math.floor(x * k)); sum[j] += s.d[y * s.w + x]; cnt[j]++; } }
      for (let i = 0; i < w * h; i++) o.d[i] = cnt[i] ? sum[i] / cnt[i] : 255;
      return o;
    }
    for (let y = 0; y < h; y++) {
      const sy = Math.min(s.h - 1.001, Math.max(0, (y + 0.5) / k - 0.5)), y0 = Math.floor(sy), fy = sy - y0;
      for (let x = 0; x < w; x++) {
        const sx = Math.min(s.w - 1.001, Math.max(0, (x + 0.5) / k - 0.5)), x0 = Math.floor(sx), fx = sx - x0, i = y0 * s.w + x0;
        o.d[y * w + x] = (s.d[i] * (1 - fx) + s.d[i + 1] * fx) * (1 - fy) + (s.d[i + s.w] * (1 - fx) + s.d[i + s.w + 1] * fx) * fy;
      }
    }
    return o;
  }
  function echantillon(s, x, y) {
    if (x < 0 || y < 0 || x > s.w - 1 || y > s.h - 1) return 255;
    const x0 = Math.min(s.w - 2, Math.floor(x)), y0 = Math.min(s.h - 2, Math.floor(y)), fx = x - x0, fy = y - y0, i = y0 * s.w + x0;
    return (s.d[i] * (1 - fx) + s.d[i + 1] * fx) * (1 - fy) + (s.d[i + s.w] * (1 - fx) + s.d[i + s.w + 1] * fx) * fy;
  }
  function otsu(d) {
    const h = new Float64Array(256); for (let i = 0; i < d.length; i++) h[d[i] | 0]++;
    let tot = d.length, sum = 0; for (let v = 0; v < 256; v++) sum += v * h[v];
    let sB = 0, wB = 0, best = 0, seuil = 128;
    for (let v = 0; v < 256; v++) { wB += h[v]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sB += v * h[v]; const mB = sB / wB, mF = (sum - sB) / wF, b = wB * wF * (mB - mF) * (mB - mF); if (b > best) { best = b; seuil = v; } }
    return seuil;
  }
  // flou en boîte séparable (rayon r), sur Float32
  function flou(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { let acc = 0; const o = y * w; for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[o + x] = acc / (2 * r + 1); acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = acc / (2 * r + 1); acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
    return out;
  }
  // maximum glissant séparable (rayon r) : fond du papier sans le texte
  function maxGlissant(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    const passe = (lire, ecrire, n, m) => { const buf = new Float32Array(n); for (let j = 0; j < m; j++) { for (let i = 0; i < n; i++) buf[i] = lire(j, i); const dq = []; let t = 0; const res = new Float32Array(n);
      // file monotone
      const q = new Int32Array(n + 1); let qh = 0, qt = 0;
      for (let i = 0; i < n + r; i++) { if (i < n) { while (qt > qh && buf[q[qt - 1]] <= buf[i]) qt--; q[qt++] = i; } const c = i - r; if (c >= 0) { while (q[qh] < c - r) qh++; res[c] = buf[q[qh]]; } }
      for (let i = 0; i < n; i++) ecrire(j, i, res[i]); void dq; void t; } };
    passe((y, x) => src[y * w + x], (y, x, v) => { tmp[y * w + x] = v; }, w, h);
    passe((x, y) => tmp[y * w + x], (x, y, v) => { out[y * w + x] = v; }, h, w);
    return out;
  }

  /** Le ticket sur la photo : 4 coins du plus grand objet clair, ou null s'il occupe toute la photo ou est introuvable. */
  function trouverPapier(s) {
    const k = Math.min(1, 500 / Math.max(s.w, s.h)), p = redim(s, k);
    const f = flou(Float32Array.from(p.d), p.w, p.h, 2);
    const seuil = otsu(Uint8ClampedArray.from(f));
    // seuil bas (hystérésis) : la partie du papier dans l'ombre reste du papier si elle touche la partie claire
    let sb = 0, nb = 0, sh = 0, nh = 0; for (let i = 0; i < f.length; i++) if (f[i] > seuil) { sh += f[i]; nh++; } else { sb += f[i]; nb++; }
    const fondM = nb ? sb / nb : 0, papM = nh ? sh / nh : 255, bas = fondM + 0.45 * (papM - fondM);
    const clair = new Uint8Array(p.w * p.h); for (let i = 0; i < f.length; i++) clair[i] = f[i] > seuil ? 2 : f[i] > bas ? 1 : 0;
    // fermeture : le texte ne doit pas trouer le papier (dilatation du clair)
    const lab = new Int32Array(p.w * p.h); let meilleur = null, num = 0;
    for (let i0 = 0; i0 < clair.length; i0++) {
      if (clair[i0] !== 2 || lab[i0]) continue;
      num++; const pile = [i0]; lab[i0] = num; let n = 0, bord = 0;
      while (pile.length) {
        const i = pile.pop(), x = i % p.w, y = (i / p.w) | 0; n++;
        if (x === 0 || y === 0 || x === p.w - 1 || y === p.h - 1) bord++;
        for (const j of [i - 1, i + 1, i - p.w, i + p.w]) if (j >= 0 && j < clair.length && clair[j] && !lab[j] && Math.abs((j % p.w) - x) <= 1) { lab[j] = num; pile.push(j); }
      }
      if (!meilleur || n > meilleur.n) meilleur = { n, bord, num };
    }
    if (!meilleur) return null;
    const aire = p.w * p.h, perim = 2 * (p.w + p.h);
    if (meilleur.n < aire * 0.08 || meilleur.n > aire * 0.93 || meilleur.bord > perim * 0.35) return null;
    // contour du papier (pixels du papier touchant l'extérieur)
    const pts = [];
    for (let y = 1; y < p.h - 1; y++) for (let x = 1; x < p.w - 1; x++) { const i = y * p.w + x; if (lab[i] === meilleur.num && (lab[i - 1] !== meilleur.num || lab[i + 1] !== meilleur.num || lab[i - p.w] !== meilleur.num || lab[i + p.w] !== meilleur.num)) pts.push([x, y]); }
    const q = quadrilatere(pts);
    if (!q) return null;
    const c = (t) => [t[0] / k, t[1] / k];
    return { hg: c(q[0]), hd: c(q[1]), bd: c(q[2]), bg: c(q[3]) };
  }
  // enveloppe convexe (chaîne monotone)
  function enveloppe(P) {
    const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  /** Quadrilatère du papier : rectangle d'aire minimale, puis chaque bord réajusté sur le contour (droite prolongée,
   *  ce qui retrouve un coin même s'il est dans l'ombre). Coins dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche. */
  function quadrilatere(pts) {
    if (pts.length < 40) return null;
    const H = enveloppe(pts); if (H.length < 4) return null;
    let best = null;
    for (let i = 0; i < H.length; i++) {
      const a = H[i], b = H[(i + 1) % H.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      let mnU = Infinity, mxU = -Infinity, mnV = Infinity, mxV = -Infinity;
      for (const p of H) { const u = p[0] * ux + p[1] * uy, v = -p[0] * uy + p[1] * ux; if (u < mnU) mnU = u; if (u > mxU) mxU = u; if (v < mnV) mnV = v; if (v > mxV) mxV = v; }
      const ar = (mxU - mnU) * (mxV - mnV);
      if (!best || ar < best.ar) best = { ar, ux, uy, mnU, mxU, mnV, mxV };
    }
    const { ux, uy } = best;
    const P = (u, v) => [u * ux - v * uy, u * uy + v * ux];
    // 4 côtés du rectangle : (point, direction)
    const cotes = [[P(best.mnU, best.mnV), [ux, uy]], [P(best.mxU, best.mnV), [-uy, ux]], [P(best.mxU, best.mxV), [-ux, -uy]], [P(best.mnU, best.mxV), [uy, -ux]]];
    const lignes = cotes.map(([o, d], k) => {
      const lon = k % 2 === 0 ? best.mxU - best.mnU : best.mxV - best.mnV;
      let n = [-d[1], d[0]], c0 = n[0] * o[0] + n[1] * o[1];
      let sel = pts.filter((p) => { const t = (p[0] - o[0]) * d[0] + (p[1] - o[1]) * d[1]; return Math.abs(n[0] * p[0] + n[1] * p[1] - c0) < lon * 0.06 + 3 && t > lon * 0.1 && t < lon * 0.9; });
      // normale tournée vers l'extérieur du papier
      const cxp = (best.mnU + best.mxU) / 2, cyp = (best.mnV + best.mxV) / 2, ctr = P(cxp, cyp);
      if (n[0] * ctr[0] + n[1] * ctr[1] - c0 > 0) { n = [-n[0], -n[1]]; c0 = -c0; }
      let ligne = { n, c: c0 };
      for (let it = 0; it < 3 && sel.length > 8; it++) {
        let mx = 0, my = 0; for (const p of sel) { mx += p[0]; my += p[1]; } mx /= sel.length; my /= sel.length;
        let sxx = 0, syy = 0, sxy = 0; for (const p of sel) { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
        const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), dir = [Math.cos(th), Math.sin(th)];
        let nn = [-dir[1], dir[0]]; if (nn[0] * n[0] + nn[1] * n[1] < 0) nn = [-nn[0], -nn[1]];
        // le bord réel est le plus à l'extérieur : les zones sombres rentrent le contour, jamais ne le sortent
        const sd = sel.map((p) => nn[0] * p[0] + nn[1] * p[1]).sort((a, b) => a - b);
        const cExt = sd[Math.floor(sd.length * 0.95)];
        ligne = { n: nn, c: cExt };
        sel = sel.filter((p) => nn[0] * p[0] + nn[1] * p[1] > cExt - Math.max(3, lon * 0.015));
      }
      return ligne;
    });
    const inter = (A, B) => { const det = A.n[0] * B.n[1] - A.n[1] * B.n[0]; if (Math.abs(det) < 1e-9) return null; return [(A.c * B.n[1] - A.n[1] * B.c) / det, (A.n[0] * B.c - A.c * B.n[0]) / det]; };
    let coins = [inter(lignes[3], lignes[0]), inter(lignes[0], lignes[1]), inter(lignes[1], lignes[2]), inter(lignes[2], lignes[3])];
    const rect = [P(best.mnU, best.mnV), P(best.mxU, best.mnV), P(best.mxU, best.mxV), P(best.mnU, best.mxV)];
    const diag = Math.hypot(best.mxU - best.mnU, best.mxV - best.mnV);
    if (coins.some((c, i) => !c || Math.hypot(c[0] - rect[i][0], c[1] - rect[i][1]) > diag * 0.12)) coins = rect;
    // ordre : haut-gauche = plus petit x+y, puis sens horaire
    const cx = coins.reduce((s, c) => s + c[0], 0) / 4, cy = coins.reduce((s, c) => s + c[1], 0) / 4;
    coins.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    // le côté le plus long est vertical (ticket en hauteur) : on démarre en haut à gauche
    let i0 = 0, m = Infinity; coins.forEach((c, i) => { if (c[0] + c[1] < m) { m = c[0] + c[1]; i0 = i; } });
    coins = coins.slice(i0).concat(coins.slice(0, i0));
    const L01 = Math.hypot(coins[1][0] - coins[0][0], coins[1][1] - coins[0][1]), L12 = Math.hypot(coins[2][0] - coins[1][0], coins[2][1] - coins[1][1]);
    if (L01 > L12 * 1.15) coins = [coins[3], coins[0], coins[1], coins[2]]; // photo prise de côté : on remet le ticket debout
    return coins;
  }
  // homographie (4 points → 4 points), résolution de Gauss
  function homographie(de, vers) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) { const [x, y] = de[i], [u, v] = vers[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
    for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; if (Math.abs(A[c][c]) < 1e-12) return null;
      for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
    return b.map((v, i) => v / A[i][i]).concat(1);
  }
  /** Remet le ticket à plat (perspective) : largeur de sortie imposée. */
  function redresser(s, coins, largeur) {
    const L = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const lw = (L(coins.hg, coins.hd) + L(coins.bg, coins.bd)) / 2, lh = (L(coins.hg, coins.bg) + L(coins.hd, coins.bd)) / 2;
    if (lw < 50 || lh < 50) return null;
    const W = Math.round(largeur), H = Math.round(largeur * lh / lw);
    if (H > 14000) return null;
        const m = 0.01; // un peu de marge autour du papier, pour ne couper aucun caractère
    const vers = [coins.hg, coins.hd, coins.bd, coins.bg];
    const de = [[m * W, m * H * 0.5], [W * (1 - m), m * H * 0.5], [W * (1 - m), H * (1 - m * 0.5)], [m * W, H * (1 - m * 0.5)]];
    const Hm = homographie(de, vers); if (!Hm) return null;
    const o = img(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const z = Hm[6] * x + Hm[7] * y + 1;
      o.d[y * W + x] = (x < m * W * 0.6 || x > W * (1 - m * 0.6) || y < m * H * 0.3 || y > H * (1 - m * 0.3)) ? 255 : echantillon(s, (Hm[0] * x + Hm[1] * y + Hm[2]) / z, (Hm[3] * x + Hm[4] * y + Hm[5]) / z);
    }
    return o;
  }
  /** Corrige l'éclairage : divise par le fond du papier estimé (ombres, dégradés), puis étire le contraste. */
  function eclairage(s, r) {
    const f = Float32Array.from(s.d);
    const fond = flou(maxGlissant(f, s.w, s.h, r), s.w, s.h, r);
    const o = img(s.w, s.h);
    const vals = new Float32Array(s.w * s.h);
    for (let i = 0; i < f.length; i++) vals[i] = Math.min(1.2, f[i] / Math.max(20, fond[i]));
    // étirement : encre (1 %) → noir, papier → blanc
    const tri = Float32Array.from(vals.filter((_, i) => i % 7 === 0)).sort();
    const bas = tri[Math.floor(tri.length * 0.01)], haut = Math.min(1, tri[Math.floor(tri.length * 0.6)]);
    const ech = 255 / Math.max(0.15, haut - bas);
    for (let i = 0; i < vals.length; i++) o.d[i] = (vals[i] - bas) * ech;
    return o;
  }
  // pixels d'encre (sous le seuil d'Otsu), échantillonnés
  function encre(s, pas = 1) {
    const seuil = Math.min(170, otsu(s.d)), xs = [], ys = [];
    for (let y = 0; y < s.h; y += pas) for (let x = 0; x < s.w; x += pas) if (s.d[y * s.w + x] < seuil) { xs.push(x); ys.push(y); }
    return { xs, ys, seuil };
  }
  /** Angle d'inclinaison du texte (degrés) par le profil des lignes : les lignes bien horizontales donnent un profil le plus contrasté. */
  function inclinaison(s, max = 8) {
    const k = Math.min(1, 700 / s.w), p = redim(s, k), e = encre(p);
    if (e.xs.length < 200) return 0;
    const n = e.xs.length, score = (deg) => { const t = Math.tan(deg * Math.PI / 180), h = new Float64Array(p.h + p.w + 2), dec = p.w; for (let i = 0; i < n; i++) { const y = Math.round(e.ys[i] - e.xs[i] * t) + dec; if (y >= 0 && y < h.length) h[y]++; } let sc = 0; for (let i = 0; i < h.length; i++) sc += h[i] * h[i]; return sc; };
    let best = 0, bs = -1;
    for (let a = -max; a <= max; a += 0.5) { const sc = score(a); if (sc > bs) { bs = sc; best = a; } }
    for (let a = best - 0.5; a <= best + 0.5; a += 0.1) { const sc = score(a); if (sc > bs) { bs = sc; best = a; } }
    return Math.round(best * 10) / 10;
  }
  function tourner(s, deg) {
    if (Math.abs(deg) < 0.15) return s;
    const t = deg * Math.PI / 180, c = Math.cos(t), si = Math.sin(t), o = img(s.w, s.h), cx = s.w / 2, cy = s.h / 2;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const dx = x - cx, dy = y - cy; o.d[y * s.w + x] = echantillon(s, cx + dx * c - dy * si, cy + dx * si + dy * c); }
    return o;
  }
  /** Hauteur des lignes de texte (pas entre deux lignes, en px) par autocorrélation du profil horizontal. */
  function pasDesLignes(s) {
    const seuil = Math.min(170, otsu(s.d)), prof = new Float64Array(s.h);
    // bande de gauche (libellés) seulement : un papier gondolé y reste presque droit
    const xa = Math.floor(s.w * 0.04), xb = Math.floor(s.w * 0.45);
    for (let y = 0; y < s.h; y++) { let n = 0; for (let x = xa; x < xb; x++) if (s.d[y * s.w + x] < seuil) n++; prof[y] = n; }
    let moy = 0; for (const v of prof) moy += v; moy /= s.h;
    const ac = (l) => { let a = 0; for (let y = 0; y + l < s.h; y++) a += (prof[y] - moy) * (prof[y + l] - moy); return a / (s.h - l); };
    const lmax = Math.min(160, Math.floor(s.h / 4)), v = [];
    for (let l = 0; l <= lmax + 1; l++) v.push(l >= 10 ? ac(l) : -Infinity);
    const pics = []; for (let l = 11; l <= lmax; l++) if (v[l] > 0 && v[l] >= v[l - 1] && v[l] >= v[l + 1]) pics.push(l);
    if (!pics.length) return 0;
    const top = Math.max(...pics.map((l) => v[l]));
    const best = pics.find((l) => v[l] >= top * 0.3);
    return best || 0;
  }
  /** Papier gondolé : décalage vertical de chaque bande pour l'aligner sur ses voisines (les prix restent sur la ligne de leur libellé). */
  function aplanir(s, pas) {
    if (!(pas > 6)) return { img: s, decalage: 0 };
    const NB = 12, bw = Math.floor(s.w / NB);
    const prof = [], poids = [];
    const seuil = Math.min(170, otsu(s.d));
    for (let b = 0; b < NB; b++) {
      const p = new Float32Array(s.h);
      for (let y = 0; y < s.h; y++) { let n = 0; for (let x = b * bw; x < (b + 1) * bw; x++) if (s.d[y * s.w + x] < seuil) n++; p[y] = n; }
      prof.push(p); poids.push(p.reduce((a, v) => a + v, 0));
    }
    // fenêtres verticales de ~5 lignes, recalées toutes les ~1 ligne
    const fen = Math.round(pas * 5), etape = Math.max(4, Math.round(pas / 2)), maxD = Math.max(2, Math.floor(pas * 0.42));
    const centres = []; for (let c = Math.floor(fen / 2); c < s.h - fen / 2; c += etape) centres.push(c);
    if (!centres.length) return { img: s, decalage: 0 };
    const D = prof.map(() => new Float32Array(centres.length)); // décalage de chaque bande à chaque hauteur
    const corr = (a, b, c, d) => { let s1 = 0, s2 = 0, s3 = 0, m1 = 0, m2 = 0, n = 0; c = Math.round(c); const y0 = Math.round(c - fen / 2), y1 = Math.round(c + fen / 2); for (let y = y0; y < y1; y += 2) { const yb = y + d; if (yb < 0 || yb >= a.length) continue; m1 += a[y]; m2 += b[yb]; n++; } if (!n) return -1; m1 /= n; m2 /= n; for (let y = y0; y < y1; y += 2) { const yb = y + d; if (yb < 0 || yb >= a.length) continue; const u = a[y] - m1, v = b[yb] - m2; s1 += u * v; s2 += u * u; s3 += v * v; } return s2 > 1 && s3 > 1 ? s1 / Math.sqrt(s2 * s3) : -1; };
    const encreFen = (p, c) => { let n = 0; for (let y = Math.max(0, c - fen / 2); y < Math.min(p.length, c + fen / 2); y++) n += p[y]; return n; };
    // bande de référence : la plus encrée ; on propage vers la gauche et la droite en sautant les bandes vides
    const ref = poids.indexOf(Math.max(...poids));
    let maxAbs = 0;
    for (const sens of [-1, 1]) {
      for (let ci = 0; ci < centres.length; ci++) {
        const c = centres[ci]; let der = ref, dDer = 0;
        for (let b = ref + sens; b >= 0 && b < NB; b += sens) {
          const e = encreFen(prof[b], c);
          if (e < bw * 0.6) { D[b][ci] = NaN; continue; }
          let best = 0, bs = -2; const dist = Math.abs(b - der);
          const lim = Math.min(Math.floor(pas * 0.45), maxD * dist);
          for (let d = -lim; d <= lim; d += 2) { const v = corr(prof[der], prof[b], c + Math.round(dDer), Math.round(dDer) + d); if (v > bs) { bs = v; best = d; } }
          for (const d of [best - 1, best + 1]) { if (Math.abs(d) > lim) continue; const v = corr(prof[der], prof[b], c + Math.round(dDer), Math.round(dDer) + d); if (v > bs) { bs = v; best = d; } }
          if (bs < 0.3) { D[b][ci] = NaN; continue; }
          dDer = dDer + best; D[b][ci] = dDer; der = b;
          if (Math.abs(dDer) > maxAbs) maxAbs = Math.abs(dDer);
        }
      }
    }
    if (maxAbs < 1.5) return { img: s, decalage: 0 };
    // lissage vertical et remplissage des trous par les voisines
    for (let b = 0; b < NB; b++) {
      if (b === ref) continue;
      const v = D[b];
      for (let ci = 0; ci < v.length; ci++) if (isNaN(v[ci])) { let a = ci - 1; while (a >= 0 && isNaN(v[a])) a--; let z = ci + 1; while (z < v.length && isNaN(v[z])) z++; v[ci] = a >= 0 && z < v.length ? v[a] + (v[z] - v[a]) * (ci - a) / (z - a) : a >= 0 ? v[a] : z < v.length ? v[z] : NaN; }
      const l = Float32Array.from(v); for (let ci = 0; ci < v.length; ci++) { let s1 = 0, n = 0; for (let k = -2; k <= 2; k++) { const x = l[ci + k]; if (x === x && ci + k >= 0 && ci + k < v.length) { s1 += x; n++; } } v[ci] = n ? s1 / n : NaN; }
    }
    // bandes entièrement vides : interpolées entre voisines ; bord : copie
    const pleine = D.map((v, b) => b === ref || !isNaN(v[0]));
    for (let b = 0; b < NB; b++) if (!pleine[b]) { let a = b - 1; while (a >= 0 && !pleine[a]) a--; let z = b + 1; while (z < NB && !pleine[z]) z++; for (let ci = 0; ci < centres.length; ci++) { const va = a >= 0 ? (a === ref ? 0 : D[a][ci]) : null, vz = z < NB ? (z === ref ? 0 : D[z][ci]) : null; D[b][ci] = va != null && vz != null ? va + (vz - va) * (b - a) / (z - a) : va != null ? va : vz != null ? vz : 0; } }
    const dec = (b, ci) => (b === ref ? 0 : D[b][ci]);
    const o = img(s.w, s.h);
    for (let y = 0; y < s.h; y++) {
      const fc = Math.max(0, Math.min(centres.length - 1, (y - centres[0]) / etape)), c0 = Math.floor(fc), c1 = Math.min(centres.length - 1, c0 + 1), tc = fc - c0;
      for (let x = 0; x < s.w; x++) {
        const fb = Math.max(0, Math.min(NB - 1, (x - bw / 2) / bw)), b0 = Math.floor(fb), b1 = Math.min(NB - 1, b0 + 1), tb = fb - b0;
        const d = (dec(b0, c0) * (1 - tc) + dec(b0, c1) * tc) * (1 - tb) + (dec(b1, c0) * (1 - tc) + dec(b1, c1) * tc) * tb;
        o.d[y * s.w + x] = echantillon(s, x, y + d);
      }
    }
    return { img: o, decalage: maxAbs };
  }

  /** Photo d'un ticket (niveaux de gris) → image prête pour la lecture. */
  function pretraiter(gris, largeur, hauteur, opts = {}) {
    let s = img(largeur, hauteur, Uint8ClampedArray.from(gris));
    const infos = {};
    const LARG = opts.largeur || 1100;   // largeur du papier en sortie : ~25 px par caractère sur un ticket de 40 colonnes
    const coins = opts.sansPapier ? null : trouverPapier(s);
    let r = coins && redresser(s, coins, LARG);
    if (r) { infos.papier = true; s = r; }
    else { // ticket en gros plan : on met simplement la largeur à l'échelle
      infos.papier = false; s = redim(s, Math.max(0.4, Math.min(3, LARG / s.w)));
    }
    s = eclairage(s, Math.max(8, Math.round(s.w / 60)));
    const a = inclinaison(s, r ? 4 : 10); infos.angle = a;
    s = tourner(s, a);
    let pas = pasDesLignes(s); infos.pas = pas;
    // texte trop petit ou trop gros pour la lecture : vise ~38 px entre deux lignes
    // (la largeur du papier est déjà normalisée : on ne remet à l'échelle que si le texte est franchement minuscule)
    if (pas > 0 && pas < 22) { const k = Math.min(2.5, 34 / pas); s = redim(s, k); pas = Math.round(pas * k); infos.echelle = k; }
    if (!opts.sansAplanir) { const ap = aplanir(s, pas); s = ap.img; infos.gondole = Math.round(ap.decalage); }
    return { gris: s.d, largeur: s.w, hauteur: s.h, infos };
  }

  return { pretraiter, trouverPapier, redresser, inclinaison, tourner, eclairage, pasDesLignes, aplanir, redim, otsu };
});
