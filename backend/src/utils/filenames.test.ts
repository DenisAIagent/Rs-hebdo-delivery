import test from 'node:test';
import assert from 'node:assert/strict';
import { fixMojibake } from './filenames';

test('fixMojibake repare les noms UTF-8 lus en latin-1 et laisse les autres intacts', () => {
  assert.equal(fixMojibake('Tagada Jones \u00e2\u0080\u0093 A fleur de peau.jpg'), 'Tagada Jones – A fleur de peau.jpg');
  assert.equal(fixMojibake('M\u00c3\u00a9tro Verlaine \u00e2\u0080\u0093 Rodeorama.jpg'), 'Métro Verlaine – Rodeorama.jpg');
  assert.equal(fixMojibake('Métro Verlaine – Rodeorama.jpg'), 'Métro Verlaine – Rodeorama.jpg');
  assert.equal(fixMojibake('TheFlynts-TameTheFlame.jpg'), 'TheFlynts-TameTheFlame.jpg');
});
