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
import { getApiKey, getClaudeModel, DEFAULT_CLAUDE_MODEL } from './claude';
import {
  isWordpressEnabled,
  searchWpPosts,
  findOrCreateWpTag,
  uploadWpMedia,
  createWpDraftPost,
  findWpMediaByKeywords,
  getWpMetaMap,
  type WpPostCandidate,
} from './wordpress';
import { buildWpSystemPrompt, normalizeWpCategories, WP_STYLE_MUSIC } from './wordpressRules';
import { fetchDeliveryImages, type ImageFile } from './dropbox';
import { toFeaturedJpeg, toWebJpeg, FEATURED_WIDTH, FEATURED_HEIGHT, BODY_MAX_SIDE } from './imageResize';

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
  metaMap: Partial<Record<'styleMusic' | 'mainArtist' | 'reviewScore', string>>;
}): string[] {
  const todo: string[] = [];
  const refuse = (key?: string) => !key || p.metaRejected.includes(key);

  if (p.metaRejected.some((k) => k.startsWith('_yoast_wpseo_'))) {
    todo.push('Yoast SEO : requete cible, titre SEO et meta description (voyant vert).');
  }
  if (refuse(p.metaMap.styleMusic)) {
    todo.push(
      p.styleMusicValue
        ? `Style Music : selectionner la valeur ${p.styleMusicValue} dans le menu deroulant.`
        : 'Style Music : a choisir dans le menu deroulant.',
    );
  }
  if (refuse(p.metaMap.mainArtist)) {
    todo.push(
      p.mainArtist
        ? `Main Music Artist : saisir "${p.mainArtist}".`
        : 'Main Music Artist : a saisir.',
    );
  }
  if (p.chronique && refuse(p.metaMap.reviewScore)) {
    todo.push(
      `Reviews Box : template Review Chronique ${p.chronique ? 'Music' : ''}, critere "Avis de la redaction", note ${p.reviewScore ?? 'a reporter'}/5, image = image a la une.`.replace(
        /\s+/g,
        ' ',
      ),
    );
  }
  return todo;
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
  contentHtml: string;
  categories: number[];
  tags: string[];
  focusKeyword: string;
  seoTitle: string;
  metaDescription: string;
  mainArtist: string;
  styleMusic: string;
  photoCredit: string;
}

const WP_ARTICLE_TOOL = {
  name: 'submit_wp_article',
  description: 'Renvoie le payload WordPress complet, conforme aux conventions editoriales rollingstone.fr.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: "Titre de l'article." },
      slug: { type: 'string', description: 'Slug court, mots-cles, tirets, sans accents.' },
      excerpt: { type: 'string', description: 'Le chapo en texte brut.' },
      contentHtml: { type: 'string', description: 'HTML complet : H3 chapo, H4 intertitres, <p>, <em>« »</em>.' },
      categories: { type: 'array', items: { type: 'integer' }, description: 'IDs categorie : parent + sous-categorie.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Minimum 5 tags.' },
      focusKeyword: { type: 'string', description: 'Requete cible Yoast (1-2 mots).' },
      seoTitle: { type: 'string', description: 'Titre SEO ~55 caracteres.' },
      metaDescription: { type: 'string', description: 'Meta description ~150 caracteres (max 155).' },
      mainArtist: { type: 'string', description: 'Artiste principal (vide si non musical). Plusieurs : virgules, principal en premier.' },
      styleMusic: { type: 'string', description: 'Style Music exact de la liste autorisee (vide si non musical).' },
      photoCredit: { type: 'string', description: 'Credit photo "© Photographe/Agence" si present dans les donnees, sinon vide.' },
    },
    required: [
      'title', 'slug', 'excerpt', 'contentHtml', 'categories', 'tags',
      'focusKeyword', 'seoTitle', 'metaDescription', 'mainArtist', 'styleMusic', 'photoCredit',
    ],
  },
};

/** Ask Claude to format the paper as a WordPress-ready payload. */
async function formatArticleForWp(
  input: WpPublishInput,
  internalCandidates: WpPostCandidate[],
): Promise<WpArticlePayload> {
  const apiKey = await getApiKey();
  const anthropic = new Anthropic({ apiKey, timeout: 120_000 });
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

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 16384,
        system: buildWpSystemPrompt(),
        tools: [WP_ARTICLE_TOOL],
        tool_choice: { type: 'tool', name: 'submit_wp_article' },
        messages: [{ role: 'user', content: userContent }],
      });

      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (toolUse) return toolUse.input as WpArticlePayload;

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

    // 1. Internal-link candidates from the existing site (subject first, then title)
    const searchQuery = String(
      (input.metadata as any)?.artiste || (input.metadata as any)?.album || input.title,
    );
    let candidates: WpPostCandidate[] = [];
    try {
      candidates = await searchWpPosts(searchQuery);
    } catch {
      await logWarn('wp-links', 'Recherche de liens internes impossible (on continue sans)', ctx);
    }

    // 2. AI formatting per editorial conventions
    const payload = await formatArticleForWp(input, candidates);
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
    const bodyMedia: Array<{ id: number; url: string }> = [];
    const images = input.images || [];
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
        });
        if (index === 0) {
          featuredMediaId = media.id;
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
    let contentHtml = insertImagesIntoBody(payload.contentHtml, bodyMedia, payload.title || input.title);
    const chronique = isChroniqueType(input.paperTypeName);
    const reviewScore = chronique ? reviewScoreFromMetadata(input.metadata) : null;
    if (chronique) {
      contentHtml = appendReviewRecap(contentHtml);
      await logInfo('wp-format', `Chronique : shortcode review box ajoute (note ${reviewScore ?? 'n/a'}/5 a reporter dans la Reviews Box)`, ctx);
    }

    // 5. Create the draft post — the title carries the review mention so the
    // editorial team spots unreviewed articles at a glance (slug/SEO stay clean)
    //
    // Style Music, Main Music Artist et la note Reviewer sont des metas du theme
    // et d'un plugin : leurs cles ne sont pas devinables et ne sont envoyees que
    // si elles ont ete renseignees dans le reglage WP_META_MAP.
    const styleMusicValue = WP_STYLE_MUSIC[payload.styleMusic] || null;
    const metaMap = await getWpMetaMap();
    const extraMeta: Record<string, string | number> = {};
    if (metaMap.styleMusic && styleMusicValue) extraMeta[metaMap.styleMusic] = styleMusicValue;
    if (metaMap.mainArtist && payload.mainArtist) extraMeta[metaMap.mainArtist] = payload.mainArtist;
    if (metaMap.reviewScore && reviewScore !== null) extraMeta[metaMap.reviewScore] = reviewScore;

    const post = await createWpDraftPost({
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
    if (post.metaRejected.length > 0) {
      await logWarn(
        'wp-meta',
        `${post.metaRejected.length} champ(s) refuse(s) par WordPress — a saisir a la main`,
        ctx,
        `${post.metaRejected.join(', ')} — refusees par l'API standard ET par le mu-plugin scripts/wp/rs-delivery-rest-meta.php (absent, ou cles hors de ses prefixes autorises : _yoast_wpseo_, rwp_, sm_, _sm_, mat_, _mat_).`,
      );
    } else if (Object.keys(extraMeta).length > 0 || payload.focusKeyword) {
      await logInfo('wp-meta', 'Yoast et metaboxes enregistres par WordPress', ctx);
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
          metaMap,
        }),
      },
    });

    await logInfo('wp-success', `Brouillon WordPress cree (#${post.id}) — ${post.editUrl}`, ctx);
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
  });
}
