#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const { execSync } = require('child_process');

console.log('    ___                   ______     __');
console.log('   /   | ____ ___  __    /_  __/__  / /__  ____ __________ _____ ___ ');
console.log('  / /| |/ __ `/ / / /_____/ / / _ \\/ / _ \\/ __ `/ ___/ __ `/ __ `__ \\');
console.log(' / ___ / /_/ / /_/ /_____/ / /  __/ /  __/ /_/ / /  / /_/ / / / / / /');
console.log('/_/  |_\\__, /\\__, /     /_/  \\___/_/\\___/\\__, /_/   \\__,_/_/ /_/ /_/ ');
console.log('      /____//____/                      /____/                       ');
console.log('');

async function runSetup() {
  const configPath = path.resolve(__dirname, '../config.json');

  if (fs.existsSync(configPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'A config.json file already exists. Do you want to overwrite it?',
        default: false
      }
    ]);
    if (!overwrite) {
      console.log('Skipping configuration setup.');
      console.log('🔗 Setting up global CLI commands...');
      try {
        execSync('npm link', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
        console.log('\n🎉 Setup Complete!');
      } catch (e) {}
      return;
    }
  }

  console.log('\n----------------------------------------');
  console.log('🤖 BƯỚC 1: LẤY TELEGRAM BOT TOKEN');
  console.log('1. Mở ứng dụng Telegram và tìm kiếm @BotFather');
  console.log('2. Nhắn tin /newbot để tạo bot mới (hoặc chọn bot đã có)');
  console.log('3. Copy đoạn mã Token được cấp (VD: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)');
  console.log('----------------------------------------');

  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: '🔑 Nhập Telegram Bot Token của bạn:',
      mask: '*',
      validate: input => input.length > 10 ? true : 'Token không hợp lệ. Vui lòng nhập lại.'
    }
  ]);

  console.log('\n----------------------------------------');
  console.log('👤 BƯỚC 2: LẤY USER ID CỦA BẠN');
  console.log('1. Tìm kiếm @userinfobot trên Telegram');
  console.log('2. Nhấn nút Bắt đầu (Start) hoặc gửi tin nhắn bất kỳ');
  console.log('3. Copy dãy số Id của bạn (VD: 123456789)');
  console.log('----------------------------------------');

  const { allowedUserIds } = await inquirer.prompt([
    {
      type: 'input',
      name: 'allowedUserIds',
      message: '🛡️ Nhập Telegram User ID (có thể nhập nhiều ID, cách nhau bằng dấu phẩy):',
      validate: input => {
        const ids = input.split(',').map(id => id.trim()).filter(id => id.length > 0);
        if (ids.length === 0) return 'Vui lòng nhập ít nhất một User ID.';
        if (ids.some(id => isNaN(Number(id)))) return 'User ID chỉ được bao gồm các chữ số.';
        return true;
      }
    }
  ]);

  const userIds = allowedUserIds
    .split(',')
    .map(id => Number(id.trim()))
    .filter(id => !isNaN(id));

  const config = {
    token: token.trim(),
    allowedUserIds: userIds
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log('\n✅ Configuration saved to config.json');

  console.log('🔗 Setting up global CLI commands...');
  try {
    execSync('npm link', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log('\n🎉 Setup Complete!');
    console.log('You can now run the bot from anywhere by typing: agy-tele');
  } catch (error) {
    console.error('\n❌ Failed to run npm link. You may need administrator/root privileges, or you can run "npm link" manually.');
  }
}

runSetup();
