'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { verifyNip98 } = require('./nip98');
const { Refusal } = require('./refusal');

const MAX_BODY_BYTES = 4096;
const SLUG = '([a-z0-9][a-z0-9-]*)';
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/page.js': ['page.js', 'text/javascript; charset=utf-8'],
  '/page.css': ['page.css', 'text/css; charset=utf-8'],
};
const HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
};

function sendJson(res, status, body) {
  res.writeHead(status, { ...HEADERS, 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Refusal(413, 'too-big', 'That request is too big.'));
        req.resume();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** The public face of the launcher. Every request but the page, the status read and /ask carries a NIP-98 signature. */
function createHandler({ brains, config, publicDir, log = console.log, nowSeconds = () => Math.floor(Date.now() / 1000) }) {
  const authenticate = (req, body) => {
    const check = verifyNip98({
      header: req.headers.authorization,
      method: req.method,
      url: `${config.current().baseUrl}${req.url}`,
      body,
      now: nowSeconds(),
    });
    if (!check.ok) throw new Refusal(401, 'bad-signature', 'That signature did not check out. Sign in again.');
    if (!config.isAllowed(check.pubkey)) throw new Refusal(403, 'not-allowlisted', 'This key is not on the list for this launcher.');
    return check.pubkey;
  };

  const routes = [
    ['GET', /^\/api\/brains$/, async (signer) => ({ status: 200, body: { brains: brains.list(), you: signer } })],
    ['POST', /^\/api\/brains$/, async (signer, _, rawBody) => {
      let parsed;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        throw new Refusal(400, 'bad-body', 'That request was not valid JSON.');
      }
      return { status: 202, body: await brains.create(signer, parsed?.slug) };
    }],
    ['GET', new RegExp(`^/api/brains/${SLUG}$`), async (signer, m) => ({ status: 200, body: brains.detail(signer, m[1]) })],
    ['DELETE', new RegExp(`^/api/brains/${SLUG}$`), async (signer, m) => ({ status: 202, body: await brains.destroy(signer, m[1]) })],
    ['POST', new RegExp(`^/api/brains/${SLUG}/restore$`), async (signer, m) => ({ status: 202, body: await brains.restore(signer, m[1]) })],
    ['POST', new RegExp(`^/api/brains/${SLUG}/fresh$`), async (signer, m) => ({ status: 202, body: await brains.startFresh(signer, m[1]) })],
  ];

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://launcher');
    try {
      if (req.method === 'GET' && STATIC[url.pathname] && !req.url.includes('..')) {
        const [name, type] = STATIC[url.pathname];
        res.writeHead(200, { ...HEADERS, 'content-type': type });
        res.end(fs.readFileSync(path.join(publicDir, name)));
        return;
      }

      // Caddy asks directly. Anything that came through a proxy carries a forwarding header, and gets no answer here.
      if (req.method === 'GET' && url.pathname === '/ask') {
        const allowed = !req.headers['x-forwarded-for'] && brains.askAllowed(url.searchParams.get('domain') ?? undefined);
        res.writeHead(allowed ? 200 : 404, HEADERS);
        res.end();
        return;
      }

      const statusRead = req.method === 'GET' && url.pathname.match(new RegExp(`^/api/brains/${SLUG}/status$`));
      if (statusRead) {
        const status = brains.publicStatus(statusRead[1]);
        if (!status) throw new Refusal(404, 'not-found', 'There is no brain by that name.');
        sendJson(res, 200, status);
        return;
      }

      for (const [method, pattern, route] of routes) {
        const match = req.method === method && url.pathname.match(pattern);
        if (match) {
          const rawBody = await readBody(req);
          const signer = authenticate(req, rawBody);
          const { status, body } = await route(signer, match, rawBody);
          sendJson(res, status, body);
          return;
        }
      }
      throw new Refusal(404, 'not-found', 'Nothing here.');
    } catch (err) {
      if (err instanceof Refusal) {
        sendJson(res, err.http, { error: err.code, message: err.message });
      } else {
        log(`[launcher] ${req.method} ${url.pathname}: ${err.stack || err}`);
        sendJson(res, 500, { error: 'server-error', message: 'Something went wrong on the launcher.' });
      }
    }
  };
}

module.exports = { createHandler };
