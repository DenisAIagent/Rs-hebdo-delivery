/**
 * Dropbox storage service — replaces Google Drive.
 * Uses the Dropbox HTTP API v2 with a long-lived refresh token.
 *
 * Required env vars:
 *   DROPBOX_APP_KEY
 *   DROPBOX_APP_SECRET
 *   DROPBOX_REFRESH_TOKEN
 *   DROPBOX_ROOT_FOLDER  (e.g. "/Hebdo Delivery")
 */

import axios from 'axios';

// ── Token management ────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;
let refreshPromise: Promise<string> | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  // Avoid concurrent refresh calls — reuse in-flight promise
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefreshToken().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function doRefreshToken(): Promise<string> {

  const key = process.env.DROPBOX_APP_KEY!;
  const secret = process.env.DROPBOX_APP_SECRET!;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN!;

  try {
    const res = await axios.post(
      'https://api.dropboxapi.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        auth: { username: key, password: secret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    cachedToken = res.data.access_token;
    // Expire 5 min before actual expiry to be safe
    tokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
    console.log(`[Dropbox] Token refreshed, expires in ${res.data.expires_in}s`);
    return cachedToken!;
  } catch (err: any) {
    console.error('[Dropbox] Token refresh FAILED:', err?.response?.data || err.message);
    throw err;
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function rootFolder(): string {
  return process.env.DROPBOX_ROOT_FOLDER || '/Hebdo Delivery';
}

/** Sleep helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry wrapper — retries on 429 (rate limit) and 401 (expired token) */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 && attempt < maxRetries) {
        // Token expired mid-session — force refresh and retry
        const url = err?.config?.url || 'unknown';
        const apiArg = err?.config?.headers?.['Dropbox-API-Arg'] || '';
        console.log(`[Dropbox] 401 on ${url} — forcing token refresh (attempt ${attempt + 1}/${maxRetries})`);
        console.log(`[Dropbox] 401 detail:`, JSON.stringify(err?.response?.data), `arg: ${apiArg.substring(0, 200)}`);
        cachedToken = null;
        tokenExpiry = 0;
        continue;
      }
      if (status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(err?.response?.headers?.['retry-after'] || '1', 10);
        const waitMs = Math.max(retryAfter, 1) * 1000 + attempt * 500;
        console.log(`[Dropbox] Rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error('withRetry: unreachable');
}

/** Create a folder (ignores "conflict" = folder already exists) */
async function ensureFolder(path: string): Promise<void> {
  await withRetry(async () => {
    const token = await getAccessToken();
    try {
      await axios.post(
        'https://api.dropboxapi.com/2/files/create_folder_v2',
        { path, autorename: false },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      // 409 conflict with "path/conflict/folder" means folder already exists — that's fine
      const tag = err?.response?.data?.error?.path?.['.tag'];
      if (tag === 'conflict') return;
      throw err;
    }
  });
}

/** Escape non-ASCII chars for Dropbox-API-Arg header (required by Dropbox) */
function escapeNonAscii(str: string): string {
  return str.replace(/[^\x20-\x7E]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return '\\u' + code.toString(16).padStart(4, '0');
  });
}

/** Upload a file (overwrite if exists) */
async function uploadFile(
  path: string,
  content: Buffer,
): Promise<void> {
  await withRetry(async () => {
    const token = await getAccessToken();
    const apiArg = escapeNonAscii(JSON.stringify({
      path,
      mode: 'overwrite',
      autorename: false,
      mute: false,
    }));
    await axios.post(
      'https://content.dropboxapi.com/2/files/upload',
      content,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': apiArg,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
  });
}

/** Create a shared link for a folder (return existing one if any) */
async function getOrCreateSharedLink(path: string): Promise<string> {
  return withRetry(async () => {
    const token = await getAccessToken();
    try {
      const res = await axios.post(
        'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
        { path },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      return res.data.url;
    } catch (err: any) {
      const tag = err?.response?.data?.error?.['.tag'];
      // If link already exists, fetch it
      if (tag === 'shared_link_already_exists') {
        const listRes = await axios.post(
          'https://api.dropboxapi.com/2/sharing/list_shared_links',
          { path, direct_only: true },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        if (listRes.data.links?.length > 0) {
          return listRes.data.links[0].url;
        }
      }
      // Log the actual Dropbox error for debugging
      console.error(`[Dropbox] Shared link error for ${path}:`, err?.response?.data || err.message);
      throw err;
    }
  });
}

/** Sanitize a user-supplied string before using it in a Dropbox path */
function sanitizePathComponent(name: string): string {
  return name
    .replace(/\.\./g, '')              // Remove parent directory traversal
    .replace(/[\/\\]/g, '-')           // Replace path separators
    .replace(/[<>:"|?*\x00-\x1F]/g, '') // Remove illegal filename chars
    .trim()
    .slice(0, 200);                    // Limit length
}

// ── Public API ─────────────────────────────────────────────────

export async function ensureHebdoFolderStructure(
  hebdoLabel: string,
  paperTypes: { drive_folder_name: string }[]
): Promise<{ hebdoFolderId: string; hebdoFolderUrl: string }> {
  const root = rootFolder();
  const hebdoPath = `${root}/${hebdoLabel}`;

  // Create root + hebdo folder
  await ensureFolder(root);
  await ensureFolder(hebdoPath);

  // Create type subfolders sequentially to avoid Dropbox rate limits
  for (const pt of paperTypes) {
    await ensureFolder(`${hebdoPath}/${pt.drive_folder_name}`);
  }

  // Get shared link for the hebdo folder
  const hebdoFolderUrl = await getOrCreateSharedLink(hebdoPath);

  console.log(`[Dropbox] Folder structure created for ${hebdoLabel}: ${paperTypes.length} subfolders`);

  return { hebdoFolderId: hebdoPath, hebdoFolderUrl };
}

export interface ImageFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface UploadDeliveryParams {
  hebdoNumber: string;        // e.g. "RSH225"
  driveFolderName: string;    // e.g. "Chronique cinema" (from paper_type config)
  journalistName: string;     // e.g. "Xavier Bonnet"
  subject?: string;           // e.g. "Bukowski" (for Interview type)
  docxBuffer: Buffer;
  docxFileName: string;
  images: ImageFile[];        // all images to upload
}

export interface DeliveryFolderParams {
  hebdoNumber: string;        // e.g. "RSH225"
  driveFolderName: string;    // e.g. "Chronique cinema" (from paper_type config)
  journalistName: string;     // e.g. "Xavier Bonnet"
  subject?: string;           // e.g. "Bukowski" (for Interview type)
}

/**
 * Deterministic Dropbox folder of a delivery (same rules as the upload), so
 * files can be found again later (e.g. WordPress re-send from the admin).
 */
export function resolveDeliveryFolderPaths(params: DeliveryFolderParams): {
  root: string; hebdoPath: string; typePath: string; targetPath: string;
} {
  const root = rootFolder();
  const safeHebdo = sanitizePathComponent(params.hebdoNumber);
  const hebdoPath = `${root}/${safeHebdo}`;

  // Le dossier du format est toujours celui pre-cree par
  // ensureHebdoFolderStructure : un papier reste DANS le dossier de son type.
  const folder = params.driveFolderName.toLowerCase();
  const typePath = `${hebdoPath}/${sanitizePathComponent(params.driveFolderName)}`;

  // Sous-dossier a l'interieur du dossier du format :
  //  - interviews : un dossier par sujet (plusieurs interviews par numero) ;
  //  - toutes les chroniques (musique, cinema, coup de coeur, disque de la
  //    semaine, frenchie), livres et expo : un dossier par journaliste, pour ne
  //    pas melanger les textes et les pochettes de plusieurs auteurs
  //    (consigne redaction du 02/10/2026).
  let targetPath = typePath;
  if (folder.startsWith('interview') && params.subject) {
    targetPath = `${typePath}/${sanitizePathComponent(`Interview ${params.subject}`)}`;
  } else if (params.journalistName && hasJournalistSubfolder(folder)) {
    targetPath = `${typePath}/${sanitizePathComponent(params.journalistName)}`;
  }

  return { root, hebdoPath, typePath, targetPath };
}

/** Formats ranges par journaliste (nom de dossier du type, en minuscules). */
export function hasJournalistSubfolder(folderLower: string): boolean {
  return ['chronique', 'livres et expo', 'disque de la semaine', 'frenchie'].some((t) => folderLower.includes(t));
}

/** Download a file's bytes from Dropbox. */
async function downloadFile(path: string): Promise<Buffer> {
  return withRetry(async () => {
    const token = await getAccessToken();
    const res = await axios.post(
      'https://content.dropboxapi.com/2/files/download',
      null,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Dropbox-API-Arg': escapeNonAscii(JSON.stringify({ path })),
        },
        responseType: 'arraybuffer',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    return Buffer.from(res.data);
  });
}

/** List files (not folders) directly inside a Dropbox folder. */
async function listFolderFiles(path: string): Promise<Array<{ name: string; path_lower: string }>> {
  return withRetry(async () => {
    const token = await getAccessToken();
    const res = await axios.post(
      'https://api.dropboxapi.com/2/files/list_folder',
      { path, recursive: false, limit: 500 },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return (res.data?.entries || [])
      .filter((e: any) => e['.tag'] === 'file')
      .map((e: any) => ({ name: String(e.name), path_lower: String(e.path_lower) }));
  });
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic', bmp: 'image/bmp',
};

function mimeFromFilename(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_MIME_BY_EXT[ext] || null;
}

/**
 * Re-fetch the images of an already-delivered paper from its Dropbox folder.
 * `wantedNames` (the names saved on the delivery row) preserves the original
 * order (first image = featured); when empty, every image in the folder is returned.
 */
export async function fetchDeliveryImages(
  params: DeliveryFolderParams,
  wantedNames: string[] = [],
): Promise<ImageFile[]> {
  const { targetPath, typePath } = resolveDeliveryFolderPaths(params);
  let files = await listFolderFiles(targetPath).catch(() => [] as Array<{ name: string; path_lower: string }>);
  if (files.length === 0 && targetPath !== typePath) {
    // Livraisons anterieures au 02/10/2026 : les chroniques etaient deposees
    // directement dans le dossier du type, sans sous-dossier journaliste.
    files = await listFolderFiles(typePath);
  }
  const imagesInFolder = files.filter((f) => mimeFromFilename(f.name));

  const ordered = wantedNames.length > 0
    ? wantedNames
        .map((n) => sanitizePathComponent(n.trim()).toLowerCase())
        .map((safe) => imagesInFolder.find((f) => f.name.toLowerCase() === safe))
        .filter((f): f is { name: string; path_lower: string } => Boolean(f))
    : imagesInFolder;

  const result: ImageFile[] = [];
  for (const f of ordered) {
    const buffer = await downloadFile(f.path_lower);
    result.push({ buffer, originalname: f.name, mimetype: mimeFromFilename(f.name)! });
  }
  return result;
}

/** Move a folder (Dropbox move_v2). Returns false when the source is missing. */
async function moveFolder(fromPath: string, toPath: string): Promise<boolean> {
  try {
    return await withRetry(async () => {
      const token = await getAccessToken();
      await axios.post(
        'https://api.dropboxapi.com/2/files/move_v2',
        { from_path: fromPath, to_path: toPath, autorename: true },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      return true;
    });
  } catch (err: any) {
    const summary = err?.response?.data?.error_summary || '';
    if (/not_found|from_lookup/.test(summary)) return false;
    throw err;
  }
}

export interface ReattributeDeliveryParams {
  /** Folder as it exists today (previous journalist). */
  previous: DeliveryFolderParams;
  /** Folder for the new journalist (may resolve to the same path). */
  next: DeliveryFolderParams;
  docxFileName: string;
  /** Regenerated DOCX (same content, new author). */
  docxBuffer: Buffer;
}

/**
 * Re-attribution of a delivery: replace the DOCX with the version carrying the
 * new journalist name and, when the folder layout depends on the journalist
 * (chroniques musique / cinema, livres et expo), move the whole folder so the
 * images stay with their DOCX. Nothing is ever deleted: the DOCX is overwritten
 * in place, so the paper itself cannot be lost.
 */
export async function reattributeDelivery(params: ReattributeDeliveryParams): Promise<{
  folderUrl: string;
  docxUrl: string;
  moved: boolean;
}> {
  const from = resolveDeliveryFolderPaths(params.previous);
  const to = resolveDeliveryFolderPaths(params.next);

  let targetPath = from.targetPath;
  let moved = false;
  if (to.targetPath !== from.targetPath) {
    await ensureFolder(to.root);
    await ensureFolder(to.hebdoPath);
    await ensureFolder(to.typePath);
    moved = await moveFolder(from.targetPath, to.targetPath);
    targetPath = moved ? to.targetPath : from.targetPath;
  }
  // The folder may not exist yet (delivery created before this feature, or move
  // skipped): ensure it so the DOCX upload always lands somewhere valid.
  await ensureFolder(targetPath);

  const docxPath = `${targetPath}/${sanitizePathComponent(params.docxFileName)}`;
  await uploadFile(docxPath, params.docxBuffer);

  const [folderUrl, docxUrl] = await Promise.all([
    getOrCreateSharedLink(targetPath),
    getOrCreateSharedLink(docxPath),
  ]);

  console.log(`[Dropbox] Delivery re-attributed -> ${targetPath} (moved=${moved})`);
  return { folderUrl, docxUrl, moved };
}

export async function uploadDelivery(params: UploadDeliveryParams): Promise<{
  folderUrl: string;
  docxUrl: string;
  imageUrls: string[];
}> {
  const { root, hebdoPath, typePath, targetPath } = resolveDeliveryFolderPaths(params);

  // Ensure all folders exist
  await ensureFolder(root);
  await ensureFolder(hebdoPath);
  await ensureFolder(typePath);
  if (targetPath !== typePath) {
    await ensureFolder(targetPath);
  }

  // Upload DOCX
  const safeDocxName = sanitizePathComponent(params.docxFileName);
  const docxPath = `${targetPath}/${safeDocxName}`;
  await uploadFile(docxPath, params.docxBuffer);

  // Upload all images sequentially to avoid Dropbox rate limits
  const imageUrls: string[] = [];
  for (const img of params.images) {
    const safeImgName = sanitizePathComponent(img.originalname);
    const imgPath = `${targetPath}/${safeImgName}`;
    await uploadFile(imgPath, img.buffer);
    const imgUrl = await getOrCreateSharedLink(imgPath);
    imageUrls.push(imgUrl);
  }

  // Get shared links for folder and docx
  const folderUrl = await getOrCreateSharedLink(targetPath);
  const docxUrl = await getOrCreateSharedLink(docxPath);

  console.log(`[Dropbox] ${params.images.length} image(s) + DOCX uploaded to ${targetPath}`);

  return { folderUrl, docxUrl, imageUrls };
}
