/**
 * Récapitulatif mensuel des livraisons, par journaliste.
 *
 * Chaque 1er du mois (heure de Paris), le récap du mois écoulé est généré en
 * PDF et envoyé par email à la rédaction en chef (NOTIFY_EMAIL_ALMA, copie
 * NOTIFY_EMAIL_DENIS). Il liste, pour chaque compte journaliste, les papiers
 * livrés : numéro d'hebdo, format, titre, date, signes.
 *
 * Trois fonctions pures/testables (groupement, périmètre du mois, nom de
 * fichier) et trois fonctions d'effet (collecte Supabase, PDF, envoi).
 */
import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '../utils/supabase';

export interface RecapDelivery {
  id: string;
  title: string;
  deliveredAt: string; // ISO
  signCount: number;
  paperType: string;
  hebdoLabel: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
}

export interface RecapGroup {
  authorId: string;
  authorName: string;
  authorEmail: string;
  deliveries: RecapDelivery[];
  totalSigns: number;
}

export interface MonthlyRecap {
  year: number;
  month: number; // 1-12
  label: string; // "septembre 2026"
  periodStart: string; // ISO (UTC)
  periodEnd: string; // ISO (UTC, exclusive)
  groups: RecapGroup[];
  total: number;
}

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** "2026-09" -> { year: 2026, month: 9 } ; lève si le format est invalide. */
export function parseMonthKey(key: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Mois invalide : "${key}" (attendu AAAA-MM)`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`Mois invalide : "${key}"`);
  return { year, month };
}

/** Clé "AAAA-MM" du mois précédant la date donnée (heure de Paris). */
export function previousMonthKey(now: Date = new Date()): string {
  const { year, month } = parisYearMonth(now);
  const d = new Date(Date.UTC(year, month - 2, 1)); // month-1 = index courant, -1 = précédent
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Année, mois (1-12), jour et heure courants en heure de Paris. */
export function parisYearMonth(now: Date = new Date()): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24 };
}

/** Bornes UTC du mois civil (Paris ≈ UTC, la précision à l'heure près suffit ici). */
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_FR[month - 1]} ${year}`;
}

export function recapFilename(year: number, month: number): string {
  return `RS-Hebdo-recap-livraisons-${year}-${String(month).padStart(2, '0')}.pdf`;
}

/** Regroupe les livraisons par journaliste, triées par nom puis par date. */
export function groupByAuthor(deliveries: RecapDelivery[]): RecapGroup[] {
  const map = new Map<string, RecapGroup>();
  for (const d of deliveries) {
    const g = map.get(d.authorId) ?? {
      authorId: d.authorId,
      authorName: d.authorName,
      authorEmail: d.authorEmail,
      deliveries: [],
      totalSigns: 0,
    };
    map.set(d.authorId, { ...g, deliveries: [...g.deliveries, d], totalSigns: g.totalSigns + (d.signCount || 0) });
  }
  return [...map.values()]
    .map((g) => ({ ...g, deliveries: [...g.deliveries].sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt)) }))
    .sort((a, b) => a.authorName.localeCompare(b.authorName, 'fr'));
}

/** Lit les livraisons du mois dans Supabase. */
export async function collectMonthlyRecap(year: number, month: number): Promise<MonthlyRecap> {
  const { start, end } = monthBounds(year, month);
  const { data, error } = await supabaseAdmin
    .from('deliveries')
    .select(`
      id, title, sign_count, created_at, delivered_at,
      author:profiles(id, full_name, email),
      paper_type:paper_types(name),
      hebdo:hebdo_config(label)
    `)
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const deliveries: RecapDelivery[] = (data || []).map((row: any) => ({
    id: row.id,
    title: row.title || '(sans titre)',
    deliveredAt: row.delivered_at || row.created_at,
    signCount: row.sign_count || 0,
    paperType: row.paper_type?.name || '—',
    hebdoLabel: row.hebdo?.label || '—',
    authorId: row.author?.id || 'inconnu',
    authorName: row.author?.full_name || row.author?.email || 'Journaliste inconnu',
    authorEmail: row.author?.email || '',
  }));

  return {
    year, month, label: monthLabel(year, month), periodStart: start, periodEnd: end,
    groups: groupByAuthor(deliveries), total: deliveries.length,
  };
}

