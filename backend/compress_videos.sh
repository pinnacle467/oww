#!/bin/bash
# Compress oversized MP4s in /app/backend/uploads/gallery in place so GitHub push fits within the 100 MB per-file limit.
# Logs to /app/backend/compress.log so the log survives shell session resets.
set -e
LOG=/app/backend/compress.log
> "$LOG"
cd /app/backend/uploads/gallery
for f in 91e7dfe008604e55ae0f85459f911fea.mp4 d252a0f866ae469d9e3d52b5e998ca31.mp4 5084e72e854f40a48ca0c015dffd499a.mp4; do
  echo "=== $(date) start $f ($(du -h "$f" | cut -f1)) ===" >> "$LOG"
  /app/bin/ffmpeg -y -i "$f" \
    -vf "scale=min(1920\,iw):-2" \
    -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -movflags +faststart \
    "$f.tmp.mp4" >> "$LOG" 2>&1
  if [ -s "$f.tmp.mp4" ]; then
    mv "$f.tmp.mp4" "$f"
    echo "  $(date) done $f -> $(du -h "$f" | cut -f1)" >> "$LOG"
  else
    echo "  $(date) FAIL $f" >> "$LOG"
    rm -f "$f.tmp.mp4"
  fi
done
echo "ALL_DONE $(date)" >> "$LOG"
