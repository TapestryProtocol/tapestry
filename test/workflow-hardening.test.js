/**
 * Story workflow-hardening #1: the GitHub workflows pin what they run, limit their token, and
 * name a deploy environment.
 *   Story:     engineering-team/stories/workflow-hardening/1-harden-the-github-workflows.md
 *   Test plan: engineering-team/stories/workflow-hardening/1-harden-the-github-workflows.test-plan.md
 *
 * A guard over EVERY file in .github/workflows/, read from the directory, so a workflow added
 * later is held to the same three rules without this file being edited:
 *
 *   PIN    each action is called by its full commit id, with its released version in a comment
 *   TOKEN  each workflow declares its token's permissions; none can write the repository's
 *          contents; any other write scope is listed in WRITE_SCOPES, where a reviewer sees it
 *   ENV    each job that reads a deploy secret (DEPLOY_...) names that server's environment
 *
 * HOW IT READS A WORKFLOW. With js-yaml, which the repo already depends on
 * (bin/control-panel.js, test/operations.test.js), so text inside a script block is never
 * mistaken for a key. Only the version comment comes from the raw text: a parser drops comments.
 *
 * WHY THE CHECKERS ARE TESTED FIRST (S*). A rule that silently found nothing would pass every
 * real file. So each checker runs on small made-up workflows, good and bad, before it runs on
 * the real ones (R*). M1 then breaks each real workflow in memory, one rule at a time, and
 * expects the checker to notice.
 *
 * D* hold the OPERATIONS.md contract (AC-5). AC-6 (nothing else changes) is held by the suites
 * that already pin test.yml and publish-image.yml, and by a diff check at review: see the test
 * plan.
 *
 * GUARD SUITE. Phase 4 changes the workflows and OPERATIONS.md, never this file.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const REPO = path.resolve(__dirname, '..');
const WORKFLOW_DIR = path.join(REPO, '.github', 'workflows');
const OPERATIONS = path.join(REPO, 'OPERATIONS.md');
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

// The write scopes a workflow's token may hold, by file. Everything else is read or nothing.
// `contents: write` is refused whether or not it is listed. A workflow that needs to write
// something adds its scope here in the same change.
const WRITE_SCOPES = {
  'publish-image.yml': ['packages'], // pushes the brain images to the package registry
};

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function isMap(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function linesOf(text) { return text.split(CR).join('').split(NL); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** Every finding on one line: the runner prints only an error's first line. */
function listed(found) { return `${found.length} found: ${found.join(' | ')}`; }

// ===========================================================================
// Reading workflows
// ===========================================================================

/** A workflow as the checkers take it: its file name, its raw text and its parsed document. */
function readWorkflow(name, text) {
  let doc = null;
  let problem = null;
  try {
    doc = yaml.load(text);
  } catch (err) {
    problem = `is not valid YAML (${linesOf(String(err.message))[0]})`;
  }
  if (!problem && (!isMap(doc) || !isMap(doc.jobs) || Object.keys(doc.jobs).length === 0)) {
    problem = 'has no jobs, so the guard cannot read it as a workflow';
  }
  return { name, text, doc: problem ? null : doc, problem };
}

/** Every workflow file in a directory. GitHub reads .yml and .yaml, top level only. */
function workflowsIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /\.ya?ml$/i.test(f))
    .sort()
    .map((f) => readWorkflow(f, fs.readFileSync(path.join(dir, f), 'utf8')));
}

/** One finding. It always starts with the file and the rule (AC-4). */
function finding(wf, rule, detail) { return `${wf.name}: ${rule}: ${detail}`; }

function checkReadable(wf) {
  return wf.problem ? [finding(wf, 'READ', wf.problem)] : [];
}

// ===========================================================================
// PIN: each action is called by its full commit id, with its release in a comment
// ===========================================================================

const COMMIT_REF = /^[\w.-]+\/[\w.-]+(?:\/[^@\s]+)?@[0-9a-f]{40}$/;
const IMAGE_DIGEST_REF = /^docker:\/\/[^@\s]+@sha256:[0-9a-f]{64}$/;
const VERSION_COMMENT = /^#\s*v\d+\.\d+\.\d+\b/;

/** Everything the file calls: each step's `uses`, and each job's `uses` (a reusable workflow). */
function calls(doc) {
  const out = [];
  for (const [jobId, job] of Object.entries(doc.jobs)) {
    if (!isMap(job)) continue;
    if (job.uses !== undefined) out.push({ jobId, ref: job.uses });
    for (const step of Array.isArray(job.steps) ? job.steps : []) {
      if (isMap(step) && step.uses !== undefined) out.push({ jobId, ref: step.uses });
    }
  }
  return out;
}

/** Whether a call leaves the repo. `./…` is this repo's own file, at the commit being run. */
function leavesTheRepo(ref) { return typeof ref === 'string' && !ref.startsWith('./'); }

