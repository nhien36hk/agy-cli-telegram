const fs = require('fs');
const watcher = require('./src/core/watcher');

const dir = watcher.getLatestConversationDir();
const logPath = dir + '/.system_generated/logs/transcript.jsonl';
console.log("Reading:", logPath);

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

let latestTurnOutputs = [];
// Go backwards
for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i].trim()) continue;
  try {
    const parsed = JSON.parse(lines[i]);
    if (parsed.type === 'USER_INPUT') {
      // Reached the start of the current turn
      break;
    }
    if (parsed.type === 'PLANNER_RESPONSE' && parsed.content) {
      latestTurnOutputs.unshift(parsed.content);
    }
  } catch(e) {}
}

console.log("EXTRACTED CONTENT:");
console.log(latestTurnOutputs.join('\n'));
