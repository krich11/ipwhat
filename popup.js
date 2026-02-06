// Popup script for IP What extension

const DEFAULT_SETTINGS = {
  ipv4Target: '8.8.8.8',
  ipv6Target: '2001:4860:4860::8888',
  checkInterval: 30,
  timeout: 5000,
  dnsFqdn: 'www.google.com'
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadStatus();
  await loadSettings();
  
  document.getElementById('check-now').addEventListener('click', checkNow);
  document.getElementById('open-settings').addEventListener('click', openSettings);
  
  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      
      // Update active tab button
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`tab-${tabId}`).classList.add('active');
      
      // Load data when switching to specific tabs
      if (tabId === 'history') {
        loadHistory();
      } else if (tabId === 'about') {
        loadAbout();
      }
    });
  });
  
  // History tab buttons
  document.getElementById('export-csv').addEventListener('click', exportCSV);
  document.getElementById('clear-history').addEventListener('click', clearHistory);
  
  // About tab links
  document.getElementById('open-settings-about').addEventListener('click', (e) => {
    e.preventDefault();
    openSettings();
  });
  
  // Add click-to-copy for IP addresses
  document.querySelectorAll('.copyable').forEach(el => {
    el.addEventListener('click', async () => {
      const text = el.textContent;
      if (text && text !== '-' && text !== 'Not detected') {
        try {
          await navigator.clipboard.writeText(text);
          const original = el.textContent;
          el.textContent = 'Copied!';
          el.classList.add('copied');
          setTimeout(() => {
            el.textContent = original;
            el.classList.remove('copied');
          }, 1000);
        } catch (err) {
          console.error('Copy failed:', err);
        }
      }
    });
  });
});

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  document.getElementById('ipv4-target').textContent = settings.ipv4Target;
  document.getElementById('ipv6-target').textContent = settings.ipv6Target;
}

async function loadStatus() {
  const status = await chrome.storage.local.get([
    'lastCheck', 'ipv4Status', 'ipv6Status',
    'publicIPv4', 'publicIPv6', 'localIPv4', 'localIPv6', 'dnsResults', 'resolvedIPs'
  ]);
  
  updateStatusCard('ipv4', status.ipv4Status);
  updateStatusCard('ipv6', status.ipv6Status);
  
  // Update public IP addresses from storage
  document.getElementById('public-ipv4').textContent = status.publicIPv4 || 'Not detected';
  document.getElementById('public-ipv6').textContent = status.publicIPv6 || 'Not detected';
  
  // Get local IPs using WebRTC (works in popup context)
  const localIPs = await getLocalIPs();
  document.getElementById('local-ipv4').textContent = localIPs.ipv4 || 'Not detected';
  document.getElementById('local-ipv6').textContent = localIPs.ipv6 || 'Not detected';
  
  // Update DNS resolution results
  if (status.dnsResults) {
    updateDnsResults(status.dnsResults, status.resolvedIPs);
  }
  
  // Update resolved IPs
  if (status.resolvedIPs) {
    updateResolvedIPs(status.resolvedIPs);
  }
  
  if (status.lastCheck) {
    const lastCheck = new Date(status.lastCheck);
    document.getElementById('last-check').textContent = `Last check: ${formatTime(lastCheck)}`;
  }
}

function updateStatusCard(type, status) {
  const indicator = document.getElementById(`${type}-indicator`);
  const card = document.getElementById(`${type}-card`);
  
  if (!status) {
    indicator.className = 'status-indicator unknown';
    indicator.textContent = '?';
    return;
  }
  
  if (status.connected) {
    indicator.className = 'status-indicator connected';
    indicator.textContent = '✓';
    card.classList.remove('disconnected');
    card.classList.add('connected');
  } else {
    indicator.className = 'status-indicator disconnected';
    indicator.textContent = '✗';
    card.classList.remove('connected');
    card.classList.add('disconnected');
  }
}

async function checkNow() {
  const button = document.getElementById('check-now');
  button.disabled = true;
  button.textContent = 'Checking...';
  
  try {
    await chrome.runtime.sendMessage({ action: 'checkNow' });
    await loadStatus();
  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    button.disabled = false;
    button.textContent = 'Check Now';
  }
}

