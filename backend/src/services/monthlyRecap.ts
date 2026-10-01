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

/** Jeu de données fictif pour tester la mise en page et l'envoi (bouton « test » de l'admin). */
export function sampleRecap(year: number, month: number): MonthlyRecap {
  const mm = String(month).padStart(2, '0');
  const at = (day: number, h = 10) => `${year}-${mm}-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00.000Z`;
  const mk = (id: string, authorId: string, authorName: string, title: string, paperType: string, hebdoLabel: string, signCount: number, deliveredAt: string): RecapDelivery => ({
    id, title, deliveredAt, signCount, paperType, hebdoLabel, authorId, authorName,
    authorEmail: `${authorName.toLowerCase().replace(/[^a-z]+/g, '.')}@rollingstone.fr`,
  });
  const ds = [
    mk('s1', 'alma', 'Alma Rota', 'Johnny Marr : le temps de la catharsis', 'Sujet de couv', 'RSH240', 7820, at(29, 15)),
    mk('s2', 'alma', 'Alma Rota', 'PJ Harvey, l’élégance du doute', 'Sujet de couv', 'RSH238', 8140, at(17, 11)),
    mk('s3', 'mathieu', 'Mathieu David', 'Mastodon : l’art cathartique', 'Interview 3000', 'RSH240', 3162, at(29, 18)),
    mk('s4', 'mathieu', 'Mathieu David', 'Shinedown, la revanche', 'Interview 3000', 'RSH239', 2980, at(22, 9)),
    mk('s5', 'xavier', 'Xavier Bonnet', 'The Flynts — Tame the Flame (Genuine Live In Brussels)', 'Chroniques', 'RSH240', 538, at(30)),
    mk('s6', 'xavier', 'Xavier Bonnet', 'Valley of the Sun — The Blacklight Sessions', 'Chroniques', 'RSH240', 566, at(30)),
    mk('s7', 'xavier', 'Xavier Bonnet', 'Digger', 'Chronique Cinema', 'RSH240', 616, at(30, 11)),
    mk('s8', 'xavier', 'Xavier Bonnet', 'Beck — Ride Lonesome', 'Chroniques', 'RSH239', 520, at(23)),
    mk('s9', 'samuel', 'Samuel Regnard', 'Greg Freeman — All The Set Bone', 'Chroniques', 'RSH240', 546, at(30, 12)),
    mk('s10', 'samuel', 'Samuel Regnard', 'Monstre : l’histoire de Lizzie Borden', 'Chronique Cinema', 'RSH240', 611, at(30, 12)),
    mk('s11', 'silvere', 'Silvère Vincent', 'Howlin’ Jaws — Living The Dream', 'Disque de la semaine', 'RSH240', 1049, at(29)),
    mk('s12', 'silvere', 'Silvère Vincent', 'Dééfait — 1er Album', 'Frenchie', 'RSH240', 1021, at(29)),
    mk('s13', 'silvere', 'Silvère Vincent', 'Rubber Legs', 'Frenchie', 'RSH239', 980, at(21)),
    mk('s14', 'loraine', 'Loraine Adam', 'Le clan de Walden — Catherine Meurisse', 'Livres et Expo', 'RSH240', 855, at(29, 19)),
    mk('s15', 'loraine', 'Loraine Adam', 'Hassan Hajjaj, My Rock Stars (Cité de la musique)', 'Livres et Expo', 'RSH240', 930, at(29, 19)),
    mk('s16', 'belkacem', 'Belkacem Bahlouli', 'Girls in Hawaii', 'Chronique Coup de Coeur', 'RSH239', 1410, at(22, 14)),
  ];
  const { start, end } = monthBounds(year, month);
  return { year, month, label: monthLabel(year, month), periodStart: start, periodEnd: end, groups: groupByAuthor(ds), total: ds.length };
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
    const PAPER2 = '#F5F0E6';

    // Synthèse : un tableau journaliste / papiers / signes
    if (recap.groups.length > 0) {
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('Synthèse', left, doc.y);
      doc.moveDown(0.3);
      const sy = doc.y;
      const cName = width - 160;
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8);
      doc.text('JOURNALISTE', left + 8, sy + 4, { width: cName });
      doc.text('PAPIERS', left + cName, sy + 4, { width: 70, align: 'right' });
      doc.text('SIGNES', left + cName + 80, sy + 4, { width: 72, align: 'right' });
      doc.y = sy + 18;
      recap.groups.forEach((g, i) => {
        const ry = doc.y;
        if (i % 2 === 0) doc.rect(left, ry - 3, width, 17).fill(PAPER2);
        doc.fillColor(INK).font('Helvetica').fontSize(9.5);
        doc.text(g.authorName, left + 8, ry, { width: cName, lineBreak: false });
        doc.text(String(g.deliveries.length), left + cName, ry, { width: 70, align: 'right', lineBreak: false });
        doc.text(fmtInt(g.totalSigns), left + cName + 80, ry, { width: 72, align: 'right', lineBreak: false });
        doc.y = ry + 17;
      });
      const ty = doc.y;
      doc.moveTo(left, ty - 1).lineTo(left + width, ty - 1).strokeColor(INK).lineWidth(0.8).stroke();
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5);
      doc.text('Total', left + 8, ty + 3, { width: cName, lineBreak: false });
      doc.text(String(recap.total), left + cName, ty + 3, { width: 70, align: 'right', lineBreak: false });
      doc.text(fmtInt(recap.groups.reduce((n, g) => n + g.totalSigns, 0)), left + cName + 80, ty + 3, { width: 72, align: 'right', lineBreak: false });
      doc.y = ty + 30;
    }

    for (const g of recap.groups) {
      // Saut de page si le bloc n'a pas de place pour son en-tête + une ligne
      if (doc.y > doc.page.height - 160) doc.addPage();
      doc.moveDown(0.8);
      const gy = doc.y;
      doc.rect(left, gy, 3, 30).fill(RED);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text(g.authorName, left + 12, gy);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(
        `${g.deliveries.length} papier${g.deliveries.length > 1 ? 's' : ''} · ${fmtInt(g.totalSigns)} signes${g.authorEmail ? ' · ' + g.authorEmail : ''}`,
        left + 12,
      );
      doc.moveDown(0.5);

      // En-tête de tableau
      const hy = doc.y;
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8);
      doc.text('NUMÉRO', left + 8, hy, { width: col.hebdo });
      doc.text('FORMAT', left + col.hebdo, hy, { width: col.type });
      doc.text('TITRE', left + col.hebdo + col.type, hy, { width: titleW });
      doc.text('DATE', left + col.hebdo + col.type + titleW, hy, { width: col.date });
      doc.text('SIGNES', left + col.hebdo + col.type + titleW + col.date, hy, { width: col.signes - 8, align: 'right' });
      doc.moveTo(left, hy + 12).lineTo(left + width, hy + 12).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.y = hy + 16;

      g.deliveries.forEach((d, i) => {
        if (doc.y > doc.page.height - 80) doc.addPage();
        const y = doc.y;
        // hauteur réelle du titre pour peindre la bande alternée
        doc.font('Helvetica').fontSize(9.5);
        const th = doc.heightOfString(d.title, { width: titleW - 8 });
        const rowH = Math.max(th, 11) + 6;
        if (i % 2 === 0) doc.rect(left, y - 3, width, rowH).fill(PAPER2);
        doc.fillColor(INK).font('Helvetica').fontSize(9.5);
        doc.text(d.hebdoLabel, left + 8, y, { width: col.hebdo, lineBreak: false });
        doc.text(d.paperType, left + col.hebdo, y, { width: col.type, lineBreak: false });
        doc.text(d.title, left + col.hebdo + col.type, y, { width: titleW - 8 });
        doc.text(fmtDate(d.deliveredAt), left + col.hebdo + col.type + titleW, y, { width: col.date, lineBreak: false });
        doc.text(fmtInt(d.signCount), left + col.hebdo + col.type + titleW + col.date, y, { width: col.signes - 8, align: 'right', lineBreak: false });
        doc.y = y + rowH;
      });
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
export interface SendRecapOptions {
  /** Destinataires de remplacement (test) ; par défaut NOTIFY_EMAIL_ALMA + copie NOTIFY_EMAIL_DENIS. */
  to?: string[];
  cc?: string[];
  /** Utiliser le jeu de données fictif au lieu de la base (test de mise en page). */
  sample?: boolean;
}

