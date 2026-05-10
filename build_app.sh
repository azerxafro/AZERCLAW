#!/bin/bash

# Configuration
APP_NAME="Azerclaw"
BUILD_DIR="clients/swift-mac/.build/release"
EXECUTABLE="AzerclawApp"
APP_BUNDLE="clients/${APP_NAME}.app"
CONTENTS="${APP_BUNDLE}/Contents"
MACOS="${CONTENTS}/MacOS"
RESOURCES="${CONTENTS}/Resources"
PROJECT_ROOT=$(pwd)

echo "🩸 Packaging ${APP_NAME}.app for macOS..."

# Clean old build
rm -rf "${APP_BUNDLE}"

# Create directory structure
mkdir -p "${MACOS}"
mkdir -p "${RESOURCES}"

# Create the wrapper script to launch Daemon + UI
cat << 'EOF' > "${MACOS}/${APP_NAME}"
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$DIR/../../../../"

# Start the Node daemon
cd "$PROJECT_ROOT"
node dist/bin/azerclaw.js serve -p 8080 &
SERVER_PID=$!

# Wait a moment for server to start
sleep 1

# Launch the Swift GUI
"$DIR/AzerclawApp"

# Cleanup daemon when GUI closes
kill $SERVER_PID
EOF

chmod +x "${MACOS}/${APP_NAME}"

# Copy the Swift executable
cp "${BUILD_DIR}/${EXECUTABLE}" "${MACOS}/${EXECUTABLE}"
chmod +x "${MACOS}/${EXECUTABLE}"

# Create Info.plist
cat << EOF > "${CONTENTS}/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>com.azerclaw.desktop</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
</dict>
</plist>
EOF

# Copy Icon
if [ -f "MyIcon.icns" ]; then
    cp MyIcon.icns "${RESOURCES}/AppIcon.icns"
fi

echo "✓ Created bundle at ${APP_BUNDLE}"

echo "🔪 Installing to /Applications..."
rm -rf "/Applications/${APP_NAME}.app"
cp -R "${APP_BUNDLE}" "/Applications/"

echo "📌 Pinning to Dock..."
defaults write com.apple.dock persistent-apps -array-add "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>/Applications/${APP_NAME}.app</string><key>_CFURLStringType</key><integer>0</integer></dict></dict></dict>"
killall Dock

echo "🔥 Diabolical Edition Installed."