function checkPins(wf) {
  if (wf.problem) return [];
  const found = [];
  for (const { jobId, ref } of calls(wf.doc)) {
    if (typeof ref !== 'string' || ref.trim() === '') {
      found.push(finding(wf, 'PIN', `job ${jobId} has a uses: that names nothing`));
      continue;
    }
    if (!leavesTheRepo(ref)) continue;
    if (ref.startsWith('docker://')) {
      if (!IMAGE_DIGEST_REF.test(ref)) {
        found.push(finding(wf, 'PIN', `job ${jobId} runs the image ${ref} by a tag; pin it to its sha256 digest`));
      }
      continue;
    }
    if (!COMMIT_REF.test(ref)) {
      found.push(finding(wf, 'PIN',
        `job ${jobId} calls ${ref} by a tag or branch; pin it to its full 40-character commit id`));
      continue;
    }
    const callLine = new RegExp(`^\\s*(?:-\\s+)?uses:\\s*['"]?${escapeRe(ref)}['"]?\\s*(?:#.*)?$`);
    const rows = linesOf(wf.text).filter((row) => callLine.test(row));
    if (rows.length === 0) {
      found.push(finding(wf, 'PIN',
        `job ${jobId} calls ${ref}, but the guard cannot find that line to read its version comment; write it as "uses: <action>@<commit> # v1.2.3"`));
      continue;
    }
    if (!rows.every((row) => VERSION_COMMENT.test((row.match(/#.*$/) || [''])[0]))) {
      found.push(finding(wf, 'PIN',
        `job ${jobId} pins ${ref} without a comment naming its released version; end the line with "# v1.2.3"`));
    }
  }
  return [...new Set(found)];
}

// ===========================================================================
// TOKEN: each workflow declares its token's permissions, and none writes contents
// ===========================================================================

/** The scopes a permissions value sets to write. Anything unreadable is a finding. */
function writeScopes(perms, where, wf, found) {
  if (perms === 'read-all') return [];
  if (perms === 'write-all') {
    found.push(finding(wf, 'TOKEN', `${where} gives its token write-all`));
    return [];
  }
  if (!isMap(perms)) {
    found.push(finding(wf, 'TOKEN',
      `${where} has a permissions: value the guard cannot read (${JSON.stringify(perms)}); list each scope, or write {} for none`));
    return [];
  }
  const scopes = [];
  for (const [scope, level] of Object.entries(perms)) {
    if (level === 'write') scopes.push(scope);
    else if (level !== 'read' && level !== 'none') {
      found.push(finding(wf, 'TOKEN', `${where} sets ${scope} to ${JSON.stringify(level)}, which is not read, write or none`));
    }
  }
  return scopes;
}

function checkToken(wf, allowed = WRITE_SCOPES) {
  if (wf.problem) return [];
  const found = [];
  const blocks = [];
  if (wf.doc.permissions === undefined) {
    found.push(finding(wf, 'TOKEN',
      'declares no permissions for its token; add a top-level permissions: block (contents: read, or {} for none)'));
  } else {
    blocks.push({ where: 'the workflow', perms: wf.doc.permissions });
  }
  for (const [jobId, job] of Object.entries(wf.doc.jobs)) {
    if (isMap(job) && job.permissions !== undefined) blocks.push({ where: `job ${jobId}`, perms: job.permissions });
  }
  const mayWrite = allowed[wf.name] || [];
  for (const { where, perms } of blocks) {
    for (const scope of writeScopes(perms, where, wf, found)) {
      if (scope === 'contents') {
        found.push(finding(wf, 'TOKEN', `${where} lets its token write to the repository's contents`));
      } else if (!mayWrite.includes(scope)) {
        found.push(finding(wf, 'TOKEN',
          `${where} gives its token ${scope}: write, which WRITE_SCOPES in test/workflow-hardening.test.js does not list for this file`));
      }
    }
  }
  return found;
}

// ===========================================================================
// ENV: each job that reads a deploy secret names that server's environment
// ===========================================================================

const DEPLOY_SECRET = /secrets\s*\.\s*(DEPLOY_[A-Z0-9_]+)/gi;
const DEPLOY_SECRET_KIND = /^DEPLOY_(?:HOST|USER|SSH_KEY)_([A-Z0-9_]+)$/;
// All at once (toJSON(secrets)), by a computed name (secrets[...]), or through the object filter (secrets.*).
const EVERY_SECRET = /toJSON\(\s*secrets\s*\)|secrets\s*\[|secrets\s*\.\s*\*/i;

/** Every string in a part of a workflow, with the key it sits under. A mapping's keys are strings too. */
function stringsIn(part, key = '', out = []) {
  if (typeof part === 'string') out.push({ key, text: part });
  else if (Array.isArray(part)) for (const item of part) stringsIn(item, key, out);
  else if (isMap(part)) {
    for (const [k, v] of Object.entries(part)) {
      out.push({ key: '', text: k });
      stringsIn(v, k, out);
    }
  }
  return out;
}

/**
 * The deploy secrets a job (or any part of a workflow) names, upper-cased, once each. Read from
 * the strings themselves, so a line break round the dot is still seen.
 */
function deploySecretsIn(part) {
  const names = stringsIn(part).flatMap(({ text }) => [...text.matchAll(DEPLOY_SECRET)].map((m) => m[1].toUpperCase()));
  return [...new Set(names)];
}

/**
 * The expressions in a part: whatever sits inside ${{ … }}, and the whole of an `if:`, which
 * GitHub evaluates without the braces. Script text outside them is not an expression, so a shell
 * glob such as `config/secrets.*` is left alone.
 */
function expressionsIn(part) {
  const out = [];
  for (const { key, text } of stringsIn(part)) {
    out.push(...expressionBodies(text));
    if (key === 'if') out.push(text);
  }
  return out;
}

/**
 * What sits inside each ${{ … }} of a string. The closing braces are looked for outside quoted
 * text, as GitHub does, so a quoted "}}" does not end the expression early. An expression left
 * open runs to the end of the string.
 */
function expressionBodies(text) {
  const out = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf('${{', from);
    if (start === -1) return out;
    let end = start + 3;
    let quoted = false;
    for (; end < text.length; end += 1) {
      if (text[end] === "'") quoted = !quoted;
      else if (!quoted && text[end] === '}' && text[end + 1] === '}') break;
    }
    out.push(text.slice(start + 3, end));
    from = end + 2;
  }
}

/** Whether a part reads secrets without naming them: all at once, or by a computed name. */
function readsEverySecret(part) {
  return expressionsIn(part).some((expression) => EVERY_SECRET.test(expression));
}

function environmentOf(job) {
  if (typeof job.environment === 'string') return job.environment;
  if (isMap(job.environment) && typeof job.environment.name === 'string') return job.environment.name;
  return null;
}

function checkEnvironments(wf) {
  if (wf.problem) return [];
  const found = [];
  const outsideJobs = { ...wf.doc, jobs: undefined };
  if (deploySecretsIn(outsideJobs).length > 0 || readsEverySecret(outsideJobs)) {
    found.push(finding(wf, 'ENV',
      'reads a deploy secret outside any job, for example in a top-level env:; read it inside the job that names the environment'));
  }
  for (const [jobId, job] of Object.entries(wf.doc.jobs)) {
    if (!isMap(job)) continue;
    if (readsEverySecret(job) || job.secrets === 'inherit') {
      found.push(finding(wf, 'ENV',
        `job ${jobId} reads every secret at once (toJSON(secrets), secrets.*, secrets[...] or secrets: inherit); a job reads one server's deploy secrets, by name`));
      continue;
    }
    const names = deploySecretsIn(job);
    if (names.length === 0) continue;
    const servers = new Set();
    let unknownKind = false;
    for (const name of names) {
      const m = name.match(DEPLOY_SECRET_KIND);
      if (m) servers.add(m[1]);
      else {
        unknownKind = true;
        found.push(finding(wf, 'ENV',
          `job ${jobId} reads ${name}, which is not a DEPLOY_HOST_, DEPLOY_USER_ or DEPLOY_SSH_KEY_ secret, so the guard cannot tell which server it is for`));
      }
    }
    if (unknownKind) continue;
    if (servers.size > 1) {
      found.push(finding(wf, 'ENV',
        `job ${jobId} reads the deploy secrets of more than one server (${[...servers].sort().join(', ')})`));
      continue;
    }
    const server = [...servers][0];
    const expected = server.toLowerCase().replace(/_/g, '-');
    const actual = environmentOf(job);
    if (actual === null) {
      found.push(finding(wf, 'ENV',
        `job ${jobId} reads ${server}'s deploy secrets but names no environment; add "environment: ${expected}"`));
    } else if (actual !== expected) {
      found.push(finding(wf, 'ENV',
        `job ${jobId} names the environment "${actual}", but its deploy secrets are ${server}'s; it must be "${expected}"`));
    }
  }
  return found;
}

/** All four checks over a set of workflows. */
function allFindings(wfs, allowed = WRITE_SCOPES) {
  return wfs.flatMap((wf) => [
    ...checkReadable(wf), ...checkPins(wf), ...checkToken(wf, allowed), ...checkEnvironments(wf),
  ]);
}

// ===========================================================================
// Made-up workflows for S*
// ===========================================================================

const SHA = 'a'.repeat(40);
const DIGEST = 'b'.repeat(64);

/**
 * A made-up one-job workflow. Each option replaces one part, so a case states only what it
 * changes:
 *   top          rows before the permissions block, at no indent
 *   permissions  rows of the top-level permissions block ([] leaves it out)
 *   job          extra rows inside the job, at four spaces
 *   steps        rows of the steps list, at six spaces
 */
function made({
  name = 'example.yml',
  top = [],
  permissions = ['permissions:', '  contents: read'],
  job = [],
  steps = ['      - run: echo hello'],
} = {}) {
  const rows = ['name: Example', 'on:', '  push:', '    branches: [example]', ...top, ...permissions,
    'jobs:', '  work:', '    runs-on: ubuntu-latest', ...job, '    steps:', ...steps];
  return readWorkflow(name, rows.join(NL) + NL);
}

/** A step that calls an action. */
function call(ref) { return `      - uses: ${ref}`; }

/** A step that reads one server's three deploy secrets. */
function deployStep(server) {
  return [
    '      - name: Deploy',
    `        uses: appleboy/ssh-action@${SHA} # v1.2.5`,
    '        with:',
    '          host: ${{ secrets.DEPLOY_HOST_' + server + ' }}',
    '          username: ${{ secrets.DEPLOY_USER_' + server + ' }}',
    '          key: ${{ secrets.DEPLOY_SSH_KEY_' + server + ' }}',
  ];
}

/** Assert a checker finds nothing. */
function clean(found, what) { assert(found.length === 0, `${what} must pass, but: ${listed(found)}`); }

/** Assert a checker finds exactly one thing, and that it says what is expected. */
function caught(found, pattern, what) {
  assert(found.length === 1, `${what} must be caught once; ${listed(found)}`);
  assert(pattern.test(found[0]), `${what} must be reported as ${pattern}; got: ${found[0]}`);
}

// ===========================================================================
// S* — the checkers, on made-up workflows (AC-4)
// ===========================================================================

test('S1 (AC-1, AC-4): PIN passes an action called by its full commit id with its release in a comment', () => {
  clean(checkPins(made({ steps: [call(`actions/checkout@${SHA} # v5.1.0`)] })), 'a pinned action');
  clean(checkPins(made({ steps: [call(`github/codeql-action/init@${SHA} # v3.1.0`)] })), 'a pinned action in a subfolder');
  clean(checkPins(made({ steps: [call(`'actions/checkout@${SHA}' # v5.1.0`)] })), 'a pinned action written in quotes');
  clean(checkPins(made({ steps: [call('./.github/actions/local')] })), "this repo's own action");
  clean(checkPins(made({ steps: [call(`docker://alpine@sha256:${DIGEST}`)] })), 'an image pinned to its digest');
  clean(checkPins(made()), 'a workflow that calls nothing');
});

test('S2 (AC-1, AC-4): PIN catches an action called by a tag, a branch or a short commit id', () => {
  caught(checkPins(made({ steps: [call('actions/checkout@v5')] })), /^example\.yml: PIN: .*actions\/checkout@v5 by a tag or branch/, 'a tag');
  caught(checkPins(made({ steps: [call('actions/checkout@main')] })), /by a tag or branch/, 'a branch');
  caught(checkPins(made({ steps: [call('actions/checkout@a1b2c3d')] })), /by a tag or branch/, 'a short commit id');
  caught(checkPins(made({ steps: [call('actions/checkout')] })), /by a tag or branch/, 'an action with no version at all');
  caught(checkPins(made({ steps: [call('docker://alpine:3.20')] })), /pin it to its sha256 digest/, 'an image called by a tag');
});

test('S3 (AC-1, AC-4): PIN catches a pin whose line does not name the released version', () => {
  caught(checkPins(made({ steps: [call(`actions/checkout@${SHA}`)] })), /without a comment naming its released version/, 'a pin with no comment');
  caught(checkPins(made({ steps: [call(`actions/checkout@${SHA} # v5`)] })), /without a comment naming its released version/,
    'a pin whose comment names the moving tag, not a release');
  caught(checkPins(made({ steps: [call(`actions/checkout@${SHA} # the checkout action`)] })), /without a comment naming its released version/,
    'a pin whose comment names no version');
});

test('S4 (AC-1, AC-4): PIN reads a reusable workflow called by a job, and ignores "uses:" written inside a script', () => {
  const reusable = readWorkflow('example.yml', ['name: Example', 'on: push', 'permissions: {}', 'jobs:', '  shared:',
    '    uses: octo-org/shared/.github/workflows/build.yml@v2'].join(NL) + NL);
  caught(checkPins(reusable), /job shared calls octo-org\/shared\/\.github\/workflows\/build\.yml@v2 by a tag or branch/, 'a reusable workflow called by a tag');
  clean(checkPins(made({ steps: ['      - run: |', '          echo "uses: actions/checkout@v5"'] })), 'the words "uses:" inside a script');
});

test('S5 (AC-2, AC-4): TOKEN passes a workflow that declares read-only or no permissions', () => {
  clean(checkToken(made()), 'contents: read');
  clean(checkToken(made({ permissions: ['permissions: {}'] })), 'no permissions at all');
  clean(checkToken(made({ permissions: ['permissions: read-all'] })), 'read-all');
  clean(checkToken(made({ job: ['    permissions:', '      contents: read'] })), 'a job that narrows its own token');
});

test('S6 (AC-2, AC-4): TOKEN catches a workflow that declares nothing, or leaves the declaration empty', () => {
  caught(checkToken(made({ permissions: [] })), /^example\.yml: TOKEN: declares no permissions for its token/, 'a workflow with no permissions block');
  caught(checkToken(made({ permissions: ['permissions:'] })), /a permissions: value the guard cannot read/, 'an empty permissions block');
});

test('S7 (AC-2, AC-4): TOKEN catches write access to repository contents, at workflow or job level, and write-all', () => {
  caught(checkToken(made({ permissions: ['permissions:', '  contents: write'] })), /the workflow lets its token write to the repository's contents/,
    'contents: write for the workflow');
  caught(checkToken(made({ job: ['    permissions:', '      contents: write'] })), /job work lets its token write to the repository's contents/,
    'contents: write for one job');
  caught(checkToken(made({ permissions: ['permissions: write-all'] })), /gives its token write-all/, 'write-all');
  caught(checkToken(made({ permissions: ['permissions:', '  contents: write'] }), { 'example.yml': ['contents'] }),
    /write to the repository's contents/, 'contents: write, even when a list names it');
});

test('S8 (AC-2, AC-4): TOKEN allows a write scope only for the file whose list names it', () => {
  const publishes = ['permissions:', '  contents: read', '  packages: write'];
  clean(checkToken(made({ permissions: publishes }), { 'example.yml': ['packages'] }), 'a listed write scope');
  caught(checkToken(made({ permissions: publishes }), {}), /gives its token packages: write, which WRITE_SCOPES/, 'an unlisted write scope');
  caught(checkToken(made({ name: 'other.yml', permissions: publishes }), { 'example.yml': ['packages'] }),
    /^other\.yml: TOKEN: .*packages: write/, "a write scope listed for another file");
  caught(checkToken(made({ permissions: ['permissions:', '  id-token: write'] }), { 'example.yml': ['packages'] }),
    /id-token: write/, 'a write scope the file was not listed for');
});

test('S9 (AC-3, AC-4): ENV passes a deploy job that names its server\'s environment, in either form', () => {
  clean(checkEnvironments(made({ job: ['    environment: example'], steps: deployStep('EXAMPLE') })), 'environment: example');
  clean(checkEnvironments(made({ job: ['    environment:', '      name: example', '      url: https://example.org'],
    steps: deployStep('EXAMPLE') })), 'environment given as name and url');
  clean(checkEnvironments(made({ job: ['    environment: magic-carpet'], steps: deployStep('MAGIC_CARPET') })),
    'a two-word server, with a hyphen for the underscore');
});

test('S10 (AC-3, AC-4): ENV asks nothing of a job that reads no deploy secret', () => {
  clean(checkEnvironments(made()), 'a job with no secrets');
  clean(checkEnvironments(made({ steps: ['      - run: echo', '        env:', '          TOKEN: ${{ secrets.GITHUB_TOKEN }}'] })),
    'a job that reads another secret');
  clean(checkEnvironments(made({ steps: ['      - run: echo "secrets.DEPLOY_HOST_EXAMPLE is kept in the environment"'],
    job: ['    environment: example'] })), 'a deploy job whose script also names the secret');
  clean(checkEnvironments(made({ steps: ['      - run: rm -f config/secrets.* && grep -c "toJSON(secrets)" notes.txt'] })),
    'script text that only looks like reading every secret');
});

test('S11 (AC-3, AC-4): ENV catches a deploy job with no environment, or with another server\'s', () => {
  caught(checkEnvironments(made({ steps: deployStep('EXAMPLE') })),
    /^example\.yml: ENV: job work reads EXAMPLE's deploy secrets but names no environment; add "environment: example"/, 'no environment');
  caught(checkEnvironments(made({ job: ['    environment: staging'], steps: deployStep('EXAMPLE') })),
    /names the environment "staging", but its deploy secrets are EXAMPLE's; it must be "example"/, "another server's environment");
  caught(checkEnvironments(made({ job: ['    environment: magic_carpet'], steps: deployStep('MAGIC_CARPET') })),
    /it must be "magic-carpet"/, 'an underscore where the name takes a hyphen');
  caught(checkEnvironments(made({ job: ['    environment: ${{ github.ref_name }}'], steps: deployStep('EXAMPLE') })),
    /it must be "example"/, 'an environment name that is computed');
  caught(checkEnvironments(made({ steps: ['      - run: echo', '        env:', '          HOST: ${{ secrets.deploy_host_example }}'] })),
    /reads EXAMPLE's deploy secrets but names no environment/, 'a deploy secret named in lower case');
  caught(checkEnvironments(made({ steps: ['      - run: echo', '        env:', '          HOST: ${{ secrets . DEPLOY_HOST_EXAMPLE }}'] })),
    /reads EXAMPLE's deploy secrets but names no environment/, 'a deploy secret named with spaces round the dot');
  caught(checkEnvironments(made({ steps: ['      - run: echo', '        env:', '          ${{ secrets.DEPLOY_SSH_KEY_EXAMPLE }}: x'] })),
    /reads EXAMPLE's deploy secrets but names no environment/, 'a deploy secret named in a key');
});

test('S12 (AC-3, AC-4): ENV catches a job that reads more than one server\'s deploy secrets', () => {
  caught(checkEnvironments(made({ job: ['    environment: one'], steps: [...deployStep('ONE'), ...deployStep('TWO')] })),
    /reads the deploy secrets of more than one server \(ONE, TWO\)/, 'two servers in one job');
});

test('S13 (AC-3, AC-4): ENV catches a job that reads secrets without naming them, and a deploy secret read outside a job', () => {
  caught(checkEnvironments(made({ job: ['    environment: example'],
    steps: ['      - run: echo', '        env:', '          ALL: ${{ toJSON(secrets) }}'] })), /reads every secret at once/, 'toJSON(secrets)');
  caught(checkEnvironments(made({ job: ['    environment: example'],
    steps: ['      - run: echo', '        env:', "          HOST: ${{ secrets[format('DEPLOY_HOST_{0}', matrix.server)] }}"] })),
  /reads every secret at once/, 'a secret read by a computed name');
  caught(checkEnvironments(made({ job: ['    environment: example'],
    steps: ['      - run: echo', '        env:', "          ALL: ${{ join(secrets.*, ',') }}"] })), /reads every secret at once/, 'join(secrets.*)');
  caught(checkEnvironments(made({ job: ['    environment: example'],
    steps: ['      - run: echo', '        env:', '          ALL: ${{ toJSON(secrets.*) }}'] })), /reads every secret at once/, 'toJSON(secrets.*)');
  caught(checkEnvironments(made({ steps: ['      - run: echo', '        env:', '          ALL: ${{ toJSON( secrets . * ) }}'] })),
    /reads every secret at once/, 'the object filter with spaces, in a job with no environment');
  caught(checkEnvironments(made({ steps: ['      - run: echo', '        env:', '          ALL: |', '            ${{ toJSON(secrets',
    '            .*) }}'] })), /reads every secret at once/, 'the object filter with a line break before the dot');
  caught(checkEnvironments(made({ job: ["    if: contains(toJSON(secrets), 'x')"] })), /reads every secret at once/,
    'every secret read in an if: written without braces');
  caught(checkEnvironments(made({ steps: ['      - run: echo', '        env:', "          ALL: ${{ format('}}{0}', toJSON(secrets)) }}"] })),
    /reads every secret at once/, 'every secret read after a quoted }}');
  caught(checkEnvironments(made({ steps: ['      - run: echo', '        env:', "          ALL: ${{ format('it''s }}{0}', join(secrets.*, ',')) }}"] })),
    /reads every secret at once/, 'the object filter after a quoted }} and a doubled quote');
  caught(checkEnvironments(made({ steps: ['      - run: echo', '        env:', '          ${{ toJSON(secrets) }}: x'] })),
    /reads every secret at once/, 'every secret read in a key');
  caught(checkEnvironments(made({ steps: ['      - run: echo', '        env:', '          HOST: |', '            ${{ secrets',
    '            .DEPLOY_HOST_EXAMPLE }}'] })), /reads EXAMPLE's deploy secrets but names no environment/,
    'a deploy secret named with a line break before the dot');
  const inherits = readWorkflow('example.yml', ['name: Example', 'on: push', 'permissions: {}', 'jobs:', '  shared:',
    `    uses: octo-org/shared/.github/workflows/deploy.yml@${SHA} # v1.0.0`, '    secrets: inherit'].join(NL) + NL);
  caught(checkEnvironments(inherits), /job shared reads every secret at once/, 'secrets: inherit');
  caught(checkEnvironments(made({ top: ['env:', '  HOST: ${{ secrets.DEPLOY_HOST_EXAMPLE }}'] })),
    /reads a deploy secret outside any job/, 'a deploy secret in a top-level env:');
  caught(checkEnvironments(made({ job: ['    environment: example'],
    steps: ['      - run: echo', '        env:', '          PORT: ${{ secrets.DEPLOY_PORT_EXAMPLE }}'] })),
  /reads DEPLOY_PORT_EXAMPLE, which is not a DEPLOY_HOST_, DEPLOY_USER_ or DEPLOY_SSH_KEY_ secret/, 'a deploy secret of an unknown kind');
});

test('S13b (AC-3, AC-4): an expression ends at the first }} outside quoted text, and one left open runs to the end', () => {
  const same = (text, expected) => {
    const got = expressionBodies(text);
    assert(JSON.stringify(got) === JSON.stringify(expected), `${text} must read as ${JSON.stringify(expected)}; got ${JSON.stringify(got)}`);
  };
  same('a ${{ one }} b ${{ two }} c', [' one ', ' two ']);
  same("${{ format('}}{0}', x) }}", [" format('}}{0}', x) "]);
  same("${{ format('it''s }}', x) }} tail", [" format('it''s }}', x) "]);
  same('${{ never closed', [' never closed']);
  same('no expression here, only config/secrets.*', []);
});

test('S14 (AC-4): a file the guard cannot read as a workflow is a finding, not a silent pass', () => {
  caught(checkReadable(readWorkflow('broken.yml', 'jobs: [unclosed' + NL)), /^broken\.yml: READ: is not valid YAML/, 'invalid YAML');
  caught(checkReadable(readWorkflow('empty.yml', 'name: Nothing here' + NL)), /^empty\.yml: READ: has no jobs/, 'a file with no jobs');
  caught(checkReadable(readWorkflow('blank.yml', '')), /^blank\.yml: READ: has no jobs/, 'an empty file');
  clean(checkReadable(made()), 'a workflow with a job');
});

test('S15 (AC-4): every finding starts with its file and its rule', () => {
  const bad = made({
    name: 'three-problems.yml',
    permissions: [],
    steps: [call('actions/checkout@v5'), ...deployStep('EXAMPLE')],
  });
  const found = allFindings([bad]);
  for (const rule of ['PIN', 'TOKEN', 'ENV']) {
    assert(found.some((f) => f.startsWith(`three-problems.yml: ${rule}: `)), `a ${rule} finding must name the file and the rule; ${listed(found)}`);
  }
  assert(found.every((f) => /^three-problems\.yml: (PIN|TOKEN|ENV|READ): \S/.test(f)), `every finding must start "<file>: <RULE>: "; ${listed(found)}`);
});

test('S16 (AC-4): a workflow file added to the folder later is read, whichever of .yml and .yaml it ends in', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-guard-'));
  try {
    fs.writeFileSync(path.join(dir, 'good.yml'), made().text);
    fs.writeFileSync(path.join(dir, 'added-later.yaml'), made({ steps: [call('actions/checkout@v5')] }).text);
    fs.writeFileSync(path.join(dir, 'notes.md'), 'not a workflow');
    const wfs = workflowsIn(dir);
    assert(wfs.map((wf) => wf.name).join(',') === 'added-later.yaml,good.yml', `both workflow files and nothing else must be read; got ${wfs.map((wf) => wf.name)}`);
    caught(allFindings(wfs), /^added-later\.yaml: PIN: /, 'the added file');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ===========================================================================
// R* — the real workflows (AC-1, AC-2, AC-3)
// ===========================================================================

test('R0 (AC-4): the guard reads every workflow file in .github/workflows/, and there is at least one', () => {
  const wfs = workflowsIn(WORKFLOW_DIR);
  assert(wfs.length > 0, '.github/workflows/ holds no workflow file, so the guard would pass without checking anything');
  const unreadable = wfs.flatMap(checkReadable);
  assert(unreadable.length === 0, listed(unreadable));
});

test('R1 (AC-1): every action in every workflow is pinned to its full commit id, with its released version in a comment', () => {
  const found = workflowsIn(WORKFLOW_DIR).flatMap(checkPins);
  assert(found.length === 0, listed(found));
});

test('R2 (AC-2): every workflow declares what its token may do, none can write repository contents, and every write scope is listed', () => {
  const found = workflowsIn(WORKFLOW_DIR).flatMap((wf) => checkToken(wf));
  assert(found.length === 0, listed(found));
});

test('R3 (AC-2): WRITE_SCOPES lists no file that is gone, and no scope its workflow no longer asks for', () => {
  const byName = new Map(workflowsIn(WORKFLOW_DIR).filter((wf) => !wf.problem).map((wf) => [wf.name, wf]));
  const stale = [];
  for (const [file, scopes] of Object.entries(WRITE_SCOPES)) {
    const wf = byName.get(file);
    if (!wf) { stale.push(`${file} is listed but is not a workflow file`); continue; }
    const asked = new Set();
    const collect = (perms) => { if (isMap(perms)) for (const [s, level] of Object.entries(perms)) if (level === 'write') asked.add(s); };
    collect(wf.doc.permissions);
    for (const job of Object.values(wf.doc.jobs)) if (isMap(job)) collect(job.permissions);
    for (const scope of scopes) if (!asked.has(scope)) stale.push(`${file} is listed for ${scope}: write but no longer asks for it`);
  }
  assert(stale.length === 0, listed(stale));
});

test('R4 (AC-3): every job that reads a deploy secret names that server\'s environment', () => {
  const found = workflowsIn(WORKFLOW_DIR).flatMap(checkEnvironments);
  assert(found.length === 0, listed(found));
});

// ===========================================================================
// M1 — the rules bind today's files (AC-4)
// ===========================================================================

test('M1 (AC-4): each real workflow, broken in memory one rule at a time, is caught', () => {
  const wfs = workflowsIn(WORKFLOW_DIR).filter((wf) => !wf.problem);
  let broken = 0;
  for (const wf of wfs) {
    const noToken = structuredClone(wf.doc);
    delete noToken.permissions;
    assert(checkToken({ ...wf, doc: noToken }).length > 0, `${wf.name}: taking away its permissions: block went unnoticed`);
    broken += 1;

    if (calls(wf.doc).some((c) => leavesTheRepo(c.ref))) {
      const byTag = structuredClone(wf.doc);
      const retag = (ref) => (leavesTheRepo(ref) ? `${ref.replace(/@.*$/, '')}@v1` : ref);
      for (const job of Object.values(byTag.jobs)) {
        if (!isMap(job)) continue;
        if (job.uses !== undefined) job.uses = retag(job.uses);
        for (const step of Array.isArray(job.steps) ? job.steps : []) {
          if (isMap(step) && step.uses !== undefined) step.uses = retag(step.uses);
        }
      }
      assert(checkPins({ ...wf, doc: byTag }).length > 0, `${wf.name}: calling its actions by a tag went unnoticed`);
      broken += 1;
    }

    for (const [jobId, job] of Object.entries(wf.doc.jobs)) {
      if (!isMap(job) || deploySecretsIn(job).length === 0) continue;
      const noEnvironment = structuredClone(wf.doc);
      delete noEnvironment.jobs[jobId].environment;
      assert(checkEnvironments({ ...wf, doc: noEnvironment }).some((f) => f.includes(`job ${jobId} `)),
        `${wf.name}: taking the environment away from job ${jobId} went unnoticed`);
      broken += 1;
    }
  }
  assert(wfs.length > 0 && broken >= wfs.length, `nothing was broken, so nothing was proved (${wfs.length} workflows, ${broken} breaks)`);
});

// ===========================================================================
// D* — the OPERATIONS.md contract (AC-5)
// ===========================================================================

function operations() {
  let text = '';
  try { text = fs.readFileSync(OPERATIONS, 'utf8'); } catch { text = ''; }
  assert(text.length > 0, 'OPERATIONS.md must exist.');
  return text;
}

/**
 * The section under the first heading that matches, down to the next heading of the same or a
 * higher level. Lines inside a fenced block are never headings: a shell comment starts with #.
 */
function section(text, heading) {
  const rows = linesOf(text);
  let fenced = false;
  let start = -1;
  let level = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (/^\s*```/.test(rows[i])) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = rows[i].match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;
    if (start === -1) {
      if (heading.test(m[2])) { start = i; level = m[1].length; }
    } else if (m[1].length <= level) {
      return rows.slice(start, i).join(NL);
    }
  }
  return start === -1 ? '' : rows.slice(start).join(NL);
}

test('D1 (AC-5): OPERATIONS.md says a deploy target\'s secrets belong in its environment, limited to its deploy branch', () => {
  const s = section(operations(), /deploy environments?/i);
  assert(s.length > 0, 'OPERATIONS.md needs a section whose heading names the deploy environments (story AC-5).');
  assert(/DEPLOY_/.test(s) && /environment/i.test(s),
    'the deploy-environments section must say that the DEPLOY_ secrets belong in the target\'s environment (story AC-5).');
  assert(/deployment branch|limit(?:ed|s)?\b[^.]{0,80}\bbranch|only\b[^.]{0,80}\bbranch/i.test(s),
    'the deploy-environments section must say the environment is limited to the target\'s deploy branch (story AC-5).');
});

test('D2 (AC-5): OPERATIONS.md gives the order for moving an existing target\'s secrets', () => {
  const s = section(operations(), /deploy environments?/i);
  assert(s.length > 0, 'OPERATIONS.md needs a section whose heading names the deploy environments (story AC-5).');
  assert(/environment:/.test(s) && /only after/i.test(s),
    'the deploy-environments section must give the order: a target\'s secrets move only after its own deploy branch carries the environment: line (story AC-5).');
});

test('D3 (AC-5): the new-target setup in OPERATIONS.md creates the target\'s environment and puts its three secrets there', () => {
  const s = section(operations(), /GitHub setup/i);
  assert(s.length > 0, 'OPERATIONS.md must keep its "GitHub setup" steps for a new deploy target.');
  for (const secret of ['DEPLOY_HOST_<NAME>', 'DEPLOY_USER_<NAME>', 'DEPLOY_SSH_KEY_<NAME>']) {
    assert(s.includes(secret), `the new-target setup must still name ${secret}.`);
  }
  assert(/environment[\s\S]{0,800}DEPLOY_HOST_<NAME>/i.test(s),
    'the new-target setup must have the reader create the target\'s environment before it names the secrets that go in it (story AC-5).');
  assert(/environment:/.test(s), 'the new-target setup must say the workflow names the environment with an environment: line (story AC-5).');
});

test('D4 (AC-5): OPERATIONS.md says how to move a pin to a newer release', () => {
  const s = section(operations(), /pinned actions?/i);
  assert(s.length > 0, 'OPERATIONS.md needs a section whose heading names the pinned actions (story AC-5).');
  assert(/git ls-remote/.test(s), 'the pinned-actions section must give the command that resolves a release to its commit (git ls-remote).');
  assert(/commit/i.test(s) && /release|version/i.test(s),
    'the pinned-actions section must say a pin is a commit id, written with the release it is (story AC-5).');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${linesOf(err.message)[0]}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
