const fs = require('fs');
const path = require('path');
const watcher = require('./src/core/watcher');
const assert = require('assert');

// Tạo thư mục mock brain
const mockBrain = path.join(__dirname, 'mock_brain');
if (fs.existsSync(mockBrain)) fs.rmSync(mockBrain, { recursive: true, force: true });
fs.mkdirSync(mockBrain);

// Override watcher brainDir
watcher.brainDir = mockBrain;

console.log("1. Test empty brain dir");
assert.strictEqual(watcher.getLatestConversationDir(), null);
assert.strictEqual(watcher.getCurrentActiveTool(), null);
assert.strictEqual(watcher.getLatestTurnFromTranscript(), null); // <--- Expect null

// Tạo 1 conversation
const conv1 = path.join(mockBrain, 'conv-1');
const logDir1 = path.join(conv1, '.system_generated', 'logs');
fs.mkdirSync(logDir1, { recursive: true });
const logFile1 = path.join(logDir1, 'transcript.jsonl');

fs.writeFileSync(logFile1, JSON.stringify({ type: 'USER_INPUT', content: 'hello' }) + '\n');
console.log("2. Test with USER_INPUT only");
assert.strictEqual(watcher.getLatestConversationDir(), conv1);
assert.strictEqual(watcher.getCurrentActiveTool(), null);
assert.strictEqual(watcher.getLatestTurnFromTranscript(), ''); // <--- Expect ''

// Thêm Tool Call
const toolCall1 = {
  type: 'PLANNER_RESPONSE',
  tool_calls: [{ toolAction: 'Searching the web', toolSummary: 'Search google' }]
};
fs.appendFileSync(logFile1, JSON.stringify(toolCall1) + '\n');

console.log("3. Test with Tool Call");
assert.strictEqual(watcher.getCurrentActiveTool(), '🌐 Đang thực hiện: Searching the web (Search google)...');

// Thêm Text Response
const textResponse = {
  type: 'PLANNER_RESPONSE',
  content: 'Here is the result from google.'
};
fs.appendFileSync(logFile1, JSON.stringify(textResponse) + '\n');

console.log("4. Test with Text Response");
// Active tool remains the same because it searches backwards and finds the tool call before the USER_INPUT
assert.strictEqual(watcher.getCurrentActiveTool(), '🌐 Đang thực hiện: Searching the web (Search google)...');
assert.strictEqual(watcher.getLatestTurnFromTranscript(), 'Here is the result from google.');

// Thêm conversation 2 (mô phỏng /new)
const conv2 = path.join(mockBrain, 'conv-2');
const logDir2 = path.join(conv2, '.system_generated', 'logs');
fs.mkdirSync(logDir2, { recursive: true });
const logFile2 = path.join(logDir2, 'transcript.jsonl');

// Sleep 10ms to ensure mtime is different
setTimeout(() => {
  fs.writeFileSync(logFile2, JSON.stringify({ type: 'USER_INPUT', content: 'hi' }) + '\n');
  const toolCall2 = {
    type: 'PLANNER_RESPONSE',
    tool_calls: [{ toolAction: 'Viewing file', toolSummary: 'View test.js' }]
  };
  fs.appendFileSync(logFile2, JSON.stringify(toolCall2) + '\n');
  
  console.log("5. Test multiple conversations");
  assert.strictEqual(watcher.getLatestConversationDir(), conv2);
  assert.strictEqual(watcher.getCurrentActiveTool(), '📄 Đang thực hiện: Viewing file (View test.js)...');
  
  // Clean up
  fs.rmSync(mockBrain, { recursive: true, force: true });
  console.log("All tests passed! ✅");
}, 20);
