import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redirectsToApp } from './inviteLink';

const APP = 'https://rs-hebdo-delivery-production.up.railway.app';
const verify = (redirect: string) =>
  `https://xyz.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=${encodeURIComponent(redirect)}`;

test('accepte un lien qui revient sur la page reset-password de l\'app', () => {
  assert.equal(redirectsToApp(verify(`${APP}/reset-password`), APP), true);
});

test('refuse un lien que Supabase a renvoyé vers localhost (Site URL par défaut)', () => {
  assert.equal(redirectsToApp(verify('http://localhost:3000'), APP), false);
});

test('refuse un lien sans redirect_to', () => {
  assert.equal(redirectsToApp('https://xyz.supabase.co/auth/v1/verify?token=abc&type=recovery', APP), false);
});

test('refuse un domaine qui ne fait que commencer comme celui de l\'app', () => {
  assert.equal(redirectsToApp(verify(`${APP}.evil.test/reset-password`), APP), false);
});

test('refuse un lien illisible', () => {
  assert.equal(redirectsToApp('pas une url', APP), false);
});
