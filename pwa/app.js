// IP What - PWA

const DEFAULT_SETTINGS = {
  ipv4Target: '8.8.8.8',
  ipv6Target: '2001:4860:4860::8888',
  timeout: 5000
};

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem('ipwhat-settings');
  if (saved) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  }
  return DEFAULT_SETTINGS;
}

// Save settings to localStorage
function saveSettings(settings) {
  localStorage.setItem('ipwhat-settings', JSON.stringify(settings));
}

// Check connectivity to a target IP
async function checkConnectivity(target, type, timeout) {
  const startTime = Date.now();
  
  try {
    const formattedTarget = type === 'ipv6' ? `[${target}]` : target;
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
    
    return { connected: true, latency, error: null };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      return { connected: false, latency: timeout, error: 'Timeout' };
    }
    
    return { connected: false, latency, error: 'Connection failed' };
  }
}

// Update the UI with status
function updateUI(ipv4Status, ipv6Status) {
  const digit4 = document.getElementById('digit4');
  const digit6 = document.getElementById('digit6');
  const ipv4StatusEl = document.getElementById('ipv4-status');
  const ipv6StatusEl = document.getElementById('ipv6-status');
  const ipv4LatencyEl = document.getElementById('ipv4-latency');
  const ipv6LatencyEl = document.getElementById('ipv6-latency');
  
  // Update digit colors
  digit4.className = 'digit ' + (ipv4Status?.connected ? 'green' : 'red');
  digit6.className = 'digit ' + (ipv6Status?.connected ? 'green' : 'red');
  
  // Update status text
  const settings = loadSettings();
  
  if (ipv4Status) {
    ipv4StatusEl.textContent = ipv4Status.connected ? settings.ipv4Target : (ipv4Status.error || 'Failed');
    ipv4LatencyEl.textContent = ipv4Status.connected ? `${ipv4Status.latency}ms` : '';
  }
  
  if (ipv6Status) {
    ipv6StatusEl.textContent = ipv6Status.connected ? settings.ipv6Target : (ipv6Status.error || 'Failed');
    ipv6LatencyEl.textContent = ipv6Status.connected ? `${ipv6Status.latency}ms` : '';
  }
  
  // Update last check time
  document.getElementById('last-check').textContent = `Last check: ${new Date().toLocaleTimeString()}`;
}

// Run connectivity check
async function runCheck() {
  const btn = document.getElementById('check-btn');
  btn.disabled = true;
  btn.textContent = 'Checking...';
  
  const settings = loadSettings();
  
  // Run both checks in parallel
  const [ipv4Status, ipv6Status] = await Promise.all([
    checkConnectivity(settings.ipv4Target, 'ipv4', settings.timeout),
    checkConnectivity(settings.ipv6Target, 'ipv6', settings.timeout)
  ]);
  
  updateUI(ipv4Status, ipv6Status);
  
  btn.disabled = false;
  btn.textContent = 'Check Now';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const settings = loadSettings();
  
  // Populate settings inputs
  document.getElementById('ipv4-target').value = settings.ipv4Target;
  document.getElementById('ipv6-target').value = settings.ipv6Target;
  
  // Check button
  document.getElementById('check-btn').addEventListener('click', runCheck);
  
  // Save settings
  document.getElementById('save-settings').addEventListener('click', () => {
    const newSettings = {
      ...settings,
      ipv4Target: document.getElementById('ipv4-target').value.trim(),
      ipv6Target: document.getElementById('ipv6-target').value.trim()
    };
    saveSettings(newSettings);
    alert('Settings saved!');
  });
  
  // Run initial check
  runCheck();
});

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(err => console.log('Service Worker failed:', err));
}
