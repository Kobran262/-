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

echo "→ Генерация dSYM для prebuilt frameworks..."
bash "$SRC/scripts/generate-prebuilt-dsyms.sh" "$ARCHIVE"

echo "→ Upload to TestFlight (App Store Connect)..."
UPLOAD_PLIST="$BUILD_DIR/ios/ExportOptionsUpload.plist"
cat > "$UPLOAD_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>uploadSymbols</key><true/>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
EOF

xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR/upload" \
  -exportOptionsPlist "$UPLOAD_PLIST" \
  -allowProvisioningUpdates

echo "✓ Загружено в App Store Connect / TestFlight"
