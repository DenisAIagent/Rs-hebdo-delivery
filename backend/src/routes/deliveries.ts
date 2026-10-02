import { Router, Response } from 'express';
import crypto from 'crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import multer from 'multer';
import { AuthRequest } from '../middleware/auth';
import { supabaseAdmin } from '../utils/supabase';
import { generateDocx } from '../services/docx';
import { uploadDelivery, ensureHebdoFolderStructure } from '../services/dropbox';
import { notifyDelivery } from '../services/email';
import { publishDeliveryToWordpress } from '../services/wordpressPublisher';
import { logInfo, logError, logWarn, type LogContext } from '../services/deliveryLogger';
import { validateMetadata, normalizeMetadata } from '../services/fieldValidation';

/** Strip HTML tags safely (removes all tags, decodes entities) */
function stripHtml(str: string): string {
  return str
    .replace(/<[^>]*>?/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const MAX_FILE_BYTES = 60 * 1024 * 1024; // 60 Mo/fichier — large pour une photo de presse HD
const MAX_FILES = 30;

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 50 },
  fileFilter: (_req, file, cb) => {
    // On refuse d'emblee SVG (vecteur XSS) et tout ce qui n'est pas une image.
    // Le MIME client n'est pas fiable : la vraie verif se fait sur les magic
    // bytes apres reception (assertRealImages).
    if (file.mimetype === 'image/svg+xml') {
      cb(new Error('Les images SVG ne sont pas acceptees'));
    } else if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont acceptees'));
    }
  },
});

/** Vrai type d'image d'apres les premiers octets (indépendant du MIME client). */
function detectImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)) return 'tiff';
  if (buf.toString('ascii', 4, 8) === 'ftyp') return 'heic'; // HEIC/HEIF
  return null;
}

/** Rejette toute pièce jointe dont le contenu binaire n'est pas une image reconnue. */
function assertRealImages(files: Express.Multer.File[]): void {
  for (const f of files || []) {
    if (!detectImageType(f.buffer)) {
      throw new Error(`Fichier « ${f.originalname} » : contenu non reconnu comme une image valide`);
    }
  }
}

// GET /api/deliveries - List user's deliveries
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('deliveries')
      .select(`
        *,
        paper_type:paper_types(name, sign_limit),
        hebdo:hebdo_config(numero, label)
      `)
      .eq('author_id', req.userId!)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    console.error('List deliveries error:', error);
    return res.status(500).json({ error: 'Erreur chargement livraisons' });
  }
});

// GET /api/deliveries/current-hebdo - Get current hebdo config
router.get('/current-hebdo', async (_req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('hebdo_config')
      .select('*')
      .eq('is_current', true)
      .single();

    return res.json(data || null);
  } catch {
    return res.status(500).json({ error: 'Erreur chargement hebdo' });
  }
});

// GET /api/deliveries/hebdos - Get the next hebdo to deliver for
// Priority: 1) is_current=true  2) first hebdo whose end_date >= today  3) latest by numero
router.get('/hebdos', async (_req: AuthRequest, res: Response) => {
  try {
    // First try the one flagged as current
    const { data: current } = await supabaseAdmin
      .from('hebdo_config')
      .select('*')
      .eq('is_current', true)
      .single();

    if (current) {
      return res.json(current);   // single object, not array
    }

    // Fallback: first hebdo whose end_date >= today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const { data: upcoming } = await supabaseAdmin
      .from('hebdo_config')
      .select('*')
      .gte('end_date', today)
      .order('start_date', { ascending: true })
      .limit(1)
      .single();

    if (upcoming) {
      return res.json(upcoming);
    }

    // Last fallback: most recent by numero
    const { data: latest } = await supabaseAdmin
      .from('hebdo_config')
      .select('*')
      .order('numero', { ascending: false })
      .limit(1)
      .single();

    return res.json(latest || null);
  } catch {
    return res.status(500).json({ error: 'Erreur chargement hebdo' });
  }
});

