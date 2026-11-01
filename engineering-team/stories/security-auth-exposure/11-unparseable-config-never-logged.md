# Story 11: A config file bash can't parse never reaches a log

**Status:** Done
**Created:** 2026-10-31
**Type:** Bug (security / secret exposure)
**Epic:** `security-auth-exposure`
**Book:** `audits/config-parse-leak/`
**Source:** `stories/_intake.md`, 2026-10-31 ("A config file bash can't parse still leaks through the GrapeRank scripts
and the shell scripts"), queued at story 10's review (`reviews/security-auth-exposure/10-config-source-stderr-no-values.md`,
non-blocking findings 1, 2 and 6), after ngit issue `c549202b`

## Background

When a line of `/etc/brainstorm.conf` isn't valid bash, `source` prints that line, secret value and all, to stderr,
and the logs capture it. Story 10 closed this for five shared or standalone JavaScript readers. Two groups still leak.

**1. Eleven GrapeRank `.js` files** make 27 `execSync` calls that source `${CONFIG_FILES.brainstorm}` with stderr
passed through, and log the error's `message`, which repeats bash's stderr. Some read `NEO4J_PASSWORD`.

| File | Calls | Caller |
|---|---|---|
| `src/algos/personalizedGrapeRank/updateNeo4j.js` | 3 | `updateNeo4j.sh` |
| `src/algos/personalizedGrapeRank/initializeRatings.js` | 1 | `initializeRatings.sh` |
| `src/algos/personalizedGrapeRank/calculateGrapeRank.js` | 1 | `calculateGrapeRank.sh` |
| `src/algos/customers/personalizedGrapeRank/initializeScorecards.js` | 4 | `personalizedGrapeRank.sh` |
| `src/algos/customers/personalizedGrapeRank/updateNeo4jWithApoc.js` | 3 | `personalizedGrapeRank.sh` |
| `src/algos/customers/personalizedGrapeRank/interpretRatings.js` | 1 | `personalizedGrapeRank.sh` |
| `src/algos/customers/personalizedGrapeRank/calculateGrapeRank.js` | 1 | `personalizedGrapeRank.sh` |
| `src/algos/customers/personalizedGrapeRank/updateNeo4j.js` | 3 | none found |
| `src/algos/importedGrapeRankEngine/calculateFromLibrary.js` | 4 | `calculateFromLibrary.sh`, `calculatePersonalizedGrapeRank.sh` |
| `src/algos/customers/personalizedGrapeRank/updateNeo4j_copy.js` | 3 | none: dead copy |
| `src/algos/customers/personalizedGrapeRank/updateNeo4jWithApoc_moreLogsButWithBug.js` | 3 | none: dead copy |

`calculateFromLibrary.sh` runs `tsc ./calculateFromLibrary.ts` before `node ./calculateFromLibrary.js`, so the `.js`
is rebuilt from `calculateFromLibrary.ts` on every run. The fix has to be in the `.ts` as well, or the next run undoes
it. *(Found at Planning, 2026-10-31; story 10's review noted the file is compiled but not that the wrapper recompiles
it.)* A search of `src/`, `lib/` and `bin/` (2026-10-31) found no other JavaScript or TypeScript that sources the conf.

**2. About 105 shell scripts** run `source /etc/brainstorm.conf` directly, including most of the GrapeRank scripts'
wrappers and `bin/update-config.sh`. A malformed line prints to their own logs the same way. Patching each script is
not practical, and a script can't stop bash from printing a line it can't parse except by hiding its own stderr.

