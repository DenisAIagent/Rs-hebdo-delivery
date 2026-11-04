import test from 'node:test';
import assert from 'node:assert/strict';
import { stripLegacyReviewSuffix } from './wordpress';

test('stripLegacyReviewSuffix retire le suffixe historique, et seulement lui', () => {
  assert.equal(stripLegacyReviewSuffix('Bryan Adams – How’s It Goin’ [EN ATTENTE DE RELECTURE]'), 'Bryan Adams – How’s It Goin’');
  assert.equal(stripLegacyReviewSuffix('Bryan Adams – How’s It Goin’ [EN ATTENTE DE RELECTURE]  '), 'Bryan Adams – How’s It Goin’');
  assert.equal(stripLegacyReviewSuffix('Bryan Adams – How’s It Goin’'), 'Bryan Adams – How’s It Goin’');
  assert.equal(stripLegacyReviewSuffix('[EN ATTENTE DE RELECTURE] en tête'), '[EN ATTENTE DE RELECTURE] en tête');
});
