# Changelog

All notable changes to IP What? are documented in this file.

## [1.6.5] - 2026-02-13

### Bug Fixes
- **Fix IPv6 reachability false negatives** - Now uses direct HTTP connection to IP address (no DNS resolution required)
- **Add retry on connectivity failure** - Retries once after 500ms delay before marking disconnected
- **Improve jitter calculation** - Uses trimmed standard deviation (excludes top/bottom 10% to prevent outliers from skewing results)
- **Don't store timeout as latency** - Failed connections no longer pollute latency metrics

### UI Improvements
- Add info icon (ⓘ) tooltips explaining Reachability, Jitter, and Packet Loss metrics
- Rename "Last 24 Hours" to "Reachability in the Last 24 Hours"

### Changes
- Remove unused checkInterval setting
- Switch default targets to Cloudflare (1.1.1.1 / 2606:4700:4700::1111)
- Remove Google and Quad9 presets (don't serve HTTP on port 80)
- Add OpenDNS as alternative preset (208.67.222.222 / 2620:119:35::35)

## [1.6.1] - 2026-02-12

### Bug Fixes
- **Fixed crash in About tab** - Resolved `Uncaught TypeError: Cannot set properties of null` that occurred when opening the About tab
  - Removed stale references to DOM elements that no longer exist in popup.html

## [1.6.0] - 2026-02-09

### Features
- 🎨 **Renamed to IP What?** - Question mark branding throughout
- 🪟 **Windows installer** - PowerShell script (install.ps1)
- 🌓 **Dark/light mode** - Automatic based on system preference
- 📊 **Smoother jitter display** - EMA smoothing for less jumpy metrics
- ☕ **Ko-fi support** - Buy me an energy drink button in About tab
- 🖼️ **PNG icons** - Chrome Web Store compatible

---

## Links
- [GitHub Releases](https://github.com/krich11/ipwhat/releases)
- [Chrome Web Store](https://chromewebstore.google.com/detail/ip-what-ipv4ipv6-connecti/mfppcjbcnahglfkdhcilpfamfakdocop)
