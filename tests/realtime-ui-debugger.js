/**
 * 🚀 REAL-TIME UI DEBUGGER (GOLD STANDARD TEST)
 * 
 * Đây là "vũ khí bí mật" để debug mọi luồng UI (nhấp nháy Tool) trên Telegram 
 * mà KHÔNG cần kết nối thật với Telegram Bot API. 
 * Nó mô phỏng lại chính xác 100% vòng lặp setInterval() của bot.js.
 * 
 * Cách dùng: node tests/realtime-ui-debugger.js
 * 
 * Nếu console in ra được các dòng [UI UPDATE] 🌐 Đang thực hiện... thì chắc chắn
 * trên Telegram Bot cũng sẽ update y hệt như vậy.
 */

const { runAgy } = require('../src/core/runner');
const watcher = require('../src/core/watcher');

async function run() {
  console.log("==========================================");
  console.log("🚀 Bắt đầu giả lập vòng lặp UI Telegram...");
  console.log("==========================================");
  
  let lastState = '';
  
  // Mô phỏng hàm uiUpdater trong bot.js (Nhưng quét siêu tốc 200ms thay vì 1s để dễ nhìn log)
  const interval = setInterval(() => {
    const activeTool = watcher.getCurrentActiveTool();
    const newState = activeTool || '🧠 Đang xử lý thuật toán...';
    
    // Nếu trạng thái thay đổi, in ra màn hình (Tương đương với việc bot.editMessageText trên Telegram)
    if (newState !== lastState) {
      console.log(`[TELEGRAM UI UPDATE] ${newState}`);
      lastState = newState;
    }
  }, 200);

  try {
    // Gọi CLI chạy ngầm với một prompt mẫu (useContinue: false để ép tạo session mới sạch sẽ)
    const testPrompt = "Vui lòng liệt kê các file trong thư mục hiện tại";
    console.log(`>> User gửi tin nhắn: "${testPrompt}"\n`);
    
    const { stdout } = await runAgy(testPrompt, { useContinue: false });
    
    console.log("\n==========================================");
    console.log("✅ CLI Đã chạy xong!");
    console.log("Độ dài Output cuối cùng:", stdout.length, "bytes");
  } catch (err) {
    console.error("❌ Lỗi khi chạy Agy:", err);
  } finally {
    // Dọn dẹp tiến trình
    clearInterval(interval);
    console.log("==========================================");
    console.log("📝 Kết quả cuối cùng quét được từ Transcript:\n");
    console.log(watcher.getLatestTurnFromTranscript().substring(0, 1000) + "\n... (Đã cắt bớt)");
    console.log("==========================================");
  }
}

run();