function updateResolvedIPs(resolvedIPs) {
  const ipv4Resolved = document.getElementById('ipv4-resolved');
  const ipv6Resolved = document.getElementById('ipv6-resolved');
  const dnsResolved = document.getElementById('dns-resolved');
  
  if (resolvedIPs.ipv4) {
    ipv4Resolved.textContent = `→ ${resolvedIPs.ipv4}`;
    ipv4Resolved.dataset.ip = resolvedIPs.ipv4;
    ipv4Resolved.classList.add('copyable');
    ipv4Resolved.title = 'Resolved IP - Click to copy';
    addCopyListener(ipv4Resolved);
  } else {
    ipv4Resolved.textContent = '';
  }
  
  if (resolvedIPs.ipv6) {
    ipv6Resolved.textContent = `→ ${resolvedIPs.ipv6}`;
    ipv6Resolved.dataset.ip = resolvedIPs.ipv6;
    ipv6Resolved.classList.add('copyable');
    ipv6Resolved.title = 'Resolved IP - Click to copy';
    addCopyListener(ipv6Resolved);
  } else {
    ipv6Resolved.textContent = '';
  }
  
  if (resolvedIPs.dns) {
    dnsResolved.textContent = `→ ${resolvedIPs.dns}`;
    dnsResolved.dataset.ip = resolvedIPs.dns;
    dnsResolved.classList.add('copyable');
    dnsResolved.title = 'Resolved IP - Click to copy';
    addCopyListener(dnsResolved);
  } else {
    dnsResolved.textContent = '';
  }
}

function addCopyListener(el) {
  // Remove existing listener to prevent duplicates
  el.removeEventListener('click', handleCopy);
  el.addEventListener('click', handleCopy);
}

async function handleCopy(e) {
  const el = e.target;
  const ip = el.dataset.ip;
  if (ip) {
    try {
      await navigator.clipboard.writeText(ip);
      const original = el.textContent;
      el.textContent = 'Copied!';
      el.classList.add('copied');
      setTimeout(() => {
        el.textContent = original;
        el.classList.remove('copied');
      }, 1000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }
}

function updateDnsResults(dnsResults) {
  // Display the FQDN being tested
  document.getElementById('dns-fqdn-display').textContent = dnsResults.fqdn;
  
  const indicator = document.getElementById('dns-indicator');
  const card = document.getElementById('dns-card');
  
  if (!dnsResults.systemDns) {
    indicator.className = 'status-indicator unknown';
    indicator.textContent = '?';
    return;
  }
  
  const result = dnsResults.systemDns;
  
  if (result.success) {
    indicator.className = 'status-indicator connected';
    indicator.textContent = '✓';
    card.classList.remove('disconnected');
    card.classList.add('connected');
  } else {
    indicator.className = 'status-indicator disconnected';
    indicator.textContent = '✗';
    card.classList.remove('connected');
    card.classList.add('disconnected');
  }
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function formatTime(date) {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Get local IP addresses using WebRTC
async function getLocalIPs() {
  const result = { ipv4: null, ipv6: null };
  
  try {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    pc.createDataChannel('');
    
    const candidates = [];
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        candidates.push(event.candidate.candidate);
      }
    };
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Wait for ICE gathering with timeout
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2000);
      
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        resolve();
      } else {
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve();
          }
        });
      }
    });
    
    pc.close();
    
    // Parse local IPs from candidates
    for (const candidate of candidates) {
      console.log('[IP What] ICE candidate:', candidate);
      
      // Match IPv4 addresses
      const ipv4Match = candidate.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
      if (ipv4Match && !result.ipv4) {
        const ip = ipv4Match[1];
        // Skip loopback and link-local
        if (!ip.startsWith('127.') && !ip.startsWith('0.') && !ip.startsWith('169.254.')) {
          result.ipv4 = ip;
          console.log('[IP What] Found local IPv4:', ip);
        }
      }
      
      // Match IPv6 addresses - they appear after the port number in the candidate
      // Format: "... 2605:59c1:1539:b378:9d2a:c92f:a85c:1d83 55026 typ host ..."
      const ipv6Match = candidate.match(/\s([0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{0,4}){2,7})\s+\d+\s+typ/);
      if (ipv6Match && !result.ipv6) {
        const ip = ipv6Match[1];
        // Skip link-local (fe80::)
        if (!ip.toLowerCase().startsWith('fe80')) {
          result.ipv6 = ip;
          console.log('[IP What] Found local IPv6:', ip);
        }
      }
    }
  } catch (error) {
    console.log('[IP What] Failed to get local IPs:', error.message);
  }
  
  return result;
}

