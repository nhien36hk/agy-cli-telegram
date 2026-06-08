$ErrorActionPreference = "Stop"

# Define Colors for PowerShell
function Write-Cyan { param([string]$text) Write-Host $text -ForegroundColor Cyan }
function Write-Green { param([string]$text) Write-Host $text -ForegroundColor Green }
function Write-Red { param([string]$text) Write-Host $text -ForegroundColor Red }
function Write-Yellow { param([string]$text) Write-Host $text -ForegroundColor Yellow }

Write-Cyan "    ___                   ______     __"
Write-Cyan "   /   | ____ ___  __    /_  __/__  / /__  ____ __________ _____ ___ "
Write-Cyan "  / /| |/ __ ``/ / / /_____/ / / _ \/ / _ \/ __ ``/ ___/ __ ``/ __ ``__ \""
Write-Cyan " / ___ / /_/ / /_/ /_____/ / /  __/ /  __/ /_/ / /  / /_/ / / / / / /"
Write-Cyan "/_/  |_\__, /\__, /     /_/  \___/_/\___/\__, /_/   \__,_/_/ /_/ /_/ "
Write-Cyan "      /____//____/                      /____/                       "
Write-Host ""
Write-Cyan "⚡ Starting installation of Telegram Antigravity Bridge (telegram-agy)..."
Write-Host ""

Write-Yellow "🔍 Checking environment..."

# 1. Check Node.js
if (!(Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Red "❌ Error: Node.js not found. Please install Node.js (>= v18) first."
    exit 1
}

# 2. Check Git
if (!(Get-Command "git" -ErrorAction SilentlyContinue)) {
    Write-Red "❌ Error: Git not found. Please install Git first."
    exit 1
}

Write-Green "✅ Environment is ready."
Write-Host ""

# 3. Setup Installation Directory
$InstallDir = Join-Path $HOME ".telegram-agy"

if (Test-Path $InstallDir) {
    Write-Cyan "🔄 Found existing installation at $InstallDir. Updating source code..."
    Set-Location $InstallDir
    git fetch --all
    git reset --hard origin/main
} else {
    Write-Cyan "📦 Downloading source code from GitHub to $InstallDir..."
    git clone https://github.com/nhien36hk/agy-cli-telegram.git $InstallDir
    Set-Location $InstallDir
}

# 4. Install NPM Dependencies
Write-Cyan "`n⚙️ Installing dependencies (NPM)..."
npm install --silent

# 5. Run Interactive Setup
Write-Cyan "`n===================================================="
Write-Cyan "   ⚙️  BOT CONFIGURATION SETUP"
Write-Cyan "===================================================="
npm run setup

# 6. Global Link (Note: setup.js already tries to do this, but doing it again natively ensures it)
# `npm link` might require admin privileges on Windows depending on the exact setup, but usually works for the current user
Write-Cyan "`n🔗 Linking global command..."
try {
    npm link
} catch {
    Write-Yellow "⚠️ Note: If npm link fails, please open PowerShell as Administrator and run 'npm link' inside $InstallDir"
}

Write-Green "`n===================================================="
Write-Green " 🎉 INSTALLATION SUCCESSFUL!"
Write-Green "===================================================="
Write-Host "You can now start the bot from anywhere using command:"
Write-Cyan "   agy-tele"
Write-Host ""
