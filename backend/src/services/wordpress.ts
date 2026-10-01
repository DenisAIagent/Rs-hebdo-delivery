/**
 * WordPress REST API client (rollingstone.fr).
 * Server-to-server auth via Application Password (Basic auth) — credentials
 * are stored in app_settings (admin-only) with env vars as fallback.
 */

import axios, { AxiosInstance } from 'axios';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { supabaseAdmin } from '../utils/supabase';

/** Adresse IP privée / loopback / lien-local (cibles SSRF internes). */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return (
      p[0] === 10 ||
      p[0] === 127 ||
      p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168)
    );
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') ||
    v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

/**
 * Valide une URL WordPress avant tout appel serveur : HTTPS obligatoire et
 * hôte résolvant vers une IP publique (anti-SSRF vers les services internes /
 * métadonnées cloud). En dev on tolère http://localhost pour les tests.
 */
async function assertSafeWpUrl(rawUrl: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('WORDPRESS_URL invalide');
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalDev = isDev && u.hostname === 'localhost';

  if (u.protocol !== 'https:' && !isLocalDev) {
    throw new Error('WORDPRESS_URL doit utiliser HTTPS');
  }

  if (!isLocalDev) {
    let address: string;
    try {
      ({ address } = await lookup(u.hostname));
    } catch {
      throw new Error('Hôte WordPress introuvable (DNS)');
    }
    if (isPrivateIp(address)) {
      throw new Error('Hôte WordPress non autorisé (adresse réseau interne)');
    }
  }

  return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
}

export interface WpConfig {
  baseUrl: string;
  username: string;
  appPassword: string;
}

async function getSetting(key: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    const dbValue = data?.value?.trim();
    if (dbValue) return dbValue;
  } catch {
    // fall through to env
  }
  return process.env[key]?.trim() || '';
}

/** True when the module is switched on by an admin. */
export async function isWordpressEnabled(): Promise<boolean> {
  const v = await getSetting('WORDPRESS_ENABLED');
  return v === 'true' || v === '1';
}

/** Values typed in the admin form but not yet saved (used by the connection test). */
export interface WpConfigOverride {
  url?: string;
  username?: string;
  appPassword?: string;
}

/**
 * Read WP credentials; throws with a clear message when incomplete.
 * `override` (form values) takes precedence over stored settings so the
 * admin can test before saving; an empty override password falls back to
 * the stored one.
 */
export async function getWpConfig(override: WpConfigOverride = {}): Promise<WpConfig> {
  const [storedUrl, storedUser, storedPass] = await Promise.all([
    getSetting('WORDPRESS_URL'),
    getSetting('WORDPRESS_USERNAME'),
    getSetting('WORDPRESS_APP_PASSWORD'),
  ]);
  const rawUrl = override.url?.trim() || storedUrl;
  const username = override.username?.trim() || storedUser;
  const appPassword = override.appPassword?.trim() || storedPass;

  if (!rawUrl || !username || !appPassword) {
    throw new Error('Configuration WordPress incomplete (URL, utilisateur ou mot de passe application manquant)');
  }

  const baseUrl = await assertSafeWpUrl(rawUrl);
  return { baseUrl, username, appPassword };
}

function wpClient(config: WpConfig): AxiosInstance {
  const token = Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
  const client = axios.create({
    baseURL: `${config.baseUrl}/wp-json/wp/v2`,
    timeout: 30_000,
    headers: { Authorization: `Basic ${token}` },
  });

  // La requete part TOUJOURS avec le header Authorization (publication inchangee).
  // Mais axios rattache ce header a l'objet d'erreur (error.config.headers) : on
  // l'efface avant que l'erreur ne remonte, pour qu'aucun console.error/logger en
  // aval ne puisse imprimer le mot de passe applicatif WordPress dans les logs.
  client.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error?.config?.headers) {
        delete error.config.headers.Authorization;
        delete error.config.headers.authorization;
      }
      if (error?.request?._header) delete error.request._header; // header brut bas niveau
      return Promise.reject(error);
    }
  );
  return client;
}

