# ADR 0006: Refuse an unsafe config value at render, check the rendered file with `bash -n`, and patch every remaining `source` call

**Status:** Accepted (owner, Architecture gate, 2026-10-31)
**Date:** 2026-10-31
**Story:** `engineering-team/stories/security-auth-exposure/11-unparseable-config-never-logged.md`
**Book:** `engineering-team/audits/config-parse-leak/book.md`
**Builds on:** ADR `task-queue-scheduler/0014-entrypoint-template-rendering.md` (story #16: the conf is rendered from
`config/brainstorm.conf.template` by `tools/render-conf-template.js`). Nothing in it is superseded; this adds a check to the renderer and one after it.

## Context

**What the story asks (in short).** AC-1: a rendered conf bash can't parse stops startup before any service runs,
naming the line number, never the line or a value. AC-2: a value containing `"`, `$`, a backtick, `\` or a newline is
never run or reinterpreted when the conf is sourced; startup either refuses it (naming the setting, never the value) or
bash reads it back exactly; the Architect picks. AC-3: the nine live or uncalled GrapeRank files and
`calculateFromLibrary.ts` keep bash's stderr out and log key and status, never `message`/`stderr`; the two dead copies
are deleted. AC-4: a scan of `src/`, `lib/` and `bin/` replaces story 10's fixed list. AC-5: nothing else changes, and
staging's and production's current values pass the new check before anything is pushed.

**Orientation.** The story touches no concepts, event kinds or firmware. The local stack at :7778 is Grawk's private
instance and off limits, so orientation was from the code.

**How the conf is written today.**
- `docker/entrypoint.sh:46-55` exports nine variables (`OWNER_PUBKEY`, `ADMIN_PUBKEYS`, `NEO4J_PASSWORD`,
  `DOMAIN_NAME`, `RELAY_URL`, `BRAINSTORM_MODULE_BASE_DIR`, `BRAINSTORM_NODE_BIN`, `SESSION_SECRET`, `OWNER_NPUB`) and
  runs `node tools/render-conf-template.js config/brainstorm.conf.template > /etc/brainstorm.conf`. On a non-zero exit
  it prints `[entrypoint] FATAL: render of /etc/brainstorm.conf failed` and exits 1. This runs on every start, before
  `supervisord`, so before any shell script or Node process sources the file.
- The renderer replaces each `${NAME}` with `process.env[NAME]` exactly as it is. It already refuses a missing variable
  (exit 2, naming it). Every `${NAME}` in the template sits inside double quotes (`NAME="${NAME}"` or a longer
  double-quoted string); the template's other lines are comments, blanks, `export NAME`, or assignments of literal
  quoted or bare values.
- Inside double quotes bash gives meaning to `"` (ends the string), `$` (expansion, including `$(…)`), the backtick
  (command substitution) and `\` (escape). A newline ends the line in `getConfigFromFile()`'s reading. So a value with
  any of these is either a syntax error (a stray `"` at the end) or, worse, parses and runs: `pw" TAILY "` renders as
  `NEO4J_PASSWORD="pw" TAILY ""`, which bash runs as the command `TAILY`, and `a$(touch x)b` runs `touch x` in every
  script that sources the file.
- `getConfigFromFile()` (`src/utils/config.js:27`) reads a quoted value with `=["'](.*?)["']`, the raw text between
  the quotes, with no unescaping. `lib/config.js` does the same.

