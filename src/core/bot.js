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
            console.warn(`Warning: Received callback query from unknown UserID (${userId})`);
            await bot.answerCallbackQuery(callbackQuery.id, '🚷 You do not have permission to perform this action.');
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
          console.warn(`Warning: Received message from unknown UserID (${userId}): ${text}`);
          await bot.sendMessage(chatId, '🚷 You do not have permission to control this Bot.');
          continue;
        }

        // Delegate to router
        await routeMessage(bot, text, chatId, userId);
      }
    }
  } catch (err) {
    console.error('Error in polling loop:', err.message);
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
      console.error(`❌ CRITICAL ERROR: Port ${port} is already in use!`);
      console.error('Another Telegram bot process is running in the background on this machine.');
      console.error('To avoid message duplication (2 inputs/outputs), this process will self-exit.');
      console.error('Please run `pm2 restart agy-tele` or terminate the old processes.');
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
  console.log('💬 Listening for messages from Telegram...');
  console.log('========================================');

  // Register bot commands
  try {
    await bot.setMyCommands([
      { command: 'new', description: 'Start a new conversation (Reset Context)' },
      { command: 'resume', description: 'Continue the current conversation (Default)' },
      { command: 'goal', description: 'Run multi-step automated task (multi-turn goal)' },
      { command: 'model', description: 'Choose AI model to use' },
      { command: 'usage', description: 'View usage, version, and current model' },
      { command: 'status', description: 'Check server status' },
      { command: 'update', description: 'Update Bot to the latest version' },
      { command: 'help', description: 'View user guide' }
    ]);
    console.log('✅ Registered Command Menu (/, /new, /resume, /goal, /model, /usage, /update) with Telegram.');
  } catch (err) {
    console.error('⚠️ Could not register Command Menu:', err.message);
  }

  console.log('Resetting webhook status...');
  try {
    await bot.deleteWebhook();
    console.log('✅ Webhook deleted or not active.');
  } catch (err) {
    console.error('⚠️ Warning: Could not delete webhook:', err.message);
  }

  console.log('Checking and skipping old messages in the queue...');

  try {
    const nextOffset = await bot.clearOldUpdates();
    if (nextOffset > 0) {
      updateOffset = nextOffset;
      console.log(`Skipped old messages. Next offset: ${updateOffset}`);
    } else {
      console.log('No old messages to skip.');
    }
  } catch (err) {
    console.error('Error clearing old messages:', err.message);
  }

  // Automatically check for updates on startup (Non-blocking)
  updater.checkUpdateAvailable().then((updateInfo) => {
    if (updateInfo.available) {
      console.log(`\n🚀 [UPDATE ALERT] A new update is available on GitHub (Remote: ${updateInfo.remoteVersion}).`);
      console.log(`Please type /update on Telegram or run 'git pull' to update!\n`);
      if (config.allowedUserIds && config.allowedUserIds.length > 0) {
        const adminId = config.allowedUserIds[0];
        bot.sendMessage(adminId, `🚀 <b>[UPDATE ALERT]</b> A new update is available on GitHub!\nCurrent version: <code>${updateInfo.localVersion}</code>\nLatest version: <code>${updateInfo.remoteVersion}</code>\n\n👉 Please type /update to automatically update and restart!`, { parse_mode: 'HTML' }).catch(err => {
          console.error('Failed to send update notification via Telegram:', err.message);
        });
      }
    }
  }).catch((err) => {
    console.error('Error in background update check:', err.message);
  });

  // Begin polling
  pollUpdates();
}

start();
