const { runAgy } = require('./runner');
const watcher = require('./watcher');
const { getSession, saveSession } = require('./session');
const { toTelegramHtml, extractNewTurnOutput, stripAnsi } = require('../utils/parser');
const { getCachedHistory, saveCachedHistory } = require('./history');

// Helper to find new conversation created by this bot run, avoiding crosstalk with other processes
function findMatchedNewConversation(knownConvIds, promptText, fallbackToLatest = false) {
  const currentConvs = watcher.getAllConversations();
  const newConvs = currentConvs.filter(c => !knownConvIds.has(c.id));
  if (newConvs.length === 0) return null;

  const normalizedPrompt = promptText.trim();

  // Exact match using full prompt read directly from transcript
  const exactMatch = newConvs.find(c => c.fullPrompt && c.fullPrompt === normalizedPrompt);
  if (exactMatch) return exactMatch;

  if (fallbackToLatest) {
    // Only fallback if the conversation doesn't clearly belong to something else.
    // If it has a fullPrompt and it doesn't match our prompt, it's definitely NOT ours.
    const potentialMatch = newConvs.find(c => !c.fullPrompt || c.fullPrompt === normalizedPrompt);
    if (potentialMatch) return potentialMatch;
  }
  return null;
}

// Handle executing agy CLI and streaming progress to Telegram
async function handleAgyExecution(bot, chatId, promptText, useContinue, conversationId = null) {
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
    bot.sendChatAction(chatId, 'typing').catch(() => { });

    // 3. Fake Typing Effect cho Tool calls
    typingInterval = setInterval(async () => {
      bot.sendChatAction(chatId, 'typing').catch(() => { });
      if (!progressMsgId) return;

      if (!activeConvId) {
        const matched = findMatchedNewConversation(knownConvIds, promptText, false);
        if (matched) {
          activeConvId = matched.id;
          saveSession(chatId, activeConvId);
        }
      }

      const activeTool = watcher.getCurrentActiveTool(activeConvId);
      const newState = activeTool || '<i>▸ Đang suy nghĩ...</i>';

      if (newState !== lastState) {
        lastState = newState;
        await bot.editMessageText(chatId, progressMsgId, newState, { parse_mode: 'HTML' }).catch(() => { });
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
      await bot.deleteMessage(chatId, progressMsgId).catch(() => { });
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
      await bot.deleteMessage(chatId, progressMsgId).catch(() => { });
    }
    const errMsg = err.message || err;
    await bot.sendMessage(chatId, `❌ <b>Đã xảy ra lỗi:</b>\n<pre>${toTelegramHtml(errMsg)}</pre>`);
  }
}

module.exports = {
  findMatchedNewConversation,
  handleAgyExecution
};
