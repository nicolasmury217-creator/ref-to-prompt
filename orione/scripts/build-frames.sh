#!/usr/bin/env bash
# Assemble les 7 clips (work/clip1.mp4 … clip7.mp4) avec un fondu de 0,4 s à chaque raccord,
# puis extrait FRAME_COUNT frames WebP : frames/ (1920 px) et frames-m/ (960 px).
# Si vous changez FRAME_COUNT ici, changez aussi la constante du même nom dans js/scrub.js.
set -euo pipefail
cd "$(dirname "$0")/.."

FRAME_COUNT=245
XFADE=0.4
CLIP_DUR=5.041667

filter=""; prev="[0:v]"
for i in 1 2 3 4 5 6; do
  off=$(python3 -c "print(round($i*($CLIP_DUR-$XFADE),4))")
  filter="${filter}${prev}[$i:v]xfade=transition=fade:duration=$XFADE:offset=$off"
  if [ "$i" -lt 6 ]; then filter="${filter}[x$i];"; prev="[x$i]"; else filter="${filter}[v]"; fi
done

inputs=(); for i in 1 2 3 4 5 6 7; do inputs+=(-i "work/clip$i.mp4"); done
ffmpeg -y -v error "${inputs[@]}" -filter_complex "$filter" -map "[v]" -r 24 \
  -c:v libx264 -crf 14 -pix_fmt yuv420p work/full.mp4

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 work/full.mp4)
rm -rf frames frames-m && mkdir -p frames frames-m
ffmpeg -y -v error -i work/full.mp4 -vf "fps=$FRAME_COUNT/$dur,scale=1920:-2:flags=lanczos" \
  -frames:v "$FRAME_COUNT" -c:v libwebp -quality 72 -compression_level 4 frames/f_%04d.webp
ffmpeg -y -v error -i work/full.mp4 -vf "fps=$FRAME_COUNT/$dur,scale=960:-2:flags=lanczos" \
  -frames:v "$FRAME_COUNT" -c:v libwebp -quality 70 -compression_level 4 frames-m/f_%04d.webp
echo "OK : $FRAME_COUNT frames"
