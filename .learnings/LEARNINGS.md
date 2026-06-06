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
