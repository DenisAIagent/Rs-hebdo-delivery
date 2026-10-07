import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFieldPolicy, EDITORIAL_KEYS, parseStrictSetting } from './fieldPolicy';
import { validateMetadata, type FieldRule } from './fieldValidation';

const FIELDS: FieldRule[] = [
  { key: 'artiste', label: 'Artiste', type: 'text', required: true },
  { key: 'chapo', label: 'Chapô', type: 'textarea', required: true },
  { key: 'corps', label: 'Texte', type: 'textarea', required: true },
  { key: 'lien', label: 'Clip YouTube', type: 'url', required: true, validation: 'youtube' },
  { key: 'lien_achat', label: 'Site', type: 'url', required: true, validation: 'website' },
];

test('les cles editoriales sont chapo, clip et lien d\'achat', () => {
  assert.deepEqual([...EDITORIAL_KEYS].sort(), ['chapo', 'lien', 'lien_achat']);
});

test('interrupteur actif : la config est renvoyee telle quelle', () => {
  assert.deepEqual(applyFieldPolicy(FIELDS, true), FIELDS);
});

test('interrupteur coupe : chapo, clip et lien d\'achat deviennent facultatifs, le reste ne bouge pas', () => {
  const out = applyFieldPolicy(FIELDS, false);
  const req = Object.fromEntries(out.map((f) => [f.key, f.required]));
  assert.deepEqual(req, { artiste: true, chapo: false, corps: true, lien: false, lien_achat: false });
});

test('ne mute pas la config recue', () => {
  applyFieldPolicy(FIELDS, false);
  assert.equal(FIELDS[1].required, true);
});

test('interrupteur coupe : une chronique sans chapo ni liens passe la validation', () => {
  const problems = validateMetadata({
    fields: applyFieldPolicy(FIELDS, false),
    metadata: { artiste: 'GRAVEYARD', corps: 'Texte' },
    imageCount: 0,
  });
  assert.deepEqual(problems, []);
});

test('interrupteur coupe : un lien saisi reste controle (pas de YouTube en lien d\'achat)', () => {
  const problems = validateMetadata({
    fields: applyFieldPolicy(FIELDS, false),
    metadata: { artiste: 'X', corps: 'Texte', lien_achat: 'https://youtu.be/abc' },
    imageCount: 0,
  });
  assert.equal(problems.length, 1);
});

test('reglage absent ou illisible : obligatoire par defaut (comportement historique)', () => {
  assert.equal(parseStrictSetting(undefined), true);
  assert.equal(parseStrictSetting(''), true);
  assert.equal(parseStrictSetting('true'), true);
  assert.equal(parseStrictSetting('false'), false);
  assert.equal(parseStrictSetting(' FALSE '), false);
});
