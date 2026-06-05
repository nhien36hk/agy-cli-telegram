#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const { execSync } = require('child_process');

console.log('\n========================================');
console.log('🚀 Antigravity Telegram Bot Setup');
console.log('========================================\n');

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

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Enter your Telegram Bot Token:',
      mask: '*',
      validate: input => input.length > 10 ? true : 'Please enter a valid token.'
    },
    {
      type: 'input',
      name: 'allowedUserIds',
      message: 'Enter your Allowed Telegram User IDs (comma separated):',
      validate: input => {
        const ids = input.split(',').map(id => id.trim()).filter(id => id.length > 0);
        if (ids.length === 0) return 'Please enter at least one User ID.';
        if (ids.some(id => isNaN(Number(id)))) return 'User IDs must be numbers.';
        return true;
      }
    }
  ]);

  const userIds = answers.allowedUserIds
    .split(',')
    .map(id => Number(id.trim()))
    .filter(id => !isNaN(id));

  const config = {
    token: answers.token.trim(),
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
