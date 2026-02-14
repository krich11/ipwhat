// Options page script for IP What? extension

const DEFAULT_SETTINGS = {
  ipv4Target: '1.1.1.1',
  ipv6Target: '2606:4700:4700::1111',
  timeout: 5000,
  dnsFqdn: 'www.cloudflare.com'
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  
  document.getElementById('settings-form').addEventListener('submit', saveSettings);
  document.getElementById('reset-defaults').addEventListener('click', resetDefaults);
  
  // Preset pill buttons
  document.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      // Clear active state from all pills
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      
      document.getElementById('ipv4-target').value = btn.dataset.ipv4;
      document.getElementById('ipv6-target').value = btn.dataset.ipv6;
      if (btn.dataset.dns) {
        document.getElementById('dns-fqdn').value = btn.dataset.dns;
      }
    });
  });
});

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  
  document.getElementById('ipv4-target').value = settings.ipv4Target;
  document.getElementById('ipv6-target').value = settings.ipv6Target;
  document.getElementById('timeout').value = settings.timeout;
  document.getElementById('dns-fqdn').value = settings.dnsFqdn;
}

async function saveSettings(e) {
  e.preventDefault();
  
  const settings = {
    ipv4Target: document.getElementById('ipv4-target').value.trim(),
    ipv6Target: document.getElementById('ipv6-target').value.trim(),
    timeout: parseInt(document.getElementById('timeout').value, 10),
    dnsFqdn: document.getElementById('dns-fqdn').value.trim()
  };
  
  // Validate IPv4
  if (!isValidIPv4(settings.ipv4Target)) {
    showStatus('Invalid IPv4 address', 'error');
    return;
  }
  
  // Validate IPv6
  if (!isValidIPv6(settings.ipv6Target)) {
    showStatus('Invalid IPv6 address', 'error');
    return;
  }
  
  try {
    await chrome.storage.sync.set(settings);
    showStatus('Settings saved successfully!', 'success');
    
    // Trigger an immediate connectivity check with new settings
    chrome.runtime.sendMessage({ action: 'checkNow' });
  } catch (error) {
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
}

async function resetDefaults() {
  document.getElementById('ipv4-target').value = DEFAULT_SETTINGS.ipv4Target;
  document.getElementById('ipv6-target').value = DEFAULT_SETTINGS.ipv6Target;
  document.getElementById('timeout').value = DEFAULT_SETTINGS.timeout;
  document.getElementById('dns-fqdn').value = DEFAULT_SETTINGS.dnsFqdn;
  
  try {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    showStatus('Settings reset to defaults', 'success');
    chrome.runtime.sendMessage({ action: 'checkNow' });
  } catch (error) {
    showStatus('Failed to reset settings: ' + error.message, 'error');
  }
}

function isValidIPv4(ip) {
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!pattern.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

function isValidIPv6(ip) {
  // Basic IPv6 validation - supports standard and compressed formats
  const pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return pattern.test(ip) || /^::$/.test(ip) || /^::1$/.test(ip);
}

function showStatus(message, type) {
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = message;
  statusEl.className = `save-status ${type}`;
  
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'save-status';
  }, 3000);
}
