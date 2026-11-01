// Liste des épingles Pinterest à partir des pages générées (dist/recettes, dist/conseils) : nom, temps, prix, tableau.
'use strict';
const fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', '..', 'dist');
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch (e) { return null; } }).filter(Boolean);
const TABLEAUX = { 'Plat principal': 'Repas pas chers', Entrée: 'Entrées faciles et pas chères', Dessert: 'Desserts maison pas chers', 'Petit-déjeuner': 'Petits-déjeuners et goûters' };
const recettes = [];
for (const f of fs.readdirSync(path.join(dist, 'recettes')).filter((f) => f !== 'index.html')) {
  const html = fs.readFileSync(path.join(dist, 'recettes', f), 'utf8');
  const r = ld(html).find((x) => x['@type'] === 'Recipe'); if (!r) continue;
  const prix = (html.match(/≈ ([0-9]+,[0-9]{2}) € la part/) || [])[1];
  const saison = (html.match(/De saison : ([^<]+)</) || [])[1] || '';
  const fil = (html.match(/<nav class="fil">[\s\S]*?›\s*([^<]+)<\/nav>/) || [])[1] || '';
  recettes.push({ slug: f.replace('.html', ''), nom: r.name, minutes: parseInt(String(r.totalTime).replace(/\D/g, ''), 10) || 30, portions: parseInt(r.recipeYield, 10) || 4,
    categorie: r.recipeCategory, groupe: fil.trim(), prix, saison: saison.trim(), vege: /Végétarien/.test(html),
    tableau: fil.includes('saison') ? 'Recettes de saison pas chères' : (TABLEAUX[r.recipeCategory] || 'Repas pas chers') });
}
console.log(JSON.stringify(recettes));
