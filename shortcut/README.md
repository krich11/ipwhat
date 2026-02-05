# IP What - iOS Shortcut

A feature-rich iOS Shortcut that checks IPv4/IPv6 connectivity and displays your public IP addresses.

## ✨ Features

- **🔌 IPv4 Connectivity** - Tests connection to Cloudflare 1.1.1.1
- **🔌 IPv6 Connectivity** - Tests connection to Cloudflare IPv6 DNS  
- **🌍 Public IP Detection** - Extracts and displays your public IPv4 and IPv6 addresses
- **📱 No App Required** - Works entirely within iOS Shortcuts
- **⌚ Apple Watch** - Runs on your watch too!
- **🏠 Home Screen** - One-tap access from your home screen

## 📲 Installation

### AirDrop from Mac (Easiest!)

1. **On your Mac:** Open Finder and navigate to this folder:
   ```
   /Users/ken.richhpe.com/src/ipwhat/shortcut/
   ```

2. **AirDrop** the `IPWhat.shortcut` file to your iPhone

3. **On your iPhone:** Tap the notification, then tap **"Add Shortcut"**

4. **Done!** 🎉

### Add to Home Screen

After installing:

1. Open the **Shortcuts** app
2. Long-press on **"IP What"**
3. Tap **Share** → **Add to Home Screen**
4. Customize the icon if desired, then tap **Add**

## 🎯 Usage

Run the shortcut and you'll see an alert like:

```
🌐 IP What

IPv4: ✅ Connected
 IP: 203.0.113.42

IPv6: ✅ Connected  
 IP: 2001:db8::1234
```

If a connection fails, you'll see:

```
IPv4: ❌ Failed
 IP: Not detected

IPv6: ❌ Failed
 IP: Not detected
```

## 🔧 How It Works

1. Makes HTTPS request to `https://1.1.1.1/cdn-cgi/trace` (forces IPv4)
2. Parses the response to extract your public IPv4 address
3. Makes HTTPS request to `https://[2606:4700:4700::1111]/cdn-cgi/trace` (forces IPv6)
4. Parses the response to extract your public IPv6 address
5. Displays combined results in a single alert

The Cloudflare trace endpoint returns diagnostic info including your IP:
```
fl=123
h=1.1.1.1
ip=203.0.113.42
ts=1234567890
...
```

## 🐛 Troubleshooting

**"Can't be opened because it's not a valid shortcut file"**
- Make sure the file extension is `.shortcut` not `.shortcut.plist`
- Try re-downloading or re-AirDropping the file

**IPv6 always shows "Failed"**
- Your network might not support IPv6 - this is normal on many networks
- Try on a different WiFi network or cellular

**Both show "Failed"**
- Check your internet connection
- The test servers might be temporarily unreachable

## 📋 Technical Details

- **IPv4 Test:** `https://1.1.1.1/cdn-cgi/trace`
- **IPv6 Test:** `https://[2606:4700:4700::1111]/cdn-cgi/trace`
- **Provider:** Cloudflare DNS
- **Protocol:** HTTPS (TLS 1.3)
