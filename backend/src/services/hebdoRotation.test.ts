import test from 'node:test';
import assert from 'node:assert/strict';
import { isRotationDue, nextHebdoWindow } from './hebdoRotation';

// RSH241 : diffuse le vendredi 09/10, c'est le numero sur lequel on livre jusque-la.
const RSH241 = { start_date: '2026-10-09', end_date: '2026-10-16' };

test('le numero reste en cours tant que sa date de diffusion n est pas arrivee', () => {
  assert.equal(isRotationDue(RSH241, new Date('2026-10-06T08:00:00Z')), false); // mardi
  assert.equal(isRotationDue(RSH241, new Date('2026-10-08T23:59:59Z')), false); // jeudi soir
});

test('la bascule se fait le jour de la diffusion du numero en cours', () => {
  assert.equal(isRotationDue(RSH241, new Date('2026-10-09T00:00:00Z')), true);
  assert.equal(isRotationDue(RSH241, new Date('2026-10-12T10:00:00Z')), true);
});

test('sans date de diffusion, on retombe sur la date de fin', () => {
  const sansDebut = { start_date: null, end_date: '2026-10-16' };
  assert.equal(isRotationDue(sansDebut, new Date('2026-10-10T00:00:00Z')), false);
  assert.equal(isRotationDue(sansDebut, new Date('2026-10-16T00:00:00Z')), true);
});

test('sans aucune date, pas de bascule', () => {
  assert.equal(isRotationDue({ start_date: null, end_date: null }, new Date()), false);
});

test('le numero suivant est diffuse le vendredi d apres, sur une semaine', () => {
  assert.deepEqual(nextHebdoWindow(RSH241), { start: '2026-10-16', end: '2026-10-23' });
});

test('le numero suivant se cale sur le vendredi meme si la date de fin est decalee', () => {
  // RSH241 cree a la main avec une fin au jeudi 15/10 : le 242 doit quand meme etre diffuse le 16/10.
  assert.deepEqual(nextHebdoWindow({ start_date: '2026-10-09', end_date: '2026-10-15' }), {
    start: '2026-10-16',
    end: '2026-10-23',
  });
});
