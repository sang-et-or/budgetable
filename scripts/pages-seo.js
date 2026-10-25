// Pages lisibles par Google, générées au moment de la publication (appelé par build.js) :
//  - /recettes/ et une page par recette (données structurées schema.org Recipe) ;
//  - des pages sur les recherches courantes (menu de la semaine pas cher, planning des repas, liste de courses, saison) ;
//  - le plan du site (sitemap.xml) complet.
// Tout vient des données de l'appli : aucune page n'est écrite à la main en double.
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = 'https://budgetable.fr';
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function charger(racine) {
  const g = globalThis;
  const avant = g.window;
  g.window = g;
  for (const f of ['catalogue', 'saison', 'gourmand', 'entrees', 'petitdej']) {
    delete require.cache[require.resolve(path.join(racine, 'js', f + '.js'))];
    require(path.join(racine, 'js', f + '.js'));
  }
  const data = require(path.join(racine, 'js', 'data.js'));
  let photos = {};
  try { photos = require(path.join(racine, 'js', 'photos.js')).PHOTOS || {}; } catch (e) { photos = {}; }
  const ING = {};
  const ajoute = (l) => (l || []).forEach((i) => { if (i && i.id && !ING[i.id]) ING[i.id] = i; });
  ajoute(data.ingredients); ajoute(g.Saison.INGREDIENTS); ajoute(g.Gourmand.INGREDIENTS); ajoute(g.CatalogueExtra.INGREDIENTS); ajoute(g.PetitDej.INGREDIENTS);
  const res = {
    ING, photos,
    groupes: [
      { cle: 'plats', titre: 'Plats du quotidien', recettes: data.recettes.map((r) => ({ ...r, portions: 4, categorie: 'Plat principal' })) },
      { cle: 'saison', titre: 'Recettes de saison', recettes: g.Saison.RECETTES.map((r) => ({ ...r, portions: 4, categorie: 'Plat principal' })) },
      { cle: 'entrees', titre: 'Entrées', recettes: g.Entrees.RECETTES.filter((r) => r.type === 'entree').map((r) => ({ ...r, portions: 4, categorie: 'Entrée' })) },
      { cle: 'desserts', titre: 'Desserts et goûters', recettes: g.Entrees.RECETTES.filter((r) => r.type !== 'entree').concat(g.Gourmand.RECETTES).map((r) => ({ ...r, portions: r.parts > 1 ? r.parts : 4, categorie: 'Dessert' })) },
      { cle: 'petitdej', titre: 'Petits-déjeuners', recettes: g.PetitDej.RECETTES.map((r) => ({ ...r, portions: r.parts > 1 ? r.parts : 2, categorie: 'Petit-déjeuner' })) }
    ]
  };
  g.window = avant;
  return res;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nb = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
const euros = (x) => x.toFixed(2).replace('.', ',') + ' €';

const ENTIERS = /oeuf|œuf|pain burger|baguette|tortilla|wrap|galette|yaourt|pot |crêpe|brick|feuille de lasagne|sachet|cube/i;
function quantite(q, ing, id) {
  const unite = ing.unite;
  if (unite === 'g' || unite === 'ml') {
    const pas = q < 10 ? 1 : q < 50 ? 5 : q < 250 ? 10 : q < 1000 ? 25 : 50;
    const v = Math.max(pas, Math.round(q / pas) * pas);
    return unite === 'g' ? (v >= 1000 ? `${nb(v / 1000)} kg` : `${v} g`) : (v >= 1000 ? `${nb(v / 1000)} L` : v >= 100 && v % 10 === 0 ? `${nb(v / 10)} cl` : `${v} ml`);
  }
  if (ENTIERS.test(ing.nom || '') || /oeuf|tortilla|pain_burger/.test(id || '')) return `${Math.max(1, Math.round(q))}`;
  if (q < 3) { const v = Math.max(0.5, Math.round(q * 2) / 2); const e = Math.floor(v); return v % 1 ? (e ? `${e} ½` : '½') : `${v}`; }
  return `${Math.round(q)}`;
}
const ligneIngredient = (id, q, ING) => {
  const i = ING[id];
  const qt = quantite(q, i, id);
  const nom = i.nom.toLowerCase();
  const elision = /^([aeiouéèêœ]|huile|herbe)/i.test(nom);   // « d’huile », mais « de haricots »
  return i.unite === 'g' || i.unite === 'ml' ? `${qt} ${elision ? 'd’' : 'de '}${nom}` : `${i.nom} : ${qt}`;
};
// coût estimé : part du conditionnement utilisée × prix moyen (estimation, comme dans l'appli)
const cout = (r, ING) => r.ing.reduce((t, [id, q]) => t + (ING[id] && ING[id].cond ? (q / ING[id].cond) * (ING[id].prixDemo || 0) : 0), 0);

const CSS = `:root{--papier:#f6f4ec;--encre:#1f2a24;--doux:#5d6a62;--poireau:#2f6b47;--trait:#ddd8c8;--carte:#fffdf7;--miel:#d9a420}
@media (prefers-color-scheme:dark){:root{--papier:#171d19;--encre:#eef0ea;--doux:#a9b3ab;--poireau:#7cc49a;--trait:#334039;--carte:#1f2722}}
*{box-sizing:border-box}body{margin:0;background:var(--papier);color:var(--encre);font:16px/1.65 Figtree,system-ui,sans-serif}
main{max-width:820px;margin:0 auto;padding:24px 16px 64px}
.marque{display:inline-flex;align-items:center;gap:8px;font:700 1.1rem 'Bricolage Grotesque',sans-serif;color:var(--encre);text-decoration:none}.marque svg{width:28px;height:28px}
h1{font:700 clamp(1.7rem,4.5vw,2.4rem)/1.15 'Bricolage Grotesque',sans-serif;margin:20px 0 8px}
h2{font:700 1.25rem/1.3 'Bricolage Grotesque',sans-serif;margin:32px 0 8px}
p,li{max-width:70ch}a{color:var(--poireau);text-underline-offset:3px}
.chapo{font-size:1.08rem;color:var(--doux)}
.infos{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;padding:0;list-style:none}.infos li{background:var(--carte);border:1px solid var(--trait);border-radius:99px;padding:4px 12px;font-size:.92rem}
.carte{background:var(--carte);border:1px solid var(--trait);border-radius:16px;padding:16px 18px;margin:16px 0}
.appel{background:var(--poireau);color:#fff;border-radius:16px;padding:18px 20px;margin:28px 0}.appel p{margin:0 0 10px}.appel a.btn{display:inline-block;background:#fff;color:var(--poireau);font-weight:700;padding:10px 18px;border-radius:99px;text-decoration:none}
figure{margin:16px 0}figure img{width:100%;max-height:380px;object-fit:cover;border-radius:16px;background:var(--trait)}figcaption{font-size:.78rem;color:var(--doux)}
ol li{margin-bottom:6px}.liste{columns:2 260px;padding-left:18px}.liste li{break-inside:avoid}
nav.fil{font-size:.88rem;color:var(--doux);margin-top:14px}nav.pied{margin-top:44px;padding-top:16px;border-top:1px solid var(--trait);font-size:.92rem;display:flex;flex-wrap:wrap;gap:6px 16px}
.petit{font-size:.88rem;color:var(--doux)}`;

const MARQUE = '<a class="marque" href="/"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="5" opacity=".85"/><circle cx="25" cy="7" r="6" fill="#d9a420"/></svg>Budgétable</a>';
const PIED = `<nav class="pied" aria-label="Plan du site"><a href="/">Préparer ma semaine</a><a href="/recettes/">Toutes les recettes</a><a href="/planificateur-de-repas.html">Planificateur de repas</a><a href="/menu-semaine-pas-cher.html">Menu de la semaine pas cher</a><a href="/planning-repas-semaine.html">Planning des repas</a><a href="/liste-de-courses.html">Liste de courses</a><a href="/menus-de-saison.html">Menus de saison</a><a href="/mentions-legales.html">Mentions légales</a><a href="/confidentialite.html">Confidentialité</a><a href="/conditions.html">Conditions</a></nav>`;
const APPEL = (txt) => `<div class="appel"><p><strong>${txt}</strong></p><p>Budgétable prépare vos déjeuners et dîners de la semaine selon vos goûts, la saison et votre budget, puis fait la liste de courses par rayon. 7 jours gratuits, sans carte bancaire.</p><a class="btn" href="/?source=seo">Préparer ma semaine</a></div>`;

function page({ url, titre, description, h1, corps, ld = [], image = null }) {
  const lds = ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Budgétable"><meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${SITE}${url}"><meta property="og:title" content="${esc(h1)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image || SITE + '/captures/telephone-semaine.png')}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<meta name="theme-color" content="#2f6b47">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Figtree:wght@400;600;700&display=swap">
<style>${CSS}</style>
${lds}
</head>
<body>
<main>
${MARQUE}
${corps}
${PIED}
</main>
</body>
</html>
`;
}

function moisTexte(m) {
  if (!m || !m.length) return '';
  return m.map((x) => MOIS[x - 1]).join(', ');
}

function generer(racine, dist) {
  const { ING, photos, groupes } = charger(racine);
  const urls = [];
  const toutes = [];
  const vus = new Set();
  for (const g of groupes) {
    g.recettes = g.recettes.filter((r) => r && r.nom && Array.isArray(r.ing) && r.ing.length && r.ing.every(([id]) => ING[id]) && Array.isArray(r.etapes) && r.etapes.length);
    for (const r of g.recettes) {
      let s = slug(r.nom); if (vus.has(s)) s = slug(r.nom + '-' + r.id); vus.add(s);
      r.slug = s; r.groupe = g; toutes.push(r);
    }
  }
  fs.mkdirSync(path.join(dist, 'recettes'), { recursive: true });
  for (const r of toutes) {
    const n = r.portions;
    const total = cout(r, ING) * n;
    const parPart = total / n;
    const lignes = r.ing.map(([id, q]) => ligneIngredient(id, q * n, ING));
    const photo = photos[r.id] || null;
    const voisins = r.groupe.recettes.filter((x) => x !== r).sort((a, b) => (a.slug > b.slug ? 1 : -1));
    const debut = voisins.findIndex((x) => x.slug > r.slug);
    const lies = voisins.slice(Math.max(0, debut), Math.max(0, debut) + 6).concat(voisins).slice(0, 6);
    const vege = !r.ing.some(([id]) => (ING[id].tags || []).includes('viande') || (ING[id].tags || []).includes('poisson'));
    const url = `/recettes/${r.slug}.html`;
    const desc = `${r.nom} : recette facile pour ${n} ${n > 1 ? 'personnes' : 'personne'}, prête en ${r.temps || 30} min. Ingrédients, étapes et coût estimé (environ ${euros(parPart)} la part).`;
    const ld = {
      '@context': 'https://schema.org', '@type': 'Recipe', name: r.nom, description: desc, inLanguage: 'fr-FR',
      author: { '@type': 'Organization', name: 'Budgétable', url: SITE },
      totalTime: `PT${r.temps || 30}M`, recipeYield: `${n} portions`, recipeCategory: r.categorie,
      recipeCuisine: r.cuisine ? r.cuisine.charAt(0).toUpperCase() + r.cuisine.slice(1) : 'Française',
      keywords: [r.nom, 'recette facile', 'petit budget', vege ? 'végétarien' : null, r.mois ? 'de saison' : null].filter(Boolean).join(', '),
      recipeIngredient: lignes, recipeInstructions: r.etapes.map((t) => ({ '@type': 'HowToStep', text: t })),
      ...(photo && photo.src ? { image: [photo.distant || photo.src] } : {}),
      ...(vege ? { suitableForDiet: 'https://schema.org/VegetarianDiet' } : {})
    };
    const fil = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Budgétable', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Recettes', item: SITE + '/recettes/' },
      { '@type': 'ListItem', position: 3, name: r.nom, item: SITE + url }] };
    const corps = `<nav class="fil"><a href="/recettes/">Recettes</a> › ${esc(r.groupe.titre)}</nav>
<h1>${esc(r.nom)}</h1>
<p class="chapo">Une recette ${r.niveau > 1 ? 'simple' : 'facile'} pour ${n} ${n > 1 ? 'personnes' : 'personne'}${vege ? ', végétarienne' : ''}, à faire en ${r.temps || 30} minutes.</p>
<ul class="infos"><li>⏱ ${r.temps || 30} min</li><li>🍽 ${n} portions</li><li>💶 ≈ ${euros(parPart)} la part</li>${r.mois ? `<li>🌱 De saison : ${esc(moisTexte(r.mois))}</li>` : ''}${vege ? '<li>🥕 Végétarien</li>' : ''}</ul>
${photo && photo.src ? `<figure><img src="${esc(photo.distant || photo.src)}" alt="${esc(r.nom)}" loading="lazy" width="800" height="380"><figcaption>Photo d’illustration : ${esc(photo.auteur || '')}${photo.licence ? `, ${esc(photo.licence)}` : ''}, via <a href="${esc(photo.page || 'https://commons.wikimedia.org')}" rel="noopener">Wikimedia Commons</a></figcaption></figure>` : ''}
<h2>Ingrédients pour ${n} ${n > 1 ? 'personnes' : 'personne'}</h2>
<ul class="liste">${lignes.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
<p class="petit">Coût total estimé : ${euros(total)}, soit environ ${euros(parPart)} par part. Estimation moyenne : le prix réel dépend de votre magasin.</p>
<h2>Préparation</h2>
<ol>${r.etapes.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
${APPEL(`Mettez « ${esc(r.nom)} » dans votre semaine`)}
<h2>D’autres idées : ${esc(r.groupe.titre.toLowerCase())}</h2>
<ul>${lies.map((x) => `<li><a href="/recettes/${x.slug}.html">${esc(x.nom)}</a></li>`).join('')}</ul>`;
    fs.writeFileSync(path.join(dist, 'recettes', r.slug + '.html'), page({ url, titre: `${r.nom} : recette facile et pas chère | Budgétable`, description: desc, h1: r.nom, corps, ld: [ld, fil], image: photo && (photo.distant || photo.src) }));
    urls.push(url);
  }
  // index des recettes
  {
    const corps = `<h1>Recettes faciles et pas chères</h1>
<p class="chapo">${toutes.length} recettes du quotidien : plats familiaux, recettes de saison, entrées, desserts et petits-déjeuners, avec les quantités et le coût estimé de chaque plat.</p>
${groupes.map((g) => `<h2 id="${g.cle}">${esc(g.titre)} (${g.recettes.length})</h2><ul class="liste">${g.recettes.slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((r) => `<li><a href="/recettes/${r.slug}.html">${esc(r.nom)}</a></li>`).join('')}</ul>`).join('\n')}
${APPEL('Ne cherchez plus quoi cuisiner')}`;
    fs.writeFileSync(path.join(dist, 'recettes', 'index.html'), page({ url: '/recettes/', titre: 'Recettes faciles et pas chères pour toute la semaine | Budgétable', description: `${toutes.length} recettes faciles et économiques : plats du quotidien, recettes de saison, entrées, desserts et petits-déjeuners, avec le coût estimé de chaque plat.`, h1: 'Recettes faciles et pas chères', corps, ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Recettes faciles et pas chères', url: SITE + '/recettes/' }] }));
    urls.push('/recettes/');
  }
  // pages thématiques
  const plats = groupes[0].recettes.concat(groupes[1].recettes);
  const moinsCheres = plats.slice().sort((a, b) => cout(a, ING) - cout(b, ING)).slice(0, 14);
  const lien = (r) => `<a href="/recettes/${r.slug}.html">${esc(r.nom)}</a>`;
  const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const exempleSemaine = jours.map((j, k) => `<li><strong>${j}</strong> : midi, ${lien(moinsCheres[k * 2 % moinsCheres.length])} · soir, ${lien(moinsCheres[(k * 2 + 1) % moinsCheres.length])}</li>`).join('');
  const coutSemaine = moinsCheres.reduce((t, r) => t + cout(r, ING), 0) * 4;
  const faq = (qs) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  const theme = [
    {
      fichier: 'menu-semaine-pas-cher.html', titre: 'Menu de la semaine pas cher : 14 repas à petit prix | Budgétable',
      description: 'Un menu de la semaine pas cher pour 4 personnes : 7 déjeuners et 7 dîners économiques, les recettes, et la liste de courses faite automatiquement.',
      h1: 'Menu de la semaine pas cher', corps: `<p class="chapo">Manger bien sans exploser le budget, c’est surtout une question d’organisation : un menu prévu à l’avance, des produits de saison, et une liste de courses sans oubli ni doublon.</p>
<h2>Exemple de menu économique pour 4 personnes</h2>
<ul>${exempleSemaine}</ul>
<p class="petit">Coût estimé de ces 14 plats pour 4 : environ ${euros(coutSemaine)}, soit ${euros(coutSemaine / 56)} par part. Estimation moyenne, le prix réel dépend de votre magasin.</p>
<h2>5 astuces pour un menu de la semaine pas cher</h2>
<ol><li><strong>Partir de ce qu’on a déjà</strong> au placard et au frigo avant d’acheter.</li><li><strong>Cuisiner de saison</strong> : les légumes de saison sont moins chers et meilleurs.</li><li><strong>Prévoir les restes</strong> : un plat du soir peut faire la gamelle du lendemain midi.</li><li><strong>Alterner les protéines</strong> : œufs, lentilles et pois chiches coûtent moins cher que la viande.</li><li><strong>Faire une seule liste de courses</strong> par rayon, et s’y tenir.</li></ol>
${APPEL('Votre menu pas cher, prêt en 2 minutes')}`,
      ld: [faq([['Comment faire un menu de la semaine pas cher ?', 'Partez de ce que vous avez déjà, choisissez des produits de saison, prévoyez les restes, alternez viande, œufs et légumineuses, et faites une seule liste de courses par rayon.'], ['Combien coûte un menu de la semaine pour 4 personnes ?', `Avec des recettes simples et de saison, on peut viser environ ${euros(coutSemaine / 56)} par part, selon votre magasin.`]])]
    },
    {
      fichier: 'planning-repas-semaine.html', titre: 'Planning des repas de la semaine : organisez midi et soir | Budgétable',
      description: 'Faites votre planning de repas de la semaine en 2 minutes : déjeuners et dîners selon vos goûts, vos allergies et votre budget, avec la liste de courses.',
      h1: 'Planning des repas de la semaine', corps: `<p class="chapo">Un planning de repas, c’est la fin du « on mange quoi ce soir ? » : on décide une fois pour toute la semaine, on fait les courses une fois, et on cuisine sans stress.</p>
<h2>Comment faire son planning de repas</h2>
<ol><li>Notez qui mange à la maison chaque midi et chaque soir.</li><li>Choisissez des plats rapides les soirs chargés, et un plat plus long le week-end.</li><li>Prévoyez des restes pour les gamelles.</li><li>Variez : poisson, viande, végétarien, féculents et légumes.</li><li>Déduisez la liste de courses de votre planning.</li></ol>
<h2>Un exemple de planning</h2>
<ul>${exempleSemaine}</ul>
<p>Budgétable fait tout ça pour vous : il démarre la semaine le jour où vous la préparez, tient compte des allergies, des enfants et du temps que vous avez, et vous laisse changer un plat d’un geste.</p>
${APPEL('Faites votre planning maintenant')}`,
      ld: [faq([['Comment organiser les repas de la semaine ?', 'Notez qui mange à la maison, choisissez des plats rapides pour les soirs chargés, prévoyez des restes, variez les protéines et déduisez la liste de courses de votre planning.']])]
    },
    {
      fichier: 'planificateur-de-repas.html', titre: 'Planificateur de repas gratuit 7 jours : menus et liste de courses | Budgétable',
      description: 'Budgétable est un planificateur de repas en français : il crée vos menus de la semaine selon vos goûts, vos allergies et votre budget, et fait la liste de courses. Essai gratuit 7 jours.',
      h1: 'Le planificateur de repas qui fait les menus à votre place', corps: `<p class="chapo">Un planificateur de repas (ou planificateur de menus) vous aide à décider à l’avance ce que vous allez manger, à faire les bonnes courses et à tenir votre budget. Budgétable va plus loin : il propose lui-même les repas, et vous ajustez.</p>
<h2>Ce que fait le planificateur Budgétable</h2>
<ul><li><strong>Des menus sur mesure</strong> : 7 déjeuners et 7 dîners selon vos goûts, la saison, vos allergies et régimes (végétarien, sans porc, sans gluten…).</li><li><strong>Selon votre budget</strong> : le coût estimé de chaque plat et de la semaine, avec des ajustements si ça dépasse.</li><li><strong>Selon votre vie</strong> : qui mange à la maison, le temps de cuisine en semaine, les enfants, les gamelles du midi.</li><li><strong>La liste de courses automatique</strong>, triée par rayon, sans racheter ce qui est au placard.</li><li><strong>Plus de ${toutes.length} recettes</strong> faciles, plus vos propres recettes.</li><li><strong>Sur téléphone et ordinateur</strong>, à installer comme une appli, avec un compte pour tout retrouver partout.</li></ul>
<h2>Comment ça marche</h2>
<ol><li>Répondez à quelques questions (goûts, foyer, budget) : 2 minutes.</li><li>Votre semaine de repas apparaît, prête.</li><li>Changez, déplacez ou ajoutez ce que vous voulez.</li><li>Faites vos courses avec la liste, en magasin ou au drive.</li></ol>
<h2>Exemple de semaine proposée</h2>
<ul>${exempleSemaine}</ul>
${APPEL('Essayez le planificateur gratuitement')}`,
      ld: [faq([['Qu’est-ce qu’un planificateur de repas ?', 'C’est un outil qui organise vos repas de la semaine à l’avance et en déduit la liste de courses. Budgétable propose lui-même les menus selon vos goûts, vos allergies et votre budget.'], ['Le planificateur de repas Budgétable est-il gratuit ?', 'Les 7 premiers jours sont gratuits, sans carte bancaire. Ensuite, l’abonnement coûte 2,99 € par mois, sans engagement.'], ['Faut-il installer une application ?', 'Non : Budgétable fonctionne dans le navigateur, sur téléphone et ordinateur. Vous pouvez aussi l’installer sur l’écran d’accueil comme une appli.']])]
    },
    {
      fichier: 'liste-de-courses.html', titre: 'Liste de courses automatique, triée par rayon | Budgétable',
      description: 'Votre liste de courses se fait toute seule à partir des menus de la semaine : triée par rayon, sans racheter ce qui est déjà au placard, avec un budget estimé.',
      h1: 'Une liste de courses qui se fait toute seule', corps: `<p class="chapo">Une fois les repas de la semaine choisis, Budgétable additionne les quantités de chaque recette et vous donne une liste de courses prête à l’emploi.</p>
<h2>Ce que fait la liste de courses</h2>
<ul><li><strong>Triée par rayon</strong> : fruits et légumes, crèmerie, épicerie, surgelés…</li><li><strong>Les bons conditionnements</strong> : « 2 × filet de 1 kg » plutôt que « 1,3 kg ».</li><li><strong>Sans doublon</strong> : ce qui est déjà au placard est retiré.</li><li><strong>Avec un budget estimé</strong>, et vos tickets de caisse pour comparer les magasins.</li><li>À cocher dans le magasin, ou à envoyer vers le drive avec l’extension.</li></ul>
${APPEL('Votre liste de courses en 2 minutes')}`, ld: []
    },
    {
      fichier: 'menus-de-saison.html', titre: 'Menus de saison : recettes avec les légumes du mois | Budgétable',
      description: 'Des recettes de saison mois par mois : courges, châtaignes, poireaux, choux… Cuisinez les légumes du moment, meilleurs et moins chers.',
      h1: 'Menus de saison, mois par mois', corps: `<p class="chapo">Les légumes de saison sont plus savoureux et moins chers. Voici nos recettes classées selon les mois où leurs légumes sont de saison en France.</p>
${MOIS.map((m, k) => { const l = groupes[1].recettes.filter((r) => (r.mois || []).includes(k + 1)); return l.length ? `<h2 id="${slug(m)}">Recettes de ${m}</h2><ul class="liste">${l.map((r) => `<li>${lien(r)}</li>`).join('')}</ul>` : ''; }).join('\n')}
${APPEL('Des menus de saison chaque semaine')}`, ld: []
    }
  ];
  for (const t of theme) {
    fs.writeFileSync(path.join(dist, t.fichier), page({ url: '/' + t.fichier, titre: t.titre, description: t.description, h1: t.h1, corps: `<h1>${esc(t.h1)}</h1>\n${t.corps}`, ld: t.ld }));
    urls.push('/' + t.fichier);
  }
  // plan du site complet
  const jour = new Date().toISOString().slice(0, 10);
  const tout = ['/', ...urls, '/mentions-legales.html', '/confidentialite.html', '/conditions.html', '/extension.html'];
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + tout.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${jour}</lastmod></url>`).join('\n') + '\n</urlset>\n');
  return { recettes: toutes.length, pages: urls.length };
}

module.exports = generer;
if (require.main === module) console.log(generer(path.join(__dirname, '..'), path.join(__dirname, '..', 'dist')));
