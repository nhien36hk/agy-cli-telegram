const test = require('node:test');
const assert = require('node:assert');
const { toTelegramHtml, parseStdout, formatProgressHtml } = require('../src/parser');

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
