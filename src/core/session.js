const fs = require('fs');
const path = require('path');

const sessionFile = path.resolve(__dirname, 'sessions.json');

function getSession(chatId) {
  try {
    if (fs.existsSync(sessionFile)) {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      return data[chatId] || null;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function saveSession(chatId, conversationId) {
  try {
    let data = {};
    if (fs.existsSync(sessionFile)) {
      try {
        data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      } catch (parseErr) {
        data = {};
      }
    }
    data[chatId] = conversationId;
    fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving session:', e.message);
  }
}

module.exports = {
  getSession,
  saveSession
};
