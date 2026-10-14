import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFactSheet, applyDisplayName, fallbackSeo, fallbackTitle, parseAudit, factsSource } from './editorialFacts';

test('fiche de faits : seuls les faits avec une source http(s) sont gardes', () => {
  const sheet = parseFactSheet({
    displayName: 'Paerish',
    facts: [
      { fact: 'Rita est le quatrième album de Paerish', source: 'https://www.broadwayworld.com/x' },
      { fact: 'Groupe de Soissons', source: '' },
      { fact: 'Label SideOneDummy', source: 'ftp://x' },
      { fact: '', source: 'https://a.b' },
      null,
    ],
    contradictions: ['Le journaliste dit premier album', 42],
  });
  assert.deepEqual(sheet.facts, [{ fact: 'Rita est le quatrième album de Paerish', source: 'https://www.broadwayworld.com/x' }]);
  assert.equal(sheet.displayName, 'Paerish');
  assert.deepEqual(sheet.contradictions, ['Le journaliste dit premier album']);
  assert.deepEqual(parseFactSheet(undefined), { facts: [], displayName: null, contradictions: [] });
});

test('nom officiel de l\'artiste a la place des capitales du formulaire', () => {
  assert.equal(applyDisplayName('PAERISH – Rita : chronique', 'PAERISH', 'Paerish'), 'Paerish – Rita : chronique');
  assert.equal(applyDisplayName('Chronique de Rita de PAERISH.', 'PAERISH', 'Paerish'), 'Chronique de Rita de Paerish.');
  // nom officiel different (pas une simple casse) : on ne touche a rien
  assert.equal(applyDisplayName('PAERISH – Rita', 'PAERISH', 'Autre Groupe'), 'PAERISH – Rita');
  assert.equal(applyDisplayName('TVOD – The Farm', 'TVOD', null), 'TVOD – The Farm');
});

test('SEO de repli : uniquement les champs d\'identite de la livraison', () => {
  const seo = fallbackSeo({ paperTypeName: 'Chroniques', artist: 'Gloryhammer', work: 'Space 1993', title: 'Gloryhammer' });
  assert.equal(seo.seoTitle, 'Gloryhammer – Space 1993');
  assert.equal(seo.metaDescription, 'Chronique de Space 1993, de Gloryhammer.');
  const film = fallbackSeo({ paperTypeName: 'Chronique Cinema', artist: 'Minotaure', work: 'Andreï Zviaguintsev', title: 'Minotaure' });
  assert.equal(film.seoTitle, 'Critique : Minotaure');
  assert.equal(film.metaDescription, 'Critique de Minotaure, d’Andreï Zviaguintsev.');
});

test('audit : liste des affirmations non sourcees', () => {
  assert.deepEqual(parseAudit({ problems: [{ field: 'chapo', claim: 'quatrième album' }, { field: 'x' }] }), [{ field: 'chapo', claim: 'quatrième album' }]);
  assert.deepEqual(parseAudit({}), []);
});

test('les faits sources servent de reference au controle des noms propres et chiffres', () => {
  const src = factsSource([{ fact: 'Cinquième album, label Napalm Records', source: 'https://x' }]);
  assert.match(src, /Napalm Records/);
});

test('titre de repli au format des articles publies', () => {
  assert.equal(fallbackTitle({ paperTypeName: 'Chroniques', artist: 'Greta Van Fleet', work: 'Palace For The People', title: 'Greta Van Fleet' }), 'Greta Van Fleet – Palace For The People');
  assert.equal(fallbackTitle({ paperTypeName: 'Chronique Cinema', artist: 'Minotaure', work: 'Andreï Zviaguintsev', title: 'Minotaure' }), 'Critique : Minotaure');
  assert.equal(fallbackTitle({ paperTypeName: 'Interview 3000', artist: 'Eels', work: '', title: 'Eels : De fil en anguille' }), 'Eels : De fil en anguille');
});
