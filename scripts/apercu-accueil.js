// Exemple de semaine montré sur la page d'accueil (« Voici à quoi ressemble une semaine »).
// Calculé par le vrai moteur de Budgétable (profil par défaut, 2 adultes), à chaque publication,
// pour ne pas faire attendre le visiteur : la génération d'une semaine prend 1 à 2 secondes.
// Seuls les plats sont enregistrés ici : prix estimés et liste de courses sont recalculés par l'appli.
// Usage : node scripts/apercu-accueil.js   (appelé par build.js)
const fs = require('fs');
const path = require('path');

function genererApercu(racine = path.join(__dirname, '..')) {
  const E = require(path.join(racine, 'js', 'engine.js'));
  const foyer = { adultes: 2, enfants: [] };
  const p = Object.assign(E.profilParDefaut(), { foyer });
  const plan = E.genererSemaine(p, { seed: 20261 });
  const jours = plan.jours.map((j) => ({ jour: j.jour, dejeuner: j.dejeuner && { recette: j.dejeuner.recette, portions: j.dejeuner.portions }, diner: j.diner && { recette: j.diner.recette, portions: j.diner.portions } }));
  const contenu = `/* Généré par scripts/apercu-accueil.js à partir du moteur de Budgétable : ne pas modifier à la main. */\n(function (root) { root.APERCU_ACCUEIL = ${JSON.stringify({ genere: new Date().toISOString().slice(0, 10), foyer, jours })}; })(typeof window !== 'undefined' ? window : globalThis);\n`;
  fs.writeFileSync(path.join(racine, 'js', 'apercu-accueil.js'), contenu);
  return jours;
}
if (require.main === module) { const j = genererApercu(); console.log(`aperçu d'accueil : ${j.length} jours`); }
module.exports = genererApercu;
