#!/usr/bin/env bash
# Music + SFX hits placed on the film's timeline → one track of EXACTLY the film's length at -14 LUFS → muxed.
# usage: bash scripts/mix_audio.sh <silent.mp4> <audio_dir> <out.mp4> [duration_s=40]
#   <audio_dir>/music.mp3 and <audio_dir>/sfx/*.mp3 (any licensed or self-made sounds)
# Edit the HITS table: one line per hit = "file  start_ms  volume". Times come from your timeline beats.
set -euo pipefail
FF=${FFMPEG:-ffmpeg}
VIDEO=${1:?silent.mp4}; A=${2:?audio dir}; OUT=${3:?out.mp4}; DUR=${4:-40}
FADE_AT=$(echo "$DUR - 1.2" | bc)

HITS=$(cat <<'EOF'
whoosh.mp3     0      0.6
whoosh.mp3     4800   0.5
explode.mp3    11000  0.8
clunk.mp3      18900  0.7
surge.mp3      20000  0.6
tick.mp3       5400   0.35
tick.mp3       6020   0.35
whoosh.mp3     37700  0.7
EOF
)

inputs=(-i "$A/music.mp3"); graph="[0:a]volume=0.85[m];"; labels="[m]"; i=1
while read -r f ms vol; do
  [ -z "$f" ] && continue
  inputs+=(-i "$A/sfx/$f")
  graph+="[$i:a]adelay=${ms}|${ms},volume=${vol}[h$i];"   # adelay needs one value per channel: "ms|ms"
  labels+="[h$i]"; i=$((i + 1))
done <<< "$HITS"

# amix normalize=0: otherwise every input is divided by the input count and the music drops ~20 dB.
# atrim + -t pin the length; loudnorm is single-pass, so measure the result (it can land 0.5-1.5 LU off).
graph+="${labels}amix=inputs=${i}:normalize=0,atrim=0:${DUR},afade=t=out:st=${FADE_AT}:d=1.2,loudnorm=I=-14:TP=-1.0:LRA=11,aresample=48000[out]"
MIX="${OUT%.*}_mix.wav"
$FF -y -hide_banner -loglevel error "${inputs[@]}" -filter_complex "$graph" -map "[out]" -t "$DUR" "$MIX"
$FF -y -hide_banner -loglevel error -i "$VIDEO" -i "$MIX" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -t "$DUR" -movflags +faststart "$OUT"

echo "== measured (re-run with a nudged I= target if integrated is off by > 0.5 LU)"
$FF -hide_banner -i "$OUT" -map 0:a -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tail -2
$FF -hide_banner -i "$OUT" -f null - 2>&1 | tr '\r' '\n' | grep -E "Duration|frame=" | tail -2
