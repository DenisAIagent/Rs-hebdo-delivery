import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeliveryFolderPaths, hasJournalistSubfolder } from './dropbox';

test('un sous-dossier par journaliste pour toutes les chroniques, livres, disque de la semaine, frenchie', () => {
  for (const f of ['Chroniques', 'Chronique cinema', 'Chronique coup de coeur', 'Livres et expo', 'Disque de la semaine', 'frenchie']) {
    assert.equal(hasJournalistSubfolder(f.toLowerCase()), true, f);
  }
  for (const f of ['Sujet de couv', 'Interview 3000', 'Live report']) {
    assert.equal(hasJournalistSubfolder(f.toLowerCase()), false, f);
  }
  const p = resolveDeliveryFolderPaths({ hebdoNumber: 'RSH241', driveFolderName: 'Chroniques', journalistName: 'Xavier Bonnet', subject: 'The Flynts' });
  assert.equal(p.targetPath, `${p.typePath}/Xavier Bonnet`);
  const i = resolveDeliveryFolderPaths({ hebdoNumber: 'RSH241', driveFolderName: 'Interview 3000', journalistName: 'Mathieu David', subject: 'Mastodon' });
  assert.equal(i.targetPath, `${i.typePath}/Interview Mastodon`);
  const c = resolveDeliveryFolderPaths({ hebdoNumber: 'RSH241', driveFolderName: 'Sujet de couv', journalistName: 'Alma Rota', subject: 'Johnny Marr' });
  assert.equal(c.targetPath, c.typePath);
});
