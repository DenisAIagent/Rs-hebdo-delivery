/**
 * Validation serveur des champs d'une livraison, a partir du fields_config du
 * type de papier (meme regle que le formulaire, mais le serveur fait foi).
 *
 * Regles (redaction, 01/10/2026) :
 * - tout champ `required` doit etre rempli (texte, textarea, url, etoiles, images) ;
 * - `alternateKey` : l'un OU l'autre des deux champs suffit ;
 * - `validation: 'youtube'` : l'URL doit etre un lien YouTube (clip) ;
 * - `validation: 'website'` : l'URL doit etre un site (Bandcamp, site officiel,
 *   editeur...), jamais un lien YouTube.
 */

export interface FieldRule {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'images' | 'stars';
  required: boolean;
  min?: number;
  max?: number;
  alternateKey?: string;
  validation?: 'youtube' | 'website';
  /** Normalisation a l'enregistrement : `uppercase` = NOM DE L'ARTISTE en capitales (consigne du 02/10/2026). */
  transform?: 'uppercase';
}

export const YOUTUBE_URL_RE = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;

export function isYoutubeUrl(url: string): boolean {
  return YOUTUBE_URL_RE.test(url.trim());
}

/** Message d'erreur pour une URL selon la regle demandee, ou null si valide. */
export function urlProblem(value: string, validation?: FieldRule['validation']): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!URL_RE.test(v)) return 'doit être une adresse complète (https://…)';
  if (validation === 'youtube' && !isYoutubeUrl(v)) return 'doit être un lien YouTube (youtube.com ou youtu.be)';
  if (validation === 'website' && isYoutubeUrl(v)) return 'doit être un site (Bandcamp, site officiel, éditeur), pas un lien YouTube';
  return null;
}

export interface MetadataCheckInput {
  fields: FieldRule[];
  metadata: Record<string, unknown>;
  /** Images jointes a cette requete. */
  imageCount: number;
  /** Modification : des images existent deja sur la livraison. */
  hasExistingImages?: boolean;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v).trim());

function filled(field: FieldRule, input: MetadataCheckInput): boolean {
  if (field.type === 'images') {
    return input.imageCount >= (field.min || 1) || !!input.hasExistingImages;
  }
  if (field.type === 'stars') {
    const n = parseFloat(text(input.metadata[field.key]).replace(',', '.'));
    return Number.isFinite(n) && n >= 0.5;
  }
  return text(input.metadata[field.key]).length > 0;
}

/** Liste des problemes (vide = livraison acceptable). */
export function validateMetadata(input: MetadataCheckInput): string[] {
  const problems: string[] = [];
  const byKey = new Map(input.fields.map((f) => [f.key, f]));
  for (const field of input.fields) {
    if (field.required && !filled(field, input)) {
      const alt = field.alternateKey ? byKey.get(field.alternateKey) : undefined;
      if (alt && filled(alt, input)) continue;
      if (field.type === 'images') problems.push(`${field.label} : ${field.min || 1} image(s) minimum`);
      else if (alt) problems.push(`${field.label} ou ${alt.label} : obligatoire`);
      else problems.push(`${field.label} : obligatoire`);
    }
    if (field.type === 'url') {
      const problem = urlProblem(text(input.metadata[field.key]), field.validation);
      if (problem) problems.push(`${field.label} : ${problem}`);
    }
  }
  return problems;
}

/** Applique les normalisations declarees (sans muter l'objet recu). */
export function normalizeMetadata(fields: FieldRule[], metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...metadata };
  for (const field of fields) {
    const v = out[field.key];
    if (field.transform === 'uppercase' && typeof v === 'string') out[field.key] = v.trim().toLocaleUpperCase('fr-FR');
  }
  return out;
}
