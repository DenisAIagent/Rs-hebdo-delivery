import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArticleHtml } from './wordpressPublisher';

const body = `Alors, comme ça, le rock serait mort ! Passé par pertes et profits.

Manifestement, la résistance s'organise : « pas besoin de sanglots longs » pour poursuivre le combat…`;

test('buildArticleHtml garde le texte mot pour mot, un <p> par paragraphe, signature en fin', () => {
  const html = buildArticleHtml({ chapo: 'Un live brut.', bodyText: body, journalistName: 'Xavier Bonnet' });
  const blocks = html.split('\n\n');
  assert.equal(blocks[0], '<h3>Un live brut.</h3>');
  assert.equal(blocks[1], '<p>Alors, comme ça, le rock serait mort ! Passé par pertes et profits.</p>');
  assert.equal(blocks[2], "<p>Manifestement, la résistance s'organise : <em>« pas besoin de sanglots longs »</em> pour poursuivre le combat…</p>");
  assert.equal(blocks[3], '<p><em>Par Xavier Bonnet</em></p>');
  assert.equal(blocks.length, 4);
  // Aucun mot ajouté : le texte sans balises est identique au texte livré (hors chapo et signature).
  const plain = blocks.slice(1, 3).map((b) => b.replace(/<[^>]+>/g, '')).join('\n\n');
  assert.equal(plain, body);
});

test('buildArticleHtml sans chapo ni signature, et échappe le HTML', () => {
  const html = buildArticleHtml({ bodyText: 'a < b & c', journalistName: '' });
  assert.equal(html, '<p>a &lt; b &amp; c</p>');
});
