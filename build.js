// Construit la version à héberger dans dist/ (page HTML complète + fichiers).
// Usage : node build.js   puis   npx serve dist   (ou tout hébergeur statique en HTTPS)
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'js', 'vendor'), { recursive: true });
fs.mkdirSync(path.join(dist, 'telechargements'), { recursive: true });

const corps = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const debut = corps.indexOf('<style>');
const tete = corps.slice(0, debut).replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
const reste = corps.slice(debut);
const finStyle = reste.indexOf('</style>') + '</style>'.length;
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${tete}${reste.slice(0, finStyle)}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
</head>
<body>
${reste.slice(finStyle).trim()}
</body>
</html>
`;
// version des scripts dans leur adresse (?v=…) : après une mise à jour, le navigateur recharge tous les fichiers
// ensemble, sans mélanger un ancien et un nouveau (cache du navigateur ou du réseau de diffusion).
const crypto = require('crypto');
const empreinte = crypto.createHash('sha1');
for (const f of fs.readdirSync(path.join(__dirname, 'js')).sort().filter((f) => f.endsWith('.js'))) empreinte.update(fs.readFileSync(path.join(__dirname, 'js', f)));
empreinte.update(corps);
const version = empreinte.digest('hex').slice(0, 10);
// noms de fichiers versionnés (app.4dcd1ea624.js) : un serveur encore sur l'ancienne version répond « introuvable »
// au lieu de servir l'ancien fichier, qui resterait ensuite en cache une journée
const versionnes = [];
fs.writeFileSync(path.join(dist, 'index.html'), html.replace(/<script src="(js\/[^"?]+)\.js"><\/script>/g, (m, base) => { versionnes.push(base); return `<script src="${base}.${version}.js"></script>`; }));
for (const f of ['js/data.js', 'js/modeles.js', 'js/engine.js', 'js/saisie.js', 'js/cuisine3d.js', 'js/codebarre.js', 'js/catalogue.js', 'js/gourmand.js', 'js/entrees.js', 'js/petitdej.js', 'js/programme.js', 'js/sport.js', 'js/ticket.js', 'js/ticket-image.js', 'js/saison.js', 'js/nutrition.js', 'js/commis.js', 'js/aliments.js', 'js/vendor/three-r160.min.js', 'js/vendor/three-LICENSE.txt', 'js/visuels.js', 'js/photos.js', 'js/magasins.js', 'js/config.js', 'js/compte.js', 'js/app.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-maskable.svg', 'robots.txt', 'sitemap.xml', 'mentions-legales.html', 'confidentialite.html', 'conditions.html', 'extension.html', 'telechargements/budgetable-extension.zip']) {
  fs.copyFileSync(path.join(__dirname, f), path.join(dist, f));
}
for (const base of versionnes) fs.copyFileSync(path.join(__dirname, base + '.js'), path.join(dist, `${base}.${version}.js`));
// appli installable : icônes, captures d'écran, et service worker qui garde hors ligne les bons fichiers (versionnés)
for (const dossier of ['icons', 'captures', 'kit']) {
  if (!fs.existsSync(path.join(__dirname, dossier))) continue;
  fs.mkdirSync(path.join(dist, dossier), { recursive: true });
  for (const f of fs.readdirSync(path.join(__dirname, dossier))) fs.copyFileSync(path.join(__dirname, dossier, f), path.join(dist, dossier, f));
}
{
  const icones = fs.readdirSync(path.join(__dirname, 'icons')).map((f) => './icons/' + f);
  const fichiers = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-maskable.svg', ...versionnes.map((b) => `./${b}.${version}.js`), ...icones];
  let sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = 'budgetable-${version}';`).replace(/const FICHIERS = \[[^\]]*\];/, `const FICHIERS = ${JSON.stringify(fichiers)};`);
  fs.writeFileSync(path.join(dist, 'sw.js'), sw);
}
// pages lisibles par Google (recettes, recherches courantes) et plan du site complet
{ const r = require('./scripts/pages-seo.js')(__dirname, dist); console.log(`pages SEO : ${r.recettes} recettes, ${r.pages} pages`); }
console.log('dist/ prêt');
