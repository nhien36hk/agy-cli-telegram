# Telegram Antigravity Bridge 🚀

Một công cụ cầu nối (bridge) siêu nhẹ và siêu nhanh giúp kết nối **Antigravity CLI** (Hệ thống AI Agent cục bộ) của bạn trực tiếp lên **Telegram**. Điểm nhấn của dự án này là mang lại một giao diện (UI) cực kỳ tương lai (Futuristic), sạch sẽ và gọn gàng lấy cảm hứng từ các agent chuyên nghiệp như Hermes hay OpenClaw.

---

## ⚡ Cài đặt Siêu Tốc (Quick Install)

Chỉ với 1 dòng lệnh duy nhất trên Linux/macOS/WSL, kịch bản cài đặt sẽ tự động tải mã nguồn, cài đặt môi trường, hỏi bạn cấu hình Bot Telegram và thiết lập lệnh toàn cục.

Chạy lệnh sau trong Terminal (bash):

```bash
curl -fsSL https://raw.githubusercontent.com/nhien36hk/agy-cli-telegram/main/install.sh | bash
```

**Những gì script này sẽ làm:**
1. Kiểm tra môi trường Node.js và Git.
2. Tải source code vào `~/.telegram-agy`.
3. Tự động yêu cầu bạn nhập **Bot Token** và **User ID**.
4. Cài đặt các thư viện (dependencies) thông qua `npm`.
5. Tạo lệnh toàn cục `agy-tele` để bạn có thể gọi bot từ bất kỳ đâu.

---

## 🛠 Yêu Cầu Hệ Thống (Prerequisites)

- **Node.js**: Phiên bản 18 trở lên.
- **Git**: Dùng để tải mã nguồn.
- **Antigravity CLI (`agy`)**: Phải được cài đặt sẵn trên máy chủ của bạn để bot có thể kích hoạt các tiến trình suy nghĩ (agent).

---

## ⚙️ Cài Đặt Thủ Công (Manual Installation)

Nếu bạn không muốn cài bằng dòng lệnh 1 dòng, bạn có thể tự cài thủ công:

1. Clone mã nguồn:
   ```bash
   git clone https://github.com/nhien36hk/agy-cli-telegram.git
   cd agy-cli-telegram
   ```
2. Tạo file cấu hình `config.json` tại thư mục gốc:
   ```json
   {
     "token": "YOUR_TELEGRAM_BOT_TOKEN",
     "allowedUserId": [123456789]
   }
   ```
3. Cài đặt thư viện:
   ```bash
   npm install
   ```
4. Liên kết lệnh:
   ```bash
   npm link
   ```

---

## 🚀 Cách Sử Dụng (Getting Started)

Sau khi cài đặt xong, việc khởi chạy bot cực kỳ đơn giản. Mở terminal lên và gõ:

```bash
agy-tele
```

Hệ thống sẽ hiển thị:
> `Đang khởi động Telegram <-> Antigravity CLI Bridge...`
> `Bot đang chạy... (Nhấn Ctrl+C để thoát)`

### Các Tính Năng Nổi Bật:
- **Giao Diện Siêu Gọn (Ultra-Minimalist UI):** Trạng thái suy nghĩ của AI được hiển thị theo từng tiến trình với các icon chuẩn khoa học viễn tưởng (✨, 📂, ⚡, 📄).
- **Thinking Box (Mini Terminal):** Hiển thị luồng tư duy gốc của mô hình ngay trong quá trình xử lý nhưng không làm rác giao diện chat.
- **Quản lý Hàng Đợi (Queue):** Không xử lý dồn dập các tin nhắn cũ lúc bot đang sập.

---

## 💡 Mẹo Chạy Ngầm 24/7 (Daemon)

Nếu bạn cài cái này lên một VPS/Server và muốn nó chạy mãi mãi kể cả khi tắt Terminal, hãy dùng **PM2**:

```bash
npm install -g pm2
pm2 start agy-tele --name "agy-bot"
pm2 save
pm2 startup
```

## 🤝 Đóng Góp & Hỗ Trợ
Nếu bạn tìm thấy Bug (lỗi) hoặc muốn đóng góp tính năng mới, hãy thoải mái mở **Issues** hoặc **Pull Request** nhé!

---
*Được phát triển đặc biệt cho cộng đồng sử dụng Antigravity CLI.*
