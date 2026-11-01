'use strict';
/**
 * Story security-auth-exposure #11: a config file bash can't parse never reaches a log
 * (the rest of ngit issue c549202b, after stories 9 and 10).
 * ADR:       engineering-team/decisions/security-auth-exposure/0006-refuse-unsafe-conf-at-render.md
 * Test plan: engineering-team/stories/security-auth-exposure/11-unparseable-config-never-logged.test-plan.md
 *
 * Stack-free. Three groups:
 *   - The render step (AC-1, AC-2, AC-5): tools/render-conf-template.js and tools/check-conf-syntax.sh run as child
 *     processes against fixture templates, fixture confs and fixture environments, on the host's bash. Every
 *     fixture value is distinctive, and the whole child's stdout and stderr are searched for it.
 *   - The entrypoint's wiring (AC-1) and the template's shape (ADR 0006, Option C as a test): checked on source.
 *   - The tree scan (AC-3, AC-4): every exec-family call under src/, lib/ and bin/ whose command runs `source` keeps
 *     bash's stderr out and logs its error only as `.status`. This widens story 10's fixed list (its suite stays as
 *     it is). The scan is shown to find the calls it should, and to flag an unpatched one.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const RENDERER = path.join(REPO, 'tools/render-conf-template.js');
const CHECKER = path.join(REPO, 'tools/check-conf-syntax.sh');
const TEMPLATE = path.join(REPO, 'config/brainstorm.conf.template');
const ENTRYPOINT = path.join(REPO, 'docker/entrypoint.sh');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const hex = (n) => crypto.randomBytes(n).toString('hex');

let TMP;
function tmp() {
  if (!TMP) TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'config-parse-leak-'));
  return TMP;
}
function writeTmp(name, text) {
  const p = path.join(tmp(), name);
  fs.writeFileSync(p, text);
  return p;
}

// ── The render step ──────────────────────────────────────────────────────────────────────────────

function runChecker(confPath) {
  assert(fs.existsSync(CHECKER), 'tools/check-conf-syntax.sh does not exist (ADR 0006, Implementation notes)');
  const r = spawnSync('bash', [CHECKER, confPath], { encoding: 'utf8', timeout: 30000 });
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Render `template` with `vars` added to a minimal environment; returns status, stdout, stderr.
function render(templatePath, vars) {
  const env = { PATH: process.env.PATH, ...vars };
  const r = spawnSync(process.execPath, [RENDERER, templatePath], { env, encoding: 'utf8', timeout: 30000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Source `confPath` in a fresh bash and print the named variables, one per line, NUL-free.
function sourceAndRead(confPath, names) {
  const script = `source "$1" >/dev/null 2>&1; for n in ${names.join(' ')}; do printf '%s\\x1f' "\${!n}"; done`;
  const r = spawnSync('bash', ['-c', script, '_', confPath], { encoding: 'utf8', timeout: 30000 });
  const values = (r.stdout || '').split('\x1f');
  return Object.fromEntries(names.map((n, i) => [n, values[i]]));
}

test('AC-1 check-conf-syntax: a conf bash can\'t parse is refused, with a line number and without the value', () => {
  const secret = hex(12);
  const conf = writeTmp('unclosed.conf',
    `export NEO4J_USER="neo4j"\nexport NEO4J_PASSWORD="pw"${secret}"\nexport B="2"\nexport C="3"\n`);
  const r = runChecker(conf);
  assert(r.status !== 0, `the checker exited 0 on a conf bash can't parse (output ${JSON.stringify(r.out)})`);
  assert(r.status !== 127, 'the checker could not be run (status 127)');
  assert(/line\s+\d+/i.test(r.out), `the refusal names no line number: ${JSON.stringify(r.out)}`);
  assert(!r.out.includes(secret), `the refusal prints the value: ${JSON.stringify(r.out)}`);
  assert(!/NEO4J_PASSWORD=/.test(r.out), `the refusal prints the line: ${JSON.stringify(r.out)}`);
});

test('AC-1 check-conf-syntax: a line `bash -n` would echo itself never reaches the output', () => {
  // bash -n prints the whole offending line on a second line for this kind of error (probed 2026-10-31).
  const secret = hex(12);
  const conf = writeTmp('echoed.conf', `export A="1"\nB=pw)${secret}\nexport C="3"\n`);
  const probe = spawnSync('bash', ['-n', conf], { encoding: 'utf8' });
  assert(probe.status !== 0 && (probe.stderr || '').includes(secret),
    'precondition: bash -n on this fixture should fail and echo the line, or the test proves nothing');
  const r = runChecker(conf);
  assert(r.status !== 0 && r.status !== 127, `the checker exited ${r.status} on a conf bash can't parse`);
  assert(/line\s+2\b/i.test(r.out), `the refusal doesn't name line 2: ${JSON.stringify(r.out)}`);
  assert(!r.out.includes(secret), `the refusal prints the value: ${JSON.stringify(r.out)}`);
});

test('AC-1/AC-5 check-conf-syntax: a well-formed conf passes silently', () => {
  const conf = writeTmp('good.conf', `# comment\nexport A="1"\nB='two words'\nexport C\nD=plain\n`);
  const r = runChecker(conf);
  assert(r.status === 0, `the checker refused a well-formed conf (status ${r.status}, ${JSON.stringify(r.out)})`);
  assert(r.out === '', `the checker printed something for a well-formed conf: ${JSON.stringify(r.out)}`);
});

test('AC-1 entrypoint: the rendered conf is checked before any service starts, and a failure stops the boot', () => {
  const src = fs.readFileSync(ENTRYPOINT, 'utf8');
  const renderAt = src.indexOf('render-conf-template.js');
  const checkAt = src.search(/check-conf-syntax\.sh["']?\s+["']?\/etc\/brainstorm\.conf/);
  const supervisordAt = src.indexOf('exec /usr/bin/supervisord');
  assert(renderAt !== -1 && supervisordAt !== -1, 'the entrypoint no longer renders the conf or starts supervisord');
  assert(checkAt !== -1, 'the entrypoint never runs tools/check-conf-syntax.sh on /etc/brainstorm.conf');
  assert(renderAt < checkAt && checkAt < supervisordAt, 'the syntax check must run after the render and before supervisord');
  const lineStart = src.lastIndexOf('\n', checkAt) + 1;
  const after = src.slice(lineStart, lineStart + 400);
  assert(/^\s*if\s+!/.test(after) || /\|\|/.test(after.split('\n')[0]),
    `the check's failure is not handled where it is called: ${JSON.stringify(after.split('\n')[0])}`);
  assert(/exit\s+1/.test(after), 'a failed check does not exit 1 within the next lines');
});

const UNSAFE = [
  ['a double quote', (s) => `pw"${s}`],
  ['a quote that builds a command', (s) => `pw" TAILY${s} "`],
  ['a dollar sign', (s) => `pw$${s}`],
  ['command substitution', (s) => `a$(true)${s}`],
  ['a backtick', (s) => `a\`true\`${s}`],
  ['a backslash', (s) => `pw\\${s}`],
  ['a newline', (s) => `pw\n${s}`],
  ['a carriage return', (s) => `pw\r${s}`],
];

test('AC-2 render-conf-template: a value the conf can\'t hold safely is refused, naming the setting, never the value', () => {
  const tpl = writeTmp('two.template', 'export NEO4J_USER="${OTHER_VAR}"\nexport NEO4J_PASSWORD="${NEO4J_PASSWORD}"\n');
  const offenders = [];
  for (const [label, make] of UNSAFE) {
    const tag = hex(10);
    const r = render(tpl, { OTHER_VAR: 'neo4j', NEO4J_PASSWORD: make(tag) });
    const out = r.stdout + r.stderr;
    if (r.status === 0) offenders.push(`${label}: rendered (status 0)`);
    else if (!r.stderr.includes('NEO4J_PASSWORD')) offenders.push(`${label}: refused without naming NEO4J_PASSWORD (${JSON.stringify(r.stderr)})`);
    if (r.stderr.includes('OTHER_VAR')) offenders.push(`${label}: named OTHER_VAR, whose value is safe`);
    if (r.status !== 0 && r.stdout !== '') offenders.push(`${label}: refused but wrote ${r.stdout.length} bytes to stdout`);
    if (out.includes(tag)) offenders.push(`${label}: the output holds the value`);
  }
  assert(offenders.length === 0, `\n      - ${offenders.join('\n      - ')}`);
});

test('AC-2 render-conf-template: sourcing what it writes never runs a command from a value', () => {
  const tpl = writeTmp('one.template', 'export NEO4J_PASSWORD="${NEO4J_PASSWORD}"\n');
  const offenders = [];
  for (const form of ['$(touch MARK)', '`touch MARK`', '" ; touch MARK ; "']) {
    const marker = path.join(tmp(), `ran-${hex(6)}`);
    const r = render(tpl, { NEO4J_PASSWORD: `a${form.replace('MARK', marker)}b` });
    const conf = writeTmp(`rendered-${hex(4)}.conf`, r.stdout);
    spawnSync('bash', ['-c', 'source "$1" >/dev/null 2>&1', '_', conf], { timeout: 30000 });
    if (fs.existsSync(marker)) offenders.push(`${form}: sourcing the rendered conf ran the command`);
    // The path ran: the renderer answered, by refusing (status 0 would mean it wrote the value; a crash names nothing).
    if (r.status === 0) offenders.push(`${form}: the renderer accepted the value`);
    else if (!r.stderr.includes('NEO4J_PASSWORD')) offenders.push(`${form}: the renderer failed without naming NEO4J_PASSWORD`);
  }
  assert(offenders.length === 0, `\n      - ${offenders.join('\n      - ')}`);
});

test('AC-5 the real template still renders ordinary values, passes the check, and bash reads them back exactly', () => {
  const vars = {
    OWNER_PUBKEY: hex(32),
    ADMIN_PUBKEYS: `${hex(32)},${hex(32)}`,
    NEO4J_PASSWORD: `Xy7!q-w_e.r~t@u#i%o^p&a*s(d)f+g=h:j;k,l?z/ ${hex(4)}`,
    DOMAIN_NAME: 'staging.example.test',
    RELAY_URL: 'wss://relay.example.test',
    BRAINSTORM_MODULE_BASE_DIR: '/usr/local/lib/node_modules/brainstorm/',
    BRAINSTORM_NODE_BIN: '/usr/local/bin/node',
    SESSION_SECRET: hex(32),
    OWNER_NPUB: `npub1${hex(20)}`,
  };
  const r = render(TEMPLATE, vars);
  assert(r.status === 0, `the real template failed to render ordinary values (status ${r.status}, ${JSON.stringify(r.stderr)})`);
  const conf = writeTmp('real.conf', r.stdout);
  const c = runChecker(conf);
  assert(c.status === 0 && c.out === '', `the rendered real template failed the syntax check (status ${c.status})`);
  const back = sourceAndRead(conf, ['NEO4J_PASSWORD', 'SESSION_SECRET', 'BRAINSTORM_OWNER_PUBKEY', 'BRAINSTORM_ADMIN_PUBKEYS', 'BRAINSTORM_RELAY_URL']);
  assert(back.NEO4J_PASSWORD === vars.NEO4J_PASSWORD, 'bash reads NEO4J_PASSWORD back differently');
  assert(back.SESSION_SECRET === vars.SESSION_SECRET, 'bash reads SESSION_SECRET back differently');
  assert(back.BRAINSTORM_OWNER_PUBKEY === vars.OWNER_PUBKEY, 'bash reads BRAINSTORM_OWNER_PUBKEY back differently');
  assert(back.BRAINSTORM_ADMIN_PUBKEYS === vars.ADMIN_PUBKEYS, 'bash reads BRAINSTORM_ADMIN_PUBKEYS back differently');
  assert(back.BRAINSTORM_RELAY_URL === vars.RELAY_URL, 'bash reads BRAINSTORM_RELAY_URL back differently');
});

test('ADR 0006 Option C: every template line is a comment, `export NAME`, or one quoted or bare value; every ${NAME} is double-quoted', () => {
  const lines = fs.readFileSync(TEMPLATE, 'utf8').split('\n');
  const SHAPE = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*(?:=(?:"[^"]*"|'[^']*'|[^\s"'`$;&|<>()\\]*))?\s*$/;
  const offenders = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) return;
    if (!SHAPE.test(t) || (!/=/.test(t) && !/^export\s/.test(t))) offenders.push(`line ${i + 1}: not a plain assignment or export`);
    const refs = t.match(/\$\{[A-Z_][A-Z0-9_]*\}/g) || [];
    if (refs.length && !/="[^"]*"\s*$/.test(t)) offenders.push(`line ${i + 1}: ${refs.join(', ')} not inside double quotes`);
  });
  assert(offenders.length === 0, `\n      - ${offenders.join('\n      - ')}`);
});

// ── The tree scan ───────────────────────────────────────────────────────────────────────────────

function balanced(src, open, openCh = '(', closeCh = ')') {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === openCh) depth++;
    else if (src[i] === closeCh && --depth === 0) return { text: src.slice(open, i + 1), end: i + 1 };
  }
  throw new Error(`unbalanced ${openCh}${closeCh} from offset ${open}`);
}

// An exec-family call, including the compiled TypeScript form `(0, child_process_1.execSync)(`.
const CALL = /\b(execSync|execFileSync|spawnSync|exec|execFile|spawn|execAsync|execPromise)\b\s*\)?\s*\(/g;
// A string literal that begins a `source <path or variable>` command, however it's built.
const SOURCE_LITERAL = /[`'"]source\s+(?:[$/~]|["']\s*\.concat\b|["']\s*\+)/g;
const STDERR_IGNORED = /stdio\s*:\s*\[\s*['"]ignore['"]\s*,\s*['"]pipe['"]\s*,\s*['"]ignore['"]\s*\]/;
const CATCH = /catch\s*\(\s*(\w+)\s*(?::\s*\w+\s*)?\)\s*\{/g;

// Every exec call in `src` whose command runs `source`, with the problems found in it; plus any `source` literal
// that sits in no recognized call (an alias the scan can't see would hide a leak).
function scanSource(src) {
  const calls = [];
  const spans = [];
  let m;
  CALL.lastIndex = 0;
  while ((m = CALL.exec(src))) {
    const open = m.index + m[0].length - 1;
    let call;
    try { call = balanced(src, open); } catch { continue; }
    SOURCE_LITERAL.lastIndex = 0;
    if (!SOURCE_LITERAL.test(call.text)) continue;
    spans.push([open, call.end]);
    const problems = [];
    if (!STDERR_IGNORED.test(call.text)) problems.push("doesn't pass stdio: ['ignore', 'pipe', 'ignore']");
    CATCH.lastIndex = call.end;
    const c = CATCH.exec(src);
    if (!c) problems.push('no catch follows it');
    else {
      const body = balanced(src, c.index + c[0].length - 1, '{', '}').text;
      const uses = body.match(new RegExp(`(?<![.\\w])${c[1]}\\b(\\.\\w+)?`, 'g')) || [];
      const bad = [...new Set(uses.filter((u) => u !== `${c[1]}.status`))];
      if (bad.length) problems.push(`its catch uses ${bad.join(', ')} (only ${c[1]}.status may be logged)`);
      if (!uses.includes(`${c[1]}.status`)) problems.push(`its catch doesn't log ${c[1]}.status`);
    }
    calls.push({ at: m.index, problems });
  }
  const orphans = [];
  SOURCE_LITERAL.lastIndex = 0;
  while ((m = SOURCE_LITERAL.exec(src))) {
    if (!spans.some(([a, b]) => m.index > a && m.index < b)) orphans.push(m.index);
  }
  return { calls, orphans };
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(?:c|m)?js$/.test(e.name) || (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts'))) out.push(p);
  }
  return out;
}

const lineOf = (src, at) => src.slice(0, at).split('\n').length;

test('AC-3 the two dead copies are deleted', () => {
  const dead = [
    'src/algos/customers/personalizedGrapeRank/updateNeo4j_copy.js',
    'src/algos/customers/personalizedGrapeRank/updateNeo4jWithApoc_moreLogsButWithBug.js',
  ].filter((rel) => fs.existsSync(path.join(REPO, rel)));
  assert(dead.length === 0, `still present: ${dead.join(', ')}`);
});

test('AC-3/AC-4 every call under src/, lib/ and bin/ that sources a config keeps bash stderr out and logs only the status', () => {
  const offenders = [];
  let found = 0;
  const files = new Set();
  for (const file of ['src', 'lib', 'bin'].flatMap((d) => walk(path.join(REPO, d)))) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(REPO, file);
    const { calls, orphans } = scanSource(src);
    found += calls.length;
    if (calls.length) files.add(rel);
    for (const c of calls) for (const p of c.problems) offenders.push(`${rel}:${lineOf(src, c.at)} ${p}`);
    for (const at of orphans) offenders.push(`${rel}:${lineOf(src, at)} a \`source\` command outside any call the scan recognizes`);
  }
  // Not vacuous: story 10's five readers, the nine GrapeRank files, calculateFromLibrary.ts and its .js (ADR 0006).
  for (const must of [
    'src/utils/config.js', 'lib/config.js', 'src/pipeline/stream/addToQueue.mjs',
    'src/algos/nip85/publish_nip85_30382.js', 'src/algos/personalizedGrapeRank/initializeScorecards.js',
    'src/algos/personalizedGrapeRank/updateNeo4j.js', 'src/algos/personalizedGrapeRank/initializeRatings.js',
    'src/algos/personalizedGrapeRank/calculateGrapeRank.js',
    'src/algos/customers/personalizedGrapeRank/initializeScorecards.js',
    'src/algos/customers/personalizedGrapeRank/updateNeo4jWithApoc.js',
    'src/algos/customers/personalizedGrapeRank/interpretRatings.js',
    'src/algos/customers/personalizedGrapeRank/calculateGrapeRank.js',
    'src/algos/customers/personalizedGrapeRank/updateNeo4j.js',
    'src/algos/importedGrapeRankEngine/calculateFromLibrary.ts',
    'src/algos/importedGrapeRankEngine/calculateFromLibrary.js',
  ]) if (!files.has(must)) offenders.push(`${must}: the scan found no source call in it`);
  if (found < 38) offenders.push(`the scan found ${found} source calls; ADR 0006 accounts for at least 38`);
  assert(offenders.length === 0, `\n      - ${offenders.join('\n      - ')}`);
});

test('AC-4 the scan flags an unpatched call in each form it must recognize, and passes a patched one', () => {
  const unpatched = {
    'template literal': "try { const v = execSync(`source ${CONFIG_FILES.brainstorm} && echo $K`, { shell: '/bin/bash' }); } catch (error) { console.error(error.message); }",
    'compiled TypeScript': "try { var v = (0, child_process_1.execSync)(\"source \".concat(CONFIG_FILES.brainstorm, \" && echo $K\"), { shell: '/bin/bash' }); } catch (error) { console.error(error.message); }",
    'string concatenation': "try { execSync('source ' + CONF + ' && echo $K', { shell: '/bin/bash' }); } catch (e) { console.error(e); }",
    'an aliased exec': "try { await execAsync(`source /etc/brainstorm.conf && echo $K`); } catch (err) { console.log(err.stderr); }",
  };
  const missed = [];
  for (const [label, src] of Object.entries(unpatched)) {
    const { calls } = scanSource(src);
    if (calls.length !== 1 || calls[0].problems.length === 0) missed.push(label);
  }
  const loose = scanSource("const cmd = `source /etc/brainstorm.conf && echo $K`; run(cmd);");
  if (loose.orphans.length !== 1) missed.push('a source command outside any exec call');
  const patched = scanSource("try { execSync(`source ${C} && echo $K`, { shell: '/bin/bash', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (error) { console.error(`lookup of K failed (status ${error.status})`); }");
  assert(missed.length === 0, `the scan misses: ${missed.join(', ')}`);
  assert(patched.calls.length === 1 && patched.calls[0].problems.length === 0,
    `the scan flags a patched call: ${JSON.stringify(patched.calls)}`);
  const prose = scanSource("throw new Error('source and target must each be a 64-character hex pubkey');");
  assert(prose.calls.length === 0 && prose.orphans.length === 0, 'the scan mistakes prose for a source command');
});

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  try {
    for (const t of tests) {
      try {
        await t.fn();
        pass++;
        console.log(`  ✓ ${t.name}`);
      } catch (e) {
        fail++;
        failures.push({ name: t.name, error: e.message });
        console.log(`  ✗ ${t.name}\n      ${e.message}`);
      }
    }
  } finally {
    if (TMP) { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
  console.log(`\nconfig-parse-leak: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => { process.exitCode = fail === 0 ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
}

module.exports = { run };