**How `bash -n` reports errors (probed 2026-10-31, GNU bash 5.3).** `bash -n file` exits 2 on a syntax error and
writes `file: line N: <message>` to stderr. For some errors it writes **the offending line itself** on a second line
(`` line 2: `B=pw)TAIL' ``). For an unclosed quote it reports the file's *last* line, not the line that opened the
quote. So the check may use bash's exit status and line number, and must never print bash's stderr.

**The remaining `source` calls in JavaScript.** A search of `src/`, `lib/` and `bin/` (2026-10-31) finds no JavaScript
or TypeScript outside story 10's five and these files that sources a config file. Per file, calls on
`CONFIG_FILES.brainstorm` / calls on `CONFIG_FILES.graperank`:

| File | brainstorm | graperank |
|---|---|---|
| `src/algos/personalizedGrapeRank/updateNeo4j.js` | 3 | 0 |
| `src/algos/personalizedGrapeRank/initializeRatings.js` | 1 | 1 |
| `src/algos/personalizedGrapeRank/calculateGrapeRank.js` | 1 | 1 |
| `src/algos/customers/personalizedGrapeRank/initializeScorecards.js` | 4 | 0 |
| `src/algos/customers/personalizedGrapeRank/updateNeo4jWithApoc.js` | 3 | 0 |
| `src/algos/customers/personalizedGrapeRank/interpretRatings.js` | 1 | 1 |
| `src/algos/customers/personalizedGrapeRank/calculateGrapeRank.js` | 1 | 1 |
| `src/algos/customers/personalizedGrapeRank/updateNeo4j.js` | 3 | 0 |
| `src/algos/importedGrapeRankEngine/calculateFromLibrary.ts` | 4 | 2 |
| `src/algos/importedGrapeRankEngine/calculateFromLibrary.js` (tsc output) | 4 | 2 |
| `…/customers/personalizedGrapeRank/updateNeo4j_copy.js`, `updateNeo4jWithApoc_moreLogsButWithBug.js` | 3 + 3 | 0 |

The compiled `calculateFromLibrary.js` spells the call `(0, child_process_1.execSync)("source ".concat(CONFIG_FILES.brainstorm, …))`,
which a scan for `execSync(` and `` `source `` would miss. `calculateFromLibrary.sh` runs `tsc ./calculateFromLibrary.ts`
before `node ./calculateFromLibrary.js`. In the image `tsc` is only at `node_modules/.bin/tsc`, not on `PATH` (probed in
`agent-memory-tapestry`, 2026-10-31), so today the wrapper's `tsc` most likely fails and the committed `.js` runs; where
`tsc` is found, the `.js` is rebuilt from the `.ts`. Both have to carry the fix.

## Options considered

The story has two decisions in it: what the render step does with an unsafe value (AC-1, AC-2), and how the JavaScript
calls are fixed (AC-3, AC-4).

### Option A — Refuse unsafe values in the renderer, then `bash -n` the rendered file (chosen)

1. **The renderer refuses.** Before it writes anything, `render-conf-template.js` checks every value it is about to
   substitute. If any contains `"`, `$`, a backtick, `\`, a newline or a carriage return, it writes
   `RenderError: <NAME>[, <NAME>…] contain a character the config file can't hold safely (" $ \` \ or a line break); refusing to render`
   to stderr, writes nothing to stdout, and exits 3. It names variables, never values. The entrypoint's existing
   FATAL branch stops the boot.
2. **The entrypoint checks the result.** A new script, `tools/check-conf-syntax.sh <file>`, runs `bash -n <file>` with
   stdout and stderr captured into a shell variable that is never printed. On success it prints nothing and exits 0.
   On failure it pulls the first `line <N>` number out of the captured text, prints
   `[check-conf-syntax] <file> is not valid bash near line <N> (an unclosed quote is reported at the last line); not printing the line, since it may hold a secret`
   to stderr and exits 1. If no number can be found it says so, without the number. `docker/entrypoint.sh` calls it
   right after `chmod 664 /etc/brainstorm.conf`; on failure it prints `[entrypoint] FATAL: /etc/brainstorm.conf failed
   its syntax check` and exits 1, before `supervisord` starts.

- **Pros.** Every value-driven bad line is stopped at its source, with the variable's name, before the file exists.
  That covers the stray `"` (syntax error), the `"`-built extra command (`pw" TAILY "`), and `$(…)`/backtick
  execution, so AC-2 holds for every reader, shell or JavaScript. What bash reads equals what the JavaScript readers'
  regex reads, because neither has anything to interpret. `bash -n` is a cheap backstop for a template edit that
  breaks the syntax. Both pieces are stack-free and testable on the host.
- **Cons.** An instance whose current secret contains one of these characters stops starting after the upgrade. Today
  such a value is already broken (bash expands a `$`, and a `"` breaks the file), but it may have *seemed* to work.
  AC-5's pre-push check of staging and production exists for this. An operator can't use these characters in a
  password; they can use any other.

### Option B — Escape unsafe values in the renderer so bash reads them literally

The renderer writes `\"`, `\$`, `` \` `` and `\\` inside the double quotes (refusing only line breaks). Bash then reads
the original value.

- **Pros.** No instance stops starting; any password works.
- **Cons.** `getConfigFromFile()` and `lib/config.js` read the raw text between the quotes, so they would return
  `pa\$s` while bash returns `pa$s`. Both parsers would need an unescaper that matches bash's rules exactly, which
  means changing the five shared readers story 10 just closed and adding a subtle parser with its own failure mode.
  The gain (allowing four characters in a password) is small.

### Option C — Also refuse any rendered line that parses but isn't a plain assignment

After `bash -n`, check that every non-comment line of the rendered file is `export NAME`, or an optional `export `
followed by `NAME=` and one quoted or bare word, so a line like `B=pw TAILY` is refused even though it parses.

- **Pros.** Catches a command-running line whatever put it there.
- **Cons.** With Option A's value check, the only way such a line reaches the rendered file is a template edit, which
  is repo code under review. The check would also tie the template to one line shape forever. The same protection
  is had more cheaply by a stack-free test on the template's shape (see Implementation notes, for the Tester), which
  fails at review time, not at boot.

### Options for the JavaScript calls (AC-3)

- **D — Patch each call in place, as story 10 did (chosen).** `stdio: ['ignore', 'pipe', 'ignore']` on each `execSync`
  that runs `source`, and every `catch` the error can reach logs the key(s) and `.status`, never `.message`,
  `.stderr`, the bare error or `String(error)`.
- **E — A shared helper** (`src/utils/sourceConfValue.js`) that every call uses. Fewer copies of the pattern, but it
  touches the same call sites, adds a module the standalone `.ts` build has to resolve, and was weighed and left out
  in story 10 for the same reasons. The AC-4 scan, not a helper, is what keeps the pattern from regressing.

## Decision

We chose **Option A** for the render step and **Option D** for the JavaScript calls.

Option A makes AC-2's answer "refuse": a value that can't be written safely between double quotes never reaches the
file, so no reader, shell or JavaScript, can run it or read it differently. Option B would buy password freedom at the
cost of reopening the five readers story 10 closed. Option C's protection is moved into a test.

**One deliberate widening of AC-3.** In the nine files and the `.ts`, the six calls that source `graperank.conf` get
the same patch as the 21 that source `brainstorm.conf`. `graperank.conf` holds no secrets, but it is hand-edited, the
patch costs nothing (stdout is unchanged and the status is still logged), and it lets AC-4's scan use one simple rule:
*every* exec call whose command runs `source` keeps stderr out and logs no `message`/`stderr`. Without it the scan
would have to tell config files apart.

## Consequences

- **Enables:** the leak is closed at the source for all ~105 shell scripts, since none runs until the entrypoint has
  passed both checks, and value-driven command execution through the conf is closed with it.
- **Constrains:** the nine substituted variables can't contain `"`, `$`, a backtick, `\` or a line break. An instance
  whose secret has one stops at startup with the variable's name. The fix is to change that secret (for
  `NEO4J_PASSWORD`, change it in Neo4j too). This goes in OPERATIONS.md §11.
- **Operator visibility:** a refused start names the variable or the line number, which is enough to find the problem
  without printing it. A failed GrapeRank lookup logs its key and exit status, as story 10's five do.
- **Left open, recorded in the book:**
  - a hand edit to `/etc/brainstorm.conf` inside a running container still reaches the shell scripts' logs until the
    next start, when the file is re-rendered;
  - bare-metal installs (`setup/install-control-panel.sh`) copy the template once and never run either check;
  - a value containing `'` is still read differently by `getConfigFromFile()`'s regex (which stops at the first `'`)
    than by bash. That is a correctness issue, not a leak, and outside this story; it gets an OPEN.md row.
- **Branches.** This ships to `staging`, then `main` on the owner's promotion, like stories 9 and 10. The sandboxes
  (`feature-magic-carpet`, `feat/tags`) and the agent-memory instance follow `main` (audit
  `config-secret-logging` §4 #4), so there is no separate port.
- **Firmware reinstall required?** No.

## Implementation notes

Production code (Phase 4):

- **`tools/render-conf-template.js`** — after the missing-variable check, collect the names of referenced variables
  whose `process.env` value matches `/["$`\\\r\n]/`. If any, write the `RenderError` line above (names only, sorted,
  de-duplicated) and `process.exit(3)`. Check before writing to stdout, so nothing is half-written. Update the header
  comment's error list.
- **`tools/check-conf-syntax.sh`** (new, `#!/bin/bash`, executable) — `out=$(bash -n "$1" 2>&1 >/dev/null)`; on
  success exit 0 silently; on failure take `grep -oE 'line [0-9]+'` from `"$out"`, first match, digits only, print the
  message above, exit 1. Never `echo "$out"`. A missing or unreadable file argument is a failure with its own message.
- **`docker/entrypoint.sh`** — after `chmod 664 /etc/brainstorm.conf` and before the `generated from` echo, run
  `"${BRAINSTORM_MODULE_BASE_DIR}tools/check-conf-syntax.sh" /etc/brainstorm.conf` and exit 1 with the FATAL line
  above if it fails. Confirm `tools/` is in the image (the renderer already runs from there).
- **The nine GrapeRank files and `calculateFromLibrary.ts`** — on every `execSync` whose command runs `source`
  (brainstorm and graperank alike), add `stdio: ['ignore', 'pipe', 'ignore']`, keeping `shell` and `encoding`. Then
  find every `catch` such an error can reach, including a function-level catch that also wraps a non-exec error, and a
  top-level `main().catch`. In each, log a fixed message with the key(s) and `${error.status}`; never `error.message`,
  `error.stderr`, the bare error, `String(error)` or `error.stack`. Where a catch also handles non-exec errors (for
  example the `Missing Neo4j connection details` throw in `getNeo4jConfig()`), log a fixed text naming the step and
  the status, which is `undefined` for those, and keep the existing rethrow or exit. Exit paths and return values stay
  as they are.
- **`calculateFromLibrary.js`** — regenerate it from the patched `.ts` with the same `tsc` the wrapper runs (in the
  scratch container, where the image has it), and commit both. If the output differs from today's beyond the patched
  calls, keep today's file and hand-apply the same edits to it instead, so the diff stays reviewable; say which in the
  commit.
- **Delete** `src/algos/customers/personalizedGrapeRank/updateNeo4j_copy.js` and
  `updateNeo4jWithApoc_moreLogsButWithBug.js` (`git rm`). Nothing references them (`git grep`, 2026-10-31).
- **OPERATIONS.md §11** — a short paragraph: the two startup checks, what their messages mean, the five characters a
  substituted value can't contain, and the hand-edit gap.
- **OPEN.md** — one row for the `'` mismatch in `getConfigFromFile()`.

For the Tester (Phase 3; test files are the Tester's lane):

- **AC-1/AC-2 are stack-free.** Run `render-conf-template.js` against a fixture template with a fixture env, and
  `check-conf-syntax.sh` against fixture conf files, through `child_process` on the host's bash. Use distinctive
  values and assert they appear nowhere in stdout or stderr. For AC-2, include `a$(touch <marker>)b` and assert the
  marker file does not exist afterwards, and `pw" TAILY "` and assert refusal names `NEO4J_PASSWORD`. For the syntax
  check, include an error kind where `bash -n` echoes the line (`B=pw)TAIL`).
- **The entrypoint wiring** is checked on its source (`docker/entrypoint.sh` calls the checker after the render and
  exits on failure), as `entrypoint-template-rendering`'s T6 does for the renderer.
- **AC-4's scan** must find every exec-family call whose command contains `source`, in `.js`, `.mjs`, `.cjs` and `.ts`
  under `src/`, `lib/` and `bin/`, including the compiled `(0, child_process_1.execSync)("source ".concat(…))` form.
  Prove the scan isn't vacuous: assert it finds at least the 38 calls the table above and story 10 account for once the
  dead copies are gone (33 in the table's nine files, the `.ts` and its `.js`, plus story 10's five), and that an unpatched call added to a fixture fails it. It replaces story 10's fixed
  `READERS` list in `test/config-source-stderr.test.js` or sits beside it; the Tester decides.
- **Option C's protection, as a test:** every non-comment, non-blank line of `config/brainstorm.conf.template` is
  `export NAME`, or an optional `export ` then `NAME=` and one double-quoted, single-quoted or bare word, and every
  `${NAME}` sits inside double quotes.
- **AC-5's pre-push proof** is operational, done at Review with the owner's OK to SSH: on each droplet, inside the
  `tapestry` container, `bash -n /etc/brainstorm.conf` (exit status only) and a count of the nine substituted
  variables' lines whose value contains one of the five characters. Print counts and statuses only, never a line.

## Out of scope

- The hand-edit gap, bare-metal installs and the `'` mismatch (see Consequences).
- Logging `.signal` as well as `.status` (story 10's review, non-blocking finding 4).
- The other config files' own templates and readers.
