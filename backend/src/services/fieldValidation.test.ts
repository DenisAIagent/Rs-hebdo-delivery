import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMetadata, urlProblem, isYoutubeUrl, type FieldRule } from './fieldValidation';

const music: FieldRule[] = [
  { key: 'artiste', label: 'Artiste', type: 'text', required: true },
  { key: 'chapo', label: 'Chapô', type: 'textarea', required: true },
  { key: 'etoiles', label: 'Étoiles', type: 'stars', required: true, max: 5 },
  { key: 'corps', label: 'Corps', type: 'textarea', required: true },
  { key: 'lien', label: 'Clip YouTube', type: 'url', required: true, validation: 'youtube' },
  { key: 'lien_achat', label: 'Bandcamp ou site officiel', type: 'url', required: true, validation: 'website' },
  { key: 'photos', label: 'Photo', type: 'images', required: true, min: 1 },
];

test('isYoutubeUrl / urlProblem', () => {
  assert.equal(isYoutubeUrl('https://youtu.be/abc?si=1'), true);
  assert.equal(isYoutubeUrl('https://www.youtube.com/watch?v=x'), true);
  assert.equal(isYoutubeUrl('https://theflynts.bandcamp.com/'), false);
  assert.equal(urlProblem('', 'youtube'), null);
  assert.equal(urlProblem('pas une url', 'website'), 'doit être une adresse complète (https://…)');
  assert.match(urlProblem('https://theflynts.bandcamp.com/', 'youtube')!, /YouTube/);
  assert.match(urlProblem('https://youtu.be/abc', 'website')!, /pas un lien YouTube/);
  assert.equal(urlProblem('https://www.theflynts.be/', 'website'), null);
});

test('validateMetadata : chapô, clip YouTube et site obligatoires sur une chronique musique', () => {
  const problems = validateMetadata({ fields: music, imageCount: 1, metadata: { artiste: 'The Flynts', etoiles: '3', corps: 'Texte.' } });
  assert.deepEqual(problems, ['Chapô : obligatoire', 'Clip YouTube : obligatoire', 'Bandcamp ou site officiel : obligatoire']);
  const swapped = validateMetadata({ fields: music, imageCount: 1, metadata: { artiste: 'x', chapo: 'c', etoiles: '3.5', corps: 't', lien: 'https://www.theflynts.be/', lien_achat: 'https://youtu.be/a' } });
  assert.equal(swapped.length, 2);
  const ok = validateMetadata({ fields: music, imageCount: 0, hasExistingImages: true, metadata: { artiste: 'x', chapo: 'c', etoiles: '3.5', corps: 't', lien: 'https://youtu.be/a', lien_achat: 'https://www.theflynts.be/' } });
  assert.deepEqual(ok, []);
});

test('validateMetadata : alternateKey (lien Drive OU photos), étoiles à 0 refusées', () => {
  const couv: FieldRule[] = [
    { key: 'lien_photos', label: 'Lien Drive photos', type: 'url', required: true, alternateKey: 'photos' },
    { key: 'photos', label: 'Photos', type: 'images', required: true, min: 3, alternateKey: 'lien_photos' },
    { key: 'etoiles', label: 'Étoiles', type: 'stars', required: true },
  ];
  assert.deepEqual(validateMetadata({ fields: couv, imageCount: 0, metadata: { lien_photos: 'https://drive.google.com/x', etoiles: '0' } }), ['Étoiles : obligatoire']);
  assert.deepEqual(validateMetadata({ fields: couv, imageCount: 3, metadata: { etoiles: '4' } }), []);
  assert.equal(validateMetadata({ fields: couv, imageCount: 1, metadata: { etoiles: '4' } }).length, 2);
});
