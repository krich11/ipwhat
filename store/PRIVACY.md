# Privacy Policy for IP What?

**Last Updated:** February 9, 2026

## Overview

**IP What?** is a Chrome extension that monitors IPv4 and IPv6 internet connectivity. This privacy policy explains what data the extension accesses and how it is handled.

## Data Collection

**IP What?** does NOT collect, store, or transmit any personal data to external servers.

### What the extension accesses locally:

- **IP Addresses:** The extension detects your local and public IP addresses to display them to you. These are stored only in your browser's local storage and are never transmitted externally.

- **Connectivity Status:** The extension tests connectivity by making requests to configured DNS servers (default: Google DNS). Only the success/failure and latency of these requests is recorded locally.

- **History:** Connectivity check history is stored in your browser's local storage for your reference. This data never leaves your device.

### Network Requests

The extension makes the following network requests:

1. **IPv4 connectivity check** via api.ipify.org
2. **IPv6 connectivity check** via v6.ident.me
3. **Public IP detection** via multiple services (checkip.amazonaws.com, icanhazip.com, ifconfig.me, ipv6.icanhazip.com)

These requests are solely for functionality and no tracking or analytics data is collected.

## Data Storage

All data is stored locally in your browser using Chrome's Storage API:
- Settings and preferences (sync storage)
- Connectivity history (local storage)

You can clear this data at any time by removing the extension.

## Third-Party Services

The extension uses the following third-party services for connectivity and IP detection:

- **api.ipify.org** - IPv4 connectivity test and public IP detection
- **v6.ident.me** - IPv6 connectivity test
- **checkip.amazonaws.com** - Backup public IPv4 detection
- **icanhazip.com** - Backup public IP detection
- **ifconfig.me** - Backup public IPv4 detection
- **ipv6.icanhazip.com** - Public IPv6 detection

## Permissions

The extension requests the following permissions:

- **storage:** To save your settings and history locally
- **alarms:** To schedule periodic connectivity checks
- **notifications:** To alert you to connectivity changes

## Changes to This Policy

Any changes to this privacy policy will be posted here with an updated date.

## Contact

For questions about this privacy policy, please open an issue at:
https://github.com/krich11/ipwhat/issues

## Open Source

**IP What?** is open source software. You can review the complete source code at:
https://github.com/krich11/ipwhat
