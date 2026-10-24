/* Budgétable — coach sportif : programme d'entraînement à la maison ou en salle, séances guidées, progression chaque semaine.
 * Exercices au poids du corps d'abord (rien à acheter), puis haltères, élastique ou salle si on en a.
 * Prudence : questionnaire de santé avant de commencer (inspiré du Q-AAP), pas de sauts avec des genoux ou un dos fragiles,
 * et la consigne d'arrêter en cas de douleur. Ce n'est pas un avis médical.
 */
(function (root) {
  'use strict';
  // [id, nom, groupe, matériel, niveau 1-3, type ('reps' | 'temps'), emoji, consignes, contraintes (à éviter si…), plus facile, kcal/min]
  const X = (id, nom, groupe, mat, niveau, type, emoji, consignes, eviter, facile, kcal) => ({ id, nom, groupe, mat, niveau, type, emoji, consignes, eviter, facile, kcal });
  const EXERCICES = [
    // jambes et fessiers
    X('squat', 'Squat', 'jambes', 'aucun', 1, 'reps', '🦵', ['Pieds écartés largeur d’épaules, pointes légèrement ouvertes.', 'Descendez comme pour vous asseoir, dos droit, talons au sol.', 'Remontez en poussant dans les talons.'], ['genoux'], 'Squat sur chaise : asseyez-vous et relevez-vous.', 6),
    X('squat_chaise', 'Assis-debout sur chaise', 'jambes', 'aucun', 1, 'reps', '🪑', ['Asseyez-vous au bord d’une chaise, pieds à plat.', 'Levez-vous sans les mains, puis rasseyez-vous doucement.'], [], 'Aidez-vous des mains sur les cuisses.', 5),
    X('fente', 'Fentes avant alternées', 'jambes', 'aucun', 2, 'reps', '🚶', ['Faites un grand pas en avant.', 'Descendez le genou arrière vers le sol, buste droit.', 'Revenez et changez de jambe.'], ['genoux'], 'Fentes sur place, petite amplitude, une main sur un mur.', 6),
    X('pont', 'Pont fessier', 'jambes', 'aucun', 1, 'reps', '🌉', ['Allongé sur le dos, genoux pliés, pieds au sol.', 'Montez le bassin en serrant les fessiers.', 'Tenez 1 seconde en haut, redescendez doucement.'], [], 'Petite amplitude.', 4),
    X('chaise', 'La chaise contre un mur', 'jambes', 'aucun', 2, 'temps', '🧱', ['Dos plaqué au mur, cuisses parallèles au sol.', 'Genoux au-dessus des chevilles, respirez calmement.'], ['genoux'], 'Moins descendre : cuisses à 45°.', 5),
    X('mollets', 'Montées sur pointes', 'jambes', 'aucun', 1, 'reps', '🦶', ['Debout, une main sur un mur.', 'Montez sur la pointe des pieds, redescendez lentement.'], [], 'Les deux pieds, lentement.', 3),
    X('step', 'Montées de marche', 'jambes', 'aucun', 1, 'reps', '🪜', ['Face à une marche d’escalier stable.', 'Montez un pied puis l’autre, redescendez. Alternez la jambe qui monte.'], [], 'Tenez la rampe.', 7),
    X('goblet', 'Goblet squat', 'jambes', 'halteres', 2, 'reps', '🏋️', ['Tenez un haltère contre la poitrine.', 'Descendez en squat, coudes entre les genoux, dos droit.', 'Remontez en poussant dans les talons.'], ['genoux'], 'Sans poids.', 7),
    X('sdt', 'Soulevé de terre jambes tendues', 'jambes', 'halteres', 2, 'reps', '🏋️', ['Haltères devant les cuisses, genoux légèrement fléchis.', 'Penchez le buste en reculant les fesses, dos bien droit.', 'Remontez en serrant les fessiers.'], ['dos'], 'Sans poids, mains sur les cuisses.', 6),
    X('squat_saute', 'Squats sautés', 'jambes', 'aucun', 3, 'reps', '⚡', ['Descendez en squat, puis sautez en poussant fort.', 'Atterrissez souplement, genoux fléchis.'], ['genoux', 'dos', 'saut'], 'Squat avec montée sur pointes.', 10),
    X('presse', 'Presse à cuisses', 'jambes', 'salle', 1, 'reps', '🏋️', ['Dos bien calé, pieds à largeur d’épaules.', 'Poussez sans verrouiller les genoux, revenez lentement.'], [], 'Charge légère.', 6),
    // haut du corps
    X('pompes_mur', 'Pompes contre un mur', 'haut', 'aucun', 1, 'reps', '🧱', ['Mains sur le mur à hauteur d’épaules, corps droit.', 'Pliez les coudes pour approcher la poitrine du mur, poussez.'], ['epaules'], 'Moins d’amplitude.', 4),
    X('pompes_genoux', 'Pompes sur les genoux', 'haut', 'aucun', 2, 'reps', '💪', ['Mains sous les épaules, genoux au sol, corps droit des genoux à la tête.', 'Descendez la poitrine vers le sol, poussez.'], ['epaules'], 'Pompes contre un mur.', 6),
    X('pompes', 'Pompes', 'haut', 'aucun', 3, 'reps', '💪', ['Mains sous les épaules, corps gainé comme une planche.', 'Descendez la poitrine près du sol, remontez en poussant.'], ['epaules'], 'Pompes sur les genoux.', 7),
    X('dips', 'Dips sur chaise', 'haut', 'aucun', 2, 'reps', '🪑', ['Mains sur le bord d’une chaise stable, fesses devant.', 'Pliez les coudes vers l’arrière, remontez.'], ['epaules'], 'Genoux pliés, petite amplitude.', 5),
    X('rowing', 'Rowing haltère', 'haut', 'halteres', 1, 'reps', '🏋️', ['Une main et un genou sur un banc ou une chaise, dos plat.', 'Tirez l’haltère vers la hanche, coude près du corps.', 'Redescendez lentement. Changez de côté à mi-série.'], [], 'Haltère plus léger.', 5),
    X('epaules', 'Développé épaules', 'haut', 'halteres', 2, 'reps', '🏋️', ['Debout, haltères à hauteur d’épaules.', 'Poussez vers le haut sans cambrer, redescendez.'], ['epaules', 'dos'], 'Assis, haltères légers.', 5),
    X('curl', 'Curl biceps', 'haut', 'halteres', 1, 'reps', '🏋️', ['Debout, coudes collés au corps.', 'Montez les haltères en pliant les coudes, redescendez lentement.'], [], 'Une bouteille d’eau dans chaque main.', 4),
    X('tirage_elastique', 'Tirage élastique', 'haut', 'elastique', 1, 'reps', '🎗️', ['Élastique accroché à une poignée de porte, bras tendus.', 'Tirez vers la poitrine en serrant les omoplates.'], [], 'Reculez moins.', 4),
    X('tirage_poulie', 'Tirage vertical', 'haut', 'salle', 1, 'reps', '🏋️', ['Assis à la machine, prise un peu plus large que les épaules.', 'Tirez la barre vers le haut de la poitrine, revenez lentement.'], [], 'Charge légère.', 5),
    X('dev_couche', 'Développé couché machine', 'haut', 'salle', 1, 'reps', '🏋️', ['Dos bien calé, poignées à hauteur de poitrine.', 'Poussez sans verrouiller les coudes, revenez lentement.'], ['epaules'], 'Charge légère.', 5),
    // ventre et gainage
    X('planche', 'Planche', 'abdos', 'aucun', 2, 'temps', '📏', ['Sur les avant-bras et les pointes de pieds, corps bien droit.', 'Serrez les fessiers et le ventre, respirez.'], ['dos', 'epaules'], 'Planche sur les genoux.', 4),
    X('planche_genoux', 'Planche sur les genoux', 'abdos', 'aucun', 1, 'temps', '📏', ['Sur les avant-bras et les genoux, du genou à la tête bien droit.', 'Ventre rentré, respirez calmement.'], ['epaules'], 'Moins longtemps.', 3),
    X('planche_laterale', 'Planche latérale', 'abdos', 'aucun', 2, 'temps', '📐', ['Sur un avant-bras, corps de profil bien aligné.', 'Changez de côté à mi-temps.'], ['epaules'], 'Genou du dessous au sol.', 4),
    X('crunch', 'Crunch', 'abdos', 'aucun', 1, 'reps', '🔄', ['Allongé, genoux pliés, mains sur la poitrine.', 'Décollez les épaules en soufflant, sans tirer sur la nuque.'], ['dos'], 'Petite amplitude.', 4),
    X('deadbug', 'Dead bug', 'abdos', 'aucun', 1, 'reps', '🐞', ['Sur le dos, bras vers le plafond, genoux pliés à 90°.', 'Allongez un bras et la jambe opposée sans décoller le bas du dos.', 'Revenez et alternez.'], [], 'Bougez seulement les jambes.', 3),
    X('birddog', 'Bird dog', 'abdos', 'aucun', 1, 'reps', '🐕', ['À quatre pattes, dos plat.', 'Tendez un bras et la jambe opposée, tenez 2 secondes, alternez.'], [], 'Seulement les jambes.', 3),
    X('superman', 'Superman', 'abdos', 'aucun', 1, 'reps', '🦸', ['Allongé sur le ventre, bras devant.', 'Décollez doucement bras et jambes, tenez 2 secondes.'], ['dos'], 'Seulement les bras.', 3),
    X('mountain', 'Mountain climbers', 'abdos', 'aucun', 2, 'temps', '⛰️', ['En position de pompe, mains sous les épaules.', 'Ramenez les genoux vers la poitrine en alternant, rythme régulier.'], ['epaules', 'dos'], 'Lentement, un genou après l’autre.', 9),
    // cardio
    X('marche_place', 'Marche active sur place', 'cardio', 'aucun', 1, 'temps', '🚶', ['Marchez sur place en levant les genoux et en balançant les bras.'], [], 'Plus doucement.', 5),
    X('genoux_hauts', 'Montées de genoux', 'cardio', 'aucun', 2, 'temps', '🏃', ['Courez sur place en montant les genoux à hauteur de hanches.', 'Restez sur l’avant du pied, bras actifs.'], ['genoux', 'saut'], 'Marche active sur place.', 10),
    X('jumping', 'Jumping jacks', 'cardio', 'aucun', 2, 'temps', '⭐', ['Sautez en écartant bras et jambes, revenez.'], ['genoux', 'saut'], 'Sans sauter : un pas de côté en levant les bras.', 9),
    X('pas_chasses', 'Pas chassés', 'cardio', 'aucun', 1, 'temps', '↔️', ['Déplacez-vous de côté en pas chassés, genoux fléchis, puis revenez.'], [], 'Plus lentement.', 7),
    X('corde', 'Corde à sauter (avec ou sans corde)', 'cardio', 'aucun', 2, 'temps', '🪢', ['Petits sauts sur l’avant des pieds, poignets qui tournent.'], ['genoux', 'saut'], 'Petits pas rapides sur place.', 11),
    X('burpees', 'Burpees', 'cardio', 'aucun', 3, 'reps', '🔥', ['Descendez en squat, mains au sol, pieds en arrière en planche.', 'Ramenez les pieds, relevez-vous avec un petit saut.'], ['genoux', 'dos', 'saut', 'epaules'], 'Sans saut et sans pompe, en marchant les pieds.', 12),
    X('boxe', 'Shadow boxing', 'cardio', 'aucun', 1, 'temps', '🥊', ['Garde haute, frappez dans le vide en alternant les poings.', 'Restez léger sur les appuis.'], [], 'Plus lentement.', 8),
    X('velo_salle', 'Vélo ou rameur', 'cardio', 'salle', 1, 'temps', '🚴', ['Rythme où vous pouvez encore parler.', 'Accélérez 30 secondes toutes les 2 minutes si vous vous sentez bien.'], [], 'Rythme tranquille.', 8),
    // mobilité et retour au calme
    X('chat_vache', 'Chat-vache', 'mobilite', 'aucun', 1, 'temps', '🐈', ['À quatre pattes, arrondissez le dos en soufflant, puis creusez doucement en inspirant.'], [], '', 2),
    X('rotation', 'Rotations du buste', 'mobilite', 'aucun', 1, 'temps', '🔃', ['Debout, bras croisés, tournez doucement le buste à droite puis à gauche.'], [], '', 2),
    X('epaules_cercles', 'Cercles de bras', 'mobilite', 'aucun', 1, 'temps', '⭕', ['Bras tendus sur les côtés, petits puis grands cercles, dans les deux sens.'], [], '', 2),
    X('etirement_cuisses', 'Étirement des cuisses', 'mobilite', 'aucun', 1, 'temps', '🧘', ['Debout, attrapez un pied derrière vous, genoux serrés. Changez à mi-temps.', 'Sans à-coups, respirez.'], [], '', 2),
    X('etirement_dos', 'Posture de l’enfant', 'mobilite', 'aucun', 1, 'temps', '🧘', ['À genoux, fesses sur les talons, bras allongés devant, front vers le sol. Respirez lentement.'], ['genoux'], '', 2),
    X('respiration', 'Respiration calme', 'mobilite', 'aucun', 1, 'temps', '🌬️', ['Inspirez 4 secondes par le nez, soufflez 6 secondes par la bouche.'], [], '', 1)
  ];
  const EX = Object.fromEntries(EXERCICES.map((e) => [e.id, e]));
  const OBJECTIFS = { perte: { lib: 'Perdre du poids', emoji: '🔥' }, muscle: { lib: 'Me muscler', emoji: '💪' }, endurance: { lib: 'Améliorer mon souffle', emoji: '🫁' }, forme: { lib: 'Garder la forme', emoji: '🌿' } };
  const NIVEAUX = { debutant: { lib: 'Débutant', n: 1, sous: 'peu ou pas de sport' }, intermediaire: { lib: 'Intermédiaire', n: 2, sous: 'du sport de temps en temps' }, confirme: { lib: 'Confirmé', n: 3, sous: 'je m’entraîne régulièrement' } };
  const MATERIEL = { aucun: 'Rien (poids du corps)', halteres: 'Haltères', elastique: 'Élastique', salle: 'Salle de sport' };
  const LIMITES = { genoux: 'Genoux fragiles', dos: 'Dos fragile', epaules: 'Épaules fragiles' };
  const SANTE = [
    ['coeur', 'Un médecin vous a-t-il déjà dit que vous aviez un problème cardiaque ou de tension ?'],
    ['poitrine', 'Avez-vous des douleurs dans la poitrine, des malaises ou des essoufflements anormaux à l’effort ?'],
    ['os', 'Avez-vous un problème d’os, d’articulation ou une opération récente qui pourrait s’aggraver avec l’exercice ?'],
    ['traitement', 'Prenez-vous un traitement pour le cœur, la tension, le diabète, ou êtes-vous enceinte ?']
  ];

  /** Peut-on proposer le programme ? Une réponse « oui » demande l'accord du médecin d'abord. */
  function verifier(b) {
    const erreurs = [];
    if (!b.objectif) erreurs.push('Choisissez votre objectif.');
    if (!b.niveau) erreurs.push('Choisissez votre niveau.');
    if (!(b.jours && b.jours.length)) erreurs.push('Choisissez au moins un jour d’entraînement.');
    if (!b.duree) erreurs.push('Choisissez la durée des séances.');
    if (!(+b.age >= 10)) erreurs.push('Indiquez votre âge.');
    const manquantes = SANTE.filter(([k]) => !b.sante || !b.sante[k]);
    if (manquantes.length) erreurs.push('Répondez aux questions de santé.');
    let stop = null;
    if (+b.age && +b.age < 16) stop = 'jeune';
    else if (SANTE.some(([k]) => b.sante && b.sante[k] === 'oui') && !b.accordMedecin) stop = 'medecin';
    return { ok: !erreurs.length && !stop, erreurs, stop };
  }

  const graine = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; };

  /** Exercices possibles pour ce profil : matériel, niveau, contraintes (genoux, dos, épaules, pas de saut si accord médical). */
  function possibles(b, groupe, niveauMax) {
    const mats = new Set(['aucun', ...(b.materiel || [])]);
    const lim = new Set([...(b.limites || []), ...(b.accordMedecin || b.douceur ? ['saut'] : [])]);
    return EXERCICES.filter((e) => e.groupe === groupe && mats.has(e.mat) && e.niveau <= niveauMax && !e.eviter.some((x) => lim.has(x)));
  }
  /** Séries, répétitions ou secondes selon le niveau, la semaine et l'ajustement (trop facile / trop dur). */
  function dosage(e, niv, semaine, ajust, objectif) {
    const prog = Math.min(4, Math.floor((semaine - 1) / 2)) + ajust;  // +1 palier toutes les 2 semaines
    const n = Math.max(1, Math.min(6, niv * 2 - 1 + prog));            // 1 à 6
    if (e.type === 'temps') {
      const base = e.groupe === 'cardio' ? 20 + n * 5 : e.groupe === 'mobilite' ? 40 : 15 + n * 5;
      return { secondes: base, repos: Math.max(15, 40 - n * 4) };
    }
    const reps = objectif === 'muscle' ? 6 + n * 2 : 8 + n * 2;
    return { reps, repos: objectif === 'muscle' ? 60 : Math.max(20, 45 - n * 4) };
  }
  const TYPES = {
    perte: ['circuit', 'cardio', 'circuit', 'cardio', 'circuit', 'mobilite', 'cardio'],
    muscle: ['bas', 'haut', 'complet', 'bas', 'haut', 'complet', 'mobilite'],
    endurance: ['cardio', 'circuit', 'cardio', 'mobilite', 'cardio', 'circuit', 'cardio'],
    forme: ['circuit', 'mobilite', 'cardio', 'circuit', 'mobilite', 'cardio', 'circuit']
  };
  const TITRES = { circuit: 'Circuit corps entier', cardio: 'Cardio et souffle', bas: 'Jambes et fessiers', haut: 'Haut du corps et gainage', complet: 'Renforcement complet', mobilite: 'Mobilité et étirements' };
  const GROUPES_SEANCE = { circuit: ['jambes', 'haut', 'abdos', 'cardio', 'jambes', 'abdos'], cardio: ['cardio', 'cardio', 'jambes', 'cardio', 'abdos', 'cardio'], bas: ['jambes', 'jambes', 'abdos', 'jambes', 'jambes', 'abdos'], haut: ['haut', 'haut', 'abdos', 'haut', 'abdos', 'haut'], complet: ['jambes', 'haut', 'abdos', 'jambes', 'haut', 'abdos'], mobilite: ['mobilite', 'mobilite', 'abdos', 'mobilite', 'mobilite', 'mobilite'] };

  /** Une séance : échauffement, blocs de travail répétés en tours, retour au calme ; durée ajustée à celle choisie. */
  function seance(b, type, semaine, ajust, cle) {
    const r = graine(cle);
    const niv = NIVEAUX[b.niveau].n + (ajust > 1 ? 1 : ajust < -1 ? -1 : 0);
    const nivMax = Math.max(1, Math.min(3, niv));
    const pris = new Set();
    const choisir = (groupe) => {
      let l = possibles(b, groupe, nivMax).filter((e) => !pris.has(e.id));
      if (!l.length) l = possibles(b, groupe, 3).filter((e) => !pris.has(e.id));
      if (!l.length) l = possibles(b, 'mobilite', 1).filter((e) => !pris.has(e.id));
      // on préfère le matériel qu'on a quand il y en a, et le niveau le plus proche
      const e = l.map((x) => ({ x, s: -Math.abs(x.niveau - nivMax) + (x.mat !== 'aucun' ? 0.5 : 0) + r() * 0.8 })).sort((a, b) => b.s - a.s).map((y) => y.x)[0]; if (e) pris.add(e.id); return e;
    };
    const echauffement = ['marche_place', 'epaules_cercles', 'rotation', type === 'cardio' ? 'pas_chasses' : 'squat_chaise'].map((id) => ({ ex: id, secondes: 45 }));
    const calme = ['respiration', 'etirement_cuisses', (b.limites || []).includes('genoux') ? 'chat_vache' : 'etirement_dos'].map((id) => ({ ex: id, secondes: 40 }));
    const groupes = GROUPES_SEANCE[type];
    const nbEx = b.duree >= 45 ? 6 : b.duree >= 30 ? 5 : 4;
    const blocs = groupes.slice(0, nbEx).map(choisir).filter(Boolean).map((e) => ({ ex: e.id, ...dosage(e, niv, semaine, ajust, b.objectif) }));
    const dureeBloc = (x) => (x.secondes || x.reps * 3.5) + x.repos;
    const tourS = blocs.reduce((t, x) => t + dureeBloc(x), 0);
    const fixe = (echauffement.length * 45 + calme.length * 40);
    const tours = type === 'mobilite' ? 1 : Math.max(1, Math.min(5, Math.round((b.duree * 60 - fixe) / Math.max(60, tourS))));
    const minutes = Math.round((fixe + tours * tourS) / 60);
    const kcal = Math.round(echauffement.length * 45 / 60 * 5 + calme.length * 40 / 60 * 2 + tours * blocs.reduce((t, x) => t + (x.secondes || x.reps * 3.5) / 60 * EX[x.ex].kcal, 0));
    return { type, titre: TITRES[type], echauffement, blocs, tours, calme, minutes, kcal };
  }
  /** Le programme de la semaine : une séance par jour choisi. */
  function genererSemaine(b, semaine = 1, ajust = 0) {
    const types = TYPES[b.objectif] || TYPES.forme;
    return (b.jours || []).slice().sort((x, y) => x - y).map((j, k) => ({ j, ...seance(b, types[k % types.length], semaine, ajust, `${b.objectif}-${semaine}-${j}-${ajust}`) }));
  }
  /** Les étapes d'une séance, dans l'ordre, pour le mode guidé. */
  function etapes(s) {
    const l = [];
    s.echauffement.forEach((x) => l.push({ phase: 'Échauffement', ex: x.ex, secondes: x.secondes }));
    for (let t = 1; t <= s.tours; t++) s.blocs.forEach((x, i) => {
      l.push({ phase: `Tour ${t} sur ${s.tours}`, ex: x.ex, secondes: x.secondes || null, reps: x.reps || null });
      const dernier = t === s.tours && i === s.blocs.length - 1;
      if (!dernier && x.repos) l.push({ phase: 'Récupération', repos: true, secondes: x.repos, suivant: (s.blocs[i + 1] || s.blocs[0]).ex });
    });
    s.calme.forEach((x) => l.push({ phase: 'Retour au calme', ex: x.ex, secondes: x.secondes }));
    return l;
  }
  /** Bilan de la semaine : ressenti des séances → ajustement de l'intensité et message du coach. */
  function bilanSemaine(prog, historique) {
    const sem = (historique || []).filter((h) => h.semaine === prog.semaine);
    const prevues = (prog.jours || []).length;
    const faites = sem.length;
    const compte = (k) => sem.filter((h) => h.ressenti === k).length;
    let ajust = prog.ajust || 0;
    const l = [];
    if (compte('douleur')) {
      l.push('Vous avez signalé une douleur : je retire les sauts et j’allège la semaine. Si la douleur persiste plus de quelques jours, ou si elle est vive, consultez un médecin avant de reprendre.');
      ajust = Math.min(ajust, 0) - 1; prog.douceur = true;
    } else if (faites === 0) {
      l.push('Pas de séance cette semaine : aucun souci, on repart. Je garde le même niveau ; commencez par la plus courte, le plus dur c’est d’enfiler ses baskets !');
    } else {
      if (compte('facile') >= Math.ceil(faites / 2)) { ajust += 1; l.push('Vous avez trouvé ça facile : je monte d’un cran (plus de répétitions et des exercices un peu plus difficiles).'); }
      else if (compte('dur') >= Math.ceil(faites / 2)) { ajust -= 1; l.push('C’était dur : je baisse un peu l’intensité. Progresser, c’est tenir dans la durée.'); }
      else l.push('Le niveau est bon : on garde le rythme, avec la progression normale de la semaine.');
      l.unshift(faites >= prevues ? `💯 ${faites} séance${faites > 1 ? 's' : ''} sur ${prevues} : semaine parfaite, bravo !` : `${faites} séance${faites > 1 ? 's' : ''} sur ${prevues} : c’est déjà très bien, chaque séance compte.`);
    }
    return { ajust: Math.max(-2, Math.min(3, ajust)), message: l.join(' '), faites, prevues };
  }
  const MOTIVATION = ['Le plus dur, c’est de commencer : 5 minutes, et vous verrez que vous continuerez.', 'Vous n’avez pas besoin d’être motivé tous les jours, seulement régulier.', 'Chaque séance faite est une victoire, même courte.', 'Respirez, gardez une bonne position : la qualité avant la vitesse.', 'Dans 4 semaines, vous sentirez la différence. Dans 8, les autres la verront.', 'Hydratez-vous, et dormez bien : c’est là que les muscles se construisent.'];
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /** Le coach sans IA : réponses aux questions fréquentes. */
  function repondreLocal(question, ctx) {
    const q = norm(question), c = ctx || {};
    if (/douleur|mal (au|a la|aux)|blesse|claque|entorse|craque|poitrine|malaise|vertige/.test(q)) return 'Une douleur vive, articulaire ou dans la poitrine, ce n’est pas normal : arrêtez la séance. Une gêne dans la poitrine, un malaise ou un essoufflement anormal, appelez le 15. Pour une douleur qui dure plus de quelques jours, voyez un médecin avant de reprendre. Signalez « J’ai eu mal » en fin de séance : j’allège le programme.';
    if (/courbature/.test(q)) return 'Les courbatures sont normales au début et disparaissent en 2 à 3 jours. Bougez doucement (marche, étirements légers), buvez bien, dormez. Vous pouvez faire la séance suivante en allant un peu moins fort.';
    if (/motiv|flemme|envie|pas le courage|decourag/.test(q)) return `On a tous des jours sans. Faites juste l’échauffement : 4 minutes. Souvent, une fois lancé, on continue. Et si ce n’est vraiment pas le jour, une marche de 20 minutes compte aussi. ${MOTIVATION[(c.semaine || 0) % MOTIVATION.length]}`;
    if (/temps|presse|rapide|court/.test(q)) return 'Pas le temps ? Faites un seul tour du circuit (10 à 15 minutes) : c’est beaucoup mieux que rien. Vous pouvez aussi changer la durée des séances dans « Modifier mon programme ».';
    if (/manger|avant|apres|proteine|repas|nutrition|petit.dej/.test(q)) return 'Avant : un repas léger 2 heures avant, ou une banane 30 minutes avant. Après : un repas avec des protéines (œufs, poulet, yaourt, légumineuses) et des féculents dans les 2 heures. Les petits-déjeuners « Sportifs » de la page Petit-déj sont faits pour ça.';
    if (/maigrir|perdre|poids|ventre|graisse/.test(q)) return 'Pour perdre du poids, le sport aide mais l’assiette compte le plus. Combinez vos séances avec le programme minceur : il prépare vos repas selon vos goûts. On ne perd pas « localement » du ventre : le renforcement complet + le cardio + l’alimentation font le travail.';
    if (/muscl|masse|force|prise/.test(q)) return 'Pour se muscler : 3 séances par semaine, des mouvements bien faits, une progression régulière (j’augmente toutes les 2 semaines), des protéines à chaque repas et un bon sommeil. Le coach sportif des menus vous propose des plats riches en protéines.';
    if (/echauff/.test(q)) return 'L’échauffement prépare le cœur et les articulations : 4 à 5 minutes de mouvements doux suffisent. Ne le sautez pas, surtout le matin ou s’il fait froid.';
    if (/repos|tous les jours|recuper/.test(q)) return 'Le repos fait partie de l’entraînement : les muscles se renforcent entre les séances. Gardez au moins un jour de repos par semaine, et évitez de travailler les mêmes muscles deux jours de suite à fond.';
    if (/eau|boire|hydrat/.test(q)) return 'Buvez un verre d’eau avant la séance, quelques gorgées pendant, et un grand verre après. L’eau suffit pour des séances de moins d’une heure.';
    if (/genou|dos|epaule/.test(q)) return 'Si une articulation est fragile, indiquez-le dans « Modifier mon programme » : je remplace les exercices à risque (sauts, fentes…) par des versions douces. Chaque exercice a aussi une version plus facile.';
    return `Je suis votre coach sportif : ${c.seances ? `${c.seances} séance${c.seances > 1 ? 's' : ''} prévue${c.seances > 1 ? 's' : ''} cette semaine, ` : ''}j’adapte l’intensité selon votre ressenti après chaque séance. Demandez-moi : courbatures, motivation, quoi manger avant ou après, pas le temps, perdre du ventre…`;
  }
  const api = { EXERCICES, EX, OBJECTIFS, NIVEAUX, MATERIEL, LIMITES, SANTE, MOTIVATION, verifier, genererSemaine, seance, etapes, bilanSemaine, repondreLocal, dosage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Sport = api;
})(typeof window !== 'undefined' ? window : globalThis);
