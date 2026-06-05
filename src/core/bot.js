const config = require('../config/loader');
const Telegram = require('./telegram');
const { runAgy } = require('./runner');
const { toTelegramHtml, extractNewTurnOutput, stripAnsi } = require('../utils/parser');
const { getCachedHistory, saveCachedHistory, clearCachedHistory } = require('./history');
const watcher = require('./watcher');
const updater = require('../utils/updater');

let globalAgentState = '🧠 Đang suy nghĩ...';

const bot = new Telegram(config.token);
let updateOffset = 0;

// Set of allowed user IDs (pre-processed to string in config.js)
const allowedUsers = new Set(config.allowedUserIds);

// Handle executing agy CLI and streaming progress to Telegram
async function handleAgyExecution(chatId, promptText, useContinue) {
  let progressMsgId = null;
  let typingInterval = null;

  try {
    globalAgentState = '🧠 Đang suy nghĩ...';

    // 1. Gửi tin nhắn trạng thái chờ ban đầu (Seamless UI)
    const initialHtml = `<code>${globalAgentState}</code>\n`;
    const progressMsg = await bot.sendMessage(chatId, initialHtml, { parse_mode: 'HTML' });
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

    const onChunk = async (currentStdout, currentHistoryLength) => {
      const now = Date.now();
      if (now - lastUpdate < 1200 || isUpdating || !progressMsgId) {
        return;
      }

      isUpdating = true;
      lastUpdate = now;
      // Chỉ hiển thị trạng thái hiện tại (globalAgentState) để giao diện gọn gàng như CLI thật
      const progressHtml = `<code>${globalAgentState}</code>`;
      
      try {
        await bot.editMessageText(chatId, progressMsgId, progressHtml);
      } catch (err) {
        // Suppress edit errors during streaming (e.g. rate limit, content identical)
      } finally {
        isUpdating = false;
      }
    };

    // 4. Run CLI Command
    const { stdout: responseText, historyLength } = await runAgy(promptText, { useContinue, onChunk });

    // 5. Đọc "Tủy não" (transcript.jsonl) để lấy kết quả sạch 100% thay vì parse stdout
    // Thêm một chút delay để đảm bảo file jsonl đã được flush xong
    await new Promise(r => setTimeout(r, 200)); 
    let currentTurnOutput = watcher.getLatestTurnFromTranscript();
    
    // Fallback nếu có lỗi nghiêm trọng khi đọc transcript (Rất hiếm)
    if (currentTurnOutput === null) {
      currentTurnOutput = extractNewTurnOutput(responseText, useContinue, historyLength, getCachedHistory());
    }

    // Nếu Agent không có phản hồi bằng chữ (chỉ chạy ngầm tool)
    if (currentTurnOutput === '') {
      currentTurnOutput = '✅ <i>Đã thực hiện xong tác vụ.</i>';
    }

    // 6. Dọn dẹp hiệu ứng typing và xóa thanh trạng thái (Giống hệt CLI: loader biến mất khi xong)
    if (typingInterval) clearInterval(typingInterval);
    if (progressMsgId) {
      await bot.deleteMessage(chatId, progressMsgId).catch(() => {});
    }

    // 7. Vẫn lưu lại history cũ phòng hờ fallback
    saveCachedHistory(stripAnsi(responseText));

    // 8. Send final result formatted beautifully as HTML
    let finalCleanText = currentTurnOutput;
    // Nếu output quá dài vượt mức 4096 của Telegram
    if (finalCleanText.length > 4000) {
      const chunks = finalCleanText.match(/[\s\S]{1,4000}/g) || [];
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, toTelegramHtml(chunk));
      }
    } else {
      await bot.sendMessage(chatId, toTelegramHtml(finalCleanText));
    }
  } catch (err) {
    if (typingInterval) clearInterval(typingInterval);
    if (progressMsgId) {
      await bot.deleteMessage(chatId, progressMsgId).catch(() => {});
    }
    const errMsg = err.message || err;
    await bot.sendMessage(chatId, `❌ <b>Đã xảy ra lỗi:</b>\n<pre>${toTelegramHtml(errMsg)}</pre>`);
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
            `👋 <b>Xin chào! Đây là cổng kết nối với Antigravity CLI (agy).</b>\n\n` +
            `⌨️ <b>Cách sử dụng:</b>\n` +
            `- Chỉ cần gửi tin nhắn trực tiếp để tiếp tục cuộc trò chuyện hiện tại (chạy <code>agy -c</code>).\n` +
            `- Dùng lệnh <code>/new &lt;nội dung&gt;</code> để bắt đầu một cuộc hội thoại mới tinh (không kế thừa lịch sử).\n` +
            `- Dùng lệnh <code>/status</code> để kiểm tra kết nối.`;
          await bot.sendMessage(chatId, welcomeText);
          continue;
        }

        // Status command
        if (text === '/status') {
          await bot.sendMessage(chatId, '🟢 Bot đang hoạt động bình thường và kết nối với CLI `agy`!');
          continue;
        }

        // Update command
        if (text === '/update') {
          const statusMsg = await bot.sendMessage(chatId, '🔄 Đang kiểm tra bản cập nhật trên Server...');
          const updateInfo = await updater.checkUpdateAvailable();
          
          if (!updateInfo.available && !updateInfo.error) {
            await bot.editMessageText(chatId, statusMsg.result.message_id, `✅ <b>Bạn đang dùng phiên bản mới nhất!</b> (Commit: <code>${updateInfo.localVersion}</code>)`);
            continue;
          }

          if (updateInfo.error) {
            await bot.editMessageText(chatId, statusMsg.result.message_id, `❌ <b>Lỗi kiểm tra cập nhật:</b> ${updateInfo.error}`);
            continue;
          }

          await bot.editMessageText(chatId, statusMsg.result.message_id, `⚠️ <b>Phát hiện bản cập nhật mới!</b>\nLocal: <code>${updateInfo.localVersion}</code>\nRemote: <code>${updateInfo.remoteVersion}</code>\n\n🔄 Đang tiến hành tải code và cài đặt...`);
          
          const updateResult = await updater.performUpdate();
          if (updateResult.success) {
            await bot.sendMessage(chatId, '🎉 <b>Cập nhật thành công!</b>\nHệ thống đang khởi động lại để áp dụng thay đổi...');
            // Thoát tiến trình để pm2 tự động khởi động lại với code mới
            setTimeout(() => {
              process.exit(0);
            }, 1000);
          } else {
            await bot.sendMessage(chatId, `❌ <b>Lỗi trong quá trình cập nhật:</b>\n<pre>${updateResult.error}</pre>`);
          }
          continue;
        }

        // Process agy request
        if (text.startsWith('/new')) {
          const prompt = text.replace('/new', '').trim();
          if (!prompt) {
            await bot.sendMessage(chatId, '⚠️ Vui lòng nhập nội dung sau lệnh /new. Ví dụ: <code>/new viết code hello world</code>');
          } else {
            handleAgyExecution(chatId, prompt, false);
          }
        } else if (text.startsWith('/resume')) {
          const prompt = text.replace('/resume', '').trim();
          if (!prompt) {
            await bot.sendMessage(chatId, '⚠️ Vui lòng nhập nội dung sau lệnh /resume. Ví dụ: <code>/resume tiếp tục viết code</code>');
          } else {
            handleAgyExecution(chatId, prompt, true);
          }
        } else {
          // Default behavior is to continue (resume)
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
  console.log('========================================');
  console.log('🚀 Antigravity Telegram Bridge Server is RUNNING!');
  console.log('💬 Đang lắng nghe tin nhắn từ Telegram...');
  console.log('========================================');

  // Register bot commands
  try {
    await bot.setMyCommands([
      { command: 'new', description: 'Bắt đầu cuộc trò chuyện mới (Reset Context)' },
      { command: 'resume', description: 'Tiếp tục cuộc trò chuyện hiện tại (Mặc định)' },
      { command: 'status', description: 'Kiểm tra trạng thái máy chủ' },
      { command: 'update', description: 'Cập nhật Bot lên phiên bản mới nhất' },
      { command: 'help', description: 'Xem hướng dẫn sử dụng' }
    ]);
    console.log('✅ Đã đăng ký Menu Lệnh (/, /new, /resume, /update) với Telegram.');
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

  // Khởi động Watcher bắt sự kiện log
  watcher.startWatching();
  watcher.on('agent_action', (data) => {
    globalAgentState = data.fullText;
  });

  // Tự động kiểm tra cập nhật khi khởi động (Không block luồng chính)
  updater.checkUpdateAvailable().then((updateInfo) => {
    if (updateInfo.available) {
      console.log(`\n🚀 [UPDATE ALERT] Có bản cập nhật mới trên GitHub (Remote: ${updateInfo.remoteVersion}).`);
      console.log(`Hãy gõ lệnh /update trên Telegram hoặc chạy 'git pull' để cập nhật!\n`);
    }
  }).catch(() => {});

  // Begin polling
  pollUpdates();
}

start();
