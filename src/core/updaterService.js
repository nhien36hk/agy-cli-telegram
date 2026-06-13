const updater = require('../utils/updater');
const config = require('../config/loader');

let lastCheckTime = Date.now();
let lastNotifiedVersion = null;

/**
 * Checks for updates in a lazy, non-blocking way with a 24-hour cooldown.
 * Triggered on incoming user messages.
 *
 * @param {object} bot - Telegram bot instance to send notifications.
 */
async function lazyCheckUpdate(bot) {
  const now = Date.now();
  const cooldown = 24 * 60 * 60 * 1000; // 24 hours
  if (now - lastCheckTime < cooldown) {
    return;
  }

  // Throttle immediately to prevent concurrent calls
  lastCheckTime = now;

  try {
    const updateInfo = await updater.checkUpdateAvailable();
    if (updateInfo.available && updateInfo.remoteVersion !== lastNotifiedVersion) {
      lastNotifiedVersion = updateInfo.remoteVersion;
      if (config.allowedUserIds && config.allowedUserIds.length > 0) {
        const adminId = config.allowedUserIds[0];
        await bot.sendMessage(
          adminId,
          `🚀 <b>[UPDATE ALERT]</b> A new update is available on GitHub!\nCurrent version: <code>${updateInfo.localVersion}</code>\nLatest version: <code>${updateInfo.remoteVersion}</code>\n\n👉 Please type /update to automatically update and restart!`,
          { parse_mode: 'HTML' }
        );
      }
    }
  } catch (err) {
    console.error('[UpdaterService] Error in lazy update check:', err.message);
  }
}

/**
 * Checks for updates on bot startup and alerts the admin.
 *
 * @param {object} bot - Telegram bot instance to send notifications.
 */
async function notifyStartupUpdate(bot) {
  try {
    const updateInfo = await updater.checkUpdateAvailable();
    if (updateInfo.available) {
      console.log(`\n🚀 [UPDATE ALERT] A new update is available on GitHub (Remote: ${updateInfo.remoteVersion}).`);
      console.log(`Please type /update on Telegram or run 'git pull' to update!\n`);
      if (config.allowedUserIds && config.allowedUserIds.length > 0) {
        const adminId = config.allowedUserIds[0];
        lastNotifiedVersion = updateInfo.remoteVersion;
        await bot.sendMessage(
          adminId,
          `🚀 <b>[UPDATE ALERT]</b> A new update is available on GitHub!\nCurrent version: <code>${updateInfo.localVersion}</code>\nLatest version: <code>${updateInfo.remoteVersion}</code>\n\n👉 Please type /update to automatically update and restart!`,
          { parse_mode: 'HTML' }
        );
      }
    }
  } catch (err) {
    console.error('[UpdaterService] Error in startup update check:', err.message);
  }
}

module.exports = {
  lazyCheckUpdate,
  notifyStartupUpdate,
  getLastCheckTime: () => lastCheckTime,
  setLastCheckTime: (t) => { lastCheckTime = t; },
  getLastNotifiedVersion: () => lastNotifiedVersion,
  setLastNotifiedVersion: (v) => { lastNotifiedVersion = v; }
};
