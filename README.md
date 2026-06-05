# Telegram Antigravity Bridge ⚡

Cầu nối giao tiếp (Bridge) chính thức đưa **Antigravity CLI** lên Telegram. Nó cho phép bạn điều khiển, lập trình và giao tiếp với Agent AI của mình từ điện thoại hoặc bất kỳ thiết bị nào thông qua Telegram, thay vì phải dính chặt vào Terminal trên máy tính.

```text
    ___                   ______     __
   /   | ____ ___  __    /_  __/__  / /__  ____ __________ _____ ___ 
  / /| |/ __ `/ / / /_____/ / / _ \/ / _ \/ __ `/ ___/ __ `/ __ `__ \
 / ___ / /_/ / /_/ /_____/ / /  __/ /  __/ /_/ / /  / /_/ / / / / / /
/_/  |_\__, /\__, /     /_/  \___/_/\___/\__, /_/   \__,_/_/ /_/ /_/ 
      /____//____/                      /____/                     
```

* **Giao diện dòng lệnh thực thụ (TUI):** Định dạng code (Markdown, Code blocks), in đậm, in nghiêng hoàn hảo.
* **Thời gian thực (Live Agent State):** Dữ liệu được stream trực tiếp lên Telegram. Bắt mạch chính xác từng hành động của hệ thống dưới nền (đọc file, tìm kiếm web, chạy lệnh) và hiển thị bằng Live Emojis thay vì trạng thái "Thinking..." tĩnh.
* **Over-The-Air Update (OTA):** Hệ thống hỗ trợ tự động kiểm tra và cập nhật mã nguồn bot ngay từ màn hình chat Telegram chỉ với lệnh `/update`.
* **Bảo mật tuyệt đối:** Hoạt động dựa trên Allowlist, chỉ những User ID Telegram do chính bạn chỉ định mới có quyền ra lệnh cho hệ thống máy tính của bạn.
* **Chạy mọi nơi:** Native trên Windows, Linux, macOS.

## 🚀 Cài đặt Nhanh (Quick Install)

**Linux, macOS, WSL2, Termux**
Mở Terminal và dán lệnh sau:

```bash
curl -fsSL https://raw.githubusercontent.com/nhien36hk/agy-cli-telegram/main/install.sh | bash
```

**Windows (Native, PowerShell)**
Hệ thống hỗ trợ hoàn toàn native cho Windows (không cần cài đặt WSL hay Git Bash giả lập). Trình cài đặt sẽ tự động thiết lập mọi thứ trong một môi trường cô lập an toàn.
Mở **PowerShell** và dán lệnh sau:

```powershell
iex (irm https://raw.githubusercontent.com/nhien36hk/agy-cli-telegram/main/install.ps1)
```

Trình cài đặt Node.js đa nền tảng sẽ tự động khởi chạy, hướng dẫn bạn từng bước cách lấy **Telegram Bot Token** và **User ID**, ẩn mật khẩu khi nhập và tự động liên kết lệnh `agy-tele` vào hệ thống.

## 💡 Khởi chạy (Getting Started)

Sau khi cài đặt thành công, bạn có thể khởi động bot từ bất kỳ đâu (bất kỳ thư mục nào) trên máy tính bằng một trong hai cách sau:

### Cách 1: Chạy trực tiếp (Để debug và xem log)

```bash
agy-tele
```

Hệ thống sẽ ngay lập tức lắng nghe tin nhắn từ Telegram của bạn và làm cầu nối trực tiếp (Bridge) chuyển lệnh cho Antigravity CLI. Nhấn `Ctrl + C` để thoát.

### Cách 2: Chạy ngầm 24/7 (Khuyên dùng)

Để bot luôn thức và làm việc ngay cả khi bạn đóng Terminal, hãy sử dụng **PM2** (Công cụ quản lý tiến trình chuyên nghiệp của Node.js).

1. Cài đặt PM2 (Nếu máy bạn chưa có):

```bash
npm install -g pm2
```

2. Khởi chạy bot dưới nền:

```bash
pm2 start agy-tele --name agy-tele
```

3. Một số lệnh PM2 hữu ích:

```bash
pm2 logs agy-tele    # Xem log hoạt động của bot
pm2 stop agy-tele    # Tạm dừng bot
pm2 restart agy-tele # Khởi động lại bot
pm2 save             # Lưu trạng thái để tự chạy khi khởi động máy
pm2 startup          # Thiết lập pm2 tự khởi động cùng hệ điều hành
```

## 🎮 Telegram Slash Commands

Hệ thống tự động đăng ký Menu lệnh trên Telegram để bạn thao tác nhanh:

- `/new` - Xóa sạch bối cảnh, bắt đầu một cuộc trò chuyện hoàn toàn mới.
- `/resume` - Tiếp tục mạch trò chuyện đang dở (Hành vi mặc định khi bạn nhắn tin bình thường).
- `/status` - Kiểm tra xem bot có đang kết nối với server không.
- `/update` - Tự động kéo mã nguồn mới nhất từ Github và khởi động lại bot (OTA Update).
- `/help` - Xem hướng dẫn sử dụng.

## ⚙️ Quản lý & Cập nhật Bot

**Cách 1: OTA Update qua Telegram (Khuyên dùng)**
Chỉ cần mở điện thoại, gõ lệnh `/update` trong nhóm chat với Bot. Bot sẽ tự động tải phiên bản mới nhất từ Github và tự khởi động lại (yêu cầu Bot đang chạy bằng PM2).

**Cách 2: Cập nhật qua Terminal**
Mở Terminal ở bất kỳ đâu và gõ:

```bash
agy-tele update
pm2 restart agy-tele
```

**Cách 3: Cấu hình lại Token / Danh sách User**
Nếu bạn muốn đổi Bot Token hoặc cấp quyền cho người khác:

```bash
cd ~/.telegram-agy
npm run setup
```

## 🛠 Yêu cầu (Prerequisites)

- **Node.js** >= v18
- **Git**
- **Antigravity CLI** (`agy`) đã được cài đặt và cấu hình sẵn trong PATH. Mọi lệnh trên Telegram thực chất sẽ kích hoạt `agy` trên máy của bạn.

---

*License: MIT | Xây dựng để tối ưu hóa trải nghiệm Agentic Coding của bạn. Made by Nhien36hk - HuuNhien*