// POST /api/deliveries/ensure-hebdo - Find or create a hebdo by number
// Journalists can type any number; if it doesn't exist yet, it's created (max 5 per hour)
const ensureHebdoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req: AuthRequest) => req.userId || ipKeyGenerator(req.ip || ''),
  message: { error: 'Trop de creations d\'hebdo. Reessayez plus tard.' },
});
router.post('/ensure-hebdo', ensureHebdoLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { numero } = req.body;
    const num = parseInt(numero, 10);

    if (isNaN(num) || num < 1 || num > 9999) {
      return res.status(400).json({ error: 'Numero invalide (entre 1 et 9999)' });
    }

    // Check if exists
    const { data: existing } = await supabaseAdmin
      .from('hebdo_config')
      .select('*')
      .eq('numero', num)
      .single();

    if (existing) {
      return res.json(existing);
    }

    // Create new hebdo
    const label = `RSH${num}`;
    const { data: created, error } = await supabaseAdmin
      .from('hebdo_config')
      .insert({ numero: num, label, is_current: false })
      .select()
      .single();

    if (error) throw error;

    console.log(`[Hebdo] New hebdo created by journalist: ${label}`);
    return res.status(201).json(created);
  } catch (error) {
    console.error('Ensure hebdo error:', error);
    return res.status(500).json({ error: 'Erreur creation hebdo' });
  }
});

// POST /api/deliveries/prepare-hebdo - Pre-create Dropbox folder structure for a hebdo
router.post('/prepare-hebdo', async (req: AuthRequest, res: Response) => {
  const { hebdo_id } = req.body;
  if (!hebdo_id) {
    return res.status(400).json({ error: 'hebdo_id requis' });
  }

  try {
    const { data: hebdo } = await supabaseAdmin
      .from('hebdo_config')
      .select('*')
      .eq('id', hebdo_id)
      .single();

    if (!hebdo) {
      return res.status(404).json({ error: 'Hebdo introuvable' });
    }

    const { data: activeTypes } = await supabaseAdmin
      .from('paper_types')
      .select('drive_folder_name')
      .eq('is_active', true);

    if (activeTypes && activeTypes.length > 0) {
      // On (pré)crée la structure de dossiers mais on NE renvoie PAS le lien
      // partagé du dossier racine de l'hebdo : ce lien donne accès aux papiers
      // de tous les journalistes et n'a aucune utilité côté journaliste ici.
      await ensureHebdoFolderStructure(hebdo.label, activeTypes);
      await logInfo('dropbox-prepare', `Dossiers Dropbox pre-crees pour ${hebdo.label}`, {
        journalistId: req.userId,
        hebdoLabel: hebdo.label,
      });
      return res.json({ message: 'Dossiers prets' });
    }

    return res.json({ message: 'Aucun type de papier actif' });
  } catch (error) {
    console.error('Prepare hebdo error:', error);
    await logError('dropbox-prepare', 'Echec preparation dossiers Dropbox', {
      journalistId: req.userId,
    }, error);
    return res.status(500).json({ error: 'Erreur preparation dossiers Dropbox' });
  }
});

// GET /api/deliveries/paper-types - Get active paper types
router.get('/paper-types', async (_req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('paper_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    return res.json(data || []);
  } catch {
    return res.status(500).json({ error: 'Erreur chargement types' });
  }
});

