#!/usr/bin/env bash
# 🐟 AZERCLAW Cross-Platform Build Script
# Builds binaries for macOS (Intel + Silicon), Windows, and Linux.
#
# Usage:
#   ./scripts/build.sh          — Build all platforms
#   ./scripts/build.sh darwin   — Build macOS only
#   ./scripts/build.sh linux    — Build Linux only
#   ./scripts/build.sh windows  — Build Windows only

set -euo pipefail

VERSION=$(node -e "console.log(require('./package.json').version)")
DIST_DIR="dist"
BUILD_DIR="$DIST_DIR/build"

echo "🐟 AZERCLAW Build System v${VERSION}"
echo "═══════════════════════════════════"
echo ""

# Clean
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Bundle with ncc
echo "📦 Bundling with ncc..."
npx -y @vercel/ncc build bin/azerclaw.ts -o "$DIST_DIR/ncc" --minify --source-map
echo "  ✓ Bundle created"

# Copy skills and agents
cp -r skills "$DIST_DIR/ncc/skills" 2>/dev/null || true
cp -r agents "$DIST_DIR/ncc/agents" 2>/dev/null || true
cp -r templates "$DIST_DIR/ncc/templates" 2>/dev/null || true

PLATFORM=${1:-all}

build_target() {
  local target=$1
  local output=$2
  echo "  🔧 Building $target → $output"
  
  npx -y pkg "$DIST_DIR/ncc/index.js" \
    --target "node22-${target}" \
    --output "$BUILD_DIR/${output}" \
    --compress GZip 2>/dev/null || {
    echo "  ⚠️  pkg failed for $target, creating shell wrapper instead"
    echo '#!/usr/bin/env node' > "$BUILD_DIR/${output}"
    cat "$DIST_DIR/ncc/index.js" >> "$BUILD_DIR/${output}"
    chmod +x "$BUILD_DIR/${output}"
  }
}

# macOS
if [[ "$PLATFORM" == "all" || "$PLATFORM" == "darwin" || "$PLATFORM" == "macos" ]]; then
  echo ""
  echo "🍎 Building macOS..."
  build_target "macos-x64" "azerclaw-darwin-x64"
  build_target "macos-arm64" "azerclaw-darwin-arm64"
  echo "  ✓ macOS builds complete"
fi

# Linux
if [[ "$PLATFORM" == "all" || "$PLATFORM" == "linux" ]]; then
  echo ""
  echo "🐧 Building Linux..."
  build_target "linux-x64" "azerclaw-linux-x64"
  build_target "linux-arm64" "azerclaw-linux-arm64"
  echo "  ✓ Linux builds complete"
fi

# Windows
if [[ "$PLATFORM" == "all" || "$PLATFORM" == "windows" || "$PLATFORM" == "win" ]]; then
  echo ""
  echo "🪟 Building Windows..."
  build_target "win-x64" "azerclaw-win-x64.exe"
  echo "  ✓ Windows builds complete"
fi

echo ""
echo "═══════════════════════════════════"
echo "🐟 Build complete! Binaries in $BUILD_DIR/"
echo ""
ls -lh "$BUILD_DIR/"
echo ""
echo "To install locally:"
echo "  cp $BUILD_DIR/azerclaw-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m) /usr/local/bin/azerclaw"
echo "  chmod +x /usr/local/bin/azerclaw"
