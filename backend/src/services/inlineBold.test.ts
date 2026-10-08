import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitBold, boldToHtml, PRINT_CHAPO_TYPES } from './inlineBold';

test('une ligne sans marquage reste un seul segment normal', () => {
  assert.deepEqual(splitBold('Une réponse.'), [{ text: 'Une réponse.', bold: false }]);
});

test('une question entre ** devient un segment gras, sans les asterisques', () => {
  assert.deepEqual(splitBold('**Comment cela va-t-il se passer sur scène ?**'), [
    { text: 'Comment cela va-t-il se passer sur scène ?', bold: true },
  ]);
});

test('gras au milieu d\'une ligne', () => {
  assert.deepEqual(splitBold('avant **gras** après'), [
    { text: 'avant ', bold: false },
    { text: 'gras', bold: true },
    { text: ' après', bold: false },
  ]);
});

test('asterisque isolee laissee telle quelle', () => {
  assert.deepEqual(splitBold('note * importante'), [{ text: 'note * importante', bold: false }]);
});

test('boldToHtml convertit le marquage apres echappement', () => {
  assert.equal(boldToHtml('**Q &amp; R ?**'), '<strong>Q &amp; R ?</strong>');
  assert.equal(boldToHtml('sans gras'), 'sans gras');
});

test('le chapo est imprime pour les interviews et la couv seulement', () => {
  assert.equal(PRINT_CHAPO_TYPES.has('Interview 3000'), true);
  assert.equal(PRINT_CHAPO_TYPES.has('Sujet de couv'), true);
  assert.equal(PRINT_CHAPO_TYPES.has('Chroniques'), false);
});

test('WordPress : les questions marquees sortent en <strong>', async () => {
  const { buildArticleHtml } = await import('./wordpressPublisher');
  const html = buildArticleHtml({ chapo: '', journalistName: 'Mathieu David', bodyText: '**Une question ?**\n\nUne réponse.' });
  assert.match(html, /<p><strong>Une question \?<\/strong><\/p>/);
  assert.match(html, /<p>Une réponse\.<\/p>/);
});
