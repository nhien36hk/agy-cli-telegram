#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const { execSync } = require('child_process');

console.log('    ___                   ______     __');
console.log('   /   | ____ ___  __    /_  __/__  / /__  ____ __________ _____ ___ ');
console.log('  / /| |/ __ \`/ / / /_____/ / / _ \\/ / _ \\/ __ \`/ ___/ __ \`/ __ \`__ \\');
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
  console.log('🤖 STEP 1: GET TELEGRAM BOT TOKEN');
  console.log('1. Open the Telegram app and search for @BotFather');
  console.log('2. Message /newbot to create a new bot (or select an existing one)');
  console.log('3. Copy the provided Token code (e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)');
  console.log('----------------------------------------');

  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: '🔑 Enter your Telegram Bot Token:',
      mask: '*',
      validate: input => input.length > 10 ? true : 'Invalid Token. Please try again.'
    }
  ]);

  console.log('\n----------------------------------------');
  console.log('👤 STEP 2: GET YOUR USER ID');
  console.log('1. Search for @userinfobot on Telegram');
  console.log('2. Press the Start button or send any message');
  console.log('3. Copy your User ID (e.g. 123456789)');
  console.log('----------------------------------------');

  const { allowedUserIds } = await inquirer.prompt([
    {
      type: 'input',
      name: 'allowedUserIds',
      message: '🛡️ Enter Telegram User ID (you can enter multiple IDs, separated by commas):',
      validate: input => {
        const ids = input.split(',').map(id => id.trim()).filter(id => id.length > 0);
        if (ids.length === 0) return 'Please enter at least one User ID.';
        if (ids.some(id => isNaN(Number(id)))) return 'User ID must contain digits only.';
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
