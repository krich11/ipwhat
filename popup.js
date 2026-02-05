// Popup script for IP What extension

const DEFAULT_SETTINGS = {
  ipv4Target: '8.8.8.8',
  ipv6Target: '2001:4860:4860::8888',
  checkInterval: 30,
  timeout: 5000
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
    'publicIPv4', 'publicIPv6', 'localIPv4', 'localIPv6'
  ]);
  
  updateStatusCard('ipv4', status.ipv4Status);
  updateStatusCard('ipv6', status.ipv6Status);
  
  // Update IP addresses
  document.getElementById('local-ipv4').textContent = status.localIPv4 || 'Not detected';
  document.getElementById('local-ipv6').textContent = status.localIPv6 || 'Not detected';
  document.getElementById('public-ipv4').textContent = status.publicIPv4 || 'Not detected';
  document.getElementById('public-ipv6').textContent = status.publicIPv6 || 'Not detected';
  
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

// TODO: Fetch and display public IP addresses
// async function fetchPublicIPs() {
//   try {
//     const ipv4Response = await fetch('https://api.ipify.org?format=json');
//     const ipv4Data = await ipv4Response.json();
//     document.getElementById('public-ipv4').textContent = ipv4Data.ip;
//   } catch (e) {
//     document.getElementById('public-ipv4').textContent = 'Not available';
//   }
//   
//   try {
//     const ipv6Response = await fetch('https://api64.ipify.org?format=json');
//     const ipv6Data = await ipv6Response.json();
//     document.getElementById('public-ipv6').textContent = ipv6Data.ip;
//   } catch (e) {
//     document.getElementById('public-ipv6').textContent = 'Not available';
//   }
// }
