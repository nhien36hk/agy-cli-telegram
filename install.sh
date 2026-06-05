#!/usr/bin/env bash

# Bật cờ thoát ngay nếu có lỗi
set -e

# Định nghĩa màu sắc cho output chuyên nghiệp
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "    ___                   ______     __"
echo "   /   | ____ ___  __    /_  __/__  / /__  ____ __________ _____ ___ "
echo "  / /| |/ __ \`/ / / /_____/ / / _ \\/ / _ \\/ __ \`/ ___/ __ \`/ __ \`__ \\"
echo " / ___ / /_/ / /_/ /_____/ / /  __/ /  __/ /_/ / /  / /_/ / / / / / /"
echo "/_/  |_\\__, /\\__, /     /_/  \\___/_/\\___/\\__, /_/   \\__,_/_/ /_/ /_/ "
echo "      /____//____/                      /____/                       "
echo -e "${NC}"
echo -e "${BLUE}⚡ Bắt đầu cài đặt Telegram Antigravity Bridge (telegram-agy)...${NC}\n"

# 1. Kiểm tra yêu cầu hệ thống (Prerequisites)
echo -e "${YELLOW}🔍 Đang kiểm tra môi trường...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️ Không tìm thấy Node.js. Đang tiến hành cài đặt tự động...${NC}"
    
    if command -v apt-get &> /dev/null; then
        echo -e "${BLUE}▶ Đang cài đặt Node.js qua apt-get (Debian/Ubuntu)... (Có thể yêu cầu mật khẩu sudo)${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - < /dev/tty
        sudo apt-get install -y nodejs < /dev/tty
    elif command -v yum &> /dev/null; then
        echo -e "${BLUE}▶ Đang cài đặt Node.js qua yum (CentOS/RHEL)... (Có thể yêu cầu mật khẩu sudo)${NC}"
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash - < /dev/tty
        sudo yum install -y nodejs < /dev/tty
    elif command -v pacman &> /dev/null; then
        echo -e "${BLUE}▶ Đang cài đặt Node.js qua pacman (Arch Linux)... (Có thể yêu cầu mật khẩu sudo)${NC}"
        sudo pacman -S --noconfirm nodejs npm < /dev/tty
    elif command -v brew &> /dev/null; then
        echo -e "${BLUE}▶ Đang cài đặt Node.js qua Homebrew (macOS)...${NC}"
        brew install node
    else
        echo -e "${RED}❌ Không thể tự động cài đặt Node.js trên hệ điều hành này. Vui lòng tự cài Node.js (>= v18) trước.${NC}"
        exit 1
    fi

    # Kiểm tra lại sau khi cài
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Lỗi: Cài đặt Node.js thất bại. Vui lòng cài đặt thủ công và thử lại.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Cài đặt Node.js thành công! ($(node -v))${NC}"
fi

if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️ Không tìm thấy pm2. Đang tiến hành cài đặt tự động...${NC}"
    # Nếu thư mục cài global của npm thuộc quyền root, ta cần sudo
    if [ -w "$(npm config get prefix)/lib/node_modules" ] || [ -w "$(npm config get prefix)/lib" ] || [ -w "$(npm config get prefix)" ]; then
        npm install -g pm2
    else
        echo -e "${BLUE}▶ Yêu cầu quyền sudo để cài pm2 global...${NC}"
        sudo npm install -g pm2 < /dev/tty
    fi
    
    if command -v pm2 &> /dev/null; then
        echo -e "${GREEN}✅ Cài đặt pm2 thành công!${NC}"
    else
        echo -e "${RED}❌ Lỗi: Cài đặt pm2 thất bại.${NC}"
    fi
fi
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Lỗi: Không tìm thấy Git. Vui lòng cài đặt Git trước.${NC}"
    exit 1
fi

if ! command -v agy &> /dev/null; then
    echo -e "${YELLOW}⚠️ Cảnh báo: Không tìm thấy 'agy' (Antigravity CLI) trong PATH.${NC}"
    echo -e "${YELLOW}   Bot vẫn sẽ được cài đặt, nhưng bạn cần đảm bảo 'agy' có thể chạy được để bot hoạt động!${NC}"
fi
echo -e "${GREEN}✅ Môi trường đạt chuẩn.${NC}\n"

# 2. Tải mã nguồn evề thư mục chuẩn
INSTALL_DIR="$HOME/.telegram-agy"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${BLUE}🔄 Tìm thấy bản cài đặt cũ tại $INSTALL_DIR. Đang cập nhật mã nguồn...${NC}"
    cd "$INSTALL_DIR"
    # Tạm thời rest code cũ (cẩn thận không xóa config)
    git fetch --all
    git reset --hard origin/main
else
    echo -e "${BLUE}📦 Đang tải mã nguồn từ GitHub về $INSTALL_DIR...${NC}"
    git clone https://github.com/nhien36hk/agy-cli-telegram.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 4. Cài đặt thư viện Node.js
echo -e "\n${BLUE}⚙️  Đang cài đặt các thư viện phụ thuộc (NPM)...${NC}"
npm install --silent

if [ -z "$SKIP_CONFIG" ]; then
    echo -e "\n${CYAN}====================================================${NC}"
    echo -e "${CYAN}   ⚙️  THIẾT LẬP CẤU HÌNH BOT  ${NC}"
    echo -e "${CYAN}====================================================${NC}"
    # Gọi script cài đặt bằng Node.js. Chuyển hướng /dev/tty để Inquirer.js có thể nhận phím
    npm run setup < /dev/tty
fi

# 5. Liên kết lệnh toàn cục (Global Link)
echo -e "\n${BLUE}🔗 Đang thiết lập lệnh toàn cục...${NC}"
npm link

# 6. Hoàn tất
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN} 🎉 CÀI ĐẶT THÀNH CÔNG!${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Bây giờ bạn có thể khởi động bot từ bất kỳ đâu trên máy tính bằng lệnh:\n"
echo -e "   ${CYAN}agy-tele${NC}\n"
echo -e "💡 Mẹo: Dùng pm2 nếu muốn chạy bot ngầm 24/7 (VD: pm2 start agy-tele)"
