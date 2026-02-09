# Privacy Policy for IP What

**Last Updated:** February 9, 2026

## Overview

IP What is a Chrome extension that monitors IPv4 and IPv6 internet connectivity. This privacy policy explains what data the extension accesses and how it is handled.

## Data Collection

**IP What does NOT collect, store, or transmit any personal data to external servers.**

### What the extension accesses locally:

- **IP Addresses:** The extension detects your local and public IP addresses to display them to you. These are stored only in your browser's local storage and are never transmitted externally.

- **Connectivity Status:** The extension tests connectivity by making requests to configured DNS servers (default: Google DNS). Only the success/failure and latency of these requests is recorded locally.

- **History:** Connectivity check history is stored in your browser's local storage for your reference. This data never leaves your device.

### Network Requests

The extension makes the following network requests:

1. **Connectivity checks** to configured IP addresses (default: 8.8.8.8 and 2001:4860:4860::8888) to test IPv4/IPv6 reachability
2. **Public IP detection** via ipify.org API to display your public IP address

These requests are solely for functionality and no tracking or analytics data is collected.

## Data Storage

All data is stored locally in your browser using Chrome's Storage API:
- Settings and preferences (sync storage)
- Connectivity history (local storage)

You can clear this data at any time by removing the extension.

## Third-Party Services

- **ipify.org** - Used to detect your public IP address. See their privacy policy at https://www.ipify.org/
- **DNS servers** - Connectivity tests are made to DNS servers you configure (Google, Cloudflare, Quad9, or OpenDNS)

## Permissions

The extension requests the following permissions:

- **storage:** To save your settings and history locally
- **alarms:** To schedule periodic connectivity checks
- **webRequest:** To detect connection details for diagnostics

## Changes to This Policy

Any changes to this privacy policy will be posted here with an updated date.

## Contact

For questions about this privacy policy, please open an issue at:
https://github.com/krich11/ipwhat/issues

## Open Source

IP What is open source software. You can review the complete source code at:
https://github.com/krich11/ipwhat
