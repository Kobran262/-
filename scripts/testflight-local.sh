#!/bin/bash
# Локальная сборка IPA и загрузка в TestFlight (без EAS).
# Требует: Xcode, Apple Distribution cert, app-specific password в keychain (AC_PASSWORD).
set -euo pipefail

TEAM_ID="54VMCQN8D8"
APPLE_ID="${APPLE_ID:-bkolarevich@icloud.com}"
BUILD_DIR="/tmp/srecha-wms-build"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE="$BUILD_DIR/ios/build/SrechaWMS.xcarchive"
EXPORT_DIR="$BUILD_DIR/ios/build/export"
IPA="$EXPORT_DIR/SrechaWMS.ipa"

echo "→ Синхронизация проекта..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
rsync -a --exclude node_modules --exclude ios --exclude .expo "$SRC/" "$BUILD_DIR/"
cd "$BUILD_DIR"
npm install --silent
bash scripts/patch-expo-swift.sh

echo "→ Prebuild iOS..."
npx expo prebuild --platform ios --clean

cp "$SRC/ios/ExportOptions.plist" ios/ExportOptions.plist 2>/dev/null || cp "$BUILD_DIR/ios/ExportOptions.plist" ios/ExportOptions.plist 2>/dev/null || true
if [ ! -f ios/ExportOptions.plist ]; then
  cat > ios/ExportOptions.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>uploadSymbols</key><true/>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
EOF
fi

cd ios
pod install

echo "→ Archive (Release, generic iOS)..."
xcodebuild \
  -workspace SrechaWMS.xcworkspace \
  -scheme SrechaWMS \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  archive

echo "→ Export IPA..."
rm -rf "$EXPORT_DIR"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist ExportOptions.plist \
  -allowProvisioningUpdates

echo "→ Upload to TestFlight..."
if [ -n "${APP_STORE_CONNECT_PASSWORD:-}" ]; then
  xcrun altool --upload-app --type ios --file "$IPA" --username "$APPLE_ID" --password "$APP_STORE_CONNECT_PASSWORD"
elif security find-generic-password -s "AC_PASSWORD" -a "$APPLE_ID" &>/dev/null; then
  xcrun altool --upload-app --type ios --file "$IPA" --username "$APPLE_ID" --password "@keychain:AC_PASSWORD"
else
  echo ""
  echo "IPA готов: $IPA"
  echo "Загрузите вручную через Transporter или Xcode Organizer."
  echo "Или задайте APP_STORE_CONNECT_PASSWORD (app-specific password)."
  open -a Transporter "$IPA" 2>/dev/null || open "$EXPORT_DIR"
  exit 0
fi

echo "✓ Загружено в App Store Connect / TestFlight"
