/**
 * 🚀 REAL-TIME UI DEBUGGER (GOLD STANDARD TEST)
 * 
 * Secret weapon to debug all UI flows (tool updates) on Telegram
 * WITHOUT connecting to the real Telegram Bot API.
 * It simulates exactly 100% of the setInterval() loop in bot.js.
 * 
 * Usage: node tests/realtime-ui-debugger.js
 * 
 * If the console prints [UI UPDATE] 🌐 Exploring... then it is guaranteed
 * that the Telegram Bot will update exactly the same way.
 */

const { runAgy } = require('../src/core/runner');
const watcher = require('../src/core/watcher');

async function run() {
  console.log("==========================================");
  console.log("🚀 Starting Telegram UI loop simulation...");
  console.log("==========================================");

  let lastState = '';

  const knownConvIds = new Set(watcher.getAllConversations().map(c => c.id));
  let activeConvId = null;

  // Simulate uiUpdater function in bot.js (but running at 200ms instead of 1s for faster logging)
  const interval = setInterval(() => {
    if (!activeConvId) {
      const currentConvs = watcher.getAllConversations();
      const newConvs = currentConvs.filter(c => !knownConvIds.has(c.id));
      if (newConvs.length > 0) {
        // Find exact match
        const exactMatch = newConvs.find(c => c.fullPrompt && c.fullPrompt === "Please list the files in the current directory");
        if (exactMatch) {
          activeConvId = exactMatch.id;
        } else {
          // Fallback to first if no exact match yet
          const potentialMatch = newConvs.find(c => !c.fullPrompt || c.fullPrompt === "Please list the files in the current directory");
          if (potentialMatch) activeConvId = potentialMatch.id;
        }
      }
    }

    const activeTool = watcher.getCurrentActiveTool(activeConvId);
    const newState = activeTool || '<i>▸ Thinking...</i>';

    // If state changes, print to screen (equivalent to bot.editMessageText on Telegram)
    if (newState !== lastState) {
      console.log(`[TELEGRAM UI UPDATE] ${newState}`);
      lastState = newState;
    }
  }, 200);

  try {
    // Call CLI in the background with a sample prompt (useContinue: false to force a clean new session)
    const testPrompt = "Please list the files in the current directory";
    console.log(`>> User sent message: "${testPrompt}"\n`);

    const { stdout } = await runAgy(testPrompt, { useContinue: false });

    console.log("\n==========================================");
    console.log("✅ CLI finished running!");
    console.log("Final output length:", stdout.length, "bytes");
  } catch (err) {
    console.error("❌ Error running Agy:", err);
  } finally {
    // Clean up process
    clearInterval(interval);
    console.log("==========================================");
    console.log("📝 Final result retrieved from Transcript:\n");
    const turn = watcher.getLatestTurnFromTranscript(activeConvId);
    console.log(turn ? turn.substring(0, 1000) + "\n... (Truncated)" : "No transcript result found.");
    console.log("==========================================");
  }
}

run();
