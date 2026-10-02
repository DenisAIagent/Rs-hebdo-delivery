import { Router, Response } from 'express';
import { invalidateMfaPolicyCache } from '../services/mfaPolicy';
import { generateDocx } from '../services/docx';
import { reattributeDelivery, relocateDeliveryFiles } from '../services/dropbox';
import { logInfo, logWarn, type LogContext } from '../services/deliveryLogger';
import { AuthRequest } from '../middleware/auth';
import { supabaseAdmin } from '../utils/supabase';
import { todayString, nextFridayString } from '../utils/dates';
import { listClaudeModels, getLatestClaudeModel } from '../services/claude';
import { testWpConnection, readWpPostMeta, writeWpPostMeta, listWpRevisions, listWpUsers } from '../services/wordpress';
import { republishDeliveryToWordpress } from '../services/wordpressPublisher';
import { collectMonthlyRecap, buildRecapPdf, sendMonthlyRecap, parseMonthKey, recapFilename, sampleRecap } from '../services/monthlyRecap';

const router = Router();

/** Strip HTML tags safely */
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

// ========== PAPER TYPES ==========

// GET /api/admin/paper-types - List all paper types (including inactive)
router.get('/paper-types', async (_req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('paper_types')
      .select('*')
      .order('sort_order', { ascending: true });
    return res.json(data || []);
  } catch {
    return res.status(500).json({ error: 'Erreur chargement' });
  }
});

// POST /api/admin/paper-types - Create a paper type
router.post('/paper-types', async (req: AuthRequest, res: Response) => {
  const { name, sign_limit, drive_folder_name, fields_config, sort_order } = req.body;

  if (!name || !sign_limit || !drive_folder_name) {
    return res.status(400).json({ error: 'Nom, limite signes et nom dossier Drive requis' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('paper_types')
      .insert({
        name,
        sign_limit: parseInt(sign_limit),
        drive_folder_name,
        fields_config: fields_config || [],
        sort_order: sort_order || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error) {
    console.error('Create paper type error:', error);
    return res.status(500).json({ error: 'Erreur creation' });
  }
});

// PUT /api/admin/paper-types/:id - Update a paper type
router.put('/paper-types/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, sign_limit, drive_folder_name, fields_config, is_active, sort_order } = req.body;

  try {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (sign_limit !== undefined) updates.sign_limit = parseInt(sign_limit);
    if (drive_folder_name !== undefined) updates.drive_folder_name = drive_folder_name;
    if (fields_config !== undefined) updates.fields_config = fields_config;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data, error } = await supabaseAdmin
      .from('paper_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    console.error('Update paper type error:', error);
    return res.status(500).json({ error: 'Erreur mise a jour' });
  }
});

// DELETE /api/admin/paper-types/:id - Delete a paper type
router.delete('/paper-types/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Soft delete: just deactivate
    const { error } = await supabaseAdmin
      .from('paper_types')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return res.json({ message: 'Type desactive' });
  } catch {
    return res.status(500).json({ error: 'Erreur suppression' });
  }
});

// ========== HEBDO CONFIG ==========

// GET /api/admin/hebdo - List all hebdo configs
router.get('/hebdo', async (_req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('hebdo_config')
      .select('*')
      .order('created_at', { ascending: false });
    return res.json(data || []);
  } catch {
    return res.status(500).json({ error: 'Erreur chargement' });
  }
});

