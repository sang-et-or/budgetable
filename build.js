// Construit la version à héberger dans dist/ (page HTML complète + fichiers).
// Usage : node build.js   puis   npx serve dist   (ou tout hébergeur statique en HTTPS)
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'js'), { recursive: true });
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
fs.writeFileSync(path.join(dist, 'index.html'), html);
for (const f of ['js/data.js', 'js/modeles.js', 'js/engine.js', 'js/visuels.js', 'js/photos.js', 'js/magasins.js', 'js/app.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-maskable.svg', 'mentions-legales.html', 'confidentialite.html', 'conditions.html', 'extension.html', 'telechargements/budgetable-extension.zip']) {
  fs.copyFileSync(path.join(__dirname, f), path.join(dist, f));
}
console.log('dist/ prêt');
