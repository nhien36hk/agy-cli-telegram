const watcher = require('./src/core/watcher');
console.log("Latest dir:", watcher.getLatestConversationDir());
console.log("Current active tool:", watcher.getCurrentActiveTool());
console.log("Latest turn:", watcher.getLatestTurnFromTranscript());
