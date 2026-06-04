/**
 * Parses markdown text and escapes/converts it to Telegram-compatible HTML.
 */
function toTelegramHtml(md) {
  if (!md) return '';

  // 1. Escape HTML special characters
  let text = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

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
 * Parses raw stdout stream into checklist steps and clean response content.
 */
function parseStdout(stdout) {
  if (!stdout) return { steps: [], response: '' };

  const lines = stdout.split('\n');
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
    // Show last 5 steps to keep message compact
    const visibleSteps = steps.slice(-5);
    visibleSteps.forEach((step, index) => {
      const isLast = index === visibleSteps.length - 1;
      const emoji = isLast ? '🔄' : '✅';
      html += `${emoji} ${toTelegramHtml(step)}\n`;
    });
    html += `\n`;
  }

  if (activeStdout) {
    const { response } = parseStdout(activeStdout);
    if (response) {
      const preview = response.length > 2000 ? '...(đoạn đầu được ẩn)\n' + response.slice(-2000) : response;
      html += `✍️ <b>Kết quả hiện tại:</b>\n${toTelegramHtml(preview)}`;
    }
  }

  return html;
}

module.exports = {
  toTelegramHtml,
  parseStdout,
  formatProgressHtml
};
