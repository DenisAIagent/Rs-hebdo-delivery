import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDropboxConfig, credentialsFingerprint, DEFAULT_ROOT_FOLDER } from './dropboxConfig';

const ENV = {
  DROPBOX_APP_KEY: 'env-key',
  DROPBOX_APP_SECRET: 'env-secret',
  DROPBOX_REFRESH_TOKEN: 'env-token',
  DROPBOX_ROOT_FOLDER: '/Env Root',
};

test("les reglages admin priment sur les variables d'environnement", () => {
  const cfg = resolveDropboxConfig(
    {
      DROPBOX_APP_KEY: 'db-key',
      DROPBOX_APP_SECRET: 'db-secret',
      DROPBOX_REFRESH_TOKEN: 'db-token',
      DROPBOX_ROOT_FOLDER: '/RS Hebdo',
    },
    ENV,
  );
  assert.deepEqual(cfg, {
    appKey: 'db-key',
    appSecret: 'db-secret',
    refreshToken: 'db-token',
    rootFolder: '/RS Hebdo',
  });
});

test("une valeur admin vide ou absente retombe sur la variable d'environnement", () => {
  const cfg = resolveDropboxConfig({ DROPBOX_APP_KEY: '   ', DROPBOX_REFRESH_TOKEN: 'db-token' }, ENV);
  assert.equal(cfg.appKey, 'env-key');
  assert.equal(cfg.appSecret, 'env-secret');
  assert.equal(cfg.refreshToken, 'db-token');
  assert.equal(cfg.rootFolder, '/Env Root');
});

test('dossier racine par defaut quand rien n est configure', () => {
  const cfg = resolveDropboxConfig({}, {});
  assert.equal(cfg.rootFolder, DEFAULT_ROOT_FOLDER);
  assert.equal(cfg.appKey, '');
});

test('les valeurs sont nettoyees des espaces', () => {
  const cfg = resolveDropboxConfig({ DROPBOX_APP_KEY: '  db-key  ', DROPBOX_ROOT_FOLDER: ' /RS ' }, {});
  assert.equal(cfg.appKey, 'db-key');
  assert.equal(cfg.rootFolder, '/RS');
});

test("l'empreinte change quand les identifiants changent, pas quand le dossier change", () => {
  const a = resolveDropboxConfig({}, ENV);
  const b = resolveDropboxConfig({ DROPBOX_ROOT_FOLDER: '/Autre' }, ENV);
  const c = resolveDropboxConfig({ DROPBOX_REFRESH_TOKEN: 'nouveau' }, ENV);
  assert.equal(credentialsFingerprint(a), credentialsFingerprint(b));
  assert.notEqual(credentialsFingerprint(a), credentialsFingerprint(c));
  assert.ok(!credentialsFingerprint(a).includes('env-secret'), "l'empreinte ne contient pas le secret en clair");
});
