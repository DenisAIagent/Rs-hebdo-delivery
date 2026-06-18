import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { supabaseAdmin } from '../utils/supabase';
import {
  CorrectionResult,
  buildSystemPrompt,
  getPromptFromDB,
  numberEmptyLines,
  restoreStructure,
} from './correctionPrompt';

// Try the newest model first, fall back to less-loaded variants on 5xx
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;
const MAX_RETRIES_PER_MODEL = 1; // 1 retry per model — keep total latency reasonable
const RETRY_BASE_DELAY_MS = 600;

function isTransientError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  if (typeof e?.status === 'number' && e.status >= 500) return true;
  if (e?.status === 429) return true;
  const msg = (e?.message || '').toLowerCase();
  return msg.includes('overloaded') || msg.includes('unavailable') || msg.includes('rate limit');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getApiKey(): Promise<string> {
  // Prefer DB-stored key, fall back to env var
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'GEMINI_API_KEY')
      .single();
    const dbValue = data?.value?.trim();
    if (dbValue) return dbValue;
  } catch {
    // ignore, fall through to env
  }
  const envValue = process.env.GEMINI_API_KEY?.trim();
  if (envValue) return envValue;
  throw new Error('GEMINI_API_KEY non configuree (ni en base ni en variable d\'environnement)');
}

async function generateWithRetry(
  client: GoogleGenerativeAI,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  let lastError: unknown = null;
  for (const modelName of GEMINI_MODELS) {
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            correctedText: { type: SchemaType.STRING },
            corrections: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  original: { type: SchemaType.STRING },
                  corrected: { type: SchemaType.STRING },
                  type: { type: SchemaType.STRING },
                  explanation: { type: SchemaType.STRING },
                },
                required: ['original', 'corrected', 'type', 'explanation'],
              },
            },
          },
          required: ['correctedText', 'corrections'],
        },
        // Long features (sujet de couv) easily blow past 16k. 32k keeps full output for ~10k-char input.
        maxOutputTokens: 32768,
        temperature: 0.2,
      },
    });

    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const response = await model.generateContent(userMessage);
        if (attempt > 0 || modelName !== GEMINI_MODELS[0]) {
          console.warn(`[Gemini] Recovered on ${modelName} (attempt ${attempt + 1})`);
        }
        return response.response.text();
      } catch (err) {
        lastError = err;
        if (!isTransientError(err)) throw err;
        const isLastAttempt = attempt === MAX_RETRIES_PER_MODEL - 1;
        if (isLastAttempt) {
          console.warn(`[Gemini] ${modelName} unavailable, falling back to next model`);
          break;
        }
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[Gemini] ${modelName} transient error (attempt ${attempt + 1}), retrying in ${delay}ms…`);
        await sleep(delay);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini: tous les modeles ont echoue');
}

export async function correctText(text: string): Promise<CorrectionResult> {
  const apiKey = await getApiKey();
  const promptText = await getPromptFromDB();

  const client = new GoogleGenerativeAI(apiKey);
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
    // Gemini sometimes emits malformed/truncated JSON on long outputs — try to repair
    try {
      const repaired = jsonrepair(jsonText);
      result = JSON.parse(repaired);
      parseStrategy = 'repair';
      console.warn('[Gemini] Recovered using jsonrepair');
    } catch (secondErr) {
      console.error('[Gemini] JSON parse failed (direct + repair):', firstErr, secondErr);
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
    console.warn(`[Gemini] Repaired output: ${corrections.length} correction(s), ${corrected.length} chars`);
  }

  return {
    correctedText: corrected,
    corrections,
    signCount: corrected.length,
  };
}
