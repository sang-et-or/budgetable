/* Budgétable — la cuisine en 3D de l'onglet Placard (three.js, chargé seulement quand on l'ouvre).
 *
 * Un frigo avec son congélateur, un placard mural, un meuble bas et une corbeille.
 * On touche un meuble : sa porte s'ouvre, la caméra s'approche, la lumière du frigo s'allume.
 * Les produits du placard sont posés sur les étagères (une icône par produit).
 * Un glissement horizontal fait tourner la vue. Une seule scène est créée puis déplacée d'un rendu à l'autre.
 */
(function (root) {
  'use strict';
  let T = null;            // THREE
  let etat = null;         // { renderer, scene, camera, ... }
  let rappels = {};
  let donnees = { zones: {}, ouvert: null, sel: null, sombre: false };

  function disponible() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }

  /* ---------- textures dessinées ---------- */
  function toile(l, h, dessin) { const c = document.createElement('canvas'); c.width = l; c.height = h; dessin(c.getContext('2d'), l, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
  const texParquet = () => { const t = toile(512, 512, (g, l, h) => {
    const tons = ['#b07a46', '#a46f3e', '#ba8650', '#9c6939'];
    for (let i = 0; i < 8; i++) { g.fillStyle = tons[i % 4]; g.fillRect(0, i * 64, l, 64); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, i * 64, l, 2); const dec = (i * 173) % l; g.fillRect(dec, i * 64, 2, 64); }
    g.globalAlpha = .08; g.strokeStyle = '#3b2412'; for (let k = 0; k < 90; k++) { const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(l / 3, y + 3, 2 * l / 3, y - 3, l, y); g.stroke(); } }); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 3); return t; };
  const texCarreaux = (rx, ry) => { const t = toile(256, 128, (g, l, h) => {
    g.fillStyle = '#d9ddd6'; g.fillRect(0, 0, l, h);
    for (let r = 0; r < 4; r++) for (let c = -1; c < 4; c++) { const x = c * 64 + (r % 2 ? 32 : 0), y = r * 32; const gr = g.createLinearGradient(x, y, x, y + 30); gr.addColorStop(0, '#fbfbf8'); gr.addColorStop(1, '#eceee8'); g.fillStyle = gr; g.fillRect(x + 2, y + 2, 60, 28); } }); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); return t; };
  const texBois = (base) => toile(256, 256, (g, l, h) => {
    g.fillStyle = base; g.fillRect(0, 0, l, h); g.globalAlpha = .12; g.strokeStyle = '#2b1a0c';
    for (let k = 0; k < 40; k++) { const x = Math.random() * l; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, h / 3, x - 6, 2 * h / 3, x + 3, h); g.stroke(); } });
  const texOsier = () => { const t = toile(128, 64, (g, l, h) => {
    g.fillStyle = '#c3935a'; g.fillRect(0, 0, l, h);
    for (let x = 0; x < l; x += 8) { g.fillStyle = 'rgba(80,45,15,.35)'; g.fillRect(x, 0, 2, h); }
    for (let y = 0; y < h; y += 10) { g.fillStyle = 'rgba(255,230,190,.25)'; g.fillRect(0, y, l, 3); } }); t.wrapS = T.RepeatWrapping; t.repeat.set(4, 1); return t; };

  /* ---------- étiquettes et icônes ---------- */
  const cacheIcones = new Map();
  function texIcone(emoji) {
    if (cacheIcones.has(emoji)) return cacheIcones.get(emoji);
    const t = toile(128, 128, (g) => { g.font = '92px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 72); });
    cacheIcones.set(emoji, t); return t;
  }
  function texEtiquette(texte, n) {
    return toile(512, 128, (g, l, h) => {
      g.font = '700 54px Figtree, "Segoe UI", system-ui, sans-serif';
      const w = g.measureText(texte).width, pastille = 74, total = w + pastille + 70;
      const x0 = (l - total) / 2;
      g.fillStyle = 'rgba(255,255,255,.94)'; g.beginPath(); g.roundRect(x0, 18, total, 92, 46); g.fill();
      g.fillStyle = '#1d2721'; g.textBaseline = 'middle'; g.fillText(texte, x0 + 30, 66);
      g.fillStyle = '#2f6b47'; g.beginPath(); g.roundRect(x0 + 40 + w, 34, pastille, 60, 30); g.fill();
      g.fillStyle = '#fff'; g.font = '700 42px Figtree, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(String(n), x0 + 40 + w + pastille / 2, 66);
    });
  }

  /* ---------- construction ---------- */
  const M = (couleur, o = {}) => new T.MeshStandardMaterial({ color: couleur, roughness: o.r ?? 0.65, metalness: o.m ?? 0, map: o.map || null, transparent: !!o.t, opacity: o.t ?? 1 });
  function boite(l, h, p, mat, x, y, z, parent, cliquable) {
    const m = new T.Mesh(new T.BoxGeometry(l, h, p), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    if (cliquable) m.userData.zone = cliquable;
    (parent || etat.scene).add(m); return m;
  }
  // caisson creux (fond, côtés, dessus, dessous), ouvert devant
  function caisson(x0, x1, y0, y1, z0, z1, ep, matExt, matInt, zone) {
    const g = new T.Group();
    const L = x1 - x0, H = y1 - y0, P = z1 - z0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    boite(L, H, ep, matInt, cx, cy, z0 + ep / 2, g, zone);
    boite(ep, H, P, matExt, x0 + ep / 2, cy, cz, g, zone);
    boite(ep, H, P, matExt, x1 - ep / 2, cy, cz, g, zone);
    boite(L, ep, P, matExt, cx, y1 - ep / 2, cz, g, zone);
    boite(L, ep, P, matExt, cx, y0 + ep / 2, cz, g, zone);
    // parois intérieures plus claires
    boite(ep / 2, H - 2 * ep, P - ep, matInt, x0 + ep + 0.001, cy, cz + ep / 2, g, zone);
    boite(ep / 2, H - 2 * ep, P - ep, matInt, x1 - ep - 0.001, cy, cz + ep / 2, g, zone);
    etat.scene.add(g); return g;
  }
  // porte sur charnière : pivot au bord, la porte s'ouvre vers nous
  function porte(xPivot, y0, y1, zFace, largeur, sens, mat, zone, poignee, etiquette) {
    const pivot = new T.Group(); pivot.position.set(xPivot, (y0 + y1) / 2, zFace);
    const h = y1 - y0;
    const p = boite(largeur, h, 0.05, mat, sens * largeur / 2, 0, 0.025, pivot, zone);
    p.userData.porte = true;
    if (poignee) {
      const mp = M('#cfd6d1', { r: 0.25, m: 0.6 });
      const hp = Math.min(0.5, h * 0.4);
      const ph = boite(0.025, hp, 0.03, mp, sens * (largeur - 0.07), poignee === 'bas' ? -h / 2 + hp / 2 + 0.06 : 0, 0.075, pivot, zone);
      ph.castShadow = false;
    }
    if (etiquette) {
      const pl = new T.Mesh(new T.PlaneGeometry(0.56, 0.14), new T.MeshBasicMaterial({ map: etiquette, transparent: true }));
      pl.position.set(sens * largeur * 0.42, h / 2 - 0.13, 0.052); pl.userData.zone = zone; pivot.add(pl); pivot.userData.etiquette = pl;
    }
    etat.scene.add(pivot);
    pivot.userData = { ...pivot.userData, zone, sens, angle: 0, cible: 0 };
    etat.portes.push(pivot);
    return pivot;
  }

  // emplacements des produits par étagère : [zone, filtre, y, x0, x1, zAvant, zArriere, taille]
  const ETAGERES = {
    frigo: [['cremerie', 0.97, -1.54, -0.86, 0.52, 0.32, 0.15], ['viandes', 0.59, -1.54, -0.86, 0.52, 0.32, 0.15], ['legumes', 0.11, -1.54, -0.86, 0.52, 0.34, 0.15]],
    congel: [['surgeles', 1.42, -1.54, -0.86, 0.5, 0.32, 0.15]],
    placard: [['feculents', 1.495, -0.22, 1.22, 0.22, 0.1, 0.16], ['conserves', 1.745, -0.22, 1.22, 0.22, 0.1, 0.16], ['epices', 1.995, -0.22, 1.22, 0.22, 0.1, 0.15]]
  };

  function construire(conteneur) {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    const canvas = renderer.domElement; canvas.className = 'toile-cuisine'; canvas.setAttribute('aria-hidden', 'true');
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(48, 1, 0.05, 40);
    etat = { renderer, scene, camera, canvas, portes: [], produits: new T.Group(), signature: '', yaw: 0, pitch: 0, yawCible: 0, pitchCible: 0, camPos: new T.Vector3(0.2, 1.7, 4.4), camVise: new T.Vector3(0.15, 1.05, 0.2), posCible: new T.Vector3(), viseCible: new T.Vector3(), anim: 0, etiquettes: {} };
    scene.add(etat.produits);

    // lumières
    scene.add(new T.HemisphereLight('#fff8ec', '#8a7a66', 0.9));
    const soleil = new T.DirectionalLight('#fff3df', 1.6); soleil.position.set(2.5, 4, 3.5); soleil.castShadow = true;
    soleil.shadow.mapSize.set(1024, 1024); Object.assign(soleil.shadow.camera, { left: -3, right: 3, top: 3, bottom: -1, near: 0.5, far: 12 }); soleil.shadow.bias = -0.0008; soleil.shadow.radius = 4;
    scene.add(soleil); etat.soleil = soleil;
    const lumFrigo = new T.PointLight('#e9f6ff', 0, 1.6, 1.6); lumFrigo.position.set(-1.2, 1.15, 0.45); scene.add(lumFrigo); etat.lumFrigo = lumFrigo;
    const lumCongel = new T.PointLight('#dbeeff', 0, 1.0, 1.6); lumCongel.position.set(-1.2, 1.72, 0.45); scene.add(lumCongel); etat.lumCongel = lumCongel;
    const lumPlacard = new T.PointLight('#ffe7c2', 0, 1.6, 1.6); lumPlacard.position.set(0.5, 2.1, 0.3); scene.add(lumPlacard); etat.lumPlacard = lumPlacard;

    // pièce
    const sol = new T.Mesh(new T.PlaneGeometry(8, 5), M('#ffffff', { map: texParquet(), r: 0.8 })); sol.rotation.x = -Math.PI / 2; sol.position.set(0.2, 0, 1.5); sol.receiveShadow = true; scene.add(sol);
    const mur = new T.Mesh(new T.PlaneGeometry(8, 3.4), M('#efe8da', { r: 0.95 })); mur.position.set(0.2, 1.7, 0); mur.receiveShadow = true; scene.add(mur);
    const credence = new T.Mesh(new T.PlaneGeometry(2.6, 0.58), M('#ffffff', { map: texCarreaux(5, 1.15), r: 0.4 })); credence.position.set(0.5, 1.17, 0.002); credence.receiveShadow = true; scene.add(credence);
    // plinthe
    boite(8, 0.08, 0.02, M('#e3dccd'), 0.2, 0.04, 0.01);
    // fenêtre décorative à droite
    const ciel = new T.Mesh(new T.PlaneGeometry(0.8, 0.7), new T.MeshBasicMaterial({ map: toile(128, 128, (g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#9fd0f0'); gr.addColorStop(1, '#e8f4fb'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(40, 50, 26, 10, 0, 0, 7); g.ellipse(58, 46, 18, 12, 0, 0, 7); g.fill(); g.fillStyle = '#7fb069'; g.fillRect(0, 108, 128, 20); }) }));
    ciel.position.set(2.35, 1.75, 0.003); scene.add(ciel);
    const cadre = M('#ffffff', { r: 0.5 });
    boite(0.9, 0.05, 0.05, cadre, 2.35, 2.12, 0.025); boite(0.9, 0.05, 0.08, cadre, 2.35, 1.38, 0.04); boite(0.05, 0.8, 0.05, cadre, 1.92, 1.75, 0.025); boite(0.05, 0.8, 0.05, cadre, 2.78, 1.75, 0.025); boite(0.03, 0.7, 0.03, cadre, 2.35, 1.75, 0.02);

    // frigo : caisson + séparation congélateur + étagères en verre + bac à légumes
    const blanc = M('#f6f8f7', { r: 0.32, m: 0.08 }), interieurFrigo = M('#eef6f8', { r: 0.5 });
    caisson(-1.62, -0.78, 0.02, 1.92, 0, 0.66, 0.04, blanc, interieurFrigo, 'frigo');
    boite(0.8, 0.04, 0.62, blanc, -1.2, 1.36, 0.33, null, 'congel');
    const verre = M('#dff0f5', { r: 0.1, t: 0.45 });
    boite(0.76, 0.012, 0.58, verre, -1.2, 0.965, 0.32, null, 'frigo'); boite(0.76, 0.012, 0.58, verre, -1.2, 0.585, 0.32, null, 'frigo');
    // bac à légumes : un bac ouvert dont on voit le contenu
    const bac = M('#d7ecef', { r: 0.2, t: 0.6 });
    boite(0.74, 0.012, 0.56, bac, -1.2, 0.07, 0.31, null, 'frigo');
    boite(0.74, 0.1, 0.012, bac, -1.2, 0.12, 0.59, null, 'frigo');
    boite(0.76, 0.012, 0.58, M('#d6dde3', { r: 0.4, m: 0.4 }), -1.2, 1.415, 0.32, null, 'congel');
    etat.etiquettes.congel = texEtiquette('Congélateur', 0); etat.etiquettes.frigo = texEtiquette('Frigo', 0);
    porte(-1.62, 1.38, 1.92, 0.66, 0.84, 1, blanc, 'congel', 'bas', etat.etiquettes.congel);
    porte(-1.62, 0.04, 1.34, 0.66, 0.84, 1, blanc, 'frigo', 'haut', etat.etiquettes.frigo);

    // meuble bas + plan de travail
    const facade = M('#7fa38a', { r: 0.6 }), bois = M('#ffffff', { map: texBois('#c08a52'), r: 0.55 });
    boite(2.5, 0.84, 0.58, M('#6f927a'), 0.52, 0.46, 0.29, null, 'corbeille');
    for (let k = 0; k < 3; k++) { boite(0.8, 0.7, 0.03, facade, -0.3 + k * 0.82, 0.47, 0.595, null, 'corbeille'); boite(0.25, 0.025, 0.03, M('#d9d4c7', { r: 0.3, m: 0.5 }), -0.3 + k * 0.82, 0.74, 0.62); }
    boite(2.0, 0.08, 0.5, M('#3e3a35'), 0.52, 0.04, 0.27);
    boite(2.56, 0.05, 0.64, bois, 0.52, 0.905, 0.32, null, 'corbeille');
    // corbeille sur le plan de travail
    const panier = new T.Mesh(new T.CylinderGeometry(0.24, 0.17, 0.13, 28, 1, true), new T.MeshStandardMaterial({ map: texOsier(), roughness: 0.9, side: T.DoubleSide }));
    panier.position.set(1.32, 0.995, 0.34); panier.castShadow = true; panier.userData.zone = 'corbeille'; scene.add(panier);
    const fondPanier = new T.Mesh(new T.CircleGeometry(0.17, 24), M('#a8783f')); fondPanier.rotation.x = -Math.PI / 2; fondPanier.position.set(1.32, 0.935, 0.34); fondPanier.userData.zone = 'corbeille'; scene.add(fondPanier);
    const anse = new T.Mesh(new T.TorusGeometry(0.2, 0.012, 8, 30, Math.PI), M('#9c6c36')); anse.position.set(1.32, 1.06, 0.34); anse.userData.zone = 'corbeille'; scene.add(anse);
    etat.etiquettes.corbeille = texEtiquette('Corbeille', 0);
    const etqC = new T.Sprite(new T.SpriteMaterial({ map: etat.etiquettes.corbeille, depthTest: false })); etqC.scale.set(0.6, 0.15, 1); etqC.position.set(1.32, 1.33, 0.34); etqC.userData.zone = 'corbeille'; etqC.renderOrder = 5; scene.add(etqC); etat.etqCorbeille = etqC;
    // une planche et une plante pour la vie
    boite(0.36, 0.02, 0.22, M('#ffffff', { map: texBois('#d8a86c') }), 0.45, 0.94, 0.36);
    const pot = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, 0.1, 16), M('#c96f4a')); pot.position.set(-0.55, 0.98, 0.18); pot.castShadow = true; scene.add(pot);
    for (let k = 0; k < 7; k++) { const f = new T.Mesh(new T.SphereGeometry(0.035, 10, 8), M('#4f8a4b')); f.position.set(-0.55 + Math.cos(k) * 0.04, 1.06 + (k % 3) * 0.03, 0.18 + Math.sin(k) * 0.04); f.scale.set(1, 1.6, 0.6); scene.add(f); }

    // placard mural
    const boisPlacard = M('#ffffff', { map: texBois('#b07a45'), r: 0.6 }), interieurPlacard = M('#f1e6d4', { r: 0.8 });
    caisson(-0.3, 1.3, 1.47, 2.22, 0, 0.34, 0.03, boisPlacard, interieurPlacard, 'placard');
    boite(1.54, 0.02, 0.3, boisPlacard, 0.5, 1.735, 0.17, null, 'placard'); boite(1.54, 0.02, 0.3, boisPlacard, 0.5, 1.985, 0.17, null, 'placard');
    const portePlacard = M('#ffffff', { map: texBois('#a8743f'), r: 0.55 });
    etat.etiquettes.placard = texEtiquette('Placard', 0);
    porte(-0.3, 1.47, 2.22, 0.34, 0.8, 1, portePlacard, 'placard', 'milieu', etat.etiquettes.placard);
    porte(1.3, 1.47, 2.22, 0.34, 0.8, -1, portePlacard, 'placard', 'milieu', null);

    // interactions
    branche(canvas);
    const ro = new ResizeObserver(() => redimensionner()); etat.ro = ro;
  }

  /* ---------- produits sur les étagères ---------- */
  function placerProduits() {
    const sig = JSON.stringify(donnees.zones) + '|' + donnees.sel;
    if (sig === etat.signature) return;
    etat.signature = sig;
    for (const c of [...etat.produits.children]) { etat.produits.remove(c); c.material.dispose(); }
    const ajouter = (p, x, y, z, taille) => {
      const s = new T.Sprite(new T.SpriteMaterial({ map: texIcone(p.emoji), transparent: true }));
      const k = p.id === donnees.sel ? 1.35 : 1;
      s.scale.set(taille * k, taille * k, 1); s.position.set(x, y + taille * k / 2, z);
      s.userData = { id: p.id, zone: p.zone, base: y + taille * k / 2 };
      etat.produits.add(s);
      if (p.part < 0.25) { const pt = new T.Sprite(new T.SpriteMaterial({ color: '#c0412a' })); pt.scale.set(0.025, 0.025, 1); pt.position.set(x + taille * 0.38, y + taille * 0.9, z + 0.01); etat.produits.add(pt); }
      if (p.nouveau) { const pt = new T.Sprite(new T.SpriteMaterial({ color: '#2f6b47' })); pt.scale.set(0.03, 0.03, 1); pt.position.set(x - taille * 0.38, y + taille * 0.9, z + 0.01); etat.produits.add(pt); }
    };
    for (const [zone, etageres] of Object.entries(ETAGERES)) {
      for (const [cle, y, x0, x1, zA, zR, taille] of etageres) {
        const l = (donnees.zones[zone] || {})[cle] || [];
        const parRang = Math.max(1, Math.floor((x1 - x0) / (taille * 1.05)));
        l.slice(0, parRang * 2).forEach((p, i) => {
          const rang = Math.floor(i / parRang), col = i % parRang;
          const n = Math.min(parRang, l.length - rang * parRang);
          const pas = (x1 - x0) / parRang;
          const x = (x0 + x1) / 2 + (col - (n - 1) / 2) * pas + (rang ? pas / 2 : 0);
          ajouter(p, Math.min(x1 - taille / 2, Math.max(x0 + taille / 2, x)), y + (rang ? 0.02 : 0), rang ? zR : zA, taille * (rang ? 0.9 : 1));
        });
      }
    }
    // corbeille : en tas
    const corb = (donnees.zones.corbeille || {}).tout || [];
    corb.slice(0, 9).forEach((p, i) => {
      const a = i * 2.4, r = i === 0 ? 0 : 0.09 + (i % 2) * 0.04;
      ajouter(p, 1.32 + Math.cos(a) * r, 0.96 + (i > 4 ? 0.06 : 0), 0.34 + Math.sin(a) * r * 0.6, 0.15);
    });
    // compteurs sur les étiquettes
    for (const z of ['placard', 'frigo', 'congel', 'corbeille']) {
      const n = Object.values(donnees.zones[z] || {}).reduce((s, l) => s + l.length, 0);
      const nom = { placard: 'Placard', frigo: 'Frigo', congel: 'Congélateur', corbeille: 'Corbeille' }[z];
      const neuve = texEtiquette(nom, n);
      const vieille = etat.etiquettes[z];
      etat.etiquettes[z] = neuve;
      etat.portes.forEach((pv) => { if (pv.userData.zone === z && pv.userData.etiquette) { pv.userData.etiquette.material.map = neuve; pv.userData.etiquette.material.needsUpdate = true; } });
      if (z === 'corbeille') { etat.etqCorbeille.material.map = neuve; etat.etqCorbeille.material.needsUpdate = true; }
      if (vieille) vieille.dispose();
    }
  }

  /* ---------- caméra ---------- */
  const VUES = {
    tout: { vise: [0.28, 1.18, 0.2], dist: null },
    frigo: { vise: [-1.2, 0.78, 0.35], pos: [-0.55, 1.25, 2.55] },
    congel: { vise: [-1.2, 1.55, 0.35], pos: [-0.65, 1.62, 1.75] },
    placard: { vise: [0.5, 1.8, 0.15], pos: [0.5, 1.5, 2.35] },
    corbeille: { vise: [1.3, 1.0, 0.34], pos: [1.15, 1.55, 1.45] }
  };
  function cibleCamera() {
    const v = VUES[donnees.ouvert] || VUES.tout;
    etat.viseCible.set(...v.vise);
    if (v.pos) etat.posCible.set(...v.pos);
    else {
      // tout voir : distance selon la largeur de l'écran
      const asp = etat.camera.aspect, fov = T.MathUtils.degToRad(etat.camera.fov);
      const dH = 1.12 / Math.tan(fov / 2), dL = 2.2 / (Math.tan(fov / 2) * asp);
      const d = Math.max(dH, dL);
      etat.posCible.set(0.35, 1.5 + d * 0.1, 0.2 + d);
    }
  }
  function redimensionner() {
    const p = etat.canvas.parentElement; if (!p) return;
    const l = p.clientWidth, h = Math.round(Math.min(520, Math.max(300, l * 0.95)));
    if (!l) return;
    etat.renderer.setSize(l, h, false); etat.canvas.style.width = l + 'px'; etat.canvas.style.height = h + 'px';
    etat.camera.aspect = l / h; etat.camera.updateProjectionMatrix();
    cibleCamera(); demander();
  }

  /* ---------- boucle (seulement quand quelque chose bouge) ---------- */
  let prevu = false, dernier = 0;
  function demander() { if (!prevu) { prevu = true; requestAnimationFrame(boucle); } }
  function boucle(t) {
    prevu = false;
    const dt = Math.min(0.05, (t - (dernier || t)) / 1000); dernier = t;
    const k = 1 - Math.pow(0.0009, dt);  // amorti
    let bouge = false;
    for (const pv of etat.portes) {
      const ouvre = donnees.ouvert === pv.userData.zone;
      pv.userData.cible = ouvre ? -1.95 * pv.userData.sens : 0;
      const d = pv.userData.cible - pv.userData.angle;
      if (Math.abs(d) > 0.002) { pv.userData.angle += d * Math.min(1, k * 1.1); bouge = true; } else pv.userData.angle = pv.userData.cible;
      pv.rotation.y = pv.userData.angle;
    }
    const ouv = (z) => { const p = etat.portes.find((x) => x.userData.zone === z); return p ? Math.min(1, Math.abs(p.userData.angle) / 1.2) : 0; };
    etat.lumFrigo.intensity = 2.2 * ouv('frigo'); etat.lumCongel.intensity = 1.4 * ouv('congel'); etat.lumPlacard.intensity = 1.2 * ouv('placard');
    // caméra
    etat.yaw += (etat.yawCible - etat.yaw) * k; etat.pitch += (etat.pitchCible - etat.pitch) * k;
    if (Math.abs(etat.yawCible - etat.yaw) > 1e-4 || Math.abs(etat.pitchCible - etat.pitch) > 1e-4) bouge = true;
    etat.camVise.lerp(etat.viseCible, k); etat.camPos.lerp(etat.posCible, k);
    if (etat.camPos.distanceTo(etat.posCible) > 0.002 || etat.camVise.distanceTo(etat.viseCible) > 0.002) bouge = true;
    const off = etat.camPos.clone().sub(etat.camVise);
    off.applyAxisAngle(new T.Vector3(0, 1, 0), etat.yaw);
    const axe = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), etat.yaw);
    off.applyAxisAngle(axe, -etat.pitch);
    etat.camera.position.copy(etat.camVise).add(off); etat.camera.lookAt(etat.camVise);
    // produit choisi : il sautille un peu
    for (const s of etat.produits.children) if (s.userData.id && s.userData.id === donnees.sel) { s.position.y = s.userData.base + Math.abs(Math.sin(t / 260)) * 0.025; bouge = true; }
    etat.renderer.render(etat.scene, etat.camera);
    if (bouge || etat.glisse) demander();
  }

  /* ---------- toucher : glisser pour tourner, toucher pour ouvrir ---------- */
  function branche(canvas) {
    const ray = new T.Raycaster(), v = new T.Vector2();
    let depart = null;
    canvas.addEventListener('pointerdown', (e) => { depart = { x: e.clientX, y: e.clientY, yaw: etat.yawCible, pitch: etat.pitchCible, bouge: false }; etat.glisse = true; demander(); });
    canvas.addEventListener('pointermove', (e) => {
      if (!depart) return;
      const dx = e.clientX - depart.x, dy = e.clientY - depart.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) depart.bouge = true;
      etat.yawCible = Math.max(-0.6, Math.min(0.6, depart.yaw - dx * 0.006));
      etat.pitchCible = Math.max(-0.12, Math.min(0.3, depart.pitch + dy * 0.003));
    });
    const fin = (e) => {
      etat.glisse = false;
      if (depart && !depart.bouge && e.type === 'pointerup') {
        const r = canvas.getBoundingClientRect();
        v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(v, etat.camera);
        const touches = ray.intersectObjects(etat.scene.children, true);
        const prod = touches.find((x) => x.object.userData.id);
        const zone = (touches.find((x) => x.object.userData.zone) || {}).object;
        if (prod && donnees.ouvert === prod.object.userData.zone) rappels.choisir && rappels.choisir(prod.object.userData.id);
        else if (zone) rappels.ouvrir && rappels.ouvrir(zone.userData.zone);
      }
      depart = null; demander();
    };
    canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin); canvas.addEventListener('pointerleave', fin);
  }

  /* ---------- API ---------- */
  function monter(conteneur, d, r) {
    T = window.THREE;
    if (!T) return false;
    donnees = d; rappels = r || {};
    if (!etat) construire(conteneur);
    if (etat.canvas.parentElement !== conteneur) { conteneur.innerHTML = ''; conteneur.appendChild(etat.canvas); etat.ro.disconnect(); etat.ro.observe(conteneur); }
    etat.scene.background = new T.Color(d.sombre ? '#1a221d' : '#f3efe6');
    etat.soleil.intensity = d.sombre ? 1.15 : 1.6;
    placerProduits(); redimensionner(); cibleCamera();
    if (!etat.pret) { etat.camPos.copy(etat.posCible); etat.camVise.copy(etat.viseCible); etat.pret = true; }
    demander();
    return true;
  }
  function recentrer() { if (etat) { etat.yawCible = 0; etat.pitchCible = 0; demander(); } }
  root.Cuisine3D = { disponible, monter, recentrer };
})(typeof window !== 'undefined' ? window : globalThis);
