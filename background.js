// Background service worker for IP connectivity checks

// Store resolved IPs from webRequest
const resolvedIPs = {
  ipv4: null,
  ipv6: null,
  dns: null
};

// Default to Google DNS IPs - any IP with HTTPS port open will work
// The connection attempt itself (even with cert errors) proves connectivity
const DEFAULT_SETTINGS = {
  ipv4Target: '8.8.8.8',
  ipv6Target: '2001:4860:4860::8888',
  checkInterval: 30, // seconds
  timeout: 5000, // milliseconds
  dnsFqdn: 'www.google.com'
};

// Set up webRequest listener to capture resolved IPs
// This captures the actual IP address Chrome connected to for each request
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.ip) {
      // Categorize by URL pattern
      if (details.url.includes('api.ipify.org') || details.url.includes('checkip.amazonaws.com') || 
          details.url.includes('icanhazip.com') || details.url.includes('ifconfig.me')) {
        resolvedIPs.ipv4 = details.ip;
        console.log('[IP What] Resolved IPv4 endpoint IP:', details.ip);
      } else if (details.url.includes('v6.ident.me') || details.url.includes('ipv6.icanhazip.com') ||
                 details.url.includes('[2001:4860:4860::8888]')) {
        resolvedIPs.ipv6 = details.ip;
        console.log('[IP What] Resolved IPv6 endpoint IP:', details.ip);
      } else if (details.url.includes('www.google.com')) {
        resolvedIPs.dns = details.ip;
        console.log('[IP What] Resolved DNS test IP:', details.ip);
      }
    }
  },
  { urls: ['<all_urls>'] }
);

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
  
  // Get previous status for change detection
  const prevStatus = await chrome.storage.local.get(['ipv4Status', 'ipv6Status']);
  
  // Check connectivity, get public IPs, and perform DNS checks in parallel
  const [ipv4Status, ipv6Status, publicIPv4, publicIPv6, dnsResults] = await Promise.all([
    checkConnectivity(settings.ipv4Target, 'ipv4', settings.timeout),
    checkConnectivity(settings.ipv6Target, 'ipv6', settings.timeout),
    getPublicIP('ipv4', settings.timeout),
    getPublicIP('ipv6', settings.timeout),
    performDnsChecks(settings.dnsFqdn, settings.dohServer, settings.timeout)
  ]);
  
  // Get local IPs via WebRTC
  const localIPs = await getLocalIPs();
  
  console.log('[IP What] Storing results - publicIPv4:', publicIPv4, 'publicIPv6:', publicIPv6);
  console.log('[IP What] DNS results:', dnsResults);
  
  const now = Date.now();
  
  await chrome.storage.local.set({
    lastCheck: now,
    ipv4Status,
    ipv6Status,
    publicIPv4,
    publicIPv6,
    localIPv4: localIPs.ipv4,
    localIPv6: localIPs.ipv6,
    dnsResults,
    resolvedIPs: { ...resolvedIPs }
  });
  
  // Store history entry
  await storeHistoryEntry(now, ipv4Status, ipv6Status);
  
  // Check for connectivity changes and notify
  await checkAndNotify(prevStatus, ipv4Status, ipv6Status);
  
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
  // Try multiple services in case one fails
  const ipv4Services = [
    'https://checkip.amazonaws.com/',
    'https://icanhazip.com/',
    'https://ifconfig.me/ip'
  ];
  
  const ipv6Services = [
    'https://v6.ident.me/',
    'https://ipv6.icanhazip.com/'
  ];
  
  const services = type === 'ipv4' ? ipv4Services : ipv6Services;
  
  for (const url of services) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      console.log(`[IP What] Getting public ${type} from: ${url}`);
      
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`[IP What] Public ${type} response not ok: ${response.status}`);
        continue;
      }
      
      const ip = (await response.text()).trim();
      console.log(`[IP What] Public ${type} result: ${ip}`);
      
      // Validate the result looks like an IP
      if (type === 'ipv4' && ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        return ip;
      }
      if (type === 'ipv6' && ip.includes(':')) {
        return ip;
      }
      
      console.log(`[IP What] Public ${type} result doesn't look valid`);
    } catch (error) {
      console.log(`[IP What] Failed to get public ${type} from ${url}:`, error.message);
    }
  }
  
  return null;
}

// Get local IP addresses - try multiple methods
async function getLocalIPs() {
  const result = { ipv4: null, ipv6: null };
  
  // Method 1: Try to get from network interfaces via fetch to local services
  // This won't work in service worker, so we return null and let popup handle it
  
  return result;
}

// Perform DNS resolution check - tests if system DNS can resolve the hostname
async function performDnsChecks(fqdn, dohServer, timeout) {
  const results = {
    fqdn,
    systemDns: null  // System DNS - can we resolve and reach the hostname?
  };
  
  results.systemDns = await testSystemDns(fqdn, timeout);
  
  return results;
}

