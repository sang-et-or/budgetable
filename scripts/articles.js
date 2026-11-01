// Articles de conseils (rubrique /conseils/) : texte écrit à la main, listes de recettes calculées depuis les données
// de l'appli (prix estimés, saison), pour que chaque article reste juste quand le catalogue change.
'use strict';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const euros = (x) => x.toFixed(2).replace('.', ',') + ' €';

/**
 * @param {object} c contexte : { plats, saison, toutes, ING, CALENDRIER, cout(r), lien(r), esc }
 * @returns {Array<{slug, titre, description, date, image?, corps}>}
 */
module.exports = function articles(c) {
  const { plats, saison, ING, CALENDRIER, cout, lien, esc } = c;
  const toutes = c.toutes || plats.concat(saison);
  const liste = [];
  const par = (s) => toutes.find((r) => r.slug === s);
  const part = (r) => cout(r);   // coût d'une portion (comme sur les pages recettes)

  /* Noël : 3 menus complets choisis dans le catalogue (le coût se recalcule si les prix changent) */
  {
    const MENUS = [
      ['Le menu classique', 'Une volaille rôtie et ses légumes d’hiver : le goût des fêtes, sans le prix du chapon.', ['veloute-de-courge-et-chataignes', 'cuisses-de-poulet-roties-panais-et-carottes', 'poire-au-chocolat']],
      ['Le menu saumon', 'Le saumon reste la star de Noël. Cuisiné en fondue de poireaux, il en faut bien moins qu’en tranches.', ['poireaux-vinaigrette-et-oeufs-mimosa', 'saumon-a-la-fondue-de-poireaux', 'mousse-au-chocolat']],
      ['Le menu végétarien', 'Champignons et risotto crémeux : un repas de fête généreux, qui plaît aussi aux non-végétariens.', ['veloute-de-champignons-et-croutons', 'risotto-cremeux-aux-champignons', 'crumble-aux-pommes']]
    ].map(([titre, intro, l]) => ({ titre, intro, plats: l.map(par).filter(Boolean) })).filter((m) => m.plats.length === 3);
    const total = (m) => m.plats.reduce((t, r) => t + part(r), 0);
    const ROLES = ['Entrée', 'Plat', 'Dessert'];
    if (MENUS.length) liste.push({
      slug: 'menu-de-noel-pas-cher', date: '2026-11-01',
      titre: `Menu de Noël pas cher : ${MENUS.length} menus complets à petit prix`,
      description: `${MENUS.length} menus de Noël faits maison, entrée, plat et dessert, avec le coût estimé par personne. Des idées de repas de fêtes pour régaler toute la famille sans exploser le budget.`,
      corps: `<p class="chapo">Un beau repas de Noël n’a pas besoin de foie gras ni de chapon. Avec des produits d’hiver, un plat mijoté ou rôti et un dessert maison, on régale toute la table pour une fraction du prix habituel.</p>
${MENUS.map((m) => `<h2>${esc(m.titre)} · ≈ ${euros(total(m))} par personne</h2>
<p>${esc(m.intro)}</p>
<ul>${m.plats.map((r, k) => `<li><strong>${ROLES[k]}</strong> : ${lien(r)} <span class="petit">· ≈ ${euros(part(r))} la part</span></li>`).join('')}</ul>`).join('\n')}
<p class="petit">Coûts estimés à partir de prix moyens en supermarché, par portion adulte. Le prix réel dépend de votre magasin et des marques choisies.</p>
<h2>Nos astuces pour un Noël moins cher</h2>
<ul><li><strong>Choisissez une volaille simple</strong> : un poulet fermier ou des cuisses rôties font un très beau plat de fête, pour bien moins cher qu’un chapon ou une dinde aux marrons.</li>
<li><strong>Utilisez les produits chers comme des touches</strong> : un peu de saumon fumé sur des toasts, quelques noix ou un trait de crème suffisent à faire « fête ».</li>
<li><strong>Faites le dessert vous-même</strong> : une mousse ou un fondant au chocolat maison coûte bien moins cher qu’une bûche de pâtissier, et se prépare la veille.</li>
<li><strong>Misez sur les légumes d’hiver</strong> : courge, châtaigne, panais, poireau et champignons sont de saison et donnent des plats généreux.</li>
<li><strong>Faites vos courses tôt</strong> : achetez les produits secs et surgelés dès début décembre, avant la cohue des fêtes.</li></ul>
<h2>Préparer à l’avance pour profiter du réveillon</h2>
<p>Les veloutés, la mousse au chocolat et les crumbles se préparent la veille. Le jour J, il ne reste que le plat à réchauffer ou à enfourner : vous passez la soirée à table, pas en cuisine.</p>`
    });
  }

  /* Repas de fêtes petit budget : méthode + recettes à préparer la veille */
  {
    const veille = ['veloute-de-potiron', 'veloute-de-chou-fleur-au-curry', 'gratin-dauphinois-et-salade-d-endives-aux-noix', 'blanquette-de-poulet-aux-champignons', 'fondant-au-chocolat', 'tarte-aux-pommes'].map(par).filter(Boolean);
    liste.push({
      slug: 'repas-de-fetes-petit-budget', date: '2026-11-01',
      titre: 'Repas de fêtes petit budget : 8 astuces pour bien recevoir sans se ruiner',
      description: 'Comment organiser un repas de fêtes à petit budget : fixer un budget par personne, partager les plats, choisir des produits de saison et cuisiner à l’avance. Avec des recettes faciles.',
      corps: `<p class="chapo">Noël et le Nouvel An pèsent lourd sur le budget courses. Avec un peu d’organisation, on peut pourtant recevoir généreusement sans y laisser son mois.</p>
<h2>8 astuces pour des fêtes moins chères</h2>
<ol class="liste-num"><li><strong>Fixez un budget par personne</strong> avant de faire le menu : c’est lui qui guide les choix, pas l’inverse.</li>
<li><strong>Partagez les plats</strong> : chaque invité apporte l’entrée, le fromage ou le dessert. Moins de dépense pour chacun, et plus de convivialité.</li>
<li><strong>Un apéritif maison</strong> : légumes à croquer, houmous, toasts et cakes salés coûtent bien moins cher que les petits fours tout prêts.</li>
<li><strong>Un seul produit « luxe »</strong> plutôt que trois : du saumon, ou des huîtres, ou un bon fromage, mais pas tout.</li>
<li><strong>Les produits de saison</strong> : courges, châtaignes, poireaux, endives, clémentines et pommes sont au meilleur prix en décembre.</li>
<li><strong>Le plat mijoté</strong> : blanquette, volaille rôtie ou gratin nourrissent beaucoup de monde pour peu cher, et se réchauffent très bien.</li>
<li><strong>La liste de courses complète</strong> faite à l’avance, pour ne rien acheter en double et éviter l’achat de panique du 24 décembre.</li>
<li><strong>Les restes prévus</strong> : un plat de fête doublé devient le repas du lendemain, et rien ne se perd.</li></ol>
<h2>Des recettes à préparer la veille</h2>
<ul>${veille.map((r) => `<li>${lien(r)} <span class="petit">· ≈ ${euros(part(r))} la part</span></li>`).join('')}</ul>
<p class="petit">Coûts estimés à partir de prix moyens en supermarché. Le prix réel dépend de votre magasin.</p>
<h2>Et pour le menu complet ?</h2>
<p>Retrouvez nos <a href="/conseils/menu-de-noel-pas-cher.html">menus de Noël pas chers</a> (entrée, plat, dessert), avec le coût estimé par personne.</p>`
    });
  }

  /* 1. dîners à moins de 2 € */
  {
    const vus = new Set();
    const diners = plats.concat(saison).filter((r) => (r.repas || ['diner']).includes('diner') && cout(r) < 2)
      .sort((a, b) => cout(a) - cout(b)).filter((r) => { const k = r.modele || r.nom.split(' ')[0]; if (vus.has(k)) return false; vus.add(k); return true; }).slice(0, 10);
    liste.push({
      slug: 'diners-moins-de-2-euros', date: '2026-10-26',
      titre: `${diners.length} dîners à moins de 2 € la part`,
      description: `${diners.length} idées de dîners faits maison à moins de 2 € par personne, simples et rapides, avec la recette et le coût estimé de chaque plat.`,
      corps: `<p class="chapo">Bien manger le soir sans se ruiner, c’est possible : avec des légumes de saison, des œufs, des légumineuses et un peu d’organisation, un dîner maison revient souvent à moins de 2 € par personne.</p>
<h2>Les ${diners.length} dîners</h2>
<ol class="liste-num">${diners.map((r) => `<li>${lien(r)} <span class="petit">· ≈ ${euros(cout(r))} la part · ${r.temps || 30} min</span></li>`).join('')}</ol>
<p class="petit">Coûts estimés à partir de prix moyens en supermarché, par portion adulte. Le prix réel dépend de votre magasin.</p>
<h2>Pourquoi ces plats coûtent si peu</h2>
<ul><li><strong>Les protéines bon marché</strong> : œufs, lentilles, pois chiches, haricots secs et thon en boîte coûtent bien moins cher que la viande, pour autant de satiété.</li>
<li><strong>Les légumes de saison</strong> : en automne, la courge, le chou, le poireau et la carotte font de gros volumes pour quelques centimes.</li>
<li><strong>Les féculents de base</strong> : riz, pâtes, semoule et pommes de terre complètent l’assiette pour presque rien.</li>
<li><strong>Le fait maison</strong> : un plat préparé coûte souvent deux à trois fois plus cher que la même recette cuisinée chez soi.</li></ul>
<h2>Nos astuces pour garder le cap</h2>
<ul><li>Cuisinez un peu plus le soir : le reste devient la gamelle du lendemain midi.</li>
<li>Gardez toujours au placard une boîte de pois chiches, des œufs et un paquet de pâtes : le dîner de secours est prêt.</li>
<li>Faites une seule liste de courses pour la semaine, par rayon, et tenez-vous-y.</li></ul>`
    });
  }

  /* 2. faire ses menus de la semaine */
  {
    const exemples = plats.slice().sort((a, b) => cout(a) - cout(b)).slice(0, 6);
    liste.push({
      slug: 'faire-ses-menus-de-la-semaine', date: '2026-10-26',
      titre: 'Comment faire ses menus de la semaine en 5 étapes',
      description: 'La méthode simple pour planifier ses repas de la semaine : qui mange quand, plats rapides, restes, équilibre et liste de courses. Avec un exemple.',
      corps: `<p class="chapo">Planifier ses repas, c’est 20 minutes une fois par semaine pour ne plus se demander chaque soir « on mange quoi ? ». Voici la méthode, étape par étape.</p>
<h2>1. Notez qui mange à la maison</h2>
<p>Midi et soir, jour par jour : qui est là, qui mange à la cantine, qui rentre tard. Vous saurez combien de portions prévoir, et quels soirs il faut un plat express.</p>
<h2>2. Choisissez les plats selon le temps que vous avez</h2>
<p>Les soirs de semaine, visez 20 à 30 minutes : omelette, pâtes, poêlée, soupe. Gardez les plats mijotés et les gratins pour le week-end.</p>
<h2>3. Prévoyez les restes</h2>
<p>Doublez les quantités d’un ou deux dîners : ils deviennent les déjeuners du lendemain. C’est le moyen le plus simple de gagner du temps et de l’argent.</p>
<h2>4. Vérifiez l’équilibre sur la semaine</h2>
<p>Pas besoin que chaque repas soit parfait : regardez la semaine entière. Des légumes à chaque repas, du poisson deux fois, des légumineuses au moins deux fois, de la viande rouge sans excès, et des féculents complets de temps en temps.</p>
<h2>5. Faites la liste de courses à partir des menus</h2>
<p>Additionnez les ingrédients de toutes les recettes, retirez ce que vous avez déjà, et classez par rayon. Vous n’achetez que ce qui sert, et rien ne se perd.</p>
<h2>Un exemple de plats faciles pour commencer</h2>
<ul>${exemples.map((r) => `<li>${lien(r)} <span class="petit">· ≈ ${euros(cout(r))} la part</span></li>`).join('')}</ul>
<div class="encadre"><strong>Et si l’appli le faisait pour vous ?</strong> Budgétable fait ces 5 étapes en 2 minutes : il demande qui mange à la maison, vos goûts et votre budget, prépare 7 déjeuners et 7 dîners, prévoit les restes, vérifie l’équilibre et fait la liste de courses.</div>`
    });
  }

  /* 3. de saison en novembre */
  {
    const m = 11;
    const ids = Object.entries(CALENDRIER || {}).filter(([id, mois]) => mois && (mois instanceof Set ? mois.has(m) : Array.isArray(mois) && mois.includes(m)) && ING[id]).map(([id]) => id);
    const FRUITS = new Set(['fraises', 'framboises', 'cerises', 'peche', 'melon', 'pasteque', 'abricot', 'raisin', 'pomme', 'poire', 'kiwi', 'orange', 'clementine', 'citron', 'figue', 'prune', 'banane']);
    const legumes = ids.filter((id) => !FRUITS.has(id)).map((id) => ING[id].nom.replace(/\s*\([^)]*\)\s*$/, ''));
    const fruits = ids.filter((id) => FRUITS.has(id)).map((id) => ING[id].nom.replace(/\s*\([^)]*\)\s*$/, ''));
    const recettes = saison.filter((r) => (r.mois || []).includes(m)).slice(0, 12);
    liste.push({
      slug: 'legumes-de-saison-novembre', date: '2026-10-27',
      titre: `Que manger en ${MOIS[m - 1]} ? Les fruits et légumes de saison et ${recettes.length} recettes`,
      description: `Les fruits et légumes de saison en ${MOIS[m - 1]} en France, pourquoi ils coûtent moins cher, et ${recettes.length} recettes faciles pour en profiter.`,
      corps: `<p class="chapo">En ${MOIS[m - 1]}, les étals se remplissent de courges, de choux et de poireaux. Cuisiner de saison, c’est des produits plus savoureux, et souvent moins chers, parce qu’ils sont abondants.</p>
<h2>Les fruits et légumes de saison en ${MOIS[m - 1]}</h2>
<h3>Légumes</h3><ul class="colonnes">${legumes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>${fruits.length ? `<h3>Fruits</h3><ul class="colonnes">${fruits.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
<p class="petit">Saisons en France métropolitaine. Carottes, oignons, pommes de terre et champignons se trouvent toute l’année.</p>
<h2>${recettes.length} recettes de saison</h2>
<ul class="colonnes">${recettes.map((r) => `<li>${lien(r)}</li>`).join('')}</ul>
<h2>Nos astuces de saison</h2>
<ul><li><strong>La courge se garde des semaines</strong> entière, dans un endroit frais : achetez-la quand elle est en promotion.</li>
<li><strong>Une soupe, plusieurs repas</strong> : un grand velouté se congèle très bien en portions.</li>
<li><strong>Le chou et le poireau</strong> se cuisinent en poêlée, en gratin ou en soupe : un seul légume, trois repas différents.</li></ul>`
    });
  }

  /* 4. réduire le budget courses */
  liste.push({
    slug: 'depenser-moins-aux-courses', date: '2026-10-27',
    titre: '9 astuces pour dépenser moins aux courses chaque semaine',
    description: '9 astuces concrètes pour réduire le budget courses d’une famille : menus, liste, placard, prix au kilo, marques, saison, restes et tickets de caisse.',
    corps: `<p class="chapo">Le budget alimentation est l’un des rares postes qu’on peut vraiment faire baisser, sans manger moins bien. Voici ce qui marche le mieux.</p>
<ol class="liste-num">
<li><strong>Prévoir les menus de la semaine</strong> avant d’aller au magasin : c’est la base de tout le reste.</li>
<li><strong>Faire une liste par rayon</strong>, et ne pas en sortir : la plupart des achats en trop se font sur un coup de tête.</li>
<li><strong>Regarder le placard avant de partir</strong> : on rachète souvent ce qu’on a déjà.</li>
<li><strong>Comparer le prix au kilo</strong>, pas le prix du paquet : il est écrit en petit sur l’étiquette.</li>
<li><strong>Essayer les marques distributeur</strong> pour les produits de base : pâtes, riz, conserves, farine.</li>
<li><strong>Acheter de saison</strong> : les fruits et légumes du moment sont moins chers et meilleurs.</li>
<li><strong>Remplacer une partie de la viande</strong> par des œufs, des lentilles ou des pois chiches.</li>
<li><strong>Cuisiner les restes</strong> : un plat du soir devient la gamelle du midi.</li>
<li><strong>Garder ses tickets de caisse</strong> : en les comparant, on voit vite quel magasin est le moins cher pour ses produits.</li>
</ol>
<div class="encadre"><strong>Budgétable fait une bonne partie du travail</strong> : menus selon votre budget, liste par rayon avec les bons conditionnements, placard suivi pour ne rien racheter, lecture des tickets de caisse et comparaison des magasins.</div>`
  });

  /* 5. manger équilibré en famille */
  {
    const familiaux = plats.filter((r) => (r.tags || []).includes('enfants')).sort((a, b) => cout(a) - cout(b)).slice(0, 8);
    liste.push({
      slug: 'manger-equilibre-en-famille', date: '2026-10-27',
      titre: 'Manger équilibré en famille avec un petit budget',
      description: 'Les repères simples pour manger équilibré en famille sans dépenser plus : légumes, légumineuses, poisson, féculents, produits laitiers, et des recettes que les enfants aiment.',
      corps: `<p class="chapo">Manger équilibré ne veut pas dire acheter des produits chers. Les repères de Santé publique France tiennent en quelques règles simples, faciles à suivre avec un petit budget.</p>
<h2>Les repères, en clair</h2>
<ul><li><strong>Des fruits et légumes</strong> : au moins 5 portions par jour, frais, surgelés ou en conserve.</li>
<li><strong>Des légumineuses</strong> (lentilles, pois chiches, haricots) : au moins 2 fois par semaine.</li>
<li><strong>Du poisson</strong> : 2 fois par semaine, dont un poisson gras (sardine, maquereau, saumon).</li>
<li><strong>Des féculents complets</strong> (pain, pâtes, riz complets) : au moins un par jour.</li>
<li><strong>Des produits laitiers</strong> : 2 par jour pour les adultes.</li>
<li><strong>Moins de viande rouge</strong> (500 g par semaine au plus) et <strong>de charcuterie</strong> (150 g par semaine au plus).</li></ul>
<p class="petit">Source : recommandations alimentaires de Santé publique France pour les adultes (2019). Les besoins des enfants dépendent de leur âge.</p>
<h2>Les astuces qui marchent avec les enfants</h2>
<ul><li>Glissez les légumes dans les plats qu’ils aiment : gratins, sauces, omelettes, pâtes.</li>
<li>Proposez sans forcer, plusieurs fois : il faut souvent goûter un aliment 8 à 10 fois pour l’accepter.</li>
<li>Faites-les participer : choisir un légume au marché, éplucher, mélanger.</li></ul>
<h2>Des plats que les enfants aiment</h2>
<ul>${familiaux.map((r) => `<li>${lien(r)} <span class="petit">· ≈ ${euros(cout(r))} la part</span></li>`).join('')}</ul>
<div class="encadre"><strong>Le coach famille de Budgétable</strong> prépare la semaine dans cet esprit, et le bilan nutritionnel vous dit quels repères sont atteints. Vous pouvez aussi poser vos questions à votre coach, à tout moment.</div>`
    });
  }
  return liste;
};
