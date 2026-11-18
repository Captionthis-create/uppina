#!/usr/bin/env bash
# fabriquer.sh : fabrique la vidéo de bout en bout (≈ 10 min sur 4 cœurs).
#   ./fabriquer.sh            toutes les étapes
#   ./fabriquer.sh rendu      seulement : minutage → rendu → mixage → assemblage (captures et voix déjà faites)
# Prérequis : Node 18+, Python 3.10+, ffmpeg ; « npm install » et un environnement Python avec
# piper-tts 1.8.0, numpy et scipy (voir README.md). PYTHON peut pointer vers cet environnement.
set -euo pipefail
cd "$(dirname "$0")"
PYTHON="${PYTHON:-python3}"
mkdir -p build

if [ "${1:-tout}" = "tout" ]; then
  echo "1/6 Captures de la démo (Chromium, horloge simulée)"
  node captures.js
  echo "2/6 Voix off (Piper, voix « Pierre »)"
  "$PYTHON" voix.py
fi
echo "3/6 Minutage et sous-titres"
node timeline.js
echo "4/6 Musique"
"$PYTHON" musique.py
echo "5/6 Rendu image par image"
node rendu.js video --travailleurs "${TRAVAILLEURS:-4}"
echo "6/6 Mixage et assemblage"
"$PYTHON" mixage.py
ffmpeg -y -loglevel error -i build/video-sans-son.mp4 -i build/audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -metadata title="Une journée avec Up'Pina" -metadata language=fra -metadata:s:a:0 language=fra -movflags +faststart -shortest build/uppina-accueil.mp4
echo "Terminé : build/uppina-accueil.mp4 et build/uppina-accueil.srt"
