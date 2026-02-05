// Background service worker for IP connectivity checks

// Default to Google DNS IPs - any IP with HTTPS port open will work
// The connection attempt itself (even with cert errors) proves connectivity
const DEFAULT_SETTINGS = {
  ipv4Target: '8.8.8.8',
  ipv6Target: '2001:4860:4860::8888',
  checkInterval: 30, // seconds
  timeout: 5000 // milliseconds
};

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set(settings);
  
  // Set initial icon (gray - unknown state)
  updateIcon(undefined, undefined);
  
  // Set up periodic connectivity check
  chrome.alarms.create('connectivityCheck', { periodInMinutes: 1 });
  
  // Run initial check
  performConnectivityCheck();
});

// Handle periodic connectivity checks
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'connectivityCheck') {
    await performConnectivityCheck();
  }
});

// Perform connectivity check
async function performConnectivityCheck() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  
  // Check connectivity and get public IPs in parallel
  const [ipv4Status, ipv6Status, publicIPv4, publicIPv6] = await Promise.all([
    checkConnectivity(settings.ipv4Target, 'ipv4', settings.timeout),
    checkConnectivity(settings.ipv6Target, 'ipv6', settings.timeout),
    getPublicIP('ipv4', settings.timeout),
    getPublicIP('ipv6', settings.timeout)
  ]);
  
  // Get local IPs via WebRTC
  const localIPs = await getLocalIPs();
  
  await chrome.storage.local.set({
    lastCheck: Date.now(),
    ipv4Status,
    ipv6Status,
    publicIPv4,
    publicIPv6,
    localIPv4: localIPs.ipv4,
    localIPv6: localIPs.ipv6
  });
  
  updateBadge(ipv4Status, ipv6Status);
}

// Check connectivity to a target IP address
// Uses HTTPS fetch directly to the IP - no DNS resolution involved
// Even if cert validation fails, the TCP connection proves IP connectivity
async function checkConnectivity(target, type, timeout) {
  const startTime = Date.now();
  
  try {
    // Use reliable external services that force specific IP versions
    let url;
    if (type === 'ipv4') {
      // ipify only has IPv4, guarantees IPv4 connectivity test
      url = 'https://api.ipify.org?format=text';
    } else {
      // Test IPv6 with a direct IPv6 address
      const formattedTarget = `[${target}]`;
      url = `https://${formattedTarget}/`;
    }
    
    console.log(`[IP What] Checking ${type}: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      signal: controller.signal,
      mode: type === 'ipv4' ? 'cors' : 'no-cors',
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    console.log(`[IP What] ${type} success in ${latency}ms`);
    
    // Clean success - connected and got a response
    return {
      connected: true,
      latency,
      lastChecked: Date.now(),
      error: null
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    console.log(`[IP What] ${type} error: ${error.name} - ${error.message} (${latency}ms)`);
    
    // AbortError = timeout, likely no connectivity
    if (error.name === 'AbortError') {
      return {
        connected: false,
        latency: timeout,
        lastChecked: Date.now(),
        error: 'Timeout'
      };
    }
    
    // For any other error (TypeError/Failed to fetch), treat as no connectivity
    // We can't reliably distinguish "connection refused" from "no route to host"
    // in a browser context - both throw TypeError
    return {
      connected: false,
      latency,
      lastChecked: Date.now(),
      error: 'Connection failed'
    };
  }
}

// Update extension badge based on connectivity status
function updateBadge(ipv4Status, ipv6Status) {
  // Update the dynamic icon
  updateIcon(ipv4Status?.connected, ipv6Status?.connected);
  
  // Clear badge text since the icon now shows status
  chrome.action.setBadgeText({ text: '' });
}

// Generate dynamic icon showing "46" with colors based on connectivity
async function updateIcon(ipv4Connected, ipv6Connected) {
  const sizes = [16, 32, 48, 128];
  const imageData = {};
  
  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Clear canvas (transparent background works on both dark/light toolbars)
    ctx.clearRect(0, 0, size, size);
    
    // Font size maximized, less bold to prevent overlap
    const fontSize = size * 0.95;
    ctx.font = `500 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Use saturated colors with dark outline for visibility on any background
    const greenColor = '#22C55E';  // Bright green
    const redColor = '#EF4444';     // Bright red
    const grayColor = '#9CA3AF';    // Neutral gray
    
    // Get color based on status (undefined = gray, true = green, false = red)
    const color4 = ipv4Connected === undefined ? grayColor : (ipv4Connected ? greenColor : redColor);
    const color6 = ipv6Connected === undefined ? grayColor : (ipv6Connected ? greenColor : redColor);
    
    // Draw text with dark outline for contrast on any background
    const outlineWidth = Math.max(1, size * 0.06);
    ctx.lineWidth = outlineWidth;
    ctx.strokeStyle = '#000000';
    ctx.lineJoin = 'round';
    
    // Draw "4" on the left - spread apart for clear gap
    ctx.fillStyle = color4;
    ctx.strokeText('4', size * 0.22, size * 0.52);
    ctx.fillText('4', size * 0.22, size * 0.52);
    
    // Draw "6" on the right - spread apart for clear gap
    ctx.fillStyle = color6;
    ctx.strokeText('6', size * 0.78, size * 0.52);
    ctx.fillText('6', size * 0.78, size * 0.52);
    
    // Get image data
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  
  chrome.action.setIcon({ imageData });
}

// Get public IP address using external services
async function getPublicIP(type, timeout) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Use different services for IPv4 vs IPv6
    let url;
    if (type === 'ipv4') {
      // api.ipify.org forces IPv4
      url = 'https://api.ipify.org?format=text';
    } else {
      // api64.ipify.org returns IPv6 if available, IPv4 otherwise
      // We'll check if the result is actually IPv6
      url = 'https://api64.ipify.org?format=text';
    }
    
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const ip = (await response.text()).trim();
    
    // For IPv6 request, verify it's actually IPv6 (contains colons)
    if (type === 'ipv6') {
      if (!ip.includes(':')) {
        // Got an IPv4 address, meaning no IPv6 connectivity
        return null;
      }
    }
    
    return ip;
  } catch (error) {
    console.log(`[IP What] Failed to get public ${type}:`, error.message);
    return null;
  }
}

// Get local IP addresses - try multiple methods
async function getLocalIPs() {
  const result = { ipv4: null, ipv6: null };
  
  // Method 1: Try to get from network interfaces via fetch to local services
  // This won't work in service worker, so we return null and let popup handle it
  
  return result;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkNow') {
    performConnectivityCheck().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'getStatus') {
    chrome.storage.local.get([
      'lastCheck', 'ipv4Status', 'ipv6Status',
      'publicIPv4', 'publicIPv6', 'localIPv4', 'localIPv6'
    ]).then(sendResponse);
    return true;
  }
  
  if (message.action === 'copyToClipboard') {
    // Copy text to clipboard (requires offscreen document in MV3)
    navigator.clipboard.writeText(message.text).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});
