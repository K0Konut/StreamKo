#!/usr/bin/env bash
set -euo pipefail

# Rebuild a master.m3u8 file in every HLS folder that has variant playlists
# but no valid master playlist (or when variants changed).
#
# Usage:
#   ./streamko-master-sync.sh [/path/to/uploads/hls]
# Default root:
#   /mnt/media/streamko/uploads/hls

ROOT="${1:-/mnt/media/streamko/uploads/hls}"

if [ ! -d "$ROOT" ]; then
  echo "HLS root does not exist: $ROOT" >&2
  exit 1
fi

build_stream_inf() {
  local rel="$1"
  local bandwidth="$2"
  local resolution=""

  case "$rel" in
    *1080p*.m3u8) bandwidth=5600000; resolution="1920x1080" ;;
    *720p*.m3u8) bandwidth=3200000; resolution="1280x720" ;;
    *480p*.m3u8) bandwidth=1600000; resolution="854x480" ;;
    *360p*.m3u8) bandwidth=1100000; resolution="640x360" ;;
  esac

  if [ -n "$resolution" ]; then
    printf '#EXT-X-STREAM-INF:BANDWIDTH=%s,RESOLUTION=%s\n' "$bandwidth" "$resolution"
  else
    printf '#EXT-X-STREAM-INF:BANDWIDTH=%s\n' "$bandwidth"
  fi
}

updated=0
scanned=0

for dir in "$ROOT"/*; do
  [ -d "$dir" ] || continue
  scanned=$((scanned + 1))
  master="$dir/master.m3u8"

  mapfile -t variants < <(
    find "$dir" -maxdepth 2 -type f -name '*.m3u8' -printf '%P\n' \
      | awk '$0 != "master.m3u8"' \
      | sort
  )

  [ "${#variants[@]}" -gt 0 ] || continue

  tmp="$(mktemp)"
  {
    echo '#EXTM3U'
    echo '#EXT-X-VERSION:3'

    idx=0
    for rel in "${variants[@]}"; do
      bw=$((1200000 + idx * 800000))
      build_stream_inf "$rel" "$bw"
      printf '%s\n' "$rel"
      idx=$((idx + 1))
    done
  } >"$tmp"

  if [ ! -f "$master" ] || ! cmp -s "$tmp" "$master"; then
    mv "$tmp" "$master"
    updated=$((updated + 1))
    echo "updated: $master"
  else
    rm -f "$tmp"
  fi
done

echo "scan complete: scanned=$scanned updated=$updated root=$ROOT"
