'use strict';
/**
 * Today's importers, run stack-free — as a CHILD PROCESS (`node test/helpers/todaysImportersChild.js <spec.json>
 * <out.json>`), never required in-process. Story graph-operations-first-slice #34, AC6; ADR
 * graph-operations-first-slice/0034 Decision 10: export's letters never come back over their nodes through
 * POST /api/neo4j/event-update, the I/O import or the client-publish route's brain-write hook.
 *
 * Each handler runs as it is, its real code: it shells out and calls the driver as in the container, and finds
 *   - a `strfry` and a `cypher-shell` first on its PATH (test/helpers/todaysImportersStubs.js), which answer from
 *     spec.strfry (the events strfry holds, a JSON list in a file) and run every statement on the graph in spec.state
 *     with test/helpers/cypherEngine.js;
 *   - src/lib/neo4j-driver.js's runCypher and writeCypher running on that same graph with the same engine, and
 *     getDriver refused, since nothing here may reach Neo4j;
 *   - src/operations/graph.js's read and writeTransaction from test/helpers/cypherGraphFake.js, over that same graph.
 * So whichever way a handler reads the graph, it reads the one graph, and every statement it runs is logged.
 *
 * spec: { root, state, strfry, log, bin, run: { handler, ... } }, handler one of
 *   event-update  { uuid }            handleEventUpdate({ body: { uuid } }) → { status, body }
 *   io-import     { items: [{ slug, event, word }] }  the upload (a zip of manifest.json, raw/<slug>.event.json and
 *                                     <slug>.json, made here with adm-zip) and then the execute of every slug, through
 *                                     the handlers registerIORoutes registers → { upload, execute }, each { status, body }
 *   brain-write   { event }           maybeBrainWriteTapestry(event) → { report }
 *   holds         { events: [...] }   src/operations/catalog/export/_own.js's holdsLetterOrNewer(read, event) for each,
 *                                     read being the graph seam's read → { answers: [...] }
 * It writes { error, answer, log } to <out.json>, log being every line the stubs and fakes wrote: { at: 'strfry', cmd,
 * … }, { at: 'cypher-shell', query }, { at: 'driver', call, query } and { at: 'seam', call, query }.
 */

const fs = require('fs');
const path = require('path');

const SPEC = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const ROOT = path.resolve(spec.root || path.join(__dirname, '..', '..'));
const result = { error: null, answer: null, log: [] };
const oneLine = (q) => String(q).replace(/\s+/g, ' ').trim().slice(0, 600);
const log = (entry) => fs.appendFileSync(spec.log, `${JSON.stringify(entry)}\n`);

