# Test Plan: Story 11 — A config file bash can't parse never reaches a log

**Story:** `engineering-team/stories/security-auth-exposure/11-unparseable-config-never-logged.md`
**ADR:** `engineering-team/decisions/security-auth-exposure/0006-refuse-unsafe-conf-at-render.md`
**Book:** `engineering-team/audits/config-parse-leak/book.md`
**Date:** 2026-10-31

## Coverage map

All tests are in `test/config-parse-leak.test.js`, registered after story 10's suite in `test/registry.js`.

| Criterion | Test name | Level |
|---|---|---|
| AC-1 | `AC-1 check-conf-syntax: a conf bash can't parse is refused, with a line number and without the value` | unit (child process, host bash) |
| AC-1 | `AC-1 check-conf-syntax: a line bash -n would echo itself never reaches the output` | unit (child process) |
| AC-1, AC-5 | `AC-1/AC-5 check-conf-syntax: a well-formed conf passes silently` | unit (child process) |
| AC-1 | `AC-1 entrypoint: the rendered conf is checked before any service starts, and a failure stops the boot` | source-level |
| AC-2 | `AC-2 render-conf-template: a value the conf can't hold safely is refused, naming the setting, never the value` | unit (child process) |
| AC-2 | `AC-2 render-conf-template: sourcing what it writes never runs a command from a value` | unit (child process + bash) |
| AC-5 | `AC-5 the real template still renders ordinary values, passes the check, and bash reads them back exactly` | unit (child process + bash) |
| ADR Option C | `ADR 0006 Option C: every template line is a comment, export NAME, or one quoted or bare value; every ${NAME} is double-quoted` | source-level (guard) |
| AC-3 | `AC-3 the two dead copies are deleted` | file check |
| AC-3, AC-4 | `AC-3/AC-4 every call under src/, lib/ and bin/ that sources a config keeps bash stderr out and logs only the status` | source-level scan |
| AC-4 | `AC-4 the scan flags an unpatched call in each form it must recognize, and passes a patched one` | unit (scanner self-test) |
| AC-5 | story 9's and story 10's suites and `entrypoint-template-rendering`, unchanged | existing suites |
| AC-5 | staging's and production's current values pass the check | operational, at Review (see below) |

## How each criterion is shown

