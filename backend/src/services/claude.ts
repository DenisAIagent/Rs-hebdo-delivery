import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../utils/supabase';
import {
  CorrectionResult,
  buildSystemPrompt,
  getPromptFromDB,
  numberEmptyLines,
  restoreStructure,
} from './correctionPrompt';

// Modèle utilisé par défaut si rien n'est configuré en base / en env.
// Sert uniquement de dernier recours : la liste live (API Anthropic) et le
// réglage CLAUDE_MODEL choisi dans l'admin priment toujours sur cette valeur.
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

export async function getApiKey(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'ANTHROPIC_API_KEY')
      .single();
    const dbValue = data?.value?.trim();
    if (dbValue) return dbValue;
  } catch {
    // ignore, fall through to env
  }
  const envValue = process.env.ANTHROPIC_API_KEY?.trim();
  if (envValue) return envValue;
  throw new Error('ANTHROPIC_API_KEY non configuree (ni en base ni en variable d\'environnement)');
}

/**
 * Modèle Claude à utiliser pour la correction.
 * Choisi par l'admin (app_settings.CLAUDE_MODEL), sinon env, sinon défaut.
 */
export async function getClaudeModel(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'CLAUDE_MODEL')
      .single();
    const dbValue = data?.value?.trim();
    if (dbValue) return dbValue;
  } catch {
    // ignore, fall through
  }
  return process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL;
}

export interface ClaudeModelInfo {
  id: string;
  display_name: string;
  created_at: string;
}

/**
 * Liste, en direct depuis l'API Anthropic, les modèles Claude disponibles
 * (triés du plus récent au plus ancien). Couvre automatiquement les modèles futurs.
 */
export async function listClaudeModels(): Promise<ClaudeModelInfo[]> {
  const apiKey = await getApiKey();
  const anthropic = new Anthropic({ apiKey, timeout: 30_000 });
  const out: ClaudeModelInfo[] = [];
  for await (const m of anthropic.models.list({ limit: 100 })) {
    if (!m.id?.startsWith('claude-')) continue;
    out.push({
      id: m.id,
      display_name: (m as any).display_name || m.id,
      created_at: (m as any).created_at || '',
    });
  }
  out.sort((a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0));
  return out;
}

/** Renvoie le modèle Claude le plus récent disponible sur le compte. */
export async function getLatestClaudeModel(): Promise<ClaudeModelInfo | null> {
  const models = await listClaudeModels();
  return models[0] ?? null;
}

// Outil de sortie structurée : force Claude à répondre dans un schéma JSON valide
// (fini le parsing fragile de texte libre / les réponses « 0 correction » fantômes).
const CORRECTION_TOOL = {
  name: 'submit_correction',
  description: "Renvoie le texte corrigé complet et la liste détaillée des corrections appliquées.",
  input_schema: {
    type: 'object' as const,
    properties: {
      correctedText: {
        type: 'string',
        description: "Le texte corrigé complet, avec les marqueurs [LIGNE_VIDE_X] conservés à leur position.",
      },
      corrections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            original: { type: 'string' },
            corrected: { type: 'string' },
            type: { type: 'string', enum: ['orthographe', 'grammaire', 'ponctuation', 'style', 'typographie'] },
            explanation: { type: 'string' },
          },
          required: ['original', 'corrected', 'type', 'explanation'],
        },
      },
    },
    required: ['correctedText', 'corrections'],
  },
};

export async function correctText(text: string): Promise<CorrectionResult> {
  const apiKey = await getApiKey();
  const promptText = await getPromptFromDB();

  const anthropic = new Anthropic({ apiKey, timeout: 120_000 });
  let model = await getClaudeModel();
  const numberedText = numberEmptyLines(text);

  // jusqu'à 2 tentatives : la sortie structurée est fiable, mais on se protège
  // d'une éventuelle troncature / aléa réseau / modèle invalide plutôt que de
  // renvoyer un faux « 0 faute ».
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 16384,
        system: buildSystemPrompt(promptText),
        tools: [CORRECTION_TOOL],
        tool_choice: { type: 'tool', name: 'submit_correction' },
        messages: [
          {
            role: 'user',
            content: `<text_to_correct>\n${numberedText}\n</text_to_correct>`,
          },
        ],
      });

      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

      if (toolUse) {
        const result = toolUse.input as { correctedText?: string; corrections?: CorrectionResult['corrections'] };
        const corrections = Array.isArray(result.corrections) ? result.corrections : [];
        const corrected = restoreStructure(text, result.correctedText || text, corrections);
        return { correctedText: corrected, corrections, signCount: corrected.length };
      }

      // Pas de bloc structuré : généralement une troncature (max_tokens) → on retente.
      lastErr = new Error(`stop_reason=${response.stop_reason}`);
      console.error(`[Correction] Pas de tool_use (tentative ${attempt}/2), stop_reason=${response.stop_reason}`);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      console.error(`[Correction] Erreur API (tentative ${attempt}/2, modèle=${model}):`, msg);
      // Modèle configuré invalide/inexistant → on bascule sur le modèle par défaut pour la 2e tentative.
      if (model !== DEFAULT_CLAUDE_MODEL && /model|not_found|404|does not exist|invalid/i.test(msg)) {
        console.warn(`[Correction] Bascule vers le modèle par défaut: ${DEFAULT_CLAUDE_MODEL}`);
        model = DEFAULT_CLAUDE_MODEL;
      }
    }
  }

  // On ne ment plus en renvoyant « 0 correction » : on remonte une vraie erreur.
  console.error('[Correction] Échec de la correction structurée:', lastErr);
  throw new Error("La correction n'a pas abouti (texte peut-être trop long ou réponse incomplète). Réessaie.");
}

// Re-export for backward compatibility with existing imports
export type { CorrectionResult } from './correctionPrompt';
