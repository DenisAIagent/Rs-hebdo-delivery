#!/usr/bin/env node
/**
 * Assemble index.html pour la version courte (une seule voix off continue).
 *
 *   node scripts/assemble45.mjs
 *
 * Lit assets/vo45/beats.json : { "vo": "assets/vo45/manon-take1.mp3",
 *   "lead": 1.0, "tail": 1.6, "xfade": 0.5,
 *   "beats": [ { "id": "s1-ouverture", "start": 0.0 }, ... ] }
 * `start` est la position (en secondes, dans le fichier voix) où commence la
 * phrase de la scène ; la scène démarre XFADE/2 avant, pour que le fondu soit
 * fini quand la phrase commence. La dernière scène court jusqu'à la fin de la
 * voix + tail. Réécrit aussi les `duration:` du STORYBOARD.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(resolve(ROOT, "assets/vo45/beats.json"), "utf8"));
const { vo, lead = 1.0, tail = 1.6, xfade = 0.5, beats } = cfg;
const r2 = (x) => Math.round(x * 100) / 100;

const voDur = parseFloat(
  execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", resolve(ROOT, vo)]).toString(),
);
const total = r2(lead + voDur + tail);

// Début de scène (temps vidéo) = lead + start(phrase) - xfade/2 ; la 1re à 0.
const scenes = beats.map((b, i) => ({
  ...b,
  begin: i === 0 ? 0 : r2(lead + b.start - xfade / 2),
}));
scenes.forEach((s, i) => {
  const next = scenes[i + 1];
  s.end = next ? r2(next.begin + xfade) : total;
  s.duration = r2(s.end - s.begin);
});

const slots = scenes
  .map(
    (s, i) => `      <div
        id="el-${s.id}"
        data-composition-id="${s.id}"
        data-composition-src="compositions/frames/${s.id}.html"
        data-start="${s.begin}"
        data-duration="${s.duration}"
        data-track-index="1"
        data-width="1920"
        data-height="1080"${i === 0 ? "" : `\n        style="opacity: 0"`}
      ></div>`,
  )
  .join("\n\n");

const seams = scenes
  .slice(1)
  .map(
    (s, i) => `      tl.to("#el-${scenes[i].id}", { opacity: 0, duration: ${xfade}, ease: "power2.inOut" }, ${s.begin});
      tl.fromTo("#el-${s.id}", { opacity: 0 }, { opacity: 1, duration: ${xfade}, ease: "power2.inOut" }, ${s.begin});`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>RS Hebdo Delivery — présentation</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      body { margin: 0; background: #fbf8f2; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fbf8f2; }
      [data-composition-id="root"] > div[data-composition-src] { position: absolute; inset: 0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="root" data-width="1920" data-height="1080" data-duration="${total}">
${slots}

      <audio
        id="vo-manon"
        src="${vo}"
        data-start="${lead}"
        data-duration="${r2(voDur)}"
        data-track-index="10"
        data-volume="1"
      ></audio>
    </div>

    <script>
      // Généré par scripts/assemble45.mjs — la timeline racine ne porte que les fondus enchaînés.
      const tl = gsap.timeline({ paused: true });
${seams}
      // Fondu final sur le papier nu.
      tl.to("#el-${scenes[scenes.length - 1].id}", { opacity: 0, duration: 0.8, ease: "power2.inOut" }, ${r2(total - 0.8)});
      window.__timelines["root"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(resolve(ROOT, "index.html"), html);

let sb = readFileSync(resolve(ROOT, "STORYBOARD.md"), "utf8");
sb = sb.replace(/^duration: .*$/m, `duration: ${Math.round(total)}s`);
for (const s of scenes) {
  sb = sb.replace(
    new RegExp(`(- duration: )[\\d.]+s(?=(?:\\n[^\\n]*){0,8}src: compositions/frames/${s.id}\\.html)`),
    `$1${s.duration}s`,
  );
}
writeFileSync(resolve(ROOT, "STORYBOARD.md"), sb);

console.table(scenes.map(({ id, start, begin, duration }) => ({ id, phrase: start, begin, duration })));
console.log(`voix ${r2(voDur)} s · total ${total} s`);
