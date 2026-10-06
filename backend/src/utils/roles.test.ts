import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminRole, isValidRole, ADMIN_ROLES } from './roles';

test('admin et CTO ont les droits d administration', () => {
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('cto'), true);
  assert.equal(isAdminRole('journalist'), false);
  assert.equal(isAdminRole(undefined), false);
  assert.deepEqual([...ADMIN_ROLES].sort(), ['admin', 'cto']);
});

test('seuls les trois roles connus sont acceptes', () => {
  for (const r of ['journalist', 'admin', 'cto']) assert.equal(isValidRole(r), true, r);
  for (const r of ['', 'superadmin', 'CTO', null, 42]) assert.equal(isValidRole(r), false, String(r));
});
