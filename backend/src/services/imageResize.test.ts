import test from 'node:test';
import assert from 'node:assert/strict';
import { featuredFilename, webFilename, safeMediaBase } from './imageResize';

test('noms de fichiers medias en ASCII sur, tirets longs et accents compris', () => {
  assert.equal(safeMediaBase('Métro Verlaine – Rodeorama.jpg'), 'Metro-Verlaine-Rodeorama');
  assert.equal(featuredFilename('Dead Poet Society – Monarch.jpg'), 'Dead-Poet-Society-Monarch-1280x853.jpg');
  assert.equal(webFilename('photo.heic'), 'photo-web.jpg');
  assert.equal(featuredFilename('.jpg'), 'image-1280x853.jpg');
});
