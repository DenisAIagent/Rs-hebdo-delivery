import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { jsonrepair } from 'jsonrepair';
import {
  CorrectionResult,
  buildSystemPrompt,
  getPromptFromDB,
  numberEmptyLines,
  restoreStructure,
} from './correctionPrompt';

// Local-only provider: spawns the Claude Code CLI on the host machine.
// Useful as a fallback when API credits are exhausted. Will fail on Railway/serverless
// because the `claude` binary is not installed in the production runtime.

const CLAUDE_BIN = process.env.CLAUDE_CODE_BIN || 'claude';
const DEFAULT_MODEL = process.env.CLAUDE_CODE_MODEL || 'sonnet';
const TIMEOUT_MS = 300_000; // 5 min

interface CCResult {
  type: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  total_cost_usd?: number;
}

function runClaudeCli(systemPrompt: string, userMessage: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Strip ANTHROPIC_API_KEY so Claude Code falls back to OAuth (user's Claude subscription).
    // Without this, CC tries the API key first — which is exactly the empty-credits one the user is escaping from.
    const cleanEnv = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;
    delete cleanEnv.ANTHROPIC_AUTH_TOKEN;

    const child = spawn(
      CLAUDE_BIN,
      [
        '--print',
        '--output-format', 'json',
        '--model', DEFAULT_MODEL,
        '--system-prompt', systemPrompt, // replace default system prompt entirely (no CLAUDE.md, no memory)
        '--no-session-persistence', // each call is independent (no state on disk)
        '--exclude-dynamic-system-prompt-sections', // skip per-machine sections for cache reuse + speed
        '--max-budget-usd', '1', // cap runaway cost per call
        '--tools', '', // disable all tools — correction never needs Bash/Edit/etc.
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: cleanEnv,
        cwd: tmpdir(), // run from /tmp so CLAUDE.md / project plugins are NOT auto-discovered
      },
    );

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try { child.kill('SIGTERM'); } catch { /* noop */ }
      const err = new Error('Claude Code: timeout (5 min). Le binaire est peut-etre bloque ou non authentifie.');
      (err as any).status = 504;
      reject(err);
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        const e = new Error(
          'Binaire `claude` introuvable sur ce serveur. Le mode Claude Code local ne fonctionne que sur la machine du developpeur.',
        );
        (e as any).status = 501;
        reject(e);
        return;
      }
      reject(err);
    });

    child.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      if (code !== 0) {
        const err = new Error(
          `Claude Code a echoue (code ${code}). ${stderr.trim().slice(0, 200) || 'pas de stderr.'}`,
        );
        (err as any).status = 502;
        reject(err);
        return;
      }
      resolve(stdout);
    });

    // Send the user message via stdin
    child.stdin.write(userMessage);
    child.stdin.end();
  });
}

export async function correctText(text: string): Promise<CorrectionResult> {
  const promptText = await getPromptFromDB();
  const numberedText = numberEmptyLines(text);
  const userMessage = `<text_to_correct>\n${numberedText}\n</text_to_correct>`;

  const raw = await runClaudeCli(buildSystemPrompt(promptText), userMessage);

  // Outer envelope from Claude Code: {type: "result", result: "<our JSON string>", ...}
  let envelope: CCResult;
  try {
    envelope = JSON.parse(raw);
  } catch (e) {
    console.error('[ClaudeCode] Failed to parse CLI envelope:', e);
    const err = new Error('Reponse Claude Code invalide (enveloppe JSON cassee).');
    (err as any).status = 502;
    throw err;
  }

  if (envelope.is_error || envelope.subtype !== 'success' || typeof envelope.result !== 'string') {
    const err = new Error(`Claude Code a renvoye une erreur: ${envelope.result || envelope.subtype || 'inconnue'}`);
    (err as any).status = 502;
    throw err;
  }

  // Inner JSON: our correction format
  let innerText = envelope.result.trim();
  if (innerText.startsWith('```')) {
    innerText = innerText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let inner: any = null;
  let parseStrategy: 'direct' | 'repair' = 'direct';
  try {
    inner = JSON.parse(innerText);
  } catch (firstErr) {
    try {
      inner = JSON.parse(jsonrepair(innerText));
      parseStrategy = 'repair';
      console.warn('[ClaudeCode] Recovered using jsonrepair');
    } catch (secondErr) {
      console.error('[ClaudeCode] Inner JSON parse failed (direct + repair):', firstErr, secondErr);
      const err = new Error('Reponse Claude Code invalide (JSON interne cassee).');
      (err as any).status = 502;
      throw err;
    }
  }

  const corrections = Array.isArray(inner?.corrections) ? inner.corrections : [];
  const correctedRaw = typeof inner?.correctedText === 'string' ? inner.correctedText : text;
  const corrected = restoreStructure(text, correctedRaw, corrections);

  if (parseStrategy === 'repair') {
    console.warn(`[ClaudeCode] Repaired output: ${corrections.length} correction(s), ${corrected.length} chars`);
  }
  if (typeof envelope.total_cost_usd === 'number') {
    console.warn(`[ClaudeCode] Cost: $${envelope.total_cost_usd.toFixed(4)}`);
  }

  return {
    correctedText: corrected,
    corrections,
    signCount: corrected.length,
  };
}
