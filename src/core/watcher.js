const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

class TranscriptWatcher extends EventEmitter {
  constructor() {
    super();
    this.brainDir = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain');
    this.currentLogFile = null;
    this.watcher = null;
    this.lastSize = 0;
  }

  /**
   * Finds the most recently modified conversation directory in the brain folder.
   */
  getLatestConversationDir() {
    try {
      if (!fs.existsSync(this.brainDir)) return null;

      const dirs = fs.readdirSync(this.brainDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => {
          const dirPath = path.join(this.brainDir, dirent.name);
          return {
            path: dirPath,
            mtime: fs.statSync(dirPath).mtime
          };
        })
        .sort((a, b) => b.mtime - a.mtime);

      return dirs.length > 0 ? dirs[0].path : null;
    } catch (err) {
      console.error('Error finding latest conversation dir:', err.message);
      return null;
    }
  }

  /**
   * Starts watching for the agent's transcript log.
   */
  startWatching() {
    // Initial check for the latest dir
    const latestDir = this.getLatestConversationDir();
    if (latestDir) {
      this.watchLogFile(latestDir);
    }

    // Also watch the brain dir for new conversations
    try {
      if (!fs.existsSync(this.brainDir)) {
        fs.mkdirSync(this.brainDir, { recursive: true });
      }
      fs.watch(this.brainDir, (eventType, filename) => {
        if (filename) {
          const newDirPath = path.join(this.brainDir, filename);
          // Small delay to ensure directory is created
          setTimeout(() => {
            if (fs.existsSync(newDirPath) && fs.statSync(newDirPath).isDirectory()) {
              this.watchLogFile(newDirPath);
            }
          }, 500);
        }
      });
    } catch (err) {
      console.error('Failed to watch brain dir:', err.message);
    }
  }

  /**
   * Watches a specific transcript.jsonl file
   */
  watchLogFile(conversationDir) {
    const logFile = path.join(conversationDir, '.system_generated', 'logs', 'transcript.jsonl');
    
    // Unwatch previous
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.currentLogFile = logFile;
    this.lastSize = 0;

    const checkFile = () => {
      try {
        if (!fs.existsSync(logFile)) return;
        
        const stat = fs.statSync(logFile);
        if (stat.size > this.lastSize) {
          // Read only the new part
          const stream = fs.createReadStream(logFile, { start: this.lastSize, end: stat.size - 1 });
          let data = '';
          stream.on('data', chunk => { data += chunk; });
          stream.on('end', () => {
            this.lastSize = stat.size;
            this.processNewLines(data);
          });
        }
      } catch (err) {
        // file might not be ready
      }
    };

    // Watch the directory that will contain the file, or the file itself
    const logsDir = path.dirname(logFile);
    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      this.watcher = fs.watch(logsDir, (eventType, filename) => {
        if (filename === 'transcript.jsonl') {
          checkFile();
        }
      });
      // Initial check in case it's already there
      checkFile();
    } catch (err) {
      console.error('Failed to watch logs dir:', err.message);
    }
  }

  getEmojiForAction(action) {
    const act = action.toLowerCase();
    if (act.includes('view') || act.includes('read')) return '📄';
    if (act.includes('edit') || act.includes('writ')) return '✍️';
    if (act.includes('run') || act.includes('exec') || act.includes('command')) return '💻';
    if (act.includes('search') || act.includes('find')) return '🔍';
    if (act.includes('analyz') || act.includes('list')) return '📂';
    if (act.includes('semantic') || act.includes('brain')) return '🧠';
    return '⚡';
  }

  processNewLines(data) {
    const lines = data.split('\n').filter(line => line.trim().length > 0);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'PLANNER_RESPONSE' && parsed.tool_calls && parsed.tool_calls.length > 0) {
          const firstTool = parsed.tool_calls[0];
          if (firstTool.toolAction && firstTool.toolSummary) {
            const emoji = this.getEmojiForAction(firstTool.toolAction);
            this.emit('agent_action', {
              action: firstTool.toolAction,
              summary: firstTool.toolSummary,
              emoji: emoji,
              fullText: `${emoji} Đang thực hiện: ${firstTool.toolAction} (${firstTool.toolSummary})...`
            });
          }
        }
      } catch (err) {
        // incomplete json line or parsing error, ignore
      }
    }
  }
}

module.exports = new TranscriptWatcher();
