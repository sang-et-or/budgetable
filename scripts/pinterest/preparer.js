// Prépare le pack Pinterest : liste des épingles (recettes + listes d'articles), calendrier et fichiers CSV
// d'import groupé (100 épingles max par fichier, programmées 14 jours max à l'avance).
// Usage : node build.js && node scripts/pinterest/preparer.js <dossier de sortie>  puis  python3 scripts/pinterest/rendre.py <dossier>/epingles.json
'use strict';
const fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', '..', 'dist');
const SITE = 'https://budgetable.fr';
const sortie = process.argv[2] || path.join(__dirname, 'sortie'); fs.mkdirSync(sortie, { recursive: true });
const lire = (f) => fs.readFileSync(path.join(dist, f), 'utf8');
const txt = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').trim();
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch (e) { return null; } }).filter(Boolean);

/* recettes */
const AIR = 'Recettes air fryer';
const TABLEAUX = { 'Plat principal': 'Repas pas chers', Entrée: 'Entrées faciles et pas chères', Dessert: 'Desserts maison pas chers', 'Petit-déjeuner': 'Petits-déjeuners et goûters' };
const TAG = { 'Repas pas chers': 'Repas pas cher', 'Recettes de saison pas chères': 'Recette de saison', 'Desserts maison pas chers': 'Dessert maison', 'Entrées faciles et pas chères': 'Entrée facile', 'Petits-déjeuners et goûters': 'Petit-déj maison', [AIR]: 'Air fryer' };
const MOTS = { 'Repas pas chers': 'repas pas cher, recette facile, recette économique, dîner rapide', 'Recettes de saison pas chères': 'recette de saison, recette d’automne, recette d’hiver, repas pas cher', 'Desserts maison pas chers': 'dessert facile, dessert maison, dessert pas cher, goûter', 'Entrées faciles et pas chères': 'entrée facile, entrée pas chère, recette facile', 'Petits-déjeuners et goûters': 'petit-déjeuner, brunch, goûter maison', [AIR]: 'recette air fryer, air fryer facile, friteuse à air, repas pas cher' };
const recettes = [];
for (const f of fs.readdirSync(path.join(dist, 'recettes')).filter((f) => f !== 'index.html')) {
  const html = lire('recettes/' + f);
  const r = ld(html).find((x) => x['@type'] === 'Recipe'); if (!r) continue;
  const minutes = parseInt(String(r.totalTime).replace(/\D/g, ''), 10) || 30; if (minutes <= 5) continue;   // assemblages sans intérêt sur Pinterest
  const prix = (html.match(/≈ ([0-9]+,[0-9]{2}) € la part/) || [])[1]; if (!prix) continue;
  const saison = ((html.match(/De saison : ([^<]+)</) || [])[1] || '').trim();
  const fil = (html.match(/<nav class="fil">[\s\S]*?›\s*([^<]+)<\/nav>/) || [])[1] || '';
  const vege = /Végétarien/.test(html), portions = parseInt(r.recipeYield, 10) || 4;
  const tableau = /air fryer/i.test(fil) ? AIR : fil.includes('saison') ? 'Recettes de saison pas chères' : (TABLEAUX[r.recipeCategory] || 'Repas pas chers');
  recettes.push({ slug: f.replace('.html', ''), nom: r.name, prix, tag: TAG[tableau], tableau, saison,
    infos: [`⏱ ${minutes} min`, `🍽 ${portions} pers.`].concat(vege ? ['🌱 Végétarien'] : []),
    lien: `${SITE}/recettes/${f}`,
    titre: `${r.name} : recette facile à ${prix} € la part`,
    description: `${r.name}, une recette ${vege ? 'végétarienne ' : ''}facile et pas chère pour ${portions} personnes, prête en ${minutes} minutes, pour environ ${prix} € la part.${saison ? ` De saison en ${saison}.` : ''} Ingrédients, étapes et liste de courses sur Budgétable, le planificateur de menus petit budget.`,
    mots: MOTS[tableau] });
}

