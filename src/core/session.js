const fs = require('fs');
const path = require('path');

const sessionFile = path.resolve(__dirname, 'sessions.json');
const modelsFile = path.resolve(__dirname, 'models.json');

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

function getModel(chatId) {
  try {
    if (fs.existsSync(modelsFile)) {
      const data = JSON.parse(fs.readFileSync(modelsFile, 'utf8'));
      return data[chatId] || null;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function saveModel(chatId, modelName) {
  try {
    let data = {};
    if (fs.existsSync(modelsFile)) {
      try {
        data = JSON.parse(fs.readFileSync(modelsFile, 'utf8'));
      } catch (parseErr) {
        data = {};
      }
    }
    data[chatId] = modelName;
    fs.writeFileSync(modelsFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving model:', e.message);
  }
}

const states = {};

function getSessionState(chatId) {
  return states[chatId] || null;
}

function saveSessionState(chatId, state) {
  if (state === null) {
    delete states[chatId];
  } else {
    states[chatId] = state;
  }
}

module.exports = {
  getSession,
  saveSession,
  getModel,
  saveModel,
  getSessionState,
  saveSessionState
};

