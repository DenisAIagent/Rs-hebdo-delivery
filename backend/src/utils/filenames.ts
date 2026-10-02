/**
 * Noms de fichiers televerses : certains clients (curl, anciens navigateurs)
 * envoient l'UTF-8 que multer lit en latin-1, d'ou « â » a la place d'un
 * tiret ou « Ã© » a la place d'un e accentue. On repare quand le motif est
 * sans ambiguite ; un nom deja propre est renvoye tel quel.
 */
const MOJIBAKE_RE = /[\u00C2-\u00C3\u00E2][\u0080-\u00BF]/;

export function fixMojibake(name: string): string {
  if (!MOJIBAKE_RE.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}
