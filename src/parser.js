/**
 * Strips ANSI escape sequences and carriage returns from text.
 */
function stripAnsi(text) {
  if (!text) return '';
  const ansiPattern = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return text.replace(ansiPattern, '').replace(/\r/g, '');
}

/**
 * Parses markdown text and escapes/converts it to Telegram-compatible HTML.
 */
function toTelegramHtml(md) {
  if (!md) return '';

  // 1. Escape HTML special characters (with double-escaping mitigation)
  let text = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&amp;amp;/g, '&amp;')
    .replace(/&amp;lt;/g, '&lt;')
    .replace(/&amp;gt;/g, '&gt;')
    .replace(/&amp;quot;/g, '&quot;')
    .replace(/&amp;apos;/g, '&apos;');

  // 2. Handle blockquotes (lines starting with >)
  // Convert > Text to <i>Text</i>
  text = text.replace(/^>\s+(.+)$/gm, '<i>$1</i>');

  // 3. Handle code blocks (```lang ... ```)
  text = text.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)```/g, '<pre>$1</pre>');

  // 4. Handle inline code (`code`)
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 5. Convert local file links: [name](file:///path) -> 📄 <b>name</b> (<code>/path</code>)
  text = text.replace(/\[([^\]]+)\]\(file:\/\/([^\)]+)\)/g, (match, name, filePath) => {
    const displayPath = filePath.replace('/home/nhien36hk', '~');
    return `📄 <b>${name}</b> (<code>${displayPath}</code>)`;
  });

  // 6. Convert standard web links: [name](url) -> <a href="url">name</a>
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2">$1</a>');

  // 7. Convert bold (**text** or __text__)
  text = text.replace(/\*\*([^\*]+)\*\*/g, '<b>$1</b>');
  text = text.replace(/__([^_]+)__/g, '<b>$1</b>');

  // 8. Convert italic (*text* or _text_)
  text = text.replace(/\*([^\*]+)\*/g, '<i>$1</i>');
  text = text.replace(/\b_([^_]+)_\b/g, '<i>$1</i>');

  // 9. Convert headers (e.g. ### Header -> <b>Header</b>)
  text = text.replace(/^(?:#{1,6})\s+(.+)$/gm, '<b>$1</b>');

  return text;
}

/**
 * Splits HTML messages at newline or space boundaries while maintaining tag balance across chunks.
 */
function splitMessageHtml(text, limit = 4000) {
  if (text.length <= limit) return [text];

  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';
  
  const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s+[^>]+)?>/g;

  function getOpenTags(chunkText) {
    const stack = [];
    let match;
    tagRegex.lastIndex = 0;
    while ((match = tagRegex.exec(chunkText)) !== null) {
      const fullTag = match[0];
      const tagName = match[1];
      const isClosing = fullTag.startsWith('</');

      if (isClosing) {
        if (stack.length > 0 && stack[stack.length - 1].name === tagName) {
          stack.pop();
        }
      } else {
        stack.push({ name: tagName, full: fullTag });
      }
    }
    return stack;
  }

  for (const line of lines) {
    if (line.length > limit) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      let remaining = line;
      while (remaining.length > limit) {
        let splitIdx = remaining.lastIndexOf(' ', limit);
        if (splitIdx === -1 || splitIdx < limit / 2) {
          splitIdx = limit;
        }
        chunks.push(remaining.slice(0, splitIdx));
        remaining = remaining.slice(splitIdx).trim();
      }
      currentChunk = remaining;
      continue;
    }

    const activeOpen = getOpenTags(currentChunk);
    const closeTagsLen = activeOpen.map(t => `</${t.name}>`).join('').length;
    const openTagsLen = activeOpen.map(t => t.full).join('').length;

    if (currentChunk.length + line.length + 1 + closeTagsLen + openTagsLen > limit) {
      const closeStr = activeOpen.slice().reverse().map(t => `</${t.name}>`).join('');
      chunks.push(currentChunk + closeStr);

      const openStr = activeOpen.map(t => t.full).join('');
      currentChunk = openStr + line;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n' + line : line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Extracts only the current turn's output from the accumulated stdout history.
 */
function extractNewTurnOutput(stdout, promptText) {
  if (!stdout) return '';

  const cleanStdout = stripAnsi(stdout);

  // Split by horizontal line separators (Unicode box drawing character U+2500)
  const parts = cleanStdout.split(/─{10,}/);
  const cleanPrompt = promptText.trim().toLowerCase();
  
  // Try to find the section matching the current prompt (searching backwards)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();
    if (!part) continue;

    const lines = part.split('\n');
    const firstLine = lines[0].trim().toLowerCase();
    
    // Check if the first line starts with ">" and contains a portion of the prompt
    const trimmedPrompt = firstLine.slice(1).trim();
    if (firstLine.startsWith('>') && (firstLine.includes(cleanPrompt.slice(0, 20)) || (trimmedPrompt && cleanPrompt.includes(trimmedPrompt)))) {
      return lines.slice(1).join('\n').trim();
    }
  }

  // Fallback: search backwards for the last section starting with ">"
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();
    if (!part) continue;

    const lines = part.split('\n');
    const firstLine = lines[0].trim();
    if (firstLine.startsWith('>')) {
      return lines.slice(1).join('\n').trim();
    }
  }

  // Ultimate fallback: return raw stdout
  return cleanStdout;
}

/**
 * Translates English thought steps into Vietnamese description with custom emojis.
 */
function translateStepToVietnamese(step) {
  const lower = step.toLowerCase();
  
  // Extract file names or backtick commands
  const backtickMatch = step.match(/`([^`]+)`/);
  const fileMatch = step.match(/([a-zA-Z0-9_\-\.\/]+\.(?:js|json|md|py|sh|txt|pdf))/i);
  const target = backtickMatch ? backtickMatch[1] : (fileMatch ? fileMatch[1] : '');

  if (lower.includes('list the contents') || lower.includes('listing the') || lower.includes('list the files')) {
    return '📁 Liệt kê các tệp tin trong thư mục';
  }
  
  if (lower.includes('run the command') || lower.includes('running the command') || lower.includes('run the script') || lower.includes('execute') || lower.includes('executing')) {
    return `💻 Chạy lệnh: <code>${target || 'command'}</code>`;
  }
  
  if (lower.includes('read') || lower.includes('view') || lower.includes('reading')) {
    return `🔍 Đọc nội dung tệp: <code>${target || 'document'}</code>`;
  }
  
  if (lower.includes('write') || lower.includes('create') || lower.includes('writing') || lower.includes('creating')) {
    return `📝 Ghi/Tạo tệp: <code>${target || 'file'}</code>`;
  }
  
  if (lower.includes('check') || lower.includes('inspect') || lower.includes('checking') || lower.includes('inspecting')) {
    return `👀 Kiểm tra: <code>${target || 'status'}</code>`;
  }
  
  if (lower.includes('search') || lower.includes('searching')) {
    return '🔎 Tìm kiếm thông tin';
  }

  // Return formatted original step if no keywords match
  return toTelegramHtml(step);
}

