#!/bin/sh
set -eu

VOICE="en-US-AndrewNeural"
RATE="+5%"

for source in video/narration/*.txt; do
  name=$(basename "$source" .txt)
  python3 -m edge_tts \
    --file "$source" \
    --voice "$VOICE" \
    --rate "$RATE" \
    --write-media "video/public/audio/$name.mp3" \
    --write-subtitles "video/public/audio/$name.vtt"
done
