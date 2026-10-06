import test from 'node:test';
import assert from 'node:assert/strict';
import { nextCanaryState, buildCanaryAlertEmail } from './canaryState';

const T0 = new Date('2026-10-06T10:00:00Z');
const T1 = new Date('2026-10-06T11:00:00Z');

test('premier controle en echec : alerte', () => {
  const r = nextCanaryState(null, { ok: false, detail: 'timeout' }, T0);
  assert.equal(r.transition, 'down');
  assert.equal(r.state.status, 'down');
});

test('premier controle OK : pas d alerte', () => {
  const r = nextCanaryState(null, { ok: true }, T0);
  assert.equal(r.transition, null);
  assert.equal(r.state.status, 'ok');
});

test('panne qui dure : une seule alerte, pas de repetition', () => {
  const first = nextCanaryState({ status: 'ok', since: T0.toISOString() }, { ok: false, detail: 'x' }, T0);
  const again = nextCanaryState(first.state, { ok: false, detail: 'x' }, T1);
  assert.equal(first.transition, 'down');
  assert.equal(again.transition, null);
  assert.equal(again.state.since, T0.toISOString(), 'le debut de panne est conserve');
});

test('retour a la normale : alerte de retablissement', () => {
  const r = nextCanaryState({ status: 'down', since: T0.toISOString() }, { ok: true }, T1);
  assert.equal(r.transition, 'up');
  assert.equal(r.state.status, 'ok');
});

test("l'email de panne nomme le composant et echappe le detail", () => {
  const { subject, html } = buildCanaryAlertEmail({
    component: 'supabase',
    transition: 'down',
    detail: '<b>timeout</b>',
    since: T0.toISOString(),
    appUrl: 'https://app.test',
  });
  assert.match(subject, /Base Supabase/);
  assert.match(subject, /panne/i);
  assert.ok(html.includes('&lt;b&gt;timeout&lt;/b&gt;'));
  assert.ok(!html.includes('<b>timeout</b>'));
});

test("l'email de retablissement et l'email de test ont leur propre objet", () => {
  const up = buildCanaryAlertEmail({ component: 'railway', transition: 'up', since: T0.toISOString(), appUrl: 'https://app.test' });
  const t = buildCanaryAlertEmail({ component: 'supabase', transition: 'test', since: T0.toISOString(), appUrl: 'https://app.test' });
  assert.match(up.subject, /Serveur Railway/);
  assert.match(up.subject, /rétabli/i);
  assert.match(t.subject, /test/i);
});