// Test system DNS by attempting to fetch a hostname-based URL
// If this works, DNS resolution is functioning
// If IPv4/IPv6 connectivity works (by IP) but this fails, DNS is broken
async function testSystemDns(fqdn, timeout) {
  const startTime = Date.now();
  
  try {
    // Fetch the hostname via HTTPS - this tests DNS resolution
    const url = `https://${fqdn}/`;
    
    console.log(`[IP What] Testing system DNS: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'no-cors',  // We don't care about the response, just that we connected
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    console.log(`[IP What] System DNS success in ${latency}ms`);
    
    return {
      success: true,
      latency
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    console.log(`[IP What] System DNS error:`, error.message);
    
    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout', latency: timeout };
    }
    
    // Check if it's a DNS failure vs connection failure
    // DNS failures typically show as "net::ERR_NAME_NOT_RESOLVED"
    if (error.message.includes('ERR_NAME_NOT_RESOLVED') || error.message.includes('getaddrinfo')) {
      return { success: false, error: 'DNS failed', latency };
    }
    
    return { success: false, error: error.message, latency };
  }
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
  
  if (message.action === 'getHistory') {
    chrome.storage.local.get(['connectivityHistory', 'connectivityEvents']).then(sendResponse);
    return true;
  }
  
  if (message.action === 'clearHistory') {
    chrome.storage.local.set({ connectivityHistory: [], connectivityEvents: [] }).then(() => {
      sendResponse({ success: true });
    });
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

// Calculate jitter (variance in latency) from recent samples
function calculateJitter(history, type, windowSize = 10) {
  const latencyKey = `${type}Latency`;
  const recentLatencies = history
    .slice(-windowSize)
    .map(h => h[latencyKey])
    .filter(l => l !== null && l !== undefined);
  
  if (recentLatencies.length < 2) return null;
  
  // Calculate mean
  const mean = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length;
  
  // Calculate variance
  const variance = recentLatencies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentLatencies.length;
  
  // Jitter is standard deviation of latency
  return Math.round(Math.sqrt(variance));
}

// Calculate packet loss percentage from recent samples
function calculatePacketLoss(history, type, windowSize = 20) {
  const recentEntries = history.slice(-windowSize);
  if (recentEntries.length === 0) return null;
  
  const total = recentEntries.length;
  const failures = recentEntries.filter(h => h[type] === false).length;
  
  return Math.round((failures / total) * 100);
}

// Store history entry
async function storeHistoryEntry(timestamp, ipv4Status, ipv6Status) {
  const { connectivityHistory = [] } = await chrome.storage.local.get('connectivityHistory');
  
  // Add new entry first (without jitter/packet loss)
  const newEntry = {
    timestamp,
    ipv4: ipv4Status?.connected ?? null,
    ipv6: ipv6Status?.connected ?? null,
    ipv4Latency: ipv4Status?.latency ?? null,
    ipv6Latency: ipv6Status?.latency ?? null
  };
  
  connectivityHistory.push(newEntry);
  
  // Calculate jitter and packet loss based on updated history
  newEntry.ipv4Jitter = calculateJitter(connectivityHistory, 'ipv4');
  newEntry.ipv6Jitter = calculateJitter(connectivityHistory, 'ipv6');
  newEntry.ipv4PacketLoss = calculatePacketLoss(connectivityHistory, 'ipv4');
  newEntry.ipv6PacketLoss = calculatePacketLoss(connectivityHistory, 'ipv6');
  
  // Keep only last 24 hours (assuming 30 second intervals = 2880 entries max)
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const filteredHistory = connectivityHistory.filter(entry => entry.timestamp > oneDayAgo);
  
  await chrome.storage.local.set({ connectivityHistory: filteredHistory });
}

// Check for connectivity changes and send notifications
async function checkAndNotify(prevStatus, ipv4Status, ipv6Status) {
  const prevIpv4 = prevStatus?.ipv4Status?.connected;
  const prevIpv6 = prevStatus?.ipv6Status?.connected;
  const currIpv4 = ipv4Status?.connected;
  const currIpv6 = ipv6Status?.connected;
  
  const changes = [];
  const now = Date.now();
  
  // Detect IPv4 changes
  if (prevIpv4 !== undefined && prevIpv4 !== currIpv4) {
    if (currIpv4) {
      changes.push('IPv4 connected');
    } else {
      changes.push('IPv4 disconnected');
    }
  }
  
  // Detect IPv6 changes
  if (prevIpv6 !== undefined && prevIpv6 !== currIpv6) {
    if (currIpv6) {
      changes.push('IPv6 connected');
    } else {
      changes.push('IPv6 disconnected');
    }
  }
  
  // Store event if there were changes
  if (changes.length > 0) {
    const { connectivityEvents = [] } = await chrome.storage.local.get('connectivityEvents');
    
    for (const change of changes) {
      connectivityEvents.push({
        timestamp: now,
        event: change,
        type: change.includes('connected') && !change.includes('disconnected') ? 'up' : 'down'
      });
    }
    
    // Keep only last 100 events
    const trimmedEvents = connectivityEvents.slice(-100);
    await chrome.storage.local.set({ connectivityEvents: trimmedEvents });
    
    // Send notification
    const message = changes.join(', ');
    const isDown = changes.some(c => c.includes('disconnected'));
    
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.svg',
        title: isDown ? '⚠️ Connectivity Change' : '✓ Connectivity Restored',
        message: message,
        priority: isDown ? 2 : 1
      });
    } catch (error) {
      console.log('[IP What] Notification error:', error.message);
    }
  }
}
