# Review: Story 11 — A config file bash can't parse never reaches a log

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-31
**Diff:** `git diff 7c17785c..HEAD` (HEAD `94883c6d`; commits `e43f600a` book, `28e37746` story, `e0ef6913` ADR,
`a33ff545` failing tests, `94883c6d` fix). *`git diff origin/staging..HEAD` is not this story's diff: `origin/staging`
has moved on to `56d76a2b` (the appearance-setting merge), so that range also shows that work reversed. `7c17785c` is
the merge base. `git merge-tree origin/staging HEAD` merges cleanly.*
**Story:** `stories/security-auth-exposure/11-unparseable-config-never-logged.md`
**ADR:** `decisions/security-auth-exposure/0006-refuse-unsafe-conf-at-render.md`
**Test plan:** `stories/security-auth-exposure/11-unparseable-config-never-logged.test-plan.md`
**Book:** `audits/config-parse-leak/book.md`

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` — **not run.** On this Mac the full `npm test` publishes fixtures to public relays, so it is not
      run here. `node test/gate-status.js` reports `no gate run records in …/tmp/gate-runs`, so there is no
      `gate:status` line to quote. Instead the five relevant suites were run one at a time through their `run()`
      export, on the host (GNU bash 5.3.15, Node 24.18.0), at HEAD:

      | Suite | Result |
      |---|---|
      | `config-parse-leak` | 11 passed, 0 failed |
      | `config-source-stderr` | 4 / 0 |
      | `config-secret-logging` | 5 / 0 |
      | `entrypoint-template-rendering` | 11 / 0 |
      | `graperank-shared-csv-race` | 13 / 0 |

      All five were checked first for Docker, port 7778 and relay use. None has any.
- [x] **The tests fail before the fix.** In a throwaway worktree at `a33ff545`: `config-parse-leak` **2 passed,
      9 failed**, the same as the test plan's Verification. The two that pass are the Option C template guard and the
      scanner's self-test, as they should. The scan found 44 calls and flagged 39 (see non-blocking 6).
- [x] **Mutations** on the fix's code (worktree at `94883c6d`, each change reverted after the run). Each of these makes
      the suite fail: dropping `stdio` from one `updateNeo4j.js` call; putting `error.message` back in
      `interpretRatings.js`'s catch; letting `\` through the refused set; letting `\r` through; printing values in the
      `RenderError`; writing the conf to stdout before refusing; making the checker `echo "$out"`; making it exit 0 on
      failure; deleting the entrypoint's check. Three mutations do **not** fail it (non-blocking 1 and 2).
- [ ] _`npm run test:playwright`: not applicable, no browser or UI change._
- [ ] _Lint not configured, skipped._
- [ ] _Typecheck not configured, skipped._
- [ ] _Build not configured, skipped._
- [x] `bash scripts/harness-lint.sh`: clean (0 violations).

**The session's evidence, which I could not re-run** (I stayed off Docker). Recorded as the session's:
1. In a throwaway container from `agent-memory-tapestry` (GNU bash 5.1.16): the same five suites 11/0, 4/0, 5/0,
   11/0, 13/0.
2. The real `docker/entrypoint.sh`, with only `exec /usr/bin/supervisord` replaced by an echo and `exit 0`:
   (a) `NEO4J_PASSWORD=pw"<hex>` exits 1 with the `RenderError` naming `NEO4J_PASSWORD` and the render FATAL, hex 0
   times in the output; (b) the template plus an appended `B=pw)<hex>` line exits 1 with `[check-conf-syntax] … near
   line 101` (the appended line) and the syntax-check FATAL, hex 0 times; (c) ordinary values, including a password
   with spaces and `!@#%^&*()+=:;,.?/~`, reach supervisord and print the `generated from` line, password 0 times in
   38 lines.
3. tsc 5.8.3 from the image compiled the original and the patched `.ts`. The diff between those two outputs equals
   the diff between the committed `.js` and the hand-patched `.js`, ignoring indentation.

**Pending and owner-gated:** AC-5's operational check of staging's and production's current values (over SSH, inside
`tapestry`: `bash -n /etc/brainstorm.conf` status, and a count of the nine substituted lines whose value holds one of
the five characters, counts only). Not done here. It must be done before anything is pushed.

