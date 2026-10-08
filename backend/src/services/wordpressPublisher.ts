/**
 * WordPress publishing pipeline — runs in parallel with the Dropbox delivery.
 * Never throws into the delivery flow: every failure is logged (admin Logs tab)
 * and reflected on the delivery row (wp_status = 'error').
 *
 * The AI formats the paper per the rollingstone.fr editorial conventions, then
 * the article is created as a WordPress DRAFT for editorial validation.
 * Fields that cannot be set reliably via REST (Yoast, Style Music, Main Music
 * Artist) are stored in wp_payload for the team to finish in the classic editor.
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../utils/supabase';
import { logInfo, logError, logWarn, type LogContext } from './deliveryLogger';
import { notifyWordpressError } from './email';
import { getAnthropicClient, getClaudeModel, DEFAULT_CLAUDE_MODEL } from './claude';
import {
  isWordpressEnabled,
  searchWpPosts,
  findOrCreateWpTag,
  uploadWpMedia,
  createWpDraftPost,
  findWpMediaByKeywords,
  setWpMediaMeta,
  getWpCategory,
  readWpPostMeta,
  writeWpPostMeta,
  type WpPostCandidate, findWpUserByName } from './wordpress';
import { buildWpSystemPrompt, normalizeWpCategories, WP_STYLE_MUSIC } from './wordpressRules';
import { decideChapoMode, checkGeneratedChapo, chapoPromptInstruction, type ChapoMode } from './chapoPolicy';
import { isStrictEditorialFields } from './fieldPolicy';
import { hasReviewBox, hasScalarMeta, missingEditorialMeta, WP_META_MAIN_ARTIST, WP_META_REVIEWS, WP_META_STYLE_MUSIC, type ReviewBoxInput } from './wordpressReviewBox';
import { fetchDeliveryImages, type ImageFile } from './dropbox';
import { toFeaturedJpeg, toWebJpeg, FEATURED_WIDTH, FEATURED_HEIGHT, BODY_MAX_SIDE } from './imageResize';
import { boldToHtml } from './inlineBold';
import { loadAgentRulesForPaperType } from './editorialAgents';

export interface WpPublishInput {
  deliveryId: string;
  title: string;
  paperTypeName: string;
  journalistName: string;
  hebdoLabel: string;
  metadata: Record<string, unknown>;
  bodyText: string;
  /** All delivered images, in order: the first one becomes the featured image,
   *  the others are inserted at the end of the article body. */
  images?: ImageFile[];
  /** Renvoi : brouillon WordPress existant a mettre a jour (pas de doublon). */
  existingPostId?: number;
  /** Renvoi : payload deja calcule (titre, excerpt, SEO...) — evite un nouvel appel IA. */
  previousPayload?: Partial<WpArticlePayload>;
  /** Renvoi : ne toucher qu'au corps/extrait/auteur du brouillon existant. */
  contentOnly?: boolean;
}

/** Echappement minimal pour injecter du texte brut dans le HTML de l'article. */
function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Assemble le HTML de l'article a partir du texte livre, MOT POUR MOT :
 * - H3 = chapo leger (accroche/chapo du formulaire, sinon excerpt propose), optionnel ;
 * - un <p> par paragraphe du texte, citations « » en <em> (mise en forme seulement) ;
 * - signature « Par Prenom Nom » en fin d'article.
 * Aucune phrase n'est ajoutee ni reformulee : c'est la garantie demandee par la redaction.
 */
export interface ArticleHtmlInput {
  chapo?: string;
  bodyText: string;
  journalistName: string;
  /** URL YouTube : inseree seule dans un paragraphe, WordPress l'integre en video. */
  videoUrl?: string;
  /** Lien sortant : site officiel, Bandcamp, label, editeur, plateforme. */
  shopUrl?: string;
  shopLabel?: string;
  /** Lien interne « A lire aussi » vers un article rollingstone.fr existant. */
  readAlso?: { url: string; title: string };
}

const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;

export type PaperKind = 'musique' | 'cinema' | 'livres';

/**
 * Libelle du lien sortant selon le domaine : un lien « Voir le clip » sous la
 * video n'a pas de sens, on nomme ce vers quoi on envoie (Bandcamp, site
 * officiel, editeur, plateforme).
 */
export function outboundLinkLabel(url: string, kind: PaperKind = 'musique'): string {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { host = ''; }
  if (host.endsWith('bandcamp.com')) return 'Écouter et acheter sur Bandcamp';
  if (/(^|\.)(lnk\.to|ffm\.to|linktr\.ee|orcd\.co|fanlink\.to|lnkfi\.re|found\.ee)$/.test(host)) return "Écouter l'album";
  if (/(^|\.)(netflix|primevideo|amazon|disneyplus|canalplus|ocs|peacocktv|max|appletv|paramountplus)\./.test(host)) return 'Voir sur la plateforme';
  if (host.endsWith('allocine.fr')) return 'Fiche AlloCiné';
  if (/(^|\.)(dargaud|dupuis|gallimard|seuil|grasset|flammarion|actes-sud|albin-michel|casterman|glenat|delcourt|lerobert|fayard)\./.test(host)) return "Fiche de l'éditeur";
  if (/(philharmoniedeparis|centrepompidou|louvre|museedarts|grandpalais|mep-fr|jeudepaume)/.test(host)) return 'Infos et billetterie';
  if (kind === 'cinema') return 'Voir';
  if (kind === 'livres') return 'En savoir plus';
  return 'Site officiel';
}

