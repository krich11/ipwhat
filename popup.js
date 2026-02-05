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
    'publicIPv4', 'publicIPv6', 'localIPv4', 'localIPv6', 'dnsResults'
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
    updateDnsResults(status.dnsResults);
  }
  
  if (status.lastCheck) {
    const lastCheck = new Date(status.lastCheck);
    document.getElementById('last-check').textContent = `Last check: ${formatTime(lastCheck)}`;
  }
}

function updateStatusCard(type, status) {
  const indicator = document.getElementById(`${type}-indicator`);
  const latencyEl = document.getElementById(`${type}-latency`);
  const card = document.getElementById(`${type}-card`);
  
  if (!status) {
    indicator.className = 'status-indicator unknown';
    indicator.textContent = '?';
    latencyEl.textContent = 'Not checked';
    return;
  }
  
  if (status.connected) {
    indicator.className = 'status-indicator connected';
    indicator.textContent = '✓';
    latencyEl.textContent = `${status.latency}ms`;
    card.classList.remove('disconnected');
    card.classList.add('connected');
  } else {
    indicator.className = 'status-indicator disconnected';
    indicator.textContent = '✗';
    latencyEl.textContent = status.error || 'Disconnected';
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

function updateDnsResults(dnsResults) {
  // Display the FQDN being tested
  document.getElementById('dns-fqdn-display').textContent = dnsResults.fqdn;
  
  const resultEl = document.getElementById('dns-result');
  const latencyEl = document.getElementById('dns-latency');
  
  if (!dnsResults.systemDns) {
    resultEl.textContent = '-';
    resultEl.className = 'dns-test-result';
    latencyEl.textContent = '';
    return;
  }
  
  const result = dnsResults.systemDns;
  
  if (result.success) {
    resultEl.textContent = '✓ OK';
    resultEl.className = 'dns-test-result success';
  } else {
    resultEl.textContent = '✗ ' + (result.error || 'Failed');
    resultEl.className = 'dns-test-result error';
  }
  
  latencyEl.textContent = result.latency ? `${result.latency}ms` : '';
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
