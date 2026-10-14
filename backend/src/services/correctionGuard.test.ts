import test from 'node:test';
import assert from 'node:assert/strict';
import { guardCorrection, filterCorrections } from './correctionGuard';

test('fautes de frappe et accords acceptes (un mot pour un mot)', () => {
  const r = guardCorrection('le songwriter déroule so acidité, il devient bain.', 'le songwriter déroule son acidité, il devient vain.');
  assert.equal(r.text, 'le songwriter déroule son acidité, il devient vain.');
  assert.equal(r.rejected.length, 0);
});

test('mot ajoute refuse', () => {
  const r = guardCorrection('Cela nous permis de jouer.', 'Cela nous a permis de jouer.');
  assert.equal(r.text, 'Cela nous permis de jouer.');
  assert.equal(r.rejected.length, 1);
});

test('mot retire refuse', () => {
  const r = guardCorrection('Pour son film premier film de fiction.', 'Pour son premier film de fiction.');
  assert.equal(r.text, 'Pour son film premier film de fiction.');
  assert.equal(r.rejected.length, 1);
});

test('un chiffre n\'est jamais modifie', () => {
  const r = guardCorrection('à Paris, le 27 mai 2027 avec Larkin Poe.', 'à Paris, le 27 mai 2025 avec Larkin Poe.');
  assert.equal(r.text, 'à Paris, le 27 mai 2027 avec Larkin Poe.');
  assert.equal(r.rejected.length, 1);
});

test('apostrophes typographiques et espaces insecables du journaliste conserves', () => {
  const r = guardCorrection('L’ancienne tête pensante d’un groupe !', "L'ancienne tête pensante d'un groupe !");
  assert.equal(r.text, 'L’ancienne tête pensante d’un groupe !');
  const r2 = guardCorrection('l’emocore et les embuches', "l'emocore et les embûches");
  assert.equal(r2.text, 'l’emocore et les embûches');
});

test('ponctuation seule acceptee (guillemets, point)', () => {
  const r = guardCorrection('une reprise du For Whom the Bell Tolls” de Metallica', 'une reprise du « For Whom the Bell Tolls » de Metallica');
  assert.equal(r.text, 'une reprise du « For Whom the Bell Tolls » de Metallica');
});

test('paragraphes preserves ; structure differente = texte d\'origine', () => {
  const r = guardCorrection('Un bain.\n\nDeux so.', 'Un vain.\n\nDeux son.');
  assert.equal(r.text, 'Un vain.\n\nDeux son.');
  const r2 = guardCorrection('Un.\n\nDeux.', 'Un. Deux.');
  assert.equal(r2.text, 'Un.\n\nDeux.');
  assert.ok(r2.rejected.length > 0);
});

test('liste des corrections : celles qui ajoutent/retirent un mot ou changent un chiffre disparaissent', () => {
  const kept = filterCorrections([
    { original: 'so', corrected: 'son', type: 'orthographe', explanation: '' },
    { original: 'nous permis', corrected: 'nous a permis', type: 'grammaire', explanation: '' },
    { original: '2027', corrected: '2025', type: 'style', explanation: '' },
    { original: 'son film premier film', corrected: 'son premier film', type: 'style', explanation: '' },
  ]);
  assert.deepEqual(kept.map((c) => c.corrected), ['son']);
});
