'use strict';
/**
 * Implementation one of the backend: a compose project per brain, on the box the launcher runs on. This is the only
 * file in the launcher that knows what a container is. A second implementation (a droplet per brain, say) is a second
 * file with these same verbs:
 *
 *   create({ slug, ownerPubkey, imageTag, onPhase })   make it and wait until it is ready
 *   destroy(slug)                                      stop it and keep its data
 *   restore({ slug, imageTag, onPhase })               start it on its kept data and wait until it is ready; also how a
 *                                                      running brain moves to a new image
 *   purge(slug)                                        delete it and its data
 *   ensureUp(slug)                                     make sure it is up, without waiting for ready
 *   pullImages(imageTag)                               fetch an image version ahead of time
 *   readLog(slug), readPassword(slug)                  what the owner may see
 */
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { renderBrain, parseEnv } = require('../lib/render');

const LOG_TAIL_LINES = 40;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const defaultRun = promisify(execFile);
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createComposeBackend({ brainsDir, caddyContainer, template, getConfig, run = defaultRun, sleep = defaultSleep }) {
  const project = (slug) => `brain-${slug}`;
  const dirOf = (slug) => {
    if (!SLUG_RE.test(slug)) throw new Error(`bad slug: ${slug}`);
    return path.join(brainsDir, slug);
  };
  const file = (slug, name) => path.join(dirOf(slug), name);

  function note(slug, text) {
    fs.appendFileSync(file(slug, 'create.log'), `${new Date().toISOString()} ${text}\n`);
  }

  /** Runs a command and writes it and its output to the brain's log. Nothing run here carries a secret. */
  async function logged(slug, command, args) {
    note(slug, [command, ...args].join(' '));
    try {
      const { stdout, stderr } = await run(command, args, { maxBuffer: 8 * 1024 * 1024, timeout: 20 * 60 * 1000 });
      const output = `${stdout || ''}${stderr || ''}`.trim();
      if (output) note(slug, output);
    } catch (err) {
      note(slug, `failed: ${err.message}`);
      throw err;
    }
  }

  const compose = (slug, ...args) => logged(slug, 'docker', [
    'compose', '-p', project(slug), '--project-directory', dirOf(slug), '-f', file(slug, 'docker-compose.yml'), ...args,
  ]);

  function writeFiles(slug, rendered) {
    fs.writeFileSync(file(slug, 'docker-compose.yml'), rendered.compose);
    const envFile = file(slug, '.env');
    const tmp = `${envFile}.tmp`;
    fs.writeFileSync(tmp, rendered.envText, { mode: 0o600 });
    fs.renameSync(tmp, envFile);
  }

  async function attachCaddy(slug) {
    const args = ['network', 'connect', `${project(slug)}_default`, caddyContainer];
    try {
      await run('docker', args);
      note(slug, `docker ${args.join(' ')}`);
    } catch (err) {
      if (!/already exists/.test(err.message)) throw err;
    }
  }

  async function detachCaddy(slug) {
    try {
      await run('docker', ['network', 'disconnect', `${project(slug)}_default`, caddyContainer]);
    } catch {
      // Not attached, or the network is already gone.
    }
  }

  async function waitReady(slug) {
    const { readyTimeoutSeconds, readyPollSeconds } = getConfig();
    const deadline = Date.now() + readyTimeoutSeconds * 1000;
    do {
      try {
        await run('docker', ['exec', `${project(slug)}-tapestry`, 'curl', '-sf', 'http://localhost/api/ready']);
        note(slug, 'ready');
        return;
      } catch {
        await sleep(readyPollSeconds * 1000);
      }
    } while (Date.now() < deadline);
    note(slug, `did not get ready in ${readyTimeoutSeconds} seconds`);
    throw new Error(`${slug} did not get ready in ${readyTimeoutSeconds} seconds`);
  }

  function readEnv(slug) {
    const envFile = file(slug, '.env');
    return fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
  }

  return {
    brainsDir,

    async create({ slug, ownerPubkey, imageTag, onPhase = () => {} }) {
      fs.mkdirSync(dirOf(slug), { recursive: true });
      writeFiles(slug, renderBrain({ slug, ownerPubkey, imageTag, config: getConfig(), template }));
      onPhase('starting containers');
      await compose(slug, 'up', '-d', '--pull', 'missing');
      await attachCaddy(slug);
      onPhase('waiting for Neo4j and firmware');
      await waitReady(slug);
    },

    async destroy(slug) {
      fs.mkdirSync(dirOf(slug), { recursive: true });
      await detachCaddy(slug);
      await compose(slug, 'down');
    },

    async restore({ slug, imageTag, onPhase = () => {} }) {
      const env = readEnv(slug);
      if (!env.OWNER_PUBKEY) throw new Error(`${slug} has no saved settings to start from`);
      writeFiles(slug, renderBrain({
        slug, ownerPubkey: env.OWNER_PUBKEY, imageTag, config: getConfig(), template, neo4jPassword: env.NEO4J_PASSWORD,
      }));
      onPhase('starting containers');
      await compose(slug, 'up', '-d', '--pull', 'missing');
      await attachCaddy(slug);
      onPhase('waiting for Neo4j and firmware');
      await waitReady(slug);
    },

    async purge(slug) {
      const dir = dirOf(slug);
      if (!fs.existsSync(dir)) return;
      await detachCaddy(slug);
      await compose(slug, 'down', '-v');
      fs.rmSync(dir, { recursive: true, force: true });
    },

    async ensureUp(slug) {
      await compose(slug, 'up', '-d');
      await attachCaddy(slug);
    },

    async pullImages(imageTag) {
      const { image, searchImage } = getConfig();
      await run('docker', ['pull', `${image}:${imageTag}`], { maxBuffer: 8 * 1024 * 1024, timeout: 20 * 60 * 1000 });
      await run('docker', ['pull', `${searchImage}:${imageTag}`], { maxBuffer: 8 * 1024 * 1024, timeout: 20 * 60 * 1000 });
    },

    readLog(slug) {
      const log = file(slug, 'create.log');
      if (!fs.existsSync(log)) return '';
      return fs.readFileSync(log, 'utf8').trimEnd().split('\n').slice(-LOG_TAIL_LINES).join('\n');
    },

    readPassword(slug) {
      return readEnv(slug).NEO4J_PASSWORD ?? '';
    },
  };
}

module.exports = { createComposeBackend };
