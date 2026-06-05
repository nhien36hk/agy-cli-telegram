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
   * Đọc 32KB cuối cùng của file để chống tràn RAM khi file log quá lớn (Edge Case).
   */
  readTail(filePath, maxBytes = 32768) {
    const stat = fs.statSync(filePath);
    const size = stat.size;
    const readSize = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(readSize);

    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, readSize, size - readSize);
    fs.closeSync(fd);

    return buffer.toString('utf8');
  }

  readLastBytes(filePath, maxBytes = 512 * 1024) {
    try {
      const stat = fs.statSync(filePath);
      const size = stat.size;
      if (size === 0) return '';
      const readSize = Math.min(size, maxBytes);
      const buffer = Buffer.alloc(readSize);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, readSize, size - readSize);
      fs.closeSync(fd);
      return buffer.toString('utf8');
    } catch (e) {
      return '';
    }
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

      const content = this.readLastBytes(logPath);
      const lines = content.split('\n');
      
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        try {
          // Bỏ qua dòng đầu tiên có thể bị cắt đứt do readTail
          if (i === 0 && content.length >= 32768) continue;
          
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

      const content = this.readTail(logPath, 65536); // Đọc tối đa 64KB cho text response
      const lines = content.split('\n');

      let latestTurnOutputs = [];
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        try {
          if (i === 0 && content.length >= 65536) continue;
          
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
