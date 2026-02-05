// Background service worker for IP connectivity checks

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

// Check connectivity to a target
async function checkConnectivity(target, type, timeout) {
  const startTime = Date.now();
  
  try {
    // For IPv6, we need to wrap in brackets
    const formattedTarget = type === 'ipv6' ? `[${target}]` : target;
    
    // Try to fetch from the DNS server (will likely fail but connection attempt tells us connectivity)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Use a DNS-over-HTTPS endpoint for more reliable testing
    let url;
    if (type === 'ipv4') {
      url = `https://dns.google/resolve?name=google.com&type=A`;
    } else {
      url = `https://dns64.dns.google/resolve?name=google.com&type=AAAA`;
    }
    
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    return {
      connected: response.ok,
      latency,
      lastChecked: Date.now(),
      error: null
    };
  } catch (error) {
    return {
      connected: false,
      latency: null,
      lastChecked: Date.now(),
      error: error.message
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
