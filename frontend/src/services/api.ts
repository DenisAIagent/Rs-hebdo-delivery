import axios from 'axios';
import { supabase } from '../lib/supabase.ts';
import type { PaperType, HebdoConfig, Delivery, CorrectionResult, Profile, CorrectionPrompt, DeliveryLog, AppSetting, AgentsResponse, EditorialAgent, AgentVersion } from '../types/index.ts';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
});

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ========== SETUP (public, no auth) ==========
export async function getSetupStatus(): Promise<{ configured: boolean }> {
  const { data } = await api.get('/api/setup/status');
  return data;
}

export async function postSetupConfigure(settings: { key: string; value: string }[]): Promise<void> {
  await api.post('/api/setup/configure', { settings });
}

// ========== AUTH ==========
/** Politique d'authentification (publique) : la 2FA est-elle exigee ? */
export async function getAuthConfig(): Promise<{ mfaRequired: boolean }> {
  try {
    const { data } = await api.get('/api/auth/config', { timeout: 10000 });
    return { mfaRequired: data?.mfaRequired === true };
  } catch {
    return { mfaRequired: false };
  }
}

export async function getProfile(): Promise<Profile> {
  const { data } = await api.get('/api/auth/profile');
  return data.user;
}

// ========== DELIVERIES ==========
export async function getMyDeliveries(): Promise<Delivery[]> {
  const { data } = await api.get('/api/deliveries');
  return data;
}

export async function getCurrentHebdo(): Promise<HebdoConfig | null> {
  const { data } = await api.get('/api/deliveries/current-hebdo');
  return data;
}

export async function getNextHebdo(): Promise<HebdoConfig | null> {
  const { data } = await api.get('/api/deliveries/hebdos');
  return data;
}

export async function prepareHebdo(hebdoId: string): Promise<{ message: string }> {
  const { data } = await api.post('/api/deliveries/prepare-hebdo', { hebdo_id: hebdoId }, { timeout: 60000 });
  return data;
}

export async function getActivePaperTypes(): Promise<PaperType[]> {
  const { data } = await api.get('/api/deliveries/paper-types');
  return data;
}

export async function submitDelivery(formData: FormData): Promise<{ delivery: Delivery; drive: { folderUrl: string }; message: string }> {
  const { data } = await api.post('/api/deliveries', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 900000, // 15 min — accommodates large photo uploads
  });
  return data;
}

export async function getDelivery(id: string): Promise<Delivery> {
  const { data } = await api.get(`/api/deliveries/${id}`);
  return data;
}

