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

test('consigne de chapo : injectee dans le prompt, sans ancienne consigne de resume', () => {
  const p = buildWpSystemPrompt('', 'CHAPO (champ excerpt) : aucun chapo pour cet article ; excerpt = chaine vide.');
  assert.match(p, /aucun chapo pour cet article/);
  assert.doesNotMatch(p, /resume le papier/);
  assert.match(buildWpSystemPrompt(), /CHAPO \(champ excerpt\)/);
});
