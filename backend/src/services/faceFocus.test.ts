import test from 'node:test';
import assert from 'node:assert/strict';
import { focusFromFaces, parseFaceBoxes } from './faceFocus';

test('point de cadrage = centre du groupe de visages', () => {
  const f = focusFromFaces([
    { x: 0.2, y: 0.2, width: 0.1, height: 0.1 },
    { x: 0.6, y: 0.3, width: 0.1, height: 0.1 },
  ]);
  assert.ok(f);
  assert.ok(Math.abs(f!.x - 0.45) < 1e-9); // de 0.2 a 0.7
  assert.ok(Math.abs(f!.y - 0.3) < 1e-9);  // de 0.2 a 0.4
  assert.equal(focusFromFaces([]), null);
});

test('boites de visages : valeurs hors limites ecartees ou bornees', () => {
  assert.deepEqual(parseFaceBoxes({ faces: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.2 }] }), [{ x: 0.1, y: 0.2, width: 0.3, height: 0.2 }]);
  const [clamped] = parseFaceBoxes({ faces: [{ x: 0.9, y: 0.9, width: 0.5, height: 0.5 }] });
  assert.ok(Math.abs(clamped.width - 0.1) < 1e-9 && Math.abs(clamped.height - 0.1) < 1e-9);
  assert.deepEqual(parseFaceBoxes({ faces: [{ x: 'a' }, null, { x: -1, y: 0, width: 0.1, height: 0.1 }] }), []);
  assert.deepEqual(parseFaceBoxes(undefined), []);
});
