const test = require('node:test');
const assert = require('node:assert');
const child_process = require('child_process');
const { EventEmitter } = require('events');
const { Readable } = require('stream');
const { runAgy } = require('../src/agy');

test('Agy CLI Runner Tests', async (t) => {
  await t.test('resolves on successful exit and invokes onChunk', async (t) => {
    t.mock.method(child_process, 'spawn', (command, args) => {
      assert.strictEqual(command, 'agy');
      assert.deepStrictEqual(args, ['--dangerously-skip-permissions', '--print', 'test prompt']);

      const mockProcess = new EventEmitter();
      let stdinClosed = false;
      mockProcess.stdin = {
        end: () => {
          stdinClosed = true;
        }
      };
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });

      process.nextTick(() => {
        assert.ok(stdinClosed, 'stdin should be closed immediately');
        mockProcess.stdout.push('chunk 1 ');
        mockProcess.stdout.push('chunk 2');
        mockProcess.stdout.push(null); // end stream
        
        setImmediate(() => {
          mockProcess.emit('close', 0);
        });
      });

      return mockProcess;
    });

    const chunks = [];
    const result = await runAgy('test prompt', {
      onChunk: (chunk) => chunks.push(chunk)
    });

    assert.strictEqual(result, 'chunk 1 chunk 2');
    assert.deepStrictEqual(chunks, ['chunk 1 ', 'chunk 2']);
  });

  await t.test('passes -c flag if useContinue is true', async (t) => {
    t.mock.method(child_process, 'spawn', (command, args) => {
      assert.strictEqual(command, 'agy');
      assert.deepStrictEqual(args, ['-c', '--dangerously-skip-permissions', '--print', 'test prompt']);

      const mockProcess = new EventEmitter();
      mockProcess.stdin = { end: () => {} };
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });

      process.nextTick(() => {
        mockProcess.stdout.push(null);
        setImmediate(() => {
          mockProcess.emit('close', 0);
        });
      });

      return mockProcess;
    });

    const result = await runAgy('test prompt', { useContinue: true });
    assert.strictEqual(result, '');
  });

  await t.test('rejects on non-zero exit code with stdout and stderr', async (t) => {
    t.mock.method(child_process, 'spawn', (command, args) => {
      const mockProcess = new EventEmitter();
      mockProcess.stdin = { end: () => {} };
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });

      process.nextTick(() => {
        mockProcess.stdout.push('partial output');
        mockProcess.stdout.push(null);
        mockProcess.stderr.push('fatal error');
        mockProcess.stderr.push(null);
        
        setImmediate(() => {
          mockProcess.emit('close', 1);
        });
      });

      return mockProcess;
    });

    await assert.rejects(
      async () => {
        await runAgy('test prompt');
      },
      (err) => {
        assert.match(err.message, /exited with code 1/);
        assert.match(err.message, /Stdout: partial output/);
        assert.match(err.message, /Stderr: fatal error/);
        return true;
      }
    );
  });

  await t.test('rejects on spawn error event', async (t) => {
    t.mock.method(child_process, 'spawn', (command, args) => {
      const mockProcess = new EventEmitter();
      mockProcess.stdin = { end: () => {} };
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });

      process.nextTick(() => {
        mockProcess.emit('error', new Error('Failed to start binary'));
      });

      return mockProcess;
    });

    await assert.rejects(
      async () => {
        await runAgy('test prompt');
      },
      (err) => {
        assert.match(err.message, /Failed to run agy: Failed to start binary/);
        return true;
      }
    );
  });
});
