const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const watcher = require('../src/core/watcher');
const { handleAgyExecution } = require('../src/core/executor');
const child_process = require('child_process');
const { Readable } = require('stream');
const { EventEmitter } = require('events');

test('Queue & Watcher Filtering Tests', async (t) => {
  const tempBrainDir = path.resolve(__dirname, 'temp_brain');
  const originalBrainDir = watcher.brainDir;

  t.before(() => {
    if (fs.existsSync(tempBrainDir)) {
      fs.rmSync(tempBrainDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempBrainDir, { recursive: true });
    watcher.brainDir = tempBrainDir;
  });

  t.after(() => {
    watcher.brainDir = originalBrainDir;
    if (fs.existsSync(tempBrainDir)) {
      fs.rmSync(tempBrainDir, { recursive: true, force: true });
    }
  });

  await t.test('getUserInputCount and getCurrentActiveTool with minUserInputCount', () => {
    const convId = 'test-conv-123';
    const convDir = path.join(tempBrainDir, convId);
    const logsDir = path.join(convDir, '.system_generated', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    const logPath = path.join(logsDir, 'transcript.jsonl');

    // Initially count should be 0
    assert.strictEqual(watcher.getUserInputCount(convId), 0);
    assert.strictEqual(watcher.getCurrentActiveTool(convId, 1), null);

    // Write one USER_INPUT
    fs.writeFileSync(logPath, JSON.stringify({ type: 'USER_INPUT', content: 'hello' }) + '\n');
    assert.strictEqual(watcher.getUserInputCount(convId), 1);

    // Write a PLANNER_RESPONSE with a tool call
    fs.appendFileSync(logPath, JSON.stringify({
      type: 'PLANNER_RESPONSE',
      tool_calls: [{ name: 'run_command', args: { CommandLine: 'ls' } }]
    }) + '\n');

    const tool = watcher.getCurrentActiveTool(convId, 1);
    assert.match(tool, /Bash/);

    // If minUserInputCount is 2, it should return null
    assert.strictEqual(watcher.getCurrentActiveTool(convId, 2), null);

    // Append second USER_INPUT
    fs.appendFileSync(logPath, JSON.stringify({ type: 'USER_INPUT', content: 'next' }) + '\n');
    assert.strictEqual(watcher.getUserInputCount(convId), 2);

    // Now minUserInputCount = 2 is met, but no new tool call is added yet.
    assert.strictEqual(watcher.getCurrentActiveTool(convId, 2), null);

    // Write new tool call for turn 2
    fs.appendFileSync(logPath, JSON.stringify({
      type: 'PLANNER_RESPONSE',
      tool_calls: [{ name: 'view_file', args: { AbsolutePath: '/foo/bar.txt' } }]
    }) + '\n');

    const tool2 = watcher.getCurrentActiveTool(convId, 2);
    assert.match(tool2, /Read/);
  });

  await t.test('handleAgyExecution queues multiple consecutive calls and runs them sequentially', async (t) => {
    const sentMessages = [];
    const mockBot = {
      sendMessage: async (chatId, text, options) => {
        sentMessages.push({ chatId, text, options });
        return { ok: true, result: { message_id: 123 } };
      },
      editMessageText: async (chatId, messageId, text, options) => {
        return { ok: true, result: { message_id: messageId } };
      },
      deleteMessage: async (chatId, messageId) => {
        return { ok: true };
      },
      sendChatAction: async (chatId, action) => {
        return { ok: true };
      }
    };

    let executionCount = 0;
    const executionOrder = [];

    // Mock child_process.spawn to delay and verify sequential execution
    t.mock.method(child_process, 'spawn', (command, args) => {
      executionCount++;
      const currentIdx = executionCount;
      executionOrder.push(`start-${currentIdx}`);

      const mockProcess = new EventEmitter();
      mockProcess.stdin = { end: () => {} };
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });

      // Simulate some delay to check queueing
      setTimeout(() => {
        executionOrder.push(`end-${currentIdx}`);
        mockProcess.stdout.push(null);
        mockProcess.emit('close', 0);
      }, 50);

      return mockProcess;
    });

    // Send 3 executions immediately
    const p1 = handleAgyExecution(mockBot, 99999, 'Prompt 1', false);
    const p2 = handleAgyExecution(mockBot, 99999, 'Prompt 2', false);
    const p3 = handleAgyExecution(mockBot, 99999, 'Prompt 3', false);

    await Promise.all([p1, p2, p3]);

    // Wait until the queue is fully processed
    while (executionOrder.length < 6) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Verify sequential order
    assert.deepStrictEqual(executionOrder, [
      'start-1',
      'end-1',
      'start-2',
      'end-2',
      'start-3',
      'end-3'
    ]);

    // Verify queue notifications were sent to the user
    const queueMsgs = sentMessages.filter(m => m.text.includes('Added to queue'));
    assert.strictEqual(queueMsgs.length, 2);
    assert.match(queueMsgs[0].text, /Position:<\/b> <code>#1<\/code>/);
    assert.match(queueMsgs[1].text, /Position:<\/b> <code>#2<\/code>/);
  });

  await t.test('lazyCheckUpdate logic with cooldown and notification guard', async (t) => {
    process.env.NODE_ENV = 'test';
    
    const updater = require('../src/utils/updater');
    
    let updateCheckResult = { available: false };
    t.mock.method(updater, 'checkUpdateAvailable', async () => {
      return updateCheckResult;
    });

    const botModule = require('../src/core/bot');

    const sentMessages = [];
    const mockBot = {
      sendMessage: async (chatId, text, options) => {
        sentMessages.push({ chatId, text, options });
        return { ok: true, result: { message_id: 123 } };
      }
    };

    // 1. Initial state: lastCheckTime is now. Cooldown is 24h.
    botModule.setLastCheckTime(Date.now());
    botModule.setLastNotifiedVersion(null);
    sentMessages.length = 0;

    await botModule.lazyCheckUpdate(mockBot);
    assert.strictEqual(sentMessages.length, 0);

    // 2. Set lastCheckTime to 25 hours ago. Cooldown is bypassed.
    botModule.setLastCheckTime(Date.now() - 25 * 60 * 60 * 1000);
    updateCheckResult = { available: true, localVersion: 'local12', remoteVersion: 'remote34' };
    
    await botModule.lazyCheckUpdate(mockBot);
    assert.strictEqual(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /UPDATE ALERT/);
    assert.strictEqual(botModule.getLastNotifiedVersion(), 'remote34');

    // 3. Call again after 25h but remoteVersion is still the same (remote34).
    botModule.setLastCheckTime(Date.now() - 25 * 60 * 60 * 1000);
    sentMessages.length = 0;

    await botModule.lazyCheckUpdate(mockBot);
    assert.strictEqual(sentMessages.length, 0);

    // 4. Call again after 25h with a new remoteVersion (remote56).
    botModule.setLastCheckTime(Date.now() - 25 * 60 * 60 * 1000);
    updateCheckResult = { available: true, localVersion: 'local12', remoteVersion: 'remote56' };
    sentMessages.length = 0;

    await botModule.lazyCheckUpdate(mockBot);
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(botModule.getLastNotifiedVersion(), 'remote56');
  });
});
