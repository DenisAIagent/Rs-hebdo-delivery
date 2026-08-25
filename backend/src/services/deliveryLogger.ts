/**
 * Delivery Logger — writes structured logs to Supabase for admin visibility.
 * Each log entry captures a step in the delivery pipeline with a human-readable message.
 */

import { supabaseAdmin } from '../utils/supabase';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  journalistId?: string;
  journalistName?: string;
  hebdoLabel?: string;
  paperTypeName?: string;
  title?: string;
}

const STEP_LABELS: Record<string, string> = {
  'start':        'Demarrage livraison',
  'validation':   'Validation des champs',
  'docx':         'Generation du fichier DOCX',
  'dropbox-auth': 'Authentification Dropbox',
  'dropbox-folders': 'Creation des dossiers Dropbox',
  'dropbox-upload':  'Upload des fichiers Dropbox',
  'dropbox-link':    'Creation du lien partage Dropbox',
  'database':     'Enregistrement en base',
  'email':        'Envoi notification email',
  'success':      'Livraison terminee',
  'wp-start':     'Envoi WordPress demarre',
  'wp-links':     'Recherche liens internes WordPress',
  'wp-format':    'Mise en forme editoriale WordPress',
  'wp-tags':      'Creation des tags WordPress',
  'wp-media':     'Upload image WordPress',
  'wp-success':   'Brouillon WordPress cree',
  'wp-error':     'Echec envoi WordPress',
};

/**
 * Log a delivery event to the database.
 * Never throws — logging failures are silently caught to avoid breaking the delivery flow.
 */
export async function logDelivery(
  level: LogLevel,
  step: string,
  message: string,
  ctx: LogContext = {},
  detail?: string,
): Promise<void> {
  try {
    await supabaseAdmin.from('delivery_logs').insert({
      level,
      step,
      message,
      detail: detail || null,
      journalist_id: ctx.journalistId || null,
      journalist_name: ctx.journalistName || null,
      hebdo_label: ctx.hebdoLabel || null,
      paper_type_name: ctx.paperTypeName || null,
      title: ctx.title || null,
    });
  } catch (err) {
    // Never let logging break the delivery flow
    console.error('[DeliveryLogger] Failed to write log:', err);
  }
}

/** Shortcut for info-level log */
export function logInfo(step: string, message: string, ctx?: LogContext) {
  return logDelivery('info', step, message, ctx);
}

/** Shortcut for error-level log with detail extraction */
export function logError(step: string, message: string, ctx?: LogContext, error?: any) {
  const detail = extractErrorDetail(error);
  return logDelivery('error', step, message, ctx, detail);
}

/** Shortcut for warn-level log */
export function logWarn(step: string, message: string, ctx?: LogContext, detail?: string) {
  return logDelivery('warn', step, message, ctx, detail);
}

/**
 * Extract a readable error detail from various error shapes (Axios, Supabase, generic).
 */
function extractErrorDetail(error: any): string {
  if (!error) return '';

  // Axios / Dropbox API error
  if (error?.response?.data) {
    const d = error.response.data;
    const summary = d.error_summary || d.error?.message || d.error?.['.tag'] || '';
    const status = error.response.status || '';
    return `HTTP ${status}${summary ? ' — ' + summary : ''}: ${JSON.stringify(d).slice(0, 500)}`;
  }

  // Supabase error
  if (error?.code && error?.message) {
    return `${error.code}: ${error.message}${error.details ? ' (' + error.details + ')' : ''}`;
  }

  // Generic Error
  if (error instanceof Error) {
    return error.message;
  }

  return String(error).slice(0, 500);
}

export { STEP_LABELS };
