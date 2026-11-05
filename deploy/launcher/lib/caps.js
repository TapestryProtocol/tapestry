'use strict';

/** The brains that hold memory right now. Stopped ones hold only disk, which the floor covers. */
const HOLDS_MEMORY = new Set(['creating', 'running', 'failed']);

/** Returns null when the owner can have one more brain, or { code, message } saying why not. */
function checkCaps({ brains, owner, config, freeDiskGb }) {
  const active = brains.filter((b) => HOLDS_MEMORY.has(b.status));
  if (active.filter((b) => b.ownerPubkey === owner).length >= config.maxBrainsPerOwner) {
    return { code: 'owner-cap', message: `You already have ${config.maxBrainsPerOwner} brains, which is the limit per person. Destroy one first.` };
  }
  if (active.length >= config.maxBrainsTotal) {
    return { code: 'total-cap', message: `This box is full: it holds ${config.maxBrainsTotal} brains. Someone has to destroy one, or the box has to grow.` };
  }
  if (freeDiskGb < config.minFreeDiskGb) {
    return { code: 'disk-floor', message: `The disk has under ${config.minFreeDiskGb} GB free, so no new brains until there is more room.` };
  }
  return null;
}

module.exports = { checkCaps };
