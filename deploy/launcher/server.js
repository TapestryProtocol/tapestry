#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createComposeBackend } = require('./backends/compose');
const { createBrains } = require('./lib/brains');
const { createConfig } = require('./lib/config');
const { createControlHandler } = require('./lib/control');
const { createHandler } = require('./lib/http');
const { createQueue } = require('./lib/queue');
const { createRegistry } = require('./lib/registry');

const LAUNCHER_DIR = process.env.LAUNCHER_DIR || '/opt/launcher';
const BRAINS_DIR = process.env.BRAINS_DIR || '/opt/brains';
const TEMPLATE = process.env.BRAIN_TEMPLATE || path.join(__dirname, '../templates/brain.compose.yml');
const CONTROL_SOCKET = process.env.LAUNCHER_CONTROL_SOCKET || '/run/launcher/control.sock';
const PORT = Number(process.env.PORT || 9000);

const config = createConfig({ configDir: path.join(LAUNCHER_DIR, 'config') });
const getConfig = () => config.current();

const brains = createBrains({
  registry: createRegistry({ file: path.join(LAUNCHER_DIR, 'registry.json') }),
  backend: createComposeBackend({
    brainsDir: BRAINS_DIR,
    caddyContainer: process.env.CADDY_CONTAINER || 'edge-caddy',
    template: fs.readFileSync(TEMPLATE, 'utf8'),
    getConfig,
  }),
  queue: createQueue(),
  getConfig,
  freeDiskGb: async () => {
    const s = await fs.promises.statfs(BRAINS_DIR);
    return (s.bavail * s.bsize) / (1024 ** 3);
  },
});

http.createServer(createHandler({ brains, config, publicDir: path.join(__dirname, 'public') }))
  .listen(PORT, () => console.log(`[launcher] listening on ${PORT}`));

fs.mkdirSync(path.dirname(CONTROL_SOCKET), { recursive: true });
fs.rmSync(CONTROL_SOCKET, { force: true });
http.createServer(createControlHandler({ brains })).listen(CONTROL_SOCKET, () => {
  fs.chmodSync(CONTROL_SOCKET, 0o600);
  console.log(`[launcher] control socket at ${CONTROL_SOCKET}`);
});

process.on('SIGHUP', () => config.reload());
process.on('SIGTERM', () => process.exit(0));

brains.reconcile().catch((err) => console.log(`[launcher] reconcile: ${err.stack || err}`));
