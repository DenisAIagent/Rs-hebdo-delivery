/**
 * Nettoyage des textes saisis par les journalistes avant stockage et envoi
 * vers Dropbox, WordPress et les moteurs d'IA.
 */

export const MAX_TITLE_LENGTH = 300;
/** Plafond absolu d'un corps de papier (identique a celui de /api/correct). */
export const MAX_BODY_LENGTH = 100_000;
const MIN_BODY_CAP = 20_000;
const SIGN_LIMIT_TOLERANCE = 3;

const TAG = /<[^>]*>?/g;
const ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&nbsp;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&amp;/g, '&'],
];

function decodeEntities(str: string): string {
  return ENTITIES.reduce((out, [pattern, char]) => out.replace(pattern, char), str);
}

/**
 * Retire toutes les balises HTML. Les entites sont decodees PUIS le resultat
 * est re-nettoye, jusqu'a stabilisation : `&lt;script&gt;` (ou `&amp;lt;…`)
 * ne peut donc pas redevenir une balise.
 */
export function stripHtml(str: string): string {
  let out = str;
  for (let i = 0; i < 5; i++) {
    const next = decodeEntities(out.replace(TAG, ''));
    if (next === out) break;
    out = next;
  }
  return out.replace(TAG, '');
}

/** Titre sur une ligne, sans balise ni caractere de controle. */
export function cleanTitle(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return stripHtml(raw).replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Longueur maximale acceptee pour un corps de papier : trois fois le calibrage
 * du type (un papier trop long reste livrable), bornee entre 20 000 signes et
 * le plafond absolu.
 */
export function maxBodyLength(signLimit: unknown): number {
  const limit = Number(signLimit);
  if (!Number.isFinite(limit) || limit <= 0) return MAX_BODY_LENGTH;
  return Math.min(MAX_BODY_LENGTH, Math.max(MIN_BODY_CAP, Math.round(limit * SIGN_LIMIT_TOLERANCE)));
}

/** Lien http/https tel quel, sinon chaine vide (jamais javascript:, data:, etc.). */
export function httpUrlOrEmpty(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? raw.trim() : '';
  } catch {
    return '';
  }
}
