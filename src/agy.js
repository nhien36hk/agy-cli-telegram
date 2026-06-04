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
      child = child_process.spawn(agyBinary, args);
    } catch (err) {
      return reject(new Error(`Failed to spawn agy: ${err.message}`));
    }

    let stdout = '';
    let stderr = '';

    // Handle spawn-level errors (e.g. binary not found)
    child.on('error', (err) => {
      reject(new Error(`Failed to run agy: ${err.message}`));
    });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const chunk = data.toString('utf8');
        stdout += chunk;
        try {
          onChunk(chunk);
        } catch (callbackErr) {
          // Prevent callbacks from breaking our promise flow
          console.error('Error in onChunk callback:', callbackErr);
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString('utf8');
      });
    }

    // Must close child process stdin immediately to prevent hangs
    if (child.stdin) {
      child.stdin.end();
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
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
