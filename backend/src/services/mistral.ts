import { Mistral } from '@mistralai/mistralai';
import { jsonrepair } from 'jsonrepair';
import { supabaseAdmin } from '../utils/supabase';
import {
  CorrectionResult,
  buildSystemPrompt,
  getPromptFromDB,
  numberEmptyLines,
  restoreStructure,
} from './correctionPrompt';

// Try the most capable model first, fall back to small on quota/5xx
const MISTRAL_MODELS = ['mistral-large-latest', 'mistral-small-latest'] as const;
const MAX_RETRIES_PER_MODEL = 1;
const RETRY_BASE_DELAY_MS = 600;

function isTransientError(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number; message?: string };
  const code = e?.statusCode ?? e?.status;
  if (typeof code === 'number' && code >= 500) return true;
  if (code === 429) return true;
  const msg = (e?.message || '').toLowerCase();
  return msg.includes('overloaded') || msg.includes('unavailable') || msg.includes('rate limit') || msg.includes('too many');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getApiKey(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'MISTRAL_API_KEY')
      .single();
    const dbValue = data?.value?.trim();
    if (dbValue) return dbValue;
  } catch {
    // ignore, fall through to env
  }
  const envValue = process.env.MISTRAL_API_KEY?.trim();
  if (envValue) return envValue;
  throw new Error('MISTRAL_API_KEY non configuree (ni en base ni en variable d\'environnement)');
}

async function generateWithRetry(
  client: Mistral,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  let lastError: unknown = null;
  for (const modelName of MISTRAL_MODELS) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const response = await client.chat.complete(
          {
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            responseFormat: { type: 'json_object' },
            maxTokens: 32768,
            temperature: 0.2,
          },
          {
            // 5 min — long French features may take 30-90s on mistral-large
            timeoutMs: 300_000,
          },
        );

        const content = response.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content) {
          throw new Error('Mistral: reponse vide');
        }
        if (attempt > 0 || modelName !== MISTRAL_MODELS[0]) {
          console.warn(`[Mistral] Recovered on ${modelName} (attempt ${attempt + 1})`);
        }
        return content;
      } catch (err) {
        lastError = err;
        if (!isTransientError(err)) throw err;
        const isLastAttempt = attempt === MAX_RETRIES_PER_MODEL - 1;
        if (isLastAttempt) {
          console.warn(`[Mistral] ${modelName} unavailable, falling back to next model`);
          break;
        }
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[Mistral] ${modelName} transient error (attempt ${attempt + 1}), retrying in ${delay}ms…`);
        await sleep(delay);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Mistral: tous les modeles ont echoue');
}

export async function correctText(text: string): Promise<CorrectionResult> {
  const apiKey = await getApiKey();
  const promptText = await getPromptFromDB();

  const client = new Mistral({ apiKey });
  const numberedText = numberEmptyLines(text);
  const userMessage = `<text_to_correct>\n${numberedText}\n</text_to_correct>`;

  const raw = await generateWithRetry(client, buildSystemPrompt(promptText), userMessage);

  let jsonText = raw.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let result: any = null;
  let parseStrategy: 'direct' | 'repair' = 'direct';
  try {
    result = JSON.parse(jsonText);
  } catch (firstErr) {
    try {
      const repaired = jsonrepair(jsonText);
      result = JSON.parse(repaired);
      parseStrategy = 'repair';
      console.warn('[Mistral] Recovered using jsonrepair');
    } catch (secondErr) {
      console.error('[Mistral] JSON parse failed (direct + repair):', firstErr, secondErr);
      const truncated = !jsonText.trim().endsWith('}');
      const err = new Error(
        truncated
          ? 'Reponse IA tronquee (texte trop long). Reessayez ou raccourcissez le texte.'
          : 'Reponse IA invalide. Reessayez.',
      );
      (err as any).status = 502;
      throw err;
    }
  }

  const corrections = Array.isArray(result?.corrections) ? result.corrections : [];
  const correctedRaw = typeof result?.correctedText === 'string' ? result.correctedText : text;
  const corrected = restoreStructure(text, correctedRaw, corrections);

  if (parseStrategy === 'repair') {
    console.warn(`[Mistral] Repaired output: ${corrections.length} correction(s), ${corrected.length} chars`);
  }

  return {
    correctedText: corrected,
    corrections,
    signCount: corrected.length,
  };
}
