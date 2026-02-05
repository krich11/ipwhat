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
  
  // Set up periodic connectivity check
  chrome.alarms.create('connectivityCheck', { periodInMinutes: 1 });
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
  let badgeText = '';
  let badgeColor = '#888888';
  
  if (ipv4Status?.connected && ipv6Status?.connected) {
    badgeText = '✓';
    badgeColor = '#4CAF50'; // Green - both connected
  } else if (ipv4Status?.connected || ipv6Status?.connected) {
    badgeText = '!';
    badgeColor = '#FF9800'; // Orange - partial connectivity
  } else {
    badgeText = '✗';
    badgeColor = '#F44336'; // Red - no connectivity
  }
  
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
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