/* listes (articles) : menus de Noël, astuces fêtes, dîners à moins de 2 €, menu de la semaine */
const listes = [];
{
  const html = lire('conseils/menu-de-noel-pas-cher.html');
  for (const m of html.matchAll(/<h2>([^<]+) · ≈ ([0-9,]+) € par personne<\/h2>[\s\S]*?<ul>([\s\S]*?)<\/ul>/g)) {
    const lignes = [...m[3].matchAll(/<strong>([^<]+)<\/strong> : <a[^>]*>([^<]+)<\/a> <span class="petit">· ≈ ([0-9,]+) €/g)].map((x) => [x[1], txt(x[2]), x[3] + ' €']);
    const nom = txt(m[1]).replace(/^Le menu /, 'Menu de Noël ');
    listes.push({ slug: 'noel-' + nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '-').replace(/-+$/, ''), nom: nom.charAt(0).toUpperCase() + nom.slice(1), prix: m[2], unite: 'par pers.', tag: 'Noël petit budget', tableau: 'Noël et fêtes petit budget',
      lignes, note: 'Entrée, plat, dessert : tout est fait maison', lien: `${SITE}/conseils/menu-de-noel-pas-cher.html`,
      titre: `${nom} à ${m[2]} € par personne : entrée, plat, dessert`,
      description: `Un menu de Noël complet et pas cher, à environ ${m[2]} € par personne : ${lignes.map((l) => l[1].toLowerCase()).join(', ')}. Recettes faciles à préparer à l’avance, et deux autres menus de fêtes petit budget sur Budgétable.`,
      mots: 'menu de Noël pas cher, repas de Noël petit budget, menu de fête, réveillon pas cher' });
  }
}
{
  const html = lire('conseils/repas-de-fetes-petit-budget.html');
  const astuces = [...html.matchAll(/<li><strong>([^<]+)<\/strong>/g)].map((x) => [String(listes.length), txt(x[1])]).slice(0, 8);
  listes.push({ slug: 'fetes-petit-budget-astuces', nom: '8 astuces pour des fêtes pas chères', prix: '', tag: 'Noël petit budget', tableau: 'Noël et fêtes petit budget',
    lignes: astuces.slice(0, 6).map((a, k) => [String(k + 1), a[1].charAt(0).toUpperCase() + a[1].slice(1), '']), note: '+ des recettes à préparer la veille', lien: `${SITE}/conseils/repas-de-fetes-petit-budget.html`,
    titre: 'Repas de fêtes petit budget : 8 astuces pour recevoir sans se ruiner',
    description: 'Noël et Nouvel An sans exploser le budget : fixer un budget par personne, partager les plats, apéritif maison, un seul produit de luxe, produits de saison, plat mijoté, liste de courses et restes prévus. Avec des recettes à préparer la veille.',
    mots: 'repas de fêtes pas cher, Noël petit budget, astuces économies Noël, recevoir pas cher' });
}
{
  const html = lire('conseils/diners-moins-de-2-euros.html');
  const l = [...html.matchAll(/<li><a href="\/recettes\/[^"]+">([^<]+)<\/a> <span class="petit">· ≈ ([0-9,]+) € la part/g)].map((x) => ['', txt(x[1]), x[2] + ' €']);
  listes.push({ slug: 'diners-moins-de-2-euros', nom: `${l.length} dîners à moins de 2 € la part`, prix: '2', unite: 'max', tag: 'Repas pas cher', tableau: 'Repas pas chers',
    lignes: l.slice(0, 6), note: `… et ${l.length - 6} autres idées`, lien: `${SITE}/conseils/diners-moins-de-2-euros.html`,
    titre: `${l.length} dîners à moins de 2 € la part, faciles et faits maison`,
    description: `${l.length} idées de dîners faits maison à moins de 2 € par personne : ${l.slice(0, 4).map((x) => x[1].toLowerCase()).join(', ')}… Recettes simples avec le coût estimé de chaque plat, sur Budgétable.`,
    mots: 'dîner pas cher, repas à moins de 2 euros, recette économique, menu petit budget' });
}
{
  const html = lire('menu-semaine-pas-cher.html');
  const l = [...html.matchAll(/<li><strong>([^<]+)<\/strong> : midi, <a[^>]*>([^<]+)<\/a> · soir, <a[^>]*>([^<]+)<\/a>/g)].map((x) => [x[1].slice(0, 3), txt(x[3]), '']);
  const cout = (html.match(/soit ([0-9,]+) € par part/) || [])[1] || '';
  listes.push({ slug: 'menu-semaine-pas-cher', nom: 'Menu de la semaine pas cher', prix: cout, unite: 'la part', tag: 'Organisation des repas', tableau: 'Menus de la semaine pas chers',
    lignes: l, note: 'Midi et soir, avec la liste de courses', lien: `${SITE}/menu-semaine-pas-cher.html`,
    titre: 'Menu de la semaine pas cher pour 4 : 14 repas et la liste de courses',
    description: `Un menu de la semaine économique pour 4 personnes : 7 déjeuners et 7 dîners faits maison${cout ? `, environ ${cout} € la part` : ''}. Budgétable crée votre menu selon vos goûts et votre budget, et fait la liste de courses.`,
    mots: 'menu de la semaine, menu pas cher, planning repas, organisation repas, liste de courses' });
}

{
  const html = lire('recettes-air-fryer-pas-cheres.html');
  const l = [...html.matchAll(/<li><a href="\/recettes\/[^"]+">([^<]+)<\/a> <span class="petit">· ≈ ([0-9,]+) € la part/g)].map((x) => ['', txt(x[1]).replace(/ à l’air fryer$/, ''), x[2] + ' €']);
  const moy = (html.match(/environ ([0-9,]+) € la part en moyenne/) || [])[1] || '';
  listes.push({ slug: 'recettes-air-fryer-pas-cheres', nom: `${l.length} repas pas chers à l’air fryer`, prix: moy, unite: 'la part', tag: 'Air fryer', tableau: AIR,
    lignes: l.slice(0, 6), note: `… et ${l.length - 6} autres recettes`, lien: `${SITE}/recettes-air-fryer-pas-cheres.html`,
    titre: `${l.length} recettes air fryer pas chères : repas complets à environ ${moy} € la part`,
    description: `${l.length} repas faciles et économiques à l’air fryer : ${l.slice(0, 4).map((x) => x[1].toLowerCase()).join(', ')}… Avec le coût par part et les astuces pour bien cuisiner à la friteuse à air.`,
    mots: 'recette air fryer, air fryer pas cher, friteuse à air, idées repas air fryer' });
}
if (process.env.SEUL === 'airfryer') {   // lot à part pour les recettes air fryer (les autres lots sont déjà importés)
  const l = listes.filter((p) => p.tableau === AIR).concat(recettes.filter((p) => p.tableau === AIR));
  const debut = new Date(process.env.DEBUT || Date.now() + 86400000); debut.setUTCHours(0, 0, 0, 0);
  l.forEach((p, k) => { p.date = new Date(debut.getTime() + k * 86400000).toISOString().slice(0, 10) + 'T13:15:00'; });
  const champ = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lignes = [['Title', 'Media URL', 'Pinterest board', 'Thumbnail', 'Description', 'Link', 'Publish date', 'Keywords']]
    .concat(l.map((p) => [p.titre.slice(0, 100), `${SITE}/pinterest/${p.slug}.jpg`, p.tableau, '', p.description.slice(0, 500), p.lien, p.date, p.mots]));
  fs.writeFileSync(path.join(sortie, 'pinterest-air-fryer.csv'), '\ufeff' + lignes.map((x) => x.map(champ).join(',')).join('\r\n') + '\r\n');
  fs.writeFileSync(path.join(sortie, 'epingles-air-fryer.json'), JSON.stringify(l));
  console.log({ airfryer: l.length, debut: l[0].date, fin: l[l.length - 1].date });
  process.exit(0);
}
/* ordre de publication : listes d'abord, puis recettes de saison (novembre, décembre), puis les autres en alternant les tableaux */
const deSaison = (r) => /novembre|décembre/.test(r.saison);
const parTableau = {};
for (const r of recettes.filter((r) => !deSaison(r))) (parTableau[r.tableau] = parTableau[r.tableau] || []).push(r);
const melange = [];
const files = Object.values(parTableau);
while (files.some((f) => f.length)) for (const f of files) if (f.length) melange.push(f.shift());
const ordre = [...listes.slice(0, 4), ...recettes.filter(deSaison).flatMap((r, k) => (k === 6 ? [r, listes[4]] : k === 12 ? [r, listes[5]] : [r])), ...melange].filter(Boolean);
if (!ordre.includes(listes[4])) ordre.splice(10, 0, listes[4]);
if (!ordre.includes(listes[5])) ordre.splice(20, 0, listes[5]);

/* calendrier : N par jour, 13 jours par fichier */
const HEURES = ['08:00', '10:30', '12:30', '15:00', '17:30', '19:30', '21:00'];
const debut = new Date(process.env.DEBUT || Date.now() + 86400000); debut.setUTCHours(0, 0, 0, 0);
const parJour = Math.ceil(ordre.length / 26);
ordre.forEach((p, k) => { const j = Math.floor(k / parJour); const d = new Date(debut.getTime() + j * 86400000); p.date = d.toISOString().slice(0, 10) + 'T' + HEURES[k % parJour] + ':00'; p.lot = j < 13 ? 1 : 2; /* lot 1 : 13 jours, importable tout de suite (Pinterest refuse au-delà de 14 jours) */ });

const champ = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
for (const lot of [1, 2]) {
  const l = ordre.filter((p) => p.lot === lot);
  const lignes = [['Title', 'Media URL', 'Pinterest board', 'Thumbnail', 'Description', 'Link', 'Publish date', 'Keywords']]
    .concat(l.map((p) => [p.titre.slice(0, 100), `${SITE}/pinterest/${p.slug}.jpg`, p.tableau, '', p.description.slice(0, 500), p.lien, p.date, p.mots]));
  fs.writeFileSync(path.join(sortie, `pinterest-lot-${lot}.csv`), '﻿' + lignes.map((x) => x.map(champ).join(',')).join('\r\n') + '\r\n');
}
const titres = new Set(ordre.map((p) => p.titre)); if (titres.size !== ordre.length) throw new Error('titres en double');
fs.writeFileSync(path.join(sortie, 'epingles.json'), JSON.stringify(ordre));
const tab = {}; ordre.forEach((p) => (tab[p.tableau] = (tab[p.tableau] || 0) + 1));
console.log({ epingles: ordre.length, parJour, lot1: ordre.filter((p) => p.lot === 1).length, lot2: ordre.filter((p) => p.lot === 2).length, debut: ordre[0].date, fin: ordre[ordre.length - 1].date, tableaux: tab });
