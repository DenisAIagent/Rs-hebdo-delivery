/**
 * Gras en ligne dans le texte livre : `**question**` (l'app retire tout HTML
 * des champs, donc le gras passe par ce marquage). Rendu en gras dans le DOCX
 * Dropbox et en <strong> dans l'article WordPress. Sert notamment a distinguer
 * les questions des reponses dans les interviews.
 */
export interface TextSegment {
  text: string;
  bold: boolean;
}

const BOLD_RE = /\*\*(.+?)\*\*/g;

export function splitBold(line: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of line.matchAll(BOLD_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: line.slice(last, at), bold: false });
    out.push({ text: m[1], bold: true });
    last = at + m[0].length;
  }
  if (last < line.length || out.length === 0) out.push({ text: line.slice(last), bold: false });
  return out;
}

/** A appliquer sur du texte DEJA echappe pour le HTML. */
export function boldToHtml(escaped: string): string {
  return escaped.replace(BOLD_RE, '<strong>$1</strong>');
}

/**
 * Types ou le chapo est du texte imprime (intro de l'interview, de la couv) :
 * il part aussi dans le DOCX Dropbox. Pour les autres types, le chapo reste
 * reserve au site (consigne du 01/10/2026).
 */
export const PRINT_CHAPO_TYPES: ReadonlySet<string> = new Set(['Interview 3000', 'Sujet de couv']);
