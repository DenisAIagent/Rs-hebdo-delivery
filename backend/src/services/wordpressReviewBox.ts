/**
 * Metas editoriales de rollingstone.fr decouvertes le 01/10/2026 via le
 * mu-plugin (GET /wp-json/rs-delivery/v1/post-meta/{id}) sur des brouillons
 * RSH240 remplis a la main par la redaction :
 *
 * - Reviews Box (plugin Reviewer) : cle `rwp_reviews`, tableau d'une review
 *   (template Music ou Cinema, un critere « L'avis de la rédaction », note /5,
 *   image = image a la une) ;
 * - Main Music Artist (theme) : `_mat_value` (+ `_mat_other_value` vide) ;
 * - Style Music (theme) : `_tsm_value` (valeur du select, cf. WP_STYLE_MUSIC).
 *
 * Ces metas ne sont ecrites que si elles sont VIDES sur l'article : une saisie
 * manuelle de la redaction n'est jamais ecrasee.
 */

export const WP_META_REVIEWS = 'rwp_reviews';
export const WP_META_MAIN_ARTIST = '_mat_value';
export const WP_META_MAIN_ARTIST_OTHER = '_mat_other_value';
export const WP_META_STYLE_MUSIC = '_tsm_value';

/** Templates Reviewer du site (un critere « Avis de la redaction », note sur 5). */
export const REVIEW_TEMPLATE_MUSIC = 'rwp_template_5c765e33791e9';
export const REVIEW_TEMPLATE_CINEMA = 'rwp_template_5c765e419ddad';

export type ReviewKind = 'musique' | 'cinema';

export interface ReviewBoxInput {
  score: number;
  kind: ReviewKind;
  /** URL de l'image a la une (Reviewer affiche sa propre image). */
  imageUrl?: string;
  title?: string;
}

/** Structure exacte stockee par Reviewer, calquee sur les brouillons de la redaction. */
export function buildReviewBoxMeta(p: ReviewBoxInput): Record<string, unknown>[] {
  const score = Math.round(p.score * 2) / 2;
  return [{
    review_type: 'PAR+UR',
    review_title: p.title || "L'avis de la rédaction",
    review_title_options: 'custom_title',
    review_template: p.kind === 'cinema' ? REVIEW_TEMPLATE_CINEMA : REVIEW_TEMPLATE_MUSIC,
    review_scores: [score],
    review_custom_overall_score: '',
    review_criteria_source: 'reviewer',
    review_custom_tabs: [],
    review_pros: '',
    review_cons: '',
    review_summary: '',
    review_use_featured_image: 'no',
    review_image: p.imageUrl || '',
    review_image_url: '',
    review_custom_links: [],
    review_sameas_attr: '',
    review_disable_user_rating: 'yes',
    review_id: 0,
  }];
}

/** Une Reviews Box est-elle deja renseignee dans la valeur lue sur l'article ? */
export function hasReviewBox(existing: unknown): boolean {
  const values = Array.isArray(existing) ? existing : [existing];
  return values.some((v) => Array.isArray(v) ? v.length > 0 : !!v && typeof v === 'object' && Object.keys(v as object).length > 0);
}

/** Une meta scalaire (Main Artist, Style Music) est-elle deja renseignee ? */
export function hasScalarMeta(existing: unknown): boolean {
  const values = Array.isArray(existing) ? existing : [existing];
  return values.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
}

/**
 * Calcule les metas a ecrire : seulement celles encore vides sur l'article.
 * `existing` est la map `meta` renvoyee par le mu-plugin (cle -> valeurs[]).
 */
export function missingEditorialMeta(p: {
  existing: Record<string, unknown>;
  reviewBox?: ReviewBoxInput | null;
  mainArtist?: string | null;
  styleMusicValue?: string | null;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.reviewBox && !hasReviewBox(p.existing[WP_META_REVIEWS])) {
    out[WP_META_REVIEWS] = buildReviewBoxMeta(p.reviewBox);
  }
  const artist = (p.mainArtist || '').trim();
  if (artist && !hasScalarMeta(p.existing[WP_META_MAIN_ARTIST])) {
    out[WP_META_MAIN_ARTIST] = artist;
    out[WP_META_MAIN_ARTIST_OTHER] = '';
  }
  const style = (p.styleMusicValue || '').trim();
  if (style && !hasScalarMeta(p.existing[WP_META_STYLE_MUSIC])) {
    out[WP_META_STYLE_MUSIC] = style;
  }
  return out;
}
