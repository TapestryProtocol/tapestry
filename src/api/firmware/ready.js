'use strict';
/**
 * GET /api/ready: is this instance ready to use? Neo4j accepts Bolt connections and firmware has installed its list
 * headers. 200 when both hold, 503 otherwise, naming the condition that doesn't (story brains-launcher #1).
 */

function createReadyHandler(readInstallState) {
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
    return res.json({ ready: true });
  };
}

module.exports = { createReadyHandler };
