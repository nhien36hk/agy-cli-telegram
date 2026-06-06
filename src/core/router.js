const child_process = require('child_process');
const updater = require('../utils/updater');
const watcher = require('./watcher');
const { getSession, saveSession, getModel, saveModel } = require('./session');
const { handleAgyExecution } = require('./executor');

async function routeMessage(bot, text, chatId, userId) {
  // Help / Start Commands
  if (text === '/start' || text === '/help') {
    const welcomeText =
      `👋 <b>Xin chào! Đây là cổng kết nối với Antigravity CLI (agy).</b>\n\n` +
      `⌨️ <b>Cách sử dụng:</b>\n` +
      `- Chỉ cần gửi tin nhắn trực tiếp để tiếp tục cuộc trò chuyện hiện tại (chạy <code>agy -c</code>).\n` +
      `- Dùng lệnh <code>/new &lt;nội dung&gt;</code> để bắt đầu một cuộc hội thoại mới tinh (không kế thừa lịch sử).\n` +
      `- Dùng lệnh <code>/goal &lt;mục tiêu&gt;</code> để bắt đầu chạy tác vụ tự động (multi-turn goal).\n` +
      `- Dùng lệnh <code>/model</code> để chọn model AI muốn dùng.\n` +
      `- Dùng lệnh <code>/usage</code> để xem thông tin sử dụng, phiên bản và model đang chọn.\n` +
      `- Dùng lệnh <code>/status</code> để kiểm tra kết nối.`;
    await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
    return;
  }

  // Status command
  if (text === '/status') {
    await bot.sendMessage(chatId, '🟢 Bot đang hoạt động bình thường và kết nối với CLI `agy`!');
    return;
  }

  // Update command
  if (text === '/update') {
    const statusMsg = await bot.sendMessage(chatId, '🔄 Đang kiểm tra bản cập nhật trên Server...');
    const updateInfo = await updater.checkUpdateAvailable();

    if (!updateInfo.available && !updateInfo.error) {
      await bot.editMessageText(chatId, statusMsg.result.message_id, `✅ <b>Bạn đang dùng phiên bản mới nhất!</b> (Commit: <code>${updateInfo.localVersion}</code>)`, { parse_mode: 'HTML' });
      return;
    }

    if (updateInfo.error) {
      await bot.editMessageText(chatId, statusMsg.result.message_id, `❌ <b>Lỗi kiểm tra cập nhật:</b> ${updateInfo.error}`, { parse_mode: 'HTML' });
      return;
    }

    await bot.editMessageText(chatId, statusMsg.result.message_id, `⚠️ <b>Phát hiện bản cập nhật mới!</b>\nLocal: <code>${updateInfo.localVersion}</code>\nRemote: <code>${updateInfo.remoteVersion}</code>\n\n🔄 Đang tiến hành tải code và cài đặt...`, { parse_mode: 'HTML' });

    const updateResult = await updater.performUpdate();
    if (updateResult.success) {
      await bot.sendMessage(chatId, '🎉 <b>Cập nhật thành công!</b>\nHệ thống đang khởi động lại để áp dụng thay đổi...', { parse_mode: 'HTML' });
      setTimeout(() => {
        if (process.env.pm_id || process.env.PM2_HOME) {
          process.exit(0);
        } else {
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
      await bot.sendMessage(chatId, `❌ <b>Lỗi trong quá trình cập nhật:</b>\n<pre>${updateResult.error}</pre>`, { parse_mode: 'HTML' });
    }
    return;
  }

  // Goal command
  if (text.startsWith('/goal')) {
    const prompt = text.replace('/goal', '').trim();
    if (!prompt) {
      await bot.sendMessage(chatId, '🎯 <b>Tính năng Goal (Đa bước):</b>\n\n' +
        'Cách sử dụng: <code>/goal [nội dung công việc]</code>\n\n' +
        'Ví dụ:\n' +
        '<code>/goal Viết bài thơ 3 dòng và lưu vào file tho.txt</code>\n\n' +
        '<i>Bot sẽ tự động suy nghĩ và thực hiện từng bước cho đến khi hoàn thành mục tiêu.</i>', { parse_mode: 'HTML' });
    } else {
      const savedConvId = getSession(chatId);
      handleAgyExecution(bot, chatId, `/goal ${prompt}`, !!savedConvId, savedConvId);
    }
    return;
  }

  // Usage command
  if (text === '/usage') {
    child_process.exec('agy --version', async (err, stdout, stderr) => {
      let version = 'Không xác định';
      if (!err && stdout) {
        version = stdout.trim();
      }
      const conversations = watcher.getAllConversations();
      const currentModel = getModel(chatId) || 'Mặc định (Gemini)';
      
      const usageText = 
        `📊 <b>Thông tin sử dụng & Trạng thái:</b>\n\n` +
        `• <b>Phiên bản agy-cli:</b> <code>${version}</code>\n` +
        `• <b>Số hội thoại đã lưu:</b> <b>${conversations.length}</b>\n` +
        `• <b>Model hiện tại:</b> <b>${currentModel}</b>\n\n` +
        `💡 Bạn có thể đổi model bằng lệnh <code>/model</code>`;
      
      await bot.sendMessage(chatId, usageText, { parse_mode: 'HTML' });
    });
    return;
  }

  // Model command
  if (text === '/model') {
    child_process.exec('agy models', async (err, stdout, stderr) => {
      if (err) {
        await bot.sendMessage(chatId, '❌ <b>Không thể lấy danh sách model từ agy-cli:</b>\n' + err.message, { parse_mode: 'HTML' });
        return;
      }
      
      const lines = stdout.split('\n');
      const models = [];
      for (const line of lines) {
        const cleaned = line.replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '').replace(/Fetching available models\.\.\./g, '').trim();
        if (cleaned) {
          models.push(cleaned);
        }
      }

      if (models.length === 0) {
        await bot.sendMessage(chatId, '⚠️ <b>Không tìm thấy model khả dụng nào.</b>', { parse_mode: 'HTML' });
        return;
      }

      const buttons = models.map(m => ([{
        text: m,
        callback_data: `set_model:${m}`
      }]));

      await bot.sendMessage(chatId, '🤖 <b>Chọn model cho cuộc hội thoại này:</b>', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: buttons
        }
      });
    });
    return;
  }

  // Process agy request
  if (text.startsWith('/new')) {
    const prompt = text.replace('/new', '').trim();
    if (!prompt) {
      saveSession(chatId, null);
      await bot.sendMessage(chatId, '✅ <b>Đã làm mới ngữ cảnh!</b>\nTin nhắn tiếp theo của bạn sẽ bắt đầu một cuộc hội thoại mới tinh. 🆕', { parse_mode: 'HTML' });
    } else {
      handleAgyExecution(bot, chatId, prompt, false);
    }
  } else if (text.startsWith('/resume')) {
    const prompt = text.replace('/resume', '').trim();
    if (!prompt) {
      const conversations = watcher.getAllConversations();
      if (conversations.length === 0) {
        await bot.sendMessage(chatId, '⚠️ Không tìm thấy cuộc hội thoại nào để tiếp tục.');
        return;
      }

      let listText = '📂 <b>Danh sách cuộc hội thoại gần đây:</b>\n\n';
      conversations.slice(0, 5).forEach((conv, index) => {
        const date = new Date(conv.mtime).toLocaleString('vi-VN');
        listText += `<b>${index + 1}.</b> <code>${conv.title}</code>\n   <i>(Cập nhật: ${date})</i>\n\n`;
      });
      listText += `👉 Gửi lệnh: <code>/resume [số thứ tự]</code> để chọn cuộc hội thoại.\nHoặc: <code>/resume [số thứ tự] [tin nhắn]</code> để nhắn trực tiếp.`;

      await bot.sendMessage(chatId, listText, { parse_mode: 'HTML' });
      return;
    }

    const parts = prompt.split(' ');
    const idx = parseInt(parts[0], 10);

    let conversationId = null;
    let conversationTitle = '';
    let actualPrompt = prompt;

    if (!isNaN(idx) && idx > 0) {
      const conversations = watcher.getAllConversations();
      if (idx <= conversations.length) {
        conversationId = conversations[idx - 1].id;
        conversationTitle = conversations[idx - 1].title;
        actualPrompt = parts.slice(1).join(' ').trim();
      } else {
        await bot.sendMessage(chatId, `⚠️ Số thứ tự <b>${idx}</b> không hợp lệ. Vui lòng chọn từ 1 đến ${conversations.length}.`, { parse_mode: 'HTML' });
        return;
      }
    }

    if (conversationId) {
      saveSession(chatId, conversationId);
      if (!actualPrompt) {
        await bot.sendMessage(chatId, `✅ Đã chuyển đổi thành công sang cuộc hội thoại:\n👉 <code>${conversationTitle}</code>\n\nBạn có thể bắt đầu nhắn tin tiếp tục từ bây giờ!`, { parse_mode: 'HTML' });
        return;
      }
    } else if (!actualPrompt) {
      await bot.sendMessage(chatId, `⚠️ Vui lòng nhập đúng số thứ tự. Ví dụ: <code>/resume 1</code>`, { parse_mode: 'HTML' });
      return;
    }

    handleAgyExecution(bot, chatId, actualPrompt, true, conversationId);
  } else {
    // Default behavior is to continue (resume) or start new if no session
    const savedConvId = getSession(chatId);
    handleAgyExecution(bot, chatId, text, !!savedConvId, savedConvId);
  }
}

async function routeCallbackQuery(bot, callbackQuery, chatId, userId) {
  const data = callbackQuery.data;
  if (data.startsWith('set_model:')) {
    const modelName = data.replace('set_model:', '').trim();
    saveModel(chatId, modelName);
    
    await bot.answerCallbackQuery(callbackQuery.id, `Đã chuyển sang model: ${modelName}`);
    await bot.editMessageText(chatId, callbackQuery.message.message_id, `🤖 <b>Đã chọn model:</b> <b>${modelName}</b>`, { parse_mode: 'HTML' });
  }
}

module.exports = {
  routeMessage,
  routeCallbackQuery
};