// POST /api/admin/hebdo - Create and set current hebdo
// Auto-fills the publication window if dates are missing:
//   start_date = today, end_date = next Friday
// so the weekly auto-rotation can take over from the new number.
router.post('/hebdo', async (req: AuthRequest, res: Response) => {
  const { numero, start_date, end_date } = req.body;
  if (!numero) {
    return res.status(400).json({ error: 'Numero requis' });
  }

  const start = start_date || todayString();
  const end = end_date || nextFridayString(new Date(start + 'T00:00:00Z'));

  try {
    // Unset all current
    await supabaseAdmin
      .from('hebdo_config')
      .update({ is_current: false })
      .eq('is_current', true);

    // Create new
    const { data, error } = await supabaseAdmin
      .from('hebdo_config')
      .insert({
        numero: parseInt(numero),
        label: `RSH${numero}`,
        start_date: start,
        end_date: end,
        is_current: true,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error) {
    console.error('Create hebdo error:', error);
    return res.status(500).json({ error: 'Erreur creation hebdo' });
  }
});

// PUT /api/admin/hebdo/:id/set-current - Set a hebdo as current
// If the target hebdo has no end_date, we anchor the cycle on the next
// Friday so rotation picks up automatically from this number.
router.put('/hebdo/:id/set-current', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await supabaseAdmin
      .from('hebdo_config')
      .update({ is_current: false })
      .eq('is_current', true);

    // Fetch target to know whether we need to seed the publication window
    const { data: target, error: fetchError } = await supabaseAdmin
      .from('hebdo_config')
      .select('start_date, end_date')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const patch: Record<string, unknown> = { is_current: true };
    if (!target?.end_date) {
      const start = target?.start_date || todayString();
      patch.start_date = start;
      patch.end_date = nextFridayString(new Date(start + 'T00:00:00Z'));
    }

    const { data, error } = await supabaseAdmin
      .from('hebdo_config')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    console.error('Set current hebdo error:', error);
    return res.status(500).json({ error: 'Erreur changement hebdo' });
  }
});

// GET /api/admin/hebdo/:id/status - Get completion status per paper type for a hebdo
router.get('/hebdo/:id/status', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Get all active paper types
    const { data: paperTypes } = await supabaseAdmin
      .from('paper_types')
      .select('id, name, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    // Get all deliveries for this hebdo
    const { data: deliveries } = await supabaseAdmin
      .from('deliveries')
      .select('paper_type_id, title, author:profiles(full_name), status')
      .eq('hebdo_id', id);

    const status = (paperTypes || []).map((pt) => {
      const ptDeliveries = (deliveries || []).filter((d: any) => d.paper_type_id === pt.id);
      return {
        paper_type_id: pt.id,
        name: pt.name,
        count: ptDeliveries.length,
        deliveries: ptDeliveries.map((d: any) => ({
          title: d.title,
          author: d.author?.full_name || 'N/A',
          status: d.status,
        })),
      };
    });

    return res.json(status);
  } catch (error) {
    console.error('Hebdo status error:', error);
    return res.status(500).json({ error: 'Erreur chargement statut' });
  }
});

// ========== JOURNALISTS ==========

// GET /api/admin/journalists - List all journalists
router.get('/journalists', async (_req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    return res.json(data || []);
  } catch {
    return res.status(500).json({ error: 'Erreur chargement' });
  }
});

// POST /api/admin/journalists - Create a journalist account
router.post('/journalists', async (req: AuthRequest, res: Response) => {
  const { email, full_name, password, role } = req.body;

  if (!email || !full_name || !password) {
    return res.status(400).json({ error: 'Email, nom complet et mot de passe requis' });
  }

  // Password complexity check
  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' });
  }

  // Role validation
  const validRole = role || 'journalist';
  if (!['journalist', 'admin'].includes(validRole)) {
    return res.status(400).json({ error: 'Role invalide (journalist ou admin)' });
  }

  try {
    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;

    // Create profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUser.user.id,
        email,
        full_name,
        role: validRole,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) throw profileError;
    return res.status(201).json(profile);
  } catch (error: any) {
    console.error('Create journalist error:', error);
    return res.status(500).json({ error: 'Erreur creation compte' });
  }
});