/** Repartit le lien du formulaire : YouTube = video, le reste = lien d'achat/ecoute. */
export function splitLinks(lien?: string, lienAchat?: string): { videoUrl?: string; shopUrl?: string } {
  const a = (lien || '').trim();
  const b = (lienAchat || '').trim();
  const out: { videoUrl?: string; shopUrl?: string } = {};
  for (const url of [a, b]) {
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (YOUTUBE_RE.test(url) && !out.videoUrl) out.videoUrl = url;
    else if (!out.shopUrl) out.shopUrl = url;
  }
  return out;
}

export function buildArticleHtml(p: ArticleHtmlInput): string {
  const blocks: string[] = [];
  const chapo = (p.chapo || '').replace(/\s+/g, ' ').trim();
  if (chapo) blocks.push(`<h3>${escapeHtmlText(chapo)}</h3>`);
  const paragraphs = p.bodyText.replace(/\r\n?/g, '\n').split(/\n\s*\n|\n/).map((x) => x.trim()).filter(Boolean);
  const video = p.videoUrl ? `<p>${escapeHtmlText(p.videoUrl)}</p>` : null;
  // La video se place au milieu de la chronique (apres la premiere moitie des
  // paragraphes) quand il y en a au moins deux, sinon juste avant la signature.
  const videoAfter = video && paragraphs.length >= 2 ? Math.ceil(paragraphs.length / 2) - 1 : -1;
  paragraphs.forEach((para, i) => {
    const html = boldToHtml(escapeHtmlText(para).replace(/«\s?([^»]+?)\s?»/g, (_m, q: string) => `<em>« ${q.trim()} »</em>`));
    blocks.push(`<p>${html}</p>`);
    if (video && i === videoAfter) blocks.push(video);
  });
  // Lien sortant nomme (Bandcamp, site officiel, editeur...). Jamais de lien
  // « Voir le clip » vers la video deja integree : ca ne veut rien dire.
  if (p.shopUrl) blocks.push(`<p><a href="${escapeHtmlAttr(p.shopUrl)}" target="_blank" rel="noopener">${escapeHtmlText(p.shopLabel || outboundLinkLabel(p.shopUrl))}</a></p>`);
  if (video && videoAfter < 0) blocks.push(video);
  if (p.readAlso) blocks.push(`<p><em>À lire aussi :</em> <a href="${escapeHtmlAttr(p.readAlso.url)}">${escapeHtmlText(p.readAlso.title)}</a></p>`);
  const name = p.journalistName.trim();
  if (name) blocks.push(`<p><em>Par ${escapeHtmlText(name)}</em></p>`);
  return blocks.join('\n\n');
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Chronique types get the Reviewer box recap shortcode (rollingstone.fr convention). */
const REVIEW_RECAP_SHORTCODE = '[rwp-review-recap id="0"]';

export function isChroniqueType(paperTypeName: string): boolean {
  const n = paperTypeName.toLowerCase();
  return n.includes('chronique') || n.includes('disque de la semaine');
}

/**
 * Insert the review recap shortcode after the body, before the author /
 * translation credit block when there is one (never twice).
 */
export function appendReviewRecap(contentHtml: string): string {
  if (contentHtml.includes('[rwp-review-recap')) return contentHtml;
  const creditIdx = contentHtml.search(/<p>\s*<em>\s*Par\s|<em>\s*Par\s/i);
  if (creditIdx > 0) {
    return `${contentHtml.slice(0, creditIdx).trimEnd()}\n\n${REVIEW_RECAP_SHORTCODE}\n\n${contentHtml.slice(creditIdx)}`;
  }
  return `${contentHtml.trimEnd()}\n\n${REVIEW_RECAP_SHORTCODE}`;
}

/**
 * Ce qui reste VRAIMENT a saisir a la main, une ligne par tache.
 *
 * Calcule a partir de ce que WordPress a reellement accepte, pas d'une phrase
 * figee : un champ ecrit par l'API ne doit plus apparaitre dans la liste.
 */
export function buildEditorTodo(p: {
  chronique: boolean;
  reviewScore: number | null;
  /** Valeur du select Style Music ('1' a '27'), telle que la stocke WP_STYLE_MUSIC. */
  styleMusicValue: string | null;
  mainArtist?: string;
  metaRejected: string[];
  /** Metas editoriales presentes sur l'article apres l'envoi (ecrites par l'app ou a la main). */
  editorialPresent: { reviewBox: boolean; mainArtist: boolean; styleMusic: boolean };
}): string[] {
  const todo: string[] = [];

  if (p.metaRejected.some((k) => k.startsWith('_yoast_wpseo_'))) {
    todo.push('Yoast SEO : requete cible, titre SEO et meta description (voyant vert).');
  }
  if (!p.editorialPresent.styleMusic) {
    todo.push(
      p.styleMusicValue
        ? `Style Music : selectionner la valeur ${p.styleMusicValue} dans le menu deroulant.`
        : 'Style Music : a choisir dans le menu deroulant.',
    );
  }
  if (!p.editorialPresent.mainArtist) {
    todo.push(
      p.mainArtist
        ? `Main Music Artist : saisir "${p.mainArtist}".`
        : 'Main Music Artist : a saisir.',
    );
  }
  if (p.chronique && !p.editorialPresent.reviewBox) {
    todo.push(
      `Reviews Box : template Review Chronique, critere "L'avis de la redaction", note ${p.reviewScore ?? 'a reporter'}/5, image = image a la une.`,
    );
  }
  return todo;
}

/**
 * Ecrit Reviews Box, Main Artist et Style Music sur l'article, uniquement pour
 * les metas encore vides (jamais d'ecrasement d'une saisie de la redaction).
 * Renvoie ce qui est present sur l'article a l'issue de l'operation.
 */
export async function ensureEditorialMeta(p: {
  postId: number;
  reviewBox: ReviewBoxInput | null;
  mainArtist: string | null;
  styleMusicValue: string | null;
  ctx: LogContext;
}): Promise<{ reviewBox: boolean; mainArtist: boolean; styleMusic: boolean }> {
  const absent = { reviewBox: false, mainArtist: false, styleMusic: false };
  let existing: Record<string, unknown> = {};
  try {
    const data = (await readWpPostMeta(p.postId)) as { meta?: Record<string, unknown> };
    existing = data?.meta || {};
  } catch (err: any) {
    await logWarn('wp-meta', `Lecture des metabox impossible (${err?.response?.status || err?.message || err}) — Reviews Box, Main Artist et Style Music a verifier a la main`, p.ctx);
    return absent;
  }
  const toWrite = missingEditorialMeta({ existing, reviewBox: p.reviewBox, mainArtist: p.mainArtist, styleMusicValue: p.styleMusicValue });
  let written: string[] = [];
  if (Object.keys(toWrite).length > 0) {
    try {
      written = await writeWpPostMeta(p.postId, toWrite);
    } catch (err: any) {
      await logWarn('wp-meta', `Ecriture des metabox refusee (${err?.message || err})`, p.ctx);
    }
    const refused = Object.keys(toWrite).filter((k) => !written.includes(k));
    if (written.length > 0) await logInfo('wp-meta', `Metabox ecrites : ${written.join(', ')}`, p.ctx);
    if (refused.length > 0) await logWarn('wp-meta', `Metabox refusees par le mu-plugin (prefixe non autorise ?) : ${refused.join(', ')} — a saisir a la main`, p.ctx);
  }
  const isPresent = (key: string, has: (v: unknown) => boolean) => written.includes(key) || (!(key in toWrite) && has(existing[key]));
  const result = {
    reviewBox: isPresent(WP_META_REVIEWS, hasReviewBox),
    mainArtist: isPresent(WP_META_MAIN_ARTIST, hasScalarMeta),
    styleMusic: isPresent(WP_META_STYLE_MUSIC, hasScalarMeta),
  };
  const kept = [
    result.reviewBox && !written.includes(WP_META_REVIEWS) ? 'Reviews Box' : '',
    result.mainArtist && !written.includes(WP_META_MAIN_ARTIST) ? 'Main Artist' : '',
    result.styleMusic && !written.includes(WP_META_STYLE_MUSIC) ? 'Style Music' : '',
  ].filter(Boolean);
  if (kept.length > 0) await logInfo('wp-meta', `Deja renseigne sur l'article, conserve : ${kept.join(', ')}`, p.ctx);
  return result;
}

/** Rating from the delivery form ("etoiles", on 5), or null. */
function reviewScoreFromMetadata(metadata: Record<string, unknown>): number | null {
  const raw = (metadata as any)?.etoiles;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

/** One Gutenberg image block (no caption: the photo credit lives on the media only). */
function buildImageBlock(m: { id: number; url: string }, alt: string): string {
  const safeAlt = escapeHtmlAttr(alt);
  return (
    `<!-- wp:image {"id":${m.id},"sizeSlug":"large","linkDestination":"none"} -->\n` +
    `<figure class="wp-block-image size-large"><img src="${m.url}" alt="${safeAlt}" class="wp-image-${m.id}"/></figure>\n` +
    `<!-- /wp:image -->`
  );
}

/** Top-level HTML blocks of the AI content (h3 chapo, h4 intertitres, p paragraphs, anything else). */
const TOP_LEVEL_BLOCK_RE = /<(h3|h4|p)\b[^>]*>[\s\S]*?<\/\1>/gi;

function splitTopLevelBlocks(html: string): string[] {
  const blocks: string[] = [];
  let last = 0;
  for (const match of html.matchAll(TOP_LEVEL_BLOCK_RE)) {
    const start = match.index ?? 0;
    const between = html.slice(last, start).trim();
    if (between) blocks.push(between);
    blocks.push(match[0]);
    last = start + match[0].length;
  }
  const tail = html.slice(last).trim();
  if (tail) blocks.push(tail);
  return blocks;
}

const isParagraph = (b: string) => /^<p\b/i.test(b);

/**
 * Spread the extra photos evenly inside the article body:
 * - never before the chapo (first H3) and never right after an H4 (an
 *   intertitre must be followed by its paragraph);
 * - insertion points = after body paragraphs at k·P/(N+1);
 * - whatever cannot be placed goes at the end.
 */
export function insertImagesIntoBody(
  contentHtml: string,
  media: Array<{ id: number; url: string }>,
  alt: string,
): string {
  if (media.length === 0) return contentHtml;

  const blocks = splitTopLevelBlocks(contentHtml);
  // Candidate slots: index (in `blocks`) after which an image may go.
  const slots: number[] = [];
  // Only after a paragraph: an image is never placed right after an H3/H4
  // (an intertitre stays glued to its paragraph); before an H4 is fine.
  blocks.forEach((b, i) => {
    if (isParagraph(b)) slots.push(i);
  });
  // Never before the chapo: drop any slot located before the first H3 (if any).
  const firstH3 = blocks.findIndex((b) => /^<h3\b/i.test(b));
  const usable = firstH3 >= 0 ? slots.filter((i) => i > firstH3) : slots;

  const placements = new Map<number, string[]>(); // block index -> blocks to append after it
  const leftovers: string[] = [];
  const P = usable.length;
  media.forEach((m, k) => {
    const html = buildImageBlock(m, alt);
    if (P === 0) { leftovers.push(html); return; }
    const pos = Math.min(P - 1, Math.max(0, Math.round(((k + 1) * P) / (media.length + 1)) - 1));
    const at = usable[pos];
    placements.set(at, [...(placements.get(at) || []), html]);
  });

  const out: string[] = [];
  blocks.forEach((b, i) => {
    out.push(b);
    for (const img of placements.get(i) || []) out.push(img);
  });
  out.push(...leftovers);
  return out.join('\n\n');
}

interface WpArticlePayload {
  title: string;
  slug: string;
  excerpt: string;
  /** Assemble par l'application (buildArticleHtml), jamais par l'IA. */
  contentHtml?: string;
  categories: number[];
  tags: string[];
  focusKeyword: string;
  seoTitle: string;
  metaDescription: string;
  mainArtist: string;
  styleMusic: string;
  photoCredit: string;
  /** URL d'un article rollingstone.fr choisi parmi les candidats fournis (ou vide). */
  internalLinkUrl?: string;
  /** Agent web applique (onglet « Agents IA »), trace dans wp_payload. */
  agent?: { name: string; version: number; alerts: string[] } | null;
  /** Origine du chapo decidee avant l'appel IA (journaliste, genere, aucun). */
  chapoPlan?: { mode: ChapoMode; maxWords: number | null };
}

/** Chapo du journaliste saisi dans le formulaire (champ chapo, sinon accroche). */
const providedChapo = (metadata: Record<string, unknown>) => String(metadata?.chapo || metadata?.accroche || '').trim();

const WP_ARTICLE_TOOL = {
  name: 'submit_wp_article',
  description: 'Renvoie le payload WordPress complet, conforme aux conventions editoriales rollingstone.fr.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: "Titre de l'article." },
      slug: { type: 'string', description: 'Slug court, mots-cles, tirets, sans accents.' },
      excerpt: { type: 'string', description: 'Chapo leger en texte brut, 1 a 2 phrases, fidele au papier (reprendre accroche/chapo du formulaire si presents).' },
      categories: { type: 'array', items: { type: 'integer' }, description: 'IDs categorie : parent + sous-categorie.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Minimum 5 tags.' },
      focusKeyword: { type: 'string', description: 'Requete cible Yoast (1-2 mots).' },
      seoTitle: { type: 'string', description: 'Titre SEO ~55 caracteres.' },
      metaDescription: { type: 'string', description: 'Meta description ~150 caracteres (max 155).' },
      mainArtist: { type: 'string', description: 'Artiste principal (vide si non musical). Plusieurs : virgules, principal en premier.' },
      styleMusic: { type: 'string', description: 'Style Music exact de la liste autorisee (vide si non musical).' },
      photoCredit: { type: 'string', description: 'Credit photo "© Photographe/Agence" si present dans les donnees, sinon vide.' },
      internalLinkUrl: { type: 'string', description: "URL EXACTE d'un article de la liste <liens_internes_candidats> en rapport avec le papier (meme artiste, meme film, meme sujet), sinon chaine vide. Jamais une URL inventee." },
    },
    required: [
      'title', 'slug', 'excerpt', 'categories', 'tags',
      'focusKeyword', 'seoTitle', 'metaDescription', 'mainArtist', 'styleMusic', 'photoCredit',
    ],
  },
};

