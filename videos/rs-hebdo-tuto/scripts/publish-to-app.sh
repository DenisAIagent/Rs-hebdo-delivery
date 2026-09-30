#!/usr/bin/env bash
# Rend la vidéo, la compresse pour le web et la copie dans frontend/public
# (servie par l'onboarding à /tuto-rs-hebdo.mp4).
#
#   bash scripts/publish-to-app.sh            # rendu + compression + copie
#   bash scripts/publish-to-app.sh --no-render  # réutilise out/tuto.mp4
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=out/tuto.mp4
PUBLIC=../../frontend/public

if [[ "${1:-}" != "--no-render" ]]; then
  mkdir -p out
  npx hyperframes render --output "$OUT"
fi

# 1280x720, H.264 haute compatibilité, ~12–18 Mo pour 5 min, audio AAC 96 kb/s mono.
ffmpeg -y -i "$OUT" \
  -vf "scale=1280:720:flags=lanczos" -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p \
  -preset slow -crf 24 -movflags +faststart \
  -c:a aac -b:a 96k -ac 1 \
  "$PUBLIC/tuto-rs-hebdo.mp4"

# Vignette : une image de la scène d'ouverture, une fois le titre posé (14 s).
ffmpeg -y -ss 14 -i "$OUT" -frames:v 1 -vf "scale=1280:720" -q:v 3 "$PUBLIC/tuto-rs-hebdo.jpg"

ls -la "$PUBLIC/tuto-rs-hebdo.mp4" "$PUBLIC/tuto-rs-hebdo.jpg"