// PUT /api/admin/journalists/:id - Update journalist
router.put('/journalists/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { full_name, role, is_active } = req.body;

  try {
    const updates: Record<string, unknown> = {};
    if (full_name !== undefined) updates.full_name = full_name;

    if (role !== undefined) {
      if (!['journalist', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Role invalide (journalist ou admin)' });
      }
      // Prevent removing the last admin
      if (role !== 'admin') {
        const { count } = await supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin')
          .eq('is_active', true);
        if (count !== null && count <= 1) {
          // Check if target is currently admin
          const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', id).single();
          if (target?.role === 'admin') {
            return res.status(400).json({ error: 'Impossible de retirer le dernier admin' });
          }
        }
      }
      updates.role = role;
    }

    if (is_active !== undefined) {
      // Prevent deactivating the last admin
      if (is_active === false) {
        const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', id).single();
        if (target?.role === 'admin') {
          const { count } = await supabaseAdmin
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'admin')
            .eq('is_active', true);
          if (count !== null && count <= 1) {
            return res.status(400).json({ error: 'Impossible de desactiver le dernier admin' });
          }
        }
      }
      updates.is_active = is_active;
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch {
    return res.status(500).json({ error: 'Erreur mise a jour' });
  }
});

// DELETE /api/admin/journalists/:id/mfa - Reset a user's 2FA (lost phone, etc.)
// Removes all enrolled TOTP factors; the user re-enrolls at next login.
router.delete('/journalists/:id/mfa', async (req: AuthRequest, res: Response) => {
  const userId = String(req.params.id);
  try {
    const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
    if (error) throw error;

    const factors = data?.factors || [];
    for (const factor of factors) {
      const { error: delError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
      if (delError) throw delError;
    }

    return res.json({
      message: factors.length > 0
        ? `2FA reinitialisee (${factors.length} facteur(s) supprime(s)). L'utilisateur devra reconfigurer son application a la prochaine connexion.`
        : "Aucun facteur 2FA a supprimer pour cet utilisateur.",
    });
  } catch (error: any) {
    console.error('Reset MFA error:', error);
    return res.status(500).json({ error: 'Erreur reinitialisation 2FA', detail: error?.message });
  }
});

// ========== ALL DELIVERIES (admin view) ==========

// GET /api/admin/deliveries - List all deliveries
router.get('/deliveries', async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('deliveries')
      .select(`
        *,
        author:profiles(full_name, email),
        paper_type:paper_types(name, sign_limit),
        hebdo:hebdo_config(numero, label)
      `)
      .order('created_at', { ascending: false });

    return res.json(data || []);
  } catch {
    return res.status(500).json({ error: 'Erreur chargement' });
  }
});

// GET /api/admin/deliveries/:id - Get a single delivery (admin, no ownership check)
router.get('/deliveries/:id', async (req: AuthRequest, res: Response) => {
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
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Livraison introuvable' });
    }
    return res.json(data);
  } catch (error) {
    console.error('Admin get delivery error:', error);
    return res.status(500).json({ error: 'Erreur chargement livraison' });
  }
});

