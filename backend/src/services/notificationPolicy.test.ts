import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotificationSetting, NOTIFY_SETTING_KEY } from './notificationPolicy';

test('cle du reglage', () => {
  assert.equal(NOTIFY_SETTING_KEY, 'DELIVERY_NOTIFICATIONS');
});

test('absent ou illisible : notifications actives (comportement historique)', () => {
  assert.equal(parseNotificationSetting(undefined), true);
  assert.equal(parseNotificationSetting(''), true);
  assert.equal(parseNotificationSetting('true'), true);
});

test('false : notifications coupees', () => {
  assert.equal(parseNotificationSetting('false'), false);
  assert.equal(parseNotificationSetting(' FALSE '), false);
});
