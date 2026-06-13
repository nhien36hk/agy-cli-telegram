const queues = new Map();
const running = new Map();

/**
 * Enqueues a task for a specific chatId and executes it sequentially.
 *
 * @param {string|number} chatId - Unique ID of the chat/session.
 * @param {object} task - Task parameters.
 * @param {function} executeCallback - The async function to run the task.
 * @param {function} onQueueAdded - Callback invoked if the task was added to queue (returns position).
 */
async function enqueue(chatId, task, executeCallback, onQueueAdded) {
  if (!queues.has(chatId)) {
    queues.set(chatId, []);
  }

  if (running.get(chatId)) {
    queues.get(chatId).push({ task, executeCallback });
    const position = queues.get(chatId).length;
    if (onQueueAdded) {
      await onQueueAdded(position);
    }
    return;
  }

  running.set(chatId, true);
  await runTask(chatId, task, executeCallback);
}

/**
 * Runs a task and schedules the next one in the queue if any.
 */
async function runTask(chatId, task, executeCallback) {
  try {
    await executeCallback(task);
  } catch (err) {
    console.error(`[Queue] Error executing task for chat ${chatId}:`, err);
  } finally {
    const q = queues.get(chatId);
    if (q && q.length > 0) {
      const next = q.shift();
      // Use setTimeout to yield execution to the event loop and prevent deep call stacks
      setTimeout(() => runTask(chatId, next.task, next.executeCallback), 0);
    } else {
      running.set(chatId, false);
    }
  }
}

module.exports = {
  enqueue,
  queues,
  running
};
