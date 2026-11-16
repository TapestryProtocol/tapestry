'use strict';
const nodeFs = require('node:fs');
const path = require('node:path');

const ILLEGAL_TRANSITION = 'illegal-transition';

/**
 * running -> failed: a roll stopped on this brain.
 * stopped -> failed: a restore did not come back.
 * stopped -> creating: the owner chose to start fresh.
 * failed -> creating: retry.
 * failed -> stopped: destroy, for a brain that has run and so has data worth a grace period.
 * failed -> destroyed: destroy, for a brain that never reached running.
 */
const TRANSITIONS = Object.freeze({
  creating: ['running', 'failed'],
  running: ['stopped', 'failed'],
  stopped: ['running', 'failed', 'destroyed', 'creating'],
  failed: ['creating', 'stopped', 'destroyed'],
  destroyed: [],
});

function createRegistry({ file, fsImpl = nodeFs }) {
  let brains = [];
  if (fsImpl.existsSync(file)) brains = JSON.parse(fsImpl.readFileSync(file, 'utf8')).brains;

  /** Writes to a temp file, then renames it over the old one. Memory moves only once the disk has. */
  function commit(next) {
    const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
    const fd = fsImpl.openSync(tmp, 'w', 0o600);
    try {
      fsImpl.writeSync(fd, `${JSON.stringify({ brains: next }, null, 2)}\n`);
      fsImpl.fsyncSync(fd);
    } finally {
      fsImpl.closeSync(fd);
    }
    fsImpl.renameSync(tmp, file);
    brains = next;
  }

  const live = (r) => r.status !== 'destroyed';

  function find(slug) {
    return brains.find((r) => r.slug === slug && live(r));
  }

  function replace(slug, change) {
    const current = find(slug);
    if (!current) throw new Error(`no live brain named ${slug}`);
    const updated = { ...current, ...change };
    commit(brains.map((r) => (r === current ? updated : r)));
    return updated;
  }

  return {
    list: () => brains.slice(),
    live: () => brains.filter(live),
    find,
    add(record) {
      if (find(record.slug)) throw new Error(`${record.slug} is taken`);
      commit([...brains, record]);
      return record;
    },
    transition(slug, to, change = {}) {
      const current = find(slug);
      if (!current) throw new Error(`no live brain named ${slug}`);
      if (!TRANSITIONS[current.status].includes(to)) {
        const err = new Error(`${slug} cannot go from ${current.status} to ${to}`);
        err.code = ILLEGAL_TRANSITION;
        throw err;
      }
      return replace(slug, { ...change, status: to });
    },
    patch(slug, change) {
      if ('status' in change) throw new Error('patch cannot change status; use transition');
      return replace(slug, change);
    },
  };
}

module.exports = { createRegistry, ILLEGAL_TRANSITION, TRANSITIONS };
