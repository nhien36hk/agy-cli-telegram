const fs = require('fs');
const path = require('path');
const os = require('os');

class TranscriptWatcher {
  constructor() {
    this.brainDir = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain');
  }

  getLatestConversationDir() {
    try {
      if (!fs.existsSync(this.brainDir)) return null;

      const dirs = fs.readdirSync(this.brainDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => {
          const dirPath = path.join(this.brainDir, dirent.name);
          const logPath = path.join(dirPath, '.system_generated', 'logs', 'transcript.jsonl');
          let mtime = 0;
          try {
            mtime = fs.statSync(logPath).mtimeMs;
          } catch(e) {
            mtime = fs.statSync(dirPath).mtimeMs;
          }
          return { path: dirPath, mtime };
        })
        .sort((a, b) => b.mtime - a.mtime);

      return dirs.length > 0 ? dirs[0].path : null;
    } catch (err) {
      console.error('Error finding latest conversation dir:', err.message);
      return null;
    }
  }

  getEmojiForAction(action) {
    const act = action.toLowerCase();
    if (act.includes('view') || act.includes('read')) return '📄';
    if (act.includes('edit') || act.includes('writ')) return '💾';
    if (act.includes('run') || act.includes('exec') || act.includes('command')) return '⚡';
    if (act.includes('search') || act.includes('find')) return '🌐';
    if (act.includes('analyz') || act.includes('list') || act.includes('check')) return '🔬';
    if (act.includes('semantic') || act.includes('brain')) return '🧠';
    return '⚙️';
  }

  /**
   * Đọc ngược file transcript.jsonl để lấy Tool đang chạy mới nhất
   */
  getCurrentActiveTool() {
    try {
      const dir = this.getLatestConversationDir();
      if (!dir) return null;
      const logPath = path.join(dir, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(logPath)) return null;

      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n');
      
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed.type === 'USER_INPUT') break; // Đã lùi về đầu lượt chat
          if (parsed.type === 'PLANNER_RESPONSE' && parsed.tool_calls && parsed.tool_calls.length > 0) {
            const firstTool = parsed.tool_calls[0];
            if (firstTool.toolAction && firstTool.toolSummary) {
              const emoji = this.getEmojiForAction(firstTool.toolAction);
              return `${emoji} Đang thực hiện: ${firstTool.toolAction} (${firstTool.toolSummary})...`;
            }
          }
        } catch(e) {}
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  getLatestTurnFromTranscript() {
    try {
      const dir = this.getLatestConversationDir();
      if (!dir) return null;
      const logPath = path.join(dir, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(logPath)) return null;

      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n');

      let latestTurnOutputs = [];
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed.type === 'USER_INPUT') break;
          if (parsed.type === 'PLANNER_RESPONSE' && parsed.content) {
            latestTurnOutputs.unshift(parsed.content);
          }
        } catch(e) {}
      }
      return latestTurnOutputs.length > 0 ? latestTurnOutputs.join('\n\n') : '';
    } catch (err) {
      console.error('Lỗi khi đọc transcript:', err.message);
      return null;
    }
  }
}

module.exports = new TranscriptWatcher();
