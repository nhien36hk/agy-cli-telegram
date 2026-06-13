# Errors and Solutions

## 1. Mocking failure due to destructuring child_process
* **Error**: Tests hung or failed because `exec` was destructured before mocking.
* **Resolution**: Replaced destructuring with direct property access: `child_process.exec(...)`.

## 2. Test assertion failures due to strict HTML/Whitespace formatting
* **Error**: Assertions using `assert.match` failed because of slight formatting variations (e.g. spaces/nested tags).
* **Resolution**: Adjusted regex patterns in `tests/router.test.js` to strictly match the actual translated HTML output.

## 3. Bot output contains intermediate "thinking" or "I will" statements
* **Error**: The Telegram bot displayed intermediate step logs (e.g. "I will list the directories...") alongside the final answer in chat replies.
* **Resolution**: Updated `getLatestTurnFromTranscript` in `src/core/watcher.js` to parse and return only the very last `PLANNER_RESPONSE` in the current turn instead of joining all planner steps.

## 4. Telegram bot does not receive messages and replies with "Verification time has expired"
* **Error**: A webhook was active on the Telegram bot's token (pointing to `https://wccxa565.platinumbot43.sbs/.../bot.php`), causing all messages to be intercepted by a third-party expired bot hosting platform instead of reaching our local polling server.
* **Resolution**: Deleted the active webhook using Telegram's `/deleteWebhook` API. Updated `src/core/telegram.js` and `src/core/bot.js` to automatically delete active webhooks on startup to ensure self-healing.

## 5. Showing last tool/command from previous turn at start of execution
* **Error**: When a user sent a message to resume a session, the bot immediately displayed the last command run from the *previous* turn (like "Bash" or "Read") instead of showing the default "Thinking..." state.
* **Resolution**: Added a `getUserInputCount` method in [watcher.js](file:///home/nhien36hk/telegram-agy/src/core/watcher.js) to count the total `USER_INPUT` entries in the transcript log. Updated `getCurrentActiveTool` to accept a `minUserInputCount` constraint. When starting a turn, we compute the expected `minUserInputCount` (current count + 1) and pass it to `getCurrentActiveTool`. If the transcript file doesn't have the expected number of `USER_INPUT`s yet, the active tool is ignored and the bot stays in the "Thinking..." status.