// PUT /api/admin/deliveries/:id - Update a delivery (admin, no ownership check)
router.put('/deliveries/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, metadata: metadataRaw, author_id: rawAuthorId } = req.body;

    // Get existing delivery with paper_type and hebdo
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('deliveries')
      .select('*, paper_type:paper_types(*), hebdo:hebdo_config(numero, label)')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Livraison introuvable' });
    }

    const paperType = existing.paper_type;

    // Parse metadata
    let parsedMetadata: Record<string, any> = {};
    try {
      parsedMetadata = metadataRaw ? JSON.parse(metadataRaw) : existing.metadata || {};
    } catch {
      parsedMetadata = existing.metadata || {};
    }

    // Strip HTML from all string metadata values
    for (const key of Object.keys(parsedMetadata)) {
      if (typeof parsedMetadata[key] === 'string') {
        parsedMetadata[key] = stripHtml(parsedMetadata[key]);
      }
    }

    // Reattribution : l'admin peut corriger le journaliste d'une livraison
    // (compte actif uniquement). Les fichiers deja deposes sur Dropbox ne sont
    // pas deplaces : seule la fiche de livraison change d'auteur.
    let authorId: string = existing.author_id;
    if (typeof rawAuthorId === 'string' && rawAuthorId && rawAuthorId !== existing.author_id) {
      const { data: targetProfile, error: targetError } = await supabaseAdmin
        .from('profiles')
        .select('id, is_active')
        .eq('id', rawAuthorId)
        .single();
      if (targetError || !targetProfile?.is_active) {
        return res.status(400).json({ error: 'Journaliste cible introuvable ou inactif' });
      }
      authorId = targetProfile.id;
    }

    // Noms des journalistes (avant / apres) : ils apparaissent dans le DOCX et
    // dans l'arborescence Dropbox de certains types de papier.
    let previousAuthorName = '';
    let newAuthorName = '';
    if (authorId !== existing.author_id) {
      const { data: people } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', [existing.author_id, authorId]);
      const nameOf = (uid: string) => {
        const p = (people || []).find((x: any) => x.id === uid);
        return p?.full_name || p?.email || '';
      };
      previousAuthorName = nameOf(existing.author_id);
      newAuthorName = nameOf(authorId);
    }

    const updatedTitle = title || existing.title;
    const bodyField = paperType.fields_config?.find((f: any) => f.key === 'corps');
    const bodyText = bodyField ? parsedMetadata[bodyField.key] || '' : '';
    const signCount = bodyText.length;
    const subject = parsedMetadata.artiste || parsedMetadata.album || '';
    const digitalLink = parsedMetadata.lien || '';

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('deliveries')
      .update({
        title: updatedTitle,
        author_id: authorId,
        subject: subject || null,
        body_original: bodyText,
        body_corrected: bodyText,
        digital_link: digitalLink || null,
        metadata: parsedMetadata,
        sign_count: signCount,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Reattribution : le DOCX depose sur Dropbox porte le nom du journaliste
    // ("Par X — Type"). On le regenere avec le meme contenu et on le remplace
    // (ecrasement, jamais de suppression) ; si l'arborescence depend du
    // journaliste, le dossier complet est deplace pour garder images + DOCX.
    let driveInfo: { folderUrl: string; docxUrl: string; moved: boolean } | null = null;
    if (authorId !== existing.author_id) {
      const ctx: LogContext = {
        journalistId: authorId,
        journalistName: newAuthorName || undefined,
        hebdoLabel: existing.hebdo?.label,
        paperTypeName: paperType?.name,
        title: updatedTitle,
      };
      try {
        const docxBuffer = await generateDocx({
          title: updatedTitle,
          author: newAuthorName || 'Unknown',
          paperType: paperType.name,
          metadata: parsedMetadata,
          fieldsConfig: paperType.fields_config || [],
        });
        const folderBase = {
          hebdoNumber: existing.hebdo?.label || '',
          driveFolderName: paperType.drive_folder_name || paperType.name,
          subject: existing.subject || updatedTitle,
        };
        driveInfo = await reattributeDelivery({
          previous: { ...folderBase, journalistName: previousAuthorName || '' },
          next: { ...folderBase, journalistName: newAuthorName || '' },
          docxFileName: `${existing.hebdo?.label || ''} - ${paperType.name} - ${updatedTitle}.docx`,
          docxBuffer,
        });
        if (driveInfo.folderUrl && driveInfo.folderUrl !== updated.drive_folder_url) {
          await supabaseAdmin
            .from('deliveries')
            .update({ drive_folder_url: driveInfo.folderUrl })
            .eq('id', id);
          updated.drive_folder_url = driveInfo.folderUrl;
        }
        await logInfo(
          'admin-reassign',
          `Livraison reattribuee a ${newAuthorName} (etait ${previousAuthorName}) — DOCX Dropbox mis a jour${driveInfo.moved ? ' et dossier deplace' : ''}`,
          ctx,
        );
      } catch (dropboxErr: any) {
        // La reattribution en base reste valable : on signale l'echec Dropbox.
        await logWarn(
          'admin-reassign',
          `Livraison reattribuee a ${newAuthorName} mais DOCX Dropbox non mis a jour : ${dropboxErr?.message || dropboxErr}`,
          ctx,
        );
      }
    }

    return res.json({
      delivery: updated,
      drive: driveInfo,
      message: authorId !== existing.author_id
        ? `Livraison attribuee a ${newAuthorName}${driveInfo ? ' — DOCX Dropbox mis a jour' : ' — DOCX Dropbox non mis a jour (voir Logs)'}`
        : 'Livraison modifiee par admin',
    });
  } catch (error) {
    console.error('Admin update delivery error:', error);
    return res.status(500).json({ error: 'Erreur modification' });
  }
});

// DELETE /api/admin/deliveries/:id - Delete a delivery
router.delete('/deliveries/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('deliveries')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.json({ message: 'Livraison supprimee' });
  } catch {
    return res.status(500).json({ error: 'Erreur suppression' });
  }
});

// ========== DELIVERY LOGS ==========

