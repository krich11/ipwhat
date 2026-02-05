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
  
  const ipv4Status = await checkConnectivity(settings.ipv4Target, 'ipv4', settings.timeout);
  const ipv6Status = await checkConnectivity(settings.ipv6Target, 'ipv6', settings.timeout);
  
  await chrome.storage.local.set({
    lastCheck: Date.now(),
    ipv4Status,
    ipv6Status
  });
  
  updateBadge(ipv4Status, ipv6Status);
}

// Check connectivity to a target IP address
// Uses HTTPS fetch directly to the IP - no DNS resolution involved
// Even if cert validation fails, the TCP connection proves IP connectivity
async function checkConnectivity(target, type, timeout) {
  const startTime = Date.now();
  
  try {
    // Format IP for URL - IPv6 needs brackets
    const formattedTarget = type === 'ipv6' ? `[${target}]` : target;
    
    // Use HTTPS - if TCP connects at all (even with cert error), IP is reachable
    const url = `https://${formattedTarget}/`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    await fetch(url, {
      signal: controller.signal,
      mode: 'no-cors',
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    // Clean success - connected and got a response
    return {
      connected: true,
      latency,
      lastChecked: Date.now(),
      error: null
    };
  } catch (error) {
    clearTimeout;
    const latency = Date.now() - startTime;
    
    // AbortError = timeout, likely no connectivity
    if (error.name === 'AbortError') {
      return {
        connected: false,
        latency: timeout,
        lastChecked: Date.now(),
        error: 'Timeout'
      };
    }
    
    // TypeError with "Failed to fetch" could be:
    // - Network error (no route) = no connectivity
    // - Cert error / connection refused = TCP worked, so IP is reachable
    // 
    // Unfortunately, browsers don't expose the specific error type for security.
    // But if the error happened quickly (< timeout), it likely means TCP connected
    // but something else failed (cert, refused, etc.) = IP is reachable
    // If it took close to timeout, it's likely a network timeout = no connectivity
    
    const quickFailure = latency < (timeout * 0.8);
    
    if (quickFailure) {
      // Fast failure usually means TCP connected but TLS/app layer failed
      // This still proves IP connectivity
      return {
        connected: true,
        latency,
        lastChecked: Date.now(),
        error: null
      };
    }
    
    // Slow failure - likely network timeout, no connectivity
    return {
      connected: false,
      latency,
      lastChecked: Date.now(),
      error: 'No connectivity'
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
    
    // Light background for better contrast
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.15);
    ctx.fill();
    
    // Calculate font size - make it larger to fill the icon
    const fontSize = size * 0.75;
    ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Colors - more saturated for visibility
    const greenColor = '#2E7D32';  // Darker green for contrast on light bg
    const redColor = '#C62828';     // Darker red for contrast on light bg
    const grayColor = '#757575';
    
    // Get color based on status (undefined = gray, true = green, false = red)
    const color4 = ipv4Connected === undefined ? grayColor : (ipv4Connected ? greenColor : redColor);
    const color6 = ipv6Connected === undefined ? grayColor : (ipv6Connected ? greenColor : redColor);
    
    // Draw "4" on the left - positioned to fill space
    ctx.fillStyle = color4;
    ctx.fillText('4', size * 0.28, size * 0.55);
    
    // Draw "6" on the right  
    ctx.fillStyle = color6;
    ctx.fillText('6', size * 0.72, size * 0.55);
    
    // Get image data
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  
  chrome.action.setIcon({ imageData });
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
    chrome.storage.local.get(['lastCheck', 'ipv4Status', 'ipv6Status']).then(sendResponse);
    return true;
  }
});

// TODO: Identify public IPv4 and IPv6 addresses
// - Use external services like api.ipify.org (IPv4) and api64.ipify.org (IPv6)
// - Cache the results and update periodically
// - Display in extension context menu along with settings
// - Add context menu items showing current public IPs
// - Allow copying IP addresses to clipboard from context menu
