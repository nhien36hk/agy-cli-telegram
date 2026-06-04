# Lead Plan - Modular telegram-agy Bot

This document outlines the architecture for refactoring `bridge.js` into clean, modular components.

## 🗂️ Directory Structure

```
telegram-agy/
├── src/
│   ├── config.js         # Configuration & Security (Whitelist)
│   ├── agy.js            # Antigravity CLI Runner (Stdout/Stderr Streaming)
│   ├── telegram.js       # Telegram API client (Send, Edit, Delete, Polling, Queue Clear)
│   ├── parser.js         # HTML formatting, step translation, and history extraction
│   └── index.js          # Entry Point & Orchestrator
├── tests/
│   ├── agy.test.js       # Tests for CLI Runner
│   ├── telegram.test.js  # Tests for Telegram Client (Mocked API calls)
│   ├── config.test.js    # Tests for Config Loader
│   └── parser.test.js    # Tests for HTML formatting and history extraction
├── config.json           # Whitelist & API credentials
├── package.json          # Node dependencies
└── task_tracker.md       # Task tracking and memory
```

## ⚙️ Modular Requirements

### 0. `src/parser.js`
- Strips ANSI escape sequences and carriage returns (`stripAnsi`) to handle real-world terminal streams safely.
- Translates English CLI thinking logs to descriptive Vietnamese with custom emojis.
- Isolates current turn output from previous conversation history (`extractNewTurnOutput`).
- Converts Markdown to Telegram-safe HTML format (`toTelegramHtml`).
- Implements tag-aware HTML message splitting (`splitMessageHtml`) to prevent Telegram parse entity errors.

### 1. `src/config.js`
- Reads `/home/nhien36hk/telegram-agy/config.json`.
- Exposes `token` and `allowedUserIds` (guaranteed to be an array of strings).
- Throws an error or exits if variables are missing.

### 2. `src/agy.js`
- Spawns `agy` CLI using `child_process.spawn`.
- Automatically closes `stdin` (`child.stdin.end()`) to prevent hangs.
- Supports `onChunk` callback that receives incremental output.
- Returns a Promise resolving to the final stdout output (or stderr on exit error).

### 3. `src/telegram.js`
- Standardizes fetch requests to Telegram Bot API.
- Implements `sendMessage`, `editMessageText`, `deleteMessage`, and `sendChatAction('typing')`.
- Implements startup clearing logic (discarding previous getUpdates queue).
- Standardizes offsets for polling.

### 4. `src/index.js`
- Combines config, agy, and telegram modules.
- Implements the main polling loop.
- Manages the UI lifecycle:
  1. Receive message.
  2. Send placeholder progress message.
  3. Stream stdout updates via `agy.js` into `editMessageText` (throttled).
  4. Delete progress message on completion.
  5. Send final answer (or chunked answers).
