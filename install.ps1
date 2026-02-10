# IP What? - Chrome Extension Installer for Windows
# This script helps install the extension in Chrome/Chromium browsers

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExtensionDir = $ScriptDir

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          IP What? - Chrome Extension Installer            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if extension files exist
if (-not (Test-Path "$ExtensionDir\manifest.json")) {
    Write-Host "❌ Error: manifest.json not found in $ExtensionDir" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Extension files found at: $ExtensionDir" -ForegroundColor Green
Write-Host ""

# Detect browser
function Detect-Browser {
    $browsers = @(
        @{ Name = "chrome"; Path = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe" },
        @{ Name = "chrome"; Path = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" },
        @{ Name = "chrome"; Path = "${env:LocalAppData}\Google\Chrome\Application\chrome.exe" },
        @{ Name = "edge"; Path = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" },
        @{ Name = "edge"; Path = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe" },
        @{ Name = "brave"; Path = "${env:ProgramFiles}\BraveSoftware\Brave-Browser\Application\brave.exe" },
        @{ Name = "brave"; Path = "${env:LocalAppData}\BraveSoftware\Brave-Browser\Application\brave.exe" },
        @{ Name = "chromium"; Path = "${env:LocalAppData}\Chromium\Application\chrome.exe" }
    )
    
    foreach ($browser in $browsers) {
        if (Test-Path $browser.Path) {
            return @{ Name = $browser.Name; Path = $browser.Path }
        }
    }
    
    return $null
}

function Open-ExtensionsPage {
    param($Browser)
    
    if ($null -eq $Browser) {
        Write-Host "⚠️  Could not detect browser. Please manually open: chrome://extensions" -ForegroundColor Yellow
        return
    }
    
    Write-Host "🌐 Opening extensions page in $($Browser.Name)..." -ForegroundColor Cyan
    
    $extensionsUrl = switch ($Browser.Name) {
        "edge" { "edge://extensions" }
        default { "chrome://extensions" }
    }
    
    Start-Process $Browser.Path -ArgumentList $extensionsUrl
}

$Browser = Detect-Browser
if ($null -ne $Browser) {
    Write-Host "🔍 Detected browser: $($Browser.Name)" -ForegroundColor Cyan
} else {
    Write-Host "🔍 No Chromium-based browser detected" -ForegroundColor Yellow
}
Write-Host ""

# Copy extension path to clipboard
Set-Clipboard -Value $ExtensionDir
Write-Host "📋 Extension path copied to clipboard!" -ForegroundColor Green
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "📖 Installation Instructions:" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "1. Enable 'Developer mode' (toggle in top-right corner)" -ForegroundColor White
Write-Host "2. Click 'Load unpacked'" -ForegroundColor White
Write-Host "3. Paste the path (already copied): " -NoNewline -ForegroundColor White
Write-Host "$ExtensionDir" -ForegroundColor Yellow
Write-Host "4. The extension icon should appear in your toolbar" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

$response = Read-Host "🚀 Open browser extensions page now? [Y/n]"

if ($response -eq "" -or $response -match "^[Yy]") {
    Open-ExtensionsPage -Browser $Browser
    Write-Host ""
    Write-Host "✨ Follow the instructions above to complete installation." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ℹ️  To install manually, open your browser and navigate to:" -ForegroundColor Cyan
    Write-Host "   chrome://extensions (or edge://extensions for Edge)" -ForegroundColor White
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "🎉 Thank you for using IP What?" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