// History functions
async function loadHistory() {
  const { connectivityHistory = [], connectivityEvents = [] } = 
    await chrome.runtime.sendMessage({ action: 'getHistory' });
  
  // Calculate uptime percentages
  const ipv4Uptime = calculateUptime(connectivityHistory, 'ipv4');
  const ipv6Uptime = calculateUptime(connectivityHistory, 'ipv6');
  
  document.getElementById('ipv4-uptime').textContent = ipv4Uptime;
  document.getElementById('ipv6-uptime').textContent = ipv6Uptime;
  
  // Render timeline graph
  renderGraph('ipv4-graph', connectivityHistory, 'ipv4');
  renderGraph('ipv6-graph', connectivityHistory, 'ipv6');
  
  // Render jitter graphs
  renderMetricGraph('ipv4-jitter-graph', connectivityHistory, 'ipv4Jitter', 'jitter');
  renderMetricGraph('ipv6-jitter-graph', connectivityHistory, 'ipv6Jitter', 'jitter');
  
  // Render packet loss graphs
  renderMetricGraph('ipv4-loss-graph', connectivityHistory, 'ipv4PacketLoss', 'loss');
  renderMetricGraph('ipv6-loss-graph', connectivityHistory, 'ipv6PacketLoss', 'loss');
  
  // Update current metric values
  updateCurrentMetricValues(connectivityHistory);
  
  // Render recent events
  renderEvents(connectivityEvents);
}

function calculateUptime(history, type) {
  if (history.length === 0) return '-';
  
  const connectedCount = history.filter(h => h[type] === true).length;
  const totalCount = history.filter(h => h[type] !== null).length;
  
  if (totalCount === 0) return '-';
  
  const percentage = (connectedCount / totalCount * 100).toFixed(1);
  return `${percentage}%`;
}

function renderGraph(elementId, history, type) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';
  
  if (history.length === 0) {
    container.innerHTML = '<span class="no-data">No data yet</span>';
    return;
  }
  
  // Create 48 buckets (30 min each for 24 hours)
  const buckets = [];
  const now = Date.now();
  const bucketDuration = 30 * 60 * 1000; // 30 minutes
  
  for (let i = 47; i >= 0; i--) {
    const bucketStart = now - (i + 1) * bucketDuration;
    const bucketEnd = now - i * bucketDuration;
    
    const entriesInBucket = history.filter(h => 
      h.timestamp >= bucketStart && h.timestamp < bucketEnd
    );
    
    let status = 'unknown';
    if (entriesInBucket.length > 0) {
      const connected = entriesInBucket.filter(h => h[type] === true).length;
      const disconnected = entriesInBucket.filter(h => h[type] === false).length;
      
      if (connected > disconnected) {
        status = 'connected';
      } else if (disconnected > 0) {
        status = 'disconnected';
      }
    }
    
    buckets.push(status);
  }
  
  // Render buckets
  buckets.forEach((status, i) => {
    const bar = document.createElement('div');
    bar.className = `graph-segment ${status}`;
    bar.title = getTimeLabel(47 - i);
    container.appendChild(bar);
  });
}

function getTimeLabel(bucketsAgo) {
  const hours = (bucketsAgo * 0.5).toFixed(1);
  return `${hours}h ago`;
}

function renderMetricGraph(elementId, history, metricKey, metricType) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';
  
  if (history.length === 0) {
    container.innerHTML = '<span class="no-data">No data yet</span>';
    return;
  }
  
  // Create 48 buckets (30 min each for 24 hours)
  const buckets = [];
  const now = Date.now();
  const bucketDuration = 30 * 60 * 1000; // 30 minutes
  
  for (let i = 47; i >= 0; i--) {
    const bucketStart = now - (i + 1) * bucketDuration;
    const bucketEnd = now - i * bucketDuration;
    
    const entriesInBucket = history.filter(h => 
      h.timestamp >= bucketStart && h.timestamp < bucketEnd
    );
    
    let status = 'unknown';
    let avgValue = null;
    
    if (entriesInBucket.length > 0) {
      const values = entriesInBucket
        .map(h => h[metricKey])
        .filter(v => v !== null && v !== undefined);
      
      if (values.length > 0) {
        avgValue = values.reduce((a, b) => a + b, 0) / values.length;
        
        if (metricType === 'jitter') {
          // Jitter: low < 10ms, medium 10-50ms, high > 50ms
          if (avgValue < 10) {
            status = 'jitter-low';
          } else if (avgValue <= 50) {
            status = 'jitter-medium';
          } else {
            status = 'jitter-high';
          }
        } else if (metricType === 'loss') {
          // Packet loss: none = 0%, low = 1-5%, high > 5%
          if (avgValue === 0) {
            status = 'loss-none';
          } else if (avgValue <= 5) {
            status = 'loss-low';
          } else {
            status = 'loss-high';
          }
        }
      }
    }
    
    buckets.push({ status, value: avgValue });
  }
  
  // Render buckets
  buckets.forEach((bucket, i) => {
    const bar = document.createElement('div');
    bar.className = `graph-segment ${bucket.status}`;
    
    const timeLabel = getTimeLabel(47 - i);
    const valueLabel = bucket.value !== null 
      ? (metricType === 'jitter' ? `${Math.round(bucket.value)}ms` : `${Math.round(bucket.value)}%`)
      : 'No data';
    bar.title = `${timeLabel}: ${valueLabel}`;
    
    container.appendChild(bar);
  });
}

