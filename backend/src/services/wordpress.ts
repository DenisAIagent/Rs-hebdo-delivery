/**
 * WordPress REST API client (rollingstone.fr).
 * Server-to-server auth via Application Password (Basic auth) — credentials
 * are stored in app_settings (admin-only) with env vars as fallback.
 */

import axios, { AxiosInstance } from 'axios';
import { supabaseAdmin } from '../utils/supabase';

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

/** Read WP credentials; throws with a clear message when incomplete. */
export async function getWpConfig(): Promise<WpConfig> {
  const [rawUrl, username, appPassword] = await Promise.all([
    getSetting('WORDPRESS_URL'),
    getSetting('WORDPRESS_USERNAME'),
    getSetting('WORDPRESS_APP_PASSWORD'),
  ]);

  if (!rawUrl || !username || !appPassword) {
    throw new Error('Configuration WordPress incomplete (URL, utilisateur ou mot de passe application manquant)');
  }

  const baseUrl = rawUrl.replace(/\/+$/, '');
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error('WORDPRESS_URL invalide (doit commencer par https://)');
  }

  return { baseUrl, username, appPassword };
}

function wpClient(config: WpConfig): AxiosInstance {
  const token = Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
  return axios.create({
    baseURL: `${config.baseUrl}/wp-json/wp/v2`,
    timeout: 30_000,
    headers: { Authorization: `Basic ${token}` },
  });
}

/** Verify credentials: returns the authenticated WP user. */
export async function testWpConnection(): Promise<{ id: number; name: string }> {
  const config = await getWpConfig();
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
  if (dup) return { id: dup.id, url: dup.source_url };

  const { data: media } = await client.post('/media', upload.buffer, {
    headers: {
      'Content-Type': upload.mimetype,
      'Content-Disposition': `attachment; filename="${upload.filename.replace(/"/g, '')}"`,
    },
    maxBodyLength: Infinity,
  });

  if (upload.caption) {
    await client.post(`/media/${media.id}`, { caption: upload.caption });
  }

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
}

/** Create a DRAFT post. Returns the post ID and its edit URL. */
export async function createWpDraftPost(input: WpCreatePostInput): Promise<{ id: number; link: string; editUrl: string }> {
  const config = await getWpConfig();
  const client = wpClient(config);

  const body: Record<string, unknown> = {
    status: 'draft',
    title: input.title,
    content: input.contentHtml,
    slug: input.slug,
    excerpt: input.excerpt,
    categories: input.categories,
    tags: input.tagIds,
  };
  if (input.featuredMediaId) body.featured_media = input.featuredMediaId;

  // Yoast meta does not save reliably via REST; try, and retry without on 400.
  const withYoast = input.yoast
    ? {
        ...body,
        meta: {
          yoast_wpseo_focuskw: input.yoast.focusKeyword,
          yoast_wpseo_title: input.yoast.seoTitle,
          yoast_wpseo_metadesc: input.yoast.metaDescription,
        },
      }
    : body;

  let data: any;
  try {
    ({ data } = await client.post('/posts', withYoast));
  } catch (error: any) {
    if (input.yoast && error?.response?.status === 400) {
      ({ data } = await client.post('/posts', body));
    } else {
      throw error;
    }
  }

  return {
    id: data.id,
    link: data.link,
    editUrl: `${config.baseUrl}/wp-admin/post.php?post=${data.id}&action=edit`,
  };
}
