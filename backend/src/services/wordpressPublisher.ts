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
import { getApiKey, getClaudeModel, DEFAULT_CLAUDE_MODEL } from './claude';
import {
  isWordpressEnabled,
  searchWpPosts,
  findOrCreateWpTag,
  uploadWpMedia,
  createWpDraftPost,
  type WpPostCandidate,
} from './wordpress';
import { buildWpSystemPrompt, normalizeWpCategories, WP_STYLE_MUSIC } from './wordpressRules';

export interface WpPublishInput {
  deliveryId: string;
  title: string;
  paperTypeName: string;
  journalistName: string;
  hebdoLabel: string;
  metadata: Record<string, unknown>;
  bodyText: string;
  firstImage?: { buffer: Buffer; originalname: string; mimetype: string };
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

    // 4. Featured image (dedup by filename, credit as caption — never in the body)
    let featuredMediaId: number | undefined;
    if (input.firstImage) {
      try {
        const media = await uploadWpMedia({
          buffer: input.firstImage.buffer,
          filename: input.firstImage.originalname,
          mimetype: input.firstImage.mimetype,
          caption: payload.photoCredit || undefined,
        });
        featuredMediaId = media.id;
        await logInfo('wp-media', `Image a la une prete (media #${media.id})`, ctx);
      } catch (err) {
        await logWarn('wp-media', 'Upload image WordPress echoue — article envoye sans image', ctx);
      }
    }

    // 5. Create the draft post — the title carries the review mention so the
    // editorial team spots unreviewed articles at a glance (slug/SEO stay clean)
    const post = await createWpDraftPost({
      title: `${payload.title || input.title} [EN ATTENTE DE RELECTURE]`,
      contentHtml: payload.contentHtml,
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
    });

    // 6. Track on the delivery — wp_payload keeps the editor-only fields
    await saveWpState(input.deliveryId, {
      wp_status: 'sent',
      wp_post_id: post.id,
      wp_post_url: post.editUrl,
      wp_payload: {
        ...payload,
        categories,
        styleMusicValue: WP_STYLE_MUSIC[payload.styleMusic] || null,
        editorTodo: 'A finir dans l\'editeur classique : Yoast (focuskw/titre/meta), Style Music, Main Music Artist.',
      },
    });

    await logInfo('wp-success', `Brouillon WordPress cree (#${post.id}) — ${post.editUrl}`, ctx);
    return post;
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.message || String(error);
    console.error('[WordPress] Publish error:', detail);
    await saveWpState(input.deliveryId, { wp_status: 'error' });
    await logError('wp-error', `Echec envoi WordPress: ${detail}`, ctx, error);
    return null;
  }
}

/**
 * Re-send an existing delivery to WordPress (admin action).
 * Images are not re-sent (buffers are not stored) — the featured image is
 * reused via media-library deduplication only when it already exists.
 */
export async function republishDeliveryToWordpress(deliveryId: string) {
  const { data: delivery, error } = await supabaseAdmin
    .from('deliveries')
    .select('*, paper_type:paper_types(name, fields_config), hebdo:hebdo_config(label), author:profiles(full_name, email)')
    .eq('id', deliveryId)
    .single();

  if (error || !delivery) {
    throw new Error('Livraison introuvable');
  }

  return publishDeliveryToWordpress({
    deliveryId: delivery.id,
    title: delivery.title,
    paperTypeName: delivery.paper_type?.name || 'Papier',
    journalistName: delivery.author?.full_name || delivery.author?.email || 'Unknown',
    hebdoLabel: delivery.hebdo?.label || '',
    metadata: delivery.metadata || {},
    bodyText: delivery.body_corrected || delivery.body_original || '',
  });
}
