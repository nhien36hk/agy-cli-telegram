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
assert.strictEqual(watcher.getCurrentActiveTool(), null);

// Tạo 1 conversation
const conv1 = path.join(mockBrain, 'conv-1');
const logDir1 = path.join(conv1, '.system_generated', 'logs');
fs.mkdirSync(logDir1, { recursive: true });
const logFile1 = path.join(logDir1, 'transcript.jsonl');

fs.writeFileSync(logFile1, JSON.stringify({ type: 'USER_INPUT', content: 'hello' }) + '\n');
console.log("2. Test with USER_INPUT only");
assert.strictEqual(watcher.getCurrentActiveTool(), null);

// Thêm Tool Call with NEW format (args object and quotes)
const toolCall1 = {
  type: 'PLANNER_RESPONSE',
  tool_calls: [{ 
    name: 'search_web', 
    args: {
      toolAction: '"Searching the web"', 
      toolSummary: '"Search google"' 
    }
  }]
};
fs.appendFileSync(logFile1, JSON.stringify(toolCall1) + '\n');

console.log("3. Test with Tool Call (new JSON format)");
assert.strictEqual(watcher.getCurrentActiveTool(), '🌐 Đang thực hiện: Searching the web (Search google)...');

// Clean up
fs.rmSync(mockBrain, { recursive: true, force: true });
console.log("All tests passed! ✅");
