/**
 * Chapo des articles web (WordPress). Consigne de Denis du 08/10/2026 :
 * - chapo fourni par le journaliste : repris tel quel ;
 * - sinon, un chapo NEUTRE genere (une phrase, uniquement avec les elements de
 *   la livraison), tant que l'interrupteur « chapo obligatoire »
 *   (app_settings.STRICT_EDITORIAL_FIELDS) est coupe ;
 * - interrupteur allume : plus aucun chapo genere.
 * Jamais une phrase du journaliste deplacee ou recopiee en chapo.
 * Rien ici ne concerne Dropbox ni le docx imprime.
 */

export type ChapoMode = 'journaliste' | 'generer' | 'aucun';

export interface ChapoDecisionInput {
  provided: string;
  strict: boolean;
  agentIfMissing: 'none' | 'generate';
}

export function decideChapoMode({ provided, strict, agentIfMissing }: ChapoDecisionInput): ChapoMode {
  if (provided.trim()) return 'journaliste';
  if (strict || agentIfMissing === 'none') return 'aucun';
  return 'generer';
}

export const DEFAULT_CHAPO_MAX_WORDS = 45;
/** Nombre de mots consecutifs du texte journaliste au-dela duquel le chapo est une copie. */
const COPY_WINDOW = 8;

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (s: string) => normalize(s).match(/[\p{L}\p{N}]+/gu) || [];

export function cleanGeneratedChapo(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[«"“]\s*/, '')
    .replace(/\s*[»"”]$/, '')
    .trim();
}

/** Mots a majuscule hors debut de phrase : noms, titres, labels. */
function properNouns(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const token = m[0];
    if (!/^\p{Lu}/u.test(token)) continue;
    const before = text.slice(0, m.index).trimEnd();
    const sentenceStart = before === '' || /[.!?…]$/.test(before);
    if (!sentenceStart) out.push(token);
  }
  return out;
}

function copiesSource(chapoWords: string[], sourceText: string): boolean {
  if (chapoWords.length < COPY_WINDOW) return false;
  const source = ` ${words(sourceText).join(' ')} `;
  for (let i = 0; i + COPY_WINDOW <= chapoWords.length; i++) {
    if (source.includes(` ${chapoWords.slice(i, i + COPY_WINDOW).join(' ')} `)) return true;
  }
  return false;
}

export type ChapoCheck = { ok: true; chapo: string } | { ok: false; reason: string };

/**
 * Garde-fou mecanique sur un chapo genere : longueur, aucune copie du texte du
 * journaliste, aucun nom propre ni chiffre absent de la livraison.
 */
export function checkGeneratedChapo(raw: string, sourceText: string, maxWords: number | null): ChapoCheck {
  const chapo = cleanGeneratedChapo(raw);
  const chapoWords = words(chapo);
  if (chapoWords.length === 0) return { ok: false, reason: 'chapô vide' };
  const limit = maxWords ?? DEFAULT_CHAPO_MAX_WORDS;
  if (chapoWords.length > limit) return { ok: false, reason: `chapô trop long (${chapoWords.length} mots, maximum ${limit})` };
  if (copiesSource(chapoWords, sourceText)) return { ok: false, reason: 'le chapô reprend une phrase du texte du journaliste' };

  const sourceWords = new Set(words(sourceText));
  const missingNames = properNouns(chapo).filter((w) => !sourceWords.has(normalize(w)));
  const sourceNumbers = new Set(sourceText.match(/\d+/g) || []);
  const missingNumbers = (chapo.match(/\d+/g) || []).filter((n) => !sourceNumbers.has(n));
  const missing = [...new Set([...missingNames, ...missingNumbers])];
  if (missing.length) return { ok: false, reason: `élément absent de la livraison : ${missing.join(', ')}` };
  return { ok: true, chapo };
}

export interface ChapoPromptOptions {
  maxWords?: number | null;
  example?: string;
}

/** Consigne de l'IA pour le champ excerpt (= chapo de l'article web). */
export function chapoPromptInstruction(mode: ChapoMode, opts: ChapoPromptOptions): string {
  if (mode === 'journaliste') {
    return 'CHAPO (champ excerpt) : le journaliste a fourni un chapo dans le formulaire ; recopie-le tel quel dans excerpt, sans rien changer.';
  }
  if (mode === 'aucun') {
    return 'CHAPO (champ excerpt) : aucun chapo pour cet article ; excerpt = chaine vide.';
  }
  const limit = opts.maxWords ?? DEFAULT_CHAPO_MAX_WORDS;
  return [
    `CHAPO (champ excerpt) : le journaliste n'a pas fourni de chapo. Ecris un chapo NEUTRE en texte brut : une seule phrase, ${limit} mots maximum.`,
    '- Il presente le papier sans le resumer : qui (artiste, auteur, sujet), quoi (album, film, livre, concert, exposition), et au plus un trait de couleur fidele au ton du papier.',
    '- Uniquement des noms, titres, labels, lieux, dates et chiffres presents dans la livraison (texte ou formulaire). Aucun fait ajoute.',
    '- Jamais une phrase ni un extrait recopie du texte du journaliste, aucune citation, aucun avis nouveau.',
    opts.example?.trim() ? `- Exemple du ton attendu : « ${opts.example.trim()} »` : '',
  ].filter(Boolean).join('\n');
}
