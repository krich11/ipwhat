# IP What - IPv4/IPv6 Connectivity Checker

A Chrome extension that monitors IPv4 and IPv6 connectivity by checking DNS server reachability.

## Features

- ✅ Real-time IPv4 and IPv6 connectivity status
- ⚙️ Configurable ping targets (default: Google DNS)
- 🎨 Visual badge indicator for quick status checks
- ⏱️ Latency measurement
- 🔧 Preset targets for popular DNS providers

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `ipwhat` folder

## Usage

- Click the extension icon to see current connectivity status
- Green checkmark = Both IPv4 and IPv6 connected
- Orange exclamation = Partial connectivity
- Red X = No connectivity

### Settings

Click "Settings" in the popup or right-click the extension icon and select "Options" to:
- Change IPv4/IPv6 target addresses
- Adjust timeout and check intervals
- Use preset configurations (Google, Cloudflare, Quad9, OpenDNS)

## Default Targets

| Provider | IPv4 | IPv6 |
|----------|------|------|
| Google DNS | 8.8.8.8 | 2001:4860:4860::8888 |
| Cloudflare | 1.1.1.1 | 2606:4700:4700::1111 |
| Quad9 | 9.9.9.9 | 2620:fe::fe |
| OpenDNS | 208.67.222.222 | 2620:119:35::35 |

## TODO

- [ ] Identify and display public IPv4 address
- [ ] Identify and display public IPv6 address
- [ ] Add context menu with IP addresses
- [ ] Add copy-to-clipboard functionality for IPs
- [ ] Add notification support for connectivity changes

## Development

The extension uses Chrome's Manifest V3 with:
- Service Worker for background connectivity checks
- Storage API for settings persistence
- Alarms API for periodic checks

## License

MIT
