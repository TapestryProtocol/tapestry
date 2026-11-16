'use strict';
/**
 * Loopback calls into a scratch Tapestry container (scripts/scratch-stack.sh), for the live checks of
 * graph-operations-foundation #8. Every call goes through `docker exec <container> curl` to the control panel on
 * 127.0.0.1:7778 inside the container, the path scripts/scratch-stack.sh and the other live suites take.
 *
 * These helpers write (fixtures, rebuilds, a firmware install), so they refuse any container whose name doesn't
 * start with `tapestry-scratch`: never the shared `tapestry` stack, which on the owner's Mac is the instance an agent's
 * memory lives in.
 */

const { execFileSync } = require('child_process');

const BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;
const SCRATCH_NAME = /^tapestry-scratch/;

function container() { return process.env.TAPESTRY_CONTAINER || ''; }

/** Why the live checks can't run here, or '' when TAPESTRY_CONTAINER names a reachable scratch container. */
function scratchRefusal() {
  const c = container();
  if (!c) return 'TAPESTRY_CONTAINER is not set';
  if (!SCRATCH_NAME.test(c)) return `TAPESTRY_CONTAINER is '${c}', not a scratch container (its name must start with tapestry-scratch)`;
  try {
    const r = http('GET', '/api/tapestry-key/derive-status', undefined, 60);
    if (r.status !== 200 || !r.json || r.json.success !== true) return `container '${c}' doesn't answer GET /api/tapestry-key/derive-status (HTTP ${r.status})`;
  } catch (e) {
    return `container '${c}' is unreachable via docker exec (${String(e.message).split('\n')[0]})`;
  }
  return '';
}

function assertScratch() {
  const c = container();
  if (!SCRATCH_NAME.test(c)) throw new Error(`refusing to touch container '${c}': only a scratch container (tapestry-scratch…) may be written by this suite`);
  return c;
}

/** One HTTP call inside the container. Answers { status, json, text, seconds } — seconds is curl's own time_total. */
function http(method, path, body, maxSeconds = 120) {
  const c = assertScratch();
  const args = ['exec', '-i', c, 'curl', '-s', '-m', String(maxSeconds), '-X', method, '-w', '\n@@%{http_code} %{time_total}'];
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '--data-binary', '@-');
  args.push(`${BASE}${path}`);
  const out = execFileSync('docker', args, { input: body === undefined ? '' : JSON.stringify(body), encoding: 'utf8', maxBuffer: 256 << 20, timeout: (maxSeconds + 30) * 1000 });
  const at = out.lastIndexOf('\n@@');
  const text = out.slice(0, at);
  const [code, secs] = out.slice(at + 3).trim().split(' ');
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: Number(code), json, text, seconds: Number(secs) };
}

/** Rows of a Cypher statement through POST /api/neo4j/query (a loopback call is the trusted local operator). */
function cypher(q, params = {}, maxSeconds = 600) {
  const r = http('POST', '/api/neo4j/query', { cypher: q, params }, maxSeconds);
  if (!r.json || r.json.success !== true) throw new Error(`Cypher failed (HTTP ${r.status}): ${String((r.json && r.json.error) || r.text).slice(0, 300)} — ${q.replace(/\s+/g, ' ').slice(0, 200)}`);
  return r.json.data || [];
}

/** A shell command inside the container (output as text). */
function sh(command, maxSeconds = 120) {
  const c = assertScratch();
  return execFileSync('docker', ['exec', c, 'sh', '-c', command], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: maxSeconds * 1000 });
}

function taPubkey() {
  const r = http('GET', '/api/assistant/pubkey');
  if (!r.json || !r.json.pubkey) throw new Error(`no assistant pubkey from GET /api/assistant/pubkey (HTTP ${r.status})`);
  return r.json.pubkey;
}

/** The scratch graph's size: all nodes, and the trust pipeline's card sets (count-store reads). */
function graphShape() {
  const all = cypher('MATCH (n) RETURN count(n) AS c')[0].c;
  const cardSets = cypher('MATCH (n:SetOfNostrUserWotMetricsCards) RETURN count(n) AS c')[0].c;
  return { all: Number(all), cardSets: Number(cardSets) };
}

module.exports = { BASE, SCRATCH_NAME, container, scratchRefusal, assertScratch, http, cypher, sh, taPubkey, graphShape };
