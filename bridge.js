const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Đường dẫn lưu file config cục bộ
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Đọc cấu hình
let config = {
  token: '',
  allowedUserId: ''
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('Không thể đọc file config.json:', e.message);
  }
}

// Kiểm tra cấu hình
if (!config.token || !config.allowedUserId) {
  console.log('CHƯA CẤU HÌNH BOT TELEGRAM!');
  console.log('Hãy điền cấu hình vào file config.json với định dạng:');
  console.log(JSON.stringify({ token: "YOUR_BOT_TOKEN", allowedUserId: "YOUR_TELEGRAM_USER_ID" }, null, 2));
  
  // Tạo file mẫu nếu chưa có
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  }
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${config.token}`;
let updateOffset = 0;

// Hàm gửi request API Telegram bằng fetch (Node.js 18+)
async function telegramRequest(method, body = {}) {
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (err) {
    console.error(`Lỗi request Telegram (${method}):`, err.message);
    return null;
  }
}

// Hàm gửi tin nhắn (tự động chia nhỏ nếu tin nhắn quá dài > 4000 ký tự)
async function sendMessage(chatId, text) {
  const maxLength = 4000;
  if (text.length <= maxLength) {
    await telegramRequest('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown' }).then(res => {
      // Nếu lỗi Markdown (ví dụ do ký tự đặc biệt), thử gửi dạng text thường
      if (res && !res.ok) {
        telegramRequest('sendMessage', { chat_id: chatId, text });
      }
    });
    return;
  }
  
  for (let i = 0; i < text.length; i += maxLength) {
    const chunk = text.substring(i, i + maxLength);
    await telegramRequest('sendMessage', { chat_id: chatId, text: chunk });
  }
}

// Gửi trạng thái "đang soạn tin..." (typing)
async function sendTyping(chatId) {
  await telegramRequest('sendChatAction', { chat_id: chatId, action: 'typing' });
}

// Hàm thực thi lệnh agy và cập nhật tiến trình thời gian thực lên Telegram
function runAgy(promptText, useContinue = true, chatId = null, progressMsgId = null) {
  return new Promise((resolve) => {
    console.log(`Đang chạy agy với prompt: "${promptText}" (continue: ${useContinue})`);
    
    const args = [];
    if (useContinue) {
      args.push('-c');
    }
    args.push('--dangerously-skip-permissions');
    args.push('--print');
    args.push(promptText);

    // Chạy agy command
    const child = spawn('agy', args);
    child.stdin.end(); // Đóng stdin để tránh agy bị treo chờ input từ pipe

    let stdout = '';
    let stderr = '';
    let lastUpdate = Date.now();
    let isUpdating = false;

    // Hàm cập nhật trạng thái lên Telegram (throttled)
    async function updateProgress(force = false) {
      if (!chatId || !progressMsgId) return;
      const now = Date.now();
      if (!force && (now - lastUpdate < 3000 || isUpdating)) {
        return; // Chỉ cập nhật mỗi 3 giây để tránh bị Telegram khóa/chặn do spam API
      }
      
      isUpdating = true;
      lastUpdate = now;

      // Gom nội dung hiển thị cho người dùng
      let text = `⚡ *Antigravity CLI đang xử lý...*\n\n`;
      
      if (stdout) {
        const preview = stdout.length > 3000 ? '...(đoạn đầu bị ẩn)\n' + stdout.slice(-3000) : stdout;
        text += `✍️ *Tiến trình hiện tại:*\n${preview}`;
      } else {
        text += `💭 *Đang phân tích ngữ cảnh và suy nghĩ...*`;
      }

      await telegramRequest('editMessageText', {
        chat_id: chatId,
        message_id: progressMsgId,
        text: text,
        parse_mode: 'Markdown'
      }).then(res => {
        // Fallback sang text thường nếu Markdown lỗi cú pháp
        if (res && !res.ok) {
          telegramRequest('editMessageText', {
            chat_id: chatId,
            message_id: progressMsgId,
            text: text.replace(/[*`#_]/g, '')
          });
        }
      });
      isUpdating = false;
    }

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      updateProgress().catch(() => {});
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      updateProgress().catch(() => {});
    });

    child.on('close', async (code) => {
      // Cập nhật lần cuối trước khi đóng
      await updateProgress(true).catch(() => {});
      
      if (code !== 0) {
        resolve(`❌ Lỗi khi thực thi agy (exit code ${code}):\n\n${stderr || stdout}`);
      } else {
        resolve(stdout || stderr || '✅ Lệnh đã thực thi xong nhưng không có phản hồi.');
      }
    });

    child.on('error', (err) => {
      resolve(`❌ Lỗi hệ thống khi khởi chạy agy: ${err.message}`);
    });
  });
}