/** Ask Claude to format the paper as a WordPress-ready payload. */
async function formatArticleForWp(
  input: WpPublishInput,
  internalCandidates: WpPostCandidate[],
  strictChapo: boolean,
): Promise<WpArticlePayload> {
  const anthropic = await getAnthropicClient(120_000);
  let model = await getClaudeModel();

  const candidatesBlock = internalCandidates.length > 0
    ? internalCandidates.map((c) => `- ${c.title} — ${c.link}`).join('\n')
    : '(aucun candidat trouve — ne pas inventer de lien interne)';

  const userContent = `<papier>
Type de papier : ${input.paperTypeName}
Titre livre : ${input.title}
Donnees du formulaire (JSON) : ${JSON.stringify(input.metadata)}
Corps du texte :
${input.bodyText}
</papier>

<liens_internes_candidats>
${candidatesBlock}
</liens_internes_candidats>`;

  // Agent web du type de papier (onglet « Agents IA ») ; absent = prompt historique.
  const subtype = typeof input.metadata?.sous_type === 'string' ? input.metadata.sous_type : null;
  const agentInfo = await loadAgentRulesForPaperType(input.paperTypeName, subtype, { strictChapo });
  if (!agentInfo.agent) console.warn(`[agents] aucun agent actif pour « ${input.paperTypeName} » : regles generiques`);
  const agentMeta = agentInfo.agent
    ? { name: agentInfo.agent.name, version: agentInfo.agent.version, alerts: agentInfo.alerts }
    : null;

  // Chapo : journaliste, sinon genere tant que l'interrupteur « chapo obligatoire » est coupe.
  const agentChapo = (agentInfo.agent?.config as { chapo?: { ifMissing: 'none' | 'generate'; maxWords: number | null; example?: string } } | undefined)?.chapo;
  const chapoMode = decideChapoMode({
    provided: providedChapo(input.metadata as Record<string, unknown>),
    strict: strictChapo,
    agentIfMissing: agentChapo?.ifMissing ?? 'generate',
  });
  const chapoPlan = { mode: chapoMode, maxWords: agentChapo?.maxWords ?? null };
  const chapoInstruction = chapoPromptInstruction(chapoMode, { maxWords: chapoPlan.maxWords, example: agentChapo?.example });

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 16384,
        system: buildWpSystemPrompt(agentInfo.rules, chapoInstruction),
        tools: [WP_ARTICLE_TOOL],
        tool_choice: { type: 'tool', name: 'submit_wp_article' },
        messages: [{ role: 'user', content: userContent }],
      });

      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (toolUse) return { ...(toolUse.input as WpArticlePayload), agent: agentMeta, chapoPlan };

      lastErr = new Error(`stop_reason=${response.stop_reason}`);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (model !== DEFAULT_CLAUDE_MODEL && /model|not_found|404|does not exist|invalid/i.test(msg)) {
        model = DEFAULT_CLAUDE_MODEL;
      }
    }
  }
  throw new Error(`Mise en forme IA WordPress echouee: ${String((lastErr as any)?.message || lastErr)}`);
}

