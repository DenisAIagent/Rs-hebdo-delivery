import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideChapoMode, checkGeneratedChapo, chapoPromptInstruction } from './chapoPolicy';

const SOURCE = `Greta Van Fleet
Palace For The People
Polydor
Josh Kiszka chante comme jamais sur ce quatrième album, enregistré à Nashville en 2026. Le groupe du Michigan y ose des ballades.`;
const EXAMPLE = 'Porté par la voix de Josh Kiszka, Greta Van Fleet revient avec Palace For The People (Polydor), un disque au souffle mystique.';

test('chapo du journaliste : toujours repris, interrupteur allume ou non', () => {
  assert.equal(decideChapoMode({ provided: 'Un chapô.', strict: false, agentIfMissing: 'generate' }), 'journaliste');
  assert.equal(decideChapoMode({ provided: 'Un chapô.', strict: true, agentIfMissing: 'generate' }), 'journaliste');
});

test('pas de chapo fourni : genere tant que l\'interrupteur « chapo obligatoire » est coupe', () => {
  assert.equal(decideChapoMode({ provided: '  ', strict: false, agentIfMissing: 'generate' }), 'generer');
});

test('interrupteur allume : plus aucun chapo genere', () => {
  assert.equal(decideChapoMode({ provided: '', strict: true, agentIfMissing: 'generate' }), 'aucun');
});

test('agent regle sur « aucun chapo » : pas de generation', () => {
  assert.equal(decideChapoMode({ provided: '', strict: false, agentIfMissing: 'none' }), 'aucun');
});

test('le chapo exemple de Denis est accepte (noms presents dans la livraison)', () => {
  const r = checkGeneratedChapo(EXAMPLE, SOURCE, 35);
  assert.deepEqual(r, { ok: true, chapo: EXAMPLE });
});

test('balises et guillemets autour du chapo genere sont retires', () => {
  const r = checkGeneratedChapo(`<h3>« ${EXAMPLE} »</h3>`, SOURCE, 35);
  assert.ok(r.ok);
  assert.equal(r.ok && r.chapo, EXAMPLE);
});

test('rejet : nom propre absent de la livraison (fait invente)', () => {
  const r = checkGeneratedChapo('Greta Van Fleet revient chez Universal avec Palace For The People.', SOURCE, 35);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : '', /Universal/);
});

test('rejet : chiffre absent de la livraison', () => {
  const r = checkGeneratedChapo('Greta Van Fleet sort son 5e album, Palace For The People.', SOURCE, 35);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : '', /5/);
});

test('rejet : phrase recopiee du texte du journaliste', () => {
  const r = checkGeneratedChapo('Josh Kiszka chante comme jamais sur ce quatrième album, enregistré à Nashville.', SOURCE, 35);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : '', /reprend/);
});

test('rejet : trop long ou vide', () => {
  assert.equal(checkGeneratedChapo(EXAMPLE, SOURCE, 10).ok, false);
  assert.equal(checkGeneratedChapo('   ', SOURCE, 35).ok, false);
});

test('consigne IA : generer = exemple, interdits ; aucun = excerpt vide ; journaliste = tel quel', () => {
  const gen = chapoPromptInstruction('generer', { maxWords: 35, example: EXAMPLE });
  assert.match(gen, /NEUTRE/);
  assert.match(gen, /Josh Kiszka/);
  assert.match(gen, /35 mots/);
  assert.match(gen, /jamais une phrase/i);
  assert.match(chapoPromptInstruction('aucun', {}), /chaine vide/);
  assert.match(chapoPromptInstruction('journaliste', {}), /tel quel/);
});
