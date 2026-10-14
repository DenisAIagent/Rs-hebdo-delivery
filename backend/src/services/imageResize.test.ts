import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  featuredFilename, featuredContainFilename, webFilename, safeMediaBase,
  featuredMode, toFeaturedJpeg, FEATURED_WIDTH, FEATURED_HEIGHT,
} from './imageResize';

test('noms de fichiers medias en ASCII sur, tirets longs et accents compris', () => {
  assert.equal(safeMediaBase('Métro Verlaine – Rodeorama.jpg'), 'Metro-Verlaine-Rodeorama');
  assert.equal(featuredFilename('Dead Poet Society – Monarch.jpg'), 'Dead-Poet-Society-Monarch-1280x853.jpg');
  assert.equal(webFilename('photo.heic'), 'photo-web.jpg');
  assert.equal(featuredFilename('.jpg'), 'image-1280x853.jpg');
});

test('visuel entier : nom distinct du recadrage (la mediatheque dedoublonne par prefixe)', () => {
  assert.equal(featuredContainFilename('Où vont les âmes - affiche.png'), 'Ou-vont-les-ames-affiche-une-1280x853.jpg');
  assert.ok(!featuredContainFilename('a.jpg').startsWith(featuredFilename('a.jpg').replace(/\.jpg$/, '')));
});

test('recadrage seulement pour les photos paysage proches du 3:2', () => {
  assert.equal(featuredMode(3000, 2000), 'cover');
  assert.equal(featuredMode(1280, 855), 'cover');
  assert.equal(featuredMode(4113, 2747), 'cover');
  assert.equal(featuredMode(648, 864), 'contain');   // affiche
  assert.equal(featuredMode(3000, 3000), 'contain'); // pochette
  assert.equal(featuredMode(228, 318), 'contain');   // couverture de livre
  assert.equal(featuredMode(4000, 1500), 'contain'); // panorama
});

/** Image unie avec une bande rouge en haut : la bande disparait si on recadre. */
async function posterWithTopBand(width: number, height: number): Promise<Buffer> {
  const band = await sharp({ create: { width, height: Math.round(height * 0.08), channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 255 } } })
    .composite([{ input: band, top: 0, left: 0 }]).png().toBuffer();
}

async function pixel(buf: Buffer, x: number, y: number): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

test('affiche verticale : sortie 1280x853, haut de l\'affiche conserve', async () => {
  const out = await toFeaturedJpeg(await posterWithTopBand(648, 864), 'affiche.png');
  assert.equal(out.mode, 'contain');
  assert.equal(out.filename, 'affiche-une-1280x853.jpg');
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.width, FEATURED_WIDTH);
  assert.equal(meta.height, FEATURED_HEIGHT);
  // Bande rouge du haut de l'affiche, au centre de l'image
  const top = await pixel(out.buffer, FEATURED_WIDTH / 2, 10);
  assert.ok(top.r > 200 && top.b < 60, `haut de l'affiche coupe : ${JSON.stringify(top)}`);
});

test('pochette carree : visuel entier', async () => {
  const out = await toFeaturedJpeg(await posterWithTopBand(3000, 3000), 'pochette.jpg');
  assert.equal(out.mode, 'contain');
  assert.equal(out.width, FEATURED_WIDTH);
  assert.equal(out.height, FEATURED_HEIGHT);
});

test('photo paysage 3:2 : recadrage habituel', async () => {
  const out = await toFeaturedJpeg(await posterWithTopBand(3000, 2000), 'photo.jpg');
  assert.equal(out.mode, 'cover');
  assert.equal(out.filename, 'photo-1280x853.jpg');
  assert.equal(out.width, FEATURED_WIDTH);
  assert.equal(out.height, FEATURED_HEIGHT);
});
