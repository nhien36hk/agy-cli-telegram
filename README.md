# Telegram Antigravity Bridge ⚡

Official bridge to bring **Antigravity CLI** to Telegram. It allows you to control, program, and communicate with your AI Agent from your phone or any device via Telegram, instead of being glued to your computer Terminal.

```text
    ___                   ______     __
   /   | ____ ___  __    /_  __/__  / /__  ____ __________ _____ ___ 
  / /| |/ __ `/ / / /_____/ / / _ \/ / _ \/ __ `/ ___/ __ `/ __ `__ \
 / ___ / /_/ / /_/ /_____/ / /  __/ /  __/ /_/ / /  / /_/ / / / / / /
/_/  |_\__, /\__, /     /_/  \___/_/\___/\__, /_/   \__,_/_/ /_/ /_/ 
      /____//____/                      /____/                   
```

* **Real Terminal User Interface (TUI):** Perfect code formatting (Markdown, Code blocks), bold, italic rendering.
* **Real-time (Live Agent State):** Data is streamed directly to Telegram. Precisely track every background system action (reading files, searching the web, running commands) displayed with Live Emojis instead of a static "Thinking..." status.
* **Over-The-Air Update (OTA):** Automatically check and update the bot source code directly from the Telegram chat screen with a simple `/update` command.
* **Absolute Security:** Based on an Allowlist; only Telegram User IDs specified by you have the authorization to command your computer system.
* **Run Anywhere:** Native support on Windows, Linux, macOS.

## 🚀 Quick Install

**Linux, macOS, WSL2, Termux**
Open your Terminal and paste the following command:

```bash
curl -fsSL https://raw.githubusercontent.com/nhien36hk/agy-cli-telegram/main/install.sh | bash
```

**Windows (Native, PowerShell)**
Full native support for Windows (no need to install WSL or simulated Git Bash). The installer will automatically set up everything in a secure isolated environment.
Open **PowerShell** and paste the following command:

```powershell
iex (irm https://raw.githubusercontent.com/nhien36hk/agy-cli-telegram/main/install.ps1)
```

The multi-platform Node.js installer will automatically launch, guiding you step-by-step to obtain the **Telegram Bot Token** and **User ID**, masking password input and automatically linking the `agy-tele` command to the system.

## 💡 Getting Started

After successful installation, you can start the bot from anywhere (any directory) on your computer in one of two ways:

### Method 1: Direct Run

```bash
agy-tele
```

The system will immediately start listening for messages from your Telegram and act as a direct Bridge to pass commands to the Antigravity CLI. Press `Ctrl + C` to exit.

### Method 2: Run in Background 24/7 (Recommended)

To keep the bot awake and working even when you close the Terminal, use **PM2** (a professional process management tool for Node.js).

1. Install PM2 (if you don't have it yet):

```bash
npm install -g pm2
```

2. Start the bot in the background:

```bash
pm2 start agy-tele --name agy-tele
```

3. Some useful PM2 commands:

```bash
pm2 logs agy-tele    # View bot activity logs
pm2 stop agy-tele    # Temporarily stop the bot
pm2 restart agy-tele # Restart the bot
pm2 save             # Save state to auto-run on system startup
pm2 startup          # Set up pm2 to auto-start with the OS
```

## 🎮 Telegram Slash Commands

The system automatically registers a command menu on Telegram for quick access:

- `/new` - Clear context, start a completely new conversation.
- `/resume` - Continue the ongoing conversation (default behavior when sending a normal message).
- `/status` - Check if the bot is connected to the server.
- `/update` - Automatically pull the latest source code from GitHub and restart the bot (OTA Update).
- `/help` - View usage guide.

## ⚙️ Manage & Update Bot

**Method 1: OTA Update via Telegram (Recommended)**
Open your phone, type `/update` in the chat with the Bot. The Bot will automatically download the latest version from GitHub and restart itself (requires the Bot to be running via PM2).

**Method 2: Update via Terminal**
Open your Terminal anywhere and type:

```bash
agy-tele update
pm2 restart agy-tele
```

**Method 3: Reconfigure Token / User List**
If you want to change the Bot Token or authorize others:

```bash
cd ~/.telegram-agy
npm run setup
```

## 🛠 Prerequisites

- **Node.js** >= v18
- **Git**
- **Antigravity CLI** (`agy`) installed and configured in your PATH. Every command on Telegram will actually trigger `agy` on your machine.

---

*License: MIT | Built to optimize your Agentic Coding experience. Made by Nhien36hk - HuuNhien*
