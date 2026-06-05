const test = require('node:test');
const assert = require('node:assert');
const Telegram = require('../src/core/telegram');

let fetchCalls = [];
let fetchResponses = [];

const originalFetch = global.fetch;

test.before(() => {
  global.fetch = async (url, options) => {
    let parsedBody = {};
    if (options && options.body) {
      try {
        parsedBody = JSON.parse(options.body);
      } catch (e) {
        parsedBody = options.body;
      }
    }
    fetchCalls.push({
      url,
      options: parsedBody,
      method: options ? options.method : 'GET'
    });

    const nextResponse = fetchResponses.shift();
    if (!nextResponse) {
      return {
        ok: true,
        json: async () => ({ ok: true, result: {} })
      };
    }

    return {
      ok: nextResponse.ok !== false,
      json: async () => nextResponse.body
    };
  };
});

test.beforeEach(() => {
  fetchCalls = [];
  fetchResponses = [];
});

test.after(() => {
  global.fetch = originalFetch;
});

test('should throw error if token is not provided', () => {
  assert.throws(() => {
    new Telegram();
  }, /Telegram bot token is required/);
});

test('should initialize with correct API URL', () => {
  const bot = new Telegram('my-token');
  assert.strictEqual(bot.token, 'my-token');
  assert.strictEqual(bot.apiUrl, 'https://api.telegram.org/botmy-token');
});

test('should send message <= 4000 chars successfully using HTML', async () => {
  const bot = new Telegram('fake-token');
  fetchResponses.push({
    ok: true,
    body: { ok: true, result: { message_id: 123 } }
  });

  const res = await bot.sendMessage(12345, 'Hello <b>World</b>');
  
  assert.deepStrictEqual(res, { ok: true, result: { message_id: 123 } });
  assert.strictEqual(fetchCalls.length, 1);
  assert.strictEqual(fetchCalls[0].url, 'https://api.telegram.org/botfake-token/sendMessage');
  assert.deepStrictEqual(fetchCalls[0].options, {
    chat_id: 12345,
    text: 'Hello <b>World</b>',
    parse_mode: 'HTML'
  });
});

test('should fallback to plain text if HTML parsing fails', async () => {
  const bot = new Telegram('fake-token');
  fetchResponses.push(
    {
      ok: false,
      body: { ok: false, description: "Bad Request: can't parse entities" }
    },
    {
      ok: true,
      body: { ok: true, result: { message_id: 124 } }
    }
  );

  const res = await bot.sendMessage(12345, 'Hello <b>World</b> <i>Test</i> <code>Code</code>');
  
  assert.deepStrictEqual(res, { ok: true, result: { message_id: 124 } });
  assert.strictEqual(fetchCalls.length, 2);
  
  // First call
  assert.deepStrictEqual(fetchCalls[0].options, {
    chat_id: 12345,
    text: 'Hello <b>World</b> <i>Test</i> <code>Code</code>',
    parse_mode: 'HTML'
  });
  
  // Second call (fallback with stripped tags and no parse_mode)
  assert.deepStrictEqual(fetchCalls[1].options, {
    chat_id: 12345,
    text: 'Hello World Test Code'
  });
});

test('should split message into chunks if > 4000 characters', async () => {
  const bot = new Telegram('fake-token');
  const part1 = 'A'.repeat(4000);
  const part2 = 'B'.repeat(4000);
  const part3 = 'C'.repeat(500);
  const text = part1 + part2 + part3;

  fetchResponses.push(
    { ok: true, body: { ok: true, result: { message_id: 1 } } },
    { ok: true, body: { ok: true, result: { message_id: 2 } } },
    { ok: true, body: { ok: true, result: { message_id: 3 } } }
  );

  const res = await bot.sendMessage(12345, text);

  assert.deepStrictEqual(res, [
    { ok: true, result: { message_id: 1 } },
    { ok: true, result: { message_id: 2 } },
    { ok: true, result: { message_id: 3 } }
  ]);
  assert.strictEqual(fetchCalls.length, 3);
  assert.strictEqual(fetchCalls[0].options.text, part1);
  assert.strictEqual(fetchCalls[1].options.text, part2);
  assert.strictEqual(fetchCalls[2].options.text, part3);
});