// GET /api/admin/logs - List recent delivery logs
router.get('/logs', async (req: AuthRequest, res: Response) => {
  try {
    const level = req.query.level as string | undefined;    // 'error', 'warn', 'info'
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    let query = supabaseAdmin
      .from('delivery_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (level && ['info', 'warn', 'error'].includes(level)) {
      query = query.eq('level', level);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('Get logs error:', error);
    return res.status(500).json({ error: 'Erreur chargement logs' });
  }
});

// DELETE /api/admin/logs - Clear old logs (older than 30 days)
router.delete('/logs', async (_req: AuthRequest, res: Response) => {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
      .from('delivery_logs')
      .delete()
      .lt('created_at', cutoff);

    if (error) throw error;
    return res.json({ message: 'Logs de plus de 30 jours supprimes' });
  } catch {
    return res.status(500).json({ error: 'Erreur nettoyage logs' });
  }
});

// ========== CORRECTION PROMPT ==========

// GET /api/admin/prompt - Get the current correction prompt
router.get('/prompt', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('correction_prompt')
      .select('*')
      .limit(1)
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    console.error('Get prompt error:', error);
    return res.status(500).json({ error: 'Erreur chargement prompt' });
  }
});

// PUT /api/admin/prompt - Update the correction prompt
router.put('/prompt', async (req: AuthRequest, res: Response) => {
  const { prompt_text } = req.body;

  if (!prompt_text || typeof prompt_text !== 'string' || prompt_text.trim().length < 50) {
    return res.status(400).json({ error: 'Le prompt doit contenir au moins 50 caracteres' });
  }

  try {
    // Get the single prompt row
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('correction_prompt')
      .select('id')
      .limit(1)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabaseAdmin
      .from('correction_prompt')
      .update({
        prompt_text: prompt_text.trim(),
        updated_at: new Date().toISOString(),
        updated_by: req.userId || null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    console.error('Update prompt error:', error);
    return res.status(500).json({ error: 'Erreur mise a jour prompt' });
  }
});

// ========== DROPBOX ==========

// POST /api/admin/hebdos/:id/reorganize-dropbox?dry=1
// Range les livraisons d'un hebdo dans leur sous-dossier journaliste (livraisons
// deposees avant la regle du 02/10/2026). dry=1 : plan sans rien deplacer.
router.post('/hebdos/:id/reorganize-dropbox', async (req: AuthRequest, res: Response) => {
  const dryRun = String(req.query.dry || '') === '1';
  const { data: rows, error } = await supabaseAdmin
    .from('deliveries')
    .select('id, title, image_filename, drive_folder_url, paper_type:paper_types(name, drive_folder_name), hebdo:hebdo_config(label), author:profiles(full_name, email)')
    .eq('hebdo_id', String(req.params.id));
  if (error) return res.status(500).json({ error: error.message });
  const report: Array<Record<string, unknown>> = [];
  for (const d of rows || []) {
    const pt = d.paper_type as any; const hebdo = d.hebdo as any; const author = d.author as any;
    const journalistName = author?.full_name || author?.email || 'Unknown';
    const folder = { hebdoNumber: hebdo?.label || '', driveFolderName: pt?.drive_folder_name || pt?.name || 'Papier', journalistName, subject: d.title };
    const docxFileName = `${hebdo?.label || ''} - ${pt?.name || ''} - ${d.title}.docx`;
    const imageNames = String(d.image_filename || '').split(',').map((x: string) => x.trim()).filter(Boolean);
    try {
      const r = await relocateDeliveryFiles({ folder, docxFileName, imageNames, dryRun });
      if (!dryRun && !r.skipped && r.folderUrl && r.files.length > 0) {
        await supabaseAdmin.from('deliveries').update({ drive_folder_url: r.folderUrl }).eq('id', d.id);
      }
      report.push({ title: d.title, journalist: journalistName, type: pt?.name, ...r });
    } catch (err: any) {
      report.push({ title: d.title, journalist: journalistName, type: pt?.name, error: err?.message || String(err) });
    }
  }
  return res.json({ dryRun, report });
});

// ========== WORDPRESS ==========

// POST /api/admin/wordpress/test - Verify WP credentials (application password)
router.post('/wordpress/test', async (req: AuthRequest, res: Response) => {
  try {
    // Optional form values (not yet saved) so the admin can test before saving
    const body = (req.body ?? {}) as { url?: unknown; username?: unknown; appPassword?: unknown };
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const user = await testWpConnection({
      url: str(body.url),
      username: str(body.username),
      appPassword: str(body.appPassword),
    });
    return res.json({ ok: true, name: user.name });
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.message || String(error);
    return res.status(400).json({ ok: false, error: detail });
  }
});

// GET /api/admin/wordpress/post-meta/:id - Read all metas of a WP post (mu-plugin, read-only diagnostic)
router.get('/wordpress/post-meta/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'id invalide' });
  try {
    return res.json(await readWpPostMeta(id));
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.message || String(error);
    return res.status(error?.response?.status === 404 ? 404 : 400).json({ error: detail });
  }
});

// POST /api/admin/wordpress/post-meta/:id - Write metas on a WP post (mu-plugin prefixes only)
router.post('/wordpress/post-meta/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const meta = (req.body ?? {}).meta;
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'id invalide' });
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return res.status(400).json({ error: 'meta (objet) requis' });
  try {
    const written = await writeWpPostMeta(id, meta as Record<string, string | number>);
    return res.json({ written, rejected: Object.keys(meta).filter((k) => !written.includes(k)) });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || String(error) });
  }
});

