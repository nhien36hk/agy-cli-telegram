const child_process = require('child_process');
const updater = require('../utils/updater');
const watcher = require('./watcher');
const { getSession, saveSession, getModel, saveModel, getSessionState, saveSessionState } = require('./session');
const { handleAgyExecution } = require('./executor');
const pty = require('node-pty');

/**
 * Fetch available models from agy CLI using node-pty.
 * agy models requires a PTY (interactive spinner) — child_process.exec hangs.
 * Returns a Promise that resolves to an array of model name strings.
 */
function fetchAgyModels() {
  return new Promise((resolve, reject) => {
    let output = '';
    const term = pty.spawn('agy', ['models'], {
      cols: 200,
      rows: 24,
      env: process.env
    });
    const timeout = setTimeout(() => {
      term.kill();
      reject(new Error('agy models timed out after 15s'));
    }, 15000);
    term.onData(data => { output += data; });
    term.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      if (exitCode !== 0) {
        reject(new Error(`agy models exited with code ${exitCode}`));
        return;
      }
      const lines = output.split('\n');
      const models = [];
      for (const line of lines) {
        const cleaned = line
          .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '')
          .replace(/Fetching available models\.\.\./g, '')
          .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
          .replace(/\r/g, '')
          .trim();
        if (cleaned) {
          models.push(cleaned);
        }
      }
      resolve(models);
    });
  });
}

/**
 * Fetch token usage and session statistics from hermes insights.
 * Returns a Promise resolving to a parsed insights object or null.
 */
