#!/bin/bash

# IP What PWA - HTTPS Server Script
# Creates a self-signed certificate and serves the PWA over HTTPS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="$SCRIPT_DIR/.certs"
PORT="${1:-8443}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           IP What PWA - HTTPS Server                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Generate self-signed certificate if it doesn't exist
if [[ ! -f "$CERT_DIR/cert.pem" ]] || [[ ! -f "$CERT_DIR/key.pem" ]]; then
    echo "🔐 Generating self-signed certificate..."
    
    # Get local IPv4
    LOCAL_IPV4=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")
    
    # Get local IPv6 (non-link-local)
    LOCAL_IPV6=$(ifconfig en0 2>/dev/null | grep 'inet6' | grep -v 'fe80' | awk '{print $2}' | head -1)
    if [[ -z "$LOCAL_IPV6" ]]; then
        LOCAL_IPV6=$(ifconfig en1 2>/dev/null | grep 'inet6' | grep -v 'fe80' | awk '{print $2}' | head -1)
    fi
    
    # Build SAN extension
    SAN="DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IPV4"
    if [[ -n "$LOCAL_IPV6" ]]; then
        SAN="$SAN,IP:$LOCAL_IPV6"
    fi
    
    # Generate certificate valid for localhost and local IPs
    openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
        -keyout "$CERT_DIR/key.pem" \
        -out "$CERT_DIR/cert.pem" \
        -subj "/CN=localhost" \
        -addext "subjectAltName=$SAN" \
        2>/dev/null
    
    echo "✅ Certificate generated"
    echo ""
fi

# Get local IPv4 address
LOCAL_IPV4=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")

# Get local IPv6 address (non-link-local)
LOCAL_IPV6=$(ifconfig en0 2>/dev/null | grep 'inet6' | grep -v 'fe80' | awk '{print $2}' | head -1)
if [[ -z "$LOCAL_IPV6" ]]; then
    LOCAL_IPV6=$(ifconfig en1 2>/dev/null | grep 'inet6' | grep -v 'fe80' | awk '{print $2}' | head -1)
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Starting HTTPS server on port $PORT"
echo ""
echo "   Local:      https://localhost:$PORT"
if [[ -n "$LOCAL_IPV4" ]]; then
    echo "   IPv4:       https://$LOCAL_IPV4:$PORT"
fi
if [[ -n "$LOCAL_IPV6" ]]; then
    echo "   IPv6:       https://[$LOCAL_IPV6]:$PORT"
fi
echo ""
echo "📱 To install on iPhone:"
echo "   1. Open Safari on iPhone (same WiFi network)"
if [[ -n "$LOCAL_IPV4" ]]; then
    echo "   2. Go to: https://$LOCAL_IPV4:$PORT"
elif [[ -n "$LOCAL_IPV6" ]]; then
    echo "   2. Go to: https://[$LOCAL_IPV6]:$PORT"
else
    echo "   2. Go to: https://<your-mac-ip>:$PORT"
fi
echo "   3. Accept the certificate warning"
echo "   4. Tap Share → 'Add to Home Screen'"
echo ""
echo "   Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start Python HTTPS server
cd "$SCRIPT_DIR"
python3 << EOF
import http.server
import ssl
import os

port = $PORT
cert_dir = "$CERT_DIR"

handler = http.server.SimpleHTTPRequestHandler
httpd = http.server.HTTPServer(('0.0.0.0', port), handler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(
    certfile=os.path.join(cert_dir, 'cert.pem'),
    keyfile=os.path.join(cert_dir, 'key.pem')
)
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Serving HTTPS on port {port}...")
httpd.serve_forever()
EOF
