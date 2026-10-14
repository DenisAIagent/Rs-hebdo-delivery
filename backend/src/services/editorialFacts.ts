/**
 * Chapo et SEO verifies (regle Denis, 14/10/2026) : « on n'invente rien ».
 * Quand le journaliste n'a pas fourni de chapo et que l'interrupteur
 * « chapo obligatoire » est coupe, le chapo est redige par l'IA ; le titre SEO
 * et la meta-description le sont toujours. Dans les deux cas :
 *   1. recherche web (outil serveur Anthropic) : fiche de faits, chacun source ;
 *   2. redaction a partir des seuls faits sources + identite de la livraison ;
 *   3. audit par une seconde passe : toute affirmation non sourcee est signalee,
 *      reecrite une fois, sinon retiree (pas de chapo, SEO de repli).
 */

import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, getClaudeModel, DEFAULT_CLAUDE_MODEL } from './claude';

export interface VerifiedFact {
  fact: string;
  source: string;
}

export interface FactSheet {
  facts: VerifiedFact[];
  /** Orthographe officielle du nom de l'artiste (le formulaire le met en capitales). */
  displayName: string | null;
  /** Affirmations du journaliste contredites par les sources (pour les logs, jamais publiees). */
  contradictions: string[];
}

export interface EditorialCopy {
  chapo: string;
  seoTitle: string;
  metaDescription: string;
}

export interface AuditProblem {
  field: string;
  claim: string;
}

export interface PaperIdentity {
  paperTypeName: string;
  /** Artiste, titre du film / livre / expo. */
  artist: string;
  /** Album, realisateur, auteur ou lieu selon le type. */
  work: string;
  title: string;
  label?: string;
}

const RESEARCH_TIMEOUT_MS = 180_000;
const WRITE_TIMEOUT_MS = 90_000;
const MAX_SEARCHES = 6;
const MAX_CONTINUATIONS = 3;
const SEO_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 155;

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isHttp = (v: unknown): v is string => isText(v) && /^https?:\/\//i.test(v.trim());

export function parseFactSheet(input: unknown): FactSheet {
  const raw = (input ?? {}) as { facts?: unknown; displayName?: unknown; contradictions?: unknown };
  const facts = Array.isArray(raw.facts)
    ? raw.facts.flatMap((f) => {
      const x = f as Partial<VerifiedFact> | null;
      return x && isText(x.fact) && isHttp(x.source) ? [{ fact: x.fact.trim(), source: x.source.trim() }] : [];
    })
    : [];
  return {
    facts,
    displayName: isText(raw.displayName) ? raw.displayName.trim() : null,
    contradictions: Array.isArray(raw.contradictions) ? raw.contradictions.filter(isText).map((c) => c.trim()) : [],
  };
}

export function parseAudit(input: unknown): AuditProblem[] {
  const problems = (input as { problems?: unknown })?.problems;
  if (!Array.isArray(problems)) return [];
  return problems.flatMap((p) => {
    const x = p as Partial<AuditProblem> | null;
    return x && isText(x.field) && isText(x.claim) ? [{ field: x.field.trim(), claim: x.claim.trim() }] : [];
  });
}

