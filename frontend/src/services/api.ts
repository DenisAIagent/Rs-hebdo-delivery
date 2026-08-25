import axios from 'axios';
import { supabase } from '../lib/supabase.ts';
import type { PaperType, HebdoConfig, Delivery, CorrectionResult, Profile, CorrectionPrompt, DeliveryLog, AppSetting } from '../types/index.ts';

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

export async function prepareHebdo(hebdoId: string): Promise<{ message: string; folderUrl?: string }> {
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

export async function adminCreateJournalist(j: { email: string; full_name: string; password: string; role?: string }): Promise<Profile> {
  const { data } = await api.post('/api/admin/journalists', j);
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

export async function adminGetDeliveries(): Promise<Delivery[]> {
  const { data } = await api.get('/api/admin/deliveries');
  return data;
}

export async function adminGetDelivery(id: string): Promise<Delivery> {
  const { data } = await api.get(`/api/admin/deliveries/${id}`);
  return data;
}

export async function adminUpdateDelivery(id: string, metadata: Record<string, any>, title: string): Promise<{ delivery: Delivery; message: string }> {
  const { data } = await api.put(`/api/admin/deliveries/${id}`, { title, metadata: JSON.stringify(metadata) });
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
export async function adminTestWordpress(): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const { data } = await api.post('/api/admin/wordpress/test', {}, { timeout: 30000 });
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error || err?.message || 'Erreur de connexion' };
  }
}

export async function adminSendDeliveryToWordpress(
  id: string,
): Promise<{ post: { id: number; link: string; editUrl: string }; message: string }> {
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
