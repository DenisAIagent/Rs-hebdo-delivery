import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArticleHtml, splitLinks } from './wordpressPublisher';

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

test('splitLinks : YouTube = vidéo, autre URL = lien d’achat, texte non URL ignoré', () => {
  assert.deepEqual(splitLinks('https://youtu.be/abc?si=1', 'https://icidailleurs.fr/product/x'), { videoUrl: 'https://youtu.be/abc?si=1', shopUrl: 'https://icidailleurs.fr/product/x' });
  assert.deepEqual(splitLinks('https://www.netflix.com/fr/title/82068293'), { shopUrl: 'https://www.netflix.com/fr/title/82068293' });
  assert.deepEqual(splitLinks('pas une url'), {});
});

test('buildArticleHtml : un seul paragraphe, la vidéo va juste avant la signature', () => {
  const html = buildArticleHtml({ chapo: 'Chapô.', bodyText: 'Texte.', journalistName: 'Silvère Vincent', videoUrl: 'https://youtu.be/x', shopUrl: 'https://shop.example/a', shopLabel: "Acheter l'album" });
  assert.deepEqual(html.split('\n\n'), [
    '<h3>Chapô.</h3>',
    '<p>Texte.</p>',
    '<p><a href="https://shop.example/a" target="_blank" rel="noopener">Acheter l\'album</a></p>',
    '<p>https://youtu.be/x</p>',
    '<p><em>Par Silvère Vincent</em></p>',
  ]);
});

test('buildArticleHtml : plusieurs paragraphes, la vidéo se place au milieu de la chronique', () => {
  const html = buildArticleHtml({ bodyText: 'Un.\n\nDeux.\n\nTrois.', journalistName: 'Xavier Bonnet', videoUrl: 'https://youtu.be/x' });
  assert.deepEqual(html.split('\n\n'), ['<p>Un.</p>', '<p>Deux.</p>', '<p>https://youtu.be/x</p>', '<p>Trois.</p>', '<p><em>Par Xavier Bonnet</em></p>']);
  const two = buildArticleHtml({ bodyText: 'Un.\n\nDeux.', journalistName: '', videoUrl: 'https://youtu.be/x' });
  assert.deepEqual(two.split('\n\n'), ['<p>Un.</p>', '<p>https://youtu.be/x</p>', '<p>Deux.</p>']);
});
