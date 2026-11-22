'use strict';
/**
 * The firmware installs running in this process: today's install, POST /api/firmware/install, which install() counts
 * from its first step to its end, whether it returns or throws (story deploy-safety-gate #4, ADR
 * deploy-safety-gate/0004, sub-decision 3).
 *
 * One reader: the deploy-safety answer (src/api/deploy-safety/index.js). While an entry is here, the answer is unsafe
 * with FIRMWARE_INSTALL_RUNNING, so the safe-to-merge check holds any merge that would redeploy this instance mid-install.
 *
 * The count lives only in memory, on purpose. A restart, which is what a deploy's container recreation is, clears it,
 * so nothing it held can read as running afterwards (AC-3). That is why this module requires nothing at all: no file,
 * no process, no network.
 *
 * lifecycle seed-firmware isn't counted here. It can run from a shell, in a process of its own, so the answer reads it
 * from the lifecycle lock instead (sub-decision 4).
 */

const running = new Map();
let nextId = 0;

/** Count `install` as running from now. Returns leave(), which stops counting it; calling leave() again does nothing. */
function enter(install) {
  const id = ++nextId;
  running.set(id, { install, startedAt: new Date().toISOString() });
  return function leave() {
    running.delete(id);
  };
}

/** The installs running now, each { install, startedAt }, sorted by startedAt (the earliest first). A copy. */
function list() {
  return [...running.values()]
    .map((e) => ({ install: e.install, startedAt: e.startedAt }))
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));
}

module.exports = { enter, list };
