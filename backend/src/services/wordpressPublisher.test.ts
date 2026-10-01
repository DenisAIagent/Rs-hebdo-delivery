import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArticleHtml, splitLinks, outboundLinkLabel, pickInternalLink, firstSentence, splitChapoFromBody } from './wordpressPublisher';

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

test('buildArticleHtml : plusieurs paragraphes, la vidéo se place au milieu, jamais de lien « Voir le clip »', () => {
  const html = buildArticleHtml({ bodyText: 'Un.\n\nDeux.\n\nTrois.', journalistName: 'Xavier Bonnet', videoUrl: 'https://youtu.be/x' });
  assert.deepEqual(html.split('\n\n'), ['<p>Un.</p>', '<p>Deux.</p>', '<p>https://youtu.be/x</p>', '<p>Trois.</p>', '<p><em>Par Xavier Bonnet</em></p>']);
  const two = buildArticleHtml({ bodyText: 'Un.\n\nDeux.', journalistName: '', videoUrl: 'https://youtu.be/x' });
  assert.deepEqual(two.split('\n\n'), ['<p>Un.</p>', '<p>https://youtu.be/x</p>', '<p>Deux.</p>']);
  assert.ok(!html.includes('Voir le clip'));
});

test('buildArticleHtml : lien sortant nommé selon le domaine, puis « À lire aussi »', () => {
  const html = buildArticleHtml({ bodyText: 'Texte.', journalistName: 'X', videoUrl: 'https://youtu.be/x', shopUrl: 'https://theflynts.bandcamp.com', readAlso: { url: 'https://www.rollingstone.fr/a', title: 'Un article' } });
  assert.deepEqual(html.split('\n\n'), [
    '<p>Texte.</p>',
    '<p><a href="https://theflynts.bandcamp.com" target="_blank" rel="noopener">Écouter et acheter sur Bandcamp</a></p>',
    '<p>https://youtu.be/x</p>',
    '<p><em>À lire aussi :</em> <a href="https://www.rollingstone.fr/a">Un article</a></p>',
    '<p><em>Par X</em></p>',
  ]);
});

test('outboundLinkLabel : Bandcamp, smartlink, plateforme, éditeur, site officiel', () => {
  assert.equal(outboundLinkLabel('https://valleyofthesun.bandcamp.com/'), 'Écouter et acheter sur Bandcamp');
  assert.equal(outboundLinkLabel('https://transgressive.lnk.to/allsetthebone'), "Écouter l'album");
  assert.equal(outboundLinkLabel('https://www.netflix.com/fr/title/1', 'cinema'), 'Voir sur la plateforme');
  assert.equal(outboundLinkLabel('https://www.allocine.fr/film/fichefilm_gen_cfilm=327174.html', 'cinema'), 'Fiche AlloCiné');
  assert.equal(outboundLinkLabel('https://www.dargaud.com/bd/le-clan-de-walden', 'livres'), "Fiche de l'éditeur");
  assert.equal(outboundLinkLabel('https://www.theflynts.be/'), 'Site officiel');
  assert.equal(outboundLinkLabel('pas une url', 'livres'), 'En savoir plus');
});

test('pickInternalLink : choix IA > titre citant l’artiste > rubrique, jamais le premier résultat', async () => {
  const candidates = [
    { id: 1, link: 'https://www.rollingstone.fr/hors-sujet', title: 'Tom Cruise confirme la suite' },
    { id: 2, link: 'https://www.rollingstone.fr/flynts-live', title: 'The Flynts en concert à Bruxelles' },
  ];
  const cat = async () => ({ name: 'Chroniques', link: 'https://www.rollingstone.fr/chroniques/' });
  assert.deepEqual(await pickInternalLink({ candidates, aiChoice: 'https://www.rollingstone.fr/hors-sujet', artiste: 'The Flynts', categories: [5], loadCategory: cat }),
    { url: 'https://www.rollingstone.fr/hors-sujet', title: 'Tom Cruise confirme la suite' });
  assert.deepEqual(await pickInternalLink({ candidates, aiChoice: '', artiste: 'the flynts', categories: [5], loadCategory: cat }),
    { url: 'https://www.rollingstone.fr/flynts-live', title: 'The Flynts en concert à Bruxelles' });
  assert.deepEqual(await pickInternalLink({ candidates, aiChoice: '', artiste: 'Mastodon', categories: [5], loadCategory: cat }),
    { url: 'https://www.rollingstone.fr/chroniques/', title: 'Tous nos articles Chroniques' });
  assert.equal(await pickInternalLink({ candidates, artiste: 'Mastodon', categories: [], loadCategory: cat }), undefined);
});

test('firstSentence : premiere phrase du texte livre, guillemets et points de suspension compris', () => {
  assert.equal(firstSentence('Alors, comme ça, le rock serait mort ! Passé par pertes et profits.'), 'Alors, comme ça, le rock serait mort !');
  assert.equal(firstSentence('« Forer, forer, forer », vociférait Donald Trump lors de sa campagne. Digger ne l’a pas attendu.'), '« Forer, forer, forer », vociférait Donald Trump lors de sa campagne.');
  assert.equal(firstSentence('Un point final… du moins pour le moment. Suite.'), 'Un point final… du moins pour le moment.');
  assert.equal(firstSentence('Sans ponctuation finale'), 'Sans ponctuation finale');
  assert.equal(firstSentence('Dargaud\n\nEn 1845, dans le Massachusetts, le philosophe Henry David Thoreau tente l’expérience de vivre à l’écart de la société. Suite.'), 'En 1845, dans le Massachusetts, le philosophe Henry David Thoreau tente l’expérience de vivre à l’écart de la société.');
  assert.equal(firstSentence('Il a dit « ça suffit. » Puis il est parti.'), 'Il a dit « ça suffit. »');
});

test('splitChapoFromBody : la premiere phrase devient le chapo et disparait du corps, les mentions restent', () => {
  const r = splitChapoFromBody('Dargaud\n\nEn 1845, dans le Massachusetts, le philosophe Henry David Thoreau tente une expérience de vie à l’écart. Il construit une cabane.\n\nSuite du texte.');
  assert.equal(r.chapo, 'En 1845, dans le Massachusetts, le philosophe Henry David Thoreau tente une expérience de vie à l’écart.');
  assert.equal(r.body, 'Dargaud\n\nIl construit une cabane.\n\nSuite du texte.');
  const one = splitChapoFromBody('Une seule phrase assez longue pour servir de chapô, avec ses quatre-vingts signes et plus.\n\nDeuxième paragraphe.');
  assert.equal(one.body, 'Deuxième paragraphe.');
});
