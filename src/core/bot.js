const config = require('../config/loader');
const Telegram = require('./telegram');
const { runAgy } = require('./runner');
const { toTelegramHtml, parseStdout, formatProgressHtml, extractNewTurnOutput, stripAnsi, formatFinalStepsHtml } = require('../utils/parser');
const { getCachedHistory, saveCachedHistory, clearCachedHistory } = require('./history');
const watcher = require('./watcher');

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
      const cachedHistory = getCachedHistory();
      const currentTurnStdout = extractNewTurnOutput(currentStdout, useContinue, currentHistoryLength, cachedHistory);
      const { steps } = parseStdout(currentTurnStdout);
      const progressHtml = formatProgressHtml(steps, currentTurnStdout, globalAgentState);
      
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

    // 5. Extract the current turn's output from the accumulated history
    const cachedHistory = getCachedHistory();
    const currentTurnOutput = extractNewTurnOutput(responseText, useContinue, historyLength, cachedHistory);

    // 6. Clean up typing and persist progress message with final steps
    if (typingInterval) clearInterval(typingInterval);
    if (progressMsgId) {
      const { steps } = parseStdout(currentTurnOutput);
      const finalStepsHtml = formatFinalStepsHtml(steps);
      if (finalStepsHtml) {
        await bot.editMessageText(chatId, progressMsgId, finalStepsHtml).catch(() => {});
      } else {
        await bot.deleteMessage(chatId, progressMsgId).catch(() => {});
      }
    }

    // 7. Save the new full history to cache for next time
    saveCachedHistory(stripAnsi(responseText));

    // 8. Send final result formatted beautifully as HTML
    const { response } = parseStdout(currentTurnOutput);
    const finalCleanText = response || currentTurnOutput;
    const cleanHtmlResponse = toTelegramHtml(finalCleanText);
    await bot.sendMessage(chatId, cleanHtmlResponse);
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
      { command: 'help', description: 'Xem hướng dẫn sử dụng' }
    ]);
    console.log('✅ Đã đăng ký Menu Lệnh (/, /new, /resume) với Telegram.');
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

  // Begin polling
  pollUpdates();
}

start();
