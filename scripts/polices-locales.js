// Copie les polices (Google Fonts, licence SIL Open Font) dans dist/fonts/ et les sert depuis le site :
// les visiteurs ne contactent plus les serveurs de Google (recommandation RGPD).
// À lancer après « node build.js ». Si le téléchargement échoue, le site garde le lien Google Fonts.
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

(async () => {
  let html = fs.readFileSync(index, 'utf8');
  const lien = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)">/);
  if (!lien) { console.log('Pas de lien Google Fonts : rien à faire.'); return; }
  try {
    const cssUrl = lien[1].replace(/&amp;/g, '&');
    const r = await fetch(cssUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('CSS ' + r.status);
    let css = await r.text();
    // on ne garde que les jeux de caractères latins (français)
    css = css.split('/*').filter((bloc) => !bloc.trim() || /^\s*latin(-ext)? \*\//.test(bloc)).map((b, i) => (i ? '/*' + b : b)).join('');
    fs.mkdirSync(path.join(dist, 'fonts'), { recursive: true });
    const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])];
    let n = 0;
    for (const u of urls) {
      const f = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (!f.ok) throw new Error('police ' + f.status);
      const nom = 'p' + (n++) + '.woff2';
      fs.writeFileSync(path.join(dist, 'fonts', nom), Buffer.from(await f.arrayBuffer()));
      css = css.split(u).join(nom);
    }
    fs.writeFileSync(path.join(dist, 'fonts', 'polices.css'), css);
    html = html.replace(lien[0], '<link rel="stylesheet" href="fonts/polices.css">')
      .replace(/<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\n?/g, '');
    fs.writeFileSync(index, html);
    // toutes les autres pages, y compris les pages recettes (adresse absolue)
    const pages = fs.readdirSync(dist).filter((f) => f.endsWith('.html') && f !== 'index.html').map((f) => path.join(dist, f));
    if (fs.existsSync(path.join(dist, 'recettes'))) pages.push(...fs.readdirSync(path.join(dist, 'recettes')).filter((f) => f.endsWith('.html')).map((f) => path.join(dist, 'recettes', f)));
    for (const p of pages) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="/fonts/polices.css">'));
    console.log(`Polices servies par le site : ${n} fichiers`);
  } catch (e) {
    console.warn('Polices laissées sur Google Fonts :', e.message);
  }
})();