function updateCurrentMetricValues(history) {
  // Get the most recent entry with jitter/loss data
  const recent = history.slice(-1)[0];
  
  console.log('[IP What] Recent history entry:', recent);
  
  if (recent) {
    const ipv4Jitter = recent.ipv4Jitter;
    const ipv6Jitter = recent.ipv6Jitter;
    const ipv4Loss = recent.ipv4PacketLoss;
    const ipv6Loss = recent.ipv6PacketLoss;
    
    document.getElementById('ipv4-jitter-value').textContent = 
      (ipv4Jitter !== null && ipv4Jitter !== undefined) ? `${ipv4Jitter}ms` : '-';
    document.getElementById('ipv6-jitter-value').textContent = 
      (ipv6Jitter !== null && ipv6Jitter !== undefined) ? `${ipv6Jitter}ms` : '-';
    document.getElementById('ipv4-loss-value').textContent = 
      (ipv4Loss !== null && ipv4Loss !== undefined) ? `${ipv4Loss}%` : '-';
    document.getElementById('ipv6-loss-value').textContent = 
      (ipv6Loss !== null && ipv6Loss !== undefined) ? `${ipv6Loss}%` : '-';
  }
}

function renderEvents(events) {
  const container = document.getElementById('event-list');
  
  if (events.length === 0) {
    container.innerHTML = '<div class="no-events">No events recorded yet</div>';
    return;
  }
  
  // Show most recent 10 events
  const recentEvents = events.slice(-10).reverse();
  
  container.innerHTML = recentEvents.map(event => {
    const time = new Date(event.timestamp);
    const timeStr = time.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const icon = event.type === 'up' ? '🟢' : '🔴';
    
    return `<div class="event-item ${event.type}">
      <span class="event-icon">${icon}</span>
      <span class="event-text">${event.event}</span>
      <span class="event-time">${timeStr}</span>
    </div>`;
  }).join('');
}

async function exportCSV() {
  const { connectivityHistory = [] } = 
    await chrome.runtime.sendMessage({ action: 'getHistory' });
  
  if (connectivityHistory.length === 0) {
    alert('No history to export');
    return;
  }
  
  // Build CSV
  const headers = ['Timestamp', 'DateTime', 'IPv4', 'IPv4 Latency', 'IPv4 Jitter', 'IPv4 Packet Loss', 'IPv6', 'IPv6 Latency', 'IPv6 Jitter', 'IPv6 Packet Loss'];
  const rows = connectivityHistory.map(h => [
    h.timestamp,
    new Date(h.timestamp).toISOString(),
    h.ipv4 === true ? 'connected' : (h.ipv4 === false ? 'disconnected' : 'unknown'),
    h.ipv4Latency ?? '',
    h.ipv4Jitter ?? '',
    h.ipv4PacketLoss ?? '',
    h.ipv6 === true ? 'connected' : (h.ipv6 === false ? 'disconnected' : 'unknown'),
    h.ipv6Latency ?? '',
    h.ipv6Jitter ?? '',
    h.ipv6PacketLoss ?? ''
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ipwhat-history-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearHistory() {
  if (confirm('Clear all connectivity history?')) {
    await chrome.runtime.sendMessage({ action: 'clearHistory' });
    loadHistory();
  }
}

// About tab functions
async function loadAbout() {
  // Get extension version from manifest
  const manifest = chrome.runtime.getManifest();
  document.getElementById('extension-version').textContent = `v${manifest.version}`;
  
  // Get settings
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  document.getElementById('about-check-interval').textContent = `${settings.checkInterval}s`;
  document.getElementById('about-ipv4-target').textContent = settings.ipv4Target;
  document.getElementById('about-ipv6-target').textContent = settings.ipv6Target;
}
