import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp } from './privateIp';

test('IPv4 privées, loopback, lien-local, CGNAT', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '0.0.0.0', '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '100.64.0.1', '100.127.255.255', '198.18.0.1', '224.0.0.1', '255.255.255.255']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
});

test('IPv4 publiques', () => {
  for (const ip of ['8.8.8.8', '172.15.0.1', '172.32.0.1', '100.63.255.255', '100.128.0.1', '192.169.0.1', '151.101.1.140']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('IPv6 internes, y compris IPv4 embarquée', () => {
  for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'febf::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:169.254.169.254', '::ffff:172.16.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe',
    '64:ff9b::10.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
});

test('IPv6 publiques', () => {
  for (const ip of ['2606:4700:4700::1111', '::ffff:8.8.8.8', '::ffff:808:808']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('entrée invalide refusée par défaut', () => {
  assert.equal(isPrivateIp('pas-une-ip'), true);
  assert.equal(isPrivateIp(''), true);
});
