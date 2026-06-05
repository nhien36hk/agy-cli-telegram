const config = require('../config/loader');
const Telegram = require('./telegram');
const { runAgy } = require('./runner');
const { toTelegramHtml, extractNewTurnOutput, stripAnsi } = require('../utils/parser');
const { getCachedHistory, saveCachedHistory, clearCachedHistory } = require('./history');
const watcher = require('./watcher');
const updater = require('../utils/updater');
const fs = require('fs');
const path = require('path');
const net = require('net');

const bot = new Telegram(config.token);
let updateOffset = 0;

const sessionFile = path.resolve(__dirname, 'sessions.json');

function getSession(chatId) {
  try {
    if (fs.existsSync(sessionFile)) {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      return data[chatId] || null;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function saveSession(chatId, conversationId) {
  try {
    let data = {};
    if (fs.existsSync(sessionFile)) {
      try {
        data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      } catch (parseErr) {
        data = {};
      }
    }
    data[chatId] = conversationId;
    fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving session:', e.message);
  }
}

// Set of allowed user IDs (pre-processed to string in config.js)
const allowedUsers = new Set(config.allowedUserIds);

// Helper to find new conversation created by this bot run, avoiding crosstalk with other processes
function findMatchedNewConversation(knownConvIds, promptText, fallbackToLatest = false) {
  const currentConvs = watcher.getAllConversations();
  const newConvs = currentConvs.filter(c => !knownConvIds.has(c.id));
  if (newConvs.length === 0) return null;

  const normalizedPrompt = promptText.toLowerCase().trim();
  const matched = newConvs.find(c => {
    let cleanTitle = c.title.toLowerCase().trim();
    if (cleanTitle === 'hội thoại mới') return false;
    if (cleanTitle.endsWith('...')) {
      cleanTitle = cleanTitle.slice(0, -3).trim();
    }
    return normalizedPrompt.includes(cleanTitle);
  });

  if (matched) return matched;
  return fallbackToLatest ? newConvs[0] : null;
}

// Handle executing agy CLI and streaming progress to Telegram
async function handleAgyExecution(chatId, promptText, useContinue, conversationId = null) {
  let progressMsgId = null;
  let typingInterval = null;
  let activeConvId = conversationId;
  const knownConvIds = new Set(watcher.getAllConversations().map(c => c.id));
  let lastState = '🧠 Đang suy nghĩ...';

  try {
    // 1. Gửi tin nhắn trạng thái chờ ban đầu (Seamless UI)
    const initialHtml = `<code>🧠 Đang suy nghĩ...</code>\n`;
    const progressMsg = await bot.sendMessage(chatId, initialHtml, { parse_mode: 'HTML' });
    if (progressMsg && progressMsg.ok) {
      progressMsgId = progressMsg.result.message_id;
    }

    // 2. Start continuous typing indicator
    bot.sendChatAction(chatId, 'typing').catch(() => {});
    
    // 3. Fake Typing Effect cho Tool calls
    typingInterval = setInterval(async () => {
      bot.sendChatAction(chatId, 'typing').catch(() => {});
      if (!progressMsgId) return;
      
      if (!activeConvId) {
        const matched = findMatchedNewConversation(knownConvIds, promptText, false);
        if (matched) {
          activeConvId = matched.id;
          saveSession(chatId, activeConvId);
        }
      }

      const activeTool = watcher.getCurrentActiveTool(activeConvId);
      const newState = activeTool || '🧠 Đang xử lý thuật toán...';
      
      if (newState !== lastState) {
        lastState = newState;
        await bot.editMessageText(chatId, progressMsgId, `<code>${newState}</code>`, { parse_mode: 'HTML' }).catch(() => {});
      }
    }, 1000);

    const onChunk = async () => {
      // Bỏ trống onChunk vì chúng ta đã dùng uiUpdater xịn hơn nhiều!
    };

    // 4. Run CLI Command
    const { stdout: responseText, historyLength } = await runAgy(promptText, { useContinue, onChunk, conversationId: activeConvId });

    // Ensure activeConvId is captured even if typingInterval missed it, with fallback to latest if needed
    if (!activeConvId) {
      const matched = findMatchedNewConversation(knownConvIds, promptText, true);
      if (matched) {
        activeConvId = matched.id;
        saveSession(chatId, activeConvId);
      }
    }

    // 5. Đọc "Tủy não" (transcript.jsonl) để lấy kết quả sạch 100% thay vì parse stdout
    // Thêm một chút delay để đảm bảo file jsonl đã được flush xong
    await new Promise(r => setTimeout(r, 200)); 
    let currentTurnOutput = watcher.getLatestTurnFromTranscript(activeConvId);
    
    // Fallback nếu có lỗi nghiêm trọng khi đọc transcript (Rất hiếm)
    if (currentTurnOutput === null) {
      currentTurnOutput = extractNewTurnOutput(responseText, useContinue, historyLength, getCachedHistory());
    }

    // Nếu Agent không có phản hồi bằng chữ (chỉ chạy ngầm tool)
    if (currentTurnOutput === '') {
      currentTurnOutput = '✅ <i>Đã thực hiện xong tác vụ.</i>';
    }

    // 6. Dọn dẹp tiến trình UI
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
            await bot.sendMessage(chatId, '🎉 <b>Cập nhật thành công!</b>\nHệ thống đang khởi động lại để áp dụng thay đổi...', { parse_mode: 'HTML' });
            setTimeout(() => {
              if (process.env.pm_id || process.env.PM2_HOME) {
                // Chạy qua PM2, chỉ cần thoát để PM2 hồi sinh
                process.exit(0);
              } else {
                // Chạy chay, tự động spawn lại chính process này
                const { spawn } = require('child_process');
                const child = spawn(process.argv[0], process.argv.slice(1), {
                  detached: true,
                  stdio: 'ignore'
                });
                child.unref();
                process.exit(0);
              }
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
            const conversations = watcher.getAllConversations();
            if (conversations.length === 0) {
              await bot.sendMessage(chatId, '⚠️ Không tìm thấy cuộc hội thoại nào để tiếp tục.');
              continue;
            }
            
            let listText = '📂 <b>Danh sách cuộc hội thoại gần đây:</b>\n\n';
            conversations.slice(0, 5).forEach((conv, index) => {
              const date = new Date(conv.mtime).toLocaleString('vi-VN');
              listText += `<b>${index + 1}.</b> <code>${conv.title}</code>\n   <i>(Cập nhật: ${date})</i>\n\n`;
            });
            listText += `👉 Gửi lệnh: <code>/resume [số thứ tự] [tin nhắn]</code> để tiếp tục.\nVí dụ: <code>/resume 1 code tiếp nhé</code>`;
            
            await bot.sendMessage(chatId, listText, { parse_mode: 'HTML' });
            continue;
          }

          const parts = prompt.split(' ');
          const idx = parseInt(parts[0], 10);
          
          let conversationId = null;
          let actualPrompt = prompt;
          
          if (!isNaN(idx) && idx > 0) {
             const conversations = watcher.getAllConversations();
             if (idx <= conversations.length) {
                conversationId = conversations[idx - 1].id;
                actualPrompt = parts.slice(1).join(' ').trim();
             }
          }

          if (!actualPrompt) {
            await bot.sendMessage(chatId, `⚠️ Vui lòng nhập nội dung cho cuộc hội thoại ${idx || ''}. Ví dụ: <code>/resume 1 tiếp tục code</code>`, { parse_mode: 'HTML' });
            continue;
          }
          if (conversationId) {
            saveSession(chatId, conversationId);
          }
          handleAgyExecution(chatId, actualPrompt, true, conversationId);
        } else {
          // Default behavior is to continue (resume) or start new if no session
          const savedConvId = getSession(chatId);
          handleAgyExecution(chatId, text, !!savedConvId, savedConvId);
        }
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
