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
}

/** "Angus_03.heic" -> "Angus_03-1280x853.jpg" (keeps media-library dedup by name meaningful). */
export function featuredFilename(originalname: string): string {
  const base = originalname.replace(/\.[^.]+$/, '').trim() || 'image';
  return `${base}-${FEATURED_WIDTH}x${FEATURED_HEIGHT}.jpg`;
}

/** "photo.heic" -> "photo-web.jpg" */
export function webFilename(originalname: string): string {
  const base = originalname.replace(/\.[^.]+$/, '').trim() || 'image';
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
 * Center-crop ("cover") the image to 1280 × 853 and encode it as JPEG q90.
 * EXIF orientation is applied first so portrait phone photos come out upright.
 * Throws on undecodable input — callers fall back to the original file.
 */
export async function toFeaturedJpeg(input: Buffer, originalname: string): Promise<ResizedImage> {
  const { data, info } = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(FEATURED_WIDTH, FEATURED_HEIGHT, { fit: 'cover', position: 'attention', withoutEnlargement: false })
    .jpeg({ quality: FEATURED_JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    filename: featuredFilename(originalname),
    mimetype: 'image/jpeg',
    width: info.width,
    height: info.height,
  };
}
