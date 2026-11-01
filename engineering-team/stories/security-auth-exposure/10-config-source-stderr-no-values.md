# Story 10: Sourcing the config file never puts its contents in a log

**Status:** Done
**Created:** 2026-10-31
**Type:** Bug (security / secret exposure)
**Epic:** `security-auth-exposure`
**Book:** `audits/config-secret-logging/`
**Source:** story 9's review (`reviews/security-auth-exposure/9-config-reader-logs-no-values.md`, non-blocking findings 1
and 2), after ngit issue `c549202b`

## Background

Story 9 stopped `getConfigFromFile()` from printing the values it reads. Its review found two ways config values still
reach a log.

**1. Bash's error output.** Several JavaScript readers fetch a key by running `source <conf> && echo $KEY` in bash
through `execSync`. `execSync` passes the child's stderr straight through to the process's own stderr unless `stdio`
says otherwise, and `brainstorm.log` captures both streams. When a line of the conf isn't valid bash, bash prints that
line, value and all, to stderr. Three readers then log the error's `message` as well, which Node builds as
`Command failed: <cmd>\n<stderr>`, so the line appears twice. The reviewer reproduced it with
`export NEO4J_PASSWORD=pw)TAIL` and a lookup of an unset key.

The installer and the conf template double-quote every secret, so it takes a hand edit, or a value containing `"`, to
make the conf invalid. When that happens, though, every lookup that reaches `source` prints the broken line again, and
the control panel does several at startup.

This story fixes the five shared or standalone readers below. *(Narrowed at Review, 2026-10-31.)* The review found 11
more `.js` files, all GrapeRank scripts, with 27 more calls that do the same thing. The owner chose to keep this story
to these five and queue the rest: see *Out of scope*.

| Reader | Inherits stderr | Logs `error.message` |
|---|---|---|
| `src/utils/config.js` `getConfigFromFile()`, the `source` fallback | yes | yes |
| `lib/config.js` `getConfigValue()` | yes | yes |
| `src/pipeline/stream/addToQueue.mjs` `getConfigValue()` | yes | yes |
| `src/algos/nip85/publish_nip85_30382.js` `getEnvVar()` | yes | yes |
| `src/algos/personalizedGrapeRank/initializeScorecards.js` `getOwnerPubkey()` | yes | yes |

**2. A second copy of the value-logging bug.** `addToQueue.mjs` has its own reader, and it logs every value it finds:
`Found <KEY> in config file: <value>`, `Found <KEY> in environment: <value>`, and
`Using default value for <KEY>: <default>`. Today it reads only `BRAINSTORM_RELAY_URL`, which is public. The next key
read through it would bring back the bug story 9 fixed.

**What this story is not about.** It changes only what these readers let into a log. Every value they return is
unchanged, and so is every exit path (`initializeScorecards.js` still exits 1 when the owner's key is missing). It
touches no point of view, publishing path or graph state (principles 1–4 don't apply).

## User-facing description

As the owner of a Brainstorm instance, I want a mistake in my config file to show up in my logs as "this lookup
failed", not as a copy of the line with my secret in it, so that a typo while editing secrets never puts them where
anyone who reads or ships my logs can see them.

## Acceptance criteria

- [ ] **AC-1 A malformed conf line never reaches the log through `getConfigFromFile()`.** Given a config file with a
      line that isn't valid bash and holds a distinctive value, when a process calls `getConfigFromFile()` for a key
      that only the `source` fallback could find, then nothing the process writes to stdout or stderr, its children's
      inherited output included, contains that value, and the call still returns the default as before.
- [ ] **AC-2 The same holds for the other four readers.** In `lib/config.js`, `addToQueue.mjs`,
      `publish_nip85_30382.js` and `initializeScorecards.js`, every `execSync` call that sources the config file keeps
      bash's stderr out of the process's output, and no error from such a call is logged with its `message` or
      `stderr`.
- [ ] **AC-3 Failures are still visible.** When a `source` lookup fails, the reader still logs that it failed, for which
      key, and the exit status, so an operator can tell the config file needs attention.
- [ ] **AC-4 `addToQueue.mjs` logs names, never values.** Its reader logs the key's name and where it came from (config
      file, environment, default), never the value, like `getConfigFromFile()` since story 9.
- [ ] **AC-5 Nothing else changes.** Each reader returns the same value it did before for a well-formed config file,
      and story 9's suite still passes.

## Approach

Patch each reader in place: pass `stdio: ['ignore', 'pipe', 'ignore']` to its `execSync` call, and log the error's
`status` instead of its `message`. A shared helper that all five call was considered and left out. `lib/config.js` is
required by `src/utils/config.js`, so the helper couldn't live in the latter, and two of the readers are standalone
scripts. Five small patches are easier to review than a new module. Architecture is skipped, as for story 9.

## Out of scope

- **The GrapeRank scripts that source the config file the same way.** Found at Review (2026-10-31): 11 `.js` files
  make 27 `execSync` calls that source `${CONFIG_FILES.brainstorm}` with stderr inherited and `error.message` logged,
  some of them reading `NEO4J_PASSWORD`. Eight are live, and one more (`customers/…/updateNeo4j.js`) has no caller:
  - `src/algos/personalizedGrapeRank/`: `updateNeo4j.js`, `initializeRatings.js` and `calculateGrapeRank.js`;
  - `src/algos/customers/personalizedGrapeRank/`: `initializeScorecards.js`, `updateNeo4jWithApoc.js`,
    `interpretRatings.js`, `calculateGrapeRank.js` and `updateNeo4j.js`;
  - `src/algos/importedGrapeRankEngine/calculateFromLibrary.js`.

  Two are dead copies (`updateNeo4j_copy.js`, `updateNeo4jWithApoc_moreLogsButWithBug.js`). Most of their shell wrappers
  already `source` the conf themselves, so patching only the JavaScript would still leave one copy of a broken line in
  those logs; `calculateFromLibrary.sh` doesn't, so on that path the JavaScript patch alone would close it. They're queued in `stories/_intake.md` (2026-10-31) with the shell scripts below.
- **Shell scripts that source the config file.** About 120 `.sh` files run `source /etc/brainstorm.conf` directly, and
  a malformed line prints to their own logs the same way. The fix there is different: check the rendered file once,
  when the entrypoint writes it, and refuse to start on a syntax error. Queued with the GrapeRank scripts above.
- **Making `lib/config.js` read a configurable path.** It reads only `/etc/brainstorm.conf`, so AC-2 is checked on its
  source, not by running it against a test file.
- **Rotating secrets.** Operational, owner's call.

## Phase path

Bug, Standard strictness: Planning → Test Design → Implementation → Review. Nothing is pushed without the owner's OK.
