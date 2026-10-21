# Extension Budgétable pour Chrome — prototype 0.1

Retrouvez votre liste Budgétable sur le site de votre drive, voyez les produits les moins chers
affichés sur la page, ajoutez-les au panier en un clic, et comparez vos drives pour faire un panier
par drive au meilleur prix.

## Installer (5 minutes, sans Chrome Web Store)

1. Décompressez le dossier `budgetable-extension`.
2. Dans Chrome, ouvrez `chrome://extensions`.
3. Activez le **Mode développeur** (en haut à droite).
4. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier `budgetable-extension`.
5. Épinglez l'icône Budgétable (pièce de puzzle → épingle).

Fonctionne aussi avec Edge et Brave (mêmes étapes, `edge://extensions`).

## Utiliser

1. Dans Budgétable (budgetable.onrender.com), onglet **Courses** : cliquez sur **Envoyer vers l'extension**.
2. La liste arrive directement dans l'extension (un message le confirme). Si Budgétable est ouvert ailleurs
   (fichier, autre adresse), la liste est copiée : cliquez sur l'icône Budgétable, collez, puis **Enregistrer la liste**.
3. Allez sur votre drive et **connectez-vous vous-même** à votre compte, en choisissant votre magasin.
4. Le panneau Budgétable apparaît en bas à droite :
   - **Chercher** ouvre la recherche de l'article sur le site ;
   - le panneau montre les 3 produits correspondants les moins chers (au kilo quand le site l'affiche) ;
   - **Ajouter au panier** ajoute le produit choisi ; **Retenir ce prix** note le prix sans l'ajouter ;
   - **Suivant** passe à l'article suivant.
5. Faites de même sur un 2e ou 3e drive. L'icône Budgétable affiche alors **vos paniers les moins chers** :
   chaque article est rangé dans le drive où il coûte le moins, avec le total de chaque panier
   et l'économie par rapport au meilleur drive unique.
6. Validez et payez vos commandes vous-même sur chaque site.

## Ce que fait l'extension, et ce qu'elle ne fait pas

- Elle lit **seulement ce qui est affiché** sur la page que vous regardez. Elle n'envoie aucune requête en arrière-plan.
- Elle n'agit **que quand vous cliquez**. Elle ne commande et ne paie jamais.
- Elle ne voit **aucun mot de passe** et n'envoie **aucune donnée** à Budgétable ni à personne : tout reste dans Chrome, sur votre ordinateur.
- Les frais de retrait et les trajets ne sont pas encore comptés dans la comparaison.

## État du prototype

| Drive | Adresse de recherche | Lecture des prix | Essai du 20/10/2026 |
| --- | --- | --- | --- |
| Carrefour | vérifiée | **vérifiée** | 24 produits lus, prix et prix au kilo exacts ; prix par défaut tant que le magasin n'est pas choisi |
| Auchan | vérifiée | **vérifiée** | magasin choisi (Auchan Drive Noyelles-Godault) : 7 produits lus, prix et prix au kilo exacts |
| Courses U | vérifiée | à vérifier | même fonctionnement qu'Auchan |
| Intermarché | vérifiée | **vérifiée** | magasin choisi (Montigny-en-Gohelle) : 9 produits lus, plats préparés écartés |
| E.Leclerc Drive | construite depuis le magasin choisi | **vérifiée** | magasin choisi (Loison) : 7 produits lus ; format de prix « 2 € ,49 » pris en charge |
| Chronodrive | à revoir : utilisez la recherche du site | à vérifier | l'adresse testée renvoie une erreur |

La lecture des produits est générique : un produit = un bloc avec un prix en euros et un bouton
« Ajouter ». Elle est vérifiée sur Carrefour, Auchan, E.Leclerc et Intermarché. Restent Courses U et Chronodrive. Les plats préparés et les produits d'une autre unité (un velouté au litre pour des lentilles au kilo) ne sont jamais proposés à la place d'un ingrédient.
Si un site n'est pas bien lu, une règle spécifique à ce site s'ajoutera dans `lecture.js`.

## Avant de le proposer au public

- Faire valider le principe par un avocat en droit du numérique (conditions d'utilisation des drives).
- Ne jamais renvoyer les prix relevés vers un serveur Budgétable pour constituer une base.
- Publier sur le Chrome Web Store (compte développeur : frais d'inscription unique, montant à vérifier) avec une politique de confidentialité.

## Tests

```bash
node --test tests/comparaison.test.js      # calcul des paniers, lecture de la liste, pertinence
python3 tests/panneau.py                    # panneau sur la page d'essai + chargement réel dans Chromium
```
