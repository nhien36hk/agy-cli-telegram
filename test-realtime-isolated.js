const { runAgy } = require('./src/core/runner');
const watcher = require('./src/core/watcher');

async function run() {
  console.log("Starting agy run...");
  let lastState = '';
  
  const interval = setInterval(() => {
    const activeTool = watcher.getCurrentActiveTool();
    const newState = activeTool || '🧠 Đang xử lý thuật toán...';
    if (newState !== lastState) {
      console.log(`[UI UPDATE] ${newState}`);
      lastState = newState;
    }
  }, 200);

  try {
    const { stdout } = await runAgy("Calculate 100 * 200 using python", { useContinue: false });
    console.log("Done!");
    console.log("Final Output length:", stdout.length);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    clearInterval(interval);
    console.log("Final Turn from transcript:", watcher.getLatestTurnFromTranscript());
  }
}

run();
