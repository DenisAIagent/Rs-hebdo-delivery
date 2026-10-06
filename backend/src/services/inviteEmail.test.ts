import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInviteEmail } from './inviteEmail';

const BASE = {
  fullName: 'Camille Roux',
  link: 'https://xyz.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=https://app.test/reset-password',
  appUrl: 'https://app.test',
};

test("l'email d'invitation contient le logo, le prenom et le lien", () => {
  const { subject, html, text } = buildInviteEmail(BASE);
  assert.match(subject, /RS Hebdo Delivery/);
  assert.ok(html.includes('https://app.test/logo-rs-france.png'), 'logo en URL absolue');
  assert.ok(html.includes('Camille'), 'prenom dans le message');
  assert.ok(html.includes(BASE.link.replace(/&/g, '&amp;')), 'lien du bouton');
  assert.ok(text.includes(BASE.link), 'lien en clair dans la version texte');
});

test('le nom est echappe pour eviter toute injection HTML', () => {
  const { html } = buildInviteEmail({ ...BASE, fullName: '<script>alert(1)</script>' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('un lien non http(s) est neutralise', () => {
  const { html, text } = buildInviteEmail({ ...BASE, link: 'javascript:alert(1)' });
  assert.ok(!html.includes('javascript:'));
  assert.ok(!text.includes('javascript:'));
});

test('le renvoi a un objet et une accroche differents', () => {
  const first = buildInviteEmail(BASE);
  const again = buildInviteEmail({ ...BASE, reminder: true });
  assert.notEqual(first.subject, again.subject);
  assert.match(again.html, /nouveau lien/i);
});

test("l'adresse de l'app sans slash final ou avec slash donne la meme URL de logo", () => {
  const { html } = buildInviteEmail({ ...BASE, appUrl: 'https://app.test/' });
  assert.ok(html.includes('https://app.test/logo-rs-france.png'));
  assert.ok(!html.includes('https://app.test//logo'));
});
