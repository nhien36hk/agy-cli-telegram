const test = require('node:test');
const assert = require('node:assert');
const { toTelegramHtml, parseStdout, formatProgressHtml, splitMessageHtml } = require('../src/parser');

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

test('formatProgressHtml', async (t) => {
  await t.test('formats progress checklist', () => {
    const steps = ['I will start project', 'Reading files'];
    const activeStdout = 'Hello world';
    const html = formatProgressHtml(steps, activeStdout);
    
    assert.match(html, /⚡ <b>Antigravity CLI đang xử lý\.\.\.<\/b>/);
    assert.match(html, /🔍 <b>Tiến trình thực hiện:<\/b>/);
    assert.match(html, /✅ I will start project/);
    assert.match(html, /🔄 Reading files/);
    assert.match(html, /✍️ <b>Kết quả hiện tại:<\/b>\nHello world/);
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
