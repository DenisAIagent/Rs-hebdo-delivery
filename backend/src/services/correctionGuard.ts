/**
 * Garde-fou de la correction IA (regle Denis, 14/10/2026) : le texte du
 * journaliste est livre mot pour mot. Une correction n'est acceptee que si
 * elle remplace un mot par un mot (faute de frappe, accord, accent) ou ne
 * touche qu'a la ponctuation. Refuse : mot ajoute ou retire, chiffre modifie.
 * Apostrophes ’ et espaces insecables du journaliste conserves.
 */

import type { CorrectionResult } from './correctionPrompt';

type Correction = CorrectionResult['corrections'][number];

export interface GuardResult {
  text: string;
  /** Modifications refusees, « avant → apres », pour les logs. */
  rejected: string[];
}

const WORD = /[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu;
const hasDigit = (s: string) => /\d/.test(s);
const words = (s: string) => s.match(WORD) || [];

/** Jetons : mots et separateurs (espaces, ponctuation) alternes. */
function tokenize(s: string): string[] {
  return s.split(/([\p{L}\p{N}][\p{L}\p{N}’'-]*)/u).filter((t) => t !== '');
}

type Op = { op: 'equal' | 'replace' | 'insert' | 'delete'; a: string[]; b: string[] };

/** Diff jeton par jeton (plus longue sous-suite commune), regroupe en operations. */
function diffTokens(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  let pendA: string[] = [];
  let pendB: string[] = [];
  const flush = () => {
    if (pendA.length || pendB.length) {
      ops.push({ op: pendA.length && pendB.length ? 'replace' : pendA.length ? 'delete' : 'insert', a: pendA, b: pendB });
      pendA = [];
      pendB = [];
    }
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      ops.push({ op: 'equal', a: [a[i]], b: [b[j]] });
      i++;
      j++;
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      pendB.push(b[j++]);
    } else {
      pendA.push(a[i++]);
    }
  }
  flush();
  return ops;
}

/** Remet les apostrophes typographiques et les espaces insecables du journaliste. */
function keepTypography(original: string, corrected: string): string {
  let out = corrected;
  if (original.includes('’')) out = out.replace(/'/g, '’');
  if (/[  ]/.test(original) && !/[  ]/.test(out)) {
    out = out.replace(/ ([:;!?»])/g, ' $1').replace(/« /g, '« ');
  }
  return out;
}

function guardParagraph(original: string, corrected: string, rejected: string[]): string {
  const ops = diffTokens(tokenize(original), tokenize(corrected));
  return ops.map(({ op, a, b }) => {
    const before = a.join('');
    const after = b.join('');
    if (op === 'equal') return before;
    const wa = words(before);
    const wb = words(after);
    const digitChanged = wa.some(hasDigit) || wb.some(hasDigit);
    const sameWordCount = wa.length === wb.length;
    if (sameWordCount && !digitChanged) {
      // Separateurs seuls (espace normale contre insecable) : on garde l'original.
      if (wa.length === 0 && before.trim() === '' && after.trim() === '') return before;
      return keepTypography(before, after);
    }
    rejected.push(`${before.trim() || '∅'} → ${after.trim() || '∅'}`);
    return before;
  }).join('');
}

export function guardCorrection(original: string, corrected: string): GuardResult {
  const rejected: string[] = [];
  const pa = original.split('\n');
  const pb = corrected.split('\n');
  if (pa.length !== pb.length) {
    return { text: original, rejected: ['structure des paragraphes modifiée : correction refusée'] };
  }
  const text = pa.map((p, i) => guardParagraph(p, pb[i], rejected)).join('\n');
  return { text, rejected };
}

/** Liste affichee au journaliste : uniquement les corrections que le garde-fou laisse passer. */
export function filterCorrections(corrections: Correction[]): Correction[] {
  return corrections.filter((c) => {
    const wa = words(c.original);
    const wb = words(c.corrected);
    return wa.length === wb.length && !wa.some(hasDigit) && !wb.some(hasDigit);
  });
}
