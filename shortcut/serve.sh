#!/bin/bash

# Serve the shortcut file so it can be downloaded on iPhone
# AirDrop is usually easier, but this works too

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8080}"

# Get local IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           IP What - Shortcut Server                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📱 To install the shortcut on iPhone:"
echo ""
echo "   Option 1 - AirDrop (Recommended):"
echo "   1. Open Finder on Mac"
echo "   2. Navigate to: $SCRIPT_DIR"
echo "   3. AirDrop 'IPWhat.shortcut' to your iPhone"
echo ""
echo "   Option 2 - Download via Safari:"
echo "   1. Open Safari on iPhone (same WiFi)"
echo "   2. Go to: http://$LOCAL_IP:$PORT/IPWhat.shortcut"
echo "   3. Tap 'Open in Shortcuts'"
echo ""
echo "   Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$SCRIPT_DIR"
python3 -m http.server "$PORT"
