#!/usr/bin/env node
/**
 * Assemble index.html à partir de STORYBOARD.md et des voix off.
 *
 *   node scripts/assemble.mjs
 *
 * - Durée de chaque scène = durée de sa voix + LEAD + TAIL (la voix commence
 *   LEAD secondes après le début de la scène), arrondie au dixième.
 * - Voix : assets/vo/NN.mp3 (ElevenLabs) si présent, sinon assets/vo/NN.wav
 *   (voix système provisoire). Les durées sont mesurées avec ffprobe.
 * - Les scènes s'enchaînent par fondu enchaîné de XFADE secondes sur la piste 1,
 *   les voix sur la piste 10. La timeline racine porte uniquement les fondus.
 * - Réécrit aussi `duration:` dans STORYBOARD.md pour garder les deux en phase.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LEAD = 1.0;
const TAIL = 1.2;
const XFADE = 0.6;

const sb = readFileSync(resolve(ROOT, "STORYBOARD.md"), "utf8");
const blocks = sb.split(/^(?=## Frame )/m).slice(1);

function probe(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return parseFloat(out.toString());
}

const scenes = blocks.map((b) => {
  const id = /src: compositions\/frames\/([\w-]+)\.html/.exec(b)[1];
  const n = id.slice(0, 2);
  const mp3 = resolve(ROOT, `assets/vo/${n}.mp3`);
  const wav = resolve(ROOT, `assets/vo/${n}.wav`);
  const voFile = existsSync(mp3) ? `assets/vo/${n}.mp3` : `assets/vo/${n}.wav`;
  const vo = probe(resolve(ROOT, voFile));
  const duration = Math.round((vo + LEAD + TAIL) * 10) / 10;
  return { id, n, voFile, vo: Math.round(vo * 100) / 100, duration };
});

let t = 0;
for (const s of scenes) {
  s.start = Math.round(t * 100) / 100;
  t += s.duration - XFADE;
}
const total = Math.round((t + XFADE) * 100) / 100;

const slots = scenes
  .map(
    (s, i) => `      <div
        id="el-${s.id}"
        data-composition-id="${s.id}"
        data-composition-src="compositions/frames/${s.id}.html"
        data-start="${s.start}"
        data-duration="${s.duration}"
        data-track-index="1"
        data-width="1920"
        data-height="1080"${i === 0 ? "" : `\n        style="opacity: 0"`}
      ></div>`,
  )
  .join("\n\n");

const audios = scenes
  .map(
    (s) => `      <audio
        id="vo-${s.n}"
        src="${s.voFile}"
        data-start="${Math.round((s.start + LEAD) * 100) / 100}"
        data-duration="${s.vo}"
        data-track-index="10"
        data-volume="1"
      ></audio>`,
  )
  .join("\n\n");

const seams = scenes
  .slice(1)
  .map((s, i) => {
    const prev = scenes[i];
    const T = s.start;
    return `      tl.to("#el-${prev.id}", { opacity: 0, duration: ${XFADE}, ease: "power2.inOut" }, ${T});
      tl.fromTo("#el-${s.id}", { opacity: 0 }, { opacity: 1, duration: ${XFADE}, ease: "power2.inOut" }, ${T});`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>RS Hebdo Delivery — tutoriel</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      body {
        margin: 0;
        background: #fbf8f2;
      }
      #root {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #fbf8f2;
      }
      [data-composition-id="root"] > div[data-composition-src] {
        position: absolute;
        inset: 0;
      }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="root" data-width="1920" data-height="1080" data-duration="${total}">
${slots}

${audios}
    </div>

    <script>
      // Généré par scripts/assemble.mjs — la timeline racine ne porte que les fondus enchaînés.
      const tl = gsap.timeline({ paused: true });
${seams}
      window.__timelines["root"] = tl;
    </script>
  </body>
</html>
`;

writeFileSync(resolve(ROOT, "index.html"), html);

// Garde STORYBOARD.md en phase (durée par scène + durée totale).
let sb2 = sb.replace(/^duration: .*$/m, `duration: ${Math.round(total)}s`);
for (const s of scenes) {
  sb2 = sb2.replace(
    new RegExp(`(- duration: )[\\d.]+s(?=(?:\\n[^\\n]*){0,8}src: compositions/frames/${s.id}\\.html)`),
    `$1${s.duration}s`,
  );
}
writeFileSync(resolve(ROOT, "STORYBOARD.md"), sb2);

console.table(scenes.map(({ id, voFile, vo, start, duration }) => ({ id, voFile, vo, start, duration })));
console.log(`total: ${total}s (${Math.floor(total / 60)} min ${Math.round(total % 60)} s)`);