/** Verify credentials: returns the authenticated WP user. */
export async function testWpConnection(override: WpConfigOverride = {}): Promise<{ id: number; name: string }> {
  const config = await getWpConfig(override);
  const client = wpClient(config);
  const { data } = await client.get('/users/me', { params: { context: 'edit' } });
  return { id: data.id, name: data.name };
}

export interface WpPostCandidate {
  id: number;
  link: string;
  title: string;
}

/** Search published posts (internal-link candidates for the AI). */
export async function searchWpPosts(query: string, perPage = 5): Promise<WpPostCandidate[]> {
  if (!query.trim()) return [];
  const config = await getWpConfig();
  const client = wpClient(config);
  const { data } = await client.get('/posts', {
    params: { search: query, per_page: perPage, _fields: 'id,link,title' },
  });
  return (data || []).map((p: any) => ({
    id: p.id,
    link: p.link,
    title: p.title?.rendered || '',
  }));
}

export interface WpMediaHit { id: number; url: string; title: string; altText: string }

/**
 * Look for an existing image in the media library (chroniques rarely come
 * with a photo: the cover or an artist picture is often already on the site).
 * Queries are tried in order; the first image hit wins.
 */
export async function findWpMediaByKeywords(queries: string[]): Promise<WpMediaHit | null> {
  const config = await getWpConfig();
  const client = wpClient(config);
  for (const raw of queries) {
    const q = raw.replace(/\s+/g, ' ').trim();
    if (q.length < 3) continue;
    const { data } = await client.get('/media', {
      params: { search: q, media_type: 'image', per_page: 10, orderby: 'date', order: 'desc', _fields: 'id,source_url,title,mime_type,alt_text' },
    });
    const hit = (data || []).find((m: any) => String(m.mime_type || '').startsWith('image/'));
    if (hit) return { id: hit.id, url: hit.source_url, title: hit.title?.rendered || '', altText: String(hit.alt_text || '') };
  }
  return null;
}

/** Find a tag by exact name (case-insensitive) or create it. Returns the tag ID. */
export async function findOrCreateWpTag(name: string): Promise<number> {
  const config = await getWpConfig();
  const client = wpClient(config);
  const clean = name.trim();

  const { data: found } = await client.get('/tags', {
    params: { search: clean, per_page: 20, _fields: 'id,name' },
  });
  const match = (found || []).find(
    (t: any) => (t.name || '').toLowerCase() === clean.toLowerCase(),
  );
  if (match) return match.id;

  try {
    const { data: created } = await client.post('/tags', { name: clean });
    return created.id;
  } catch (error: any) {
    // Race / normalization: WP returns the existing term id on term_exists
    const existingId = error?.response?.data?.data?.term_id;
    if (error?.response?.data?.code === 'term_exists' && existingId) {
      return existingId;
    }
    throw error;
  }
}

export interface WpMediaUpload {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  /** Photo credit, e.g. "© Santiago Felipe/Getty Images" — set as media caption. */
  caption?: string;
  /** Texte alternatif (Yoast signale une image a la une sans alt). */
  altText?: string;
}

/** Met a jour legende et texte alternatif d'un media existant. */
export async function setWpMediaMeta(mediaId: number, meta: { caption?: string; altText?: string }): Promise<void> {
  const body: Record<string, string> = {};
  if (meta.caption) body.caption = meta.caption;
  if (meta.altText) body.alt_text = meta.altText;
  if (Object.keys(body).length === 0) return;
  const config = await getWpConfig();
  await wpClient(config).post(`/media/${mediaId}`, body);
}

export interface WpCategoryInfo { id: number; name: string; link: string }

/** Nom et URL publique d'une categorie (lien interne de repli). */
export async function getWpCategory(id: number): Promise<WpCategoryInfo | null> {
  const config = await getWpConfig();
  const { data } = await wpClient(config).get(`/categories/${id}`, { params: { _fields: 'id,name,link' } });
  if (!data?.link) return null;
  return { id: data.id, name: String(data.name || ''), link: String(data.link) };
}

