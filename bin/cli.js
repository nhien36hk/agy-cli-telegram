#!/usr/bin/env node
const path = require('path');
const updater = require('../src/utils/updater');

const args = process.argv.slice(2);

// Handle 'update' command directly
if (args[0] === 'update') {
  console.log('🔄 Đang kiểm tra bản cập nhật...');
  updater.checkUpdateAvailable().then(async (info) => {
    if (!info.available) {
      console.log(`✅ Bạn đang dùng phiên bản mới nhất (${info.localVersion}).`);
      process.exit(0);
    }
    console.log(`⚠️ Phát hiện bản mới! Local: ${info.localVersion} | Remote: ${info.remoteVersion}`);
    console.log('🔄 Đang kéo mã nguồn mới và cài đặt...');
    const result = await updater.performUpdate();
    if (result.success) {
      console.log('🎉 Cập nhật thành công! Vui lòng khởi động lại Bot (ví dụ: pm2 restart agy-tele).');
    } else {
      console.error('❌ Cập nhật thất bại:', result.error);
    }
    process.exit(0);
  });
} else {
  // Ensure the bot runs via the refactored core
  require('../src/core/bot.js');
}
