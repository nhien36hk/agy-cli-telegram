#!/usr/bin/env node
const path = require('path');
const updater = require('../src/utils/updater');

const args = process.argv.slice(2);

// Handle 'update' command directly
if (args[0] === 'update') {
  console.log('🔄 Checking for updates...');
  updater.checkUpdateAvailable().then(async (info) => {
    if (!info.available) {
      console.log(`✅ You are using the latest version (${info.localVersion}).`);
      process.exit(0);
    }
    console.log(`⚠️ New version detected! Local: ${info.localVersion} | Remote: ${info.remoteVersion}`);
    console.log('🔄 Pulling new source code and installing...');
    const result = await updater.performUpdate();
    if (result.success) {
      console.log('🎉 Update successful! Please restart the Bot (e.g., pm2 restart agy-tele).');
    } else {
      console.error('❌ Update failed:', result.error);
    }
    process.exit(0);
  });
} else {
  // Ensure the bot runs via the refactored core
  require('../src/core/bot.js');
}