// Hàm xử lý cập nhật (polling)
async function pollUpdates() {
  const response = await telegramRequest('getUpdates', {
    offset: updateOffset,
    timeout: 30
  });

  if (response && response.ok && response.result) {
    for (const update of response.result) {
      updateOffset = update.update_id + 1;

      if (!update.message || !update.message.text) continue;

      const chatId = update.message.chat.id;
      const userId = update.message.from.id.toString();
      const text = update.message.text.trim();

      // Kiểm tra bảo mật (chỉ cho phép UserId được whitelist)
      const allowed = Array.isArray(config.allowedUserId) 
        ? config.allowedUserId.map(id => id.toString()) 
        : [config.allowedUserId.toString()];
      if (!allowed.includes(userId)) {
        console.warn(`Cảnh báo: Có tin nhắn từ UserID lạ (${userId}): ${text}`);
        await sendMessage(chatId, '🚷 Bạn không có quyền điều khiển Bot này.');
        continue;
      }

      // Xử lý lệnh
      if (text === '/start' || text === '/help') {
        const welcomeText = 
          `👋 Xin chào! Đây là cổng kết nối với Antigravity CLI (agy).\n\n` +
          `⌨️ *Cách sử dụng:*\n` +
          `- Chỉ cần gửi tin nhắn trực tiếp để tiếp tục cuộc trò chuyện hiện tại (chạy \`agy -c\`).\n` +
          `- Dùng lệnh \`/new <nội dung>\` để bắt đầu một cuộc hội thoại mới tinh (không kế thừa lịch sử).\n` +
          `- Dùng lệnh \`/status\` để kiểm tra kết nối.`;
        await sendMessage(chatId, welcomeText);
        continue;
      }

      if (text === '/status') {
        await sendMessage(chatId, '🟢 Bot đang hoạt động bình thường và kết nối với CLI `agy`!');
        continue;
      }

      // Tạo tin nhắn trạng thái ban đầu để cập nhật tiến trình
      let progressMsgId = null;
      const progressMsg = await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: '⚡ *Đang khởi chạy Antigravity CLI...*',
        parse_mode: 'Markdown'
      });
      if (progressMsg && progressMsg.ok) {
        progressMsgId = progressMsg.result.message_id;
      }

      // Gửi trạng thái typing liên tục trong khi chờ agy trả lời
      sendTyping(chatId);
      const typingInterval = setInterval(() => sendTyping(chatId), 4000);

      try {
        let responseText = '';
        if (text.startsWith('/new ')) {
          const prompt = text.replace('/new ', '').trim();
          responseText = await runAgy(prompt, false, chatId, progressMsgId);
        } else if (text.startsWith('/new')) {
          responseText = '⚠️ Vui lòng nhập nội dung sau lệnh /new. Ví dụ: `/new viết code hello world`';
        } else {
          responseText = await runAgy(text, true, chatId, progressMsgId);
        }

        clearInterval(typingInterval);

        // Xóa tin nhắn cập nhật tiến trình cũ
        if (progressMsgId) {
          await telegramRequest('deleteMessage', { chat_id: chatId, message_id: progressMsgId });
        }

        await sendMessage(chatId, responseText);
      } catch (err) {
        clearInterval(typingInterval);
        if (progressMsgId) {
          await telegramRequest('deleteMessage', { chat_id: chatId, message_id: progressMsgId });
        }
        await sendMessage(chatId, `❌ Đã xảy ra lỗi: ${err.message}`);
      }
    }
  }

  // Tiếp tục polling
  setTimeout(pollUpdates, 1000);
}

// Bắt đầu chạy bot
console.log('Đang khởi động Telegram <-> Antigravity CLI Bridge...');

async function initOffsetAndStart() {
  console.log('Đang kiểm tra và bỏ qua các tin nhắn cũ trong hàng đợi...');
  const response = await telegramRequest('getUpdates', { limit: 100 });
  if (response && response.ok && response.result && response.result.length > 0) {
    updateOffset = response.result[response.result.length - 1].update_id + 1;
    console.log(`Đã bỏ qua ${response.result.length} tin nhắn cũ.`);
  }
  
  pollUpdates().catch(err => {
    console.error('Lỗi nghiêm trọng trong tiến trình polling:', err);
  });
}

initOffsetAndStart();