/** Milliers séparés par une espace classique (l'espace fine de fr-FR n'existe pas dans Helvetica). */
function fmtInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

/** Génère le PDF (A4, portrait). Renvoie un Buffer. */
export function buildRecapPdf(recap: MonthlyRecap): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Récapitulatif des livraisons — ${recap.label}`, Author: 'RS Hebdo Delivery' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const RED = '#E11D2E';
    const INK = '#16140F';
    const MUTED = '#6A6557';
    const LINE = '#D8D0BD';
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    // En-tête
    doc.rect(0, 0, doc.page.width, 6).fill(RED);
    doc.moveDown(0.5);
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('ROLLING STONE FRANCE · HEBDO DELIVERY', left, 40, { characterSpacing: 1 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(22).text('Récapitulatif des livraisons', left, 58);
    doc.fillColor(RED).font('Helvetica').fontSize(14).text(recap.label.charAt(0).toUpperCase() + recap.label.slice(1), left, 86);
    doc.fillColor(MUTED).fontSize(10).text(
      `${recap.total} papier${recap.total > 1 ? 's' : ''} livré${recap.total > 1 ? 's' : ''} par ${recap.groups.length} journaliste${recap.groups.length > 1 ? 's' : ''} · généré le ${fmtDate(new Date().toISOString())}`,
      left, 106,
    );
    doc.moveTo(left, 126).lineTo(left + width, 126).strokeColor(LINE).lineWidth(1).stroke();
    doc.y = 140;

    if (recap.groups.length === 0) {
      doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(12).text('Aucune livraison sur ce mois.', left, doc.y);
    }

    const col = { hebdo: 60, type: 120, date: 70, signes: 60 };
    const titleW = width - col.hebdo - col.type - col.date - col.signes;

    for (const g of recap.groups) {
      // Saut de page si le bloc n'a pas de place pour son en-tête + une ligne
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.moveDown(0.6);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text(g.authorName, left, doc.y);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(
        `${g.deliveries.length} papier${g.deliveries.length > 1 ? 's' : ''} · ${fmtInt(g.totalSigns)} signes${g.authorEmail ? ' · ' + g.authorEmail : ''}`,
      );
      doc.moveDown(0.4);

      // En-tête de tableau
      const hy = doc.y;
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8);
      doc.text('NUMÉRO', left, hy, { width: col.hebdo });
      doc.text('FORMAT', left + col.hebdo, hy, { width: col.type });
      doc.text('TITRE', left + col.hebdo + col.type, hy, { width: titleW });
      doc.text('DATE', left + col.hebdo + col.type + titleW, hy, { width: col.date });
      doc.text('SIGNES', left + col.hebdo + col.type + titleW + col.date, hy, { width: col.signes, align: 'right' });
      doc.moveTo(left, hy + 12).lineTo(left + width, hy + 12).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.y = hy + 16;

      for (const d of g.deliveries) {
        if (doc.y > doc.page.height - 80) doc.addPage();
        const y = doc.y;
        doc.fillColor(INK).font('Helvetica').fontSize(9.5);
        doc.text(d.hebdoLabel, left, y, { width: col.hebdo });
        doc.text(d.paperType, left + col.hebdo, y, { width: col.type });
        doc.text(d.title, left + col.hebdo + col.type, y, { width: titleW });
        const titleBottom = doc.y;
        doc.text(fmtDate(d.deliveredAt), left + col.hebdo + col.type + titleW, y, { width: col.date });
        doc.text(fmtInt(d.signCount), left + col.hebdo + col.type + titleW + col.date, y, { width: col.signes, align: 'right' });
        doc.y = Math.max(titleBottom, y + 12) + 3;
      }
    }

    // Pied de page sur chaque page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(
        `RS Hebdo Delivery — récapitulatif ${recap.label} — page ${i + 1}/${range.count}`,
        left, doc.page.height - 40, { width, align: 'center', lineBreak: false },
      );
    }
    doc.end();
  });
}

/** Envoie le PDF par email (Resend) à la rédaction en chef. */
export async function sendMonthlyRecap(year: number, month: number): Promise<{ sent: boolean; recipients: string[]; total: number; reason?: string }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'RS Hebdo <onboarding@resend.dev>';
  const to = process.env.NOTIFY_EMAIL_ALMA;
  const cc = process.env.NOTIFY_EMAIL_DENIS;
  if (!RESEND_API_KEY) return { sent: false, recipients: [], total: 0, reason: 'RESEND_API_KEY non configurée' };
  if (!to) return { sent: false, recipients: [], total: 0, reason: 'NOTIFY_EMAIL_ALMA non configurée' };

  const recap = await collectMonthlyRecap(year, month);
  const pdf = await buildRecapPdf(recap);
  const filename = recapFilename(year, month);
  const lines = recap.groups
    .map((g) => `<li><strong>${escapeHtml(g.authorName)}</strong> — ${g.deliveries.length} papier${g.deliveries.length > 1 ? 's' : ''}</li>`)
    .join('');
  const html = `
    <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; color: #16140F;">
      <div style="background:#E11D2E;color:#fff;padding:16px 20px;font-weight:bold;">Rolling Stone Hebdo Delivery</div>
      <div style="padding:20px;">
        <p>Bonjour,</p>
        <p>Voici le récapitulatif des livraisons de <strong>${escapeHtml(recap.label)}</strong>, en pièce jointe (PDF) :
        ${recap.total} papier${recap.total > 1 ? 's' : ''} livré${recap.total > 1 ? 's' : ''} par ${recap.groups.length} journaliste${recap.groups.length > 1 ? 's' : ''}.</p>
        ${lines ? `<ul>${lines}</ul>` : '<p><em>Aucune livraison sur ce mois.</em></p>'}
        <p style="color:#6A6557;font-size:12px;">Envoi automatique le 1er du mois par RS Hebdo Delivery.</p>
      </div>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      ...(cc ? { cc: [cc] } : {}),
      subject: `[Hebdo Delivery] Récapitulatif des livraisons — ${recap.label}`,
      html,
      attachments: [{ filename, content: pdf.toString('base64') }],
    }),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Resend HTTP ${response.status}: ${txt.slice(0, 200)}`);
  }
  return { sent: true, recipients: [to, ...(cc ? [cc] : [])], total: recap.total };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ */
/*  Planification : le 1er du mois à partir de 8 h (Paris), une fois.  */
/* ------------------------------------------------------------------ */

const SETTING_KEY = 'RECAP_LAST_SENT';

async function getLastSent(): Promise<string> {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', SETTING_KEY).single();
  return data?.value || '';
}

async function setLastSent(key: string): Promise<void> {
  await supabaseAdmin.from('app_settings').upsert({ key: SETTING_KEY, value: key, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

/** Décide si l'envoi automatique doit partir maintenant. Pure, testable. */
export function shouldSendNow(now: Date, lastSent: string): string | null {
  const { day, hour } = parisYearMonth(now);
  if (day !== 1 || hour < 8) return null;
  const key = previousMonthKey(now);
  return lastSent === key ? null : key;
}

/** À appeler au démarrage du serveur : vérifie toutes les 30 minutes. */
export function startMonthlyRecapScheduler(): void {
  const tick = async () => {
    try {
      const key = shouldSendNow(new Date(), await getLastSent());
      if (!key) return;
      const { year, month } = parseMonthKey(key);
      const result = await sendMonthlyRecap(year, month);
      if (result.sent) {
        await setLastSent(key);
        console.log(`[recap] récapitulatif ${key} envoyé à ${result.recipients.join(', ')} (${result.total} papiers)`);
      } else {
        console.warn(`[recap] récapitulatif ${key} non envoyé : ${result.reason}`);
      }
    } catch (err) {
      console.error('[recap] échec de l\'envoi automatique :', err instanceof Error ? err.message : err);
    }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, 30 * 60 * 1000);
}
