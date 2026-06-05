const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', '.agy_history_cache.txt');

/**
 * Retrieves the previously saved full history text.
 * @returns {string} The cached history string.
 */
function getCachedHistory() {
  try {
    return fs.readFileSync(CACHE_FILE, 'utf8');
  } catch (err) {
    return '';
  }
}

/**
 * Saves the given full stdout history to cache for prefix matching in the next turn.
 * @param {string} historyText The full history string without ANSI codes.
 */
function saveCachedHistory(historyText) {
  try {
    fs.writeFileSync(CACHE_FILE, historyText, 'utf8');
  } catch (err) {
    console.error('Lỗi khi lưu lịch sử:', err.message);
  }
}

/**
 * Clears the cached history. Useful when starting a new conversation.
 */
function clearCachedHistory() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  } catch (err) {}
}

module.exports = {
  getCachedHistory,
  saveCachedHistory,
  clearCachedHistory
};
