import { supabaseAdmin } from '../utils/supabase';

// Fallback prompt used if the DB row is unreachable
export const FALLBACK_PROMPT = `Tu es correcteur professionnel pour Rolling Stone France (magazine hebdomadaire).

Corrige le texte suivant en respectant ces regles :

ORTHOGRAPHE & GRAMMAIRE :
- Orthographe francaise impeccable
- Grammaire et syntaxe correctes
- Verification des noms propres (artistes, lieux, labels, producteurs) — corrige les erreurs d'orthographe sur les noms connus

PONCTUATION & TYPOGRAPHIE :
- Guillemets francais (\u00ab \u00bb) avec espaces insecables
- Espaces insecables avant : ; ! ? et apres \u00ab
- Tirets cadratins pour les incises

CONVENTIONS EDITORIALES ROLLING STONE :
- Noms d'albums en italique : <em>Nom de l'album</em>
- Noms de singles/chansons entre guillemets : \u00ab Nom du single \u00bb
- Citations en italique : <em>citation</em>
- Noms propres avec majuscules correctes
- Style journalistique Rolling Stone (dynamique, precis, pas de jargon inutile)

MISE EN PAGE :
- CONSERVE IMPERATIVEMENT tous les sauts de ligne (\\n) et la structure en paragraphes du texte original.
- Ne fusionne JAMAIS deux paragraphes. Ne supprime JAMAIS de saut de ligne.
- Chaque paragraphe du texte original doit rester un paragraphe separe dans le texte corrige.

STYLE ET TON :
- Ne modifie PAS le sens ni le ton du texte. Corrige uniquement les erreurs et applique le formatage editorial.
- Les ponctuations expressives (?!, !?, ?!?, etc.) sont volontaires et font partie du style journalistique Rolling Stone. NE LES CORRIGE PAS.
- Respecte le registre de langue du journaliste : familier, oral, exclamatif — c'est le style Rolling Stone, pas une erreur.

Reponds UNIQUEMENT en JSON valide avec cette structure :
{
  "correctedText": "le texte corrige complet",
  "corrections": [
    {
      "original": "mot ou passage original",
      "corrected": "mot ou passage corrige",
      "type": "orthographe|grammaire|ponctuation|style|typographie",
      "explanation": "explication courte"
    }
  ]
}

Si le texte est parfait, renvoie correctedText identique et corrections vide.`;

export async function getPromptFromDB(): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from('correction_prompt')
      .select('prompt_text')
      .limit(1)
      .single();

    if (error || !data?.prompt_text) {
      console.warn('Failed to fetch prompt from DB, using fallback:', error?.message);
      return FALLBACK_PROMPT;
    }
    return data.prompt_text;
  } catch (e) {
    console.warn('Error fetching prompt from DB, using fallback:', e);
    return FALLBACK_PROMPT;
  }
}

export interface CorrectionResult {
  correctedText: string;
  corrections: Array<{
    original: string;
    corrected: string;
    type: 'orthographe' | 'grammaire' | 'ponctuation' | 'style' | 'typographie';
    explanation: string;
  }>;
  signCount: number;
}

/** Build the augmented system prompt with paragraph-preservation rule. */
export function buildSystemPrompt(basePrompt: string): string {
  return `${basePrompt}

REGLE ABSOLUE SUR LES SAUTS DE LIGNE :
Le texte contient des marqueurs [LIGNE_VIDE_X] qui representent des lignes vides (sauts de paragraphe). Tu DOIS les conserver EXACTEMENT tels quels dans correctedText, a leur position d'origine. Chaque ligne du texte original doit rester sur sa propre ligne dans correctedText. Ne fusionne JAMAIS deux lignes.`;
}

/** Replace empty lines with explicit markers so the model can preserve structure. */
export function numberEmptyLines(text: string): string {
  return text
    .split(/\n/)
    .map((p, i) => (p.trim() === '' ? `[LIGNE_VIDE_${i}]` : p))
    .join('\n');
}

/** Restore original newline structure if the model collapsed it. */
export function restoreStructure(
  originalText: string,
  corrected: string,
  corrections: CorrectionResult['corrections'],
): string {
  let out = corrected.replace(/\[LIGNE_VIDE_\d+\]/g, '');

  const originalNewlines = (originalText.match(/\n/g) || []).length;
  const correctedNewlines = (out.match(/\n/g) || []).length;

  if (originalNewlines > 3 && correctedNewlines < originalNewlines * 0.5) {
    console.warn(`[Correction] Newlines lost: original=${originalNewlines}, corrected=${correctedNewlines}.`);
    const origParagraphs = originalText.split(/\n\n+/);
    const corrParagraphs = out.split(/\n\n+/);

    if (corrParagraphs.length >= origParagraphs.length * 0.5) {
      out = corrParagraphs.join('\n\n');
    } else {
      out = originalText;
      for (const c of corrections) {
        if (c.original && c.corrected) {
          out = out.replace(c.original, c.corrected);
        }
      }
    }
  }
  return out;
}
