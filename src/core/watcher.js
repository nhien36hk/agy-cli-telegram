const fs = require('fs');
const path = require('path');
const os = require('os');

class TranscriptWatcher {
  constructor() {
    this.brainDir = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain');
  }

  getLatestConversationDir() {
    try {
      const dirs = this.getAllConversations();
      return dirs.length > 0 ? dirs[0].path : null;
    } catch (err) {
      console.error('Error finding latest conversation dir:', err.message);
      return null;
    }
  }

  getConversationTitle(logPath) {
    try {
      if (!fs.existsSync(logPath)) return "Hội thoại mới";
      const buffer = Buffer.alloc(8192);
      const fd = fs.openSync(logPath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
      fs.closeSync(fd);
      
      const content = buffer.toString('utf8', 0, bytesRead);
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'USER_INPUT' && parsed.content) {
            let text = parsed.content.replace(/\n/g, ' ').trim();
            if (text.length > 40) text = text.substring(0, 37) + '...';
            return text;
          }
        } catch(e) { continue; }
      }
      return "Hội thoại mới";
    } catch(e) {
      return "Hội thoại mới";
    }
  }

  getFullPrompt(logPath) {
    try {
      if (!fs.existsSync(logPath)) return null;
      const buffer = Buffer.alloc(32768);
      const fd = fs.openSync(logPath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 32768, 0);
      fs.closeSync(fd);
      
      const content = buffer.toString('utf8', 0, bytesRead);
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'USER_INPUT' && parsed.content) {
            return parsed.content.trim();
          }
        } catch(e) { continue; }
      }
      return null;
    } catch(e) {
      return null;
    }
  }

  getAllConversations() {
    try {
      if (!fs.existsSync(this.brainDir)) return [];

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
          const title = this.getConversationTitle(logPath);
          const fullPrompt = this.getFullPrompt(logPath);
          return { id: dirent.name, path: dirPath, mtime, title, fullPrompt };
        })
        .sort((a, b) => b.mtime - a.mtime);

      return dirs;
    } catch (err) {
      console.error('Error finding conversations:', err.message);
      return [];
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
   * Đọc khối byte cuối cùng của file để chống tràn RAM khi file log quá lớn
   */
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
  getCurrentActiveTool(conversationId = null) {
    try {
      if (!conversationId) return null; // Không đoán bừa thư mục để tránh dính session của terminal
      const dir = path.join(this.brainDir, conversationId);
      if (!fs.existsSync(dir)) return null;
      const logPath = path.join(dir, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(logPath)) return null;

      const content = this.readLastBytes(logPath, 512 * 1024);
      const lines = content.split('\n');

      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed.type === 'USER_INPUT') break; // Đã lùi về đầu lượt chat
          if (parsed.type === 'PLANNER_RESPONSE' && parsed.tool_calls && parsed.tool_calls.length > 0) {
            const firstTool = parsed.tool_calls[0];
            const toolFullName = firstTool.name || '';
            const shortToolName = toolFullName.split(':').pop() || 'tool';
            
            let rawSummary = firstTool.toolSummary || (firstTool.args && firstTool.args.toolSummary);
            
            if (rawSummary) {
              const summary = typeof rawSummary === 'string' ? rawSummary.replace(/^"|"$/g, '') : rawSummary;
              const emoji = this.getEmojiForAction(shortToolName);
              return `${emoji} ${shortToolName}: "${summary}"`;
            } else if (shortToolName) {
              const emoji = this.getEmojiForAction(shortToolName);
              return `${emoji} ${shortToolName}...`;
            }
          }
        } catch(e) {
          // Bỏ qua dòng bị cắt ngang do readLastBytes
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  getLatestTurnFromTranscript(conversationId = null) {
    try {
      if (!conversationId) return null; // Không đoán bừa
      const dir = path.join(this.brainDir, conversationId);
      if (!fs.existsSync(dir)) return null;
      const logPath = path.join(dir, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(logPath)) return null;

      const content = this.readLastBytes(logPath, 512 * 1024);
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
        } catch(e) {
          // Bỏ qua dòng bị cắt ngang
        }
      }
      return latestTurnOutputs.length > 0 ? latestTurnOutputs.join('\n\n') : '';
    } catch (err) {
      console.error('Lỗi khi đọc transcript:', err.message);
      return null;
    }
  }
}

module.exports = new TranscriptWatcher();
