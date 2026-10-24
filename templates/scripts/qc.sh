#!/usr/bin/env bash
# QC for a rendered film: decode-verify frames + duration, then a contact sheet you must LOOK at.
# usage: bash scripts/qc.sh <film.mp4> <expected_frames> [every_n_seconds=2] [fps=30]
set -euo pipefail
FF=${FFMPEG:-ffmpeg}
IN=${1:?film.mp4}; N=${2:?expected frame count}; STEP=${3:-2}; FPS=${4:-30}
OUT=$(dirname "$IN")

echo "== decode check (ffprobe not needed; the last frame= line is the truth)"
$FF -hide_banner -i "$IN" 2>&1 | grep -E "Duration|Video:" || true
GOT=$($FF -hide_banner -i "$IN" -map 0:v -f null - 2>&1 | tr '\r' '\n' | grep -oE "frame= *[0-9]+" | tail -1 | grep -oE "[0-9]+")
if [ "$GOT" = "$N" ]; then echo "frames OK: $GOT"; else echo "FRAME COUNT MISMATCH: got $GOT expected $N"; exit 1; fi

echo "== contact sheet: one still every ${STEP}s → $OUT/contact.jpg"
$FF -hide_banner -loglevel error -y -i "$IN" -vf "fps=1/${STEP},scale=480:-2,tile=4x$(( (N / FPS / STEP + 3) / 4 ))" -frames:v 1 "$OUT/contact.jpg"
echo "open $OUT/contact.jpg and look at every tile before you call it done"

INFO=$($FF -hide_banner -i "$IN" 2>&1 || true)
if echo "$INFO" | grep -q "Audio:"; then
  echo "== loudness (target -14 LUFS integrated, true peak <= -1 dBTP)"
  $FF -hide_banner -i "$IN" -map 0:a -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tail -2
fi