/**
 * Choisit le lien interne « A lire aussi » :
 * 1. l'URL retenue par l'IA parmi les candidats ;
 * 2. a defaut, un candidat dont le titre cite l'artiste ;
 * 3. a defaut, la page de la premiere categorie de l'article.
 */
export async function pickInternalLink(p: {
  candidates: WpPostCandidate[];
  aiChoice?: string;
  artiste: string;
  categories: number[];
  loadCategory?: (id: number) => Promise<{ name: string; link: string } | null>;
}): Promise<{ url: string; title: string } | undefined> {
  const wanted = (p.aiChoice || '').trim();
  const chosen = wanted ? p.candidates.find((c) => c.link && c.link === wanted) : undefined;
  if (chosen) return { url: chosen.link, title: chosen.title };
  const artiste = p.artiste.trim().toLowerCase();
  if (artiste.length >= 3) {
    const byArtist = p.candidates.find((c) => c.link && c.title.toLowerCase().includes(artiste));
    if (byArtist) return { url: byArtist.link, title: byArtist.title };
  }
  const load = p.loadCategory || getWpCategory;
  for (const id of p.categories) {
    try {
      const cat = await load(id);
      if (cat?.link) return { url: cat.link, title: `Tous nos articles ${cat.name}` };
    } catch { /* on tente la suivante */ }
  }
  return undefined;
}

