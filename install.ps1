$ErrorActionPreference = "Stop"

# Define Colors for PowerShell
function Write-Cyan { param([string]$text) Write-Host $text -ForegroundColor Cyan }
function Write-Green { param([string]$text) Write-Host $text -ForegroundColor Green }
function Write-Red { param([string]$text) Write-Host $text -ForegroundColor Red }
function Write-Yellow { param([string]$text) Write-Host $text -ForegroundColor Yellow }

Write-Cyan "    ___                   ______     __"
Write-Cyan "   /   | ____ ___  __    /_  __/__  / /__  ____ __________ _____ ___ "
Write-Cyan "  / /| |/ __ ``/ / / /_____/ / / _ \/ / _ \/ __ ``/ ___/ __ ``/ __ ``__ \"
Write-Cyan " / ___ / /_/ / /_/ /_____/ / /  __/ /  __/ /_/ / /  / /_/ / / / / / /"
Write-Cyan "/_/  |_\__, /\__, /     /_/  \___/_/\___/\__, /_/   \__,_/_/ /_/ /_/ "
Write-Cyan "      /____//____/                      /____/                       "
Write-Host ""
Write-Cyan "⚡ Bắt đầu cài đặt Telegram Antigravity Bridge (telegram-agy)..."
Write-Host ""

Write-Yellow "🔍 Đang kiểm tra môi trường..."

# 1. Check Node.js
if (!(Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Red "❌ Lỗi: Không tìm thấy Node.js. Vui lòng cài đặt Node.js (>= v18) trước."
    exit 1
}

# 2. Check Git
if (!(Get-Command "git" -ErrorAction SilentlyContinue)) {
    Write-Red "❌ Lỗi: Không tìm thấy Git. Vui lòng cài đặt Git trước."
    exit 1
}

Write-Green "✅ Môi trường đạt chuẩn."
Write-Host ""

# 3. Setup Installation Directory
$InstallDir = Join-Path $HOME ".telegram-agy"

if (Test-Path $InstallDir) {
    Write-Cyan "🔄 Tìm thấy bản cài đặt cũ tại $InstallDir. Đang cập nhật mã nguồn..."
    Set-Location $InstallDir
    git fetch --all
    git reset --hard origin/main
} else {
    Write-Cyan "📦 Đang tải mã nguồn từ GitHub về $InstallDir..."
    git clone https://github.com/nhien36hk/agy-cli-telegram.git $InstallDir
    Set-Location $InstallDir
}

# 4. Install NPM Dependencies
Write-Cyan "`n⚙️ Đang cài đặt các thư viện phụ thuộc (NPM)..."
npm install --silent

# 5. Run Interactive Setup
Write-Cyan "`n===================================================="
Write-Cyan "   ⚙️  THIẾT LẬP CẤU HÌNH BOT"
Write-Cyan "===================================================="
npm run setup

# 6. Global Link (Note: setup.js already tries to do this, but doing it again natively ensures it)
# `npm link` might require admin privileges on Windows depending on the exact setup, but usually works for the current user
Write-Cyan "`n🔗 Đang thiết lập lệnh toàn cục..."
try {
    npm link
} catch {
    Write-Yellow "⚠️ Lưu ý: Nếu lệnh npm link thất bại, hãy mở PowerShell bằng quyền Administrator và chạy 'npm link' trong $InstallDir"
}

Write-Green "`n===================================================="
Write-Green " 🎉 CÀI ĐẶT THÀNH CÔNG!"
Write-Green "===================================================="
Write-Host "Bây giờ bạn có thể khởi động bot từ bất kỳ đâu bằng lệnh:"
Write-Cyan "   agy-tele"
Write-Host ""