**Where a bad line comes from.** In Docker, `docker/entrypoint.sh` renders `/etc/brainstorm.conf` from
`config/brainstorm.conf.template` on every start, pasting each value from the environment between double quotes as it
is (`tools/render-conf-template.js`). So a value that contains `"` breaks the file, and a value that contains `$(…)` or
a backtick would be *run* by every script that sources it. A hand edit inside a running container is the other way
in, and the next start overwrites it. `bash -n` doesn't catch every bad line: `B=pw TAILY` parses, and bash then runs
`TAILY` as a command and prints `TAILY: command not found` (story 10's review, finding 2).

**What this story is not about.** It changes only what can reach a log, and whether a container with a broken conf
starts. Every value a well-formed conf yields is unchanged. It touches no point of view, publishing path or graph
state (principles 1–4 don't apply).

## User-facing description

As the owner of a Brainstorm instance, I want a config value that would break or misbehave in my config file to stop
my instance at startup with a message that says which line or setting is wrong, without printing it, so that a typo or
an odd character in a secret never ends up in my logs, and never runs as a command.

## Acceptance criteria

- [ ] **AC-1 A conf bash can't parse stops startup, quietly.** Given environment values that make the rendered
      `/etc/brainstorm.conf` invalid bash, when the entrypoint runs, then it exits non-zero before it starts any
      service, its message names the line number, and nothing it writes to stdout or stderr contains the offending
      line or the value.
- [ ] **AC-2 A value is never run or reinterpreted when the conf is sourced.** Given an environment value containing
      `"`, `$`, a backtick, `\` or a newline (for example `a$(touch <marker>)b` or `pw" TAILY "`), when the entrypoint
      renders the conf, then either startup is refused (naming the setting, never its value) or sourcing the rendered
      conf yields exactly that value. In no case does sourcing it run a command, and in no case does the value appear
      in the entrypoint's output. The Architect picks which.
- [ ] **AC-3 The GrapeRank scripts keep bash's stderr out of the log.** In the nine live or uncalled files above, and
      in `calculateFromLibrary.ts`, every call that sources the config file keeps bash's stderr out of the process's
      output, and a failed lookup is logged with its key and exit status, never with the error's `message` or
      `stderr`. The two dead copies are deleted.
- [ ] **AC-4 The check covers the whole tree.** A test scans `src/`, `lib/` and `bin/` (JavaScript and TypeScript) and
      fails if any call that sources the config file lets bash's stderr through or logs the error's `message` or
      `stderr`. Story 10's five readers and this story's files pass it; adding an unpatched call makes it fail.
- [ ] **AC-5 Nothing else changes.** For a well-formed conf, every reader returns the same value as before, and a
      container rendered from today's template with ordinary values starts as before. Staging's and production's
      current values pass the new startup check, shown before anything is pushed. Stories 9's and 10's suites and
      `entrypoint-template-rendering` still pass.

## Concepts touched

None. No concept-graph handles, definitions or firmware.

## Out of scope

- **A hand edit inside a running container.** It reaches the shell scripts' logs until the next start re-renders the
  file, and then AC-1 catches it. A `bash -n` check before every `source` would mean editing ~105 scripts; left open
  and recorded in the book.
- **Bare-metal installs.** `setup/install-control-panel.sh` copies the template once and never re-renders it, so the
  startup check doesn't run there. Every droplet in OPERATIONS.md §1 runs the stack in Docker.
- **Lines appended after the render** by `setup/create_nostr_identity.sh` (the TA's public key and npub, single-quoted
  hex). They hold no secrets.
- **The other config files** (`graperank.conf`, `whitelist.conf`, `blacklist.conf`, `nip56.conf`). They are copied
  from templates without substituting anything and hold no secrets.
- **Rotating secrets.** Operational, owner's call.

## Open questions

None. *(The PO considered splitting the entrypoint check and the GrapeRank patch into two stories. They share one
leak, one book and one test file, and the owner's brief names a single story #11, so they stay together.)*

## Phase path

Bug, Standard strictness, all phases: Planning → Architecture (the startup check and AC-2's choice are design
decisions) → Test Design → Implementation → Review. Nothing is pushed without the owner's OK.

## Linked artifacts
- ADR: `decisions/security-auth-exposure/0006-refuse-unsafe-conf-at-render.md`
- Test plan: `stories/security-auth-exposure/11-unparseable-config-never-logged.test-plan.md`
- Review: `reviews/security-auth-exposure/11-unparseable-config-never-logged.md`
