/* Budgétable — programme minceur : l'agent qui prépare et ajuste chaque semaine un programme de perte de poids douce,
 * en suivant les goûts enregistrés (test de goût, notes, corrections).
 *
 * Tout est calculé sur l'appareil, à partir de repères simples et prudents :
 *  - besoins : formule de Mifflin-St Jeor × activité ;
 *  - déficit modéré (300 ou 500 kcal), jamais sous les besoins de base ni sous 1 200 kcal (femme) / 1 500 kcal (homme) ;
 *  - perte visée 0,25 à 0,5 kg par semaine, objectif jamais sous un IMC de 18,5 ;
 *  - pas de programme pour les moins de 18 ans, pendant une grossesse ou l'allaitement, ni en cas de troubles du comportement alimentaire.
 * Ce n'est pas un avis médical : l'écran le dit, et renvoie vers le médecin quand il le faut.
 */
(function (root) {
  'use strict';
  const RYTHMES = { douce: { deficit: 300, libelle: 'Douce', sous: 'environ 1 kg par mois' }, normale: { deficit: 500, libelle: 'Régulière', sous: 'environ 2 kg par mois' } };
  const PART = { petitdej: 0.25, dejeuner: 0.35, diner: 0.3, collation: 0.1 };
  const arr = (v, pas = 50) => Math.round(v / pas) * pas;
  const imc = (kg, cm) => kg / Math.pow(cm / 100, 2);

  /** Lit et vérifie les informations du bilan. Renvoie { ok, erreurs[], stop } : stop = raison de ne pas proposer de programme. */
  function verifier(i) {
    const erreurs = [];
    const age = +i.age, taille = +i.taille, poids = +String(i.poids || '').replace(',', '.'), objectif = +String(i.objectif || '').replace(',', '.');
    if (!i.sexe) erreurs.push('Indiquez si vous êtes une femme ou un homme.');
    if (!(age >= 10 && age <= 100)) erreurs.push('Indiquez votre âge.');
    if (!(taille >= 130 && taille <= 230)) erreurs.push('Indiquez votre taille en cm (entre 130 et 230).');
    if (!(poids >= 35 && poids <= 250)) erreurs.push('Indiquez votre poids en kg.');
    if (!(objectif >= 35 && objectif <= 250)) erreurs.push('Indiquez le poids que vous visez.');
    if (!i.activite) erreurs.push('Choisissez votre activité.');
    if (i.tca === undefined || i.tca === null || i.tca === '') erreurs.push('Répondez à la question sur les troubles alimentaires.');
    if (i.sexe === 'f' && !i.grossesse) erreurs.push('Répondez à la question sur la grossesse et l’allaitement.');
    let stop = null;
    if (age && age < 18) stop = 'mineur';
    else if (i.tca === 'oui') stop = 'tca';
    else if (i.sexe === 'f' && i.grossesse === 'oui') stop = 'grossesse';
    else if (poids && taille && imc(poids, taille) < 18.5) stop = 'imc_bas';
    else if (poids && objectif && objectif >= poids) stop = 'objectif';
    const objectifMin = taille ? Math.ceil(18.5 * Math.pow(taille / 100, 2)) : 0;
    if (!stop && objectif && taille && objectif < objectifMin) erreurs.push(`Le poids visé est trop bas pour votre taille : visez au moins ${objectifMin} kg (IMC de 18,5).`);
    return { ok: !erreurs.length && !stop, erreurs, stop, objectifMin };
  }

  /** Besoins, cible de calories et durée estimée. */
  function calculer(i, ajustement = 0) {
    const age = +i.age, taille = +i.taille, poids = +String(i.poidsActuel || i.poids).replace(',', '.'), objectif = +String(i.objectif).replace(',', '.');
    const base = 10 * poids + 6.25 * taille - 5 * age + (i.sexe === 'h' ? 5 : -161);
    const entretien = base * (+i.activite || 1.4);
    const plancher = Math.max(base, i.sexe === 'h' ? 1500 : 1200);
    const r = RYTHMES[i.rythme] || RYTHMES.douce;
    const brute = entretien - r.deficit + ajustement;
    const cible = arr(Math.min(arr(entretien), Math.max(plancher, brute)));
    const deficitReel = Math.max(0, entretien - cible);
    const kgSemaine = Math.round(deficitReel * 7 / 7700 * 100) / 100;
    const aPerdre = Math.max(0, poids - objectif);
    const semaines = kgSemaine > 0 ? Math.ceil(aPerdre / kgSemaine) : null;
    return { base: arr(base), entretien: arr(entretien), plancher: arr(plancher), cible, kgSemaine, aPerdre: Math.round(aPerdre * 10) / 10, semaines, limite: brute < plancher, imc: Math.round(imc(poids, taille) * 10) / 10 };
  }
  const repartition = (cible) => Object.fromEntries(Object.entries(PART).map(([k, f]) => [k, arr(cible * f, 10)]));

  /** Conseil de portion pour un plat de la semaine (kcal pour une part adulte) face à la cible du repas. */
  function portion(kcal, cibleRepas) {
    if (!kcal || !cibleRepas) return { f: 1, texte: '' };
    const brut = cibleRepas / kcal;
    if (brut >= 1) {
      // plat léger : on garde une part normale, et un complément s'il reste vraiment de la marge
      return kcal < cibleRepas * 0.75 ? { f: 1, texte: 'une part normale, avec un fruit ou un yaourt nature en plus', kcal: Math.round(kcal + 80), plus: true } : { f: 1, texte: 'une part normale', kcal: Math.round(kcal) };
    }
    const f = Math.max(0.5, Math.round(brut * 4) / 4);
    if (f >= 1) return { f: 1, texte: 'une part normale', kcal: Math.round(kcal) };
    return { f, texte: f <= 0.5 ? 'une demi-part, et une grande assiette de légumes ou de salade' : '¾ de part, complétez avec des légumes', kcal: Math.round(kcal * f) };
  }


  /** Choisit les petits-déjeuners de la semaine : proches de la cible, selon les goûts, variés, un moment plaisir le week-end. */
  function choisirPetitsDej(recettes, opts) {
    const { cible, gouts, scoreGout, nutrition, compatible, rassasiant, simple } = opts;
    const notes = recettes.filter((r) => r.type === 'petitdej' && (!compatible || compatible(r))).map((r) => {
      const n = nutrition(r) || {};
      const k = n.kcal || cible, pp = n.parPortion || {};
      let s = (scoreGout ? scoreGout(r, gouts) : 0) * 1.6 - Math.abs(k - cible) / 45;
      if (pp.prot >= 20) s += rassasiant ? 1.6 : 0.8;
      if (pp.fibres >= 6) s += rassasiant ? 0.8 : 0.4;
      if ((r.tags || []).includes('equilibre')) s += 0.6;
      if (simple && r.temps > 10) s -= 1.5;
      return { r, s, k };
    }).sort((a, b) => b.s - a.s);
    const semaine = [];
    const vus = {};
    for (let j = 0; j < 7; j++) {
      const weekend = j >= 5;
      // le dimanche, un petit-déj plaisir s'il reste raisonnable : un programme qu'on tient est un programme qui fait plaisir
      const pool = weekend && j === 6 ? notes.filter((x) => (x.r.tags || []).includes('gourmand') && x.k <= cible * 1.3).concat(notes) : notes.filter((x) => weekend || x.r.temps <= 10 || !simple);
      const pris = pool.find((x) => (vus[x.r.id] || 0) < 2 && semaine[j - 1] !== x.r.id) || notes[0];
      if (!pris) break;
      vus[pris.r.id] = (vus[pris.r.id] || 0) + 1;
      semaine.push(pris.r.id);
    }
    return semaine;
  }

  /** Le point de la semaine : nouvelle pesée et ressenti → ajustement et message de l'agent. */
  function adapter(prog, poidsKg, ressenti) {
    const p = JSON.parse(JSON.stringify(prog));
    const precedent = (p.pesees.length ? p.pesees[p.pesees.length - 1].kg : p.poidsDepart);
    const kg = +String(poidsKg || '').replace(',', '.');
    const lignes = [];
    let ajust = p.ajustement || 0;
    p.rassasiant = !!p.rassasiant; p.simple = !!p.simple;
    if (kg >= 35 && kg <= 250) p.pesees.push({ d: new Date().toISOString().slice(0, 10), kg });
    const actuel = kg >= 35 ? kg : precedent;
    const perte = Math.round((precedent - actuel) * 10) / 10;
    const pertes = p.pesees.map((x, i) => (i ? p.pesees[i - 1].kg : p.poidsDepart) - x.kg);
    const dernieresPertes = pertes.slice(-2);
    if (kg >= 35) {
      if (actuel <= p.objectif) {
        lignes.push(`🎉 Objectif atteint : ${String(actuel).replace('.', ',')} kg ! Je passe en phase de stabilisation : vos menus reviennent à vos besoins pour garder ce poids.`);
        p.stabilisation = true; ajust = 0;
      } else if (perte > actuel * 0.01) {
        ajust += 150;
        lignes.push(`Vous avez perdu ${String(perte).replace('.', ',')} kg : c’est un peu rapide. Je remonte votre repère de 150 kcal pour protéger vos muscles et éviter l’effet yo-yo.`);
      } else if (perte >= 0.2) {
        lignes.push(`Bravo : ${String(perte).replace('.', ',')} kg de moins cette semaine. C’est le bon rythme, on continue comme ça.`);
      } else if (perte > -0.3) {
        if (dernieresPertes.length >= 2 && dernieresPertes.every((x) => x < 0.2) && ressenti !== 'faim') {
          ajust -= 100;
          lignes.push('Le poids est stable depuis deux semaines. C’est normal par moments ; je baisse doucement votre repère de 100 kcal, sans descendre sous vos besoins de base. 20 minutes de marche en plus par jour aident aussi beaucoup.');
        } else lignes.push('Poids stable cette semaine : pas d’inquiétude, le poids varie d’un jour à l’autre (eau, sel, sommeil). Regardez la tendance sur plusieurs semaines.');
      } else lignes.push(`+${String(-perte).replace('.', ',')} kg cette semaine. Ça arrive (repas de fête, rétention d’eau) : on ne change rien, la tendance compte plus qu’une pesée.`);
    } else lignes.push('Pas de pesée cette semaine : ce n’est pas grave, je garde le même repère.');
    if (ressenti === 'faim') {
      p.rassasiant = true;
      if (!(perte > actuel * 0.01)) ajust += 100;
      lignes.push('Vous avez eu faim : j’ajoute 100 kcal et je choisis des repas plus rassasiants (protéines, fibres, légumineuses).');
    } else if (ressenti === 'difficile') {
      p.simple = true;
      lignes.push('C’était difficile à suivre : je vous propose des recettes plus rapides, et je garde un petit-déjeuner plaisir le dimanche.');
    } else if (ressenti === 'facile') {
      lignes.push('Vous avez trouvé ça facile : parfait, on garde le cap.');
    } else if (ressenti === 'bien') lignes.push('Super, la semaine s’est bien passée : on continue sur cette lancée.');
    p.ajustement = Math.max(-300, Math.min(400, ajust));
    p.semaine = (p.semaine || 1) + 1;
    p.bilans = (p.bilans || []).concat([{ d: new Date().toISOString().slice(0, 10), kg: kg >= 35 ? kg : null, ressenti: ressenti || null }]).slice(-60);
    p.poidsActuel = actuel;
    return { prog: p, message: lignes.join(' ') };
  }

  /** Le message de l'agent pour la semaine préparée : pourquoi ces choix, en citant les goûts. */
  function messageSemaine({ prog, calc, aime, platsAimes, pdNoms, joursDessus }) {
    const r = repartition(calc.cible);
    const l = [];
    l.push(prog.stabilisation ? `Semaine de stabilisation : environ ${calc.cible} kcal par jour pour garder votre poids.` : `Semaine ${prog.semaine || 1} : environ ${calc.cible} kcal par jour, pour perdre autour de ${String(calc.kgSemaine).replace('.', ',')} kg par semaine.`);
    if (aime.length) l.push(`J’ai suivi vos goûts : ${aime.slice(0, 3).join(', ').toLowerCase()}${platsAimes ? ` reviennent dans ${platsAimes} repas` : ''}.`);
    if (pdNoms.length) l.push(`Au petit-déjeuner (environ ${r.petitdej} kcal) : ${pdNoms.slice(0, 2).join(', ').toLowerCase()}${pdNoms.length > 2 ? '…' : '.'}`);
    l.push(`Pour les repas, je vous indique votre portion jour par jour : le reste de la famille mange normalement.`);
    if (joursDessus) l.push(`${joursDessus} jour${joursDessus > 1 ? 's dépassent' : ' dépasse'} un peu la cible : prenez la portion conseillée et plus de légumes.`);
    if (prog.rassasiant) l.push('J’ai privilégié les plats qui calent bien, puisque vous avez eu faim.');
    return l.join(' ');
  }

  const COLLATIONS = [['pomme', 'Une pomme et quelques amandes'], ['yaourt', 'Un yaourt nature et un fruit'], ['fromage_blanc', 'Un fromage blanc et des fruits rouges'], ['banane', 'Une banane'], ['oeufs', 'Un œuf dur et des tomates cerises'], ['kiwi', 'Deux kiwis'], ['poire', 'Une poire et un carré de chocolat noir']];
  /** Collations suggérées : on garde celles dont l'aliment est aimé (ou neutre). */
  function collations(gouts) {
    const g = (gouts && gouts.ing) || {};
    return COLLATIONS.filter(([id]) => (g[id] || 0) > -0.9).sort((a, b) => (g[b[0]] || 0) - (g[a[0]] || 0)).slice(0, 3).map(([, t]) => t);
  }


  /** Réponses du coach sans IA : les questions les plus fréquentes, avec les chiffres du programme. */
  const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function repondreLocal(question, ctx) {
    const q = norm(question), c = ctx || {};
    const cible = c.cible ? `${c.cible} kcal` : 'votre repère';
    const coll = (c.collations || []).slice(0, 2).join(' ou ').toLowerCase();
    if (/faim|affame|creux|fringale/.test(q)) return `Avoir un peu faim avant les repas est normal ; avoir faim tout le temps ne l’est pas. Ajoutez des légumes à volonté et une source de protéines à chaque repas${coll ? `, et une collation : ${coll}` : ''}. Si la faim persiste, faites le point de la semaine en choisissant « J’ai eu faim » : je remonterai votre repère.`;
    if (/restau|resto|soiree|fete|anniversaire|apero|invite|ecart|craque/.test(q)) return 'Un repas de fête ne fait pas grossir, ce sont les habitudes qui comptent. Profitez-en sans culpabiliser, choisissez ce qui vous fait vraiment envie, et reprenez simplement le programme au repas suivant, sans sauter de repas pour « compenser ».';
    if (/stagne|plateau|bouge pas|ne perds? plus|bloque/.test(q)) return 'Les paliers sont normaux : le corps s’adapte, et l’eau masque parfois la perte. Regardez la tendance sur 3 ou 4 semaines. Si rien ne bouge après 2 points de semaine, j’ajuste votre repère tout seul. Marcher 20 à 30 minutes de plus par jour aide beaucoup.';
    if (/sport|marche|courir|muscu|velo|natation|activite/.test(q)) return 'Bouger aide à perdre du gras et à garder ses muscles : visez 30 minutes de marche rapide par jour, et 2 séances de renforcement par semaine si vous pouvez. Les jours de sport, un petit-déjeuner « Sportif » de la page Petit-déj est idéal.';
    if (/alcool|vin|biere|aperitif/.test(q)) return 'L’alcool apporte beaucoup de calories (un verre de vin ≈ 100 kcal) et ouvre l’appétit. Gardez-le pour les occasions, un verre, avec de l’eau à côté.';
    if (/sucre|chocolat|gateau|dessert|grignot/.test(q)) return 'Rien n’est interdit : un carré de chocolat noir après le repas, ou un dessert le week-end, ça fait partie d’un programme qu’on tient. Évitez surtout de grignoter devant un écran : servez-vous une portion, puis rangez le paquet.';
    if (/combien|calorie|kcal|manger par jour/.test(q)) return `Votre repère est de ${cible} par jour : environ ${c.repartition ? `${c.repartition.petitdej} au petit-déjeuner, ${c.repartition.dejeuner} au déjeuner, ${c.repartition.diner} au dîner et ${c.repartition.collation} en collation` : 'un quart au petit-déjeuner, un tiers à chaque repas, le reste en collation'}. Pas besoin de compter : les portions conseillées dans la semaine font le calcul pour vous.`;
    if (/pese|balance|poids/.test(q)) return 'Pesez-vous une fois par semaine, le même jour, le matin à jeun, après être passé aux toilettes. Le poids varie de 1 à 2 kg d’un jour à l’autre : c’est la tendance qui compte.';
    if (/eau|boire|soif/.test(q)) return 'Buvez de l’eau à volonté, environ 1,5 L par jour, plus s’il fait chaud ou si vous faites du sport. Thé et café sans sucre comptent aussi.';
    if (/sommeil|dormir|fatigue|stress/.test(q)) return 'Le sommeil et le stress jouent sur l’appétit : un manque de sommeil donne plus faim, surtout de sucré. Essayez de vous coucher à heure régulière ; si la fatigue est forte ou dure, parlez-en à votre médecin.';
    if (/aime pas|deteste|remplacer|changer/.test(q)) return 'Pas de souci : dans « Semaine », touchez le plat puis « Changer » pour en choisir un autre. Pour que je ne le propose plus, notez-le 1 ou 2 étoiles, ou corrigez vos goûts dans le Profil : je les suis pour préparer vos semaines.';
    return `Je suis votre coach minceur : je prépare votre semaine autour de ${cible} par jour en suivant vos goûts, et j’ajuste chaque semaine avec votre pesée et votre ressenti. Posez-moi une question sur la faim, les sorties au restaurant, le sport, les paliers… ou faites le point de la semaine ci-dessus.`;
  }

  const api = { repondreLocal, RYTHMES, PART, verifier, calculer, repartition, portion, choisirPetitsDej, adapter, messageSemaine, collations, imc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Programme = api;
})(typeof window !== 'undefined' ? window : globalThis);