- **AC-1, the syntax check.** `tools/check-conf-syntax.sh` runs on fixture confs through the host's `bash`. Two broken
  fixtures carry a random hex value: an unclosed quote (which bash reports at the file's last line) and `B=pw)<hex>`,
  for which `bash -n` itself prints the whole line. The second test first asserts that plain `bash -n` *does* echo the
  value on that fixture, so it can't pass by accident. Each asserts a non-zero, non-127 exit, a line number, and that
  neither the value nor `NEO4J_PASSWORD=` appears anywhere in the checker's stdout or stderr.
- **AC-1, the wiring.** The entrypoint is checked on its source, as `entrypoint-template-rendering` T6 checks the
  renderer: the checker runs on `/etc/brainstorm.conf` after the render and before `exec /usr/bin/supervisord`, inside
  an `if !` or `||` with `exit 1` close by. Running the real entrypoint needs a container, so it is left to the
  Review's scratch-container check.
- **AC-2, refusal.** The renderer runs on a two-line fixture template. `NEO4J_PASSWORD` is set in turn to a value with
  each of `"`, a `"` that builds a command (`pw" TAILY<hex> "`), `$`, `$(…)`, a backtick, `\`, a newline and a carriage
  return, each tagged with fresh random hex. The other variable is safe. The test asserts: a non-zero exit; stderr
  names `NEO4J_PASSWORD` and not the safe variable; nothing on stdout; the hex nowhere in the output.
- **AC-2, nothing runs.** For `$(touch <marker>)`, `` `touch <marker>` `` and `" ; touch <marker> ; "`, whatever the
  renderer writes is sourced in a fresh bash, and the marker file must not exist afterwards. A test that something
  did *not* happen passes when the code returns early, so the same test also requires the renderer to have refused
  by name (a crash names nothing).
- **AC-5, ordinary values.** The real `config/brainstorm.conf.template` renders with all nine variables set to
  ordinary values, including a password with spaces and `!@#%^&*()+=:;,.?/~`. The rendered file passes the checker
  silently, and bash reads five values back exactly. Before the fix this test fails only because the checker doesn't
  exist yet.
- **AC-3, AC-4, the scan.** The suite walks `src/`, `lib/` and `bin/` (`.js`, `.mjs`, `.cjs`, `.ts`; no
  `node_modules`). It finds every exec-family call (`execSync`, `exec`, `execFile(Sync)`, `spawn(Sync)`, `execAsync`,
  `execPromise`, and the compiled `(0, child_process_1.execSync)(` form) whose text holds a string that begins
  `source ` followed by a path, a variable, `.concat` or `+`. Each must pass `stdio: ['ignore', 'pipe', 'ignore']`, and
  the first `catch` after it (TypeScript `catch (error : any)` included) may use its error only as `.status`, and must.
  Any such `source` string *outside* a recognized call is also an offender, so an alias the scan can't see fails it
  rather than hiding a leak. This is story 10's rule, unchanged, applied to the whole tree.
- **The scan isn't vacuous.** It must find source calls in all 15 files the ADR and story 10 name, and at least 38
  calls in all (44 today, the 6 extra being the dead copies). The self-test feeds it an unpatched call in four forms
  (template literal, compiled TypeScript, `'source ' + …`, an aliased `execAsync`) and a loose `source` string, and
  requires each to be flagged; a patched call must pass; and the English sentence "source and target must each be…",
  which the first draft of the scan mistook for a command, must not.
- **Option C as a test.** Every non-comment line of the template is `export NAME` or an assignment of one quoted or
  bare word, and every `${NAME}` sits inside double quotes. It passes today; it guards the template, which the
  render-time check doesn't.

## Edge cases

- [x] **Bash echoing the bad line itself** (`B=pw)…`): covered, with a precondition that proves the fixture does it.
- [x] **An unclosed quote is reported at the last line**: the checker's message only has to name *a* line; the
      unclosed-quote test doesn't pin which.
- [x] **A carriage return** in a value, not only a newline.
- [x] **The safe variable is not blamed** when only one value is unsafe.
- [x] **Compiled TypeScript and aliased exec helpers** in the scan.
- [ ] **A `'` in a value.** Allowed by the ADR; `getConfigFromFile()`'s regex reads it differently from bash. Out of
      scope (an OPEN.md row), so not tested here.
- [ ] **Behavioural run of a GrapeRank reader.** These scripts read the hard-coded conf through `CONFIG_FILES`, need
      `neo4j-driver` and run on import, so, as for four of story 10's five, they are checked on source. Story 10's
      AC-1 child-process test already proves the `stdio` setting keeps bash's stderr out.

## Test infrastructure

- Node's built-in style (`run()` export, registered in `test/registry.js`); no new framework.
- Stack-free and host-runnable: needs only `node` and `bash`. No `node_modules`, no Docker, no live API, no relays.
- Fixtures: written to a temp directory created on first use and removed at the end of `run()`.

## How to run

Never the full `npm test` on this Mac (it publishes fixtures to public relays). Run the suite through its export:

```
node -e "const m=require('./test/config-parse-leak.test.js'); Promise.resolve((m.run||m)()).then(r=>{console.log(JSON.stringify({pass:r.pass,fail:r.fail})); process.exit(r.fail?1:0)})"
```

The neighbouring suites (`config-source-stderr`, `config-secret-logging`, `entrypoint-template-rendering`) run the
same way. The Review also runs the suite in a scratch container (`SCRATCH_IMAGE=agent-memory-tapestry`), for Debian's
bash.

## AC-5, operational (at Review, with the owner's OK to SSH)

On each droplet, inside the `tapestry` container, print counts and exit statuses only, never a line:
`bash -n /etc/brainstorm.conf` (its status), and the number of lines assigning one of the nine substituted variables
whose value contains `"`, `$`, a backtick, `\` or a carriage return. All zero is the pass.

## Verification

The new tests fail with the current code. Confirmed 2026-10-31 on the host at the ADR commit `e0ef6913` plus this
suite: **2 passed, 9 failed.**

- The three checker tests and AC-5: `tools/check-conf-syntax.sh does not exist`.
- The entrypoint test: `the entrypoint never runs tools/check-conf-syntax.sh on /etc/brainstorm.conf`.
- AC-2 refusal: all eight values `rendered (status 0)` and `the output holds the value`.
- AC-2 nothing runs: all three forms `sourcing the rendered conf ran the command` and `the renderer accepted the value`.
- The dead copies: both `still present`.
- The scan: 44 calls found and 39 flagged, each for the missing `stdio` and for `error.message` in the catch it was
  checked against. *(Corrected at Review: the first draft said all 44 were flagged.)*
- Passing, as they should before the fix: the Option C template guard and the scanner's self-test.

Unchanged suites on the host at the same point: `config-source-stderr` 4/0, `config-secret-logging` 5/0,
`entrypoint-template-rendering` 11/0.
