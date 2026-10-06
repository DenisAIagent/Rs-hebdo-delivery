import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail } from './email';

test('une adresse valide est nettoyee et mise en minuscules', () => {
  assert.equal(normalizeEmail('  Jean.Dupont@RollingStone.fr '), 'jean.dupont@rollingstone.fr');
});

test('une adresse invalide est refusee', () => {
  for (const bad of ['', '   ', 'jean', 'jean@', '@rollingstone.fr', 'jean @rs.fr', 'jean@rs', 'a@b@c.fr']) {
    assert.equal(normalizeEmail(bad), null, bad);
  }
});

test('une valeur qui n est pas une chaine est refusee', () => {
  assert.equal(normalizeEmail(undefined), null);
  assert.equal(normalizeEmail(42), null);
});

test('une adresse trop longue est refusee', () => {
  assert.equal(normalizeEmail(`${'a'.repeat(250)}@rs.fr`), null);
});
