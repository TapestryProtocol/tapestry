# Test Plan: Story 10 — Sourcing the config file never puts its contents in a log

**Story:** `engineering-team/stories/security-auth-exposure/10-config-source-stderr-no-values.md`
**ADR:** none (Bug, Standard: Architecture skipped; the approach is in the story)
**Book:** `engineering-team/audits/config-secret-logging/book.md`
**Date:** 2026-10-31

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 | `AC-1 getConfigFromFile: a malformed conf line never reaches the process output, and the default is still returned` | `test/config-source-stderr.test.js` | unit (child process) |
| AC-3 | `AC-3 getConfigFromFile: a failed source lookup still logs the key and the exit status` | `test/config-source-stderr.test.js` | unit (child process) |
| AC-2, AC-3 | `AC-2/AC-3 every reader: each source call keeps bash stderr out, and its catch logs only the status` | `test/config-source-stderr.test.js` | source-level |
| AC-4 | `AC-4 addToQueue.mjs: its reader logs key names and where each came from, never values` | `test/config-source-stderr.test.js` | source-level |
| AC-5 | story 9's suite, unchanged | `test/config-secret-logging.test.js` | unit |

## Why two kinds of check

- **`src/utils/config.js` is tested by running it.** A child `node` process points `BRAINSTORM_CONF_PATH` at a temp
  config whose second line, `export NEO4J_PASSWORD=pw)<random>`, bash can't parse. It then looks up a key only the
  `source` fallback could find. The test captures the child's whole stdout and stderr, because bash's stderr reaches
  the log through the inherited file descriptor, not through `process.stderr.write`. An in-process capture like story
  9's would miss it.
- **The other four readers are checked on their source.** `lib/config.js`, `addToQueue.mjs`, `publish_nip85_30382.js`
  and `initializeScorecards.js` read the hard-coded `/etc/brainstorm.conf`, and the last three run on import (relay
  connections, `process.exit`). The test finds each file's one `execSync` call that sources the config file and
  checks two things. The call must pass `stdio: ['ignore', 'pipe', 'ignore']`. The `catch` that follows may use its
  error only as `.status`, and must log it. `src/utils/config.js` is held to the same rule. The test also asserts there
  is exactly one such call per file, so it can't pass vacuously after a refactor.
- **The source-level checks are weaker than running the code.** They prove the call is written the safe way, not that
  bash's output stays out. AC-1's child-process test proves the mechanism once, for the same `stdio` setting.

## Edge cases

- [x] **The lookup that fails still returns the default** (AC-1 asserts the return value first).
- [x] **The failure is still reported**, with the key and the exit status (AC-3), so a broken conf file doesn't go
      silent.
- [x] **`console.error` isn't mistaken for the error variable** when the variable is named `error`: the check ignores a
      name preceded by `.`.

## Test infrastructure

- Stack-free: no network, no stack, no publishing. The child runs `process.execPath` from a temp directory with the
  temp config, and the temp directory is removed in `run()`.
- Registered in `test/registry.js` after story 9's suite.

## How to run

Run these suites alone (a full `npm test` on the Mac Studio publishes fixtures; see AGENTS.md):

```
node test/config-source-stderr.test.js
node test/config-secret-logging.test.js
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-31 on `fix/config-source-stderr`, parent `a788b4f5`:

```
  ✗ AC-1 getConfigFromFile: a malformed conf line never reaches the process output, and the default is still returned
      the output holds the malformed line's value ("… brainstorm.conf: line 2: `export NEO4J_PASSWORD=pw)f1967df7…'
      Error using source command for CSS_TEST_UNSET_KEY: Command failed: source …/brainstorm.conf && echo $CSS_TEST_UNSET_KEY
      … brainstorm.conf: line 2: `export NEO4J_PASSWORD=pw)f1967df7…'")
  ✗ AC-3 getConfigFromFile: a failed source lookup still logs the key and the exit status
      the failure line gives no exit status: "Error using source command for CSS_TEST_UNSET_KEY: Command failed: …"
  ✗ AC-2/AC-3 every reader: each source call keeps bash stderr out, and its catch logs only the status
      (for each of the five readers: no stdio option, the catch uses .message, the catch doesn't log .status)
  ✗ AC-4 addToQueue.mjs: its reader logs key names and where each came from, never values
      - console.log(`Found ${varName} in config file: ${result}`);
      - console.log(`Found ${varName} in environment: ${process.env[varName]}`);
      - console.log(`Using default value for ${varName}: ${defaultValue}`);

config-source-stderr: 0 passed, 4 failed
```

AC-1 shows the leak twice, as story 9's review described: once straight from bash's stderr, once inside the logged
`message`.

**The tests can pass.** With the approach the story names applied to the five readers in the working tree (then
stashed, so it isn't in this commit), the suite passed 4/4, story 9's suite passed 5/5, and `node --check` passed for
all five files.
