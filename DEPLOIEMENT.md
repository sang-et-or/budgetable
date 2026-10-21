# Mettre Budgétable en ligne pour le public

## 1. Mise en ligne de test (gratuite, 10 minutes)

1. `node build.js` crée le dossier `dist/` (ou utilisez celui de l'archive).
2. Allez sur app.netlify.com/drop et glissez le dossier `dist`.
3. Netlify donne une adresse en `https://…netlify.app`. Tout fonctionne alors : installation sur
   l'écran d'accueil, impression en PDF, **recherche des drives près de chez soi**.
4. Nom de domaine : réservez `budgetable.fr` (OVH, Gandi…) puis reliez-le dans Netlify (Domain settings).

Autres hébergeurs possibles : Vercel, Cloudflare Pages, GitHub Pages, OVH (hébergement web). Préférez un
hébergement dans l'Union européenne si vous stockez des données de comptes (étape 3 du plan).

## 2. Ce qui fonctionne pour chaque utilisateur, partout en France

| Fonction | Comment | Source |
| --- | --- | --- |
| Menus, budget, listes | dans le navigateur de l'utilisateur | Budgétable |
| Drives près de chez soi | code postal → magasins dans le rayon choisi | Base Adresse Nationale + OpenStreetMap |
| Prix réels de ses drives | extension Chrome, sur son compte, pendant ses courses en ligne | ce que l'utilisateur voit à l'écran |
| Un panier par drive au meilleur prix | dans l'extension, à partir des prix qu'il a relevés | calcul Budgétable |

## 3. Obligations avant d'ouvrir au public

- **Mentions légales** (éditeur, hébergeur), **politique de confidentialité** (RGPD, données de santé
  facultatives et consentement), **conditions d'utilisation**.
- **Attribution des données ouvertes**, déjà affichée sous les résultats :
  « © contributeurs OpenStreetMap (ODbL) » et « Base Adresse Nationale ».
- **Statut** : micro-entreprise ou société, pour encaisser l'abonnement Premium.
- **Avis juridique** sur l'extension (conditions d'utilisation des drives) avant sa publication sur le Chrome Web Store.

## 4. Photos des plats

- 140 photos sous licence libre : une par recette maison et une par type de plat (12 538 menus couverts) (CC0, domaine public, CC BY, CC BY-SA), venant de Wikimedia Commons.
- **Obligation** : garder le crédit (auteur, licence, lien) — il est affiché sous chaque photo dans la fiche
  recette et dans Profil › Crédits photos. Ne pas retirer ces mentions.
- Les photos sont chargées depuis les serveurs de Wikimedia. Avec beaucoup de visiteurs, copiez-les sur
  votre propre hébergement (les licences l'autorisent) et changez l'adresse dans `js/photos.js`.
- À terme : vos propres photos des recettes (les plus fidèles et les plus vendeuses).

## 5. Quand il y aura beaucoup d'utilisateurs

- **OpenStreetMap / Overpass** : les serveurs publics sont gratuits mais parfois saturés (erreur 502 constatée
  lors des essais). Budgétable essaie déjà 3 serveurs. Au-delà de quelques milliers de recherches par jour :
  garder les résultats en cache par commune (ils changent peu) ou héberger son propre serveur Overpass.
- **Base Adresse Nationale** : gratuite ; l'État la migre vers la Géoplateforme de l'IGN
  (data.geopf.fr/geocodage). Prévoir de changer l'adresse du service le moment venu.
- **Comptes et synchronisation** : étape 3 du plan (serveur + base de données hébergés dans l'UE).
- **Paiement** : Stripe, d'abord en mode test, à l'étape 6 du plan.
