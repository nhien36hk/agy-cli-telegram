const config = require('./config');
const Telegram = require('./telegram');
const { runAgy } = require('./agy');

const bot = new Telegram(config.token);
let updateOffset = 0;

// Set of allowed user IDs (pre-processed to string in config.js)
const allowedUsers = new Set(config.allowedUserIds);

// Format progress message content
function formatProgressText(stdout) {
  let text = `⚡ *Antigravity CLI đang xử lý...*\n\n`;
  if (stdout) {
    const preview = stdout.length > 3000 ? '...(đoạn đầu bị ẩn)\n' + stdout.slice(-3000) : stdout;
    text += `✍️ *Tiến trình hiện tại:*\n${preview}`;
  } else {
    text += `💭 *Đang phân tích ngữ cảnh và suy nghĩ...*`;
  }
  return text;
}

// Handle executing agy CLI and streaming progress to Telegram
async function handleAgyExecution(chatId, promptText, useContinue) {
  let progressMsgId = null;
  let typingInterval = null;

  try {
    // 1. Send initial progress placeholder
    const progressMsg = await bot.sendMessage(chatId, '⚡ *Đang khởi chạy Antigravity CLI...*');
    if (progressMsg && progressMsg.ok) {
      progressMsgId = progressMsg.result.message_id;
    }

    // 2. Start continuous typing indicator
    bot.sendChatAction(chatId, 'typing').catch(() => {});
    typingInterval = setInterval(() => {
      bot.sendChatAction(chatId, 'typing').catch(() => {});
    }, 4000);

    // 3. Define throttled progress update function
    let lastUpdate = Date.now();
    let isUpdating = false;

    const onChunk = async (currentStdout) => {
      const now = Date.now();
      if (now - lastUpdate < 3000 || isUpdating || !progressMsgId) {
        return;
      }

      isUpdating = true;
      lastUpdate = now;
      const progressText = formatProgressText(currentStdout);
      
      try {
        await bot.editMessageText(chatId, progressMsgId, progressText);
      } catch (err) {
        // Suppress edit errors during streaming (e.g. rate limit, content identical)
      } finally {
        isUpdating = false;
      }
    };

    // 4. Run CLI Command
    const responseText = await runAgy(promptText, { useContinue, onChunk });

    // 5. Clean up typing and progress message
    if (typingInterval) clearInterval(typingInterval);
    if (progressMsgId) {
      await bot.deleteMessage(chatId, progressMsgId).catch(() => {});
    }

    // 6. Send final result
    await bot.sendMessage(chatId, responseText);
  } catch (err) {
    if (typingInterval) clearInterval(typingInterval);
    if (progressMsgId) {
      await bot.deleteMessage(chatId, progressMsgId).catch(() => {});
    }
    const errMsg = err.message || err;
    await bot.sendMessage(chatId, `❌ Đã xảy ra lỗi: ${errMsg}`);
  }
}

// Poll updates from Telegram Bot API recursively
async function pollUpdates() {
  try {
    const response = await bot.getUpdates({
      offset: updateOffset,
      timeout: 30
    });

    if (response && response.ok && response.result) {
      for (const update of response.result) {
        updateOffset = update.update_id + 1;

        if (!update.message || !update.message.text) {
          continue;
        }

        const chatId = update.message.chat.id;
        const userId = String(update.message.from.id);
        const text = update.message.text.trim();

        // Security check
        if (!allowedUsers.has(userId)) {
          console.warn(`Cảnh báo: Có tin nhắn từ UserID lạ (${userId}): ${text}`);
          await bot.sendMessage(chatId, '🚷 Bạn không có quyền điều khiển Bot này.');
          continue;
        }

        // Help / Start Commands
        if (text === '/start' || text === '/help') {
          const welcomeText =
            `👋 Xin chào! Đây là cổng kết nối với Antigravity CLI (agy).\n\n` +
            `⌨️ *Cách sử dụng:*\n` +
            `- Chỉ cần gửi tin nhắn trực tiếp để tiếp tục cuộc trò chuyện hiện tại (chạy \`agy -c\`).\n` +
            `- Dùng lệnh \`/new <nội dung>\` để bắt đầu một cuộc hội thoại mới tinh (không kế thừa lịch sử).\n` +
            `- Dùng lệnh \`/status\` để kiểm tra kết nối.`;
          await bot.sendMessage(chatId, welcomeText);
          continue;
        }

        // Status command
        if (text === '/status') {
          await bot.sendMessage(chatId, '🟢 Bot đang hoạt động bình thường và kết nối với CLI `agy`!');
          continue;
        }

        // Process agy request
        if (text.startsWith('/new ')) {
          const prompt = text.slice(5).trim();
          handleAgyExecution(chatId, prompt, false);
        } else if (text.startsWith('/new')) {
          await bot.sendMessage(chatId, '⚠️ Vui lòng nhập nội dung sau lệnh /new. Ví dụ: `/new viết code hello world`');
        } else {
          handleAgyExecution(chatId, text, true);
        }
      }
    }
  } catch (err) {
    console.error('Lỗi trong vòng lặp polling:', err.message);
  }

  // Continue polling with delay
  setTimeout(pollUpdates, 1000);
}

// Start the bot
async function start() {
  console.log('Đang khởi động Telegram <-> Antigravity CLI Bridge...');
  console.log('Đang kiểm tra và bỏ qua các tin nhắn cũ trong hàng đợi...');
  
  try {
    const nextOffset = await bot.clearOldUpdates();
    if (nextOffset > 0) {
      updateOffset = nextOffset;
      console.log(`Đã bỏ qua các tin nhắn cũ. Offset tiếp theo: ${updateOffset}`);
    } else {
      console.log('Không có tin nhắn cũ cần bỏ qua.');
    }
  } catch (err) {
    console.error('Lỗi khi xóa tin nhắn cũ:', err.message);
  }

  // Begin polling
  pollUpdates();
}

start();
