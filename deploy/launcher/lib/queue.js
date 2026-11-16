'use strict';

/** One operation at a time. Jobs run in the order they were added; one failing does not stop the next. */
function createQueue() {
  let tail = Promise.resolve();
  const waiting = new Map();

  return {
    enqueue(key, job) {
      waiting.set(key, (waiting.get(key) || 0) + 1);
      const run = tail.then(() => {
        const left = waiting.get(key) - 1;
        if (left > 0) waiting.set(key, left); else waiting.delete(key);
        return job();
      });
      tail = run.catch(() => {});
      return run;
    },
    isWaiting: (key) => waiting.has(key),
  };
}

module.exports = { createQueue };
