import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripHtml, cleanTitle, httpUrlOrEmpty, maxBodyLength, MAX_BODY_LENGTH } from './textSafety';
import { describeError, toSafeError } from './safeError';

test('stripHtml retire les balises et decode les entites', () => {
  assert.equal(stripHtml('<b>AC/DC</b> &amp; Friends'), 'AC/DC & Friends');
  assert.equal(stripHtml('Rock&nbsp;&quot;n&quot; roll'), 'Rock "n" roll');
});

test('stripHtml ne laisse pas une entite redevenir une balise', () => {
  assert.equal(stripHtml('&lt;script&gt;alert(1)&lt;/script&gt;'), 'alert(1)');
  assert.equal(stripHtml('&amp;lt;img src=x onerror=alert(1)&amp;gt;'), '');
  assert.ok(!stripHtml('&lt;img src=x onerror=alert(1)&gt;titre').includes('<'));
});

test('cleanTitle : une ligne, sans balise, sans controle', () => {
  assert.equal(cleanTitle('  <img src=x onerror=1>Mon\n titre\t ici '), 'Mon titre ici');
  assert.equal(cleanTitle(undefined), '');
  assert.equal(cleanTitle(42), '');
});

test('maxBodyLength : trois fois le calibrage, borne', () => {
  assert.equal(maxBodyLength(10_000), 30_000);
  assert.equal(maxBodyLength(1_500), 20_000);
  assert.equal(maxBodyLength(90_000), MAX_BODY_LENGTH);
  assert.equal(maxBodyLength(null), MAX_BODY_LENGTH);
  assert.equal(maxBodyLength('abc'), MAX_BODY_LENGTH);
});

test('describeError ne recopie jamais la configuration de la requete', () => {
  const axiosLike = {
    message: 'Request failed with status code 400',
    config: {
      headers: { Authorization: 'Bearer SECRET_TOKEN' },
      auth: { username: 'key', password: 'SECRET_PASSWORD' },
      data: 'refresh_token=SECRET_REFRESH',
    },
    response: { status: 400, data: { error: 'invalid_grant' } },
  };
  const out = describeError(axiosLike);
  assert.ok(!out.includes('SECRET'));
  assert.match(out, /HTTP 400/);
  assert.match(out, /invalid_grant/);
  assert.ok(!toSafeError(axiosLike).message.includes('SECRET'));
  assert.equal(Object.keys(toSafeError(axiosLike)).includes('config'), false);
});

test('describeError accepte tout type', () => {
  assert.equal(describeError('boom'), 'boom');
  assert.equal(describeError(new Error('x')), 'x');
  assert.equal(describeError(null), 'null');
});

test('httpUrlOrEmpty ne garde que http et https', () => {
  assert.equal(httpUrlOrEmpty(' https://exemple.fr/a '), 'https://exemple.fr/a');
  assert.equal(httpUrlOrEmpty('javascript:alert(1)'), '');
  assert.equal(httpUrlOrEmpty('data:text/html,x'), '');
  assert.equal(httpUrlOrEmpty('pas une url'), '');
  assert.equal(httpUrlOrEmpty(undefined), '');
});