function fetchHermesInsights() {
  return new Promise((resolve) => {
    child_process.exec('hermes insights', (err, stdout, stderr) => {
      if (err || !stdout) {
        resolve(null);
        return;
      }
      try {
        const result = {
          sessions: 0,
          messages: 0,
          userMessages: 0,
          totalTokens: '0',
          models: []
        };
        
        const sessionsMatch = stdout.match(/Sessions:\s+(\d+)/);
        if (sessionsMatch) result.sessions = parseInt(sessionsMatch[1], 10);
        
        const messagesMatch = stdout.match(/Messages:\s+(\d+)/);
        if (messagesMatch) result.messages = parseInt(messagesMatch[1], 10);
        
        const userMsgMatch = stdout.match(/User messages:\s+(\d+)/);
        if (userMsgMatch) result.userMessages = parseInt(userMsgMatch[1], 10);
        
        const tokensMatch = stdout.match(/Total tokens:\s+([\d,]+)/);
        if (tokensMatch) result.totalTokens = tokensMatch[1];
        
        const modelsSectionMatch = stdout.match(/🤖 Models Used[\s\S]+?📱 Platforms/);
        if (modelsSectionMatch) {
          const lines = modelsSectionMatch[0].split('\n');
          for (let i = 3; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('───') || line.includes('Platform')) continue;
            const parts = line.split(/\s{2,}/);
            if (parts.length >= 2) {
              const modelName = parts[0].trim();
              const tokens = parts[parts.length - 1].trim();
              result.models.push({ name: modelName, tokens });
            }
          }
        }
        resolve(result);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

/**
 * Fetch the Model Quota screen from interactive agy session.
 * Uses a static 4-second delay for logging in, sends /usage,
 * and extracts the "└ Model Quota" section.
 */
function fetchAgyQuota() {
  return new Promise((resolve) => {
    const term = pty.spawn('agy', [], {
      cols: 100,
      rows: 100,
      env: process.env
    });

    let output = '';
    const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

    const loginTimeout = setTimeout(() => {
      term.write('/usage\r');
      
      const captureTimeout = setTimeout(() => {
        term.kill();
        const cleanText = stripAnsi(output).replace(/\r/g, '');
        let startIndex = cleanText.lastIndexOf('└ Models & Quota');
        if (startIndex === -1) {
          startIndex = cleanText.lastIndexOf('└ Model Quota');
        }
        if (startIndex !== -1) {
          const section = cleanText.substring(startIndex);
          const lines = section.split('\n');
          const filteredLines = [];
          
          for (const line of lines) {
            if (line.includes('Scroll') || line.includes('Page') || line.includes('Close') || line.includes('to cancel')) {
              break;
            }
            filteredLines.push(line);
          }
          resolve(filteredLines.join('\n').trim());
        } else {
          resolve(null);
        }
      }, 3000);
    }, 4000);

    term.onData(data => {
      output += data;
    });
  });
}



async function routeMessage(bot, text, chatId, userId) {
  // Check if session is waiting for a model selection and a raw number is received
  const state = getSessionState(chatId);
  if (state && state.waitingForModelSelect) {
    const modelIdx = parseInt(text, 10);
    if (!isNaN(modelIdx)) {
      const models = state.modelsList;
      if (modelIdx >= 1 && modelIdx <= models.length) {
        const selectedModelName = models[modelIdx - 1];
        saveModel(chatId, selectedModelName);
        saveSessionState(chatId, null); // Clear state
        await bot.sendMessage(chatId, `🤖 <b>Model selected:</b> <b>${selectedModelName}</b>`, { parse_mode: 'HTML' });
        return;
      } else {
        await bot.sendMessage(chatId, `⚠️ Invalid number. Please select from 1 to ${models.length} or send /model to view the list again.`, { parse_mode: 'HTML' });
        return;
      }
    }
  }

  // Help / Start Commands
  if (text === '/start' || text === '/help') {
    const welcomeText =
      `👋 <b>Hello! This is the bridge connection to Antigravity CLI (agy).</b>\n\n` +
      `⌨️ <b>Usage:</b>\n` +
      `- Simply send a message to continue the current conversation (runs <code>agy -c</code>).\n` +
      `- Use <code>/new &lt;content&gt;</code> to start a completely new conversation (does not inherit history).\n` +
      `- Use <code>/goal &lt;goal&gt;</code> to start an automated multi-step task (multi-turn goal).\n` +
      `- Use <code>/model</code> to select the AI model you want to use.\n` +
      `- Use <code>/usage</code> to view usage information, version, and the currently selected model.\n` +
      `- Use <code>/status</code> to check the server connection.`;
    await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
    return;
  }

  // Status command
  if (text === '/status') {
    await bot.sendMessage(chatId, '🟢 Bot is operating normally and connected to the `agy` CLI!');
    return;
  }

  // Update command
  if (text === '/update') {
    const statusMsg = await bot.sendMessage(chatId, '🔄 Checking for updates on the Server...');
    const updateInfo = await updater.checkUpdateAvailable();

    if (!updateInfo.available && !updateInfo.error) {
      await bot.editMessageText(chatId, statusMsg.result.message_id, `✅ <b>You are using the latest version!</b> (Commit: <code>${updateInfo.localVersion}</code>)`, { parse_mode: 'HTML' });
      return;
    }

    if (updateInfo.error) {
      await bot.editMessageText(chatId, statusMsg.result.message_id, `❌ <b>Update check error:</b> ${updateInfo.error}`, { parse_mode: 'HTML' });
      return;
    }

    await bot.editMessageText(chatId, statusMsg.result.message_id, `⚠️ <b>New update detected!</b>\nLocal: <code>${updateInfo.localVersion}</code>\nRemote: <code>${updateInfo.remoteVersion}</code>\n\n🔄 Downloading code and installing...`, { parse_mode: 'HTML' });

    const updateResult = await updater.performUpdate();
    if (updateResult.success) {
      await bot.sendMessage(chatId, '🎉 <b>Update successful!</b>\nThe system is restarting to apply changes...', { parse_mode: 'HTML' });
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
      await bot.sendMessage(chatId, `❌ <b>Error during update:</b>\n<pre>${updateResult.error}</pre>`, { parse_mode: 'HTML' });
    }
    return;
  }

  // Goal command
  if (text.startsWith('/goal')) {
    const prompt = text.replace('/goal', '').trim();
    if (!prompt) {
      await bot.sendMessage(chatId, '🎯 <b>Goal Feature (Multi-step):</b>\n\n' +
        'Usage: <code>/goal [task description]</code>\n\n' +
        'Example:\n' +
        '<code>/goal Write a 3-line poem and save to poem.txt</code>\n\n' +
        '<i>The bot will automatically think and execute each step until the goal is achieved.</i>', { parse_mode: 'HTML' });
    } else {
      const savedConvId = getSession(chatId);
      handleAgyExecution(bot, chatId, `/goal ${prompt}`, !!savedConvId, savedConvId);
    }
    return;
  }

  // Usage command
  if (text === '/usage') {
    let progressMsg = null;
    try {
      const sent = await bot.sendMessage(chatId, '⏳ <b>Retrieving quota information from agy-cli...</b>', { parse_mode: 'HTML' });
      if (sent && sent.ok) {
        progressMsg = sent;
      }
    } catch (sendErr) {
      // Ignore if initial message fail
    }

    try {
      const currentModel = getModel(chatId) || 'Default (Gemini)';
      const quotaText = await fetchAgyQuota();
      
      let usageText = `📊 <b>Usage & Quota Info:</b>\n\n` +
                      `• <b>Current Model:</b> <b>${currentModel}</b>\n\n`;
                      
      if (quotaText) {
        usageText += `<pre>${quotaText}</pre>`;
      } else {
        usageText += `⚠️ <i>Could not retrieve quota information from agy-cli. Please make sure you are logged into agy-cli on the server.</i>`;
      }
      
      if (progressMsg) {
        await bot.editMessageText(chatId, progressMsg.result.message_id, usageText, { parse_mode: 'HTML' });
      } else {
        await bot.sendMessage(chatId, usageText, { parse_mode: 'HTML' });
      }
    } catch (e) {
      const errorMsg = `❌ <b>Error retrieving usage info:</b>\n<pre>${e.message}</pre>`;
      if (progressMsg) {
        await bot.editMessageText(chatId, progressMsg.result.message_id, errorMsg, { parse_mode: 'HTML' });
      } else {
        await bot.sendMessage(chatId, errorMsg, { parse_mode: 'HTML' });
      }
    }
    return;
  }

  // Model selection command (by number list)
  if (text === '/model') {
    try {
      const models = await fetchAgyModels();

      if (models.length === 0) {
        await bot.sendMessage(chatId, '⚠️ <b>No available models found.</b>', { parse_mode: 'HTML' });
        return;
      }

      saveSessionState(chatId, {
        waitingForModelSelect: true,
        modelsList: models
      });

      let modelText = '🤖 <b>Choose model for this conversation:</b>\n\n';
      models.forEach((m, index) => {
        modelText += `<b>${index + 1}.</b> ${m}\n`;
      });
      modelText += '\n👉 <i>Send the number (e.g., 1 or 2) or type <code>/model [number]</code> to select.</i>';

      await bot.sendMessage(chatId, modelText, { parse_mode: 'HTML' });
    } catch (err) {
      await bot.sendMessage(chatId, '❌ <b>Could not retrieve model list from agy-cli:</b>\n' + err.message, { parse_mode: 'HTML' });
    }
    return;
  }

  // Direct model select command
  if (text.startsWith('/model ')) {
    const modelNumStr = text.replace('/model ', '').trim();
    const modelIdx = parseInt(modelNumStr, 10);
    
    try {
      const models = await fetchAgyModels();

      if (models.length === 0) {
        await bot.sendMessage(chatId, '⚠️ <b>No available models found.</b>', { parse_mode: 'HTML' });
        return;
      }

      if (isNaN(modelIdx) || modelIdx < 1 || modelIdx > models.length) {
        await bot.sendMessage(chatId, `⚠️ Invalid number. Please select from 1 to ${models.length}.`, { parse_mode: 'HTML' });
        return;
      }

      const selectedModelName = models[modelIdx - 1];
      saveModel(chatId, selectedModelName);
      saveSessionState(chatId, null); // Clear waiting state

      await bot.sendMessage(chatId, `🤖 <b>Model selected:</b> <b>${selectedModelName}</b>`, { parse_mode: 'HTML' });
    } catch (err) {
      await bot.sendMessage(chatId, '❌ <b>Could not retrieve model list from agy-cli:</b>\n' + err.message, { parse_mode: 'HTML' });
    }
    return;
  }

  // Process agy request
  if (text.startsWith('/new')) {
    const prompt = text.replace('/new', '').trim();
    if (!prompt) {
      saveSession(chatId, null);
      await bot.sendMessage(chatId, '✅ <b>Context reset!</b>\nYour next message will start a completely new conversation. 🆕', { parse_mode: 'HTML' });
    } else {
      handleAgyExecution(bot, chatId, prompt, false);
    }
  } else if (text.startsWith('/resume')) {
    const prompt = text.replace('/resume', '').trim();
    if (!prompt) {
      const conversations = watcher.getAllConversations();
      if (conversations.length === 0) {
        await bot.sendMessage(chatId, '⚠️ No conversation found to resume.');
        return;
      }

      let listText = '📂 <b>Recent Conversations List:</b>\n\n';
      conversations.slice(0, 5).forEach((conv, index) => {
        const date = new Date(conv.mtime).toLocaleString('en-US');
        listText += `<b>${index + 1}.</b> <code>${conv.title}</code>\n   <i>(Updated: ${date})</i>\n\n`;
      });
      listText += `👉 Send: <code>/resume [number]</code> to select a conversation.\nOr: <code>/resume [number] [message]</code> to send a message directly.`;

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
        await bot.sendMessage(chatId, `⚠️ Number <b>${idx}</b> is invalid. Please select from 1 to ${conversations.length}.`, { parse_mode: 'HTML' });
        return;
      }
    }

    if (conversationId) {
      saveSession(chatId, conversationId);
      if (!actualPrompt) {
        await bot.sendMessage(chatId, `✅ Successfully switched to conversation:\n👉 <code>${conversationTitle}</code>\n\nYou can continue messaging now!`, { parse_mode: 'HTML' });
        return;
      }
    } else if (!actualPrompt) {
      await bot.sendMessage(chatId, `⚠️ Please enter a valid number. Example: <code>/resume 1</code>`, { parse_mode: 'HTML' });
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
    
    await bot.answerCallbackQuery(callbackQuery.id, `Switched to model: ${modelName}`);
    await bot.editMessageText(chatId, callbackQuery.message.message_id, `🤖 <b>Model selected:</b> <b>${modelName}</b>`, { parse_mode: 'HTML' });
  }
}

module.exports = {
  routeMessage,
  routeCallbackQuery
};
