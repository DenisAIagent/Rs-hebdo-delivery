import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupByAuthor, monthBounds, monthLabel, parseMonthKey, previousMonthKey, recapFilename, shouldSendNow,
  type RecapDelivery,
} from './monthlyRecap';

const d = (over: Partial<RecapDelivery>): RecapDelivery => ({
  id: 'x', title: 'Titre', deliveredAt: '2026-09-10T10:00:00.000Z', signCount: 1000,
  paperType: 'Chroniques', hebdoLabel: 'RSH240', authorId: 'a', authorName: 'Alma Rota', authorEmail: 'alma@rs.fr',
  ...over,
});

test('parseMonthKey accepte AAAA-MM et rejette le reste', () => {
  assert.deepEqual(parseMonthKey('2026-09'), { year: 2026, month: 9 });
  assert.throws(() => parseMonthKey('2026-13'));
  assert.throws(() => parseMonthKey('09-2026'));
});

test('monthBounds couvre le mois civil, fin exclusive', () => {
  const b = monthBounds(2026, 12);
  assert.equal(b.start, '2026-12-01T00:00:00.000Z');
  assert.equal(b.end, '2027-01-01T00:00:00.000Z');
});

test('libellé et nom de fichier', () => {
  assert.equal(monthLabel(2026, 9), 'septembre 2026');
  assert.equal(recapFilename(2026, 9), 'RS-Hebdo-recap-livraisons-2026-09.pdf');
});

test('previousMonthKey : le 1er octobre à Paris renvoie septembre, le 1er janvier renvoie décembre', () => {
  assert.equal(previousMonthKey(new Date('2026-10-01T06:30:00Z')), '2026-09');
  assert.equal(previousMonthKey(new Date('2027-01-01T07:30:00Z')), '2026-12');
});

test('groupByAuthor regroupe, trie par nom puis date, cumule les signes', () => {
  const groups = groupByAuthor([
    d({ id: '1', authorId: 'x', authorName: 'Xavier Bonnet', deliveredAt: '2026-09-20T10:00:00Z', signCount: 500 }),
    d({ id: '2', authorId: 'a', deliveredAt: '2026-09-15T10:00:00Z', signCount: 7000 }),
    d({ id: '3', authorId: 'x', authorName: 'Xavier Bonnet', deliveredAt: '2026-09-05T10:00:00Z', signCount: 600 }),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].authorName, 'Alma Rota');
  assert.equal(groups[1].deliveries.map((x) => x.id).join(','), '3,1');
  assert.equal(groups[1].totalSigns, 1100);
});

test("shouldSendNow : uniquement le 1er à partir de 8 h Paris, et une seule fois", () => {
  // 1er octobre 2026, 06:30 UTC = 08:30 Paris (heure d'été)
  assert.equal(shouldSendNow(new Date('2026-10-01T06:30:00Z'), ''), '2026-09');
  assert.equal(shouldSendNow(new Date('2026-10-01T06:30:00Z'), '2026-09'), null);
  // 1er octobre 05:30 UTC = 07:30 Paris : trop tôt
  assert.equal(shouldSendNow(new Date('2026-10-01T05:30:00Z'), ''), null);
  // le 2 : rien
  assert.equal(shouldSendNow(new Date('2026-10-02T10:00:00Z'), ''), null);
});
