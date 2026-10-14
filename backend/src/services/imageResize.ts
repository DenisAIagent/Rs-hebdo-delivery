/**
 * Image derivatives for WordPress.
 *
 * Dropbox always receives the original files untouched; only the WordPress
 * featured image is normalized to the rollingstone.fr format (1280 × 853,
 * same dimensions as the editorial Canva template), as a JPEG quality 90.
 */

import sharp from 'sharp';

export const FEATURED_WIDTH = 1280;
export const FEATURED_HEIGHT = 853;
export const FEATURED_JPEG_QUALITY = 90;

/** Body images: web size (long side capped), JPEG q85. */
export const BODY_MAX_SIDE = 1600;
export const BODY_JPEG_QUALITY = 85;

export interface ResizedImage {
  buffer: Buffer;
  filename: string;
  mimetype: 'image/jpeg';
  width: number;
  height: number;
  /** Image a la une seulement : recadree, cadree sur les visages ou visuel entier sur fond flouté. */
  mode?: 'cover' | 'contain' | 'focus';
}

/** "Angus_03.heic" -> "Angus_03-1280x853.jpg" (keeps media-library dedup by name meaningful). */
/**
 * Nom de fichier sur pour l'en-tete Content-Disposition de WordPress : accents
 * translitteres, tirets longs et espaces remplaces (sinon « Métro – Rodeorama »
 * arrive en mojibake dans la mediatheque).
 */
export function safeMediaBase(originalname: string): string {
  const base = originalname.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return base || 'image';
}

export function featuredFilename(originalname: string): string {
  const base = safeMediaBase(originalname);
  return `${base}-${FEATURED_WIDTH}x${FEATURED_HEIGHT}.jpg`;
}

/** "photo.heic" -> "photo-web.jpg" */
export function webFilename(originalname: string): string {
  const base = safeMediaBase(originalname);
  return `${base}-web.jpg`;
}

/**
 * Web derivative for the article body: keep the aspect ratio, cap the long
 * side at 1600 px (never enlarge), JPEG q85. Press originals (10-30 Mo)
 * would otherwise time out on the WordPress upload and bloat the site.
 */
export async function toWebJpeg(input: Buffer, originalname: string): Promise<ResizedImage> {
  const { data, info } = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(BODY_MAX_SIDE, BODY_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: BODY_JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    filename: webFilename(originalname),
    mimetype: 'image/jpeg',
    width: info.width,
    height: info.height,
  };
}

/**
 * Recadrage seulement pour les photos paysage proches du 3:2 (perte <= ~10 %).
 * Affiches, pochettes et couvertures seraient coupees (titre, texte) : elles
 * sont placees entieres sur un fond flouté.
 */
export const FEATURED_COVER_MIN_RATIO = 1.35;
export const FEATURED_COVER_MAX_RATIO = 1.65;
const CONTAIN_BLUR_SIGMA = 40;
const CONTAIN_BACKGROUND_BRIGHTNESS = 0.6;

export type FeaturedMode = 'cover' | 'contain';

export function featuredMode(width: number, height: number): FeaturedMode {
  const ratio = width / height;
  return ratio >= FEATURED_COVER_MIN_RATIO && ratio <= FEATURED_COVER_MAX_RATIO ? 'cover' : 'contain';
}

export interface ImageSize {
  width: number;
  height: number;
}

/** Dimensions apres orientation EXIF (5 a 8 = image tournee d'un quart). Null si illisible. */
export async function uprightSize(input: Buffer): Promise<ImageSize | null> {
  try {
    const { width, height, orientation } = await sharp(input, { failOn: 'none' }).metadata();
    if (!width || !height) return null;
    return orientation && orientation >= 5 ? { width: height, height: width } : { width, height };
  } catch {
    return null;
  }
}

/** Premiere image paysage (recadrable sans perte genante), sinon la premiere. */
export function pickLandscapeIndex(sizes: Array<ImageSize | null>): number {
  const idx = sizes.findIndex((s) => s !== null && featuredMode(s.width, s.height) === 'cover');
  return idx >= 0 ? idx : 0;
}