// GET /api/admin/wordpress/revisions/:id - Revisions of a WP post (who saved what, when)
router.get('/wordpress/revisions/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'id invalide' });
  try {
    const [revisions, users] = await Promise.all([listWpRevisions(id), listWpUsers().catch(() => [])]);
    return res.json({ revisions, users });
  } catch (error: any) {
    const detail = error?.response?.data?.message || error?.message || String(error);
    return res.status(error?.response?.status === 404 ? 404 : 400).json({ error: detail });
  }
});

// POST /api/admin/deliveries/:id/wordpress - (Re)send a delivery to WordPress
router.post('/deliveries/:id/wordpress', (req, _res, next) => { req.setTimeout(300_000); next(); }, async (req: AuthRequest, res: Response) => {
  try {
    const post = await republishDeliveryToWordpress(String(req.params.id));
    if (!post) {
      return res.status(400).json({
        error: "Envoi WordPress echoue (module desactive ou erreur — voir l'onglet Logs)",
      });
    }
    // On renvoie aussi wp_payload : il contient editorTodo, la liste de ce qui
    // reste a saisir a la main. Sans ca l'utilisateur n'a aucun moyen de le
    // savoir depuis l'application.
    const { data: saved } = await supabaseAdmin
      .from('deliveries')
      .select('wp_payload')
      .eq('id', String(req.params.id))
      .single();

    return res.json({
      post,
      wp_payload: saved?.wp_payload ?? null,
      message: `Brouillon WordPress ${saved?.wp_payload ? 'mis a jour' : 'cree'} (#${post.id})`,
    });
  } catch (error: any) {
    console.error('Admin send to WordPress error:', error?.response?.data || error?.message || String(error));
    return res.status(500).json({ error: error?.message || 'Erreur envoi WordPress' });
  }
});

// ========== CLAUDE MODELS ==========

// GET /api/admin/models - Liste live des modèles Claude disponibles (récent → ancien)
router.get('/models', async (_req: AuthRequest, res: Response) => {
  try {
    const models = await listClaudeModels();
    return res.json(models);
  } catch (error: any) {
    console.error('List models error:', error);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des modèles', detail: error?.message || String(error) });
  }
});

// GET /api/admin/models/latest - Modèle Claude le plus récent disponible
router.get('/models/latest', async (_req: AuthRequest, res: Response) => {
  try {
    const latest = await getLatestClaudeModel();
    if (!latest) return res.status(404).json({ error: 'Aucun modèle Claude trouvé' });
    return res.json(latest);
  } catch (error: any) {
    console.error('Latest model error:', error);
    return res.status(500).json({ error: 'Impossible de détecter le dernier modèle', detail: error?.message || String(error) });
  }
});

// ========== RÉCAPITULATIF MENSUEL (PDF, envoi à la rédaction en chef) ==========

// GET /api/admin/recap/:ym/pdf - Télécharger le PDF du mois (ym = AAAA-MM)
router.get('/recap/:ym/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const { year, month } = parseMonthKey(String(req.params.ym));
    const recap = req.query.sample === '1' ? sampleRecap(year, month) : await collectMonthlyRecap(year, month);
    const pdf = await buildRecapPdf(recap);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${recapFilename(year, month)}"`);
    return res.send(pdf);
  } catch (error: any) {
    console.error('Recap pdf error:', error);
    return res.status(400).json({ error: error?.message || 'Erreur génération du récapitulatif' });
  }
});