/** Persist WP tracking info on the delivery row (best effort). */
async function saveWpState(
  deliveryId: string,
  patch: { wp_status: string; wp_post_id?: number | null; wp_post_url?: string | null; wp_payload?: unknown },
): Promise<void> {
  try {
    await supabaseAdmin.from('deliveries').update(patch).eq('id', deliveryId);
  } catch (err) {
    console.error('[WordPress] Failed to save wp state:', err);
  }
}

/**
 * Full pipeline. Safe to fire and forget: catches everything.
 * Returns the created post info, or null when disabled/failed.
 */
export async function publishDeliveryToWordpress(
  input: WpPublishInput,
): Promise<{ id: number; link: string; editUrl: string } | null> {
  const ctx: LogContext = {
    journalistName: input.journalistName,
    hebdoLabel: input.hebdoLabel,
    paperTypeName: input.paperTypeName,
    title: input.title,
  };

  try {
    if (!(await isWordpressEnabled())) {
      return null; // module off — silent skip
    }

    await logInfo('wp-start', `Envoi WordPress de "${input.title}"`, ctx);
    await saveWpState(input.deliveryId, { wp_status: 'pending' });

    // 1. Internal-link candidates from the existing site: artist, album, title,
    //    then the Style Music of the previous payload (a related genre article).
    const metaIn = input.metadata as Record<string, unknown>;
    const artisteIn = String(metaIn.artiste || '').trim();
    const albumIn = String(metaIn.album || '').trim();
    const queries = [...new Set([artisteIn, albumIn, input.title, String(input.previousPayload?.styleMusic || '').trim()].filter((q) => q.length >= 3))];
    let candidates: WpPostCandidate[] = [];
    try {
      for (const q of queries) {
        const found = await searchWpPosts(q, 6);
        for (const c of found) {
          if (c.id === input.existingPostId) continue; // never link an article to itself
          if (!candidates.some((x) => x.id === c.id)) candidates = [...candidates, c];
        }
        if (candidates.length >= 12) break;
      }
    } catch {
      await logWarn('wp-links', 'Recherche de liens internes impossible (on continue sans)', ctx);
    }

    // 2. AI formatting per editorial conventions
    // L'IA ne sert plus qu'aux metadonnees et a un chapo court. Sur un renvoi,
    // on ne garde de sa reponse que l'excerpt : titre, slug, SEO, categories,
    // tags, Style Music et Main Artist restent ceux du brouillon existant.
    const strictChapo = await isStrictEditorialFields();
    const fresh = await formatArticleForWp(input, candidates, strictChapo);
    const prev = input.previousPayload;
    const payload: WpArticlePayload = prev && prev.title
      ? { ...(prev as WpArticlePayload), categories: prev.categories || [], tags: prev.tags || [], excerpt: fresh.excerpt }
      : fresh;
    if (prev && prev.title) {
      await logInfo('wp-format', 'Renvoi : titre, SEO, categories, tags et metaboxes du brouillon existant conserves', ctx);
    }
    const categories = normalizeWpCategories(payload.categories);
    if (categories.length === 0) {
      await logWarn('wp-format', 'Aucune categorie valide proposee par l\'IA — article envoye sans categorie', ctx);
    }
    await logInfo('wp-format', `Article mis en forme (${payload.tags.length} tags, categories: ${categories.join(', ') || 'aucune'})`, ctx);

    // 3. Tags (reuse existing tags before creating new ones)
    const tagIds: number[] = [];
    for (const tag of (payload.tags || []).slice(0, 15)) {
      try {
        tagIds.push(await findOrCreateWpTag(tag));
      } catch {
        await logWarn('wp-tags', `Tag "${tag}" impossible a creer (ignore)`, ctx);
      }
    }

    // 4. Images : la premiere devient l'image a la une, les suivantes sont
    //    inserees en fin d'article (blocs image Gutenberg). Dedup par nom de
    //    fichier ; le credit photo va en legende du media, jamais dans le texte.
    let featuredMediaId: number | undefined;
    let featuredMediaUrl: string | undefined;
    const bodyMedia: Array<{ id: number; url: string }> = [];
    const images = input.images || [];
    // Texte alternatif des images (Yoast) : « Artiste – Album », sinon le titre.
    const imageAlt = artisteIn && albumIn ? `${artisteIn} – ${albumIn}` : artisteIn || payload.title || input.title;
    if (images.length === 0) {
      // No photo delivered (typical for chroniques): reuse an image already in
      // the media library — cover or artist picture — searched by artist/album.
      const artiste = String((input.metadata as any)?.artiste || '').trim();
      const album = String((input.metadata as any)?.album || '').trim();
      const queries = [artiste && album ? `${artiste} ${album}` : '', album, artiste, input.title].filter(Boolean);
      try {
        const hit = await findWpMediaByKeywords(queries);
        if (hit) {
          featuredMediaId = hit.id;
          featuredMediaUrl = hit.url;
          if (!hit.altText) await setWpMediaMeta(hit.id, { altText: imageAlt }).catch(() => undefined);
          await logInfo('wp-media', `Aucune photo livree — image a la une reprise de la mediatheque (media #${hit.id}, ${hit.url.split('/').pop()})`, ctx);
        } else {
          await logWarn('wp-media', `Aucune photo livree et rien en mediatheque pour « ${queries[0]} » — article envoye sans image a la une`, ctx);
        }
      } catch (err: any) {
        await logWarn('wp-media', `Aucune photo livree ; recherche mediatheque echouee (${err?.message || err}) — article envoye sans image`, ctx);
      }
    }
    for (const [index, image] of images.entries()) {
      try {
        // Featured image: rollingstone.fr format (1280 x 853, JPEG q90). Originals stay in Dropbox.
        let upload = { buffer: image.buffer, filename: image.originalname, mimetype: image.mimetype };
        try {
          // Body images: web derivative (long side <= 1600 px, JPEG q85).
          const resized = index === 0
            ? await toFeaturedJpeg(image.buffer, image.originalname)
            : await toWebJpeg(image.buffer, image.originalname);
          upload = { buffer: resized.buffer, filename: resized.filename, mimetype: resized.mimetype };
        } catch (err: any) {
          const target = index === 0 ? `${FEATURED_WIDTH}x${FEATURED_HEIGHT}` : `web ${BODY_MAX_SIDE}px`;
          await logWarn('wp-media', `Redimensionnement ${target} impossible pour "${image.originalname}" (${err?.message || err}) — original envoye`, ctx);
        }
        const media = await uploadWpMedia({
          ...upload,
          caption: payload.photoCredit || undefined,
          altText: imageAlt,
        });
        if (index === 0) {
          featuredMediaId = media.id;
          featuredMediaUrl = media.url;
          await logInfo('wp-media', `Image a la une prete (media #${media.id}, ${upload.filename})`, ctx);
        } else if (media.id === featuredMediaId || bodyMedia.some((m) => m.id === media.id)) {
          // Meme fichier livre plusieurs fois (ex. doublon pour atteindre le
          // minimum de photos) : la mediatheque dedoublonne par nom, inutile de
          // reinserer la meme image dans le corps de l'article.
          await logInfo('wp-media', `Image "${image.originalname}" deja utilisee — doublon ignore`, ctx);
        } else {
          bodyMedia.push(media);
        }
      } catch (err: any) {
        const detail = err?.response?.data?.message || err?.message || String(err);
        await logWarn('wp-media', `Upload image "${image.originalname}" echoue (ignoree) : ${detail}`, ctx);
      }
    }
    if (bodyMedia.length > 0) {
      await logInfo('wp-media', `${bodyMedia.length} image(s) inseree(s) dans le corps de l'article`, ctx);
    }
    // Le corps est le texte livre, mot pour mot ; le chapo vient du formulaire
    // (accroche / chapo) ou, a defaut, de l'excerpt propose par l'IA (1-2 phrases).
    const meta = input.metadata as Record<string, unknown>;
    // Chapo (consigne du 08/10/2026) : celui du journaliste ; sinon un chapo
    // neutre genere, verifie mecaniquement, tant que l'interrupteur « chapo
    // obligatoire » est coupe. Jamais une phrase du journaliste : le corps reste entier.
    const chapoPlan = fresh.chapoPlan ?? { mode: 'aucun' as ChapoMode, maxWords: null };
    let chapo = '';
    if (chapoPlan.mode === 'journaliste') {
      chapo = providedChapo(meta);
    } else if (chapoPlan.mode === 'generer') {
      const source = [input.title, input.bodyText, ...Object.values(meta).filter((v): v is string => typeof v === 'string')].join('\n');
      const check = checkGeneratedChapo(fresh.excerpt || '', source, chapoPlan.maxWords);
      if (check.ok) {
        chapo = check.chapo;
        await logInfo('wp-format', `Chapô généré (non fourni par le journaliste) : « ${chapo} »`, ctx);
      } else {
        await logWarn('wp-format', `Chapô généré rejeté (${check.reason}) : article sans chapô`, ctx);
      }
    } else {
      await logInfo('wp-format', strictChapo ? 'Chapô non fourni ; interrupteur « chapô obligatoire » allumé : aucun chapô généré' : 'Chapô non fourni ; agent réglé sur « aucun chapô »', ctx);
    }
    const bodyForWp = input.bodyText;
    payload.excerpt = chapo;
    const links = splitLinks(String(meta.lien || ''), String(meta.lien_achat || ''));
    const kind: PaperKind = /cinema/i.test(input.paperTypeName) ? 'cinema' : /livre/i.test(input.paperTypeName) ? 'livres' : 'musique';
    // Lien interne : le choix explicite de l'IA parmi les candidats, sinon un
    // candidat dont le titre cite l'artiste, sinon la rubrique de l'article
    // (Yoast exige au moins un lien interne). Jamais le premier resultat de
    // recherche par defaut (il est souvent hors sujet).
    const readAlso = await pickInternalLink({
      candidates, aiChoice: fresh.internalLinkUrl, artiste: artisteIn, categories,
    });
    payload.contentHtml = buildArticleHtml({
      chapo, bodyText: bodyForWp, journalistName: input.journalistName,
      videoUrl: links.videoUrl, shopUrl: links.shopUrl,
      shopLabel: links.shopUrl ? outboundLinkLabel(links.shopUrl, kind) : undefined,
      readAlso,
    });
    if (links.shopUrl) await logInfo('wp-format', `Lien sortant : « ${outboundLinkLabel(links.shopUrl, kind)} » → ${links.shopUrl}`, ctx);
    else await logWarn('wp-format', "Aucun lien sortant (site officiel / Bandcamp / editeur) : renseigner « Lien d'achat » sur la livraison pour Yoast", ctx);
    if (readAlso) await logInfo('wp-format', `Lien interne « A lire aussi » : ${readAlso.title}`, ctx);
    else await logWarn('wp-format', 'Aucun lien interne possible (ni article lie, ni rubrique)', ctx);
    await logInfo('wp-format', `Corps = texte livre mot pour mot (${input.bodyText.length} signes), chapo ${chapo ? 'present' : 'absent'}, signature « Par ${input.journalistName} »`, ctx);
    let contentHtml = insertImagesIntoBody(payload.contentHtml, bodyMedia, imageAlt);
    const chronique = isChroniqueType(input.paperTypeName);
    const reviewScore = chronique ? reviewScoreFromMetadata(input.metadata) : null;
    if (chronique) {
      contentHtml = appendReviewRecap(contentHtml);
      await logInfo('wp-format', `Chronique : shortcode review box ajoute (note ${reviewScore ?? 'n/a'}/5 a reporter dans la Reviews Box)`, ctx);
    }

    // 5. Create the draft post — the title carries the review mention so the
    // editorial team spots unreviewed articles at a glance (slug/SEO stay clean)
    //
    // Style Music, Main Music Artist et la Reviews Box sont ecrits apres la
    // creation du brouillon, via le mu-plugin, et seulement s'ils sont vides
    // (ensureEditorialMeta) : les cles reelles sont dans wordpressReviewBox.ts.
    const styleMusicValue = WP_STYLE_MUSIC[payload.styleMusic] || null;
    const extraMeta: Record<string, unknown> = {};

    const authorId = await findWpUserByName(input.journalistName);
    if (authorId) await logInfo('wp-format', `Auteur WordPress trouve pour ${input.journalistName} (#${authorId})`, ctx);

    const post = await createWpDraftPost({
      existingPostId: input.existingPostId,
      contentOnly: input.contentOnly && !!input.existingPostId,
      authorId: authorId ?? undefined,
      title: `${payload.title || input.title} [EN ATTENTE DE RELECTURE]`,
      contentHtml,
      slug: payload.slug,
      excerpt: payload.excerpt,
      categories,
      tagIds,
      featuredMediaId,
      yoast: {
        focusKeyword: payload.focusKeyword,
        seoTitle: payload.seoTitle,
        metaDescription: payload.metaDescription,
      },
      extraMeta,
    });

    // WordPress ignore en silence toute meta non enregistree : on le dit haut et
    // clair au lieu de laisser croire que le champ est rempli.
    if (post.authorRejected) {
      await logWarn('wp-format', `Auteur WordPress non modifie : le compte API n'a pas le droit d'attribuer l'article a ${input.journalistName} (role api_writer sans edit_others_posts). La signature dans le texte fait foi.`, ctx);
    }
    if (post.metaRejected.length > 0) {
      await logWarn(
        'wp-meta',
        `${post.metaRejected.length} champ(s) refuse(s) par WordPress — a saisir a la main`,
        ctx,
        `${post.metaRejected.join(', ')} — refusees par l'API standard ET par le mu-plugin scripts/wp/rs-delivery-rest-meta.php (absent, ou cles hors de ses prefixes autorises).`,
      );
    } else if (payload.focusKeyword && !input.contentOnly) {
      await logInfo('wp-meta', 'Yoast enregistre par WordPress', ctx);
    }

    // Reviews Box (note), Main Artist et Style Music : ecrits s'ils sont vides,
    // y compris sur un renvoi ; une saisie de la redaction est toujours conservee.
    const reviewBox: ReviewBoxInput | null = chronique && reviewScore !== null
      ? { score: reviewScore, kind: kind === 'cinema' ? 'cinema' : 'musique', imageUrl: featuredMediaUrl }
      : null;
    const editorialPresent = await ensureEditorialMeta({
      postId: post.id, reviewBox, ctx,
      mainArtist: kind === 'musique' ? (artisteIn || payload.mainArtist || null) : null,
      styleMusicValue: kind === 'musique' ? styleMusicValue : null,
    });
    if (reviewBox && editorialPresent.reviewBox) {
      await logInfo('wp-meta', `Reviews Box : note ${reviewScore}/5 en place`, ctx);
    }

    // 6. Track on the delivery — wp_payload keeps the editor-only fields
    await saveWpState(input.deliveryId, {
      wp_status: 'sent',
      wp_post_id: post.id,
      wp_post_url: post.editUrl,
      wp_payload: {
        ...payload,
        categories,
        featuredMediaId: featuredMediaId ?? null,
        bodyMediaIds: bodyMedia.map((m) => m.id),
        reviewScore,
        styleMusicValue,
        metaRejected: post.metaRejected,
        editorTodo: buildEditorTodo({
          chronique,
          reviewScore,
          styleMusicValue,
          mainArtist: payload.mainArtist,
          metaRejected: post.metaRejected,
          editorialPresent,
        }),
      },
    });

    await logInfo('wp-success', `Brouillon WordPress ${input.existingPostId ? 'mis a jour' : 'cree'} (#${post.id}) — ${post.editUrl}`, ctx);
    return post;
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.message || String(error);
    console.error('[WordPress] Publish error:', detail);
    await saveWpState(input.deliveryId, { wp_status: 'error' });
    await logError('wp-error', `Echec envoi WordPress: ${detail}`, ctx, error);
    // Alerte les admins par email — ils corrigent puis relancent en un clic
    // (icone globe, onglet Livraisons)
    await notifyWordpressError({
      journalistName: input.journalistName,
      paperType: input.paperTypeName,
      title: input.title,
      hebdoNumber: input.hebdoLabel,
      errorDetail: detail,
    });
    return null;
  }
}