/** "affiche.png" -> "affiche-une-1280x853.jpg" : distinct du recadrage, sinon un renvoi reprendrait l'ancien media. */
export function featuredContainFilename(originalname: string): string {
  return `${safeMediaBase(originalname)}-une-${FEATURED_WIDTH}x${FEATURED_HEIGHT}.jpg`;
}

/** Visuel entier centre sur le meme visuel agrandi, flouté et assombri. */
async function containOnBlur(upright: Buffer): Promise<Buffer> {
  const background = await sharp(upright)
    .resize(FEATURED_WIDTH, FEATURED_HEIGHT, { fit: 'cover' })
    .blur(CONTAIN_BLUR_SIGMA)
    .modulate({ brightness: CONTAIN_BACKGROUND_BRIGHTNESS })
    .toBuffer();
  const foreground = await sharp(upright)
    .resize(FEATURED_WIDTH, FEATURED_HEIGHT, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  return sharp(background).composite([{ input: foreground, gravity: 'centre' }]).toBuffer();
}

/** Point de cadrage, coordonnees relatives (0-1) dans l'image redressee. */
export interface FocusPoint {
  x: number;
  y: number;
}

/** Les visages se placent a 40 % de la hauteur du cadre : de l'air au-dessus des tetes. */
const FOCUS_VERTICAL_ANCHOR = 0.4;

/** Plus grande fenetre 3:2 de l'image, cadree sur le point de focus et bornee a l'image. */
export function focusCropBox(width: number, height: number, focus: FocusPoint): { left: number; top: number; width: number; height: number } {
  const ratio = FEATURED_WIDTH / FEATURED_HEIGHT;
  const cropW = Math.min(width, Math.round(height * ratio));
  const cropH = Math.min(height, Math.round(cropW / ratio));
  const clamp = (v: number, max: number) => Math.max(0, Math.min(Math.round(v), max));
  return {
    left: clamp(focus.x * width - cropW / 2, width - cropW),
    top: clamp(focus.y * height - cropH * FOCUS_VERTICAL_ANCHOR, height - cropH),
    width: cropW,
    height: cropH,
  };
}

/** "portrait.jpg" -> "portrait-cadre-1280x853.jpg" : distinct des autres derives (dedoublonnage par prefixe). */
export function featuredFocusFilename(originalname: string): string {
  return `${safeMediaBase(originalname)}-cadre-${FEATURED_WIDTH}x${FEATURED_HEIGHT}.jpg`;
}

export interface FeaturedOptions {
  /** Photo d'artiste : recadrer sur ce point (visages) au lieu de placer le visuel entier. */
  focus?: FocusPoint;
}

/**
 * Image a la une 1280 × 853, JPEG q90. Photo paysage : recadrage centre
 * ("cover", zone d'interet). Point de focus fourni (visages d'une photo
 * d'artiste verticale) : recadrage sur ce point. Sinon : visuel entier sur fond flouté.
 * EXIF orientation is applied first so portrait phone photos come out upright.
 * Throws on undecodable input — callers fall back to the original file.
 */
export async function toFeaturedJpeg(input: Buffer, originalname: string, opts: FeaturedOptions = {}): Promise<ResizedImage> {
  const upright = await sharp(input, { failOn: 'none' }).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;
  const shape = featuredMode(width, height);
  const mode: 'cover' | 'contain' | 'focus' = shape === 'cover' ? 'cover' : opts.focus ? 'focus' : 'contain';
  const framed = mode === 'cover'
    ? sharp(upright.data).resize(FEATURED_WIDTH, FEATURED_HEIGHT, { fit: 'cover', position: 'attention', withoutEnlargement: false })
    : mode === 'focus'
      ? sharp(upright.data).extract(focusCropBox(width, height, opts.focus!)).resize(FEATURED_WIDTH, FEATURED_HEIGHT, { fit: 'fill' })
      : sharp(await containOnBlur(upright.data));
  const { data, info } = await framed
    .jpeg({ quality: FEATURED_JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const filename = mode === 'cover' ? featuredFilename(originalname)
    : mode === 'focus' ? featuredFocusFilename(originalname)
      : featuredContainFilename(originalname);
  return {
    buffer: data,
    filename,
    mimetype: 'image/jpeg',
    width: info.width,
    height: info.height,
    mode,
  };
}
