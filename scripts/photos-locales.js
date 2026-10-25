// Copie les photos des plats (Wikimedia Commons, licences libres) dans dist/photos/
// pour qu'elles soient servies par le site lui-même. À lancer après « node build.js ».
// Utilisé par Render au moment de chaque publication (voir render.yaml).
// Si une photo ne se télécharge pas, le site garde simplement l'adresse Wikimedia pour celle-là.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const racine = path.join(__dirname, '..');
const dist = path.join(racine, 'dist');
const { PHOTOS } = require(path.join(racine, 'js', 'photos.js'));
const UA = 'BudgetableBuild/1.0 (https://github.com/sang-et-or/budgetable; copie des photos sous licence libre avec credits)';

async function telecharger(url, essais = 4) {
  for (let i = 1; i <= essais; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      if (r.status === 404) throw new Error('404');
      if (r.status === 429) { const att = Number(r.headers.get('retry-after')) || 10; await new Promise((ok) => setTimeout(ok, att * 1000)); continue; }
    } catch (e) { if (String(e.message) === '404') throw e; }
    await new Promise((ok) => setTimeout(ok, 3000 * i));
  }
  throw new Error('échec');
}

(async () => {
  const sources = [...new Set(Object.values(PHOTOS).filter(Boolean).map((p) => p.src))];
  fs.mkdirSync(path.join(dist, 'photos'), { recursive: true });
  const locales = {};
  let ok = 0, echecs = 0;
  for (const src of sources) {
    if (ok === 0 && echecs >= 3) { console.warn('Pas d’accès à Wikimedia : toutes les photos restent chargées depuis Wikimedia.'); break; }
    const ext = (src.match(/\.(jpe?g|png|webp)$/i) || ['', 'jpg'])[1].toLowerCase();
    const nom = crypto.createHash('sha1').update(src).digest('hex').slice(0, 16) + '.' + ext;
    try {
      const data = await telecharger(src);
      fs.writeFileSync(path.join(dist, 'photos', nom), data);
      locales[src] = 'photos/' + nom;
      ok++;
    } catch (e) {
      echecs++;
      console.warn('Photo gardée sur Wikimedia :', src, e.message);
    }
    await new Promise((r) => setTimeout(r, 600)); // politesse envers les serveurs de Wikimedia
  }
  const fichier = path.join(dist, 'js', 'photos.js');
  fs.writeFileSync(fichier, `globalThis.BUDGETABLE_PHOTOS_LOCALES = ${JSON.stringify(locales)};\n` + fs.readFileSync(fichier, 'utf8'));
  // pages recettes (référencement) : même copie locale, aucune requête vers Wikimedia depuis le navigateur
  const dossierRec = path.join(dist, 'recettes');
  if (fs.existsSync(dossierRec)) for (const f of fs.readdirSync(dossierRec).filter((x) => x.endsWith('.html'))) {
    const p = path.join(dossierRec, f);
    let h = fs.readFileSync(p, 'utf8'), change = false;
    for (const [src, loc] of Object.entries(locales)) if (h.includes(src)) { h = h.split(`src="${src}"`).join(`src="/${loc}"`); change = true; }
    if (change) fs.writeFileSync(p, h);
  }
  console.log(`Photos copiées avec le site : ${ok} / ${sources.length}`);
})();
