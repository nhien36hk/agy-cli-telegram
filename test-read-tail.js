const fs = require('fs');
const path = require('path');

function readLastLines(filePath, maxBytes = 16384) {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  const readSize = Math.min(size, maxBytes);
  const buffer = Buffer.alloc(readSize);

  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, readSize, size - readSize);
  fs.closeSync(fd);

  return buffer.toString('utf8');
}

const mockFile = path.join(__dirname, 'mock_tail.jsonl');
fs.writeFileSync(mockFile, 'line1\nline2\nline3\n');
console.log(readLastLines(mockFile, 10)); // Should print 'ine3\n' (last 10 bytes approx)
fs.unlinkSync(mockFile);