export async function sendMonthlyRecap(year: number, month: number, opts: SendRecapOptions = {}): Promise<{ sent: boolean; recipients: string[]; total: number; reason?: string }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'RS Hebdo <onboarding@resend.dev>';
  const to = opts.to?.length ? opts.to : [process.env.NOTIFY_EMAIL_ALMA].filter(Boolean) as string[];
  const cc = opts.cc ?? ([process.env.NOTIFY_EMAIL_DENIS].filter(Boolean) as string[]);
  if (!RESEND_API_KEY) return { sent: false, recipients: [], total: 0, reason: 'RESEND_API_KEY non configurée' };
  if (to.length === 0) return { sent: false, recipients: [], total: 0, reason: 'NOTIFY_EMAIL_ALMA non configurée' };

  const recap = opts.sample ? sampleRecap(year, month) : await collectMonthlyRecap(year, month);
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
        ${opts.sample ? '<p style="color:#B30E1F;font-size:12px;"><strong>Envoi de test : les articles de ce récapitulatif sont fictifs.</strong></p>' : ''}
        <p style="color:#6A6557;font-size:12px;">Envoi automatique le 1er du mois par RS Hebdo Delivery.</p>
      </div>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      ...(cc.length ? { cc } : {}),
      subject: `[Hebdo Delivery] Récapitulatif des livraisons — ${recap.label}${opts.sample ? ' (TEST, données fictives)' : ''}`,
      html,
      attachments: [{ filename, content: pdf.toString('base64') }],
    }),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Resend HTTP ${response.status}: ${txt.slice(0, 200)}`);
  }
  return { sent: true, recipients: [...to, ...cc], total: recap.total };
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