/**
 * Upload an image to the WP media library, with deduplication:
 * if a media with the exact same filename already exists, reuse its ID.
 */
export async function uploadWpMedia(upload: WpMediaUpload): Promise<{ id: number; url: string }> {
  const config = await getWpConfig();
  const client = wpClient(config);

  const baseName = upload.filename.replace(/\.[^.]+$/, '');
  const { data: existing } = await client.get('/media', {
    params: { search: baseName, per_page: 50, _fields: 'id,source_url' },
  });
  const dup = (existing || []).find((m: any) => {
    const remote = decodeURIComponent((m.source_url || '').split('/').pop() || '');
    // WP may append -1, -scaled... — match on the exact name or name + suffix
    return remote === upload.filename || remote.startsWith(`${baseName}-`) || remote.startsWith(`${baseName}.`);
  });
  if (dup) {
    // Media deja en ligne (renvoi) : on complete quand meme alt et legende.
    await setWpMediaMeta(dup.id, { caption: upload.caption, altText: upload.altText }).catch(() => undefined);
    return { id: dup.id, url: dup.source_url };
  }

  const { data: media } = await client.post('/media', upload.buffer, {
    headers: {
      'Content-Type': upload.mimetype,
      'Content-Disposition': `attachment; filename="${upload.filename.replace(/"/g, '')}"`,
    },
    maxBodyLength: Infinity,
    // Media uploads are the only large requests: WordPress also generates
    // the intermediate sizes server-side, which takes well over 30 s.
    timeout: 180_000,
  });

  await setWpMediaMeta(media.id, { caption: upload.caption, altText: upload.altText });

  return { id: media.id, url: media.source_url };
}

export interface WpCreatePostInput {
  title: string;
  contentHtml: string;
  slug: string;
  excerpt: string;
  categories: number[];
  tagIds: number[];
  featuredMediaId?: number;
  /** Yoast fields — best effort via REST meta (finished by hand in the editor). */
  yoast?: { focusKeyword: string; seoTitle: string; metaDescription: string };
  /**
   * Metas du theme et des plugins (Style Music, Main Music Artist, Reviewer).
   * Les cles reelles ne sont pas devinables : elles se decouvrent sur le site
   * puis se declarent dans le reglage WP_META_MAP (voir getWpExtraMeta).
   * Tant que le reglage est vide, cet objet l'est aussi et rien n'est envoye.
   */
  extraMeta?: Record<string, string | number>;
  /** Brouillon existant a mettre a jour (renvoi depuis l'admin) au lieu d'en creer un nouveau. */
  existingPostId?: number;
  /** Utilisateur WordPress a mettre en auteur (si trouve). */
  authorId?: number;
  /**
   * Renvoi « contenu seul » : ne met a jour que le corps, l'extrait et l'auteur.
   * Titre, slug, categories, tags, Yoast et metaboxes du brouillon existant sont
   * laisses intacts (consigne redaction du 01/10/2026).
   */
  contentOnly?: boolean;
}

export interface WpCreatePostResult {
  id: number;
  link: string;
  editUrl: string;
  /**
   * Cles de meta refusees par WordPress (article cree quand meme, sans elles).
   * Vide = tout est passe. Permet a l'appelant de dire la verite sur ce qui
   * reste a saisir a la main, au lieu d'echouer en silence.
   */
  metaRejected: string[];
  /** Auteur demande mais refuse par WordPress (droits du compte API). */
  authorRejected?: boolean;
}

/**
 * Cherche l'utilisateur WordPress correspondant a un journaliste (par nom).
 * Renvoie null si introuvable ou si le compte API n'a pas le droit de lister
 * les utilisateurs : l'article reste alors attribue au compte rs_delivery et
 * la signature en fin d'article fait foi.
 */
