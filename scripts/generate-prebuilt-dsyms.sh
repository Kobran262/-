#!/bin/bash
# Generate dSYMs for all embedded frameworks (prebuilt Expo/RN xcframeworks often ship without matching dSYMs).
# Usage: generate-prebuilt-dsyms.sh /path/to/App.xcarchive
set -euo pipefail

ARCHIVE="${1:?Usage: generate-prebuilt-dsyms.sh path/to/App.xcarchive}"
APP=$(find "$ARCHIVE/Products/Applications" -maxdepth 1 -name "*.app" | head -1)

if [ -z "$APP" ]; then
  echo "ERROR: .app not found in archive" >&2
  exit 1
fi

FRAMEWORKS_DIR="$APP/Frameworks"
DSYM_DIR="$ARCHIVE/dSYMs"
mkdir -p "$DSYM_DIR"

if [ ! -d "$FRAMEWORKS_DIR" ]; then
  echo "No embedded frameworks — nothing to do."
  exit 0
fi

for fw_path in "$FRAMEWORKS_DIR"/*.framework; do
  [ -d "$fw_path" ] || continue
  fw=$(basename "$fw_path" .framework)
  bin="$fw_path/$fw"
  out="$DSYM_DIR/${fw}.framework.dSYM"
  if [ -f "$bin" ]; then
    echo "  → dSYM: $fw"
    dsymutil "$bin" -o "$out"
  fi
done

echo "✓ Framework dSYMs generated in $DSYM_DIR"
