'use strict';
/**
 * GET /api/ready: is this instance ready to use? Neo4j accepts Bolt connections and firmware has installed its list
 * headers. 200 when both hold, 503 otherwise, naming the condition that doesn't (story brains-launcher #1).
 *
 * An instance that installs firmware on boot (TAPESTRY_FIRMWARE_ON_BOOT=true) also has to have finished: headers are
 * written first, so they are there partway through an install. tools/firmware-on-boot.sh writes the marker when it ends.
 */
const fs = require('fs');

const MARKER = process.env.FIRMWARE_ON_BOOT_MARKER || '/var/lib/brainstorm/firmware-on-boot.installed';

function createReadyHandler(readInstallState, {
  onBoot = process.env.TAPESTRY_FIRMWARE_ON_BOOT === 'true',
  readMarker = () => fs.readFileSync(MARKER, 'utf8'),
} = {}) {
  return async function handleReady(req, res) {
    let state;
    try {
      state = await readInstallState();
    } catch {
      return res.status(503).json({ ready: false, unmet: 'neo4j' });
    }
    if (state.installedCount !== state.totalCount) {
      return res.status(503).json({ ready: false, unmet: 'firmware' });
    }
    if (onBoot) {
      let finished = null;
      try {
        finished = readMarker().trim();
      } catch {
        // No marker yet: the install has not finished.
      }
      if (finished !== String(state.activeVersion)) {
        return res.status(503).json({ ready: false, unmet: 'firmware' });
      }
    }
    return res.json({ ready: true });
  };
}

module.exports = { createReadyHandler };