// POST /api/deliveries - Submit a delivery (now supports multiple images)
// Extend timeout for this upload-heavy route (15 min — accommodates large photos)
router.post('/', (req, _res, next) => { req.setTimeout(900_000); next(); }, upload.array('images', 30), async (req: AuthRequest, res: Response) => {
  // Log context — built progressively as we gather info (filled below)
  const ctx: LogContext = { journalistId: req.userId };
  let currentStep = 'start';
  // Reassigned below to the resolved author

  try {
    const { paper_type_id, title, metadata, hebdo_id, author_id: rawAuthorId } = req.body;
    const imageFiles = req.files as Express.Multer.File[];

    // Vérifie que chaque fichier est réellement une image (magic bytes)
    currentStep = 'validation';
    try {
      assertRealImages(imageFiles);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Image invalide' });
    }

    // Resolve the author: admins can attribute a delivery to another active user
    let authorId = req.userId!;
    if (rawAuthorId && typeof rawAuthorId === 'string' && rawAuthorId !== req.userId) {
      if (req.userRole !== 'admin') {
        return res.status(403).json({ error: "Seul un admin peut attribuer une livraison a un autre utilisateur" });
      }
      const { data: targetProfile, error: targetError } = await supabaseAdmin
        .from('profiles')
        .select('id, is_active')
        .eq('id', rawAuthorId)
        .single();
      if (targetError || !targetProfile?.is_active) {
        return res.status(400).json({ error: "Journaliste cible introuvable ou inactif" });
      }
      authorId = targetProfile.id;
    }

    // Parse metadata if it's a JSON string
    let parsedMetadata: Record<string, any> = {};
    try {
      parsedMetadata = metadata ? JSON.parse(metadata) : {};
    } catch {
      parsedMetadata = {};
    }

    // ── Validation ──────────────────────────────────────
    currentStep = 'validation';
    if (!paper_type_id || !title || !hebdo_id) {
      await logWarn('validation', 'Champs obligatoires manquants', ctx,
        `paper_type_id=${!!paper_type_id}, title=${!!title}, hebdo=${!!hebdo_id}`);
      return res.status(400).json({ error: 'Champs obligatoires manquants (type, titre, hebdo)' });
    }

    // Get paper type info with fields config
    const { data: paperType } = await supabaseAdmin
      .from('paper_types')
      .select('*')
      .eq('id', paper_type_id)
      .single();

    if (!paperType) {
      await logWarn('validation', 'Type de papier introuvable', ctx, `paper_type_id=${paper_type_id}`);
      return res.status(400).json({ error: 'Type de papier invalide' });
    }

    // Check if images are required
    const imageFieldConfig = paperType.fields_config?.find((f: any) => f.type === 'images');
    const minImages = imageFieldConfig?.min || 0;

    if (imageFieldConfig?.required && (!imageFiles || imageFiles.length < minImages)) {
      await logWarn('validation', 'Images manquantes', ctx,
        `required=${minImages}, provided=${imageFiles?.length || 0}`);
      return res.status(400).json({
        error: `Au moins ${minImages} image${minImages > 1 ? 's' : ''} requise${minImages > 1 ? 's' : ''}`
      });
    }

    // Get hebdo info
    const { data: hebdo } = await supabaseAdmin
      .from('hebdo_config')
      .select('*')
      .eq('id', hebdo_id)
      .single();

    if (!hebdo) {
      await logWarn('validation', 'Hebdo introuvable', ctx, `hebdo_id=${hebdo_id}`);
      return res.status(400).json({ error: 'Hebdo invalide' });
    }

    // Get journalist profile (the resolved author, which may differ from the caller when admin attributes)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', authorId)
      .single();

    const journalistName = profile?.full_name || profile?.email || 'Unknown';
    ctx.journalistId = authorId;

    // Strip HTML from all string metadata values
    for (const key of Object.keys(parsedMetadata)) {
      if (typeof parsedMetadata[key] === 'string') {
        parsedMetadata[key] = stripHtml(parsedMetadata[key]);
      }
    }

    // Validation serveur de tous les champs du type (chapo, clip YouTube,
    // site officiel... selon fields_config) : le formulaire ne fait pas foi.
    parsedMetadata = normalizeMetadata(paperType.fields_config || [], parsedMetadata);
    const problems = validateMetadata({
      fields: paperType.fields_config || [], metadata: parsedMetadata, imageCount: imageFiles?.length || 0,
    });
    if (problems.length > 0) {
      await logWarn('validation', 'Champs invalides ou manquants', ctx, problems.join(' ; '));
      return res.status(400).json({ error: `Livraison refusée : ${problems.join(' ; ')}` });
    }

    // Get body text from metadata (usually 'corps' field)
    const bodyField = paperType.fields_config?.find((f: any) => f.key === 'corps');
    const bodyText = bodyField ? parsedMetadata[bodyField.key] || '' : '';
    const signCount = bodyText.length;

    // For backward compatibility, extract some fields
    const subject = parsedMetadata.artiste || parsedMetadata.album || '';
    const digitalLink = parsedMetadata.lien || '';

    // Enrich log context now that we have all info
    ctx.journalistName = journalistName;
    ctx.hebdoLabel = hebdo.label;
    ctx.paperTypeName = paperType.name;
    ctx.title = title;

    await logInfo('start', `${journalistName} livre "${title}" (${paperType.name}) pour ${hebdo.label}`, ctx);

    // ── DOCX Generation with metadata ───────────────────
    currentStep = 'docx';
    const docxFileName = `${hebdo.label} - ${paperType.name} - ${title}.docx`;
    const docxBuffer = await generateDocx({
      title,
      author: journalistName,
      paperType: paperType.name,
      metadata: parsedMetadata,
      fieldsConfig: paperType.fields_config || []
    });
    await logInfo('docx', `DOCX genere (${(docxBuffer.length / 1024).toFixed(0)} Ko)`, ctx);

    // ── Dropbox: Folder Structure ───────────────────────
    currentStep = 'dropbox-folders';
    const { data: allActiveTypes } = await supabaseAdmin
      .from('paper_types')
      .select('drive_folder_name')
      .eq('is_active', true);

    if (allActiveTypes && allActiveTypes.length > 0) {
      await ensureHebdoFolderStructure(hebdo.label, allActiveTypes);
    }
    await logInfo('dropbox-folders', `Dossiers Dropbox prets pour ${hebdo.label}`, ctx);

    // ── Dropbox: Upload Files (DOCX + all images) ──────
    currentStep = 'dropbox-upload';

    const images = (imageFiles || []).map((f) => ({
      buffer: f.buffer,
      originalname: f.originalname,
      mimetype: f.mimetype,
    }));

    const driveResult = await uploadDelivery({
      hebdoNumber: hebdo.label,
      driveFolderName: paperType.drive_folder_name,
      journalistName,
      subject: subject || title,
      docxBuffer,
      docxFileName,
      images,
    });

    await logInfo('dropbox-upload', `DOCX + ${images.length} image(s) uploades dans Dropbox`, ctx);

    // ── Database Insert with metadata ───────────────────
    currentStep = 'database';
    const { data: delivery, error: insertError } = await supabaseAdmin
      .from('deliveries')
      .insert({
        author_id: authorId,
        hebdo_id: hebdo.id,
        paper_type_id: paperType.id,
        title,
        subject: subject || null,
        body_original: bodyText,
        body_corrected: bodyText, // Corrected text already merged into metadata by frontend
        digital_link: digitalLink || null,
        image_filename: images.map((i) => i.originalname).join(', '),
        metadata: parsedMetadata,
        drive_folder_url: driveResult.folderUrl,
        status: 'delivered',
        sign_count: signCount,
        delivered_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;
    await logInfo('database', `Livraison enregistree en base (${signCount} signes)`, ctx);

    // ── WordPress (parallele, non bloquant) ─────────────
    // L'article part en brouillon "[EN ATTENTE DE RELECTURE]" ; tout echec
    // est visible dans les logs admin sans jamais bloquer la livraison.
    void publishDeliveryToWordpress({
      deliveryId: delivery.id,
      title,
      paperTypeName: paperType.name,
      journalistName,
      hebdoLabel: hebdo.label,
      metadata: parsedMetadata,
      bodyText,
      images,
    }).catch((err) => console.error('[WordPress] Unexpected publish error:', err?.response?.data || err?.message || String(err)));

    // ── Email Notification ──────────────────────────────
    currentStep = 'email';
    await notifyDelivery({
      journalistName,
      paperType: paperType.name,
      title,
      hebdoNumber: hebdo.label,
      driveFolderUrl: driveResult.folderUrl,
      signCount,
    });

    // ── Success ─────────────────────────────────────────
    await logInfo('success', `Livraison OK — "${title}" par ${journalistName}`, ctx);

    return res.status(201).json({
      delivery,
      drive: driveResult,
      message: 'Papier livre avec succes !',
    });
  } catch (error: any) {
    // Log detail server-side + admin logs, return generic message to client
    const detail = error?.response?.data?.error_summary || error?.message || '';
    console.error('Delivery error:', detail);
    await logError(currentStep, `Echec a l'etape "${currentStep}": ${detail}`, ctx, error);

    const errorRef = crypto.randomUUID();
    return res.status(500).json({ error: 'Erreur lors de la livraison', reference: errorRef });
  }
});

// GET /api/deliveries/:id - Get a single delivery (owner only)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('deliveries')
      .select(`
        *,
        paper_type:paper_types(*),
        hebdo:hebdo_config(numero, label)
      `)
      .eq('id', id)
      .eq('author_id', req.userId!)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Livraison introuvable' });
    }
    return res.json(data);
  } catch (error) {
    console.error('Get delivery error:', error);
    return res.status(500).json({ error: 'Erreur chargement livraison' });
  }
});

