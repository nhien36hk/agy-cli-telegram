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
echo "    ___           __  _                 _ __       ________    ____"
echo "   /   |  ____   / /_(_)____ __________ __(_) /__  /_  __/ /   / __/"
echo "  / /| | / __ \ / __/ / ___/ __/ __ \/ / / / __/    / / / /   / /_  "
echo " / ___ |/ / / / / /_/ / /__/ / / / /_/ /_/ / /_    / / / /___/ __/  "
echo "/_/  |_/_/ /_/  \__/_/\___/_/  \__/\__,_/_/\__/   /_/ /_____/_/     "
echo -e "${NC}"
echo -e "${BLUE}⚡ Bắt đầu cài đặt Telegram Antigravity Bridge (telegram-agy)...${NC}\n"

# 1. Kiểm tra yêu cầu hệ thống (Prerequisites)
echo -e "${YELLOW}🔍 Đang kiểm tra môi trường...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Lỗi: Không tìm thấy Node.js. Vui lòng cài đặt Node.js (>= v18) trước.${NC}"
    exit 1
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

# 2. Tải mã nguồn về thư mục chuẩn
INSTALL_DIR="$HOME/.telegram-agy"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${BLUE}🔄 Tìm thấy bản cài đặt cũ tại $INSTALL_DIR. Đang cập nhật mã nguồn...${NC}"
    cd "$INSTALL_DIR"
    # Tạm thời reset code cũ (cẩn thận không xóa config)
    git fetch --all
    git reset --hard origin/main
else
    echo -e "${BLUE}📦 Đang tải mã nguồn từ GitHub về $INSTALL_DIR...${NC}"
    # TODO: Thay URL này bằng link kho lưu trữ GitHub của bạn sau khi bạn push code lên
    git clone https://github.com/TenCuaBan/telegram-agy.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 3. Tạo cấu hình Tương tác (Interactive Setup)
CONFIG_FILE="$INSTALL_DIR/config.json"
echo -e "\n${CYAN}====================================================${NC}"
echo -e "${CYAN}   ⚙️  THIẾT LẬP CẤU HÌNH BOT (Chỉ chạy lần đầu)  ${NC}"
echo -e "${CYAN}====================================================${NC}"

if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Đã tìm thấy cấu hình cũ. Bạn có muốn ghi đè cấu hình mới không? (y/n): ${NC}\c"
    read OVERWRITE_CONFIG
    if [[ "$OVERWRITE_CONFIG" != "y" && "$OVERWRITE_CONFIG" != "Y" ]]; then
        SKIP_CONFIG=true
    fi
fi

if [ -z "$SKIP_CONFIG" ]; then
    echo -e "👉 Hướng dẫn: Lên Telegram, nhắn tin cho ${GREEN}@BotFather${NC} để tạo bot và lấy Token."
    echo -e "👉 Hướng dẫn: Nhắn tin cho ${GREEN}@userinfobot${NC} để lấy User ID của bạn.\n"

    read -p "🔑 Nhập Telegram Bot Token: " BOT_TOKEN
    read -p "👤 Nhập Telegram User ID của bạn: " USER_ID

    # Ghi vào file config.json
    cat > "$CONFIG_FILE" << EOF
{
  "token": "$BOT_TOKEN",
  "allowedUserId": [$USER_ID]
}
EOF
    echo -e "${GREEN}✅ Đã lưu cấu hình an toàn tại $CONFIG_FILE${NC}"
fi

# 4. Cài đặt thư viện Node.js
echo -e "\n${BLUE}⚙️  Đang cài đặt các thư viện phụ thuộc (NPM)...${NC}"
npm install --silent

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