export async function findWpUserByName(fullName: string): Promise<number | null> {
  const name = fullName.trim();
  if (!name) return null;
  try {
    const config = await getWpConfig();
    const client = wpClient(config);
    const { data } = await client.get('/users', { params: { search: name, per_page: 5, context: 'view' } });
    const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    const hit = (data as Array<{ id: number; name: string; slug: string }>).find(
      (u) => norm(u.name) === norm(name) || norm(u.slug) === norm(name).replace(/ /g, '-'),
    );
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

/** Create (or update) a DRAFT post. Returns the post ID and its edit URL. */
export async function createWpDraftPost(input: WpCreatePostInput): Promise<WpCreatePostResult> {
  const config = await getWpConfig();
  const client = wpClient(config);

  const body: Record<string, unknown> = input.contentOnly
    ? { content: input.contentHtml, excerpt: input.excerpt }
    : {
        status: 'draft',
        title: input.title,
        content: input.contentHtml,
        slug: input.slug,
        excerpt: input.excerpt,
        categories: input.categories,
        tags: input.tagIds,
      };
  if (input.featuredMediaId && !input.contentOnly) body.featured_media = input.featuredMediaId;
  if (input.authorId) body.author = input.authorId;
  // POST /posts/{id} met a jour un article existant (meme contrat que la creation).
  const endpoint = input.existingPostId ? `/posts/${input.existingPostId}` : '/posts';

  // Yoast et les metaboxes du theme stockent des metas protegees. WordPress ne
  // les accepte via REST que si le site les enregistre avec show_in_rest (voir
  // scripts/wp/rs-delivery-rest-meta.php) ; sinon il les ignore ou les rejette.
  // On les envoie quand meme, et on REMONTE le refus au lieu de le masquer.
  const meta: Record<string, string | number> = {};
  if (input.yoast && !input.contentOnly) {
    meta._yoast_wpseo_focuskw = input.yoast.focusKeyword;
    meta._yoast_wpseo_title = input.yoast.seoTitle;
    meta._yoast_wpseo_metadesc = input.yoast.metaDescription;
  }
  for (const [key, value] of Object.entries(input.contentOnly ? {} : input.extraMeta || {})) {
    if (value !== '' && value !== null && value !== undefined) meta[key] = value;
  }

  const metaKeys = Object.keys(meta);
  const withMeta = metaKeys.length > 0 ? { ...body, meta } : body;

  let data: any;
  let metaRejected: string[] = [];
  let authorRejected = false;
  const send = async (payload: Record<string, unknown>) => {
    try {
      return (await client.post(endpoint, payload)).data;
    } catch (error: any) {
      // 401/403 avec un auteur impose : le compte API (api_writer) n'a pas
      // edit_others_posts. On garde l'article, sans changer l'auteur (la
      // signature « Par Nom » dans le corps fait foi).
      if (payload.author && [401, 403].includes(error?.response?.status)) {
        authorRejected = true;
        const { author: _a, ...rest } = payload;
        return (await client.post(endpoint, rest)).data;
      }
      throw error;
    }
  };
  try {
    data = await send(withMeta);
  } catch (error: any) {
    // 400 = au moins une cle de meta n'est pas enregistree cote WordPress.
    // L'article doit tout de meme partir, mais l'appelant doit le savoir.
    if (metaKeys.length > 0 && error?.response?.status === 400) {
      metaRejected = metaKeys;
      data = await send(body);
    } else {
      throw error;
    }
  }
  if (authorRejected) {
    console.warn(`[wordpress] auteur #${input.authorId} refuse par WordPress (droits du compte API) — article ${data?.id} laisse a ${config.username}`);
  }

  // WordPress peut aussi accepter la requete en ignorant SILENCIEUSEMENT les
  // metas non enregistrees (cas le plus frequent). On relit ce qu'il a garde.
  if (metaRejected.length === 0 && metaKeys.length > 0) {
    const saved = (data?.meta || {}) as Record<string, unknown>;
    metaRejected = metaKeys.filter((k) => {
      const v = saved[k];
      return v === undefined || v === '' || v === null;
    });
  }

  // Secours : les metas refusees par l'API standard sont retentees via le
  // mu-plugin (POST /wp-json/rs-delivery/v1/post-meta/{id}), qui ecrit les cles
  // Yoast, Reviewer (rwp_), Style Music (sm_/_sm_) et Main Artist (mat_/_mat_).
  // Sans mu-plugin (404) ou si la cle n'est pas dans ses prefixes, le refus reste.
  if (metaRejected.length > 0) {
    const retry: Record<string, string | number> = {};
    for (const k of metaRejected) retry[k] = meta[k];
    const written = await writeWpMetaViaMuPlugin(client, config, data.id, retry);
    metaRejected = metaRejected.filter((k) => !written.includes(k));
  }

  return {
    id: data.id,
    link: data.link,
    editUrl: `${config.baseUrl}/wp-admin/post.php?post=${data.id}&action=edit`,
    metaRejected,
    authorRejected,
  };
}

/**
 * Lit toutes les metas et termes d'un article via le mu-plugin (diagnostic,
 * lecture seule) : sert a decouvrir les cles reelles de Reviewer, Style Music
 * et Main Music Artist sur un article de reference renseigne a la main.
 */
export async function readWpPostMeta(postId: number): Promise<unknown> {
  const config = await getWpConfig();
  const client = wpClient(config);
  const { data } = await client.get(`${config.baseUrl}/wp-json/rs-delivery/v1/post-meta/${postId}`);
  return data;
}

/**
 * Ecrit des metas arbitraires (prefixes autorises par le mu-plugin) sur un
 * article existant. Renvoie les cles effectivement ecrites.
 */
export async function writeWpPostMeta(postId: number, meta: Record<string, string | number>): Promise<string[]> {
  const config = await getWpConfig();
  return writeWpMetaViaMuPlugin(wpClient(config), config, postId, meta);
}

/**
 * Ecrit des metas via le mu-plugin scripts/wp/rs-delivery-rest-meta.php.
 * Renvoie la liste des cles effectivement ecrites ; [] si le plugin est absent
 * (404), refuse la cle, ou repond en erreur. Ne jette jamais : l'article est deja
 * cree, l'appelant doit seulement savoir ce qui reste a saisir a la main.
 */
async function writeWpMetaViaMuPlugin(
  client: AxiosInstance,
  config: WpConfig,
  postId: number,
  meta: Record<string, string | number>,
): Promise<string[]> {
  if (Object.keys(meta).length === 0) return [];
  try {
    // URL absolue : axios ignore alors le baseURL (/wp-json/wp/v2) du client.
    const { data } = await client.post(
      `${config.baseUrl}/wp-json/rs-delivery/v1/post-meta/${postId}`,
      { meta },
    );
    const written = (data?.written || {}) as Record<string, unknown>;
    return Object.keys(written);
  } catch (error: any) {
    const status = error?.response?.status;
    if (status !== 404) {
      console.warn(`[wordpress] mu-plugin post-meta ${postId} -> HTTP ${status ?? 'n/a'}`);
    }
    return [];
  }
}

/**
 * Cles de meta du theme / des plugins, lues dans le reglage WP_META_MAP.
 *
 * Format attendu (JSON) : {"styleMusic":"<cle>","mainArtist":"<cle>","reviewScore":"<cle>"}
 * Tant que le reglage est vide ou incomplet, les champs concernes ne sont pas
 * envoyes — on ne devine JAMAIS un nom de cle. Elles se decouvrent sur le site
 * via GET /wp-json/rs-delivery/v1/post-meta/{id} (mu-plugin), puis se saisissent
 * dans l'admin, sans redeploiement.
 */
export async function getWpMetaMap(): Promise<Partial<Record<'styleMusic' | 'mainArtist' | 'reviewScore', string>>> {
  const raw = await getSetting('WP_META_MAP');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}
