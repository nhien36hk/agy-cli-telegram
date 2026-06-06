const config = require('../config/loader');
const Telegram = require('./telegram');
const { routeMessage, routeCallbackQuery } = require('./router');
const updater = require('../utils/updater');
const net = require('net');

const bot = new Telegram(config.token);
let updateOffset = 0;

// Set of allowed user IDs (pre-processed to string in config.js)
const allowedUsers = new Set(config.allowedUserIds);

const { handleAgyExecution } = require('./executor');

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

        if (update.callback_query) {
          const callbackQuery = update.callback_query;
          const userId = String(callbackQuery.from.id);
          const chatId = callbackQuery.message.chat.id;

          // Security check
          if (!allowedUsers.has(userId)) {
            console.warn(`Cảnh báo: Có callback query từ UserID lạ (${userId})`);
            await bot.answerCallbackQuery(callbackQuery.id, '🚷 Bạn không có quyền thực hiện hành động này.');
            continue;
          }

          await routeCallbackQuery(bot, callbackQuery, chatId, userId);
          continue;
        }

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

        // Delegate to router
        await routeMessage(bot, text, chatId, userId);
      }
    }
  } catch (err) {
    console.error('Lỗi trong vòng lặp polling:', err.message);
  }

  // Continue polling with delay
  setTimeout(pollUpdates, 1000);
}

// Enforce single instance to prevent duplicate bot polling and crosstalk
function enforceSingleInstance(port = 9876) {
  const server = net.createServer();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('==================================================================');
      console.error(`❌ LỖI NGHIÊM TRỌNG: Cổng ${port} đã bị chiếm dụng!`);
      console.error('Đang có một tiến trình bot Telegram khác chạy ngầm trên máy này.');
      console.error('Để tránh lỗi trùng lặp tin nhắn (2 input/output), tiến trình này sẽ tự thoát.');
      console.error('Vui lòng chạy `pm2 restart agy-tele` hoặc tắt các tiến trình cũ.');
      console.error('==================================================================');
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    server.unref();
  });
}

// Start the bot
async function start() {
  enforceSingleInstance(9876);
  console.log('========================================');
  console.log('🚀 Antigravity Telegram Bridge Server is RUNNING!');
  console.log('💬 Đang lắng nghe tin nhắn từ Telegram...');
  console.log('========================================');

  // Register bot commands
  try {
    await bot.setMyCommands([
      { command: 'new', description: 'Bắt đầu cuộc trò chuyện mới (Reset Context)' },
      { command: 'resume', description: 'Tiếp tục cuộc trò chuyện hiện tại (Mặc định)' },
      { command: 'goal', description: 'Chạy tác vụ đa bước tự động (multi-turn goal)' },
      { command: 'model', description: 'Chọn model AI muốn sử dụng' },
      { command: 'usage', description: 'Xem trạng thái, phiên bản, model đang sử dụng' },
      { command: 'status', description: 'Kiểm tra trạng thái máy chủ' },
      { command: 'update', description: 'Cập nhật Bot lên phiên bản mới nhất' },
      { command: 'help', description: 'Xem hướng dẫn sử dụng' }
    ]);
    console.log('✅ Đã đăng ký Menu Lệnh (/, /new, /resume, /goal, /model, /usage, /update) với Telegram.');
  } catch (err) {
    console.error('⚠️ Không thể đăng ký Menu Lệnh:', err.message);
  }

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

  // Tự động kiểm tra cập nhật khi khởi động (Không block luồng chính)
  updater.checkUpdateAvailable().then((updateInfo) => {
    if (updateInfo.available) {
      console.log(`\n🚀 [UPDATE ALERT] Có bản cập nhật mới trên GitHub (Remote: ${updateInfo.remoteVersion}).`);
      console.log(`Hãy gõ lệnh /update trên Telegram hoặc chạy 'git pull' để cập nhật!\n`);
      if (config.allowedUserIds && config.allowedUserIds.length > 0) {
        const adminId = config.allowedUserIds[0];
        bot.sendMessage(adminId, `🚀 <b>[UPDATE ALERT]</b> Có bản cập nhật mới trên GitHub!\nPhiên bản hiện tại: <code>${updateInfo.localVersion}</code>\nPhiên bản mới nhất: <code>${updateInfo.remoteVersion}</code>\n\n👉 Hãy gõ lệnh /update để tự động cập nhật và khởi động lại!`, { parse_mode: 'HTML' }).catch(err => {
          console.error('Không thể gửi thông báo cập nhật qua Telegram:', err.message);
        });
      }
    }
  }).catch((err) => {
    console.error('Lỗi kiểm tra cập nhật ngầm:', err.message);
  });

  // Begin polling
  pollUpdates();
}

start();
