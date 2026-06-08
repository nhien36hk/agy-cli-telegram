# Project Learnings

## 1. Mocking Destructured Imports in Node.js Tests
When writing unit tests in Node.js, destructuring imports like:
```javascript
const { exec } = require('child_process');
```
causes the function reference to be bound at import time. Consequently, attempting to mock `child_process.exec` using:
```javascript
t.mock.method(child_process, 'exec', ...)
```
will not affect the destructured reference in the target module.
**Correction**: Import the whole module and access the method on the object namespace:
```javascript
const child_process = require('child_process');
child_process.exec(...)
```

## 2. Sanitizing CLI Output for Telegram Keyboards
The `agy models` command includes interactive terminal spinner characters (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) in its output, which need to be parsed out. Use regex replacement to sanitize terminal outputs before transforming them into user-facing Telegram menus or keyboards.

## 3. Google Code Assist Quota & Numbered Model Selection
* **Usage Quota**: The `/usage` command must fetch and format the real-time Google Code Assist quota buckets (from the `retrieve_user_quota` Python API in `.hermes/hermes-agent`). A dedicated python runner script is required to invoke these modules using the active python virtualenv interpreter.
* **Numbered Model Selection**: Rather than inline button query callbacks, selecting a model is cleaner when structured as a stateful flow. When `/model` is typed, list the options as a numbered message list and store a `waitingForModelSelect` flag and the available options in transient memory. Subsequent numeric responses from the user should update the active model, whereas non-numeric responses should fall back to general prompt routing.

## 4. agy CLI Commands Need PTY (node-pty)
The `agy` binary uses an interactive spinner that **requires a PTY** to function. When called via `child_process.exec()` or `child_process.spawn()` (no TTY), the process hangs indefinitely and never produces output. **Solution**: Use `node-pty` to spawn `agy` commands. Additionally, the PTY output contains ANSI escape sequences (`\x1b[...`) and carriage returns (`\r`) that must be stripped alongside spinner characters.

## 5. Capturing Interactive CLI Screens via PTY for usage
Instead of trying to query raw APIs or parse local database files, we can capture interactive CLI/TUI screens (like the Model Quota screen inside the `agy` chat prompt session) directly. Spawning `agy` via `node-pty`, waiting for it to initialize (using a static delay), writing the chat command (`/usage\r`), and capturing the drawn terminal buffer allows the Telegram bot to display the exact native progress bars and model quotas. Monospace preformatted tags (`<pre>`) are used in Telegram to preserve alignment.

## 6. Translating UI Strings and Adjusting Test Assertions
To translate a Telegram bridge application and CLI installer from one language to another (e.g., Vietnamese to English) without altering the underlying logic, all user-facing strings (such as start messages, status logs, error alerts, interactive setup questions, and command descriptions) must be replaced in both source files and installation scripts. Additionally, any unit test suites that verify these string outputs via regular expression or string assertions must be updated to align with the new translations to ensure test suites continue passing.