// POST /api/admin/recap/:ym/send - Envoyer le PDF du mois par email (Alma, copie Denis)
router.post('/recap/:ym/send', async (req: AuthRequest, res: Response) => {
  try {
    const { year, month } = parseMonthKey(String(req.params.ym));
    // Corps optionnel : { to?: string[], cc?: string[], sample?: boolean } (envoi de test)
    const body = req.body || {};
    const emails = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) : undefined);
    const result = await sendMonthlyRecap(year, month, { to: emails(body.to), cc: emails(body.cc), sample: body.sample === true });
    if (!result.sent) return res.status(400).json({ error: result.reason || 'Envoi impossible' });
    return res.json(result);
  } catch (error: any) {
    console.error('Recap send error:', error);
    return res.status(500).json({ error: error?.message || 'Erreur envoi du récapitulatif' });
  }
});

// ========== APP SETTINGS ==========

// Keys that are not secrets and should be returned in clear
const NON_SECRET_KEYS = new Set([
  'REQUIRE_MFA',
  'AI_PROVIDER',
  'CLAUDE_MODEL',
  // Identifiant de workspace Anthropic : un identifiant, pas un secret.
  'ANTHROPIC_WORKSPACE_ID',
  'WORDPRESS_ENABLED',
  'WORDPRESS_URL',
  'WORDPRESS_USERNAME',
  // Cles de meta du theme / des plugins, decouvertes sur le site puis saisies
  // ici. Ce n'est pas un secret : c'est de la configuration de mapping.
  'WP_META_MAP',
  'RECAP_LAST_SENT',
  // Email : l'expéditeur et les destinataires ne sont pas des secrets.
  'RESEND_FROM_EMAIL',
  'NOTIFY_EMAIL_ALMA',
  'NOTIFY_EMAIL_DENIS',
]);

function maskValue(key: string, value: string): string {
  if (NON_SECRET_KEYS.has(key)) return value || '';
  if (!value) return '';
  return value.length > 4
    ? '\u2022'.repeat(8) + value.slice(-4)
    : '\u2022'.repeat(8);
}

// GET /api/admin/settings - List all settings (secret values masked)
router.get('/settings', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('*')
      .order('key', { ascending: true });

    if (error) throw error;

    const masked = (data || []).map((s: any) => ({
      ...s,
      value: maskValue(s.key, s.value),
    }));

    return res.json(masked);
  } catch (error) {
    console.error('Get settings error:', error);
    return res.status(500).json({ error: 'Erreur chargement settings' });
  }
});

// PUT /api/admin/settings - Update one or more settings
router.put('/settings', async (req: AuthRequest, res: Response) => {
  const { settings } = req.body;

  if (!Array.isArray(settings) || settings.length === 0) {
    return res.status(400).json({ error: 'Un tableau de settings est requis' });
  }

  try {
    const results = [];
    const failures: Array<{ key: string; reason: string }> = [];
    for (const s of settings) {
      if (!s.key || typeof s.value !== 'string') {
        failures.push({ key: s?.key ?? '?', reason: 'payload invalide (key ou value manquant)' });
        continue;
      }

      // Upsert so we tolerate keys that may not yet exist as rows
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .upsert(
          {
            key: s.key,
            value: s.value.trim(),
            updated_at: new Date().toISOString(),
            updated_by: req.userId || null,
          },
          { onConflict: 'key' },
        )
        .select()
        .single();

      if (error) {
        console.error(`Update setting ${s.key} error:`, error);
        failures.push({ key: s.key, reason: error.message });
        continue;
      }
      if (s.key === 'REQUIRE_MFA') invalidateMfaPolicyCache();
      results.push(data);
    }

    if (results.length === 0 && failures.length > 0) {
      return res.status(500).json({
        error: 'Erreur mise a jour settings',
        failures,
      });
    }

    const masked = results.map((s: any) => ({
      ...s,
      value: maskValue(s.key, s.value),
    }));

    return res.json({ updated: masked, failures });
  } catch (error: any) {
    console.error('Update settings error:', error);
    return res.status(500).json({
      error: 'Erreur mise a jour settings',
      detail: error?.message || String(error),
    });
  }
});

export default router;
