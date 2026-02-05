#!/bin/bash

# IP What - Chrome Extension Installer
# This script helps install the extension in Chrome/Chromium browsers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$SCRIPT_DIR"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           IP What - Chrome Extension Installer             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if extension files exist
if [[ ! -f "$EXTENSION_DIR/manifest.json" ]]; then
    echo "❌ Error: manifest.json not found in $EXTENSION_DIR"
    exit 1
fi

echo "✅ Extension files found at: $EXTENSION_DIR"
echo ""

# Detect browser
detect_browser() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if [[ -d "/Applications/Google Chrome.app" ]]; then
            echo "chrome"
        elif [[ -d "/Applications/Chromium.app" ]]; then
            echo "chromium"
        elif [[ -d "/Applications/Brave Browser.app" ]]; then
            echo "brave"
        elif [[ -d "/Applications/Microsoft Edge.app" ]]; then
            echo "edge"
        else
            echo "unknown"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v google-chrome &> /dev/null; then
            echo "chrome"
        elif command -v chromium-browser &> /dev/null; then
            echo "chromium"
        elif command -v brave-browser &> /dev/null; then
            echo "brave"
        elif command -v microsoft-edge &> /dev/null; then
            echo "edge"
        else
            echo "unknown"
        fi
    else
        echo "unknown"
    fi
}

open_extensions_page() {
    local browser="$1"
    local extensions_url="chrome://extensions"
    
    echo "🌐 Opening extensions page in $browser..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        case "$browser" in
            chrome)
                open -a "Google Chrome" "$extensions_url"
                ;;
            chromium)
                open -a "Chromium" "$extensions_url"
                ;;
            brave)
                open -a "Brave Browser" "$extensions_url"
                ;;
            edge)
                open -a "Microsoft Edge" "edge://extensions"
                ;;
            *)
                echo "⚠️  Could not detect browser. Please manually open: $extensions_url"
                return 1
                ;;
        esac
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        case "$browser" in
            chrome)
                google-chrome "$extensions_url" &
                ;;
            chromium)
                chromium-browser "$extensions_url" &
                ;;
            brave)
                brave-browser "$extensions_url" &
                ;;
            edge)
                microsoft-edge "edge://extensions" &
                ;;
            *)
                xdg-open "$extensions_url" 2>/dev/null || echo "⚠️  Please manually open: $extensions_url"
                return 1
                ;;
        esac
    fi
}

BROWSER=$(detect_browser)
echo "🔍 Detected browser: $BROWSER"
echo ""

# Copy extension path to clipboard
copy_path_to_clipboard() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -n "$EXTENSION_DIR" | pbcopy
        echo "📋 Extension path copied to clipboard!"
    elif command -v xclip &> /dev/null; then
        echo -n "$EXTENSION_DIR" | xclip -selection clipboard
        echo "📋 Extension path copied to clipboard!"
    elif command -v xsel &> /dev/null; then
        echo -n "$EXTENSION_DIR" | xsel --clipboard --input
        echo "📋 Extension path copied to clipboard!"
    else
        echo "📁 Extension path: $EXTENSION_DIR"
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📖 Installation Instructions:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Enable 'Developer mode' (toggle in top-right corner)"
echo "2. Click 'Load unpacked'"
echo "3. Select this folder: $EXTENSION_DIR"
echo "4. The extension icon should appear in your toolbar"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

copy_path_to_clipboard
echo ""

read -p "🚀 Open browser extensions page now? [Y/n] " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    open_extensions_page "$BROWSER"
    echo ""
    echo "✨ Follow the instructions above to complete installation."
else
    echo ""
    echo "ℹ️  To install manually, open your browser and navigate to:"
    echo "   chrome://extensions (or edge://extensions for Edge)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Thank you for using IP What!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
