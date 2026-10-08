import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWpSystemPrompt } from './wordpressRules';

test('sans agent : prompt historique, sans section agent', () => {
  const p = buildWpSystemPrompt();
  assert.doesNotMatch(p, /REGLES DE L'AGENT WEB/);
  assert.match(p, /submit_wp_article/);
});

test('avec agent : ses regles sont ajoutees et priment', () => {
  const p = buildWpSystemPrompt('RÈGLES DE L\'AGENT « Chroniqueur cinéma »\nCatégories : 6714, 3, 3619');
  assert.match(p, /REGLES DE L'AGENT WEB/);
  assert.match(p, /Chroniqueur cinéma/);
  assert.match(p, /priment/);
  // la consigne de reponse reste la derniere ligne
  assert.match(p.trim(), /submit_wp_article\.$/);
});
