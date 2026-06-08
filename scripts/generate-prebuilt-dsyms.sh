#!/bin/bash
# Generate dSYMs for prebuilt xcframeworks (React, Hermes, etc.) that don't ship debug symbols.
# Usage: generate-prebuilt-dsyms.sh /path/to/App.xcarchive
set -euo pipefail

ARCHIVE="${1:?Usage: generate-prebuilt-dsyms.sh path/to/App.xcarchive}"
APP=$(find "$ARCHIVE/Products/Applications" -maxdepth 1 -name "*.app" | head -1)

if [ -z "$APP" ]; then
  echo "ERROR: .app not found in archive" >&2
  exit 1
fi

DSYM_DIR="$ARCHIVE/dSYMs"
mkdir -p "$DSYM_DIR"

for fw in hermesvm React ReactNativeDependencies ZXingObjC; do
  BIN="$APP/Frameworks/${fw}.framework/${fw}"
  OUT="$DSYM_DIR/${fw}.framework.dSYM"
  if [ -f "$BIN" ]; then
    echo "  → dSYM: $fw"
    dsymutil "$BIN" -o "$OUT"
  else
    echo "  ⊘ skip: $fw (not embedded)"
  fi
done

echo "✓ Prebuilt framework dSYMs generated in $DSYM_DIR"
