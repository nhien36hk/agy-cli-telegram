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
function extractNewTurnOutput(fullStdout, useContinue, fallbackHistoryLength = 0, cachedHistoryText = '') {
  if (!fullStdout) return '';
  const cleanStdout = stripAnsi(fullStdout);

  if (!useContinue) {
    return cleanStdout; // /new command has no history
  }

  // 1. Try perfect cache matching
  if (cachedHistoryText && cleanStdout.startsWith(cachedHistoryText)) {
    return cleanStdout.slice(cachedHistoryText.length).trim();
  }

  // 2. Try timing heuristic fallback
  if (fallbackHistoryLength > 0 && fullStdout.length >= fallbackHistoryLength) {
    const rawHistory = fullStdout.slice(0, fallbackHistoryLength);
    const cleanHistoryLen = stripAnsi(rawHistory).length;

    if (cleanStdout.length >= cleanHistoryLen) {
      return cleanStdout.slice(cleanHistoryLen).trim();
    }
  }

  // 3. Ultimate fallback (worst case: returns full history)
  return cleanStdout;
}

/**
 * Translates English thought steps into Vietnamese description with custom emojis.
 */
function translateStepToVietnamese(step, isFinal = false) {
  const lower = step.toLowerCase();

  // Extract file names or backtick commands
  const backtickMatch = step.match(/`([^`]+)`/);
  const fileMatch = step.match(/([a-zA-Z0-9_\-\.\/]+\.(?:js|json|md|py|sh|txt|pdf))/i);
  const target = backtickMatch ? backtickMatch[1] : (fileMatch ? fileMatch[1] : '');

  if (lower.includes('list the contents') || lower.includes('listing the') || lower.includes('list the files')) {
    return '📂 Khám phá cấu trúc thư mục';
  }

  if (lower.includes('run the command') || lower.includes('running the command') || lower.includes('run the script') || lower.includes('execute') || lower.includes('executing')) {
    if (isFinal && target) {
      return `⚡ Thực thi lệnh:\n<pre>${toTelegramHtml(target)}</pre>`;
    }
    return `⚡ Thực thi lệnh: <code>${target || 'command'}</code>`;
  }

  if (lower.includes('read') || lower.includes('view') || lower.includes('reading')) {
    return `📄 Quét dữ liệu tệp: <code>${target || 'document'}</code>`;
  }

  if (lower.includes('write') || lower.includes('create') || lower.includes('writing') || lower.includes('creating')) {
    return `💾 Khởi tạo/Ghi tệp: <code>${target || 'file'}</code>`;
  }

  if (lower.includes('check') || lower.includes('inspect') || lower.includes('checking') || lower.includes('inspecting')) {
    return `🔬 Phân tích hệ thống: <code>${target || 'status'}</code>`;
  }

  if (lower.includes('search') || lower.includes('searching')) {
    return '🌐 Khai thác dữ liệu mạng';
  }

  // Generic thinking fallback
  return `🧠 Đang xử lý...`;
}

/**
 * Parses raw stdout stream into checklist steps and clean response content.
 * Uses a boundary heuristic to completely isolate internal monologue from the final response.
 */
function parseStdout(stdout) {
  if (!stdout) return { steps: [], response: '' };

  const cleanStdout = stripAnsi(stdout);
  const lines = cleanStdout.split('\n');
  const steps = [];
  const stepIndices = [];

  // Strict keywords that typically only appear in internal monologue / ReAct thought traces
  const stepKeywords = [
    'i will', 'i am going to', 'i need to', 'let me',
    'checking', 'reading', 'writing', 'executing', 'running', 'searching', 'inspecting'
  ];

  // 1. Identify all thought steps
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    if (stepKeywords.some(kw => lower.startsWith(kw))) {
      stepIndices.push(i);
      steps.push(trimmed);
    }
  }

  // 2. Find the boundary: Everything after the LAST thought step is the final response.
  // This completely strips out any internal monologue ("The results are XYZ") that happened between steps.
  let boundaryIndex = stepIndices.length > 0 ? stepIndices[stepIndices.length - 1] : -1;

  let responseLines = [];
  for (let i = boundaryIndex + 1; i < lines.length; i++) {
    responseLines.push(lines[i]);
  }

  let response = responseLines.join('\n').trim();

  // 3. Fallback: If boundary swallowed the entire response (e.g. final sentence was "I will wait for you"),
  // we fallback to simply filtering out the step lines from the full output.
  if (!response && lines.length > 0) {
    const fallbackLines = [];
    for (let i = 0; i < lines.length; i++) {
      if (!stepIndices.includes(i)) {
        fallbackLines.push(lines[i]);
      }
    }
    response = fallbackLines.join('\n').trim();
  }

  return { steps, response };
}

/**
 * Format progress message as HTML (used while streaming).
 * Shows a dynamic abstract thinking state instead of static 'Thinking'.
 */
function formatProgressHtml(steps, response, agentStateText = '🧠 Đang suy nghĩ...') {
  let html = `<code>${agentStateText}</code>\n\n`;

  // Chuyển Markdown thành HTML Telegram
  const cleanResponse = splitMessageHtml(toTelegramHtml(response));
  html += cleanResponse[0] || '';

  return html;
}

/**
 * Format final steps message as HTML (persisted in chat).
 */
function formatFinalStepsHtml(steps) {
  if (!steps || steps.length === 0) return '';

  let html = `🤖 <b>Nhật ký hoạt động:</b>\n\n`;

  // Deduplicate consecutive identical steps and filter generic thinking
  const uniqueSteps = [];
  let lastTranslated = '';

  steps.forEach(step => {
    const translated = translateStepToVietnamese(step, true);
    if (translated !== lastTranslated && translated !== '💭 Đang suy nghĩ...') {
      uniqueSteps.push(translated);
      lastTranslated = translated;
    }
  });

  if (uniqueSteps.length === 0) return ''; // Don't show log if nothing interesting happened

  uniqueSteps.forEach(step => {
    html += `${step}\n`;
  });

  return html;
}

module.exports = {
  toTelegramHtml,
  splitMessageHtml,
  extractNewTurnOutput,
  parseStdout,
  formatProgressHtml,
  formatFinalStepsHtml,
  translateStepToVietnamese,
  stripAnsi
};
