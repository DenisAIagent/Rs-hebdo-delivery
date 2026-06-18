import { supabaseAdmin } from '../utils/supabase';
import { correctText as correctWithClaude } from './claude';
import { correctText as correctWithGemini } from './gemini';
import { correctText as correctWithMistral } from './mistral';
import { correctText as correctWithClaudeCode } from './claudeCode';
import type { CorrectionResult } from './correctionPrompt';

export type AIProvider = 'anthropic' | 'gemini' | 'mistral' | 'claude-code';

const DEFAULT_PROVIDER: AIProvider = 'anthropic';
const VALID_PROVIDERS: ReadonlyArray<AIProvider> = ['anthropic', 'gemini', 'mistral', 'claude-code'];

export async function getActiveProvider(): Promise<AIProvider> {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'AI_PROVIDER')
      .single();
    if (error || !data?.value) return DEFAULT_PROVIDER;
    const v = data.value.trim().toLowerCase() as AIProvider;
    return VALID_PROVIDERS.includes(v) ? v : DEFAULT_PROVIDER;
  } catch {
    return DEFAULT_PROVIDER;
  }
}

export async function correctText(text: string): Promise<CorrectionResult & { provider: AIProvider }> {
  const provider = await getActiveProvider();
  let result: CorrectionResult;
  switch (provider) {
    case 'gemini':
      result = await correctWithGemini(text);
      break;
    case 'mistral':
      result = await correctWithMistral(text);
      break;
    case 'claude-code':
      result = await correctWithClaudeCode(text);
      break;
    case 'anthropic':
    default:
      result = await correctWithClaude(text);
      break;
  }
  return { ...result, provider };
}
