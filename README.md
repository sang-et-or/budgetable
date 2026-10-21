# Budgétable

Des menus de la semaine pour toute la famille, adaptés aux goûts et au budget, et la liste de courses
au meilleur prix dans les drives proches. Site web installable (PWA), sans serveur.

## Mise en ligne (Render)

Le fichier `render.yaml` décrit tout. Sur render.com : **New › Blueprint**, choisir ce dépôt, valider.
À chaque modification poussée sur GitHub, Render reconstruit et republie le site :

1. `node build.js` crée `dist/` ;
2. `node scripts/photos-locales.js` copie les photos des plats (Wikimedia Commons, licences libres,
   crédits affichés dans le site) dans `dist/photos/` pour qu'elles soient servies par le site lui-même.

## Contenu

- `index.html`, `js/` : le site (menus, budget, courses, drives, test de goût, commis de cuisine IA)
- `extension/` : extension Chrome qui relève les prix affichés sur les sites des drives, sur le compte de l'utilisateur
- `tests/` : tests du moteur (`node --test tests/*.test.js`) et parcours complets (Playwright)
- `DEPLOIEMENT.md` : obligations avant d'ouvrir au public, limites, montée en charge

---

## Historique : V0.1

Planificateur de repas pour les familles : questionnaire adaptatif, profil alimentaire,
7 déjeuners + 7 dîners, budget estimé, liste de courses par rayon. Application web
installable (PWA), sans serveur pour l'instant.

## Ce qui marche, ce qui est simulé

| Partie | Statut |
| --- | --- |
| Questionnaire, profil, menus, remplacement, notes, provisions, « ce soir », liste, impression, PWA | Fonctionnel |
| Budget | Estimation sur des **prix de démonstration** (`js/data.js`, champ `prixDemo`) |
| Compte, Premium 4,99 € | Simulés (stockage sur l'appareil, aucun paiement) |
| Comparateur de drives | Moteur prêt, testé sur **3 magasins fictifs** ; aucune enseigne réelle branchée |

## Lancer

```bash
node build.js                  # crée dist/ (page HTML complète)
python3 -m http.server 8765 -d dist   # ou : npx serve dist
# ouvrir http://localhost:8765
```

L'installation sur l'écran d'accueil et l'impression en PDF demandent un hébergement en HTTPS
(Netlify, Vercel, OVH, GitHub Pages…) ou `localhost`.

## Tester

```bash
node --test tests/engine.test.js     # 17 tests du moteur (sécurité allergies sur 1 000 profils, budget, drives…)
pip install playwright && python3 -m playwright install chromium
python3 -m http.server 8765 -d dist & python3 tests/parcours.py   # parcours complet dans un navigateur
```

## Fichiers

- `js/data.js` : ingrédients (rayon, conditionnement, allergènes, prix démo) et 34 recettes.
- `js/engine.js` : moteur pur (aucun accès à l'écran) — génération, portions, filtres, liste, budget, optimisation drives. Réutilisable tel quel côté serveur.
- `js/app.js` : interface (questionnaire, onglets Semaine / Ce soir / Courses / Drives / Profil).
- `index.html` : styles et squelette. `sw.js` + `manifest.webmanifest` : mode installable et hors ligne.

## Ajouter un drive plus tard

Un connecteur fournit, pour une zone : la liste des magasins (`id`, `nom`, `distanceKm`, `frais`)
et, pour chaque ingrédient, un prix par conditionnement **avec sa source et sa date**.
`Engine.optimiserDrives(articles, magasins, { mode })` fait le reste.
N'utilisez que des données dont l'usage commercial est autorisé par écrit.