## Spec adherence

- [x] **AC-1, a conf bash can't parse stops startup quietly.** `tools/check-conf-syntax.sh` captures `bash -n`'s
      stdout and stderr in `$out` and never prints it. `$out` goes only to `grep -oE 'line [0-9]+' | head -n 1 |
      grep -oE '[0-9]+'`, so all the checker can print is `$conf` (the path it was given) and digits. Bash puts its own
      `<file>: line N:` prefix first, so the first match is bash's line number. The script has no way to print bash's
      message. The entrypoint calls it right after `chmod 664` and before the `generated from` echo, inside `if !`
      with `exit 1` (`docker/entrypoint.sh:57-60`), well before `exec /usr/bin/supervisord`. `tools/` ships in the image
      through `COPY .` (`Dockerfile:94`), and the check runs as `bash <script>`, so file mode doesn't matter. Tests:
      the unclosed-quote test, the `B=pw)<hex>` test (which first proves plain `bash -n` echoes the value), the
      well-formed test and the wiring test. *How AC-1 is met: see non-blocking 4.*
- [x] **AC-2, a value is never run or reinterpreted.** The ADR's answer is "refuse". `UNSAFE_IN_DOUBLE_QUOTES =
      /["$`\\\r\n]/` (`tools/render-conf-template.js:50`) is checked for every referenced variable. On a match the
      renderer writes `RenderError: <names> contain(s) …`, names only, sorted and de-duplicated, writes nothing to
      stdout, and exits 3. The template has nine `${NAME}` references, and every one is inside double quotes (Option C
      guard test). Inside double quotes bash gives meaning only to `"`, `$`, the backtick and `\` (a non-interactive
      shell does no `!` history expansion), and a line break ends the line. So once those are refused, no value can
      end the string, expand, or run a command. Tests: eight unsafe forms refused by name, value never in the output,
      the safe variable never blamed; three command forms, with the marker file never created and the refusal
      required.
- [x] **AC-3, the GrapeRank calls keep bash's stderr out.** All 33 calls in the nine files and the `.ts` (25 on
      `brainstorm.conf`, 8 on `graperank.conf`, the ADR's widening) pass `stdio: ['ignore', 'pipe', 'ignore']`. Every
      catch they reach logs fixed key names and `${error.status}`. Both dead copies are deleted, and nothing outside
      `engineering-team/` and the deletion test refers to them (`git grep`).
      *`calculateFromLibrary.ts`:* `getCalculatorParams()` and `getPubkey()` had no try. Their errors reached
      `main().catch((error) => { console.error(error); … })` (`calculateFromLibrary.ts:29-31`), which prints the whole
      error. The new try/catch around each is needed for AC-3, not scope creep.
- [x] **AC-4, a scan of the whole tree.** `test/config-parse-leak.test.js` walks `src/`, `lib/` and `bin/` (`.js`,
      `.mjs`, `.cjs`, `.ts`) and finds 38 calls. Story 10's five files and this story's eleven are each required. An
      unpatched call in four forms is flagged, a loose `source` string is flagged, and an English sentence is not. *On
      whether the scan is sound, see non-blocking 1 and 2.*
- [x] **AC-5, nothing else changes (apart from the pending operational check).** `stdio` changes only stderr, so
      stdout and every value returned are as before. Exit paths are the same: the `throw new Error('Missing Neo4j
      connection details…')` used to be caught by its own catch, which logged and then exited 1 (or, in
      `customers/…/initializeScorecards.js`, returned `null`). The fix logs the same sentence directly and then exits
      1 or returns `null` (`personalizedGrapeRank/updateNeo4j.js:54-55`, `customers/…/initializeScorecards.js:155-156`,
      and the same in the other three). The two new catches in `calculateFromLibrary` exit 1, as `main().catch` did.
      The AC-5 test renders the real template with ordinary values, the checker passes it silently, and bash reads
      five values back exactly. Story 9's and 10's suites and `entrypoint-template-rendering` pass. **Pending: the
      check of staging's and production's values.**
- [x] No criterion is silently dropped. The behaviour changes outside the ACs (exit 3 from the renderer, the
      checker, the deletions) are all in the ADR.

## ADR adherence

- [x] **Files match the Implementation notes:** the renderer, the new checker, the entrypoint call, the nine files plus
      the `.ts`, the hand-applied `.js` (the commit says it was hand-applied, as the ADR asks), the two deletions, the
      OPERATIONS.md §11 subsection, and an open row (as a `ledger/` file, which is now the form for new OPEN.md rows).
- [x] **The hand-patched `calculateFromLibrary.js` matches its `.ts`.** I compared the two diffs function by function:
      the same four functions, the same two new try/catches, eight `stdio` additions, the same "Missing" change, and
      the same four log strings (template literal in the `.ts`, `.concat` in the `.js`). I could not repeat the
      session's tsc check: the only TypeScript on this host is 7.0.2, which has no ES5 target. That check stays the
      session's evidence (item 3 above).
- [x] No new dependencies. The checker is plain bash plus `grep`/`head`.
- [ ] **One small departure, not recorded:** see non-blocking 5.

## Concept-graph integrity

- [x] Not applicable. No handles, concept definitions or firmware are touched, and no firmware reinstall is needed.

## Things tests can't catch

- [x] No secrets in the diff. The fixture values are random hex made at run time.
- [x] No debug logging left in. The new `console.log`s are the test runner's own output.
- [x] No commented-out code.
- [x] Error paths: the checker refuses a missing or unreadable argument with its own message. The renderer checks for
      a missing variable first (exit 2), then for an unsafe value (exit 3), and writes nothing in either case. On
      either failure the entrypoint's `> /etc/brainstorm.conf` has already emptied the file, but the boot stops, so
      nothing sources it.
- [x] Concurrency: none new. `create_nostr_identity.sh` appends its single-quoted hex lines after the check. That is out
      of scope, and they hold no secrets.
- [x] **Security.** The leak is closed for every value the environment supplies, and for the shell scripts at each
      start. What stays open is stated in the ADR, the story and OPERATIONS.md (hand edits until the next restart,
      bare metal), apart from the wording in blocking 1.
- [x] Branch merges cleanly onto the current `origin/staging`.

## House rules check

- [x] Concept Graph API authority: not applicable.
- [x] No new lint, typecheck or build tooling.

## Findings

### Blocking

1. **`OPERATIONS.md:644`. The hand-edit check promises more than it does.** "To check an edit before anything sources
   it, run `… check-conf-syntax.sh /etc/brainstorm.conf`" runs the check on the live file, which is checked only
   *after* the edit is in place. By then any cron job or script can already have sourced it and logged the bad line.
   This is the operator instruction for the very gap this story leaves open. Asked change: tell the operator to edit
   a copy, check the copy (`… check-conf-syntax.sh /tmp/brainstorm.conf.new`), and only then move it into place, or
   drop the words "before anything sources it".
2. **`ledger/2026-10-31-quote-in-conf-value-misread.md:10-12`. Two claims are wrong.**
   (a) "`lib/config.js` the same way": it isn't. `loadFromConfigFile()` (`lib/config.js:54-58`) strips one matching
   pair of surrounding quotes, so `"ab'cd"` reads as `ab'cd`, the same as bash. Only `getConfigFromFile()` stops at the
   first `'`.
   (b) "bash and the JavaScript readers agree on every value it writes, except one case": they don't. An empty value
   is a second case. With `export BRAINSTORM_ADMIN_PUBKEYS=""` (what the template writes when `ADMIN_PUBKEYS` is unset,
   the entrypoint's default), the quoted pattern captures the empty string, which is falsy, so the unquoted fallback returns the two
   characters `""`. Probed on the host: `getConfigFromFile` gives `{"admin":"\"\"","pw":"ab"}`, and bash gives
   `|ab'cd`. It does no harm today (`getAdminPubkeys()`, `src/utils/config.js:116`, then holds an entry `""`, which no
   pubkey matches), and it predates this story. But the sentence claims an agreement story 11 doesn't give.
   Asked change: drop `lib/config.js` from the row, and either name the empty-value case too or soften "every value …
   except one case" to say what was checked. The book's frame asks that "what stays open is written down, not
   claimed fixed".

### Non-blocking

1. **`test/config-parse-leak.test.js:234`. The scan checks the *next* catch in the text, not the one that guards the
   call.** In today's tree it gets this right: a separate check found that all 38 calls sit inside the try of the
   catch the scan picks. At `a33ff545` it was wrong four times: `getCalculatorParams()` and `getPubkey()`, in both the
   `.ts` and the `.js`, were matched to `getConfig()`'s catch. Mutation: with `getPubkey()`'s new try/catch removed
   (keeping `stdio`), the suite still passes 11/0, although that error would reach `main().catch(console.error(error))`.
   With `stdio` enforced, `error.message` only holds the command text, so this is a gap in the defence in depth, not a
   leak. Optional: require the catch's `try { … }` to contain the call. The `CATCH` regex (`:216`) also skips a
   bare `catch {` and a promise `.catch(`, so those fall through to a later catch in the same way.
2. **`test/config-parse-leak.test.js:214`. `SOURCE_LITERAL` doesn't see some forms.** It misses `source "${X}"` (a
   quoted path), `. ${X}` (the dot command) and `source ./x` (a relative path). They aren't flagged as calls or as
   orphans. None is in the tree today (`git grep`). An existing call rewritten into one of these forms is caught only
   by the floor of 38. Mutations: each drops the count to 37 and fails. A *new* call in one of these forms would pass.
   Optional: widen the pattern to `["'.]` after `source\s+`, and add `\.\s+[$/"']`.
3. **`tools/check-conf-syntax.sh:22`. The line-number pattern is English-only.** In a non-English locale bash's
   `line N` is translated, so the checker falls back to its message with no number. It still refuses and still
   prints nothing of the file. Optional: `LC_ALL=C bash -n`.
4. **How AC-1 is met.** Since the renderer refuses unsafe values, no *environment value* can make the rendered conf
   invalid bash any more. Such a value stops at render, with the variable named, not a line number. AC-1's
   line-number message now applies only to a broken template (the session's evidence 2b). That is the ADR's
   owner-accepted design, and it is stricter than AC-1 asks. Recorded so the book's close describes it accurately.
5. **The `Missing Neo4j connection details` change differs from the ADR's note.** The ADR said to keep the throw and
   have the catch log "a fixed text naming the step and the status, which is `undefined`". The fix logs the sentence
   directly and exits (or returns `null`). That is clearer, and exit codes and return values are the same. The log
   line loses its `Error loading Neo4j configuration:` prefix. The commit doesn't record this as a departure.
6. **`…11-unparseable-config-never-logged.test-plan.md:115`. "44 calls flagged".** At `a33ff545` the scan *found* 44
   calls and *flagged* 39. Story 10's five were already clean. Optional wording fix.
7. **AC-5's operational check covers staging and production only.** The ADR's Consequences say the sandboxes
   (`feature-magic-carpet`, `feat/tags`) and the agent-memory instance follow `main`. If one of them has a `"`, `$`, a
   backtick or `\` in a substituted value, it stops starting when `main` is promoted. Worth the same count-only check
   before that promotion. That is the owner's call, and outside this branch.

### Harness friction

1. The brief's diff command (`git diff origin/staging..HEAD`) shows unrelated work reversed once `staging` moves on.
   `git diff <merge-base>..HEAD` (or `origin/staging...HEAD`, three dots) is the story's diff. Small, and the brief
   also gave the base. Not filed.
2. The review template asks for `npm test` and its `gate:status` line, which this machine's standing rule forbids. A
   known constraint, already in the session's memory, so there is nothing new to file.

## Verdict

**CHANGES_REQUESTED**

The code meets AC-1 to AC-4. AC-5 is met except for the owner-gated check of staging's and production's values, which
is still pending. The tests pass, fail before the fix, and catch the mutations that matter. The two blocking items are
wording only: an OPERATIONS.md instruction that promises a check before anything sources the file, and a ledger row
whose claims are wrong. Both are one-line fixes, and the next round needs only those re-checked, plus the AC-5
operational check before anything is pushed.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. *(Not applicable: CHANGES_REQUESTED. Per the brief, the session
      handles the story's Status and the commit after the owner's gate.)*
- [ ] Completion detection: not run, since this is not a PASS.

---

## Round 2 — 2026-10-31 (HEAD `d4784665`)

**Diff checked:** `git diff 94883c6d..d4784665`. It touches OPERATIONS.md, the book, the test plan, two `ledger/` rows
and `tools/check-conf-syntax.sh`. No code under `src/` and no test file changed. Every change was checked as a new
claim, including the wording I suggested in round 1.

### Gates (re-run by the reviewer at `d4784665`, host)

| Suite | Result |
|---|---|
| `config-parse-leak` | 11 passed, 0 failed |
| `config-source-stderr` | 4 / 0 |
| `config-secret-logging` | 5 / 0 |
| `entrypoint-template-rendering` | 11 / 0 |

`graperank-shared-csv-race` wasn't re-run, since none of its inputs changed in round 2. Full `npm test`: not run
(machine rule), and still no `gate:status` record. `harness-lint`: clean. `git merge-tree origin/staging HEAD`:
clean.

**The `LC_ALL=C` change, probed:**
- A conf with UTF-8 values (`café 🐶` inside double quotes) still passes silently (status 0).
- Under `LANG`/`LC_ALL=de_DE.UTF-8`, `B=pw)SECRETXYZ` is still refused with "near line 2", and the value is not
  printed.

### Round-1 findings, re-checked

| Round 1 | Disposition | Check |
|---|---|---|
| **Blocking 1**: OPERATIONS.md:644 | Fixed | It now says to edit a copy, check the copy, and only then move it into place, so the check comes before anything sources the edit. Accurate. A small follow-on is non-blocking R2-2. |
| **Blocking 2**: the ledger row for the quote | Fixed | `lib/config.js` is now named as not affected, and the cited lines `lib/config.js:55-59` are the quote-stripping lines. The empty-value case is added and matches my round-1 probe. "Nothing it writes can run or expand when sourced" is true for the renderer, given the refused set. Proposed fix: `=(["'])(.*?)\1` tested with `!== undefined` returns `''` for `""` and `ab'cd` for `"ab'cd"`, so it fixes both, as claimed (by reading). |
| NB1, NB2: the scan's blind spots | Filed as `ledger/2026-10-31-source-call-scan-blind-spots.md`, test unchanged | Filing is acceptable: the test is the Tester's lane, no call in today's tree hits either gap, and all 38 calls are correctly matched to their catch. The row's line references (`:214`, `:216`, `:234`) are right. But one sentence in it is wrong: **blocking R2-1**. |
| NB3: locale | Fixed (`LC_ALL=C bash -n`) | Probed above. |
| NB4: how AC-1 is met | Note only | Nothing needed. |
| NB5: departure from the ADR | Recorded in `d4784665`'s commit message | Accurate: exit codes unchanged. |
| NB6: "44 calls flagged" | Fixed: "44 found and 39 flagged" | Matches my run at `a33ff545`. |
| NB7: sandboxes | Recorded in the book's AC-5 bullet | Accurate. |

### AC-5, operational (the session's evidence; I can't re-run it)

The session reports, owner-approved, read-only over SSH, counts only, inside `tapestry` on staging and production:
- `bash -n /etc/brainstorm.conf` exits 0 on both.
- 0 of 10 substituted lines hold `"`, `$`, a backtick or `\`.
- 0 unsafe values (CR/LF included) among `OWNER_PUBKEY`, `ADMIN_PUBKEYS`, `NEO4J_PASSWORD`, `DOMAIN_NAME`,
  `RELAY_URL` (from the container's environment) and `session.secret`.

"10 substituted lines" is not every line the template substitutes into. 16 lines hold a `${…}`. The 10 are lines
14, 18, 66, 69, 72, 75, 78, 79, 81 and 84 (one per variable, plus a second line for `DOMAIN_NAME`). The other six,
lines 19 to 24, add a fixed suffix to `${BRAINSTORM_MODULE_BASE_DIR}`, a fixed path the entrypoint sets
(`docker/entrypoint.sh:11`), so they can't hold an unsafe character. The values that came from neither check are set
by the entrypoint itself (`BRAINSTORM_MODULE_BASE_DIR`, and `BRAINSTORM_NODE_BIN` from `which node`) or derived from
`OWNER_PUBKEY` (`OWNER_NPUB`). Recorded as the session's evidence.
With it, AC-5 is met.

### Findings

#### Blocking

1. **R2-1. `ledger/2026-10-31-source-call-scan-blind-spots.md:24-25` says "The leak itself does not depend on
   either".** That holds for the first gap, the catch matching. I probed it: with `stdio: ['ignore', 'pipe',
   'ignore']`, `execSync`'s error has `stderr: null` and its `message` is only `Command failed: <command>`. It is false
   for the second gap. A new call written as `source "${X}"`, `. ${X}` or `source ./x` is never recognized as a call,
   so its `stdio` is never checked either. Without `stdio` it passes bash's stderr straight through and leaks, and the
   suite still passes. So this row understates an open security gap, which the book's frame asks not to do ("written
   down, not claimed fixed"). Asked change: limit the sentence to the first gap, and say that the second gap can hide
   an unpatched call, leak included.

#### Non-blocking

1. **R2-2. `OPERATIONS.md:644`: the copy-and-move recipe.** `cp /etc/brainstorm.conf /tmp/brainstorm.conf.new` makes
   a root-owned copy with the default umask (normally 644), so a plain `mv` back loses the 664 the entrypoint sets.
   Something writes the file at runtime (`src/utils/customerRelayKeys.js:89`, `src/manage/customers/createAllCustomerRelays.js:82`),
   so the mode may matter. It also leaves a copy of a file that holds secrets in `/tmp`, world-readable inside the
   container. Optional: `cp -p` for the copy, and write the copy back with `cat /tmp/brainstorm.conf.new >
   /etc/brainstorm.conf` (keeps owner and mode), then delete it.

### Verdict (round 2)

**CHANGES_REQUESTED**

Code, tests and AC-1 to AC-5 now hold, AC-5 on the session's owner-approved evidence. Every round-1 item is fixed or
filed acceptably. The one thing left is one sentence in the new ledger row, which says the leak doesn't depend on the
scan's blind spots when the second one can hide an unpatched, leaking call. Once that sentence is fixed this review
expects to PASS, with the next round checking only that line (and anything else the fix touches).

---

## Round 3 — 2026-10-31 (HEAD `a7531a97`)

**Diff checked:** `git diff d4784665..a7531a97`, which touches only OPERATIONS.md:644 and
`ledger/2026-10-31-source-call-scan-blind-spots.md:24-28`. No code or test changed (`git diff a33ff545..HEAD -- test`
is empty). `config-parse-leak` was re-run at HEAD: 11 passed, 0 failed. `harness-lint` is clean, and the branch still
merges cleanly onto `origin/staging`.

| Round 2 | Check |
|---|---|
| **R2-1** (blocking): the ledger row | **Fixed.** The row now treats the two gaps separately. The first doesn't reopen the leak, which matches my round-2 probe (`stderr: null`; `message` is only `Command failed: <command>`), because every call the scan *recognizes* still has its `stdio` checked. The second can: an unrecognized form escapes the `stdio` check, so bash's stderr reaches the log while the suite passes. "Fix the second first" is the right order. Accurate. |
| **R2-2** (non-blocking): the OPERATIONS.md recipe | **Fixed.** `cp -p` keeps the copy's mode. `cat … > /etc/brainstorm.conf` truncates and rewrites the existing file in place, so the original's owner and 664 mode stay. The copy is deleted afterwards. Accurate. (The file is empty for a moment while `cat` rewrites it. That window can't leak anything, so it isn't a finding.) |

No new findings.

### Verdict (round 3)

**PASS**

The diff meets the story (AC-1 to AC-5; AC-5's operational check on the session's owner-approved evidence), ADR 0006
(its one departure is recorded in `d4784665`'s message), and the test plan. The tests fail before the fix and pass
after it, and mutations show they catch what matters. The two scan gaps that stay open are recorded accurately as
`ledger/2026-10-31-source-call-scan-blind-spots.md`.

**On PASS.** Per the brief, the session flips the story's `**Status:**` to `Done` and makes the review commit after the
owner's gate. The reviewer did neither.
