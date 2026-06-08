#!/bin/bash
# Patches for Xcode 26.1 (SDK 56 targets Xcode 26.4+ / Swift 6.3 weak let).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSI="$ROOT/node_modules/expo-modules-jsi/apple/Sources"
JSI_ROOT="$ROOT/node_modules/expo-modules-jsi"

if [ ! -d "$JSI" ]; then
  exit 0
fi

# weak let → weak var (Swift < 6.3)
find "$JSI" -name '*.swift' -print0 | while IFS= read -r -d '' f; do
  if grep -q 'weak let' "$f" 2>/dev/null; then
    sed -i '' 's/weak let/weak var/g' "$f"
  fi
done

# @unchecked Sendable for classes with mutable weak refs
sed -i '' 's/internal final class HostFunctionContext: Sendable {/internal final class HostFunctionContext: @unchecked Sendable {/' \
  "$JSI/ExpoModulesJSI/Contexts/HostFunctionContext.swift" 2>/dev/null || \
sed -i '' 's/internal final class HostFunctionContext {/internal final class HostFunctionContext: @unchecked Sendable {/' \
  "$JSI/ExpoModulesJSI/Contexts/HostFunctionContext.swift"

sed -i '' 's/internal final class HostObjectContext: Sendable {/internal final class HostObjectContext: @unchecked Sendable {/' \
  "$JSI/ExpoModulesJSI/Contexts/HostObjectContext.swift" 2>/dev/null || \
sed -i '' 's/internal final class HostObjectContext {/internal final class HostObjectContext: @unchecked Sendable {/' \
  "$JSI/ExpoModulesJSI/Contexts/HostObjectContext.swift"

sed -i '' 's/public final class JavaScriptValue: JavaScriptType, Equatable, Escapable, Error {/public final class JavaScriptValue: JavaScriptType, Equatable, Escapable, Error, @unchecked Sendable {/' \
  "$JSI/ExpoModulesJSI/Runtime/Values/JavaScriptValue.swift" 2>/dev/null || true

sed -i '' 's/public final class JavaScriptPropNameID: JavaScriptType {/public final class JavaScriptPropNameID: JavaScriptType, @unchecked Sendable {/' \
  "$JSI/ExpoModulesJSI/Runtime/JavaScriptPropNameID.swift" 2>/dev/null || true

# Relax strict concurrency in nested xcframework build (Xcode 26.1)
BUILD_SCRIPT="$JSI_ROOT/apple/scripts/build-xcframework.sh"
if [ -f "$BUILD_SCRIPT" ] && ! grep -q 'SWIFT_STRICT_CONCURRENCY=minimal' "$BUILD_SCRIPT"; then
  sed -i '' 's/SWIFT_COMPILATION_MODE=wholemodule \\$/SWIFT_COMPILATION_MODE=wholemodule \\\
    SWIFT_STRICT_CONCURRENCY=minimal \\/' "$BUILD_SCRIPT"
fi

echo "patched expo-modules-jsi for Xcode 26.1"
