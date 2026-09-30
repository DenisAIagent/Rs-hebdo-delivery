#!/usr/bin/env node
/**
 * Génère la voix off de chaque scène avec ElevenLabs.
 *
 *   ELEVENLABS_API_KEY=... node scripts/elevenlabs-vo.mjs [--voice <voice_id>] [--list]
 *
 * Lit assets/vo/NN.txt (un fichier par scène, produit depuis SCRIPT.md),
 * écrit assets/vo/NN.mp3 et assets/vo/durations.json (secondes par scène).
 * Ne régénère pas un mp3 déjà présent sauf avec --force.
 *
 * Réglages voix : eleven_multilingual_v2, stabilité haute et style bas pour un
 * ton posé ; la vitesse est légèrement ralentie pour laisser le temps de suivre.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VO_DIR = resolve(ROOT, "assets/vo");
const API = "https://api.elevenlabs.io/v1";
const KEY = process.env.ELEVENLABS_API_KEY;
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

if (!KEY) {
  console.error("ELEVENLABS_API_KEY manquante (export dans ~/.zshrc ou en préfixe de la commande).");
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "xi-api-key": KEY, ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status} ${await res.text()}`);
  return res;
}

if (flag("--list")) {
  const { voices } = await (await api("/voices")).json();
  for (const v of voices) {
    const l = v.labels || {};
    console.log(`${v.voice_id}  ${v.name.padEnd(22)} ${l.language || ""} ${l.gender || ""} ${l.accent || ""} ${l.use_case || ""}`);
  }
  process.exit(0);
}

const VOICE = opt("--voice", process.env.ELEVENLABS_VOICE_ID);
if (!VOICE) {
  console.error("Voix non précisée : --voice <voice_id> (voir --list) ou ELEVENLABS_VOICE_ID.");
  process.exit(1);
}

const files = readdirSync(VO_DIR).filter((f) => /^\d\d\.txt$/.test(f)).sort();
const durations = {};
for (const f of files) {
  const n = f.slice(0, 2);
  const out = resolve(VO_DIR, `${n}.mp3`);
  const text = readFileSync(resolve(VO_DIR, f), "utf8").trim();
  if (!existsSync(out) || flag("--force")) {
    process.stdout.write(`scène ${n} … `);
    const res = await api(`/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: 0.92 },
      }),
    });
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log("ok");
  }
  const secs = parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).toString(),
  );
  durations[n] = Math.round(secs * 100) / 100;
}
writeFileSync(resolve(VO_DIR, "durations.json"), JSON.stringify(durations, null, 2) + "\n");
console.log(durations);
