const { splitMessageHtml } = require('../utils/parser');
const maxLength = 4000;

class Telegram {
  /**
   * @param {string} token - Telegram Bot API Token
   */
  constructor(token) {
    if (!token) {
      throw new Error('Telegram bot token is required');
    }
    this.token = token;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  /**
   * Helper to perform a POST request to Telegram API.
   * @param {string} method - API method (e.g., 'sendMessage')
   * @param {object} payload - Request body payload
   * @returns {Promise<object>} Parsed JSON response
   */
  async _post(method, payload) {
    const response = await fetch(`${this.apiUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return await response.json();
  }

  /**
   * Sends a single message block. If HTML parsing fails, retries with fallback.
   * @param {string|number} chatId
   * @param {string} text
   * @returns {Promise<object>} Telegram API response
   */
  async _sendSingleMessage(chatId, text) {
    let res = await this._post('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });

    if (!res.ok) {
      // Fallback: strip HTML tags and resend without parse_mode
      const fallbackText = text.replace(/<[^>]*>/g, '');
      res = await this._post('sendMessage', {
        chat_id: chatId,
        text: fallbackText
      });
    }
    return res;
  }

  /**
   * Sends a message, automatically splitting it into chunks if it exceeds 4000 characters.
   * @param {string|number} chatId
   * @param {string} text
   * @returns {Promise<object|object[]>} Telegram API response or array of responses if split
   */
  async sendMessage(chatId, text) {
    if (typeof text !== 'string') {
      text = String(text);
    }

    if (text.length <= maxLength) {
      return this._sendSingleMessage(chatId, text);
    }

    const chunks = splitMessageHtml(text, maxLength);

    const results = [];
    for (const chunk of chunks) {
      const res = await this._sendSingleMessage(chatId, chunk);
      results.push(res);
    }
    return results;
  }

  /**
   * Edits an existing message's text. If HTML parsing fails, retries with fallback.
   * @param {string|number} chatId
   * @param {number} messageId
   * @param {string} text
   * @returns {Promise<object>} Telegram API response
   */
  async editMessageText(chatId, messageId, text) {
    if (typeof text !== 'string') {
      text = String(text);
    }

    let res = await this._post('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    });

    if (!res.ok) {
      // Fallback: strip HTML tags and resend without parse_mode
      const fallbackText = text.replace(/<[^>]*>/g, '');
      res = await this._post('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: fallbackText
      });
    }
    return res;
  }

  /**
   * Deletes a message.
   * @param {string|number} chatId
   * @param {number} messageId
   * @returns {Promise<object>} Telegram API response
   */
  async deleteMessage(chatId, messageId) {
    return this._post('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  /**
   * Sends a chat action (e.g., 'typing').
   * @param {string|number} chatId
   * @param {string} action
   * @returns {Promise<object>} Telegram API response
   */
  async sendChatAction(chatId, action) {
    return this._post('sendChatAction', {
      chat_id: chatId,
      action: action
    });
  }

  /**
   * Gets updates from the Telegram Bot API.
   * @param {object} [options] - Optional parameters like limit, offset, timeout
   * @returns {Promise<object>} Telegram API response
   */
  async getUpdates(options = {}) {
    return this._post('getUpdates', options);
  }

  /**
   * Clears old updates at startup.
   * @returns {Promise<number>} The new offset configured
   */
  async clearOldUpdates() {
    const response = await this.getUpdates({ limit: 100 });
    if (response && response.ok && response.result && response.result.length > 0) {
      const latestUpdateId = response.result[response.result.length - 1].update_id;
      const nextOffset = latestUpdateId + 1;
      await this.getUpdates({ offset: nextOffset, limit: 1 });
      return nextOffset;
    }
    return 0;
  }
}

module.exports = Telegram;