export async function updateDelivery(id: string, formData: FormData): Promise<{ delivery: Delivery; drive: { folderUrl: string }; message: string }> {
  const { data } = await api.put(`/api/deliveries/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 900000, // 15 min — accommodates large photo uploads
  });
  return data;
}

// ========== CORRECTION ==========
export async function correctText(text: string): Promise<CorrectionResult> {
  const { data } = await api.post('/api/correct', { text }, { timeout: 120000 });
  return data;
}

// ========== ADMIN ==========
export async function adminGetPaperTypes(): Promise<PaperType[]> {
  const { data } = await api.get('/api/admin/paper-types');
  return data;
}

export async function adminCreatePaperType(pt: Partial<PaperType>): Promise<PaperType> {
  const { data } = await api.post('/api/admin/paper-types', pt);
  return data;
}

export async function adminUpdatePaperType(id: string, pt: Partial<PaperType>): Promise<PaperType> {
  const { data } = await api.put(`/api/admin/paper-types/${id}`, pt);
  return data;
}

export async function adminDeletePaperType(id: string): Promise<void> {
  await api.delete(`/api/admin/paper-types/${id}`);
}

// ========== AGENTS IA ==========
export async function adminGetAgents(): Promise<AgentsResponse> {
  const { data } = await api.get('/api/admin/agents');
  return data;
}

export async function adminUpdateAgent(id: string, patch: Partial<EditorialAgent>): Promise<EditorialAgent> {
  const { data } = await api.put(`/api/admin/agents/${id}`, patch);
  return data;
}

export async function adminGetAgentVersions(id: string): Promise<AgentVersion[]> {
  const { data } = await api.get(`/api/admin/agents/${id}/versions`);
  return data;
}

export async function adminRestoreAgentVersion(id: string, version: number): Promise<EditorialAgent> {
  const { data } = await api.post(`/api/admin/agents/${id}/restore/${version}`);
  return data;
}

export async function adminGetHebdos(): Promise<HebdoConfig[]> {
  const { data } = await api.get('/api/admin/hebdo');
  return data;
}

export async function adminCreateHebdo(numero: number, start_date?: string, end_date?: string): Promise<HebdoConfig> {
  const { data } = await api.post('/api/admin/hebdo', { numero, start_date, end_date });
  return data;
}

export async function adminSetCurrentHebdo(id: string): Promise<HebdoConfig> {
  const { data } = await api.put(`/api/admin/hebdo/${id}/set-current`);
  return data;
}

export interface HebdoStatusItem {
  paper_type_id: string;
  name: string;
  count: number;
  deliveries: { title: string; author: string; status: string }[];
}

export async function adminGetHebdoStatus(hebdoId: string): Promise<HebdoStatusItem[]> {
  const { data } = await api.get(`/api/admin/hebdo/${hebdoId}/status`);
  return data;
}

export async function adminGetJournalists(): Promise<Profile[]> {
  const { data } = await api.get('/api/admin/journalists');
  return data;
}

export interface InvitationResult {
  sent: boolean;
  reason?: string;
}

/** Cree le compte sans mot de passe ; la personne recoit un email pour le definir. */
export async function adminCreateJournalist(
  j: { email: string; full_name: string; role?: string },
): Promise<Profile & { invitation?: InvitationResult }> {
  const { data } = await api.post('/api/admin/journalists', j);
  return data;
}

/** Renvoie le lien pour definir le mot de passe (lien expire, email perdu...). */
export async function adminInviteJournalist(id: string): Promise<{ message: string }> {
  const { data } = await api.post(`/api/admin/journalists/${id}/invite`);
  return data;
}

export async function adminUpdateJournalist(id: string, j: Partial<Profile>): Promise<Profile> {
  const { data } = await api.put(`/api/admin/journalists/${id}`, j);
  return data;
}

export async function adminResetJournalistMfa(id: string): Promise<{ message: string }> {
  const { data } = await api.delete(`/api/admin/journalists/${id}/mfa`);
  return data;
}

// ========== CANARI (surveillance) ==========
export interface CanaryComponentState {
  status: 'ok' | 'down';
  since: string;
  detail?: string | null;
  last_checked?: string;
}

export interface CanaryStatus {
  /** Base Supabase, controlee par le serveur Railway (null tant qu'aucun controle). */
  supabase: CanaryComponentState | null;
  /** Serveur Railway, controle par la base (pg_cron). */
  railway: CanaryComponentState | null;
  ctoCount: number;
}

export async function adminGetCanary(): Promise<CanaryStatus> {
  const { data } = await api.get('/api/admin/canary');
  return data;
}

export async function adminRunCanary(): Promise<{ supabase: CanaryComponentState }> {
  const { data } = await api.post('/api/admin/canary/run');
  return data;
}

export async function adminTestCanaryAlert(): Promise<{ message: string }> {
  const { data } = await api.post('/api/admin/canary/test');
  return data;
}

export async function adminGetDeliveries(): Promise<Delivery[]> {
  const { data } = await api.get('/api/admin/deliveries');
  return data;
}

export async function adminGetDelivery(id: string): Promise<Delivery> {
  const { data } = await api.get(`/api/admin/deliveries/${id}`);
  return data;
}

export async function adminUpdateDelivery(
  id: string,
  metadata: Record<string, any>,
  title: string,
  authorId?: string,
): Promise<{ delivery: Delivery; message: string }> {
  const { data } = await api.put(`/api/admin/deliveries/${id}`, {
    title,
    metadata: JSON.stringify(metadata),
    ...(authorId ? { author_id: authorId } : {}),
  });
  return data;
}

/** Reattribue une livraison a un autre journaliste (admin). */
export async function adminReassignDelivery(
  id: string,
  authorId: string,
): Promise<{ delivery: Delivery; message: string }> {
  const { data } = await api.put(`/api/admin/deliveries/${id}`, { author_id: authorId });
  return data;
}

export async function adminDeleteDelivery(id: string): Promise<void> {
  await api.delete(`/api/admin/deliveries/${id}`);
}

// ========== DELIVERY LOGS ==========
export async function adminGetLogs(level?: string): Promise<DeliveryLog[]> {
  const params = level ? `?level=${level}` : '';
  const { data } = await api.get(`/api/admin/logs${params}`);
  return data;
}

// ========== CORRECTION PROMPT ==========
export async function adminGetPrompt(): Promise<CorrectionPrompt> {
  const { data } = await api.get('/api/admin/prompt');
  return data;
}

export async function adminUpdatePrompt(prompt_text: string): Promise<CorrectionPrompt> {
  const { data } = await api.put('/api/admin/prompt', { prompt_text });
  return data;
}

// ========== SETTINGS ==========
export async function adminGetSettings(): Promise<AppSetting[]> {
  const { data } = await api.get('/api/admin/settings');
  return data;
}

export async function adminUpdateSettings(
  settings: { key: string; value: string }[],
): Promise<{ updated: AppSetting[]; failures: Array<{ key: string; reason: string }> }> {
  const { data } = await api.put('/api/admin/settings', { settings });
  // Backward compat: legacy shape was a bare array
  if (Array.isArray(data)) return { updated: data, failures: [] };
  return {
    updated: data?.updated ?? [],
    failures: data?.failures ?? [],
  };
}

// ========== WORDPRESS ==========
export async function adminTestWordpress(
  values: { url?: string; username?: string; appPassword?: string } = {},
): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const { data } = await api.post('/api/admin/wordpress/test', values, { timeout: 30000 });
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error || err?.message || 'Erreur de connexion' };
  }
}

export async function adminSendDeliveryToWordpress(
  id: string,
): Promise<{
  post: { id: number; link: string; editUrl: string; metaRejected?: string[] };
  /** Contient editorTodo : la liste de ce qui reste a saisir dans l'editeur classique. */
  wp_payload: Record<string, any> | null;
  message: string;
}> {
  const { data } = await api.post(`/api/admin/deliveries/${id}/wordpress`, {}, { timeout: 300000 });
  return data;
}

export interface ClaudeModelInfo {
  id: string;
  display_name: string;
  created_at: string;
}

export async function adminGetModels(): Promise<ClaudeModelInfo[]> {
  const { data } = await api.get('/api/admin/models', { timeout: 30000 });
  return data;
}

export async function adminGetLatestModel(): Promise<ClaudeModelInfo> {
  const { data } = await api.get('/api/admin/models/latest', { timeout: 30000 });
  return data;
}

// ========== Récapitulatif mensuel ==========

/** PDF du récapitulatif du mois (AAAA-MM), à télécharger côté navigateur. */
export async function adminDownloadRecap(ym: string): Promise<Blob> {
  const { data } = await api.get(`/api/admin/recap/${ym}/pdf`, { responseType: 'blob' });
  return data;
}

/** Envoie le récapitulatif du mois par email à la rédaction en chef. */
export async function adminSendRecap(ym: string): Promise<{ sent: boolean; recipients: string[]; total: number }> {
  const { data } = await api.post(`/api/admin/recap/${ym}/send`);
  return data;
}