export function factsSource(facts: VerifiedFact[]): string {
  return facts.map((f) => f.fact).join('\n');
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Remplace le nom en capitales du formulaire par l'orthographe officielle (meme nom, casse differente seulement). */
export function applyDisplayName(text: string, formName: string, displayName: string | null): string {
  if (!text || !formName || !displayName) return text;
  if (displayName.toLocaleUpperCase('fr-FR') !== formName.toLocaleUpperCase('fr-FR') || displayName === formName) return text;
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(formName)}(?![\\p{L}\\p{N}])`, 'gu'), displayName);
}

const isFilm = (type: string) => /cinema|cinéma/i.test(type);
const isBookOrExpo = (type: string) => /livre|expo/i.test(type);

/** Repli sans aucune affirmation : seulement l'identite de la livraison. */
export function fallbackSeo(p: Pick<PaperIdentity, 'paperTypeName' | 'artist' | 'work' | 'title'>): { seoTitle: string; metaDescription: string } {
  const artist = p.artist || p.title;
  const de = (name: string) => (/^[aeiouyàâéèêëîïôöùûüh]/i.test(name) ? `d’${name}` : `de ${name}`);
  if (isFilm(p.paperTypeName)) {
    return {
      seoTitle: `Critique : ${artist}`.slice(0, SEO_TITLE_MAX),
      metaDescription: (p.work ? `Critique de ${artist}, ${de(p.work)}.` : `Critique de ${artist}.`).slice(0, META_DESCRIPTION_MAX),
    };
  }
  return {
    seoTitle: (p.work && !isBookOrExpo(p.paperTypeName) ? `${artist} – ${p.work}` : artist).slice(0, SEO_TITLE_MAX),
    metaDescription: (p.work ? `Chronique de ${p.work}, ${de(artist)}.` : `Chronique : ${artist}.`).slice(0, META_DESCRIPTION_MAX),
  };
}

/** Titre de repli sans affirmation : format des articles publies (n°241). */
export function fallbackTitle(p: Pick<PaperIdentity, 'paperTypeName' | 'artist' | 'work' | 'title'>): string {
  if (isFilm(p.paperTypeName)) return `Critique : ${p.artist || p.title}`;
  if (/interview|couv|livre|expo|live/i.test(p.paperTypeName) || !p.work) return p.title;
  return `${p.artist || p.title} – ${p.work}`;
}

// --- Appels Claude ---------------------------------------------------------

const FACTS_TOOL = {
  name: 'submit_facts',
  description: 'Renvoie la fiche de faits verifies, chacun avec l\'URL de sa source.',
  input_schema: {
    type: 'object' as const,
    properties: {
      displayName: { type: 'string', description: 'Orthographe officielle du nom de l\'artiste / de l\'oeuvre (casse exacte), ou chaine vide.' },
      facts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fact: { type: 'string', description: 'Un fait precis, en francais.' },
            source: { type: 'string', description: 'URL de la page qui confirme ce fait.' },
          },
          required: ['fact', 'source'],
        },
      },
      contradictions: { type: 'array', items: { type: 'string' }, description: 'Affirmations du texte contredites par les sources.' },
    },
    required: ['displayName', 'facts', 'contradictions'],
  },
};

const COPY_TOOL = {
  name: 'submit_copy',
  description: 'Renvoie le chapo et les champs SEO.',
  input_schema: {
    type: 'object' as const,
    properties: {
      chapo: { type: 'string', description: 'Chapo (une phrase) ou chaine vide si non demande.' },
      seoTitle: { type: 'string', description: `Titre SEO, ${SEO_TITLE_MAX} caracteres maximum.` },
      metaDescription: { type: 'string', description: `Meta-description, ${META_DESCRIPTION_MAX} caracteres maximum.` },
    },
    required: ['chapo', 'seoTitle', 'metaDescription'],
  },
};

const AUDIT_TOOL = {
  name: 'submit_audit',
  description: 'Renvoie les affirmations non confirmees par la fiche de faits.',
  input_schema: {
    type: 'object' as const,
    properties: {
      problems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', description: 'title, chapo, seoTitle ou metaDescription.' },
            claim: { type: 'string', description: 'Le passage non confirme.' },
          },
          required: ['field', 'claim'],
        },
      },
    },
    required: ['problems'],
  },
};

type ToolDef = typeof FACTS_TOOL | typeof COPY_TOOL | typeof AUDIT_TOOL;

/**
 * Appelle Claude jusqu'a obtenir l'outil `tool`. tool_choice « auto » : le
 * modele configure refuse l'outil force. Gere la pause des outils serveur
 * (recherche web) et retombe sur le modele par defaut si le modele est refuse.
 */
async function callForTool(p: {
  system: string; user: string; tool: ToolDef; webSearch: boolean; timeoutMs: number;
}): Promise<unknown> {
  const anthropic = await getAnthropicClient(p.timeoutMs);
  let model = await getClaudeModel();
  const tools = [
    ...(p.webSearch ? [{ type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: MAX_SEARCHES }] : []),
    p.tool,
  ] as Anthropic.ToolUnion[];
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const messages: Anthropic.MessageParam[] = [{ role: 'user', content: p.user }];
      for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
        const response = await anthropic.messages.create({
          model, max_tokens: 4096, system: p.system, tools, tool_choice: { type: 'auto' }, messages,
        });
        const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === p.tool.name);
        if (toolUse) return toolUse.input;
        if (response.stop_reason !== 'pause_turn') {
          messages.push({ role: 'assistant', content: response.content });
          messages.push({ role: 'user', content: `Reponds maintenant avec l'outil ${p.tool.name}.` });
        } else {
          messages.push({ role: 'assistant', content: response.content });
        }
      }
      lastErr = new Error(`outil ${p.tool.name} non renvoye`);
    } catch (e: unknown) {
      lastErr = e;
      const msg = String((e as Error)?.message || e);
      if (model !== DEFAULT_CLAUDE_MODEL && /model|not_found|404|does not exist|invalid/i.test(msg)) model = DEFAULT_CLAUDE_MODEL;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function identityBlock(id: PaperIdentity): string {
  return [
    `Type de papier : ${id.paperTypeName}`,
    `Artiste / titre : ${id.artist || id.title}`,
    id.work ? `Album / réalisateur / auteur / lieu : ${id.work}` : '',
    id.label ? `Label / éditeur / distributeur indiqué : ${id.label}` : '',
  ].filter(Boolean).join('\n');
}

function factsBlock(sheet: FactSheet): string {
  return sheet.facts.length > 0
    ? sheet.facts.map((f, i) => `${i + 1}. ${f.fact} (source : ${f.source})`).join('\n')
    : '(aucun fait vérifié)';
}

export async function researchFacts(id: PaperIdentity, bodyText: string, today: string): Promise<FactSheet> {
  const system = `Tu es documentaliste pour Rolling Stone France. Date du jour : ${today}.
Avec l'outil de recherche web, verifie des faits utiles pour presenter ce papier dans un chapo et un titre SEO :
- musique : label, date de sortie, rang de l'album dans la discographie (premier, deuxieme...), origine (ville, pays), composition du groupe, producteur ;
- cinema : date de sortie en salles en France, distributeur, acteurs principaux, prix, nationalite ;
- livre : editeur, date de parution, genre, nombre de pages ; profil de l'auteur ;
- exposition : lieu, ville, dates exactes, commissariat.
Regles : seulement des sources serieuses (site officiel de l'artiste, du label, de l'editeur, du musee, du distributeur ; CNC, festivals ; presse reconnue ; Wikipedia en complement seulement). Un fait n'entre dans la fiche que s'il est confirme par une page que tu as consultee, avec son URL. Dans le doute, ne le mets pas. Signale aussi les affirmations du texte du journaliste que les sources contredisent.
Termine en appelant l'outil ${FACTS_TOOL.name}.`;
  const user = `${identityBlock(id)}\n\nTexte du journaliste (contexte, a ne pas recopier) :\n${bodyText.slice(0, 6000)}`;
  return parseFactSheet(await callForTool({ system, user, tool: FACTS_TOOL, webSearch: true, timeoutMs: RESEARCH_TIMEOUT_MS }));
}

export interface WriteOptions {
  wantChapo: boolean;
  chapoMaxWords: number;
  chapoExample?: string;
  focusKeyword?: string;
  problems?: AuditProblem[];
  previous?: EditorialCopy;
}

const SHARED_RULES = `Regles absolues :
- N'utilise QUE les faits de la fiche (sources verifiees) et l'identite du papier. Aucun autre fait : ni date, ni chiffre, ni rang d'album, ni nationalite, ni ville, ni genre, ni prix, ni superlatif qui n'y figure pas.
- Jamais une phrase ni un avis repris du texte du journaliste ; ton neutre, informatif.
- Noms propres avec l'orthographe officielle de la fiche (pas de capitales imposees).`;

export async function writeCopy(id: PaperIdentity, sheet: FactSheet, opts: WriteOptions, today: string): Promise<EditorialCopy> {
  const system = `Tu es chef d'edition web de Rolling Stone France. Date du jour : ${today}.
${opts.wantChapo
    ? `CHAPO : une seule phrase, ${opts.chapoMaxWords} mots maximum, qui presente le papier : qui, quoi, et un ou deux faits de la fiche. Modele : « [Artiste] publie / revient avec [Album] ([Label]), [fait verifie] ».${opts.chapoExample ? ` Exemple de ton : « ${opts.chapoExample} »` : ''}`
    : 'CHAPO : non demande, renvoie une chaine vide.'}
TITRE SEO : ${SEO_TITLE_MAX} caracteres maximum${opts.focusKeyword ? `, commence si possible par « ${opts.focusKeyword} »` : ''} (chroniques : « Artiste – Album » ; cinema : « Critique : Titre »).
META-DESCRIPTION : ${META_DESCRIPTION_MAX} caracteres maximum, contient le mot-cle, presente le papier.
${SHARED_RULES}
Reponds avec l'outil ${COPY_TOOL.name}.`;
  const fix = opts.problems?.length && opts.previous
    ? `\n\nVersion precedente refusee :\n${JSON.stringify(opts.previous)}\nAffirmations non confirmees a retirer :\n${opts.problems.map((p) => `- ${p.field} : ${p.claim}`).join('\n')}`
    : '';
  const user = `${identityBlock(id)}\nNom officiel : ${sheet.displayName || id.artist || id.title}\n\nFiche de faits verifies :\n${factsBlock(sheet)}${fix}`;
  const raw = (await callForTool({ system, user, tool: COPY_TOOL, webSearch: false, timeoutMs: WRITE_TIMEOUT_MS })) as Partial<EditorialCopy>;
  return {
    chapo: opts.wantChapo && isText(raw?.chapo) ? raw.chapo.trim() : '',
    seoTitle: isText(raw?.seoTitle) ? raw.seoTitle.trim().slice(0, SEO_TITLE_MAX) : '',
    metaDescription: isText(raw?.metaDescription) ? raw.metaDescription.trim().slice(0, META_DESCRIPTION_MAX) : '',
  };
}

export async function auditCopy(id: PaperIdentity, sheet: FactSheet, copy: EditorialCopy & { title?: string }): Promise<AuditProblem[]> {
  const system = `Tu es verificateur (fact-checker) de Rolling Stone France. Pour chaque affirmation factuelle du titre, du chapo, du titre SEO et de la meta-description (date, chiffre, rang d'album, label, nationalite, ville, genre, prix, membres, duree...), verifie qu'elle est confirmee par la fiche de faits ou par l'identite du papier. Une formulation neutre (« publie », « chronique de », « critique de ») n'est pas une affirmation. Liste uniquement les passages NON confirmes ; liste vide si tout est confirme.
Reponds avec l'outil ${AUDIT_TOOL.name}.`;
  const user = `${identityBlock(id)}\n\nFiche de faits verifies :\n${factsBlock(sheet)}\n\nA verifier :\n${JSON.stringify(copy, null, 1)}`;
  return parseAudit(await callForTool({ system, user, tool: AUDIT_TOOL, webSearch: false, timeoutMs: WRITE_TIMEOUT_MS }));
}

export interface VerifiedEditorial {
  sheet: FactSheet;
  copy: EditorialCopy & { title: string };
  /** Champs retires faute de confirmation, pour les logs. */
  dropped: AuditProblem[];
}

/** Recherche, redaction, audit, une reecriture ; ce qui reste non confirme est retire. */
export async function buildVerifiedEditorial(
  id: PaperIdentity, bodyText: string, opts: Omit<WriteOptions, 'problems' | 'previous'>, draftTitle = '',
): Promise<VerifiedEditorial> {
  const today = new Date().toISOString().slice(0, 10);
  const sheet = await researchFacts(id, bodyText, today);
  let copy = await writeCopy(id, sheet, opts, today);
  let problems = await auditCopy(id, sheet, { title: draftTitle, ...copy });
  if (problems.some((p) => p.field !== 'title')) {
    copy = await writeCopy(id, sheet, { ...opts, problems: problems.filter((p) => p.field !== 'title'), previous: copy }, today);
    problems = [...problems.filter((p) => p.field === 'title'), ...(await auditCopy(id, sheet, copy))];
  }
  const flagged = new Set(problems.map((p) => p.field));
  const repli = fallbackSeo(id);
  const final: EditorialCopy & { title: string } = {
    title: flagged.has('title') || !draftTitle ? fallbackTitle(id) : draftTitle,
    chapo: flagged.has('chapo') ? '' : copy.chapo,
    seoTitle: flagged.has('seoTitle') || !copy.seoTitle ? repli.seoTitle : copy.seoTitle,
    metaDescription: flagged.has('metaDescription') || !copy.metaDescription ? repli.metaDescription : copy.metaDescription,
  };
  return { sheet, copy: final, dropped: problems };
}