/**
 * Parses raw stdout stream into checklist steps and clean response content.
 */
function parseStdout(stdout) {
  if (!stdout) return { steps: [], response: '' };

  const cleanStdout = stripAnsi(stdout);
  const lines = cleanStdout.split('\n');
  const steps = [];
  const responseLines = [];

  // Keywords that identify agent thought/actions
  const stepKeywords = [
    'i will', 'i have', 'i am', 'checking', 'reading', 'writing', 
    'executing', 'running', 'completed', 'found', 'created', 'inspecting', 'searching'
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // Keep empty lines for response spacing unless it's between steps
      if (responseLines.length > 0) {
        responseLines.push(line);
      }
      continue;
    }

    const lower = trimmed.toLowerCase();
    const isStep = stepKeywords.some(keyword => lower.startsWith(keyword));

    if (isStep) {
      steps.push(trimmed);
    } else {
      responseLines.push(line);
    }
  }

  return {
    steps,
    response: responseLines.join('\n').trim()
  };
}

/**
 * Format progress message as HTML.
 */
function formatProgressHtml(steps, activeStdout) {
  let html = `⚡ <b>Antigravity CLI đang xử lý...</b>\n\n`;

  if (steps.length > 0) {
    html += `🔍 <b>Tiến trình thực hiện:</b>\n`;
    
    // Format last 3 completed steps
    const completedSteps = steps.slice(0, -1).slice(-3);
    completedSteps.forEach(step => {
      html += `✅ ${translateStepToVietnamese(step)}\n`;
    });

    // Format current running step
    const runningStep = steps[steps.length - 1];
    html += `⏳ <b>Đang thực hiện:</b> ${translateStepToVietnamese(runningStep)}\n\n`;
  }

  // Format real-time terminal output preview
  if (activeStdout) {
    const cleanStdout = stripAnsi(activeStdout);
    const lines = cleanStdout.split('\n');
    // Get last 6 lines of terminal output
    const terminalLines = lines.slice(-6).join('\n');
    if (terminalLines.trim()) {
      html += `💻 <b>Terminal Console:</b>\n<pre>${toTelegramHtml(terminalLines)}</pre>`;
    }
  }

  return html;
}

module.exports = {
  toTelegramHtml,
  splitMessageHtml,
  extractNewTurnOutput,
  parseStdout,
  formatProgressHtml,
  translateStepToVietnamese,
  stripAnsi
};
