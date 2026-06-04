const child_process = require('child_process');

/**
 * Runs the agy CLI tool.
 *
 * @param {string} promptText The user prompt to pass to agy.
 * @param {object} options
 * @param {boolean} [options.useContinue] Set to true to pass the -c flag.
 * @param {function} [options.onChunk] Callback for each chunk of stdout received.
 * @param {string} [options.agyBinary] Optional binary path override (mainly for testing).
 * @returns {Promise<string>} Resolves with the final accumulated stdout output.
 */
function runAgy(promptText, options = {}) {
  return new Promise((resolve, reject) => {
    const useContinue = !!options.useContinue;
    const onChunk = options.onChunk || (() => {});
    const agyBinary = options.agyBinary || 'agy';

    const args = [];
    if (useContinue) {
      args.push('-c');
    }
    args.push('--dangerously-skip-permissions');
    args.push('--print');
    args.push(promptText);

    let child;
    try {
      child = child_process.spawn(agyBinary, args, {
        env: { ...process.env, COLUMNS: '10000' }
      });
    } catch (err) {
      return reject(new Error(`Failed to spawn agy: ${err.message}`));
    }

    let stdout = '';
    let stderr = '';
    const { StringDecoder } = require('string_decoder');
    const stdoutDecoder = new StringDecoder('utf8');
    const stderrDecoder = new StringDecoder('utf8');
    
    // Timing heuristic state to guess history boundary when cache misses
    let lastChunkTime = Date.now();
    let historyLength = 0;
    let isHistoryCollected = false;

    // Handle spawn-level errors (e.g. binary not found)
    child.on('error', (err) => {
      reject(new Error(`Failed to run agy: ${err.message}`));
    });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const now = Date.now();
        const chunk = stdoutDecoder.write(data);
        
        // If there's a >1000ms pause and we are continuing, assume previous stdout is history
        if (useContinue && !isHistoryCollected && stdout.length > 0 && (now - lastChunkTime > 1000)) {
          isHistoryCollected = true;
          historyLength = stdout.length;
        }
        
        stdout += chunk;
        lastChunkTime = now;
        
        try {
          onChunk(stdout, historyLength);
        } catch (callbackErr) {
          // Prevent callbacks from breaking our promise flow
          console.error('Error in onChunk callback:', callbackErr);
        }
      });
      child.stdout.on('end', () => {
        stdout += stdoutDecoder.end();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += stderrDecoder.write(data);
      });
      child.stderr.on('end', () => {
        stderr += stderrDecoder.end();
      });
    }

    // Must close child process stdin immediately to prevent hangs
    if (child.stdin) {
      child.stdin.end();
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, historyLength });
      } else {
        const errorMsg = `agy process exited with code ${code}.\nStdout: ${stdout}\nStderr: ${stderr}`;
        reject(new Error(errorMsg));
      }
    });
  });
}

module.exports = {
  runAgy
};