function finish(code) {
  try { result.log = fs.readFileSync(spec.log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { result.log = []; }
  fs.writeFileSync(OUT, JSON.stringify(result));
  process.exit(code);
}
const timer = setTimeout(() => { result.error = 'the importers child timed out after 60 s'; finish(1); }, 60000);
timer.unref();

// 1. The stubs, first on PATH, for every shell a handler opens.
fs.mkdirSync(spec.bin, { recursive: true });
for (const tool of ['strfry', 'cypher-shell']) {
  const f = path.join(spec.bin, tool);
  fs.writeFileSync(f, `#!/bin/sh\nexec "${process.execPath}" "${path.join(__dirname, 'todaysImportersStubs.js')}" ${tool} "$@"\n`);
  fs.chmodSync(f, 0o755);
}
process.env.PATH = `${spec.bin}${path.delimiter}${process.env.PATH}`;
process.env.TODAYS_STUB_STATE = spec.state;
process.env.TODAYS_STUB_STRFRY = spec.strfry;
process.env.TODAYS_STUB_LOG = spec.log;

// 2. The driver, on the same graph, before any handler loads it.
const E = require(path.join(__dirname, 'cypherEngine.js'));
const CG = require(path.join(__dirname, 'cypherGraphFake.js'));
const driver = require(path.join(ROOT, 'src/lib/neo4j-driver.js'));
const onGraph = (call) => async (cypher, params = {}) => {
  log({ at: 'driver', call, query: oneLine(cypher) });
  const state = CG.readState(spec.state);
  const r = E.run(state, cypher, params || {}, { write: true });
  if (E.danglingRels(state).length) throw Object.assign(new Error('Cannot delete a node, because it still has relationships (the importers child)'), { code: 'Neo.ClientError.Schema.ConstraintValidationFailed' });
  CG.writeState(spec.state, state);
  return r.rows;
};
driver.runCypher = onGraph('runCypher');
driver.writeCypher = onGraph('writeCypher');
driver.getDriver = () => { throw new Error('the importers child has no Neo4j: a handler reached for the driver itself'); };

// 3. The operations' graph seam, on the same graph.
const seam = require(path.join(ROOT, 'src/operations/graph.js'));
const fake = CG.fakeGraph(spec.state);
seam.read = async (cypher, params) => { log({ at: 'seam', call: 'read', query: oneLine(cypher) }); return fake.read(cypher, params); };
seam.writeTransaction = async (work) => fake.writeTransaction((tx) => work({
  run: (c, p) => { log({ at: 'seam', call: 'tx.run', query: oneLine(c) }); return tx.run(c, p); },
  read: (c, p) => { log({ at: 'seam', call: 'tx.read', query: oneLine(c) }); return tx.read(c, p); },
}));

// Their logging goes to stderr, so the parent's captured stdout stays small.
for (const k of ['log', 'info', 'debug']) console[k] = (...a) => process.stderr.write(`${a.join(' ')}\n`);

function fakeRes(resolve) {
  return {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(body) { resolve({ status: this.statusCode, body }); return this; },
    send(body) { resolve({ status: this.statusCode, body }); return this; },
  };
}
const call = (handler, req) => new Promise((resolve, reject) => {
  Promise.resolve(handler(req, fakeRes(resolve))).catch(reject);
});

async function main() {
  const run = spec.run || {};
  if (run.handler === 'event-update') {
    const { handleEventUpdate } = require(path.join(ROOT, 'src/api/neo4j/eventSync.js'));
    result.answer = await call(handleEventUpdate, { body: { uuid: run.uuid } });
  } else if (run.handler === 'io-import') {
    const routes = {};
    const app = { get: (p, ...h) => { routes[`GET ${p}`] = h[h.length - 1]; }, post: (p, ...h) => { routes[`POST ${p}`] = h[h.length - 1]; } };
    require(path.join(ROOT, 'src/api/io.js')).registerIORoutes(app);
    const AdmZip = require(require.resolve('adm-zip', { paths: [ROOT] }));
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({ version: 1, words: run.items.map((x) => ({ slug: x.slug })) })));
    for (const x of run.items) {
      zip.addFile(`raw/${x.slug}.event.json`, Buffer.from(JSON.stringify(x.event)));
      if (x.word) zip.addFile(`${x.slug}.json`, Buffer.from(JSON.stringify(x.word)));
    }
    const upload = await call(routes['POST /api/io/imports/upload'], { file: { buffer: zip.toBuffer() }, body: {} });
    const tempId = upload.body && upload.body.tempId;
    const execute = tempId ? await call(routes['POST /api/io/imports/:tempId/execute'], { params: { tempId }, body: { slugs: run.items.map((x) => x.slug) } }) : null;
    result.answer = { upload, execute };
  } else if (run.handler === 'brain-write') {
    const { maybeBrainWriteTapestry } = require(path.join(ROOT, 'src/api/strfry/tapestryBrainWrite.js'));
    result.answer = { report: await maybeBrainWriteTapestry(run.event) };
  } else if (run.handler === 'holds') {
    const file = path.join(ROOT, 'src/operations/catalog/export/_own.js');
    if (!fs.existsSync(file)) throw new Error('src/operations/catalog/export/_own.js does not exist yet (ADR graph-operations-first-slice/0034 Decision 10)');
    const own = require(file);
    if (typeof own.holdsLetterOrNewer !== 'function') throw new Error('src/operations/catalog/export/_own.js exports no holdsLetterOrNewer(read, event) (ADR graph-operations-first-slice/0034 Decision 10)');
    const answers = [];
    for (const e of run.events) answers.push(await own.holdsLetterOrNewer((c, p) => seam.read(c, p), e));
    result.answer = { answers };
  } else {
    throw new Error(`no handler ${JSON.stringify(run.handler)}`);
  }
}

main().then(() => finish(0), (err) => { result.error = (err && err.message) || String(err); finish(0); });
