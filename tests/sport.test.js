// Coach sportif : sécurité et progression
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/sport.js');
const sante = { coeur: 'non', poitrine: 'non', os: 'non', traitement: 'non' };
const base = { age: 35, objectif: 'forme', niveau: 'intermediaire', materiel: [], jours: [0, 3, 5], duree: 30, limites: [], sante };
test('questions de santé : « oui » demande l’accord du médecin ; moins de 16 ans refusé', () => {
  assert.equal(S.verifier({ ...base, sante: { ...sante, poitrine: 'oui' } }).stop, 'medecin');
  assert.ok(S.verifier({ ...base, sante: { ...sante, poitrine: 'oui' }, accordMedecin: true }).ok);
  assert.equal(S.verifier({ ...base, age: 14 }).stop, 'jeune');
});
test('points fragiles et version douce : jamais d’exercice contre-indiqué', () => {
  for (const lim of [['genoux'], ['dos'], ['epaules'], ['genoux', 'dos']]) for (const obj of Object.keys(S.OBJECTIFS)) for (const sem of [1, 5]) {
    const w = S.genererSemaine({ ...base, objectif: obj, niveau: 'confirme', limites: lim, materiel: ['halteres', 'salle'] }, sem, 2);
    for (const s of w) for (const x of s.blocs) assert.ok(!S.EX[x.ex].eviter.some((e) => lim.includes(e)), `${S.EX[x.ex].nom} avec ${lim}`);
  }
  const doux = S.genererSemaine({ ...base, niveau: 'confirme', accordMedecin: true }, 3, 0);
  for (const s of doux) for (const x of s.blocs) assert.ok(!S.EX[x.ex].eviter.includes('saut'));
});
test('matériel : rien d’autre que ce qu’on a', () => {
  const w = S.genererSemaine({ ...base, objectif: 'muscle' }, 1, 0);
  for (const s of w) for (const x of s.blocs) assert.equal(S.EX[x.ex].mat, 'aucun');
});
test('durée proche de celle choisie, progression au fil des semaines', () => {
  for (const d of [20, 30, 45]) for (const s of S.genererSemaine({ ...base, duree: d }, 1, 0)) if (s.type !== 'mobilite') assert.ok(Math.abs(s.minutes - d) <= 10, `${s.minutes} pour ${d}`);
  const e = S.EX.squat;
  assert.ok(S.dosage(e, 2, 5, 0, 'forme').reps > S.dosage(e, 2, 1, 0, 'forme').reps);
  assert.ok(S.dosage(e, 2, 1, -1, 'forme').reps < S.dosage(e, 2, 1, 0, 'forme').reps);
});
test('bilan : facile → plus dur, douleur → plus doux', () => {
  assert.equal(S.bilanSemaine({ semaine: 1, jours: [0, 2], ajust: 0 }, [{ semaine: 1, ressenti: 'facile' }, { semaine: 1, ressenti: 'facile' }]).ajust, 1);
  assert.ok(S.bilanSemaine({ semaine: 1, jours: [0, 2], ajust: 1 }, [{ semaine: 1, ressenti: 'douleur' }]).ajust < 1);
});