/**
 * Re-send an existing delivery to WordPress (admin action).
 * Image buffers are not stored in the database: they are fetched back from
 * the delivery's Dropbox folder (same names, same order as delivered).
 */
export async function republishDeliveryToWordpress(deliveryId: string) {
  const { data: delivery, error } = await supabaseAdmin
    .from('deliveries')
    .select('*, paper_type:paper_types(name, drive_folder_name, fields_config), hebdo:hebdo_config(label), author:profiles(full_name, email)')
    .eq('id', deliveryId)
    .single();

  if (error || !delivery) {
    throw new Error('Livraison introuvable');
  }

  const journalistName = delivery.author?.full_name || delivery.author?.email || 'Unknown';
  const hebdoLabel = delivery.hebdo?.label || '';
  const ctx: LogContext = {
    journalistName,
    hebdoLabel,
    paperTypeName: delivery.paper_type?.name || 'Papier',
    title: delivery.title,
  };

  let images: ImageFile[] = [];
  try {
    const wanted = String(delivery.image_filename || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    images = await fetchDeliveryImages(
      {
        hebdoNumber: hebdoLabel,
        driveFolderName: delivery.paper_type?.drive_folder_name || delivery.paper_type?.name || 'Papier',
        journalistName,
        // Same fallback as the upload (uploadDelivery receives `subject || title`)
        subject: delivery.subject || delivery.title,
      },
      wanted,
    );
    await logInfo('wp-media', `${images.length} image(s) recuperee(s) depuis Dropbox pour le renvoi`, ctx);
  } catch (err: any) {
    await logWarn('wp-media', `Images Dropbox introuvables pour le renvoi (${err?.message || err}) — envoi sans image`, ctx);
  }

  return publishDeliveryToWordpress({
    deliveryId: delivery.id,
    title: delivery.title,
    paperTypeName: delivery.paper_type?.name || 'Papier',
    journalistName,
    hebdoLabel,
    metadata: delivery.metadata || {},
    bodyText: delivery.body_corrected || delivery.body_original || '',
    images,
    existingPostId: delivery.wp_post_id || undefined,
    previousPayload: (delivery.wp_payload as Partial<WpArticlePayload>) || undefined,
    contentOnly: !!delivery.wp_post_id,
  });
}
