'use strict';

/**
 * What the CLI talks to, on a unix socket inside the launcher's container. Going through the running launcher keeps one
 * queue and one writer to the registry. Lines of progress, then one last line of JSON with the result.
 */
function createControlHandler({ brains, log = console.log }) {
  const commands = {
    'POST /roll': (url, say) => brains.roll(url.searchParams.get('tag') || 'dogfood', say),
    'POST /reap': async () => ({ ok: true, reaped: await brains.reap() }),
    'POST /reconcile': async () => { await brains.reconcile(); return { ok: true }; },
    'GET /list': async () => ({ ok: true, brains: brains.list() }),
  };

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://control');
    const command = commands[`${req.method} ${url.pathname}`];
    if (!command) {
      res.writeHead(404);
      res.end(`${JSON.stringify({ ok: false, error: 'no such command' })}\n`);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    try {
      const result = await command(url, (line) => res.write(`${line}\n`));
      res.end(`${JSON.stringify(result)}\n`);
    } catch (err) {
      log(`[launcher] control ${url.pathname}: ${err.stack || err}`);
      res.end(`${JSON.stringify({ ok: false, error: String(err.message || err) })}\n`);
    }
  };
}

module.exports = { createControlHandler };
