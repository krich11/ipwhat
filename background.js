// Background service worker for IP connectivity checks

// Default to Cloudflare DNS IPs - these serve HTTP on port 80
// Direct IP connection proves connectivity without DNS resolution
const DEFAULT_SETTINGS = {
  ipv4Target: '1.1.1.1',
  ipv6Target: '2606:4700:4700::1111',
  checkInterval: 30, // seconds
  timeout: 5000, // milliseconds
  dnsFqdn: 'www.cloudflare.com'
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
  
  // Get previous status for change detection
  const prevStatus = await chrome.storage.local.get(['ipv4Status', 'ipv6Status']);
  
  // Check connectivity and get public IPs in parallel
  const [ipv4Status, ipv6Status, publicIPv4, publicIPv6] = await Promise.all([
    checkConnectivity(settings.ipv4Target, 'ipv4', settings.timeout),
    checkConnectivity(settings.ipv6Target, 'ipv6', settings.timeout),
    getPublicIP('ipv4', settings.timeout),
    getPublicIP('ipv6', settings.timeout)
  ]);
  
  // Get local IPs via WebRTC
  const localIPs = await getLocalIPs();
  
  console.log('[IP What] Storing results - publicIPv4:', publicIPv4, 'publicIPv6:', publicIPv6);
  
  const now = Date.now();
  
  await chrome.storage.local.set({
    lastCheck: now,
    ipv4Status,
    ipv6Status,
    publicIPv4,
    publicIPv6,
    localIPv4: localIPs.ipv4,
    localIPv6: localIPs.ipv6
  });
  
  // Store history entry
  await storeHistoryEntry(now, ipv4Status, ipv6Status);
  
  // Check for connectivity changes and notify
  await checkAndNotify(prevStatus, ipv4Status, ipv6Status);
  
  updateBadge(ipv4Status, ipv6Status);
}

// Check connectivity to a target IP address
// Uses HTTP fetch directly to the IP - no DNS resolution, no cert issues
// TCP connection + HTTP response proves IP connectivity
async function checkConnectivity(target, type, timeout) {
  const startTime = Date.now();
  
  try {
    // Use HTTP (not HTTPS) to avoid cert validation issues with IP literals
    // Format: http://1.1.1.1/ for IPv4, http://[2606:4700:4700::1111]/ for IPv6
    const url = type === 'ipv4' 
      ? `http://${target}/`
      : `http://[${target}]/`;
    
    console.log(`[IP What] Checking ${type}: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Use no-cors mode - we don't need to read the response,
    // just confirm TCP connection succeeded (fetch resolves = connected)
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      mode: 'no-cors'
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    // With no-cors, response is opaque (status=0) but fetch resolving = TCP connected
    console.log(`[IP What] ${type} success in ${latency}ms (connected)`);
    
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
        latency: null,  // Don't store timeout as latency - it's not a real measurement
        lastChecked: Date.now(),
        error: 'Timeout'
      };
    }
    
    // For any other error (TypeError/Failed to fetch), treat as no connectivity
    return {
      connected: false,
      latency: null,  // Don't store failure time as latency
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

// Calculate jitter using trimmed standard deviation of latencies
// Removes top/bottom 10% to eliminate outliers (spikes, artificially fast responses)
// Only considers successful pings (excludes timeouts/failures)
function calculateJitter(history, type) {
  const connectedKey = type;  // 'ipv4' or 'ipv6' - boolean status
  const latencyKey = `${type}Latency`;
  
  // Only use latencies from successful connections
  let latencies = history
    .slice(-20)
    .filter(h => h[connectedKey] === true)  // Only successful pings
    .map(h => h[latencyKey])
    .filter(l => l !== null && l !== undefined && l > 0);
  
  if (latencies.length < 5) return null;  // Need enough samples for trimming
  
  // Sort and trim top/bottom 10% (min 1 from each end)
  latencies.sort((a, b) => a - b);
  const trimCount = Math.max(1, Math.floor(latencies.length * 0.1));
  const trimmedLatencies = latencies.slice(trimCount, -trimCount);
  
  if (trimmedLatencies.length < 2) return null;
  
  // Calculate standard deviation on trimmed data
  const mean = trimmedLatencies.reduce((a, b) => a + b, 0) / trimmedLatencies.length;
  const squaredDiffs = trimmedLatencies.map(l => Math.pow(l - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / trimmedLatencies.length;
  const stdDev = Math.sqrt(variance);
  
  return Math.round(stdDev);
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
        iconUrl: 'icons/icon128.png',
        title: isDown ? '⚠️ Connectivity Change' : '✓ Connectivity Restored',
        message: message,
        priority: isDown ? 2 : 1
      });
    } catch (error) {
      console.log('[IP What] Notification error:', error.message);
    }
  }
}