// PUT /api/deliveries/:id - Update a delivery (owner only, re-generates DOCX + re-uploads to Dropbox)
router.put('/:id', (req, _res, next) => { req.setTimeout(900_000); next(); }, upload.array('images', 30), async (req: AuthRequest, res: Response) => {
  const ctx: LogContext = { journalistId: req.userId };
  let currentStep = 'start';

  try {
    const { id } = req.params;
    const { title, metadata } = req.body;
    const imageFiles = req.files as Express.Multer.File[];

    // Vérifie que chaque fichier est réellement une image (magic bytes)
    try {
      assertRealImages(imageFiles);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Image invalide' });
    }

    // ── Check ownership ─────────────────────────────────
    currentStep = 'ownership';
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('deliveries')
      .select('*, paper_type:paper_types(*), hebdo:hebdo_config(numero, label)')
      .eq('id', id)
      .eq('author_id', req.userId!)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Livraison introuvable ou non autorisee' });
    }

    const paperType = existing.paper_type;
    const hebdo = existing.hebdo;

    // Parse metadata
    let parsedMetadata: Record<string, any> = {};
    try {
      parsedMetadata = metadata ? JSON.parse(metadata) : existing.metadata || {};
    } catch {
      parsedMetadata = existing.metadata || {};
    }

    // Strip HTML from all string metadata values
    for (const key of Object.keys(parsedMetadata)) {
      if (typeof parsedMetadata[key] === 'string') {
        parsedMetadata[key] = stripHtml(parsedMetadata[key]);
      }
    }

    const updatedTitle = title || existing.title;

    // Get body text
    parsedMetadata = normalizeMetadata(paperType.fields_config || [], parsedMetadata);
    const problems = validateMetadata({
      fields: paperType.fields_config || [], metadata: parsedMetadata,
      imageCount: imageFiles?.length || 0, hasExistingImages: !!existing.image_filename,
    });
    if (problems.length > 0) {
      return res.status(400).json({ error: `Modification refusée : ${problems.join(' ; ')}` });
    }

    const bodyField = paperType.fields_config?.find((f: any) => f.key === 'corps');
    const bodyText = bodyField ? parsedMetadata[bodyField.key] || '' : '';
    const signCount = bodyText.length;
    const subject = parsedMetadata.artiste || parsedMetadata.album || '';
    const digitalLink = parsedMetadata.lien || '';

    // Get journalist profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', req.userId!)
      .single();

    const journalistName = profile?.full_name || req.userEmail || 'Unknown';

    ctx.journalistName = journalistName;
    ctx.hebdoLabel = hebdo.label;
    ctx.paperTypeName = paperType.name;
    ctx.title = updatedTitle;

    await logInfo('edit-start', `${journalistName} modifie "${updatedTitle}" (${paperType.name}) pour ${hebdo.label}`, ctx);

    // ── Re-generate DOCX ────────────────────────────────
    currentStep = 'docx';
    const docxFileName = `${hebdo.label} - ${paperType.name} - ${updatedTitle}.docx`;
    const docxBuffer = await generateDocx({
      title: updatedTitle,
      author: journalistName,
      paperType: paperType.name,
      metadata: parsedMetadata,
      fieldsConfig: paperType.fields_config || []
    });
    await logInfo('edit-docx', `DOCX re-genere (${(docxBuffer.length / 1024).toFixed(0)} Ko)`, ctx);

    // ── Dropbox: Re-upload ──────────────────────────────
    currentStep = 'dropbox-upload';

    const images = (imageFiles || []).map((f) => ({
      buffer: f.buffer,
      originalname: f.originalname,
      mimetype: f.mimetype,
    }));

    const driveResult = await uploadDelivery({
      hebdoNumber: hebdo.label,
      driveFolderName: paperType.drive_folder_name,
      journalistName,
      subject: subject || updatedTitle,
      docxBuffer,
      docxFileName,
      images,
    });

    await logInfo('edit-dropbox', `DOCX + ${images.length} image(s) re-uploades dans Dropbox`, ctx);

    // ── Database Update ─────────────────────────────────
    currentStep = 'database';
    const updateData: Record<string, any> = {
      title: updatedTitle,
      subject: subject || null,
      body_original: bodyText,
      body_corrected: bodyText,
      digital_link: digitalLink || null,
      metadata: parsedMetadata,
      sign_count: signCount,
      drive_folder_url: driveResult.folderUrl,
    };

    // Only update image_filename if new images were uploaded
    if (images.length > 0) {
      updateData.image_filename = images.map((i) => i.originalname).join(', ');
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('deliveries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await logInfo('edit-success', `Modification OK — "${updatedTitle}" par ${journalistName}`, ctx);

    return res.json({
      delivery: updated,
      drive: driveResult,
      message: 'Papier modifie avec succes !',
    });
  } catch (error: any) {
    const detail = error?.response?.data?.error_summary || error?.message || '';
    console.error('Update delivery error:', detail);
    await logError(currentStep, `Echec modification a l'etape "${currentStep}": ${detail}`, ctx, error);
    const errorRef = crypto.randomUUID();
    return res.status(500).json({ error: 'Erreur lors de la modification', reference: errorRef });
  }
});

export default router;