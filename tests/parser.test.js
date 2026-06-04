const test = require('node:test');
const assert = require('node:assert');
const { toTelegramHtml, parseStdout, formatProgressHtml, splitMessageHtml, translateStepToVietnamese, extractNewTurnOutput, stripAnsi } = require('../src/parser');

test('toTelegramHtml', async (t) => {
  await t.test('escapes HTML special characters', () => {
    const raw = 'Hello <World> & "Test"';
    const html = toTelegramHtml(raw);
    assert.strictEqual(html, 'Hello &lt;World&gt; &amp; "Test"');
  });

  await t.test('translates bold and italic', () => {
    const raw = 'This is **bold** and *italic* and _underscore italic_';
    const html = toTelegramHtml(raw);
    assert.strictEqual(html, 'This is <b>bold</b> and <i>italic</i> and <i>underscore italic</i>');
  });

  await t.test('converts headers to bold', () => {
    const raw = '### My Section Header';
    const html = toTelegramHtml(raw);
    assert.strictEqual(html, '<b>My Section Header</b>');
  });

  await t.test('translates inline code and block code', () => {
    const raw = 'Run `npm test` or: \n```js\nconsole.log("hello");\n```';
    const html = toTelegramHtml(raw);
    assert.strictEqual(html, 'Run <code>npm test</code> or: \n<pre>console.log("hello");\n</pre>');
  });

  await t.test('converts local file:/// links into clean indicators', () => {
    const raw = 'Saved to [proposal](file:///home/nhien36hk/workspace/proposal.md)';
    const html = toTelegramHtml(raw);
    assert.strictEqual(html, 'Saved to 📄 <b>proposal</b> (<code>~/workspace/proposal.md</code>)');
  });

  await t.test('converts standard http links', () => {
    const raw = 'Visit [google](https://google.com) now';
    const html = toTelegramHtml(raw);
    assert.strictEqual(html, 'Visit <a href="https://google.com">google</a> now');
  });

  await t.test('prevents double-escaping of existing HTML entities', () => {
    const raw = 'Step1["1. Code Extraction &amp; Parse&lt;br/&gt;"]';
    const html = toTelegramHtml(raw);
    assert.strictEqual(html, 'Step1["1. Code Extraction &amp; Parse&lt;br/&gt;"]');
  });
});

test('parseStdout', async (t) => {
  await t.test('separates thinking steps from main responses', () => {
    const stdout = 
      'I will read config.json first\n' +
      'Reading gnn_vul_detection_report.md\n' +
      'Hello user, the proposal has been generated.\n' +
      'Check out the methods section below.';
      
    const { steps, response } = parseStdout(stdout);
    
    assert.deepStrictEqual(steps, [
      'I will read config.json first',
      'Reading gnn_vul_detection_report.md'
    ]);
    assert.strictEqual(
      response,
      'Hello user, the proposal has been generated.\nCheck out the methods section below.'
    );
  });
});

test('translateStepToVietnamese', async (t) => {
  await t.test('translates listings', () => {
    assert.strictEqual(translateStepToVietnamese('I will start by listing the contents of workspace'), '📁 Liệt kê các tệp tin trong thư mục');
  });

  await t.test('translates run commands', () => {
    assert.strictEqual(translateStepToVietnamese('I will run the command `node --test` now'), '💻 Chạy lệnh: <code>node --test</code>');
  });

  await t.test('translates file reads', () => {
    assert.strictEqual(translateStepToVietnamese('I will read file gnn_vul_detection_report.md'), '🔍 Đọc nội dung tệp: <code>gnn_vul_detection_report.md</code>');
  });
});

test('formatProgressHtml', async (t) => {
  await t.test('formats progress checklist and terminal preview', () => {
    const steps = ['I will start project', 'Reading file.js'];
    const activeStdout = 'Line 1\nLine 2\nLine 3';
    const html = formatProgressHtml(steps, activeStdout);
    
    assert.match(html, /⚡ <b>Antigravity CLI đang xử lý\.\.\.<\/b>/);
    assert.match(html, /🔍 <b>Tiến trình thực hiện:<\/b>/);
    assert.match(html, /✅ I will start project/);
    assert.match(html, /⏳ <b>Đang thực hiện:<\/b> 🔍 Đọc nội dung tệp: <code>file\.js<\/code>/);
    assert.match(html, /💻 <b>Terminal Console:<\/b>\n<pre>Line 1\nLine 2\nLine 3<\/pre>/);
  });
});

test('splitMessageHtml', async (t) => {
  await t.test('splits simple message without tags', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const chunks = splitMessageHtml(text, 15);
    assert.deepStrictEqual(chunks, [
      'Line 1\nLine 2',
      'Line 3'
    ]);
  });

  await t.test('splits message and closes/reopens open HTML tags', () => {
    const text = '<b>This is line one\nThis is line two\nThis is line three</b>';
    const chunks = splitMessageHtml(text, 50);
    assert.deepStrictEqual(chunks, [
      '<b>This is line one\nThis is line two</b>',
      '<b>This is line three</b>'
    ]);
  });

  await t.test('splits complex nested tags', () => {
    const text = '<pre><b>This is the first line\nThis is the second line\nThis is the third line</b></pre>';
    const chunks = splitMessageHtml(text, 80);
    assert.deepStrictEqual(chunks, [
      '<pre><b>This is the first line\nThis is the second line</b></pre>',
      '<pre><b>This is the third line</b></pre>'
    ]);
  });
});

test('extractNewTurnOutput', async (t) => {
  await t.test('extracts correct turn from history', () => {
    const history =
      'Initial start log\n' +
      '────────────────────────────────────────────────────────────\n' +
      '> first prompt\n' +
      'First response text here\n' +
      '────────────────────────────────────────────────────────────\n' +
      '> current prompt\n' +
      'Thinking process steps\n' +
      'The actual second response body\n' +
      '────────────────────────────────────────────────────────────\n' +
      '> ';
      
    const result = extractNewTurnOutput(history, 'current prompt');
    assert.strictEqual(
      result,
      'Thinking process steps\nThe actual second response body'
    );
  });

  await t.test('falls back to whole text if prompt is not found', () => {
    const text = 'Some raw stdout without separators';
    const result = extractNewTurnOutput(text, 'non-existent');
    assert.strictEqual(result, text);
  });
});

test('stripAnsi', async (t) => {
  await t.test('removes color and formatting codes', () => {
    const raw = '\u001b[31mRed Text\u001b[0m and \u001b[4mUnderlined\u001b[24m';
    assert.strictEqual(stripAnsi(raw), 'Red Text and Underlined');
  });

  await t.test('removes carriage returns', () => {
    const raw = 'Line 1\r\nLine 2\r';
    assert.strictEqual(stripAnsi(raw), 'Line 1\nLine 2');
  });

  await t.test('extracts turns and parses steps correctly even when ANSI codes are present', () => {
    const history = 
      '\u001b[1mInitial log\u001b[0m\n' +
      '────────────────────────────────────────────────────────────\n' +
      '> \u001b[32mmy prompt\u001b[0m\n' +
      'I will run the command `npm test`\n' +
      'Response body with \u001b[34mcolor\u001b[0m\n' +
      '────────────────────────────────────────────────────────────\n' +
      '> ';

    const turnOutput = extractNewTurnOutput(history, 'my prompt');
    assert.strictEqual(
      turnOutput,
      'I will run the command `npm test`\nResponse body with color'
    );

    const { steps, response } = parseStdout(turnOutput);
    assert.deepStrictEqual(steps, ['I will run the command `npm test`']);
    assert.strictEqual(response, 'Response body with color');
  });
});