test('should edit message successfully using HTML', async () => {
  const bot = new Telegram('fake-token');
  fetchResponses.push({
    ok: true,
    body: { ok: true, result: { message_id: 123 } }
  });

  const res = await bot.editMessageText(12345, 999, 'New Text');
  assert.deepStrictEqual(res, { ok: true, result: { message_id: 123 } });
  assert.strictEqual(fetchCalls.length, 1);
  assert.deepStrictEqual(fetchCalls[0].options, {
    chat_id: 12345,
    message_id: 999,
    text: 'New Text',
    parse_mode: 'HTML'
  });
});

test('should edit message fallback if HTML parsing fails', async () => {
  const bot = new Telegram('fake-token');
  fetchResponses.push(
    { ok: false, body: { ok: false, description: 'HTML error' } },
    { ok: true, body: { ok: true, result: { message_id: 123 } } }
  );

  const res = await bot.editMessageText(12345, 999, 'New <b>Text</b>');
  assert.deepStrictEqual(res, { ok: true, result: { message_id: 123 } });
  assert.strictEqual(fetchCalls.length, 2);
  assert.deepStrictEqual(fetchCalls[0].options, {
    chat_id: 12345,
    message_id: 999,
    text: 'New <b>Text</b>',
    parse_mode: 'HTML'
  });
  assert.deepStrictEqual(fetchCalls[1].options, {
    chat_id: 12345,
    message_id: 999,
    text: 'New Text'
  });
});

test('should delete message successfully', async () => {
  const bot = new Telegram('fake-token');
  fetchResponses.push({ ok: true, body: { ok: true, result: true } });

  const res = await bot.deleteMessage(12345, 999);
  assert.deepStrictEqual(res, { ok: true, result: true });
  assert.strictEqual(fetchCalls.length, 1);
  assert.strictEqual(fetchCalls[0].url, 'https://api.telegram.org/botfake-token/deleteMessage');
  assert.deepStrictEqual(fetchCalls[0].options, {
    chat_id: 12345,
    message_id: 999
  });
});

test('should send chat action successfully', async () => {
  const bot = new Telegram('fake-token');
  fetchResponses.push({ ok: true, body: { ok: true, result: true } });

  const res = await bot.sendChatAction(12345, 'typing');
  assert.deepStrictEqual(res, { ok: true, result: true });
  assert.strictEqual(fetchCalls.length, 1);
  assert.strictEqual(fetchCalls[0].url, 'https://api.telegram.org/botfake-token/sendChatAction');
  assert.deepStrictEqual(fetchCalls[0].options, {
    chat_id: 12345,
    action: 'typing'
  });
});

test('should get updates with options', async () => {
  const bot = new Telegram('fake-token');
  fetchResponses.push({ ok: true, body: { ok: true, result: [] } });

  const res = await bot.getUpdates({ limit: 10, offset: 5, timeout: 30 });
  assert.deepStrictEqual(res, { ok: true, result: [] });
  assert.strictEqual(fetchCalls.length, 1);
  assert.strictEqual(fetchCalls[0].url, 'https://api.telegram.org/botfake-token/getUpdates');
  assert.deepStrictEqual(fetchCalls[0].options, {
    limit: 10,
    offset: 5,
    timeout: 30
  });
});

test('should clear old updates by finding latest update_id and setting offset', async () => {
  const bot = new Telegram('fake-token');
  fetchResponses.push(
    {
      ok: true,
      body: {
        ok: true,
        result: [
          { update_id: 100, message: { text: 'hi' } },
          { update_id: 101, message: { text: 'hello' } }
        ]
      }
    },
    {
      ok: true,
      body: { ok: true, result: [] }
    }
  );

  const nextOffset = await bot.clearOldUpdates();
  assert.strictEqual(nextOffset, 102);
  assert.strictEqual(fetchCalls.length, 2);
  assert.deepStrictEqual(fetchCalls[0].options, { limit: 100 });
  assert.deepStrictEqual(fetchCalls[1].options, { offset: 102, limit: 1 });
});

test('should return 0 from clearOldUpdates if no updates are pending', async () => {
  const bot = new Telegram('fake-token');
  fetchResponses.push({
    ok: true,
    body: { ok: true, result: [] }
  });

  const nextOffset = await bot.clearOldUpdates();
  assert.strictEqual(nextOffset, 0);
  assert.strictEqual(fetchCalls.length, 1);
  assert.deepStrictEqual(fetchCalls[0].options, { limit: 100 });
});
